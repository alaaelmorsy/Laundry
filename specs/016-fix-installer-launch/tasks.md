# Tasks: Fix Installer Launch from Settings Screen

**Input**: Design documents from `specs/016-fix-installer-launch/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new `screens/installing/` directory structure needed by both user stories.

- [x] T001 Create directory `screens/installing/` and empty placeholder files `installing.html`, `installing.js`, `installing.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix the backend `spawnInstaller()` function so it validates the helper script path and returns a proper error on failure. This is a prerequisite for US1 (success redirect) and US2 (error feedback).

**⚠️ CRITICAL**: Both user stories depend on `installUpdate()` returning correct success/failure signals.

- [x] T002 In `server/services/updateService.js` function `spawnInstaller()` (~line 541): add `if (!fs.existsSync(helper)) { throw new Error('سكريبت التثبيت غير موجود: ' + helper); }` before the `spawn()` call
- [x] T003 In `server/services/updateService.js` function `installUpdate()` (~line 553): wrap the `spawnInstaller(exePath)` call in a `try { ... } catch (e) { return { success: false, message: e.message }; }` block — confirm this wrapper already exists; if not, add it
- [x] T004 In `server/services/updateService.js` function `spawnInstaller()` (~line 534): replace the stale comment that mentions "scheduling a one-time scheduled task" with an accurate description: the function runs the installer silently from Session-0 via run-installer.ps1 which uses `/SILENT /SUPPRESSMSGBOXES`

**Checkpoint**: `installUpdate()` now returns `{ success: false, message: '...' }` when `run-installer.ps1` is missing, instead of silently failing.

---

## Phase 3: User Story 1 — Trigger Update from Settings (Priority: P1) 🎯 MVP

**Goal**: After a successful `installUpdate()` call, the browser navigates to a dedicated "Installing…" page that shows Arabic feedback and auto-redirects to login when the server recovers.

**Independent Test**: Call `installUpdate` from settings → browser navigates to `/screens/installing/installing.html` → stop server → restart server → page auto-redirects to `/` (login).

### Implementation for User Story 1

- [x] T005 [US1] In `screens/installing/installing.html`: write the complete RTL HTML page — `<html lang="ar" dir="rtl">`, Cairo font via `<link>` to `/assets/fonts/` or Google Fonts fallback, a centred card with a CSS spinner, Arabic heading "جارٍ تثبيت التحديث", sub-text "يرجى الانتظار، سيتم إعادة التوجيه تلقائياً عند اكتمال التثبيت", a `<p id="statusMsg">` for timeout messages, and `<script src="installing.js"></script>`
- [x] T006 [US1] In `screens/installing/installing.css`: write minimal styles — body centres the card, card has white background with border-radius and box-shadow, spinner is a `border-radius: 50%` div with a `@keyframes spin` animation, font is Cairo with RTL direction, responsive on narrow screens
- [x] T007 [US1] In `screens/installing/installing.js`: write an IIFE that (a) waits 3 s before first poll to allow the server to begin shutting down, (b) sends `fetch('/', { method: 'HEAD', cache: 'no-store' })` every 3 s, (c) on HTTP 200 response redirects to `window.location.href = '/'`, (d) on network error retries after 3 s, (e) after 5 minutes of total elapsed time sets `document.getElementById('statusMsg').textContent = 'انتهت مهلة الانتظار. يرجى إعادة تشغيل التطبيق يدوياً.'` and stops polling
- [x] T008 [US1] In `screens/settings/settings.js` function `handleInstall()` (~line 1051): replace the `resultArea.innerHTML = ...` block inside the `if (res && res.success)` branch with `window.location.href = '/screens/installing/installing.html';`

**Checkpoint**: User Story 1 fully functional — clicking Install in Settings navigates to the installing page which auto-redirects to login after server restarts.

---

## Phase 4: User Story 2 — Installer Fails to Launch Gracefully (Priority: P2)

**Goal**: When `spawnInstaller()` throws (e.g., helper script missing), the error is shown in the Settings screen instead of silently failing.

**Independent Test**: Rename `scripts/run-installer.ps1` temporarily → trigger install from Settings → Settings screen shows an Arabic error message in the result area within 3 s → rename file back.

### Implementation for User Story 2

- [x] T009 [US2] In `screens/settings/settings.js` function `handleInstall()` (~line 1051): confirm the `else` / `!res.success` branch shows `res.message` in `resultArea` with an error style (red background); if the branch is missing or only re-enables the button without showing the message, add `resultArea.innerHTML = '<div style="...error styles..."><span>⚠️</span><span>' + (res.message || 'فشل تشغيل برنامج التثبيت') + '</span></div>';`
- [x] T010 [US2] In `screens/settings/settings.js` function `handleInstall()`: ensure the Install button (`btnInstallUpdate`) is re-enabled and its label restored when `res.success` is false, so the user can retry or contact support

**Checkpoint**: User Story 2 complete — failed install attempts show a readable Arabic error in the Settings screen.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T011 [P] Run quickstart.md Scenario 1 (missing helper → error feedback) and confirm error message appears in Settings screen
- [ ] T012 [P] Run quickstart.md Scenario 2 (successful install → installing page redirect) and confirm navigation works
- [ ] T013 Run quickstart.md Scenario 3 (installing page polls and redirects after server restarts) and confirm auto-redirect works
- [ ] T014 [P] Verify `screens/installing/installing.html` renders correctly in RTL at both desktop width (1280px) and narrow width (360px) in browser DevTools
- [x] T015 [P] Verify the stale comment in `server/services/updateService.js` `spawnInstaller()` is accurate and no longer mentions "scheduled task"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks both user stories
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 2 completion — can run in parallel with Phase 3
- **Phase 5 (Polish)**: Depends on Phases 3 and 4

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 — independently testable after Phase 2
- **US2 (P2)**: No dependency on US1 — independently testable after Phase 2; T009–T010 touch the same `settings.js` file as T008, so complete US1 first to avoid merge conflicts

### Within Each User Story

- US1: T005, T006, T007 can run in parallel (different files); T008 depends only on the contract from Phase 2
- US2: T009 and T010 both edit `settings.js` — do sequentially

---

## Parallel Opportunities

```
Phase 1 → Phase 2 (sequential)

Phase 2 complete → can start:
  [parallel] Phase 3: T005, T006, T007 (different files)
             then T008 (settings.js)
  [parallel] Phase 4: T009, T010 (settings.js — do after T008)

Phase 3 + Phase 4 complete → Phase 5:
  [parallel] T011, T012, T014, T015
  then T013 (requires server restart)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004)
3. Complete Phase 3: US1 (T005–T008)
4. **STOP and VALIDATE**: Test per quickstart Scenarios 2 & 3
5. Ship — users now see a proper installing page instead of a dead browser tab

### Incremental Delivery

1. Setup + Foundational → backend returns proper error on missing helper
2. Add US1 → browser redirect + installing page → MVP shipped
3. Add US2 → error feedback in Settings for failed launches
4. Polish phase → visual QA and comment cleanup

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps each task to its user story for traceability
- No DB migrations, no new API methods, no new invoke handlers needed
- The `screens/installing/` page is served by the existing `express.static(ROOT)` in `server/index.js` — no routing change needed
- Total tasks: 15 (T001–T015)
