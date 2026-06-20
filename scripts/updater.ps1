param(
  [Parameter(Mandatory=$true)][int]$ServerPid,
  [Parameter(Mandatory=$true)][string]$TargetVersion,
  [Parameter(Mandatory=$true)][string]$FromVersion,
  [Parameter(Mandatory=$true)][string]$NewExePath,
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [Parameter(Mandatory=$true)][string]$AppRoot
)

# ------------------------------------------------------------------------------
# Robust self-updater for laundry-app.exe.
#
# Root-cause-proof design:
#   1. The running .exe cannot be overwritten while locked. Instead of writing
#      over it, we RENAME the old exe aside (allowed even while running) and drop
#      the new exe in its place. This sidesteps the file-lock problem entirely.
#   2. The app may be supervised by a Windows Service AND/OR a watchdog scheduled
#      task that resurrects it every few minutes. We disable the watchdog for the
#      duration of the update so it cannot re-lock the exe mid-replace, then
#      re-enable it afterwards.
#   3. We never assume a single restart mechanism: we try the service, then the
#      scheduled task(s), then a direct launch -- and we VERIFY the app is back by
#      probing its HTTPS port before declaring success.
# ------------------------------------------------------------------------------

$StatusFile   = Join-Path $AppRoot "data\update-status.json"
$LogFile      = Join-Path $AppRoot "data\update-log.txt"
$ExeFile      = Join-Path $AppRoot 'laundry-app.exe'
$OldExeFile   = Join-Path $AppRoot 'laundry-app.exe.old'
$LauncherVbs  = Join-Path $AppRoot 'launcher.vbs'
$NssmPath     = Join-Path $AppRoot 'nssm.exe'
$ServiceName  = 'LaundryPlusApp'
$WatchdogTask = 'LaundryPlusWatchdog'
$AppTask      = 'LaundryPOS'
$HttpsPort    = 3443

function Write-Log {
  param([string]$Level, [string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [$Level] $Message"
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch {}
  Write-Host $line
}

function Set-UpdateResult {
  param([string]$Status, [string]$FromVersion, [string]$ToVersion)
  try {
    $obj = @{}
    if (Test-Path $StatusFile) {
      $raw = Get-Content $StatusFile -Raw -Encoding UTF8
      $parsed = $raw | ConvertFrom-Json
      $hash = @{}
      $parsed.PSObject.Properties | ForEach-Object { $hash[$_.Name] = $_.Value }
      $obj = $hash
    }
    $obj['lastUpdateResult'] = @{
      status      = $Status
      fromVersion = $FromVersion
      toVersion   = $ToVersion
      timestamp   = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')
    }
    if ($Status -eq 'success') { $obj['hasUpdate'] = $false }
    $obj | ConvertTo-Json -Depth 5 | Set-Content -Path $StatusFile -Encoding UTF8
  } catch {
    Write-Log 'WARN' "Could not write status file: $_"
  }
}

function Test-ServiceExists {
  return [bool](Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)
}

# Update the version shown in Windows "Programs and Features" (Control Panel).
# Inno Setup records it as DisplayVersion under the app's _is1 uninstall key; the
# exe-swap update never touches it, so without this the Control Panel keeps
# showing the old version forever.
function Update-InstalledVersion {
  param([string]$Version)
  $appId = '{B2F3A1C4-9D8E-4F2B-A7C6-3E5D1F0B8A94}_is1'
  $keys = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$appId",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\$appId"
  )
  foreach ($k in $keys) {
    if (Test-Path $k) {
      try {
        Set-ItemProperty -Path $k -Name 'DisplayVersion' -Value $Version -ErrorAction Stop
        Write-Log 'INFO' "Control Panel version updated to $Version"
      } catch { Write-Log 'WARN' "Could not update registry version at ${k}: $_" }
    }
  }
}

function Test-TaskExists {
  param([string]$Name)
  $r = & schtasks /query /tn $Name 2>$null
  return ($LASTEXITCODE -eq 0)
}

function Test-AppListening {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $HttpsPort, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(1000, $false)
    if ($ok -and $client.Connected) { $client.EndConnect($iar); $client.Close(); return $true }
    $client.Close()
  } catch {}
  return $false
}

