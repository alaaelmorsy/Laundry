# Register laundry-app.exe to auto-start with Windows via Task Scheduler
param(
  [string]$ExePath  = (Join-Path $PSScriptRoot "..\laundry-app.exe"),
  [string]$TaskName = "LaundryPOS"
)

# --- Auto-elevate to Administrator if not already ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  $args = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -ExePath `"$ExePath`" -TaskName `"$TaskName`""
  Start-Process powershell.exe -ArgumentList $args -Verb RunAs -Wait
  exit
}

$ExePath = [System.IO.Path]::GetFullPath($ExePath)

Write-Host ""
Write-Host "=== PLUS Laundry - Setup Auto-Start ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ExePath)) {
  Write-Host "ERROR: laundry-app.exe not found at: $ExePath" -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

# Remove existing task if present
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Launcher VBS path (hidden launch, no console window)
$AppDir  = Split-Path $ExePath
$VbsPath = Join-Path $AppDir "launcher.vbs"

# Decide: use launcher.vbs if exists, otherwise run exe directly
if (Test-Path $VbsPath) {
  $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "/nologo `"$VbsPath`"" -WorkingDirectory $AppDir
} else {
  $action = New-ScheduledTaskAction -Execute $ExePath -WorkingDirectory $AppDir
}

$trigger   = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT60S'
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal -Description "PLUS Laundry POS System" -Force | Out-Null

Write-Host "Starting program now..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "OK: LaundryPOS will start automatically with Windows" -ForegroundColor Green
Write-Host "    Open browser at: https://localhost:3443"
Write-Host ""
Read-Host "Press Enter to exit"
