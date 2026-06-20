# Feature Specification: Fix Update Completion Bugs

**Feature Branch**: `017-fix-update-completion-bugs`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "اريد منك تصحيح كل هذه الاخطاء والتأكد ان كلها تمام وليس بها اى اخطاء نهائى او حتي احتمال للخطأ"

## Background & Problem Summary

The auto-update system in `server/services/updateService.js` and its PowerShell helper scripts (`scripts/launch-installer.ps1`, `scripts/run-installer.ps1`) contain four confirmed bugs that prevent the update from completing reliably after the Node.js server shuts down. The bugs were identified through static code analysis and tracing the full update flow:

| # | File | Bug | Severity |
|---|------|-----|----------|
| B1 | `updateService.js:407` | `spawnUpdater()` uses `detached: true` but the child process is still inside NSSM's Windows Job Object and gets killed when Node exits | CRITICAL |
| B2 | `run-installer.ps1:127–134` | Path 4a exits after GUI install completes without restoring NSSM AppExit or starting the service | HIGH |
| B3 | `run-installer.ps1:238–246` | Path 4b exits immediately after launching the GUI (fire-and-forget) with no mechanism to start the service afterward | HIGH |
| B4 | `launch-installer.ps1:75` | `-ServerPid` is never included in `$psArgs`, so `run-installer.ps1` always receives `$ServerPid = 0` and skips the Node-exit wait step | MEDIUM |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Legacy Exe-Swap Update Completes Successfully (Priority: P1)

The operator clicks "تثبيت الآن" in Settings. The old server shuts down, the update script (`updater.ps1`) runs to completion, replaces the executable, and the service restarts with the new version — all without manual intervention.

**Why this priority**: This is a complete silent failure today: `updater.ps1` is spawned as a detached child process, but Windows adds it to NSSM's Job Object anyway. The moment Node exits, the OS kills `updater.ps1` before it replaces a single file. The update never runs at all.

**Independent Test**: Trigger the update flow (with `isInstaller = false` in the status file), wait 90 seconds, then check:
1. `data/update-log.txt` contains "Updater started" and "Update complete"
2. The running version number in Settings reflects the new version

**Acceptance Scenarios**:

1. **Given** a bare-exe update is available and downloaded, **When** the user clicks "تثبيت الآن", **Then** `updater.ps1` runs to completion after Node exits and the new version starts within 90 seconds.
2. **Given** the Node server exits with code 0 (clean exit), **When** NSSM checks the exit code, **Then** NSSM does NOT restart the service (AppExit 0 = Exit is respected), giving the updater time to replace the exe without file-lock conflicts.
3. **Given** `updater.ps1` finishes successfully, **When** it starts the service, **Then** the browser's "Installing…" polling page detects the server coming back and auto-redirects to login.

---

### User Story 2 — Installer GUI Completes and Service Restarts (Path 4a) (Priority: P2)

The operator uses the Inno Setup GUI installer on a machine where the update script runs in an interactive (non-Session-0) desktop. After the wizard completes, the Windows service restarts automatically — the operator does not need to manually start anything.

**Why this priority**: Path 4a already launches the GUI correctly and waits for it to finish (`-Wait`). The missing step is: after `Start-Process -Wait` returns, nobody restores NSSM's restart policy or starts the service. If Inno Setup's own `[Run]` section happens to start the service, it works by accident. If not, the app stays dead indefinitely.

**Independent Test**: Run `run-installer.ps1` directly in an interactive PowerShell session. After the wizard closes, verify:
1. `Get-Service LaundryPlusApp` shows Status = Running
2. NSSM AppExit 0 is restored to `Restart`
3. `data/update-log.txt` ends with "Service started — post-GUI restart"

**Acceptance Scenarios**:

1. **Given** `run-installer.ps1` runs in an interactive session and the Inno Setup wizard completes successfully, **When** `Start-Process -Wait` returns, **Then** the script restores `NSSM AppExit 0 Restart` and starts the service before exiting.
2. **Given** the service is started by the script after GUI install, **When** the browser is on the "Installing…" page, **Then** the poll detects the server within 30 seconds and redirects to login.
3. **Given** `Start-Process` throws an exception (e.g., user cancelled the wizard), **When** the catch block runs, **Then** NSSM AppExit is still restored to `Restart` so the app is usable without manual intervention.

