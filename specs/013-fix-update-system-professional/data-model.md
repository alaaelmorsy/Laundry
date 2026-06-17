# Data Model: نظام التحديث التلقائي

## الملفات والبيانات المستخدمة

### update-status.json
```json
{
  "lastChecked": "ISO8601",
  "currentVersion": "1.0.17",
  "latestVersion": "1.0.18",
  "hasUpdate": true,
  "downloadUrl": "https://github.com/.../laundry-app-v1.0.18.exe",
  "checksumUrl": "https://github.com/.../sha256sums.txt",
  "assetSize": 52428800,
  "releaseNotes": "...",
  "publishedAt": "ISO8601",
  "lastUpdateResult": {
    "status": "success|rollback",
    "fromVersion": "1.0.17",
    "toVersion": "1.0.18",
    "timestamp": "ISO8601"
  },
  "_etag": "\"abc123\""
}
```

### معاملات updater.ps1
| المعامل | النوع | المصدر | الوصف |
|---------|-------|--------|-------|
| `-ServerPid` | int | `process.pid` | PID الخادم لانتظار إغلاقه |
| `-TargetVersion` | string | `cached.latestVersion` | الإصدار الجديد |
| `-FromVersion` | string | `pkg.version` | الإصدار الحالي (مُمرَّر من البرنامج) |
| `-NewExePath` | string | `path.join(DATA_DIR, exeName)` | مسار الـ exe المُنزَّل |
| `-BackupPath` | string | `createBackup()` return | مجلد النسخة الاحتياطية |
| `-AppRoot` | string | `ROOT` (EXEC_DIR في pkg mode) | مجلد الـ exe على القرص |

### مسارات الملفات (pkg mode)
```
{EXEC_DIR}/
├── laundry-app.exe          ← الـ exe الحالي (يُستبدَل)
├── nssm.exe                 ← لإدارة الـ service
├── data/
│   ├── update-status.json   ← حالة التحديث
│   ├── update-log.txt       ← سجل العملية
│   └── laundry-app-v{ver}.exe  ← الـ exe المؤقت (يُحذف بعد الاستبدال)
└── backup/
    └── pre-{version}/
        ├── laundry-app.exe.bak  ← نسخة الـ exe القديم
        └── meta.json
```

## تدفق البيانات في عملية التحديث

```
performUpdate()
  → reads pkg.version (virtual FS) → fromVersion
  → reads cached downloadUrl
  → downloadWithProgress() → DATA_DIR/laundry-app-v{ver}.exe
  → verifySha256() → downloads sha256sums.txt → verifies hash
  → spawn updater.ps1 (-FromVersion fromVersion ...)
  → process.exit(0)

updater.ps1
  ← receives -FromVersion (no disk read needed)
  → waits for PID exit
  → copies exe.bak from old exe
  → copies new exe over old exe
  → removes temp exe
  → Set-UpdateResult 'success' fromVersion targetVersion
  → nssm start LaundryPlusApp
```
