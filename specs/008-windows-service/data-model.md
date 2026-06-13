# Data Model: Windows Service Deployment

**Date**: 2026-06-13 | **Feature**: 008-windows-service

---

## لا تغيير في قاعدة البيانات

هذه الميزة لا تضيف جداول أو أعمدة جديدة في MySQL. كل البيانات المتعلقة بالتحديث تُخزَّن في ذاكرة العملية (in-memory) فقط.

---

## حالة التحديث (In-Memory State)

**الموقع**: `server/update-checker.js` — متغير module-level

```
UpdateState {
  available:    Boolean      // هل يوجد تحديث؟
  version:      String       // رقم الإصدار الجديد (مثال: "1.0.13")
  downloadUrl:  String       // رابط تحميل الـ installer
  releaseNotes: String       // ملاحظات الإصدار (عربي)
  checkedAt:    Date         // آخر وقت فحص
  downloading:  Boolean      // هل التحميل جارٍ الآن؟
  localPath:    String|null  // مسار الـ installer المحمَّل محلياً
  error:        String|null  // آخر خطأ في الفحص/التحميل
}
```

**الحالة الأولية**:
```json
{
  "available": false,
  "version": null,
  "downloadUrl": null,
  "releaseNotes": null,
  "checkedAt": null,
  "downloading": false,
  "localPath": null,
  "error": null
}
```

**دورة حياة الحالة**:
```
[مشغّل] → available: false
    ↓ (كل 6 ساعات)
[fetchLatestVersion()]
    ↓ نجح + إصدار جديد
available: true, version: "X.Y.Z"
    ↓ المستخدم يضغط "تثبيت"
downloading: true
    ↓ اكتمل التحميل
localPath: "%TEMP%\laundry-update-setup.exe"
    ↓ شغّل الـ installer
[البرنامج يُوقَف من الـ installer]
```

---

## ملفات النظام (Windows)

### Windows Service Registry Entry

**المسار**: `HKLM\SYSTEM\CurrentControlSet\Services\LaundryPlusApp`

| القيمة | البيانات |
|--------|---------|
| ImagePath | `"C:\Laundry\nssm.exe" LaundryPlusApp` |
| DisplayName | `مغسلة بلس` |
| Description | `نظام إدارة المغسلة` |
| Start | `2` (AUTO_START) |
| ObjectName | `LocalSystem` |

### Desktop Shortcut

**المسار**: `%PUBLIC%\Desktop\مغسلة بلس.lnk`

| الخاصية | القيمة |
|---------|--------|
| Target | `C:\Windows\System32\explorer.exe` |
| Arguments | `https://localhost:3443` |
| Icon | `C:\Laundry\laundry-app.exe, 0` |
| Description | `فتح نظام إدارة المغسلة` |

### ملف التثبيت المحمَّل

**المسار**: `%TEMP%\laundry-update-YYYYMMDD.exe`

يُحذف تلقائياً بعد تشغيله (أو يُنظَّف عند بدء التشغيل التالي).

---

## واجهة Update Manifest (GitHub Releases)

### استجابة GitHub API

```json
{
  "tag_name": "v1.0.13",
  "name": "إصدار 1.0.13 — إصلاح الفواتير",
  "body": "- إصلاح مشكلة طباعة الفاتورة\n- تحسين سرعة البحث",
  "assets": [
    {
      "name": "laundry-setup.exe",
      "browser_download_url": "https://github.com/OWNER/REPO/releases/download/v1.0.13/laundry-setup.exe",
      "size": 125000000
    }
  ]
}
```

### البيانات المستخرجة

| الحقل | المصدر | مثال |
|-------|--------|------|
| version | `tag_name` (بدون `v`) | `1.0.13` |
| downloadUrl | `assets[0].browser_download_url` | رابط الـ exe |
| releaseNotes | `body` | نص الإصدار |

---

## package.json — إصدار البرنامج الحالي

**المصدر**: `package.json` → `version`

يُقرأ عند بدء البرنامج ويُستخدم للمقارنة مع الإصدار الجديد. المقارنة بـ semver (major.minor.patch).
