# Tasks: Automatic Application Updates via GitHub Releases

**Input**: Design documents from `specs/004-auto-update-system/`

**Prerequisites**: plan.md âœ… | spec.md âœ… | research.md âœ… | data-model.md âœ… | contracts/api-methods.md âœ… | quickstart.md âœ…

**Tests**: Not requested â€” no test tasks generated.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1 = one-click update, US2 = login notification, US3 = auto-rollback)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the new files and config that all phases depend on.

- [x] T001 Add `"github": { "owner": "alaaelmorsy", "repo": "Laundry" }` to `package.json`
- [x] T002 Create empty `server/services/updateService.js` with module skeleton (`module.exports = {}`)
- [x] T003 Create `migrate.js` at repo root â€” calls `db.initialize()` then `process.exit(0)`
- [x] T004 Create `scripts/updater.ps1` with skeleton (param block + placeholder steps)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core update service and API wiring that US1, US2, US3 all depend on.

**âš ï¸ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Implement `checkForUpdate(force)` in `server/services/updateService.js` â€” calls `https://api.github.com/repos/alaaelmorsy/Laundry/releases/latest`, compares semver with `package.json` version, writes result to `data/update-status.json`, caches 60 min (skips live call when `force=false` and cache is fresh)
- [x] T006 Implement `getUpdateStatus()` in `server/services/updateService.js` â€” reads `data/update-status.json` and returns parsed object (no network call)
- [x] T007 Implement `logEvent(level, message)` helper in `server/services/updateService.js` â€” appends `[ISO_TIMESTAMP] [LEVEL] message\n` to `data/update-log.txt`
- [x] T008 Add 4 invoke handler cases in `server/invokeHandlers.js` â€” `checkForUpdate`, `getUpdateStatus`, `performUpdate`, `getUpdateProgress` â€” each wrapped in try/catch returning `{ success: false, message, code }` on error; `performUpdate` and `getUpdateProgress` bodies left as stubs calling `updateService`
- [x] T009 Register 4 methods in `assets/web-api.js` under `window.api` â€” `checkForUpdate(payload)`, `getUpdateStatus()`, `performUpdate()`, `getUpdateProgress()`
- [x] T010 Add all `settings-update-*` and `login-update-*` i18n keys (Arabic + English) to `assets/i18n.js` per the key list in plan.md Phase E

**Checkpoint**: `window.api.checkForUpdate({ force: true })` callable from browser console; `window.api.getUpdateStatus()` returns cached data.

---

## Phase 3: User Story 1 â€” ØªØ­Ø¯ÙŠØ« Ø¨Ø¶ØºØ·Ø© ÙˆØ§Ø­Ø¯Ø© Ù…Ù† Ø´Ø§Ø´Ø© Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª (Priority: P1) ðŸŽ¯ MVP

**Goal**: Admin can check for updates and perform a full one-click update from the Settings screen with live progress display.

**Independent Test**: Open Settings â†’ Updates tab â†’ press "ÙØ­Øµ Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª" â†’ see version info â†’ press "ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¢Ù†" â†’ progress panel advances â†’ server reconnects on new version â†’ all data intact.

### Implementation

