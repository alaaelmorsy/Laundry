# API Contracts: Automatic Update System

All methods follow the project's `POST /api/invoke` monolithic endpoint with `{ method, payload }` body and `{ success, ...data }` response contract.

---

## `checkForUpdate`

Queries GitHub Releases API for the latest version and returns comparison with current version. Caches result in `data/update-status.json`; skips live API call if cache is < 60 minutes old (unless `force: true`).

**Request**:
```json
{
  "method": "checkForUpdate",
  "payload": {
    "force": false
  }
}
```

**Response (no update)**:
```json
{
  "success": true,
  "hasUpdate": false,
  "currentVersion": "1.0.12",
  "latestVersion": "1.0.12",
  "lastChecked": "2026-06-12T10:30:00.000Z"
}
```

**Response (update available)**:
```json
{
  "success": true,
  "hasUpdate": true,
  "currentVersion": "1.0.12",
  "latestVersion": "1.0.13",
  "releaseNotes": "## What's new\n- ...",
  "publishedAt": "2026-06-11T08:00:00.000Z",
  "downloadUrl": "https://github.com/.../laundry-v1.0.13.zip",
  "checksumUrl": "https://github.com/.../sha256sums.txt",
  "lastChecked": "2026-06-12T10:30:00.000Z"
}
```

**Response (check failed — network/API error)**:
```json
{
  "success": false,
  "message": "تعذّر الاتصال بـ GitHub للتحقق من التحديثات",
  "code": "UPDATE_CHECK_FAILED"
}
```

---

## `getUpdateStatus`

Returns the current cached update status and last update result without triggering a live API call. Used by the login screen to show/hide the update notification badge quickly.

**Request**:
```json
{
  "method": "getUpdateStatus",
  "payload": {}
}
```

**Response**:
```json
{
  "success": true,
  "currentVersion": "1.0.12",
  "hasUpdate": true,
  "latestVersion": "1.0.13",
  "lastChecked": "2026-06-12T10:30:00.000Z",
  "lastUpdateResult": {
    "status": "success",
    "fromVersion": "1.0.11",
    "toVersion": "1.0.12",
    "timestamp": "2026-06-05T14:22:11.000Z"
  }
}
```

---

## `performUpdate`

Initiates the full update sequence. This call starts the process and returns quickly; the actual update is carried out by the spawned PowerShell updater after the server exits. The browser loses connection when the server stops — reconnection on the new version signals success.

**Request**:
```json
{
  "method": "performUpdate",
  "payload": {}
}
```

**Response (update initiated)**:
```json
{
  "success": true,
  "message": "جارٍ التحديث... سيتم إغلاق البرنامج وإعادة تشغيله تلقائياً.",
  "targetVersion": "1.0.13"
}
```

**Response (pre-flight checks failed)**:
```json
{
  "success": false,
  "message": "مساحة القرص غير كافية. المطلوب: 500 ميغابايت. المتاح: 120 ميغابايت.",
  "code": "INSUFFICIENT_DISK_SPACE"
}
```

**Error codes**:
| Code | Description |
|------|-------------|
| `NO_UPDATE_AVAILABLE` | No newer version found |
| `UPDATE_ALREADY_IN_PROGRESS` | Another update session is running |
| `INSUFFICIENT_DISK_SPACE` | Not enough space for backup + download |
| `DOWNLOAD_FAILED` | ZIP download failed |
| `CHECKSUM_MISMATCH` | Downloaded file integrity check failed |
| `BACKUP_FAILED` | Could not create file or DB backup |
| `SPAWN_FAILED` | Could not spawn PowerShell updater process |

---

## `getUpdateProgress`

Polled by the frontend during an in-progress update to display step-by-step progress. Returns current step and percentage. Once the server exits, the frontend stops receiving responses and shows a "reconnecting..." state.

**Request**:
```json
{
  "method": "getUpdateProgress",
  "payload": {}
}
```

**Response**:
```json
{
  "success": true,
  "inProgress": true,
  "currentStep": "downloading",
  "stepLabel": "جارٍ تنزيل التحديث...",
  "percent": 45,
  "steps": [
    { "id": "backup", "label": "إنشاء نسخة احتياطية", "status": "done" },
    { "id": "downloading", "label": "تنزيل التحديث", "status": "active" },
    { "id": "verify", "label": "التحقق من سلامة الملفات", "status": "pending" },
    { "id": "replace", "label": "استبدال الملفات", "status": "pending" },
    { "id": "migrate", "label": "تحديث قاعدة البيانات", "status": "pending" },
    { "id": "restart", "label": "إعادة التشغيل", "status": "pending" }
  ]
}
```

---

## GitHub Release Asset Convention

Each release on GitHub MUST include:

| Asset filename | Description |
|----------------|-------------|
| `laundry-v{VERSION}.zip` | Full source archive (excludes `data/`, `.env`, `ssl/`) |
| `sha256sums.txt` | One line: `{SHA256_HEX}  laundry-v{VERSION}.zip` |

The ZIP internal structure mirrors the project root:
```
laundry-v1.0.13.zip
├── package.json
├── package-lock.json
├── server/
├── screens/
├── assets/
├── database/
├── scripts/
└── ...
```
