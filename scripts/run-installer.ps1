param(
  [Parameter(Mandatory=$true)][string]$SetupPath,
  [string]$AppRoot   = '',
  [int]$ServerPid    = 0
)

# ──────────────────────────────────────────────────────────────────────────────
# Installer launcher — GUI-first strategy.
#
# Root causes addressed:
#   1. NSSM race condition: NSSM restarts the service ~14 s after Node exits,
#      causing file-lock conflicts with the installer. Fix: set NSSM AppExit
#      to "Exit" for exit-code 0 BEFORE anything else, so NSSM does NOT
#      restart the service when Node calls process.exit(0).
#
#   2. Session-0 GUI isolation: Services run in Session-0 where GUI windows
#      are invisible to the user. Fix: use WTSQueryUserToken + CreateProcessAsUser
#      to launch the installer in the interactive user's desktop session.
#
# Flow:
#   0. Prevent NSSM from auto-restarting on clean Node exit.
#   1. Wait for the Node server process to exit (~2 s).
#   2. Stop the Windows service so Inno can overwrite locked files.
#   3. Kill any stray laundry-app.exe handles.
#   4a. Interactive session (dev mode): launch GUI directly.
#   4b. Session-0 (service): WTSQueryUserToken + CreateProcessAsUser → GUI in user session.
#   4c. Fallback: silent install if API fails.
#   5. If silent install ran: safety-net service start + restore NSSM restart setting.
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
$SelfTaskName = 'LaundryPlusInstaller'

