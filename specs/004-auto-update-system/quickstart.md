# Quickstart & Validation Guide: Automatic Update System

## Prerequisites

- App running at `http://localhost:3000`
- Access to the GitHub repository to publish a test release
- `package.json` has `"github": { "owner": "...", "repo": "..." }` set
- Enough disk space (> 500 MB free)

---

## Scenario 1: Update Available — Happy Path

**Setup**: Publish a GitHub Release tagged `v{HIGHER_VERSION}` with:
- A `laundry-v{VERSION}.zip` asset containing updated source files
- A `sha256sums.txt` asset with the correct SHA256 of the ZIP

**Validation steps**:

1. Open the app — login screen should show an update notification badge within 5 seconds.
2. Log in as admin, navigate to **الإعدادات** (Settings).
3. Locate the "التحديثات" (Updates) tab/section — verify current version is displayed.
4. Press **"فحص التحديثات"** — expect spinner then a card showing new version + release notes + "تحديث الآن" button.
5. Press **"تحديث الآن"** — a progress panel should appear showing steps: نسخة احتياطية → تنزيل → تحقق → استبدال → قاعدة البيانات → إعادة تشغيل.
6. The browser tab loses connection (server exits) → reconnects → lands on login screen.
7. In the login screen, the app title or version indicator shows the new version number.
8. Log in and verify: all customers, invoices, loyalty points, and settings are intact.

**Expected outcome**: App running new version; all data preserved; no error messages.

---

## Scenario 2: Already Up to Date

**Setup**: Ensure the latest GitHub Release version equals the installed version.

**Validation steps**:

1. Navigate to Settings → Updates tab.
2. Press **"فحص التحديثات"**.
3. Expect message: **"أنت تستخدم أحدث إصدار"** with current version number.
4. No "تحديث الآن" button is shown.

---

## Scenario 3: Login Screen Update Notification

**Setup**: Ensure a newer version is published on GitHub (cache is cold or > 60 min old).

**Validation steps**:

1. Open `http://localhost:3000` (login screen).
2. Within 5 seconds a notification badge/banner appears: **"تحديث جديد متاح — الإصدار X.Y.Z"**.
3. Clicking the notification takes the user to the Settings → Updates tab (after login) or directly shows the update modal.
4. If no internet: no notification appears; login form works normally.

---

## Scenario 4: Corrupted Download (Checksum Failure)

**Setup**: Publish a release with a deliberately wrong `sha256sums.txt` (mismatched hash).

**Validation steps**:

1. Trigger update from Settings.
2. After download, checksum verification fails.
3. Expect error message: **"فشل التحقق من سلامة ملف التحديث"**.
4. No files in the app directory are changed.
5. App continues running normally on the current version.

---

## Scenario 5: Rollback After Failure

**Setup**: Create a test scenario where the migration step fails (e.g., temporarily rename `database/db.js` in the ZIP to cause an error).

**Validation steps**:

1. Trigger update — progress panel shows steps advancing.
2. Migration step fails — progress panel shows error.
3. Server auto-restarts on the **old version**.
4. Login screen shows old version number.
5. All data is intact.
6. `data/update-log.txt` contains a `[ERROR]` line and a `[INFO] Rollback complete` line.
7. `backup/pre-{version}/` directory exists with the pre-update snapshot.

---

## Scenario 6: Insufficient Disk Space

**Setup**: Temporarily fill the disk (or mock the disk space check) so less than 500 MB is free.

**Validation steps**:

1. Press **"فحص التحديثات"** — update available shown normally.
2. Press **"تحديث الآن"** — immediately shows error: **"مساحة القرص غير كافية"** with required vs. available space.
3. App remains running; no files changed; no backup created.

---

## Diagnostic Artifacts

After any update attempt, inspect:

- `data/update-log.txt` — full event trace
- `data/update-status.json` — `lastUpdateResult` field
- `backup/pre-{version}/` — pre-update snapshot (present only if backup was created before failure)

---

## API Smoke Tests (via browser console or curl)

```javascript
// Check for update (force fresh API call)
const r1 = await window.api.checkForUpdate({ force: true });
console.log(r1); // expect { success: true, hasUpdate: bool, ... }

// Get cached status (used by login screen)
const r2 = await window.api.getUpdateStatus();
console.log(r2); // expect { success: true, currentVersion: "1.0.12", ... }

// Get progress (during active update)
const r3 = await window.api.getUpdateProgress();
console.log(r3); // expect { success: true, inProgress: bool, ... }
```
