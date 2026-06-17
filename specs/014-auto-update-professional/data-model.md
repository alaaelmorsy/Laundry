# Data Model: نظام التحديث التلقائي

**Date**: 2026-06-15

---

## الكيانات الموجودة (لا تغيير مطلوب)

### 1. `update-status.json` (ملف محلي)

يقع في `{DATA_ROOT}/data/update-status.json`.

```json
{
  "lastChecked": "2026-06-15T10:00:00.000Z",
  "currentVersion": "1.0.15",
  "latestVersion": "1.0.16",
  "hasUpdate": true,
  "releaseNotes": "إصلاحات وتحسينات",
  "downloadUrl": "https://github.com/owner/repo/releases/download/v1.0.16/laundry-app-v1.0.16.exe",
  "checksumUrl": "https://github.com/owner/repo/releases/download/v1.0.16/sha256sums.txt",
  "assetSize": 52428800,
  "publishedAt": "2026-06-14T00:00:00.000Z",
  "lastUpdateResult": {
    "status": "success",
    "fromVersion": "1.0.14",
    "toVersion": "1.0.15",
    "timestamp": "2026-06-10T08:30:00.000Z"
  },
  "_etag": "\"abc123def456\""
}
```

**Cache TTL**: ساعة واحدة. بعد انتهائها يُعاد الاستعلام من GitHub.

### 2. `update-log.txt` (ملف محلي)

يقع في `{DATA_ROOT}/data/update-log.txt`. سجل append-only.

```
[2026-06-15T10:00:00.000Z] [INFO] Update check: current=1.0.15 latest=1.0.16 hasUpdate=true
[2026-06-15T10:05:00.000Z] [INFO] Update started: target=1.0.16
[2026-06-15T10:05:01.000Z] [INFO] Backup created: C:\...\backup\pre-1.0.16
[2026-06-15T10:06:30.000Z] [INFO] Download complete (52428800 bytes)
[2026-06-15T10:06:32.000Z] [INFO] Checksum verified: OK
[2026-06-15T10:06:33.000Z] [INFO] Spawning updater, server exiting
```

### 3. `app_settings` (جدول MySQL — صف id=1)

العمود الجديد المطلوب للدعم الفني:

```sql
support_expiry_date DATE DEFAULT NULL
```

**ملاحظة**: العمود موجود بالفعل في `database/db.js` (migration السطر 3447). لا تغيير مطلوب في المخطط.

**المنطق**:

| قيمة `support_expiry_date` | النتيجة |
|---|---|
| `NULL` | الدعم ساري (no expiry set) |
| تاريخ مستقبلي | الدعم ساري |
| تاريخ ماضٍ | الدعم منتهٍ — يُمنع التحديث |

### 4. updateProgress (in-memory state في `updateService.js`)

```javascript
{
  inProgress: false,
  currentStep: null,       // 'backup' | 'downloading' | 'verify' | 'replace' | 'migrate' | 'restart'
  stepLabel: '',
  percent: 0,              // 0-100
  steps: [],               // [{id, label, status: 'done'|'active'|'pending'}]
  downloadedBytes: 0,
  totalBytes: 0,
}
```

---

## الكيانات الجديدة (للإضافة)

### 5. دالة `getSupportExpiry` في `database/db.js`

```javascript
// Returns: { supportExpiryDate: Date|null }
async function getSupportExpiry() { ... }
```

تستعلم من صف id=1 في `app_settings` وتُعيد `support_expiry_date`.

**البديل**: استخدام `getAppSettings()` الموجودة التي تُعيد `supportExpiryDate` بالفعل (من السطر 3586 في db.js).

---

## تدفق البيانات

```
GitHub Releases API
        ↓
  checkForUpdate()
        ↓
  update-status.json (cache)
        ↓
  getUpdateStatus() ← login badge (/api/update-status)
        ↓
  settings UI (panelUpdate)
        ↓
  performUpdate() [يفحص support_expiry_date أولاً]
        ↓
  updateProgress (in-memory, polled كل 500ms)
        ↓
  spawn updater.ps1
        ↓
  update-status.json (lastUpdateResult: 'success'|'rollback')
```
