# Register LaundryPOS Scheduled Task (runs at startup via hidden VBScript launcher)
param([string]$AppDir = (Join-Path $PSScriptRoot ".."))

$AppDir = [System.IO.Path]::GetFullPath($AppDir)
$VbsPath = Join-Path $AppDir "launcher.vbs"

# Remove old task if exists
Unregister-ScheduledTask -TaskName "LaundryPOS" -Confirm:$false -ErrorAction SilentlyContinue

# Create new task: wscript.exe /nologo launcher.vbs (hidden, no console)
$action   = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "/nologo `"$VbsPath`"" -WorkingDirectory $AppDir
$trigger  = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT60S'   # wait 60s for MySQL to be ready before starting
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "LaundryPOS" -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal -Description "PLUS Laundry POS System" -Force | Out-Null

Write-Host "OK: LaundryPOS registered. Program will start hidden with Windows."
