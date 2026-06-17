# Quickstart: Validate Fix — Installer Launch from Settings Screen

## Prerequisites

- App running locally (dev mode, `node server/server.js`) at `http://localhost:3000`
- Logged in as admin
- A test installer EXE available (can be a dummy EXE that just shows a message box, or the real setup file)

## Validation Scenario 1: Helper Script Missing → Error Feedback

**Goal**: Confirm that a missing `run-installer.ps1` produces a visible error rather than silent failure.

1. Temporarily rename `scripts/run-installer.ps1` → `scripts/run-installer.ps1.bak`
2. Manually trigger install: `POST /api/invoke` with `{ method: "installUpdate" }`
   - Or navigate to Settings → trigger install after forcing download state
3. **Expected**: Response is `{ success: false, message: "... helper script not found ..." }`
4. Settings screen shows an error toast/message
5. Restore the renamed file

---

## Validation Scenario 2: Successful Install → Redirect to Installing Page

**Goal**: Confirm the browser navigates to `/installing` after a successful `installUpdate` call.

1. Set up test state: patch `updateProgress.downloadDone = true` and `updateProgress.downloadedFilePath` to any existing file path
2. Trigger `installUpdate` from settings screen
3. **Expected**:
   - Response: `{ success: true, message: "..." }`
   - Browser redirects to `http://localhost:3000/installing`
   - The installing page shows Arabic message "جارٍ التثبيت، يرجى الانتظار..."
   - Page polls for server availability every 3 seconds

---

## Validation Scenario 3: Installing Page Auto-Redirect After Server Restart

**Goal**: Confirm that after the server restarts, the installing page automatically redirects to login.

1. Navigate directly to `http://localhost:3000/installing`
2. Stop the server (Ctrl+C or kill process)
3. Wait ~5 s, then restart the server
4. **Expected**: The installing page detects the server is back and redirects to `http://localhost:3000/` (login screen) within ~6 seconds of server restart

---

## Validation Scenario 4: Stale Comment Fixed

**Goal**: Confirm `spawnInstaller()` comment accurately describes current behavior.

1. Read `server/services/updateService.js` lines ~534–550
2. **Expected**: Comment describes silent install approach (not scheduled task approach)

---

## Full End-to-End (Production / Service Mode)

Requires a real build deployed as service + a real newer version on GitHub:

1. Install v1.0.17 via Inno Setup
2. Publish v1.0.18 on GitHub releases
3. Open browser → Settings → Check Update → Download
4. Click Install
5. **Expected**:
   - Browser navigates to `/installing` page
   - App service stops, installer runs silently in background (~30–60 s)
   - Service restarts on v1.0.18
   - Installing page detects server is back → redirects to login
   - Login shows v1.0.18 in footer/settings
