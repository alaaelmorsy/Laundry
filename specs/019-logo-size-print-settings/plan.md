# Implementation Plan: Logo Size in Print Settings

**Branch**: `019-logo-size-print-settings` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-logo-size-print-settings/spec.md`

## Summary

تطبيق أبعاد الشعار (`logoWidth` / `logoHeight`) المخزنة في `app_settings` على عناصر `<img>` الشعار في جميع شاشات الطباعة. الـ DB والـ settings UI موجودان بالفعل — الجزء المفقود هو تطبيق الأبعاد كـ inline styles عند تهيئة كل شاشة.

## Technical Context

**Language/Version**: Node.js (CommonJS) + Vanilla JS

**Primary Dependencies**: Express.js, mysql2/promise, Puppeteer (A4 PDF)

**Storage**: MySQL — جدول `app_settings` (عمودا `logo_width`، `logo_height` موجودان)

**Testing**: Manual validation (no test framework)

**Target Platform**: Desktop app (Electron-packaged, local Express server)

**Project Type**: Single-tenant on-premise POS desktop app

**Performance Goals**: تطبيق الأبعاد لا يؤثر على الأداء — inline style فقط

**Constraints**: RTL، Vanilla JS فقط (لا import/export)، الصور مخزنة كـ BLOB مضغوط

**Scale/Scope**: 6 شاشات تحتاج تعديل

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| 4-Step API Checklist | N/A | لا يوجد API جديد — البيانات موجودة بالفعل |
| MySQL-Only Data Layer | Pass | لا migration جديد مطلوب |
| Bilingual Arabic-First | N/A | لا i18n جديد |
| Vanilla JS (no modules) | Pass | Inline styles فقط |
| Image storage as BLOB | Pass | لا تغيير في طريقة التخزين |
| Uniform Response Contract | N/A | لا API جديد |

## Project Structure

### Documentation (this feature)

```text
specs/019-logo-size-print-settings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md  (يُنشأ بـ /speckit-tasks)
```

### Source Code — Affected Files

```text
screens/pos/pos.js
screens/invoices/invoices.js
screens/credit-invoices/credit-invoices.js
screens/consumption-receipts/consumption-receipts.js
screens/hangers/hangers.js
screens/reports/all-invoices-report/all-invoices-report.js

# لا تغيير في:
database/db.js            (موجود بالفعل)
server/invokeHandlers.js  (موجود بالفعل)
assets/web-api.js         (موجود بالفعل)
screens/settings/         (موجود بالفعل)
```

## Implementation Approach

### Pattern A: DOM Elements

عند استدعاء `getSettings` وتعيين `logo.src`:

```js
logo.src = s.logoDataUrl;
logo.style.width  = (s.logoWidth  || 180) + 'px';
logo.style.height = (s.logoHeight || 70)  + 'px';
logo.style.objectFit = 'contain';
```

### Pattern B: HTML String Generation (للطباعة الديناميكية)

```html
<img class="inv-logo" src="${logoDataUrl}"
     style="width:${logoWidth||180}px;height:${logoHeight||70}px;object-fit:contain">
```

## Phase Details

### Phase 1: POS Screen
- **الملف**: `screens/pos/pos.js`
- كل مكان يُعيَّن فيه `logo.src` أو `invLogo.src` → Pattern A
- HTML strings للطباعة الحرارية/A4 → Pattern B

### Phase 2: Invoices Screen
- **الملف**: `screens/invoices/invoices.js`
- السطر 242، 824 → Pattern A
- HTML strings (سطر 1124 ومشابهاته) → Pattern B

### Phase 3: Credit Invoices Screen
- **الملف**: `screens/credit-invoices/credit-invoices.js`
- نفس نهج invoices

### Phase 4: Consumption Receipts Screen
- **الملف**: `screens/consumption-receipts/consumption-receipts.js`
- السطر 191 → Pattern A

### Phase 5: Hangers Screen
- **الملف**: `screens/hangers/hangers.js`
- Pattern A أو B حسب آلية الطباعة

### Phase 6: All-Invoices Report
- **الملف**: `screens/reports/all-invoices-report/all-invoices-report.js`
- Pattern A أو B حسب آلية الطباعة

## Complexity Tracking

لا توجد انتهاكات — التغييرات بسيطة وموضعية في 6 ملفات JS.