# -- Stop everything that runs or resurrects the app ---------------------------
function Stop-App {
  # 1. Disable the watchdog task so it can't `sc continue`/restart mid-update.
  if (Test-TaskExists $WatchdogTask) {
    Write-Log 'INFO' "Disabling watchdog task $WatchdogTask..."
    & schtasks /change /tn $WatchdogTask /disable 2>$null | Out-Null
  }

  # 2. Stop the Windows service if present.
  if (Test-ServiceExists) {
    Write-Log 'INFO' "Stopping service $ServiceName..."
    if (Test-Path $NssmPath) { & $NssmPath stop $ServiceName confirm 2>$null | Out-Null }
    & sc.exe stop $ServiceName 2>$null | Out-Null
  }

  # 3. End the known server PID.
  Write-Log 'INFO' "Waiting for server PID $ServerPid to exit..."
  $elapsed = 0
  while ($elapsed -lt 20) {
    if (-not (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
  }
  if (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue) {
    Write-Log 'WARN' "PID $ServerPid still alive, forcing kill"
    try { Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue } catch {}
  }

  # 4. Kill ANY stray laundry-app.exe so no handle keeps the file locked.
  Get-Process -Name 'laundry-app' -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Log 'INFO' "Killing stray laundry-app PID $($_.Id)"
    try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
  }

  Start-Sleep -Seconds 2
}

# -- Restart the app by whatever mechanism exists, then verify -----------------
function Start-App {
  $started = $false

  if (Test-ServiceExists) {
    Write-Log 'INFO' "Starting service $ServiceName..."
    if (Test-Path $NssmPath) { & $NssmPath start $ServiceName 2>$null | Out-Null }
    & sc.exe start $ServiceName 2>$null | Out-Null
    $started = $true
  }

  if (-not $started -and (Test-TaskExists $AppTask)) {
    Write-Log 'INFO' "Starting scheduled task $AppTask..."
    & schtasks /run /tn $AppTask 2>$null | Out-Null
    $started = $true
  }

  # Re-enable the watchdog (it acts as a safety net from here on).
  if (Test-TaskExists $WatchdogTask) {
    & schtasks /change /tn $WatchdogTask /enable 2>$null | Out-Null
  }

  # Verify the app is actually listening; if not, fall back to a direct launch.
  if (Wait-AppUp 25) { return $true }

  Write-Log 'WARN' 'App not listening after service/task start -- launching directly'
  try {
    if (Test-Path $LauncherVbs) {
      Start-Process -FilePath 'wscript.exe' -ArgumentList "/nologo `"$LauncherVbs`"" -WorkingDirectory $AppRoot
    } else {
      Start-Process -FilePath $ExeFile -WorkingDirectory $AppRoot -WindowStyle Hidden
    }
  } catch { Write-Log 'ERROR' "Direct launch failed: $_" }

  return (Wait-AppUp 25)
}

function Wait-AppUp {
  param([int]$TimeoutSec)
  $elapsed = 0
  while ($elapsed -lt $TimeoutSec) {
    if (Test-AppListening) { Write-Log 'INFO' "App is listening on port $HttpsPort"; return $true }
    Start-Sleep -Seconds 1
    $elapsed += 1
  }
  return $false
}

# -- Replace the exe (rename-aside strategy, lock-proof) -----------------------
function Replace-Exe {
  $oldExeBackup = Join-Path $BackupPath 'laundry-app.exe.bak'
  try { if (-not (Test-Path $BackupPath)) { New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null } } catch {}

  # Fast path: direct overwrite (works when the handle is already released).
  try {
    Copy-Item -Path $ExeFile    -Destination $oldExeBackup -Force -ErrorAction Stop
    Copy-Item -Path $NewExePath -Destination $ExeFile      -Force -ErrorAction Stop
    Write-Log 'INFO' 'Exe replaced (direct copy)'
    return $true
  } catch {
    Write-Log 'WARN' "Direct copy failed ($_); trying rename-aside strategy"
  }

  # Lock-proof path: renaming a locked exe within the same folder succeeds even
  # while a process holds an open handle to it. The old process keeps running
  # from the renamed file; the new exe takes the canonical path.
  try {
    if (Test-Path $OldExeFile) { Remove-Item -Path $OldExeFile -Force -ErrorAction SilentlyContinue }
    Rename-Item -Path $ExeFile -NewName 'laundry-app.exe.old' -ErrorAction Stop
    try { Copy-Item -Path $OldExeFile -Destination $oldExeBackup -Force -ErrorAction SilentlyContinue } catch {}
    Copy-Item -Path $NewExePath -Destination $ExeFile -Force -ErrorAction Stop
    Write-Log 'INFO' 'Exe replaced (rename-aside)'
    return $true
  } catch {
    Write-Log 'ERROR' "Rename-aside replacement failed: $_"
    # Try to undo a half-done rename so the app can still start.
    if ((-not (Test-Path $ExeFile)) -and (Test-Path $OldExeFile)) {
      try { Rename-Item -Path $OldExeFile -NewName 'laundry-app.exe' -ErrorAction Stop } catch {}
    }
    return $false
  }
}

# -- Main ----------------------------------------------------------------------
Write-Log 'INFO' "Updater started: from=$FromVersion to=$TargetVersion pid=$ServerPid"

Stop-App

if (-not (Replace-Exe)) {
  Set-UpdateResult 'rollback' $FromVersion $TargetVersion
  Start-App | Out-Null
  exit 1
}

# Clean up the temp download.
try { Remove-Item -Path $NewExePath -Force -ErrorAction SilentlyContinue } catch {}
# NOTE: لا حاجة لتشغيل migrate.js -- db.initialize() يعمل تلقائياً عند بدء الـ exe الجديد

Write-Log 'INFO' 'Restarting app...'
$up = Start-App

# Best-effort cleanup of the renamed-aside old exe (released once old proc dies).
try { if (Test-Path $OldExeFile) { Remove-Item -Path $OldExeFile -Force -ErrorAction SilentlyContinue } } catch {}
try { Remove-Item -Path $BackupPath -Recurse -Force -ErrorAction SilentlyContinue } catch {}

if ($up) {
  Update-InstalledVersion $TargetVersion
  Set-UpdateResult 'success' $FromVersion $TargetVersion
  Write-Log 'INFO' "Update complete: $FromVersion -> $TargetVersion"
  exit 0
} else {
  Write-Log 'ERROR' 'App did not come back online after update'
  Set-UpdateResult 'error' $FromVersion $TargetVersion
  exit 2
}