- [x] T011 [US1] Implement disk-space pre-flight check in `server/services/updateService.js` â€” estimate required space (backup size + ZIP size), compare with `fs.statfs` / `diskusage`, return error with `code: "INSUFFICIENT_DISK_SPACE"` if insufficient
- [x] T012 [US1] Implement `createBackup(targetVersion)` in `server/services/updateService.js` â€” creates `backup/pre-{targetVersion}/source/` (copies all source dirs excluding `data/`, `.env`, `ssl/`), runs `mysqldump` (falls back to Node.js pool row-export if `mysqldump` not on PATH), saves DB dump to `backup/pre-{targetVersion}/db-backup.sql`, writes `backup/pre-{targetVersion}/meta.json`
- [x] T013 [US1] Implement `downloadWithProgress(url, destPath, onProgress)` in `server/services/updateService.js` â€” streams ZIP to a temp file in `data/`, calls `onProgress(percent)` on each chunk, handles network errors with cleanup
- [x] T014 [US1] Implement `verifySha256(zipPath, checksumUrl)` in `server/services/updateService.js` â€” downloads `sha256sums.txt`, computes SHA256 of ZIP with `crypto`, compares; throws with `code: "CHECKSUM_MISMATCH"` on failure
- [x] T015 [US1] Implement in-memory progress state in `server/services/updateService.js` â€” `updateProgress` object `{ inProgress, currentStep, percent, steps[] }`, exported as `getProgress()` and updated by each step
- [x] T016 [US1] Implement `performUpdate()` in `server/services/updateService.js` â€” orchestrates: pre-flight â†’ backup â†’ download â†’ verify â†’ update progress state â†’ spawn `updater.ps1` (detached, pass PID + version + zipPath + backupPath as args) â†’ schedule `process.exit(0)` in 1.5s
- [x] T017 [US1] Implement `getUpdateProgress()` in `server/services/updateService.js` â€” returns current in-memory progress state
- [x] T018 [US1] Complete `performUpdate` and `getUpdateProgress` stub cases in `server/invokeHandlers.js` to call the now-implemented service methods
- [x] T019 [US1] Implement `scripts/updater.ps1` â€” full PowerShell script: receive params (serverPid, version, zipPath, backupPath, appRoot), wait for PID exit (poll 500ms, 30s timeout), extract ZIP to `$appRoot` skipping `data/`, `.env`, `ssl/` entries, run `node migrate.js`, on success: delete backup dir + write success to `data/update-status.json` + start `node server/index.js` detached; on any failure: restore source files from backup, import DB backup via `mysql` CLI, start old server, write rollback result to `data/update-status.json`; log all steps to `data/update-log.txt`
- [x] T020 [US1] Add "Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª" tab to `screens/settings/settings.html` â€” new `<button id="tabUpdate">` in tabs bar and `<div id="panelUpdate">` with: current version display, "ÙØ­Øµ Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª" button (`btnCheckUpdate`), result area (`updateResultArea`), progress panel (`updateProgressPanel`) hidden by default with 6-step list and percentage bar
- [x] T021 [US1] Add update tab logic to `screens/settings/settings.js` â€” wire `tabUpdate`/`panelUpdate` into existing tab-switch pattern; on `btnCheckUpdate` click: call `window.api.checkForUpdate({ force: true })`, render "Ø£Ù†Øª ØªØ³ØªØ®Ø¯Ù… Ø£Ø­Ø¯Ø« Ø¥ØµØ¯Ø§Ø±" or update card (version + release notes + "ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¢Ù†" `btnUpdateNow`); on `btnUpdateNow` click: disable button, show progress panel, call `window.api.performUpdate()`, start polling `window.api.getUpdateProgress()` every 1s and update step icons + bar; on fetch failure after update starts: stop polling, show "Ø¬Ø§Ø±Ù Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„ØªØ´ØºÙŠÙ„... ÙŠÙØ±Ø¬Ù‰ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø±" and poll `window.api.getUpdateStatus()` every 3s until reconnected

**Checkpoint**: Full update cycle works end-to-end: Settings â†’ check â†’ download â†’ verify â†’ server exits â†’ PowerShell replaces files â†’ server restarts â†’ all data intact.

---

## Phase 4: User Story 2 â€” Ø¥Ø´Ø¹Ø§Ø± Ø§Ù„ØªØ­Ø¯ÙŠØ« ÙÙŠ Ø´Ø§Ø´Ø© ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ (Priority: P2)

**Goal**: Login screen shows a non-blocking update notification badge within 5 seconds when a newer version is available.