---

### User Story 3 — Installer GUI Completes and Service Restarts (Path 4b — Session-0) (Priority: P2)

On a production machine where the service runs in Session-0, `CreateProcessAsUser` launches the Inno Setup GUI in the interactive user's desktop. After the installer finishes, the service restarts without the operator needing to intervene.

**Why this priority**: Path 4b exits immediately after calling `CreateProcessAsUser` (fire-and-forget). There is no `-Wait`, no post-install service restart, and NSSM's AppExit is left as `Exit`. If Inno Setup doesn't start the service itself, the app is permanently down and requires manual `sc.exe start`.

**Independent Test**: Run the full update flow from a production service install. After the wizard closes, verify:
1. `Get-Service LaundryPlusApp` shows Status = Running within 60 seconds of the wizard closing
2. The version in Settings reflects the new version

**Acceptance Scenarios**:

1. **Given** `run-installer.ps1` runs as SYSTEM in Session-0 and `CreateProcessAsUser` succeeds, **When** the installer GUI completes in the user's session, **Then** the service starts within 60 seconds — either via a watchdog mechanism or via Inno Setup's `[Run]` section, with NSSM AppExit restored to `Restart` as a safety net.
2. **Given** NSSM AppExit is left as `Restart` after path 4b, **When** Inno Setup's wizard finishes and its installer exits, **Then** NSSM restarts the service automatically.
3. **Given** `WTSQueryUserToken` or `CreateProcessAsUser` fails, **When** path 4b throws, **Then** the script falls through to the silent fallback (path 4c) and completes the install without user interaction.

---

### User Story 4 — Node Server Exit is Confirmed Before File Operations (Priority: P3)

`run-installer.ps1` waits for the exact Node.js server process (by PID) to exit before stopping the service and running the installer. This prevents a race condition where the installer starts while Node still holds file locks.

**Why this priority**: `launch-installer.ps1` receives `$ServerPid` from Node but does not forward it to `run-installer.ps1` via `$psArgs`. As a result `$ServerPid = 0` inside `run-installer.ps1` and the wait loop (Step 1) is always skipped. The 3-second unconditional wait is a rough substitute that works in practice (Node exits in ~2 s and the task fires at ~6 s), but it is not a guarantee.

**Independent Test**: Add a `Write-Log` at the start of the Step-1 wait block. Trigger an update and inspect `update-log.txt`. The log must show "Waiting for Node server PID XXXX to exit" with a real PID, not "ServerPid is 0 — skipping wait".

**Acceptance Scenarios**:

1. **Given** `$ServerPid` is correctly passed to `run-installer.ps1`, **When** Step 1 executes, **Then** the log records "Waiting for Node server PID [actual PID] to exit" before proceeding.
2. **Given** Node has already exited when Step 1 runs, **When** the PID check runs, **Then** the script continues immediately without sleeping unnecessarily.
3. **Given** Node is somehow still alive past the 6-second window, **When** the PID is still in the process list, **Then** the script waits up to 30 seconds and force-kills if necessary before proceeding.

---

### Edge Cases

- What happens if the operator closes the Inno Setup wizard before installation completes (cancelled mid-wizard)?
- What if NSSM is not installed (dev mode / no-service deployment)?
- What if the service stop in Step 2 times out twice and the service is still running when the installer fires?
- What if the machine has no interactive user logged in when the scheduled task fires (path 4b receives no console session)?
- What if `updater.ps1` replaces the exe but the new version immediately crashes — does NSSM restart it into a crash loop?
- What if the operator triggers a second install attempt while the first scheduled task has already fired?

---

## Requirements *(mandatory)*

### Functional Requirements

**Bug B1 — Legacy `spawnUpdater` killed by Job Object:**

- **FR-001**: `spawnUpdater()` MUST register `updater.ps1` as a Windows Scheduled Task (using the same `launch-installer.ps1` + task scheduler pattern as the installer path) instead of using `spawn(..., { detached: true })`, so the updater process is owned by Task Scheduler and not by NSSM's Job Object.
- **FR-002**: Before registering the task and exiting, Node MUST set NSSM `AppExit 0 Exit` (already done in `launch-installer.ps1` for the installer path; the same must apply for the legacy path).
- **FR-003**: `updater.ps1` MUST be copied from `ROOT/scripts/` to `DATA_DIR` before registration (same copy step as `launch-installer.ps1` does for `run-installer.ps1`), because PowerShell cannot execute scripts inside a `pkg` snapshot.

