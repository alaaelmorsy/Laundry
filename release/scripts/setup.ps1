# PLUS Laundry - Complete Setup
# Handles: HTTPS certificate + Auto-start at Windows startup
# Must be run as Administrator
#
# Usage:
#   .\setup.ps1
#   .\setup.ps1 -ExePath "C:\Laundry\laundry-app.exe"

param(
  [string]$ExePath   = (Join-Path $PSScriptRoot "..\laundry-app.exe"),
  [string]$TaskName  = "LaundryPOS"
)

$ExePath = [System.IO.Path]::GetFullPath($ExePath)
$AppDir  = Split-Path $ExePath

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "     PLUS Laundry - Setup Complete        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ── Verify exe exists ──────────────────────────────────────────────────────────
if (-not (Test-Path $ExePath)) {
  Write-Host "ERROR: laundry-app.exe not found at: $ExePath" -ForegroundColor Red
  exit 1
}

# ── STEP 1: HTTPS Certificate ──────────────────────────────────────────────────
Write-Host "STEP 1: Setting up HTTPS certificate..." -ForegroundColor Yellow
Write-Host ""

$MkcertExe = Join-Path $AppDir "mkcert.exe"
$SslDir    = Join-Path $AppDir "ssl"

if (-not (Test-Path $MkcertExe)) {
  Write-Host "  Downloading mkcert..." -ForegroundColor Yellow
  $url = "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe"
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $MkcertExe -UseBasicParsing
    Write-Host "  mkcert downloaded." -ForegroundColor Green
  } catch {
    Write-Host "  ERROR: Failed to download mkcert: $_" -ForegroundColor Red
    Write-Host "  Check your internet connection and try again."
    exit 1
  }
}

if (-not (Test-Path $SslDir)) {
  New-Item -ItemType Directory -Path $SslDir | Out-Null
}

Write-Host "  Installing trusted certificate authority..."
& $MkcertExe -install
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ERROR: Failed to install CA. Make sure you run as Administrator." -ForegroundColor Red
  exit 1
}

Write-Host "  Generating certificate for localhost..."
$keyFile  = Join-Path $SslDir "localhost-key.pem"
$certFile = Join-Path $SslDir "localhost-cert.pem"
& $MkcertExe -key-file $keyFile -cert-file $certFile localhost 127.0.0.1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ERROR: Failed to generate certificate." -ForegroundColor Red
  exit 1
}

Write-Host "  OK: HTTPS is ready — Chrome and Edge will trust https://localhost:3443" -ForegroundColor Green
Write-Host ""

# ── STEP 2: Auto-start at Windows startup ─────────────────────────────────────
Write-Host "STEP 2: Registering auto-start with Windows..." -ForegroundColor Yellow
Write-Host ""

# Task Scheduler (runs as SYSTEM, starts at system boot)
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "  Removing old scheduled task..." -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action    = New-ScheduledTaskAction -Execute $ExePath -WorkingDirectory $AppDir
$trigger   = New-ScheduledTaskTrigger -AtStartup
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description "PLUS Laundry POS System" | Out-Null

Write-Host "  OK: Scheduled task registered." -ForegroundColor Green

# Startup folder shortcut (visible shortcut for current user)
$StartupFolder = [Environment]::GetFolderPath("Startup")
$ShortcutPath  = Join-Path $StartupFolder "PLUS Laundry.lnk"

$WScriptShell = New-Object -ComObject WScript.Shell
$shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath       = $ExePath
$shortcut.WorkingDirectory = $AppDir
$shortcut.Description      = "PLUS Laundry POS System"
$IconFile = Join-Path $AppDir "assets\icon\app.ico"
if (Test-Path $IconFile) { $shortcut.IconLocation = $IconFile }
$shortcut.WindowStyle = 7  # Minimized
$shortcut.Save()

Write-Host "  OK: Shortcut added to Startup folder." -ForegroundColor Green
Write-Host ""

# ── STEP 3: Launch now ─────────────────────────────────────────────────────────
Write-Host "STEP 3: Starting the program..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Setup complete! Program is running.     " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Open browser at : http://localhost:3000" -ForegroundColor White
Write-Host "  Or HTTPS at     : https://localhost:3443" -ForegroundColor White
Write-Host ""
