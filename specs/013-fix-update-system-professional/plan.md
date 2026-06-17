# Implementation Plan: إصلاح شامل لنظام التحديث التلقائي

**Branch**: `013-fix-update-system-professional` | **Date**: 2026-06-15 | **Spec**: [spec.md](spec.md)

## Summary

إصلاح مشكلتين جوهريتين متبقيتين في نظام التحديث التلقائي (بعد الإصلاحات السابقة في هذه الجلسة):
1. `updater.ps1` يحاول قراءة `package.json` من القرص الحقيقي — غير موجود في وضع exe — فيُسجَّل `fromVersion = 'unknown'`
2. رسائل الخطأ التقنية الإنجليزية تظهر للمستخدم العربي بدل رسائل مفهومة

## Technical Context

**Language/Version**: Node.js 20 (pkg exe), PowerShell 5.1

**Primary Dependencies**: pkg, NSSM, GitHub Releases API

**Storage**: `data/update-status.json` (محلي)

**Testing**: سيناريوهات يدوية في quickstart.md

**Target Platform**: Windows 10/11 (جهاز العميل)

**Project Type**: Desktop App (pkg exe) + Windows Service

**Constraints**: لا node.js على جهاز العميل — الـ runtime مدمج في الـ exe

**Scale/Scope**: ملفان: `updateService.js` + `updater.ps1`

## Constitution Check

| المعيار | الحالة | ملاحظة |
|---------|--------|--------|
| 4-Step API Checklist | لا ينطبق | لا API جديدة |
| Screen-Per-Page Frontend | لا ينطبق | لا تغيير في الـ frontend |
| MySQL-Only Data Layer | لا ينطبق | لا تغيير في قاعدة البيانات |
| Bilingual Arabic-First | محفوظ | رسائل الخطأ تُترجَم للعربية |
| Monolithic /api/invoke | لا ينطبق | لا endpoint جديدة |
| Uniform Response Contract | محفوظ | |

**نتيجة Gate**: لا توجد انتهاكات

## Project Structure

### Documentation (this feature)

```text
specs/013-fix-update-system-professional/
├── plan.md          <- هذا الملف
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Code (التعديلات فقط)

```text
server/services/updateService.js   <- T1, T2
scripts/updater.ps1                <- T3
```

---

## التعديلات التفصيلية

### T1 — updateService.js: تمرير `fromVersion` لـ updater.ps1

**الملف**: `server/services/updateService.js` — في `performUpdate()` عند spawn الـ updater

**من**:
```js
const psArgs = [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', updaterScript,
  '-ServerPid', String(process.pid),
  '-TargetVersion', targetVersion,
  '-NewExePath', exePath,
  '-BackupPath', backupPath,
  '-AppRoot', ROOT,
];
```

**إلى**:
```js
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const psArgs = [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', updaterScript,
  '-ServerPid',     String(process.pid),
  '-TargetVersion', targetVersion,
  '-FromVersion',   pkg.version,
  '-NewExePath',    exePath,
  '-BackupPath',    backupPath,
  '-AppRoot',       ROOT,
];
```

---

### T2 — updateService.js: تعريب رسائل الخطأ

**الملف**: `server/services/updateService.js`

في `githubGet`: `'GitHub API timeout'` → `'انتهت مهلة الاتصال بـ GitHub'`
في `githubGet`: `'Too many redirects'` → `'خطأ في الاتصال: إعادة توجيه متكررة'`
في `checkForUpdate`: `'GitHub repo not configured in package.json'` → `'لم يتم تهيئة إعدادات GitHub في البرنامج'`
في `checkForUpdate`: `` `GitHub API error: ${res.status}` `` → `` `خطأ في الاتصال بـ GitHub (${res.status})` ``
في `downloadWithProgress`: `` `Download failed: HTTP ${res.statusCode}` `` → `` `فشل التنزيل (HTTP ${res.statusCode}) — تحقق من الإنترنت وأعد المحاولة` ``
في `downloadWithProgress`: `'Download timed out'` → `'انتهت مهلة التنزيل — تحقق من سرعة الإنترنت وأعد المحاولة'`

---

### T3 — updater.ps1: استخدام `-FromVersion` بدل قراءة package.json

**الملف**: `scripts/updater.ps1`

إضافة معامل `-FromVersion` وحذف بلوك قراءة `package.json`.

---

## ترتيب التنفيذ

```
T3 -> updater.ps1: إضافة -FromVersion parameter
T1 -> updateService.js: تمرير -FromVersion عند spawn
T2 -> updateService.js: تعريب رسائل الخطأ
```