**Independent Test**: Open `http://localhost:3000` with a newer GitHub release available â†’ badge appears within 5s without blocking the login form.

### Implementation

- [x] T022 [US2] Add update notification badge markup to `screens/login/login.html` â€” a `<div id="updateBadge">` positioned above the login card, hidden by default, containing version text and a link-styled button "Ø§Ù†ØªÙ‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø¨Ø¹Ø¯ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„"
- [x] T023 [US2] Add update badge logic to `screens/login/login.js` â€” on `DOMContentLoaded`: call `window.api.getUpdateStatus()` (reads cache, fast), if `hasUpdate: true` populate and show `#updateBadge`; after 2s fire-and-forget `window.api.checkForUpdate({ force: false })` to refresh cache if stale; handle errors silently (badge stays hidden on any failure)

**Checkpoint**: Login screen shows badge when cache has `hasUpdate: true`; no badge and no error when offline or cache empty.

---

## Phase 5: User Story 3 â€” Ø§Ù„ØªØ±Ø§Ø¬Ø¹ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ø¹Ù†Ø¯ ÙØ´Ù„ Ø§Ù„ØªØ­Ø¯ÙŠØ« (Priority: P1)

**Goal**: Any failure during update automatically restores the previous version with zero data loss.

**Independent Test**: Trigger a checksum mismatch or migration failure â†’ server comes back on old version â†’ all data intact â†’ `data/update-log.txt` shows rollback event.

*Note*: Most rollback logic is already embedded in `scripts/updater.ps1` (T019). This phase adds the remaining server-side safeguards and user-facing error reporting.

### Implementation

- [x] T024 [US3] Add pre-spawn failure handling in `server/services/updateService.js` `performUpdate()` â€” if backup, download, or verify throw before spawning updater: log error, clear progress state, return `{ success: false, message, code }` without exiting the server process; ensure no partial files remain in `data/` temp dir
- [x] T025 [US3] Add rollback result display to `screens/settings/settings.js` â€” after reconnection polling succeeds, call `window.api.getUpdateStatus()` and check `lastUpdateResult.status`; if `"rollback"` show error toast "ÙØ´Ù„ Ø§Ù„ØªØ­Ø¯ÙŠØ« â€” ØªÙ… Ø§Ù„ØªØ±Ø§Ø¬Ø¹ Ù„Ù„Ø¥ØµØ¯Ø§Ø± Ø§Ù„Ø³Ø§Ø¨Ù‚"; if `"failed"` show error toast with message; if `"success"` show success toast "ØªÙ… Ø§Ù„ØªØ­Ø¯ÙŠØ« Ø¨Ù†Ø¬Ø§Ø­ Ø¥Ù„Ù‰ Ø§Ù„Ø¥ØµØ¯Ø§Ø± X.Y.Z"
- [x] T026 [US3] Validate that `scripts/updater.ps1` correctly restores DB backup on migration failure â€” dry-run test: rename `migrate.js` temporarily to simulate failure, confirm updater restores source files, imports DB dump via `mysql` CLI, restarts old server; document the tested scenario in `data/update-log.txt` format

