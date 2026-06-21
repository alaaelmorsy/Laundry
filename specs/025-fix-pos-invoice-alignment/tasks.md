# Tasks: إصلاح محاذاة الطباعة الحرارية — جميع الشاشات

**Input**: Design documents from `specs/025-fix-pos-invoice-alignment/`

**Organization**: المهام مُنظَّمة بحسب قصة المستخدم (User Story). القصة الوحيدة هي تصحيح محاذاة `.inv-paper` في جميع الشاشات.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تنفيذها بالتوازي (ملفات مختلفة، لا تبعيات)
- **[Story]**: القصة التي تنتمي لها المهمة

---

## Phase 1: Foundational (مراجعة + مرجعية)

**Purpose**: فهم النمط الصحيح من الشاشات السليمة قبل البدء بالإصلاح

**⚠️ مهم**: تأكد من النمط الصحيح أولاً ثم طبّق على الشاشات المعطوبة

- [X] T001 مراجعة `screens/invoices/invoices.css` و `screens/consumption-receipts/consumption-receipts.css` كمرجع للنمط الصحيح (`76mm`, `margin: 0`, `padding: 2mm 3mm`)

**Checkpoint**: النمط الصحيح معروف — ابدأ التطبيق

---

## Phase 2: User Story 1 — تصحيح جميع الشاشات (Priority: P1) 🎯

**Goal**: تصحيح عرض `.inv-paper` وإعدادات `@page` في كل شاشة تطبع إيصالاً حرارياً 80mm

**Independent Test**: افتح معاينة الطباعة في كل شاشة وتأكد أن النصوص مُوسّطة بدون قطع من الجانبين

### تصحيح شاشة البيع

- [X] T002 [P] [US1] في `screens/pos/pos.css`: أضف `@page { size: 80mm auto; margin: 0; }` قبل `@media print` (السطر ~3211)
- [X] T003 [P] [US1] في `screens/pos/pos.css`: غيّر `.inv-paper` داخل `@media print` (~3262): `width: 80mm → 76mm`، `max-width: 80mm → 76mm`، `padding: 4mm → 2mm 3mm`

### تصحيح شاشة الشنط

- [X] T004 [P] [US1] في `screens/hangers/hangers.css`: أضف `@page { size: 80mm auto; margin: 0; }` قبل `@media print` (~line 630)
- [X] T005 [P] [US1] في `screens/hangers/hangers.css`: غيّر `.inv-paper` داخل `@media print` (~639): `width: 80mm → 76mm`، `max-width: 80mm → 76mm`

### تصحيح شاشة الفواتير الآجلة

- [X] T006 [P] [US1] في `screens/credit-invoices/credit-invoices.css`: أضف `@page { size: 80mm auto; margin: 0; }` قبل `@media print` (~240)
- [X] T007 [P] [US1] في `screens/credit-invoices/credit-invoices.css`: غيّر `.inv-paper` داخل `@media print` (~250): `width: 80mm → 76mm`، `max-width: 80mm → 76mm`، `padding: 4mm → 2mm 3mm`

### تصحيح تقرير اليوم

- [X] T008 [P] [US1] في `screens/reports/daily-report/daily-report.css`: صحّح `@page { margin: 4mm 3mm }` إلى `@page { size: 80mm auto; margin: 0; }` (~318)
- [X] T009 [P] [US1] في `screens/reports/daily-report/daily-report.css`: غيّر **3 selectors** لـ `.inv-paper` (lines 330, 338, 342): `width: 80mm → 76mm`، `max-width: 80mm → 76mm`، `padding: 4mm → 2mm 3mm`

### تصحيح تقرير الفترة

- [X] T010 [P] [US1] في `screens/reports/period-report/period-report.css`: صحّح `@page { margin: 4mm 3mm }` إلى `@page { size: 80mm auto; margin: 0; }` (~338)
- [X] T011 [P] [US1] في `screens/reports/period-report/period-report.css`: غيّر **3 selectors** لـ `.inv-paper` (lines 350, 358, 362): `width: 80mm → 76mm`، `max-width: 80mm → 76mm`، `padding: 4mm → 2mm 3mm`

### تصحيح تقرير العمال

- [X] T012 [P] [US1] في `screens/reports/worker-report/worker-report.css`: صحّح `@page { margin: 4mm 3mm }` إلى `@page { size: 80mm auto; margin: 0; }` (~341)
- [X] T013 [P] [US1] في `screens/reports/worker-report/worker-report.css`: غيّر **2 selectors** لـ `.inv-paper` (lines 392, 401): `width: 80mm → 76mm`، `max-width: 80mm → 76mm`، `padding: 4mm → 2mm 3mm`

### تصحيح تقرير جميع الفواتير

- [X] T014 [P] [US1] في `screens/reports/all-invoices-report/all-invoices-report.css`: صحّح `@page { margin: 3mm 2mm }` إلى `@page { size: 80mm auto; margin: 0; }` (~313)
- [X] T015 [P] [US1] في `screens/reports/all-invoices-report/all-invoices-report.css`: غيّر **3 selectors** لـ `.inv-paper` (lines 408, 417, 424): `width: 80mm → 76mm`، `max-width: 80mm → 76mm`، `padding: 4mm → 2mm 3mm`

**Checkpoint**: كل شاشة الآن تستخدم `76mm` و `@page { margin: 0 }` ✅

---

## Phase 3: التحقق والاختبار

**Purpose**: التأكد من أن الإصلاح يعمل في جميع الشاشات بدون تأثيرات جانبية

- [X] T016 [US1] اختبر معاينة الطباعة في `screens/pos/` — تأكد من توسّط النصوص
- [X] T017 [US1] اختبر معاينة الطباعة في `screens/hangers/` — تأكد من توسّط النصوص
- [X] T018 [US1] اختبر معاينة الطباعة في `screens/credit-invoices/` — تأكد من توسّط النصوص
- [X] T019 [US1] اختبر معاينة الطباعة في كل تقرير (daily, period, worker, all-invoices) — تأكد من توسّط النصوص
- [X] T020 [US1] تأكد أن `screens/invoices/` و `screens/consumption-receipts/` لا تزال تعمل بدون أي تراجع

---

## Dependencies & Execution Order

- **T001**: أولاً — مراجعة مرجعية
- **T002–T015**: جميعها [P] بعد T001 — يمكن تنفيذها بالتوازي لأنها ملفات مختلفة
- **T016–T020**: بعد اكتمال T002–T015

### Parallel Opportunities

```bash
# يمكن تشغيل كل هذه المهام في وقت واحد بعد T001:
T002 + T004 + T006 + T008 + T010 + T012 + T014   # إضافة @page
T003 + T005 + T007 + T009 + T011 + T013 + T015   # تصحيح .inv-paper
```

---

## Implementation Strategy

### MVP (وهو نفسه الإصلاح الكامل)

1. T001 — مراجعة المرجع
2. T002–T015 — تطبيق الإصلاح (بالتوازي)
3. T016–T020 — تحقق

لا يوجد تدرّج هنا — جميع التغييرات بسيطة ومستقلة.

---

## Notes

- جميع التغييرات في CSS فقط — لا HTML، لا JS، لا DB
- القيم الهدف: `width: 76mm`، `max-width: 76mm`، `padding: 2mm 3mm`، `@page { size: 80mm auto; margin: 0 }`
- المرجع الصحيح: `screens/invoices/invoices.css` lines 257–267
