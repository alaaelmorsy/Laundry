# Feature Specification: Fix Installer Launch from Settings Screen

**Feature Branch**: `016-fix-installer-launch`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "When downloading an update from the settings screen, why doesn't the installer open and install the new version? It stops at showing the installation file and doesn't appear."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trigger Update from Settings (Priority: P1)

The operator opens the Settings screen, sees that a new version is available, clicks "Install Update", and the update installer window appears on screen and runs to completion — replacing the old version with the new one automatically.

**Why this priority**: This is the core failure being reported. The download completes successfully but the installer GUI never appears, leaving the user stuck with no feedback and no update applied.

**Independent Test**: Can be tested by triggering an update from the Settings screen and verifying that the installer window becomes visible on screen and the version number increments after completion.

**Acceptance Scenarios**:

1. **Given** a newer version is available and the EXE has been downloaded, **When** the user clicks "Install Update" in Settings, **Then** the installer window opens visibly on screen and the user can see installation progress.
2. **Given** the installer is running, **When** installation completes, **Then** the application restarts at the new version and the user is returned to the login screen.
3. **Given** the application is running as a Windows Service, **When** the installer is launched, **Then** it still appears visually on the active desktop session (not silently or invisibly in a service session).

---

### User Story 2 - Installer Fails to Launch Gracefully (Priority: P2)

If the installer cannot be launched (permissions error, file missing, UAC denied), the user sees a clear error message in the Settings screen instead of silent failure.

**Why this priority**: Currently there is no user feedback when the launch silently fails, making it impossible to diagnose the problem without reading logs.

**Independent Test**: Can be tested by simulating a failed installer launch (e.g., deleting the EXE after download) and confirming an error toast or message appears.

**Acceptance Scenarios**:

1. **Given** the downloaded installer file is missing or inaccessible, **When** the install is triggered, **Then** the Settings screen shows an error message describing the failure.
2. **Given** UAC elevation is denied by the user, **When** the install is triggered, **Then** the Settings screen shows a message asking the user to run the update manually or grant admin rights.

---

### Edge Cases

- What happens when the installer is launched from a Windows Service context (Session 0) where no GUI is available?
- What if the downloaded file is corrupt or incomplete?
- What if a previous installer process is still running?
- What happens if the application process is killed before the installer finishes?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST launch the installer EXE in a way that makes its window visible on the active desktop user session.
- **FR-002**: System MUST NOT launch the installer with a silent/no-GUI flag (e.g., `/S`, `/silent`) when triggered from the Settings screen, unless the user explicitly opts for silent mode.
- **FR-003**: System MUST escalate privileges (UAC prompt) if the installer requires administrator rights, and this prompt MUST be visible to the user.
- **FR-004**: System MUST send a visible status update to the Settings screen while the installer is being launched (e.g., "Launching installer…").
- **FR-005**: System MUST report an error back to the Settings screen if the installer process fails to start, exits immediately with a non-zero code, or the file is not found.
- **FR-006**: System MUST handle the case where the app is running under a Windows Service (Session 0) by using a mechanism that creates the installer process in the interactive user's desktop session.
- **FR-007**: After the installer is launched, the running Node.js server process MUST gracefully exit so the installer can replace the application files without file-lock conflicts.

### Key Entities

- **Installer EXE**: The downloaded setup file at `data/Laundry-PLUS-Setup-vX.X.X.exe`; must be launched as an interactive GUI process.
- **Update Status**: The state reported back to the Settings screen (downloading / launching / error / success).
- **Desktop Session**: The Windows interactive user session (Session 1+) in which the installer window must appear.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The installer window is visible on screen within 5 seconds of the user clicking "Install Update" on 100% of test runs on a standard Windows 10/11 machine.
- **SC-002**: Zero cases where `installUpdate` is logged as called but no installer window appears, when tested on the same machine the server runs on.
- **SC-003**: If the installer cannot launch, the Settings screen displays an error message within 3 seconds with no silent failure.
- **SC-004**: After successful installation, the app version shown in Settings reflects the new version on next startup, confirming the update completed.

## Assumptions

- The application server and the end user are on the same Windows machine (single-tenant, on-premise deployment per constitution).
- The downloaded installer EXE is a standard NSIS/InnoSetup installer that shows a GUI by default when launched without silent flags.
- The root cause is that the installer is being launched either with a silent flag, from a non-interactive session (Windows Service Session 0), or that `spawn`/`exec` is not using the correct options to make the window visible.
- The fix targets the `installUpdate` function in the updater module (likely `server/updater.js` or similar).
- UAC elevation behavior follows standard Windows conventions; the fix must not bypass UAC.
- Mobile support and remote installation are out of scope.
