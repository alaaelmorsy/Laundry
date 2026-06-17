# Data Model: Fix Installer Launch from Settings Screen

No new database entities or schema changes are required for this fix.

## Affected In-Memory State

### updateProgress (existing, in updateService.js)

No changes to structure. The fix adds one new logical state that should be communicated to the frontend:

| Field | Type | Description |
|-------|------|-------------|
| `installerLaunched` | boolean | True after `spawnInstaller()` succeeds without error |
| `installerError` | string \| null | Error message if helper script not found or spawn fails |

These are derived from the return value of `installUpdate()` — no new fields needed in the existing `updateProgress` object. The `installUpdate` handler already returns `{ success, message }`.

## Affected Files

| File | Change |
|------|--------|
| `server/services/updateService.js` | Fix `spawnInstaller()`: check helper exists, fix comment, return error if missing |
| `screens/settings/settings.js` | After successful `installUpdate`, navigate to `/installing` instead of showing static message |
| `screens/settings/settings.html` | No change needed (navigation handled in JS) |
| `server/server.js` (or router) | Add route `GET /installing` → serve `screens/installing/installing.html` |
| `screens/installing/installing.html` | New static page: "Installing…" with auto-poll and redirect |
| `screens/installing/installing.js` | New: poll `GET /` (or `/api/health`) every 3 s; redirect to `/` when server responds |
| `screens/installing/installing.css` | New: minimal styling for the waiting page |

## No Schema Migrations Required
