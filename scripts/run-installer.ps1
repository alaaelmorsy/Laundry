param(
  [Parameter(Mandatory=$true)][string]$SetupPath,
  [string]$AppRoot = ''
)

# Derive AppRoot reliably — $PSScriptRoot can be empty when spawned from a
# detached Windows Service process. Prefer the explicit param, fall back to
# $PSScriptRoot, then hardcode the known install path as a last resort.
if (-not $AppRoot -or -not (Test-Path $AppRoot)) {
  if ($PSScriptRoot) { $AppRoot = Split-Path $PSScriptRoot -Parent }
}
if (-not $AppRoot -or -not (Test-Path $AppRoot)) {
  $AppRoot = 'C:\Program Files\PLUS\Laundry'
}

$LogFile  = Join-Path $AppRoot 'data\update-log.txt'
$TaskName = 'LaundryUpdateRun'

function Write-Log {
  param([string]$Level, [string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [$Level] $Message"
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch {}
  Write-Host $line
}

Write-Log 'INFO' "run-installer started: SetupPath=$SetupPath AppRoot=$AppRoot"

if (-not (Test-Path $SetupPath)) {
  Write-Log 'ERROR' "Installer not found: $SetupPath"
  exit 1
}

Write-Log 'INFO' "run-installer: preparing wizard for $SetupPath"

# Identify the interactive console user so the task runs in their session.
$consoleUser = $null
try { $consoleUser = (Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).UserName } catch {}
if (-not $consoleUser) {
  try { $consoleUser = (Get-WmiObject Win32_ComputerSystem -ErrorAction Stop).UserName } catch {}
}

Write-Log 'INFO' "Console user detected: '$consoleUser'"

# Visible-wizard install via the interactive user session.
# LogonType Interactive makes the task run in the console user's desktop
# session so the Inno Setup wizard appears on their screen. RunLevel Highest
# gives the installer the admin token it needs (no UAC prompt).
if ($consoleUser) {
  Write-Log 'INFO' "Scheduling wizard task as $consoleUser"
  try {
    # Remove stale task from a previous run (ignore errors if not found).
    try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}
    & schtasks /delete /tn $TaskName /f 2>$null | Out-Null

    $action    = New-ScheduledTaskAction -Execute $SetupPath
    $principal = New-ScheduledTaskPrincipal -UserId $consoleUser -LogonType Interactive -RunLevel Highest
    $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
    Write-Log 'INFO' "Task $TaskName registered successfully"

    Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    Write-Log 'INFO' 'Installer wizard launched in user session'
    exit 0
  } catch {
    $msg = $_.Exception.Message
    Write-Log 'WARN' "Interactive task launch failed: $msg"
    Write-Log 'WARN' 'Falling back to silent install'
  }
} else {
  Write-Log 'WARN' 'No interactive user found - falling back to silent install'
}

# Fallback: no interactive user or scheduling failed. Install silently.
Write-Log 'INFO' 'Running installer silently (fallback)'
try {
  Start-Process -FilePath $SetupPath -ArgumentList '/SILENT','/SUPPRESSMSGBOXES','/NORESTART' -Wait
  Write-Log 'INFO' 'Silent install finished'
  exit 0
} catch {
  $msg = $_.Exception.Message
  Write-Log 'ERROR' "Silent install failed: $msg"
  exit 1
}
