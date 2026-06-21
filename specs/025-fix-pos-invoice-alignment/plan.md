# Implementation Plan: إصلاح محاذاة الطباعة الحرارية — جميع الشاشات

**Branch**: `025-fix-pos-invoice-alignment` | **Date**: 2026-06-21 | **Spec**: [spec.md](spec.md)

## Summary

النصوص في الفواتير والإيصالات الحرارية (80mm) تظهر غير مُوسَّطة في 7 شاشات. السبب الجذري:
`.inv-paper` يُضبط على `width: 80mm` بدلاً من `76mm`، وبعض الشاشات لديها `@page { margin: 4mm 3mm }` بدلاً من `margin: 0`. الإصلاح: تعديل CSS فقط في 7 ملفات، لا تغيير في HTML أو JS أو قاعدة البيانات.

## Technical Context

**Language/Version**: CSS (browser print media)
**Primary Dependencies**: لا شيء — CSS فقط
**Storage**: N/A
**Testing**: معاينة الطباعة في Chrome (Print Preview)
**Target Platform**: Windows — Chrome browser print / thermal printer 80mm
**Project Type**: Desktop POS (Node.js + Vanilla JS)
**Constraints**: `width: 76mm`, `margin: 0 auto`, `padding: 2mm 3mm`، `@page { size: 80mm auto; margin: 0 }`
**Scale/Scope**: 7 ملفات CSS، تعديلات نقطية فقط

## Constitution Check

| المبدأ | التحقق |
|--------|--------|
| لا DDL / لا DB migrations | ✅ لا يوجد |
| لا تغيير في ZATCA workflow | ✅ لا يوجد |
| `.inv-paper` dimensions = `76mm / margin: 0 auto` | ✅ هذا الإصلاح يُصحّح للقيم الموثّقة في CLAUDE.md |
| 4-step API checklist | ✅ لا API جديدة |

**Gate**: ✅ جميع القواعد سليمة.

## Project Structure

### Documentation (this feature)

```text
specs/025-fix-pos-invoice-alignment/
├── plan.md              ← هذا الملف
├── spec.md
├── research.md          ← تشخيص المشكلة + جدول حالة كل شاشة
├── data-model.md        ← جدول الملفات المُتأثرة
├── quickstart.md        ← سيناريوهات التحقق
└── tasks.md             ← (يُنشأ بـ /speckit-tasks)
```

### Source Code (الملفات المُتأثرة)

```text
screens/
├── pos/pos.css                                          ← إضافة @page + تصحيح .inv-paper
├── hangers/hangers.css                                  ← إضافة @page + تصحيح .inv-paper
├── credit-invoices/credit-invoices.css                  ← إضافة @page + تصحيح .inv-paper
├── reports/daily-report/daily-report.css                ← تصحيح @page margin + .inv-paper (3 selectors)
├── reports/period-report/period-report.css              ← تصحيح @page margin + .inv-paper (3 selectors)
├── reports/worker-report/worker-report.css              ← تصحيح @page margin + .inv-paper (2 selectors)
└── reports/all-invoices-report/all-invoices-report.css  ← تصحيح @page margin + .inv-paper (3 selectors)

# ملفات صحيحة — لا تحتاج تعديل:
# screens/invoices/invoices.css ✅
# screens/consumption-receipts/consumption-receipts.css ✅
```

## خطة التنفيذ التفصيلية

### التغييرات المطلوبة لكل ملف

#### 1. `screens/pos/pos.css`
- **إضافة** `@page { size: 80mm auto; margin: 0; }` قبل `@media print`
- **تغيير** في `.inv-paper` داخل `@media print` (~line 3262):
  - `width: 80mm` → `width: 76mm`
  - `max-width: 80mm` → `max-width: 76mm`
  - `padding: 4mm` → `padding: 2mm 3mm`

#### 2. `screens/hangers/hangers.css`
- **إضافة** `@page { size: 80mm auto; margin: 0; }` قبل `@media print`
- **تغيير** في `.inv-paper` داخل `@media print` (~line 642):
  - `width: 80mm` → `width: 76mm`
  - `max-width: 80mm` → `max-width: 76mm`
  - (padding غير موجود — لا تغيير)

#### 3. `screens/credit-invoices/credit-invoices.css`
- **إضافة** `@page { size: 80mm auto; margin: 0; }` قبل `@media print`
- **تغيير** في `.inv-paper` (~line 250):
  - `width: 80mm` → `width: 76mm`
  - `max-width: 80mm` → `max-width: 76mm`
  - `padding: 4mm` → `padding: 2mm 3mm`

#### 4. `screens/reports/daily-report/daily-report.css`
- **تصحيح** `@page { margin: 4mm 3mm }` → `@page { size: 80mm auto; margin: 0; }`
- **تغيير** 3 selectors لـ `.inv-paper` (lines 330, 338, 342):
  - `width: 80mm` → `width: 76mm`
  - `max-width: 80mm` → `max-width: 76mm`
  - `padding: 4mm` → `padding: 2mm 3mm`

#### 5. `screens/reports/period-report/period-report.css`
- نفس إصلاح daily-report (lines 338, 350, 358, 362)

#### 6. `screens/reports/worker-report/worker-report.css`
- **تصحيح** `@page { margin: 4mm 3mm }` → `@page { size: 80mm auto; margin: 0; }`
- **تغيير** 2 selectors لـ `.inv-paper` (lines 392, 401)

#### 7. `screens/reports/all-invoices-report/all-invoices-report.css`
- **تصحيح** `@page { margin: 3mm 2mm }` → `@page { size: 80mm auto; margin: 0; }`
- **تغيير** 3 selectors لـ `.inv-paper` (lines 408, 417, 424)
