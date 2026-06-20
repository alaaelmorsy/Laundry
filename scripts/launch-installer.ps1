param(
  [Parameter(Mandatory=$true)][string]$SetupPath,
  [Parameter(Mandatory=$true)][string]$RunScript,
  [string]$AppRoot   = '',
  [int]$ServerPid    = 0
)

# ──────────────────────────────────────────────────────────────────────────────
# launch-installer.ps1 — registers a ONE-TIME scheduled task that runs the real
# installer launcher (run-installer.ps1) a few seconds from now.
#
# WHY a scheduled task:
#   The app runs as a Session-0 NSSM service (LaundryPlusApp). Any process the
#   Node server spawns is a member of the service's job object and is KILLED the
#   moment the server process exits — so a directly-spawned installer never runs
#   (the update log shows zero lines from run-installer.ps1). A scheduled task is
#   owned by Task Scheduler, NOT the service job object, so it survives the
#   server shutdown. Running it as the interactive user (LogonType Interactive,
#   RunLevel Highest) makes the Inno Setup wizard appear on the user's desktop
#   with admin rights and NO UAC prompt.
#
# This script is invoked SYNCHRONOUSLY by the Node server (execFileSync) so it
# finishes registering the task before the server exits — while still a child of
# the service, but short-lived, so the job-object kill never reaches it.
# ──────────────────────────────────────────────────────────────────────────────

if (-not $AppRoot -or -not (Test-Path $AppRoot)) {
  if ($PSScriptRoot) { $AppRoot = Split-Path $PSScriptRoot -Parent }
}
if (-not $AppRoot -or -not (Test-Path $AppRoot)) {
  $AppRoot = 'C:\Program Files\PLUS\Laundry'
}

$LogFile     = Join-Path $AppRoot 'data\update-log.txt'
$ServiceName = 'LaundryPlusApp'
$NssmPath    = Join-Path $AppRoot 'nssm.exe'
$TaskName    = 'LaundryPlusInstaller'

function Write-Log {
  param([string]$Level, [string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [$Level] $Message"
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch {}
  Write-Host $line
}

Write-Log 'INFO' "launch-installer: SetupPath=$SetupPath RunScript=$RunScript AppRoot=$AppRoot"

if (-not (Test-Path $SetupPath)) { Write-Log 'ERROR' "Installer not found: $SetupPath"; exit 1 }
if (-not (Test-Path $RunScript)) { Write-Log 'ERROR' "Run script not found: $RunScript"; exit 1 }

# ── Prevent NSSM from auto-restarting the server on clean exit ────────────────
# We run as LocalSystem here (admin), so this always succeeds when the service
# exists. Without it NSSM would relaunch laundry-app.exe ~10 s later and re-lock
# the files the installer needs to replace.
if ((Test-Path $NssmPath) -and (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
  Write-Log 'INFO' "Setting NSSM AppExit 0 Exit (no restart on clean exit)..."
  & $NssmPath set $ServiceName AppExit 0 Exit 2>$null | Out-Null
}

# ── Build & register the one-time task ────────────────────────────────────────
# Preferred: run as the interactive logged-on user (RunLevel Highest) so the task
# executes in their desktop session — run-installer.ps1 then shows the wizard via
# a plain Start-Process (its 4a path). If nobody is logged on, fall back to SYSTEM
# and let run-installer.ps1 use its WTSQueryUserToken path (4b).
try {
  $consoleUser = $null
  try {
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    if ($cs) { $consoleUser = $cs.UserName }   # e.g. "DESKTOP-ABC\Owner"
  } catch {}
  Write-Log 'INFO' "Interactive console user: $consoleUser"

  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

  $psArgs   = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunScript`" -SetupPath `"$SetupPath`" -AppRoot `"$AppRoot`" -ServerPid $ServerPid"
  $action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $psArgs
  $trigger  = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddSeconds(6))
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                -ExecutionTimeLimit (New-TimeSpan -Hours 1) -StartWhenAvailable

  if ($consoleUser) {
    $principal = New-ScheduledTaskPrincipal -UserId $consoleUser -LogonType Interactive -RunLevel Highest
  } else {
    Write-Log 'WARN' "No interactive user — task will run as SYSTEM (run-installer uses WTS)"
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  }

  Write-Log 'INFO' "Registering scheduled task '$TaskName'..."
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal `
    -Description 'PLUS Laundry update installer (one-time)' -Force -ErrorAction Stop | Out-Null
  Write-Log 'INFO' "Scheduled task '$TaskName' registered — fires in ~6s"
} catch {
  Write-Log 'ERROR' "Failed to register installer task: $_"
  # Restore NSSM restart so the app stays usable if we cannot install.
  if ((Test-Path $NssmPath) -and (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
    & $NssmPath set $ServiceName AppExit 0 Restart 2>$null | Out-Null
  }
  exit 1
}

exit 0
