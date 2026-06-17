# Implementation Plan: نظام التحديث عبر GitHub

**Branch**: `015-github-update-flow` | **Date**: 2026-06-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-github-update-flow/spec.md`

## Summary

استبدال نظام التحديث الحالي بنظام أبسط من 3 خطوات: (١) فحص الدعم الفني وGitHub، (٢) تحميل الملف مع شريط تقدم بالميجابايت، (٣) زر "تثبيت الآن" يتفعّل بعد اكتمال التحميل. الكود الحالي يحتوي على 90% من البنية المطلوبة — التغيير هو فصل خطوة التحميل عن التثبيت وتبسيط الواجهة (حذف خطوات backup/verify/steps-list).

## Technical Context

**Language/Version**: Node.js (CommonJS), Vanilla JS

**Primary Dependencies**: Express.js، `https`/`http` built-in (للتحميل)، `child_process.spawn` (للتثبيت)

**Storage**: ملف `update-status.json` (cache لنتيجة checkForUpdate)، ملف `.exe` مؤقت في `DATA_DIR`

**Testing**: اختبار يدوي عبر شاشة الإعدادات

**Target Platform**: Windows (on-premise)

**Project Type**: Desktop app (Node.js + Vanilla JS)

**Performance Goals**: شريط تقدم يتحدث كل ثانية بقيم MB حقيقية

**Constraints**: لا backup قبل التحديث، لا checksum إجباري، فصل download عن install

**Scale/Scope**: 5 ملفات مُعدَّلة، ~250 سطر تعديل، واجهة واحدة

## Constitution Check

| مبدأ | الحالة | ملاحظة |
|------|--------|--------|
| 4-Step API Checklist (I) | ✅ | `downloadUpdate` + `installUpdate` يُضافان في db→handlers→web-api→screen |
| Screen-Per-Page Frontend (II) | ✅ | تعديل داخل `screens/settings/` فقط، لا ES modules |
| MySQL-Only (III) | ✅ | لا تغيير في DB — نقرأ `supportExpiryDate` من `getAppSettings()` فقط |
| Bilingual Arabic-First (IV) | ✅ | جميع النصوص عربية، RTL محفوظ |
| Uniform Response Contract (V) | ✅ | كل handler يُعيد `{ success, ...data }` |
| Single-Tenant (VII) | ✅ | لا تغيير |

**نتيجة**: لا انتهاكات — جاهز للتنفيذ.

## Project Structure

### Documentation (this feature)

```text
specs/015-github-update-flow/
├── plan.md              ← هذا الملف
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── quickstart.md        ← Phase 1
└── tasks.md             ← Phase 2 (/speckit-tasks)
```

### Source Code (files to modify)

```text
server/services/updateService.js     ← إضافة downloadUpdate() + installUpdate()
server/invokeHandlers.js             ← إضافة case 'downloadUpdate' + case 'installUpdate'
assets/web-api.js                    ← تسجيل downloadUpdate + installUpdate
screens/settings/settings.html       ← تبسيط #updateProgressPanel (حذف steps list)
screens/settings/settings.js         ← إعادة كتابة initUpdatePanel() بالتدفق الجديد
```

**Structure Decision**: مشروع واحد (single project). لا ملفات جديدة — تعديل على ملفات موجودة فقط.
