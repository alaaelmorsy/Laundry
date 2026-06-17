# Implementation Plan: Fix Installer Launch from Settings Screen

**Branch**: `016-fix-installer-launch` | **Date**: 2026-06-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-fix-installer-launch/spec.md`

## Summary

The update installer runs silently (no GUI window) because the app operates as a Session-0 Windows Service — any GUI spawned from Session 0 is invisible to the user. This is correct and reliable behaviour. The real problem is zero user feedback: after clicking "Install", the server exits after 2 s, the browser loses its connection, and the user has no idea whether installation succeeded or failed. Fix: (1) add a pre-flight check that `run-installer.ps1` exists and surface any error to the UI, (2) redirect the browser to a new "Installing…" page that polls for server recovery and auto-redirects to login when done, (3) fix the stale comment in `spawnInstaller()`.

## Technical Context

**Language/Version**: Node.js (CommonJS), Vanilla JS frontend

**Primary Dependencies**: Express.js (static file serving already handles new screen), child_process.spawn (existing)

**Storage**: N/A — no DB changes

**Testing**: Manual validation per `quickstart.md`

**Target Platform**: Windows 10/11, app running as NSSM Windows Service (Session 0)

**Project Type**: On-premise single-tenant web app (served locally, browser client)

**Performance Goals**: Installing page must poll and redirect within 6 s of service restart

**Constraints**: No ES modules on frontend, RTL Arabic-first, no new API endpoints needed

**Scale/Scope**: Single machine, 1 user session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 4-Step API Checklist | ✅ Pass | No new API method; existing `installUpdate` invoke method unchanged |
| Screen-Per-Page Frontend | ✅ Pass | New `screens/installing/` screen follows the same pattern |
| No ES modules | ✅ Pass | New screen JS uses plain IIFE |
| RTL / Arabic-first | ✅ Pass | New screen uses `lang="ar" dir="rtl"` and Arabic text |
| Uniform Response Contract | ✅ Pass | `installUpdate` already returns `{ success, message }` |
| MySQL-Only Data Layer | ✅ N/A | No DB changes |

## Project Structure

### Documentation (this feature)

```text
specs/016-fix-installer-launch/
├── plan.md              ← this file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md             ← created by /speckit-tasks
```

### Source Code Changes

```text
server/services/updateService.js        ← fix spawnInstaller(): guard + fix comment
screens/settings/settings.js            ← navigate to installing page on success
screens/installing/
├── installing.html                     ← new: "Installing..." waiting page (RTL, Arabic)
├── installing.js                       ← new: poll server, redirect on recovery
└── installing.css                      ← new: minimal RTL styling
```

## Implementation Steps

### Step 1 — Guard + comment fix in `spawnInstaller()` (updateService.js)

In `server/services/updateService.js`, function `spawnInstaller()` (~line 541):

1. Add `fs.existsSync(helper)` check before spawn; throw a descriptive Arabic error if missing.
2. Replace the stale comment that mentions "scheduled task" with accurate description of the silent-install approach.
3. Confirm `installUpdate()` wraps `spawnInstaller()` in try/catch and returns `{ success: false, message }` on error — add the try/catch if missing.

### Step 2 — Settings screen navigates to installing page (settings.js)

In `screens/settings/settings.js`, function `handleInstall()` (~line 1051):

Replace the current `resultArea.innerHTML` update on success with:
```js
window.location.href = '/screens/installing/installing.html';
```
Keep the existing error branch (show error message in `resultArea`) unchanged.

### Step 3 — Create `screens/installing/installing.html`

New file. RTL, `lang="ar" dir="rtl"`. Includes:
- Spinner / loading icon (CSS animation, no external assets)
- Arabic heading: "جارٍ تثبيت التحديث"
- Arabic sub-text: "يرجى الانتظار، سيتم إعادة التوجيه تلقائياً عند اكتمال التثبيت"
- Loads `installing.css` and `installing.js`
- No auth-guard, no nav bar (server may be down)

### Step 4 — Create `screens/installing/installing.js`

Polls `http://localhost:3000/` with a HEAD request every 3 s. On first successful response, redirects to `/`. Times out after 5 minutes and shows a manual-restart message.

### Step 5 — Create `screens/installing/installing.css`

Minimal styles: centred card layout, Cairo font (imported from existing `assets/`), spinner keyframe animation, safe on all screen widths.

## Complexity Tracking

No constitution violations. No new complexity — the new screen follows the exact same pattern as all existing screens.