function Write-Log {
  param([string]$Level, [string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')] [$Level] $Message"
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch {}
  Write-Host $line
}

function Test-ServiceExists {
  return [bool](Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)
}

# Remove the one-time scheduled task that launched us (best-effort, no-op when
# run directly from a dev/interactive session).
function Remove-SelfTask {
  try { Unregister-ScheduledTask -TaskName $SelfTaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}
}

Write-Log 'INFO' "run-installer started: SetupPath=$SetupPath AppRoot=$AppRoot ServerPid=$ServerPid"

if (-not (Test-Path $SetupPath)) {
  Write-Log 'ERROR' "Installer not found: $SetupPath"
  exit 1
}

# ── 0. Prevent NSSM from restarting the service on clean exit ─────────────────
# CRITICAL: Without this, NSSM restarts Node within seconds of process.exit(0),
# causing file-lock conflicts that prevent the installer from replacing files.
if ((Test-Path $NssmPath) -and (Test-ServiceExists)) {
  Write-Log 'INFO' "Disabling NSSM auto-restart for exit code 0 (AppExit 0 Exit)..."
  & $NssmPath set $ServiceName AppExit 0 Exit 2>$null | Out-Null
  Write-Log 'INFO' "NSSM AppExit set to Exit for code 0"
}

# ── 1. Wait for Node server to exit ──────────────────────────────────────────
if ($ServerPid -gt 0) {
  Write-Log 'INFO' "Waiting for Node server PID $ServerPid to exit..."
  $elapsed = 0
  while ($elapsed -lt 30) {
    if (-not (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
  }
  if (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue) {
    Write-Log 'WARN' "PID $ServerPid still alive after $elapsed s — forcing kill"
    try { Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue } catch {}
    Start-Sleep -Seconds 2
  } else {
    Write-Log 'INFO' "Node server exited after ${elapsed}s"
  }
}

# Small extra wait to ensure NSSM does not race-restart the service
Start-Sleep -Seconds 3

# ── 2. Stop the Windows service ───────────────────────────────────────────────
if (Test-ServiceExists) {
  Write-Log 'INFO' "Stopping service $ServiceName..."
  if (Test-Path $NssmPath) { & $NssmPath stop $ServiceName confirm 2>$null | Out-Null }
  & sc.exe stop $ServiceName 2>$null | Out-Null
  Start-Sleep -Seconds 5

  # Verify the service actually stopped
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -ne 'Stopped') {
    Write-Log 'WARN' "Service still running ($($svc.Status)) — forcing stop"
    & sc.exe stop $ServiceName 2>$null | Out-Null
    Start-Sleep -Seconds 5
  }
  Write-Log 'INFO' "Service stopped"
}

# ── 3. Kill any remaining laundry-app processes ───────────────────────────────
Get-Process -Name 'laundry-app' -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Log 'INFO' "Killing stray laundry-app PID $($_.Id)"
  try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
}
Start-Sleep -Seconds 2

# ── 4. Launch installer ───────────────────────────────────────────────────────
$currentSessionId = try { (Get-Process -Id $PID).SessionId } catch { -1 }
Write-Log 'INFO' "PowerShell session ID: $currentSessionId"

# ── 4a. Interactive session (dev/direct run): launch GUI directly ─────────────
if ($currentSessionId -ne 0) {
  Write-Log 'INFO' "Interactive session — launching installer GUI directly"
  try {
    Start-Process -FilePath $SetupPath -Wait -ErrorAction Stop
    Write-Log 'INFO' "Installer GUI completed"
    Write-Log 'INFO' "run-installer: done (direct GUI). Inno Setup restarted the service."
    Remove-SelfTask
    exit 0
  } catch {
    Write-Log 'WARN' "Direct launch failed: $_ — trying API approach"
  }
}

# ── 4b. Session-0: WTSQueryUserToken + CreateProcessAsUser ───────────────────
# This is the official Windows API method for launching a GUI app from a
# Windows Service into the interactive user's desktop session.
Write-Log 'INFO' "Session-0 — attempting WTSQueryUserToken + CreateProcessAsUser..."
$guiLaunched = $false

try {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class UserSessionLauncher {
  [DllImport("kernel32.dll")]
  public static extern uint WTSGetActiveConsoleSessionId();

  [DllImport("wtsapi32.dll", SetLastError=true)]
  public static extern bool WTSQueryUserToken(uint sessionId, out IntPtr phToken);

  [DllImport("advapi32.dll", SetLastError=true)]
  public static extern bool DuplicateTokenEx(
    IntPtr hExistingToken, uint dwDesiredAccess,
    IntPtr lpTokenAttributes, int ImpersonationLevel,
    int TokenType, out IntPtr phNewToken);

  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern bool CreateProcessAsUser(
    IntPtr hToken, string lpApplicationName, string lpCommandLine,
    IntPtr lpProcessAttributes, IntPtr lpThreadAttributes,
    bool bInheritHandles, uint dwCreationFlags, IntPtr lpEnvironment,
    string lpCurrentDirectory, ref STARTUPINFO lpStartupInfo,
    out PROCESS_INFORMATION lpProcessInformation);

  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool CloseHandle(IntPtr hObject);

  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)]
  public struct STARTUPINFO {
    public int cb;
    [MarshalAs(UnmanagedType.LPTStr)] public string lpReserved;
    [MarshalAs(UnmanagedType.LPTStr)] public string lpDesktop;
    [MarshalAs(UnmanagedType.LPTStr)] public string lpTitle;
    public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute;
    public int dwFlags;
    public short wShowWindow, cbReserved2;
    public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct PROCESS_INFORMATION {
    public IntPtr hProcess, hThread;
    public int dwProcessId, dwThreadId;
  }
  public const uint MAXIMUM_ALLOWED = 0x02000000;
  public const uint CREATE_NEW_CONSOLE = 0x00000010;
  public const int STARTF_USESHOWWINDOW = 0x00000001;
  public const short SW_SHOWNORMAL = 1;
}
'@ -ErrorAction Stop

  $sid = [UserSessionLauncher]::WTSGetActiveConsoleSessionId()
  Write-Log 'INFO' "Active console session: $sid"

  $userToken = [IntPtr]::Zero
  if (-not [UserSessionLauncher]::WTSQueryUserToken($sid, [ref]$userToken)) {
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "WTSQueryUserToken failed (error $err) — no interactive user logged in?"
  }

  $dupToken = [IntPtr]::Zero
  if (-not [UserSessionLauncher]::DuplicateTokenEx(
        $userToken, [UserSessionLauncher]::MAXIMUM_ALLOWED,
        [IntPtr]::Zero, 2, 1, [ref]$dupToken)) {
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [UserSessionLauncher]::CloseHandle($userToken) | Out-Null
    throw "DuplicateTokenEx failed (error $err)"
  }
  [UserSessionLauncher]::CloseHandle($userToken) | Out-Null

  $si = New-Object UserSessionLauncher+STARTUPINFO
  $si.cb       = [Runtime.InteropServices.Marshal]::SizeOf($si)
  $si.lpDesktop = "winsta0\default"
  $si.dwFlags  = [UserSessionLauncher]::STARTF_USESHOWWINDOW
  $si.wShowWindow = [UserSessionLauncher]::SW_SHOWNORMAL
  $pi = New-Object UserSessionLauncher+PROCESS_INFORMATION

  $cmdLine = "`"$SetupPath`""
  if (-not [UserSessionLauncher]::CreateProcessAsUser(
        $dupToken, $null, $cmdLine,
        [IntPtr]::Zero, [IntPtr]::Zero, $false,
        [UserSessionLauncher]::CREATE_NEW_CONSOLE,
        [IntPtr]::Zero, $null, [ref]$si, [ref]$pi)) {
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [UserSessionLauncher]::CloseHandle($dupToken) | Out-Null
    throw "CreateProcessAsUser failed (error $err)"
  }

  [UserSessionLauncher]::CloseHandle($dupToken) | Out-Null
  [UserSessionLauncher]::CloseHandle($pi.hProcess) | Out-Null
  [UserSessionLauncher]::CloseHandle($pi.hThread) | Out-Null

  Write-Log 'INFO' "Installer GUI launched in session $sid PID=$($pi.dwProcessId)"
  Write-Log 'INFO' "run-installer: done (GUI via CreateProcessAsUser). Inno Setup will restart the service."
  $guiLaunched = $true

} catch {
  Write-Log 'WARN' "CreateProcessAsUser failed: $_ — falling back to silent install"
}

if ($guiLaunched) { Remove-SelfTask; exit 0 }

# ── 4c. Fallback: silent install ──────────────────────────────────────────────
Write-Log 'INFO' "Running installer silently (fallback): $SetupPath"
$exitCode = -1
try {
  $proc = Start-Process -FilePath $SetupPath `
    -ArgumentList '/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART' `
    -Wait -PassThru -ErrorAction Stop
  $exitCode = $proc.ExitCode
  Write-Log 'INFO' "Silent installer exited with code: $exitCode"
} catch {
  Write-Log 'ERROR' "Failed to launch installer: $_"
  # Restore NSSM restart before exiting on error
  if ((Test-Path $NssmPath) -and (Test-ServiceExists)) {
    & $NssmPath set $ServiceName AppExit 0 Restart 2>$null | Out-Null
    & $NssmPath start $ServiceName 2>$null | Out-Null
  }
  Remove-SelfTask
  exit 1
}

if ($exitCode -ne 0) {
  Write-Log 'ERROR' "Silent install failed (exit $exitCode)"
  # Restore NSSM and restart so app is usable on old version
  if (Test-Path $NssmPath) { & $NssmPath set $ServiceName AppExit 0 Restart 2>$null | Out-Null }
  if (Test-ServiceExists) {
    if (Test-Path $NssmPath) { & $NssmPath start $ServiceName 2>$null | Out-Null }
    & sc.exe start $ServiceName 2>$null | Out-Null
  }
  Remove-SelfTask
  exit 1
}

# ── 5. Post-silent-install: restore NSSM + safety-net service start ───────────
Start-Sleep -Seconds 2
if (Test-Path $NssmPath) {
  Write-Log 'INFO' "Restoring NSSM AppExit 0 to Restart..."
  & $NssmPath set $ServiceName AppExit 0 Restart 2>$null | Out-Null
}
if (Test-ServiceExists) {
  Write-Log 'INFO' "Starting service $ServiceName (safety net after silent install)..."
  if (Test-Path $NssmPath) { & $NssmPath start $ServiceName 2>$null | Out-Null }
  & sc.exe start $ServiceName 2>$null | Out-Null
}

Write-Log 'INFO' 'run-installer: done (silent fallback path)'
Remove-SelfTask
exit 0
