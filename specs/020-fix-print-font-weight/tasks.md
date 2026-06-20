# Tasks: Fix Print Font Weight in Chrome

**Input**: Design documents from `/specs/020-fix-print-font-weight/`

**Organization**: مهام مرتبة حسب قصة المستخدم. لا يوجد setup أو foundation — التعديل كله CSS فحسب.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تنفيذه بالتوازي مع غيره (ملفات مختلفة، لا تبعيات)
- **[Story]**: القصة التي تنتمي إليها المهمة

---

## Phase 1: User Story 1 — طباعة فاتورة بخط واضح (Priority: P1) 🎯 MVP

**Goal**: إضافة `print-color-adjust: exact` للملفات التي تُطبع الفواتير مباشرةً.

**Independent Test**: فتح أي فاتورة → `Ctrl+P` في Chrome → النص يظهر أسود وعريض في المعاينة.

- [x] T001 [P] [US1] في `screens/invoices/invoices.css`: أضف في بداية بلوك `@media print` السطرين: `html,body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color:#000 !important}` و`*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}`
- [x] T002 [P] [US1] في `screens/pos/pos.css`: أضف نفس السطرين في بداية بلوك `@media print`
- [x] T003 [P] [US1] في `screens/credit-invoices/credit-invoices.css`: أضف نفس السطرين في بداية بلوك `@media print`
- [x] T004 [P] [US1] في `screens/consumption-receipts/consumption-receipts.css`: أضف نفس السطرين في بداية بلوك `@media print`

**Checkpoint**: افتح فاتورة من شاشة invoices أو pos → `Ctrl+P` → النص أسود وثقيل ✓

---

## Phase 2: User Story 2 — طباعة التقارير بخط واضح (Priority: P2)

**Goal**: إضافة `print-color-adjust: exact` لجميع شاشات التقارير.

**Independent Test**: فتح أي تقرير → `Ctrl+P` → جميع البيانات والعناوين واضحة وأسود.

- [x] T005 [P] [US2] في `screens/reports/daily-report/daily-report.css`: أضف نفس السطرين في بداية بلوك `@media print`
- [x] T006 [P] [US2] في `screens/reports/period-report/period-report.css`: أضف نفس السطرين في بداية بلوك `@media print`
- [x] T007 [P] [US2] في `screens/hangers/hangers.css`: أضف نفس السطرين في بداية بلوك `@media print`
- [x] T008 [P] [US2] في `screens/reports/worker-report/worker-report.css`: أضف السطرين في بداية بلوك `@media print` الموجود
- [x] T009 [P] [US2] في `screens/reports/subscriptions-report/subscriptions-report.css`: أضف السطرين في بداية بلوك `@media print` الموجود
- [x] T010 [P] [US2] في `screens/reports/all-invoices-report/all-invoices-report.css`: الملف يحتوي بالفعل على `print-color-adjust:exact` — لا تعديل مطلوب

**Checkpoint**: افتح أي تقرير → `Ctrl+P` → النص أسود وثقيل ✓

---

## Phase 3: Polish & Verification

**Purpose**: التحقق الشامل من جميع الشاشات وضمان عدم تأثر وضع العرض العادي.

- [x] T011 تحقق بصري من شاشة invoices في وضع العرض العادي (الشاشة) — لا تغيير مرئي مقارنة بالحالة السابقة
- [ ] T012 [P] تحقق من معاينة طباعة Chrome لـ 3 شاشات مختلفة: invoices، daily-report، worker-report — النص أسود وعريض في الجميع
- [ ] T013 [P] تحقق من أن طباعة فاتورة A4 (invtype-a4 في pos.css) تظهر بخط واضح

---

## Dependencies & Execution Order

- **Phase 1 (US1)**: يبدأ فوراً — لا تبعيات. جميع مهامه [P] تعمل بالتوازي.
- **Phase 2 (US2)**: مستقل عن Phase 1 ويمكن تنفيذه بالتوازي معه.
- **Phase 3**: يبدأ بعد إكمال Phase 1 و Phase 2.

### Parallel Execution

```
# Phase 1 و Phase 2 يعملان معاً بالكامل في نفس الوقت:
T001 + T002 + T003 + T004  (US1 — invoices/pos/credit/consumption)
T005 + T006 + T007 + T008 + T009 + T010  (US2 — all reports)
```

---

## Implementation Strategy

### MVP (Phase 1 فقط)

1. نفّذ T001–T004 (ملفات الفواتير)
2. اختبر فاتورة واحدة في Chrome
3. إذا نجح: أكمل Phase 2

### الـ CSS المضاف في بداية كل `@media print` موجود

```css
html,body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color:#000 !important}
*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
```

### الـ CSS للملفات التي ليس فيها `@media print` (T008، T009، T010)

```css
@media print{
  html,body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color:#000 !important}
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  .no-print{display:none !important}
}
```
