param(
  [Parameter(Mandatory=$true)][string]$UpdaterScript,
  [Parameter(Mandatory=$true)][int]$ServerPid,
  [Parameter(Mandatory=$true)][string]$TargetVersion,
  [Parameter(Mandatory=$true)][string]$FromVersion,
  [Parameter(Mandatory=$true)][string]$NewExePath,
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [string]$AppRoot = ''
)

# ------------------------------------------------------------------------------
# launch-updater.ps1 -- registers a ONE-TIME scheduled task that runs updater.ps1
# a few seconds from now, outside the NSSM service job object.
#
# WHY a scheduled task:
#   The app runs as a Session-0 NSSM service (LaundryPlusApp). Any process the
#   Node server spawns is a member of the service's job object and is KILLED the
#   moment the server process exits. A scheduled task is owned by Task Scheduler,
#   NOT the service job object, so it survives the server shutdown.
#
# Unlike launch-installer.ps1, this script does NOT set NSSM AppExit 0 Exit
# because the updater runs after Node exits, and NSSM's default Restart behavior
# is what brings the service back after the exe rename completes.
#
# This script is invoked SYNCHRONOUSLY by the Node server (execFileSync) so the
# task is registered before the server exits.
# ------------------------------------------------------------------------------

if (-not $AppRoot -or -not (Test-Path $AppRoot)) {
  if ($PSScriptRoot) { $AppRoot = Split-Path $PSScriptRoot -Parent }
}
if (-not $AppRoot -or -not (Test-Path $AppRoot)) {
  $AppRoot = 'C:\Program Files\PLUS\Laundry'
}

$LogFile  = Join-Path $AppRoot 'data\update-log.txt'
$TaskName = 'LaundryPlusUpdater'

function Write-Log {
  param([string]$Level, [string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [$Level] $Message"
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch {}
  Write-Host $line
}

Write-Log 'INFO' "launch-updater: UpdaterScript=$UpdaterScript AppRoot=$AppRoot TargetVersion=$TargetVersion"

if (-not (Test-Path $UpdaterScript)) { Write-Log 'ERROR' "Updater script not found: $UpdaterScript"; exit 1 }

try {
  $consoleUser = $null
  try {
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    if ($cs) { $consoleUser = $cs.UserName }
  } catch {}
  Write-Log 'INFO' "Interactive console user: $consoleUser"

  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

  $psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$UpdaterScript`" -ServerPid $ServerPid -TargetVersion `"$TargetVersion`" -FromVersion `"$FromVersion`" -NewExePath `"$NewExePath`" -BackupPath `"$BackupPath`" -AppRoot `"$AppRoot`""
  $action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $psArgs
  $trigger  = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddSeconds(6))
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                -ExecutionTimeLimit (New-TimeSpan -Hours 1) -StartWhenAvailable

  if ($consoleUser) {
    $principal = New-ScheduledTaskPrincipal -UserId $consoleUser -LogonType Interactive -RunLevel Highest
  } else {
    Write-Log 'WARN' "No interactive user -- task will run as SYSTEM"
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  }

  Write-Log 'INFO' "Registering scheduled task '$TaskName'..."
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal `
    -Description 'PLUS Laundry legacy exe updater (one-time)' -Force -ErrorAction Stop | Out-Null
  Write-Log 'INFO' "Scheduled task '$TaskName' registered -- fires in ~6s"
} catch {
  Write-Log 'ERROR' "Failed to register updater task: $_"
  exit 1
}

exit 0
