param(
  [Parameter(Mandatory=$true)][int]$ServerPid,
  [Parameter(Mandatory=$true)][string]$TargetVersion,
  [Parameter(Mandatory=$true)][string]$NewExePath,
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [Parameter(Mandatory=$true)][string]$AppRoot
)

$StatusFile  = Join-Path $AppRoot "data\update-status.json"
$LogFile     = Join-Path $AppRoot "data\update-log.txt"
$ExeFile     = Join-Path $AppRoot 'laundry-app.exe'
$NssmPath    = Join-Path $AppRoot 'nssm.exe'
$ServiceName = 'LaundryPlusApp'

function Write-Log {
  param([string]$Level, [string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [$Level] $Message"
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Set-UpdateResult {
  param([string]$Status, [string]$FromVersion, [string]$ToVersion)
  try {
    $obj = @{}
    if (Test-Path $StatusFile) {
      $raw = Get-Content $StatusFile -Raw -Encoding UTF8
      $obj = $raw | ConvertFrom-Json
      $hash = @{}
      $obj.PSObject.Properties | ForEach-Object { $hash[$_.Name] = $_.Value }
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

function Start-AppService {
  Write-Log 'INFO' "Starting Windows Service $ServiceName..."
  if (Test-Path $NssmPath) {
    & $NssmPath start $ServiceName 2>$null
  } else {
    & sc.exe start $ServiceName 2>$null
  }
}

# ── Read package.json for fromVersion ────────────────────────────────────────
$fromVersion = 'unknown'
try {
  $pkgPath = Join-Path $AppRoot 'package.json'
  $pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $fromVersion = $pkg.version
} catch {}

Write-Log 'INFO' "Updater started: from=$fromVersion to=$TargetVersion pid=$ServerPid"

# ── Step 1: Wait for server process to exit ───────────────────────────────────
Write-Log 'INFO' "Waiting for server PID $ServerPid to exit..."
$timeout = 30
$elapsed = 0
while ($elapsed -lt $timeout) {
  $proc = Get-Process -Id $ServerPid -ErrorAction SilentlyContinue
  if (-not $proc) { break }
  Start-Sleep -Milliseconds 500
  $elapsed += 0.5
}
if ($elapsed -ge $timeout) {
  Write-Log 'WARN' "Server PID $ServerPid did not exit within ${timeout}s, forcing kill"
  try { Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue } catch {}
  Start-Sleep -Seconds 1
}
Write-Log 'INFO' 'Server process exited'

# ── Step 2: Replace exe ───────────────────────────────────────────────────────
Write-Log 'INFO' "Replacing exe: $ExeFile"
$oldExeBackup = Join-Path $BackupPath 'laundry-app.exe.bak'
try {
  Copy-Item -Path $ExeFile    -Destination $oldExeBackup -Force -ErrorAction Stop
  Copy-Item -Path $NewExePath -Destination $ExeFile      -Force -ErrorAction Stop
  Write-Log 'INFO' 'Exe replaced successfully'
} catch {
  Write-Log 'ERROR' "Exe replacement failed: $_"
  if (Test-Path $oldExeBackup) {
    try {
      Copy-Item -Path $oldExeBackup -Destination $ExeFile -Force
      Write-Log 'INFO' 'Old exe restored from backup'
    } catch { Write-Log 'ERROR' "Restore failed: $_" }
  }
  Set-UpdateResult 'rollback' $fromVersion $TargetVersion
  Start-AppService
  exit 1
}

# Delete temp download
try { Remove-Item -Path $NewExePath -Force -ErrorAction SilentlyContinue } catch {}
# NOTE: لا حاجة لتشغيل migrate.js — db.initialize() يعمل تلقائياً عند بدء الـ exe الجديد

# ── Step 3: Success ───────────────────────────────────────────────────────────
# Delete backup to reclaim disk space
try { Remove-Item -Path $BackupPath -Recurse -Force -ErrorAction SilentlyContinue } catch {}

Set-UpdateResult 'success' $fromVersion $TargetVersion
Write-Log 'INFO' "Update complete: $fromVersion -> $TargetVersion"

Start-AppService
exit 0