**Bug B2 — Path 4a exits without service restart:**

- **FR-004**: In `run-installer.ps1` path 4a, AFTER `Start-Process -FilePath $SetupPath -Wait` returns (whether success or exception-caught), the script MUST restore `NSSM AppExit 0 Restart` and start the service using the same NSSM + `sc.exe start` pattern used in path 4c.
- **FR-005**: If `Start-Process` throws (user cancelled, UAC denied, etc.), the script MUST still restore NSSM and start the service so the existing version remains accessible.

**Bug B3 — Path 4b fire-and-forget with no service restart:**

- **FR-006**: After a successful `CreateProcessAsUser` call in path 4b, `run-installer.ps1` MUST restore `NSSM AppExit 0 Restart` before exiting. This turns NSSM into a safety-net restarter: once the Inno Setup installer finishes and the Node process it may start exits (or if Inno Setup starts the service directly), NSSM's Restart policy ensures the service comes back.
- **FR-007**: The log MUST record "NSSM AppExit restored to Restart (path 4b safety net)" so operators can diagnose why the service restarted.

**Bug B4 — `-ServerPid` not passed to scheduled task:**

- **FR-008**: In `launch-installer.ps1`, the `$psArgs` string MUST include `-ServerPid "$ServerPid"` so `run-installer.ps1` receives the actual Node process PID.
- **FR-009**: `run-installer.ps1` Step 1 MUST log "ServerPid is 0 — skipping PID wait" when `$ServerPid` is 0 (for visibility), rather than silently skipping the block.

### Key Entities

- **Scheduled Task (`LaundryPlusInstaller`)**: One-time task registered by `launch-installer.ps1`, fires ~6 seconds after registration, runs `run-installer.ps1` outside NSSM's Job Object.
- **NSSM AppExit policy**: Controls whether NSSM restarts the service after Node exits with code 0. Must be `Exit` during install to prevent file-lock races, then restored to `Restart` after install.
- **`updater.ps1`**: The legacy exe-swap update script. Must run outside the Job Object to survive Node's exit.
- **`run-installer.ps1`**: The installer launcher script. Must restore NSSM and start the service after GUI install (paths 4a and 4b).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On 100% of test runs, `updater.ps1` (legacy path) completes and the new version is running within 90 seconds of the user clicking "تثبيت الآن", with zero manual intervention.
- **SC-002**: On 100% of test runs on interactive sessions (path 4a), the Windows service is running with the new version within 30 seconds of the Inno Setup wizard closing.
- **SC-003**: On 100% of test runs on Session-0 service deployments (path 4b), the Windows service is running with the new version within 60 seconds of the Inno Setup wizard closing.
- **SC-004**: The `update-log.txt` file records "Waiting for Node server PID [real PID] to exit" on every update run — zero occurrences of the PID being 0 when a real Node process triggered the update.
- **SC-005**: Zero cases where the app requires manual `sc.exe start` or NSSM configuration changes after a successful update attempt.
- **SC-006**: The browser's "Installing…" polling page auto-redirects to login within 6 seconds of the service becoming available after every update path (legacy, GUI path 4a, GUI path 4b, silent path 4c).

---

## Assumptions

- The application is deployed as an NSSM Windows Service named `LaundryPlusApp` with `nssm.exe` present in `DATA_ROOT`.
- The Inno Setup installer (when used) is a standard Inno Setup wizard that may or may not include service-start commands in its own `[Run]` section — the fix must not depend on Inno Setup's `[Run]` section for service restart.
- Dev mode (`isPkg = false`, no NSSM service) does not need the Task Scheduler pattern; direct `spawn` / `Start-Process` is acceptable and already works in dev mode.
- `launch-installer.ps1` already handles the NSSM `AppExit 0 Exit` setup and Task Scheduler registration for the installer path; Bug B1 fix extends the same pattern to the legacy path by re-using `launch-installer.ps1` or creating a parallel `launch-updater.ps1`.
- No changes to the database, frontend screens, or API contracts are required — this is purely a backend/PowerShell fix.
- The `installing.js` polling page and `settings.js` navigation are correct as-is and need no changes.
