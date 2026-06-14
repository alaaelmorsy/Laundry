# Data Model: إصلاح التحديث التلقائي

**Date**: 2026-06-14

لا تعديل على قاعدة البيانات. البيانات الوحيدة المتأثرة هي ملفات JSON على القرص.

---

## update-status.json (لا تغيير في البنية)

```json
{
  "lastChecked": "ISO datetime",
  "currentVersion": "1.0.10",
  "latestVersion": "1.0.11",
  "hasUpdate": true,
  "releaseNotes": "...",
  "downloadUrl": "https://github.com/.../laundry-app-v1.0.11.exe",
  "checksumUrl":  "https://github.com/.../sha256sums.txt",
  "assetSize": 98765432,
  "publishedAt": "ISO datetime",
  "lastUpdateResult": {
    "status": "success | rollback",
    "fromVersion": "1.0.10",
    "toVersion": "1.0.11",
    "timestamp": "ISO datetime"
  },
  "_etag": "GitHub ETag"
}
```

**تغيير واحد فقط**: `downloadUrl` يشير الآن لـ `laundry-app-v{version}.exe` بدلاً من ZIP.

---

## تدفق البيانات بين المكونات

```
checkForUpdate()
  → GitHub API → finds asset: laundry-app-v{version}.exe
  → saves downloadUrl → update-status.json

performUpdate()
  → reads downloadUrl from update-status.json
  → downloads exe to DATA_DIR/laundry-app-v{version}.exe
  → spawns updater.ps1 with -NewExePath

updater.ps1
  → backs up {AppRoot}/laundry-app.exe → BackupPath/laundry-app.exe.bak
  → copies NewExePath → {AppRoot}/laundry-app.exe
  → writes lastUpdateResult → update-status.json
  → nssm start LaundryPlusApp
  → new exe starts → db.initialize() runs migrations automatically
```

---

## معاملات updater.ps1 (المُعدَّلة)

| المعامل | النوع | الوصف |
|---------|-------|-------|
| `$ServerPid` | int | PID الـ server لانتظار إغلاقه |
| `$TargetVersion` | string | الإصدار الجديد مثل `1.0.11` |
| `$NewExePath` | string | **جديد** — المسار الكامل للـ exe المُحمَّل |
| `$BackupPath` | string | مجلد النسخة الاحتياطية |
| `$AppRoot` | string | مجلد التثبيت مثل `C:\Program Files\PLUS\Laundry` |

**محذوف**: `$ZipPath` (لم يعد مستخدماً).