**Checkpoint**: Corrupt ZIP â†’ no files changed, server stays up. Migration failure â†’ old files + old DB restored, server restarts on old version. All scenarios log correctly to `data/update-log.txt`.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T027 [P] Add `RELEASE_GUIDE.md` at repo root documenting the release asset naming convention (`laundry-v{VERSION}.zip` + `sha256sums.txt`) and how to generate the SHA256 checksum
- [x] T028 [P] Add GitHub API rate-limit protection in `server/services/updateService.js` â€” include `User-Agent: laundry-app/{version}` header; on 403/429 response: log warning, return cached status without throwing
- [x] T029 [P] Add `"If-None-Match"` ETag caching to GitHub API calls in `server/services/updateService.js` â€” store ETag in `data/update-status.json`, send on subsequent requests; on 304 Not Modified: return cached result
- [x] T030 Add `data/update-log.txt` and `backup/` to `.gitignore` (do not commit client logs or backups)
- [x] T031 Run all 6 quickstart validation scenarios from `specs/004-auto-update-system/quickstart.md` and confirm each passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies â€” start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 â€” blocks all user stories
- **Phase 3 (US1 â€” one-click update)**: Depends on Phase 2
- **Phase 4 (US2 â€” login badge)**: Depends on Phase 2 (T005 `checkForUpdate` + T006 `getUpdateStatus` + T009 `web-api.js` registration)
- **Phase 5 (US3 â€” rollback)**: Depends on Phase 3 (rollback logic is inside `updater.ps1` from T019)
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 complete
- **US2 (P2)**: Can start after Phase 2 complete â€” independent of US1
- **US3 (P1)**: Depends on US1 (T019 updater.ps1 must exist before T024/T025/T026 build on it)

### Within Each Phase

- T005 â†’ T006 â†’ T007 must be in order (service methods build on each other)
- T008 depends on T005-T007 (handlers call service)
- T009 depends on T008 (web-api wraps handlers)
- T011 â†’ T012 â†’ T013 â†’ T014 â†’ T015 â†’ T016 â†’ T017 (service build-up in order)
- T018 depends on T016-T017
- T019 (updater.ps1) depends on T016 (spawn contract)
- T020 (HTML) can parallel with T011-T019
- T021 (JS wiring) depends on T019 and T020
- T024 depends on T016
- T025 depends on T021

### Parallel Opportunities

- T001â€“T004 (Phase 1): all parallel
- T005, T007: parallel (different functions)
- T006: parallel with T007 (independent reads)
- T020 (HTML) can run in parallel with T011â€“T019 (different files)
- T022 (login HTML) can run in parallel with T020 (different files)
- T027, T028, T029 (Phase 6): all parallel

---

## Parallel Example: Phase 2 Foundation

```
Parallel group A: T005 (checkForUpdate) + T007 (logEvent)
Then: T006 (getUpdateStatus, can share helpers from T005/T007)
Then: T008 (invokeHandlers â€” depends on service)
Then: T009 (web-api.js â€” depends on handlers)
Then: T010 (i18n keys â€” fully independent, can be done any time)
```

## Parallel Example: Phase 3 US1

```
Parallel group A (service layer):
  T011 (disk check) â†’ T012 (backup) â†’ T013 (download) â†’ T014 (verify) â†’ T015 (progress) â†’ T016 (orchestrate)

Parallel group B (UI, independent files):
  T020 (settings.html) â€” can start any time in Phase 3

Then sequentially:
  T017 (getUpdateProgress), T018 (handler stubs), T019 (updater.ps1), T021 (settings.js wiring)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001â€“T004)
2. Complete Phase 2: Foundational (T005â€“T010)
3. Complete Phase 3: US1 one-click update (T011â€“T021)
4. **STOP and VALIDATE**: Run quickstart scenarios 1, 4, 5, 6
5. Ship MVP â€” users can update from Settings

### Incremental Delivery

1. Phase 1 + 2 â†’ Foundation ready (API callable)
2. Phase 3 â†’ Full one-click update from Settings â† **MVP**
3. Phase 4 â†’ Login screen notification (US2)
4. Phase 5 â†’ Explicit rollback hardening (US3 polish, core already in updater.ps1)
5. Phase 6 â†’ Polish + release guide

---

## Notes

- [P] tasks = work on different files, no incomplete dependencies
- [USN] label maps task to user story for traceability
- `scripts/updater.ps1` is the most critical single file â€” test it thoroughly against failure scenarios before Phase 5
- `backup/` and `data/update-log.txt` must be in `.gitignore` (T030)
- Commit after each checkpoint to make rollback of dev changes easy
- All 4 API methods must follow the 4-step checklist (constitution Principle I)
