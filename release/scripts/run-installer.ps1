param(
  [Parameter(Mandatory=$true)][string]$SetupPath
)

# ------------------------------------------------------------------------------
# Launch the PLUS Laundry Setup wizard so the logged-in user can SEE it.
#
# The app runs as a LocalSystem Windows Service (Session 0). A process spawned
# from there cannot draw windows on the interactive user's desktop. The reliable
# way to surface a GUI is to register a one-time scheduled task that runs as the
# interactive console user with Highest privileges and trigger it. The task runs
# in the user's session, so the Inno Setup wizard appears on their screen, and
# Highest gives it the admin token the installer needs without a UAC prompt.
#
# The installer (Setup.exe) then stops the service, replaces every file, updates
# the Control Panel version, re-registers the service, and restarts the app.
# ------------------------------------------------------------------------------

$AppRoot  = Split-Path $PSScriptRoot -Parent
$LogFile  = Join-Path $AppRoot 'data\update-log.txt'
$TaskName = 'LaundryUpdateRun'

function Write-Log {
  param([string]$Level, [string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [$Level] $Message"
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch {}
  Write-Host $line
}

if (-not (Test-Path $SetupPath)) {
  Write-Log 'ERROR' "Installer not found: $SetupPath"
  exit 1
}

Write-Log 'INFO' "run-installer: preparing wizard for $SetupPath"

# Identify the interactive console user (DOMAIN\user) so the task runs in their
# session. Win32_ComputerSystem.UserName is the logged-on interactive user.
$consoleUser = $null
try { $consoleUser = (Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).UserName } catch {}
if (-not $consoleUser) {
  try { $consoleUser = (Get-WmiObject Win32_ComputerSystem -ErrorAction Stop).UserName } catch {}
}

# Visible-wizard install via the interactive user session.
if ($consoleUser) {
  Write-Log 'INFO' "Interactive user: $consoleUser - scheduling wizard"
  try {
    schtasks /delete /tn $TaskName /f 2>$null | Out-Null

    $action    = New-ScheduledTaskAction -Execute $SetupPath
    $principal = New-ScheduledTaskPrincipal -UserId $consoleUser -LogonType Interactive -RunLevel Highest
    $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Principal $principal -Settings $settings -Force | Out-Null

    Start-ScheduledTask -TaskName $TaskName
    Write-Log 'INFO' 'Installer wizard launched in user session'
    exit 0
  } catch {
    $msg = $_.Exception.Message
    Write-Log 'WARN' "Interactive launch failed: $msg - falling back to silent install"
  }
}

# Fallback: no interactive user (or scheduling failed). Install silently so the
# update still completes. /SILENT shows a progress bar only.
Write-Log 'INFO' 'Running installer silently'
try {
  Start-Process -FilePath $SetupPath -ArgumentList '/SILENT','/SUPPRESSMSGBOXES','/NORESTART' -Wait
  Write-Log 'INFO' 'Silent install finished'
  exit 0
} catch {
  $msg = $_.Exception.Message
  Write-Log 'ERROR' "Silent install failed: $msg"
  exit 1
}
