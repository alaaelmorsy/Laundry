# Setup trusted HTTPS certificate using mkcert (auto-downloads if missing)
# Must be run as Administrator

param(
  [string]$AppDir = (Join-Path $PSScriptRoot "..")
)

$AppDir    = [System.IO.Path]::GetFullPath($AppDir)
$MkcertExe = Join-Path $AppDir "mkcert.exe"
$SslDir    = Join-Path $AppDir "ssl"

Write-Host ""
Write-Host "=== PLUS Laundry - HTTPS Setup ===" -ForegroundColor Cyan
Write-Host ""

# Auto-download mkcert if not present
if (-not (Test-Path $MkcertExe)) {
  Write-Host "Downloading mkcert..." -ForegroundColor Yellow
  $url = "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe"
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $MkcertExe -UseBasicParsing
    Write-Host "mkcert downloaded." -ForegroundColor Green
  } catch {
    Write-Host "ERROR: Failed to download mkcert: $_" -ForegroundColor Red
    Write-Host "Check your internet connection and try again."
    exit 1
  }
}

# Create ssl directory
if (-not (Test-Path $SslDir)) {
  New-Item -ItemType Directory -Path $SslDir | Out-Null
}

# Install local CA into Windows + Chrome/Edge trust stores
Write-Host "Installing trusted certificate authority..."
& $MkcertExe -install
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Failed to install CA. Make sure you run as Administrator." -ForegroundColor Red
  exit 1
}

# Generate certificate for localhost
Write-Host "Generating certificate for localhost..."
$keyFile  = Join-Path $SslDir "localhost-key.pem"
$certFile = Join-Path $SslDir "localhost-cert.pem"

& $MkcertExe -key-file $keyFile -cert-file $certFile localhost 127.0.0.1
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Failed to generate certificate." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "OK: HTTPS is ready" -ForegroundColor Green
Write-Host "    Chrome and Edge will now trust: https://localhost:3443"
Write-Host ""
Write-Host "Restart laundry-app.exe now to apply the certificate..."

# Restart the scheduled task if running
$task = Get-ScheduledTask -TaskName "LaundryPOS" -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask  -TaskName "LaundryPOS" -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Start-ScheduledTask -TaskName "LaundryPOS"
  Write-Host "LaundryPOS restarted automatically." -ForegroundColor Green
}

Write-Host ""
