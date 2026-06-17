# Data Model: نظام التحديث عبر GitHub

**Feature**: 015-github-update-flow

## حالة In-Memory (`updateProgress`)

هذا الكائن موجود في `updateService.js` ويُعدَّل بإضافة حقلين:

```js
let updateProgress = {
  inProgress: false,           // (موجود) true أثناء التحميل
  currentStep: null,           // (موجود) 'downloading' أثناء التحميل
  stepLabel: '',               // (موجود) نص للعرض
  percent: 0,                  // (موجود) 0-100
  steps: [],                   // (موجود) — لن يُستخدم في الواجهة الجديدة
  downloadedBytes: 0,          // (موجود) bytes مُحمَّلة
  totalBytes: 0,               // (موجود) إجمالي bytes
  downloadDone: false,         // *** جديد *** true عند اكتمال التحميل
  downloadedFilePath: null,    // *** جديد *** مسار .exe المُنزَّل
};
```

## ملف Cache `update-status.json`

لا تغيير في بنيته (يُكتب بـ `writeStatus()`، يُقرأ بـ `readStatus()`):

```json
{
  "lastChecked": "ISO date",
  "currentVersion": "1.0.17",
  "latestVersion": "1.0.18",
  "hasUpdate": true,
  "releaseNotes": "...",
  "downloadUrl": "https://github.com/.../laundry-app-v1.0.18.exe",
  "checksumUrl": "https://github.com/.../sha256sums.txt",
  "assetSize": 52428800,
  "publishedAt": "ISO date",
  "lastUpdateResult": null,
  "_etag": "..."
}
```

## واجهة `getUpdateProgress` (response)

ما يُعاد من `getUpdateProgress()` بعد التعديل:

```js
{
  success: true,
  inProgress: Boolean,       // true أثناء التحميل
  percent: Number,           // 0-100
  downloadedBytes: Number,   // bytes مُحمَّلة
  totalBytes: Number,        // إجمالي bytes (0 إذا مجهول)
  downloadDone: Boolean,     // true عند اكتمال التحميل
  downloadedFilePath: String|null,  // مسار الـ .exe
  stepLabel: String,         // نص الحالة
}
```

## API Methods الجديدة

### `downloadUpdate` — بدء التحميل

**Request**: `{ method: 'downloadUpdate', payload: {} }`

**Response (success)**:
```json
{ "success": true, "started": true }
```

**Response (support expired)**:
```json
{ "success": false, "supportExpired": true, "message": "انتهت فترة الدعم الفني..." }
```

**Response (no update available)**:
```json
{ "success": false, "message": "لا يوجد تحديث متاح", "code": "NO_UPDATE_AVAILABLE" }
```

**Response (already downloading)**:
```json
{ "success": false, "message": "يجري التحميل بالفعل", "code": "DOWNLOAD_IN_PROGRESS" }
```

### `installUpdate` — تثبيت التحديث

**Request**: `{ method: 'installUpdate', payload: {} }`

**Response (success — server will exit)**:
```json
{ "success": true, "message": "جارٍ التثبيت... سيتم إغلاق البرنامج وإعادة تشغيله تلقائياً." }
```

**Response (download not complete)**:
```json
{ "success": false, "message": "لم يكتمل التحميل بعد", "code": "DOWNLOAD_NOT_COMPLETE" }
```

## DB — لا تغيير

يُقرأ فقط `app_settings.support_expiry_date` عبر `db.getAppSettings()` الموجودة (تُعيد `supportExpiryDate`).
