# Implementation Plan: Fix Print Font Weight in Chrome

**Branch**: `020-fix-print-font-weight` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-fix-print-font-weight/spec.md`

## Summary

إضافة `print-color-adjust: exact` و`-webkit-print-color-adjust: exact` إلى قواعد `@media print` في جميع ملفات CSS المتعلقة بالفواتير والتقارير. هذا يمنع Chrome من تخفيف ألوان الخطوط وأوزانها أثناء الطباعة.

## Technical Context

**Language/Version**: CSS (vanilla)

**Primary Dependencies**: ملفات CSS للشاشات — لا تبعيات خارجية

**Storage**: N/A

**Testing**: اختبار بصري في معاينة طباعة Chrome

**Target Platform**: Chrome browser (desktop) على Windows

**Project Type**: تعديلات CSS فقط — لا backend، لا JS، لا DB

**Performance Goals**: لا تأثير على الأداء

**Constraints**: التعديلات داخل `@media print` فقط — لا تأثير على وضع العرض العادي

**Scale/Scope**: 10 ملفات CSS

## Constitution Check

| المبدأ | الحالة | ملاحظة |
|--------|--------|--------|
| 4-Step API Checklist | ✅ غير مطلوب | تعديل CSS فحسب |
| Screen-Per-Page Frontend | ✅ محفوظ | التعديل داخل ملفات CSS الخاصة بكل شاشة |
| MySQL-Only Data Layer | ✅ لا تأثير | |
| Bilingual Arabic-First RTL | ✅ محفوظ | لا تغيير في direction أو lang |
| No ES modules | ✅ لا JS | |

لا مخالفات.

## Project Structure

### Documentation (this feature)

```text
specs/020-fix-print-font-weight/
├── plan.md              ← هذا الملف
├── research.md          ← تحليل المشكلة والحل
├── quickstart.md        ← سيناريوهات التحقق
└── tasks.md             ← مهام التنفيذ (من /speckit-tasks)
```

### Source Code (الملفات المعدَّلة)

```text
screens/
├── invoices/invoices.css                                     ← تعديل @media print موجود
├── pos/pos.css                                               ← تعديل @media print موجود
├── consumption-receipts/consumption-receipts.css             ← تعديل @media print موجود
├── credit-invoices/credit-invoices.css                       ← تعديل @media print موجود
├── hangers/hangers.css                                       ← تعديل @media print موجود
├── reports/daily-report/daily-report.css                     ← تعديل @media print موجود
├── reports/period-report/period-report.css                   ← تعديل @media print موجود
├── reports/worker-report/worker-report.css                   ← إضافة @media print جديد
├── reports/subscriptions-report/subscriptions-report.css     ← إضافة @media print جديد
└── reports/all-invoices-report/all-invoices-report.css       ← إضافة @media print جديد
```

## Implementation Approach

### الملفات التي تحتوي على `@media print` مسبقاً (7 ملفات)

**التعديل**: إضافة هذه الأسطر في بداية كل بلوك `@media print { ... }` (بعد `{` مباشرة):

```css
html,body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color:#000 !important}
*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
```

### الملفات بدون `@media print` (3 ملفات)

**التعديل**: إضافة بلوك `@media print` في نهاية الملف:

```css
@media print{
  html,body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color:#000 !important}
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  .no-print{display:none !important}
}
```
