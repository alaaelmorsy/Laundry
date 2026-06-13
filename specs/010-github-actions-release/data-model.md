# Data Model: GitHub Actions Release

**Date**: 2026-06-14

## الكيانات

### 1. GitHub Release

| الحقل | النوع | القيمة |
|-------|-------|--------|
| `tag_name` | string | `v{version}` مثلاً `v1.0.13` |
| `name` | string | `الإصدار v1.0.13` |
| `body` | string | ملاحظات الإصدار |
| `assets` | array | الملفات المرفقة (exe + zip + checksum) |

### 2. Release Assets

| الملف | الغرض | من يستخدمه |
|-------|--------|------------|
| `Laundry-PLUS-v{version}.exe` | توزيع يدوي | المستخدم النهائي |
| `laundry-v{version}.zip` | التحديث التلقائي | `updateService.js` |
| `sha256sums.txt` | التحقق من السلامة | `updateService.js` → `verifySha256()` |

### 3. `sha256sums.txt` — التنسيق

```
{hash_hex}  laundry-v{version}.zip
{hash_hex}  Laundry-PLUS-v{version}.exe
```

> `updateService.js` السطر 355: `lines.find(l => l.toLowerCase().includes(zipName.toLowerCase()))`
> يبحث عن السطر الذي يحتوي على اسم الـ ZIP — التنسيق أعلاه متوافق.

### 4. `update-status.json` (محلي على جهاز المستخدم)

```json
{
  "lastChecked": "2026-06-14T10:00:00.000Z",
  "currentVersion": "1.0.12",
  "latestVersion": "1.0.13",
  "hasUpdate": true,
  "downloadUrl": "https://github.com/alaaelmorsy/Laundry/releases/download/v1.0.13/laundry-v1.0.13.zip",
  "checksumUrl": "https://github.com/alaaelmorsy/Laundry/releases/download/v1.0.13/sha256sums.txt",
  "releaseNotes": "...",
  "publishedAt": "2026-06-14T09:00:00Z"
}
```

## تدفق البيانات

```
package.json (version) 
    → GitHub Actions يقرأ الإصدار
    → pkg يبنى Laundry-PLUS-v{version}.exe
    → Compress-Archive يعمل laundry-v{version}.zip
    → Get-FileHash يعمل sha256sums.txt
    → gh release create يرفع الثلاثة على GitHub
    → updateService.js يجلب /releases/latest من GitHub API
    → يحفظ النتيجة في data/update-status.json
    → الواجهة تعرض إشعار التحديث
```
