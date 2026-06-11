# Tasks: تقرير هيئة الزكاة

**Input**: Design documents from `/specs/002-zakat-report/`

**Organization**: Tasks grouped by user story for independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: إنشاء مجلد الشاشة الجديدة

- [ ] T001 Create screen directory `screens/reports/zakat-report/` with empty files: `zakat-report.html`, `zakat-report.js`, `zakat-report.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: الطبقة الخلفية وتسجيل الـ API — يجب اكتمالها قبل أي عمل في الواجهة

**⚠️ CRITICAL**: لا يمكن البدء في الواجهة قبل اكتمال هذه المرحلة

- [ ] T002 Add `getZakatReport({ dateFrom, dateTo })` function to `database/db.js` — runs 3 parameterized queries (orders JOIN customers, credit_notes JOIN customers, expenses) filtered by date range; computes summary object `{ ordersSubtotal, ordersVat, ordersTotal, creditNotesSubtotal, creditNotesVat, creditNotesTotal, expensesTotal, netTotal }`; returns `{ orders, creditNotes, expenses, summary }`
- [ ] T003 Add `case 'getZakatReport'` handler in `server/invokeHandlers.js` — validates `dateFrom` and `dateTo` present, calls `db.getZakatReport`, returns `{ success: true, ...result }`
- [ ] T004 Register `getZakatReport: (payload) => invoke('getZakatReport', payload)` in `assets/web-api.js` under `window.api`
- [ ] T005 [P] Add i18n keys to `assets/i18n.js` for both `ar` and `en`: `zakat-report-title`, `zakat-report-date-from`, `zakat-report-date-to`, `zakat-report-btn-view`, `zakat-report-orders-section`, `zakat-report-cn-section`, `zakat-report-exp-section`, `zakat-report-summary`, `zakat-report-net`, `reports-card-zakat-title`, `reports-card-zakat-desc`

**Checkpoint**: Foundation ready — واجهة التقرير يمكن بناؤها الآن

---

## Phase 3: User Story 1 — عرض تقرير الفترة الضريبية (Priority: P1) 🎯 MVP

**Goal**: المستخدم يختار فترة ويرى التقرير الكامل بثلاثة أقسام وملخص

**Independent Test**: حدد فترة تحتوي بيانات معروفة وتحقق أن الأرقام تطابق بيانات قاعدة البيانات مباشرةً

### Implementation for User Story 1

- [ ] T006 [US1] Build `screens/reports/zakat-report/zakat-report.html` — RTL page with `lang="ar" dir="rtl"`, header bar with back button and print button, two `input[type="date"]` fields (filterDateFrom, filterDateTo), btn "عرض التقرير", three section divs (#ordersSection, #creditNotesSection, #expensesSection), summary section (#summarySection) with four rows, loading state div
- [ ] T007 [US1] Build `screens/reports/zakat-report/zakat-report.js` — initialize date inputs to current month start/end; validate inputs on submit (both required, dateTo ≥ dateFrom); call `window.api.getZakatReport`; render orders table with columns: رقم الفاتورة / التاريخ / العميل / قبل الضريبة / الضريبة / الإجمالي / الحالة; render credit notes table with: رقم الإشعار / التاريخ / العميل / قبل الضريبة / الضريبة / الإجمالي; render expenses table with: التاريخ / البيان / الفئة / المبلغ; render 4-row summary using `sarHtml()` and `.sar` class; display netTotal in red if negative
- [ ] T008 [US1] Build `screens/reports/zakat-report/zakat-report.css` — import base styles, section headers styling, summary table 4-row layout, negative-value red class, print media query hiding back/view buttons

**Checkpoint**: تقرير هيئة الزكاة يعمل كاملاً كشاشة مستقلة

---

## Phase 4: User Story 2 — مراجعة تفاصيل كل قسم (Priority: P2)

**Goal**: جداول كل قسم تعرض جميع الحقول المطلوبة بوضوح

**Independent Test**: تحقق من ظهور كل عمود في كل جدول وأن البيانات صحيحة لكل صف

### Implementation for User Story 2

- [ ] T009 [US2] Update orders table in `screens/reports/zakat-report/zakat-report.js` — ensure `payment_status` column shows Arabic label (مدفوع/آجل/جزئي) using same `paymentLabel()` pattern from `period-report.js`; format dates using `formatDate()`; all monetary amounts use `sarHtml(fmtLtr(n))`
- [ ] T010 [US2] Update credit notes table in `screens/reports/zakat-report/zakat-report.js` — ensure `credit_note_seq` shown as display number, fallback to `credit_note_number`; all monetary amounts formatted correctly
- [ ] T011 [US2] Update expenses table in `screens/reports/zakat-report/zakat-report.js` — show `category` column; format `expense_date` (DATE string, no time); amount formatted with `sarHtml()`

**Checkpoint**: جميع أقسام التقرير تعرض بيانات كاملة ومنسقة

---

## Phase 5: User Story 3 — قراءة الملخص المالي (Priority: P3)

**Goal**: ملخص أسفل التقرير بأربعة سطور واضحة مع الصافي الصحيح

**Independent Test**: احسب المجاميع يدوياً من SQL وقارنها مع ما يعرضه الملخص

### Implementation for User Story 3

- [ ] T012 [US3] Verify summary section in `screens/reports/zakat-report/zakat-report.js` — row 1: ordersSubtotal + ordersVat + ordersTotal; row 2: creditNotesSubtotal + creditNotesVat + creditNotesTotal; row 3: expensesTotal (colspan full); row 4 (Net): netTotal with red styling if < 0; all values use `sarHtml(fmtLtr(n))`
- [ ] T013 [US3] Add empty-state handling in `screens/reports/zakat-report/zakat-report.js` — show "لا توجد بيانات" message within each section if its array is empty; summary still shows zeroes

**Checkpoint**: الملخص يعرض الأرقام الصحيحة في جميع الحالات

---

## Phase 6: Navigation & Polish

**Purpose**: ربط التقرير بشاشة التقارير الرئيسية وتحسينات عامة

- [ ] T014 Add `report-card` for Zakat report in `screens/reports/reports.html` — card id `cardZakatReport`, green gradient icon (مثل مربع مع علامة صح), title and desc using i18n keys `reports-card-zakat-title` / `reports-card-zakat-desc`
- [ ] T015 Add click handler in `screens/reports/reports.js` — `cardZakatReport.addEventListener('click', () => window.api.navigateTo('/screens/reports/zakat-report/zakat-report.html'))`
- [ ] T016 [P] Add print support in `screens/reports/zakat-report/zakat-report.js` — call `window.print()` on btnPrint click; `window.I18N.enableArabicPrint()` on DOMContentLoaded
- [ ] T017 [P] Validate input errors in `screens/reports/zakat-report/zakat-report.js` — show toast error if dateFrom/dateTo empty; show toast error if dateTo < dateFrom (same pattern as other report screens)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: ابدأ فوراً
- **Phase 2 (Foundational)**: يعتمد على Phase 1 — يحجب جميع مراحل الواجهة
- **Phase 3 (US1)**: يعتمد على Phase 2
- **Phase 4 (US2)**: يعتمد على Phase 3 (تحسين نفس الجداول)
- **Phase 5 (US3)**: يعتمد على Phase 3 (تحسين نفس الملخص)
- **Phase 6 (Polish)**: يعتمد على Phase 3

### Parallel Opportunities

- T005 (i18n) يمكن عمله بالتوازي مع T002-T004
- T009, T010, T011 يمكن عملها بالتوازي (ملفات مختلفة من نفس الدالة بعد T007)
- T016, T017 يمكن عملها بالتوازي

---

## Implementation Strategy

### MVP (User Story 1 فقط)

1. Phase 1 → Phase 2 (T001–T005)
2. Phase 3 (T006–T008)
3. **توقف وتحقق**: تقرير يعمل كاملاً من شاشة مستقلة
4. Phase 6 (T014–T015) لربطه بشاشة التقارير

### الاكتمال الكامل

1. MVP أولاً
2. Phase 4 (T009–T011) — تحسين جداول التفاصيل
3. Phase 5 (T012–T013) — التحقق من الملخص والحالات الحدية
4. T016–T017 — الطباعة والتحقق من المدخلات

---

## Notes

- [P] = يمكن تنفيذه بالتوازي مع مهام أخرى (ملفات مختلفة)
- [USx] = ينتمي لقصة المستخدم المقابلة
- كل مبلغ مالي يستخدم `sarHtml(fmtLtr(n))` + كلاس `.sar`
- استعمل `escHtml()` لكل نص من المستخدم في innerHTML
- جميع queries باستخدام parameterized statements (لا string concatenation)
