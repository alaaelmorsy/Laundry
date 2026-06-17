param(
  [Parameter(Mandatory=$true)][string]$SetupPath,
  [string]$AppRoot   = '',
  [int]$ServerPid    = 0
)

# ──────────────────────────────────────────────────────────────────────────────
# Silent-install launcher for laundry-app Inno Setup installer.
#
# Why silent install (not wizard):
#   The app runs as a Session-0 Windows Service. Spawning a GUI installer from
#   Session 0 never reaches the user's desktop. The scheduled-task workaround is
#   fragile (fails when the account is non-admin, UAC prompts block it, etc.).
#   Silent install (/SILENT) is 100% reliable: it runs in Session 0 with the
#   service's admin token, needs no user interaction, and the Inno Setup script
#   already handles service stop / file replace / service start.
#
# Flow:
#   1. Wait for the Node server process to exit (it exits ~2 s after calling us).
#   2. Stop the Windows service so Inno can overwrite locked files.
#   3. Kill any stray laundry-app.exe handles.
#   4. Run Setup.exe /SILENT — Inno stops service again (idempotent), replaces
#      all files, updates Control Panel version, then starts the service.
#   5. As a safety net, try to start the service in case Inno skipped it.
# ──────────────────────────────────────────────────────────────────────────────

# ── Derive AppRoot ────────────────────────────────────────────────────────────
if (-not $AppRoot -or -not (Test-Path $AppRoot)) {
  if ($PSScriptRoot) { $AppRoot = Split-Path $PSScriptRoot -Parent }
}
if (-not $AppRoot -or -not (Test-Path $AppRoot)) {
  $AppRoot = 'C:\Program Files\PLUS\Laundry'
}

$LogFile     = Join-Path $AppRoot 'data\update-log.txt'
$ServiceName = 'LaundryPlusApp'
$NssmPath    = Join-Path $AppRoot 'nssm.exe'

function Write-Log {
  param([string]$Level, [string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [$Level] $Message"
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch {}
  Write-Host $line
}

function Test-ServiceExists {
  return [bool](Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)
}

Write-Log 'INFO' "run-installer started: SetupPath=$SetupPath AppRoot=$AppRoot ServerPid=$ServerPid"

if (-not (Test-Path $SetupPath)) {
  Write-Log 'ERROR' "Installer not found: $SetupPath"
  exit 1
}

# ── 1. Wait for Node server to exit ──────────────────────────────────────────
if ($ServerPid -gt 0) {
  Write-Log 'INFO' "Waiting for Node server PID $ServerPid to exit..."
  $elapsed = 0
  while ($elapsed -lt 20) {
    if (-not (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
  }
  if (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue) {
    Write-Log 'WARN' "PID $ServerPid still alive after $elapsed s — forcing kill"
    try { Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue } catch {}
  } else {
    Write-Log 'INFO' "Node server exited after ${elapsed}s"
  }
}

# ── 2. Stop the Windows service ───────────────────────────────────────────────
if (Test-ServiceExists) {
  Write-Log 'INFO' "Stopping service $ServiceName..."
  if (Test-Path $NssmPath) { & $NssmPath stop $ServiceName confirm 2>$null | Out-Null }
  & sc.exe stop $ServiceName 2>$null | Out-Null
  Start-Sleep -Seconds 3
}

# ── 3. Kill any remaining laundry-app processes ───────────────────────────────
Get-Process -Name 'laundry-app' -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Log 'INFO' "Killing stray laundry-app PID $($_.Id)"
  try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
}
Start-Sleep -Seconds 2

# ── 4. Run Inno Setup silently ────────────────────────────────────────────────
Write-Log 'INFO' "Running installer silently: $SetupPath"
try {
  $proc = Start-Process -FilePath $SetupPath `
    -ArgumentList '/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART' `
    -Wait -PassThru -ErrorAction Stop
  $exitCode = $proc.ExitCode
  Write-Log 'INFO' "Installer exited with code: $exitCode"
} catch {
  Write-Log 'ERROR' "Failed to launch installer: $_"
  exit 1
}

if ($exitCode -ne 0) {
  Write-Log 'ERROR' "Silent install failed (exit $exitCode) — service may need manual restart"
  # Try to restart the service so the app is at least usable on the old version
  if (Test-ServiceExists) {
    if (Test-Path $NssmPath) { & $NssmPath start $ServiceName 2>$null | Out-Null }
    & sc.exe start $ServiceName 2>$null | Out-Null
  }
  exit 1
}

# ── 5. Safety-net service start (Inno may have started it already — idempotent) ─
Start-Sleep -Seconds 2
if (Test-ServiceExists) {
  Write-Log 'INFO' "Starting service $ServiceName (safety net)..."
  if (Test-Path $NssmPath) { & $NssmPath start $ServiceName 2>$null | Out-Null }
  & sc.exe start $ServiceName 2>$null | Out-Null
}

Write-Log 'INFO' 'run-installer: done'
exit 0
