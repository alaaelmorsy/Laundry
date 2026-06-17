# Implementation Plan: نظام التحديث التلقائي الاحترافي

**Branch**: `014-auto-update-professional` | **Date**: 2026-06-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-auto-update-professional/spec.md`

---

## Summary

نظام التحديث موجود ومُنفَّذ بالكامل تقريباً (90%). الملفات المعنية (`updateService.js`، `updater.ps1`، settings panel، login badge) كلها تعمل. **الفجوة الوحيدة** هي إضافة فحص صلاحية الدعم الفني (`support_expiry_date`) في `invokeHandlers.js` قبل بدء التحديث، مطابقةً لنظام كاشير.

---

## Technical Context

**Language/Version**: Node.js (CommonJS), PowerShell 5.1, Vanilla JS

**Primary Dependencies**: Express.js, mysql2, Node.js built-ins (https, http, crypto, fs, child_process)

**Storage**: MySQL `app_settings.support_expiry_date` (DATE, موجود)، `update-status.json` و `update-log.txt` (ملفات محلية)

**Testing**: يدوي — سيناريوهات موثَّقة في [quickstart.md](quickstart.md)

**Target Platform**: Windows 10/11 (exe مُغلَّف بـ pkg + Windows Service عبر NSSM)

**Project Type**: Web application (Express server يُقدِّم HTML pages للمتصفح المحلي)

**Constraints**: التحديث يدوي 100%، لا auto-download، فحص الدعم يمنع التحميل فقط (لا يمنع الفحص)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate 1: 4-Step API Checklist

| الـ Method | db.js | invokeHandlers.js | web-api.js | screen JS |
|---|---|---|---|---|
| `performUpdate` (تعديل) | ✅ `getAppSettings()` موجودة وتُعيد `supportExpiryDate` | ⬜ يُضاف فحص الدعم | ✅ موجود | ✅ موجود |
| `getSupportStatus` (جديد، اختياري) | ✅ `getAppSettings()` | ⬜ يُضاف case | ⬜ يُضاف | ⬜ اختياري |

**الـ Methods الموجودة بالكامل**: `checkForUpdate`, `getUpdateStatus`, `getUpdateProgress` — لا تعديل.

### Gate 2: لا SQL Injection

جميع الاستعلامات المستخدمة parameterized. `getAppSettings()` يستخدم `SELECT * FROM app_settings WHERE id = 1 LIMIT 1` ✅

### Gate 3: واجهة عربية — RTL

جميع رسائل الخطأ في `updateService.js` بالعربية ✅. رسالة انتهاء الدعم الجديدة ستكون بالعربية ✅

**نتيجة الفحص**: لا انتهاكات ✅

---

## Project Structure

### Documentation (this feature)

```text
specs/014-auto-update-professional/
├── plan.md              ← هذا الملف
├── spec.md              ← المواصفات
├── research.md          ← تحليل الكود الحالي + القرارات
├── data-model.md        ← الكيانات والمخطط
├── quickstart.md        ← سيناريوهات التحقق
├── contracts/
│   └── api-methods.md   ← عقود الـ API
├── checklists/
│   └── requirements.md
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (التغييرات المطلوبة فقط)

```text
server/
└── invokeHandlers.js          ← تعديل: إضافة فحص support_expiry_date في case 'performUpdate'

screens/settings/
└── settings.js                ← تعديل: معالجة supportExpired في handleUpdateNow

assets/
└── web-api.js                 ← إضافة اختيارية: getSupportStatus method
```

**الملفات التي لا تحتاج تعديل** (مكتملة):
- `server/services/updateService.js`
- `database/db.js`
- `scripts/updater.ps1`
- `screens/settings/settings.html`
- `screens/login/login.js`

**Structure Decision**: نفس النمط الموجود — invoke handler يفحص DB ثم يستدعي service.

---

## Implementation Tasks

### Task 1 — فحص صلاحية الدعم في `invokeHandlers.js` (الأساسي)

**الملف**: `server/invokeHandlers.js` — case `'performUpdate'`

المنطق المُضاف قبل استدعاء `updateService.performUpdate()`:
```javascript
const settings = await db.getAppSettings();
if (settings && settings.supportExpiryDate) {
  const expiry = new Date(settings.supportExpiryDate);
  expiry.setHours(23, 59, 59, 999);
  if (expiry < new Date()) {
    return { success: false, supportExpired: true,
             message: 'انتهت فترة الدعم الفني — يرجى تجديد الدعم للحصول على التحديثات' };
  }
}
```

### Task 2 — معالجة `supportExpired` في `settings.js`

**الملف**: `screens/settings/settings.js` — دالة `handleUpdateNow`

عند `res.supportExpired === true`: عرض رسالة تحذير بالعربية وإعادة تفعيل الزر.

### Task 3 (اختياري) — إضافة `getSupportStatus`

إذا أراد المستخدم عرض تاريخ انتهاء الدعم في واجهة الإعدادات:
1. `invokeHandlers.js`: case `'getSupportStatus'` → يُعيد `{ valid, daysLeft, expiryDate }`
2. `web-api.js`: تسجيل `getSupportStatus`
3. `settings.js`: عرض المعلومات في panel التحديثات

---

## Complexity Tracking

لا انتهاكات — جميع التعديلات تتبع النمط الحالي بالكامل.
