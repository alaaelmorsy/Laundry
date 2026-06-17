# API Contracts: نظام التحديث

**الآلية**: جميع الاستدعاءات تمر عبر `POST /api/invoke` بـ `{ method, payload }`.

---

## الـ Methods الموجودة (لا تغيير)

### `checkForUpdate`

```json
Request:  { "method": "checkForUpdate", "payload": { "force": false } }
Response: {
  "success": true,
  "hasUpdate": true,
  "currentVersion": "1.0.15",
  "latestVersion": "1.0.16",
  "releaseNotes": "...",
  "publishedAt": "2026-06-14T...",
  "downloadUrl": "https://...",
  "checksumUrl": "https://...",
  "assetSize": 52428800,
  "lastChecked": "2026-06-15T..."
}
```

`force: true` يتجاوز الـ cache ويستعلم GitHub مباشرةً.

---

### `getUpdateStatus`

```json
Request:  { "method": "getUpdateStatus", "payload": {} }
Response: {
  "success": true,
  "currentVersion": "1.0.15",
  "hasUpdate": true,
  "latestVersion": "1.0.16",
  "lastChecked": "2026-06-15T...",
  "lastUpdateResult": { "status": "success", "fromVersion": "1.0.14", "toVersion": "1.0.15", "timestamp": "..." },
  "assetSize": 52428800
}
```

---

### `performUpdate` ← **يُضاف إليه فحص الدعم الفني**

```json
Request:  { "method": "performUpdate", "payload": {} }

// عند نجاح البدء:
Response: { "success": true, "message": "جارٍ التحديث...", "targetVersion": "1.0.16" }

// عند انتهاء الدعم الفني (جديد):
Response: { "success": false, "supportExpired": true, "message": "انتهت فترة الدعم الفني — يرجى تجديد الدعم للحصول على التحديثات" }

// عند خطأ آخر:
Response: { "success": false, "message": "رسالة الخطأ بالعربية" }
```

---

### `getUpdateProgress`

```json
Request:  { "method": "getUpdateProgress", "payload": {} }
Response: {
  "success": true,
  "inProgress": true,
  "currentStep": "downloading",
  "stepLabel": "جارٍ تنزيل التحديث",
  "percent": 45,
  "steps": [
    { "id": "backup",      "label": "إنشاء نسخة احتياطية",    "status": "done" },
    { "id": "downloading", "label": "جارٍ تنزيل التحديث",     "status": "active" },
    { "id": "verify",      "label": "التحقق من سلامة الملفات","status": "pending" },
    { "id": "replace",     "label": "استبدال الملفات",         "status": "pending" },
    { "id": "migrate",     "label": "تحديث قاعدة البيانات",   "status": "pending" },
    { "id": "restart",     "label": "إعادة التشغيل",          "status": "pending" }
  ],
  "downloadedBytes": 23592960,
  "totalBytes": 52428800
}
```

---

## الـ Method الجديد المقترح (اختياري)

### `getSupportStatus`

```json
Request:  { "method": "getSupportStatus", "payload": {} }
Response: {
  "success": true,
  "valid": true,
  "daysLeft": 45,
  "expiryDate": "2026-07-30"
}
```

يُستخدم لعرض حالة الدعم الفني في واجهة الإعدادات (اختياري للـ UI).

---

## Dedicated Endpoint (موجود)

### `GET /api/update-status`

```json
Response: {
  "hasUpdate": true,
  "latestVersion": "1.0.16",
  "currentVersion": "1.0.15",
  "lastChecked": "2026-06-15T..."
}
```

يُستخدم من `login.js` للـ update badge (لا يمر عبر invoke لأنه يُستدعى قبل تسجيل الدخول).
