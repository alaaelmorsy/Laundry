# Research: Fix Installer Launch from Settings Screen

## Findings

### Finding 1: Root Cause — Silent Flag Suppresses All GUI

**Decision**: The installer IS being launched, but with `/SILENT /SUPPRESSMSGBOXES` flags which suppress the Inno Setup wizard window entirely.

**Evidence in `scripts/run-installer.ps1` (line 92-94)**:
```powershell
$proc = Start-Process -FilePath $SetupPath `
  -ArgumentList '/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART' `
  -Wait -PassThru -ErrorAction Stop
```

This is intentional and is explained in the file header comment: running from Session-0 (Windows Service) cannot show GUI on the user's desktop. The `/SILENT` flag bypasses the wizard.

**Rationale**: Running as `LaundryPlusApp` Windows Service means the process lives in Session 0 (isolated desktop). Any GUI launched from Session 0 is invisible to logged-in users.

---

### Finding 2: Stale Comment in updateService.js

The `spawnInstaller()` function in `server/services/updateService.js` (line 534–540) has this outdated comment:

> "run-installer.ps1 works around this by registering a one-time scheduled task that runs Setup.exe as the interactive user with Highest privileges (so the wizard appears on their desktop and no UAC prompt is shown)"

**Reality**: The actual `run-installer.ps1` does NOT use a scheduled task — it runs `/SILENT` directly from Session 0. The comment describes an older approach that was discarded in favour of silent install.

---

### Finding 3: Path Resolution for run-installer.ps1

`spawnInstaller()` resolves the helper at:
```js
const helper = path.join(DATA_ROOT, 'scripts', 'run-installer.ps1');
```

- **Dev mode** (`isPkg = false`): `DATA_ROOT` = project root → `D:\PLUS\Laundry\scripts\run-installer.ps1` ✅ (file exists)
- **Production pkg mode** (`isPkg = true`): `DATA_ROOT` = exe directory → `C:\Program Files\PLUS\Laundry\scripts\run-installer.ps1`

The Inno Setup installer must copy `run-installer.ps1` into `{app}\scripts\` for production mode. This should already be configured if `updater.ps1` already ships there.

---

### Finding 4: No Error Feedback on Missing Helper Script

`spawnInstaller()` does not check whether `helper` exists before calling `spawn()`. If the PS1 file is missing at `DATA_ROOT/scripts/`, the spawn silently fails with no log entry and no user feedback.

---

### Finding 5: Silent Install Already Works — User Expectation Mismatch

The user expects to see the Inno Setup wizard (like a normal install). The current system intentionally hides the wizard. After `installUpdate()` is called:
1. The JS server exits after 2 s
2. The browser tab loses connection
3. The PS1 runs silently in the background (takes ~30–60 s)
4. The service restarts with the new version

The user sees: server dies → browser shows "connection refused" → no feedback that install succeeded.

---

### Finding 6: Scheduled Task Approach to Show GUI (Rejected Path)

Using `schtasks.exe` to register a task running as the logged-in user WOULD allow showing the Inno Setup wizard:
```powershell
$taskXml = @"<Task ...><Triggers>...</Triggers><Actions><Exec><Command>$SetupPath</Command></Exec></Actions></Task>"@
Register-ScheduledTask -TaskName "LaundryUpdate" -Xml $taskXml -Force
Start-ScheduledTask -TaskName "LaundryUpdate"
```

**Why rejected for this fix**: Requires knowing the logged-in user's account name, setting up the right session, and handling UAC. This is complex and fragile (see `run-installer.ps1` header comment). Silent install is more reliable.

---

## Decisions

### Decision 1: Keep Silent Install, Fix User Feedback

- **What**: Keep the `/SILENT` installer approach (reliable), but fix the UX so the user knows installation is happening and succeeds.
- **Why**: Silent install is correct for Session-0 service environments. The real problem is zero feedback after the app closes.
- **Alternative rejected**: Scheduled-task GUI installer — too fragile, UAC complications, requires querying interactive session.

### Decision 2: Add "Installing..." Redirect Page

- **What**: After `installUpdate()` is called, redirect the browser to a static waiting page (`/installing.html`) that polls for server recovery, then redirects to login when the server is back.
- **Why**: The server exits, so the browser loses its connection. A pre-loaded redirect page can survive the server restart and auto-reconnect.
- **How**: The settings screen JS navigates to `/installing.html` immediately after receiving `{ success: true }` from `installUpdate`. This page is served as a static file and does not need the Node server once loaded.

### Decision 3: Add Helper Script Existence Check + Error Feedback

- **What**: Before spawning, check that `run-installer.ps1` exists. If missing, return an error to the settings screen instead of silently failing.
- **Why**: Currently any path error is completely invisible to the user.

### Decision 4: Fix Stale Comment in updateService.js

- **What**: Update the `spawnInstaller()` comment to accurately describe the current silent-install approach.
- **Why**: Misleading comments cause future bugs and confusion.
