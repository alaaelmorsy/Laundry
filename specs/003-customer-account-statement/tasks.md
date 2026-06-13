# Tasks: كشف حساب العميل التفصيلي

**Input**: Design documents from `specs/003-customer-account-statement/`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (الملفات الأساسية للشاشة)

**Purpose**: إنشاء هيكل الشاشة الجديدة وربطها بقائمة التقارير

- [X] T001 إنشاء مجلد `screens/reports/customer-account-report/` وملفاته الثلاثة الفارغة: `customer-account-report.html`, `customer-account-report.js`, `customer-account-report.css`
- [X] T002 إضافة بطاقة "كشف حساب العميل" في `screens/reports/reports.html` بنفس نمط بطاقات التقارير الحالية (gradient بني/برتقالي مميز)
- [X] T003 إضافة مدخل البطاقة في مصفوفة `REPORT_CARDS` في `screens/reports/reports.js` مع permission key `report_customer_account`

**Checkpoint**: تظهر بطاقة "كشف حساب العميل" في شاشة التقارير وتنتقل للصفحة الجديدة عند الضغط عليها

---

## Phase 2: Foundational (دالة قاعدة البيانات — تعتمد عليها جميع القصص)

**Purpose**: دالة `getCustomerAccountStatement()` هي اللبنة الأساسية التي تبني عليها كل user stories — لا شيء يعمل بدونها

**⚠️ CRITICAL**: لا يمكن البدء في أي user story قبل اكتمال هذه المرحلة

- [X] T004 كتابة دالة `getCustomerAccountStatement(customerId, dateFrom, dateTo)` في `database/db.js` — الاستعلام الرئيسي بـ `UNION ALL` لجمع 7 أنواع الحركات من الجداول: `orders` (فواتير مدفوعة)، `orders` (فواتير آجلة)، `invoice_payments` (سداد آجل بما فيه `notes` كمرجع السداد)، `orders` (اشتراكات إنشاء/تجديد)، `consumption_receipts` (إيصالات استهلاك)، `consumption_receipts` (مرتجع إيصال حيث `is_refunded=1`)، `credit_notes` (فواتير دائنة) — مرتبة تصاعدياً بالتاريخ
- [X] T005 إضافة استعلام الرصيد السابق داخل نفس الدالة: `SUM(debit - credit)` لكل حركات العميل قبل `dateFrom` باستخدام نفس منطق الـ UNION — يُعاد كحقل `priorBalance` في نتيجة الدالة
- [X] T006 إضافة استعلام ملخص الاشتراك داخل نفس الدالة: جلب جميع فترات الاشتراك للعميل من `subscription_periods` مع `customer_subscriptions` — يُعاد كمصفوفة `subscriptionPeriods` تشمل: تاريخ البدء، الانتهاء، الحالة، القيمة الإجمالية، الاستهلاك، الرصيد المتبقي
- [X] T007 تصدير `getCustomerAccountStatement` في `module.exports` بأسفل `database/db.js`
- [X] T008 إضافة `case 'getCustomerAccountStatement':` في `server/invokeHandlers.js` يقرأ `customerId, dateFrom, dateTo` من `payload` ويُعيد `{ success: true, movements, priorBalance, subscriptionPeriods, summary }` — ملف البيانات المعادة: الحركات + الرصيد السابق + ملخص الاشتراكات + ملخص الإجماليات
- [X] T009 تسجيل `getCustomerAccountStatement: (data) => invoke('getCustomerAccountStatement', data)` في `assets/web-api.js` تحت `window.api`

**Checkpoint**: يمكن استدعاء `window.api.getCustomerAccountStatement(...)` من console المتصفح والحصول على بيانات صحيحة

---

## Phase 3: User Story 1 — عرض كشف الحساب الكامل (Priority: P1) 🎯 MVP

**Goal**: عرض شاشة تفاعلية كاملة تُظهر جميع حركات العميل مع الرصيد التراكمي والرصيد السابق والملخص الإجمالي وملخص الاشتراك

**Independent Test**: اختر عميلاً لديه فواتير مدفوعة وآجلة واشتراك وإيصالات. اضغط "عرض". تحقق من ظهور جميع 7 أنواع الحركات مرتبةً بالتاريخ، صحة الرصيد التراكمي في كل سطر، صحة الرصيد السابق في الملخص، وظهور قسم ملخص الاشتراك.

### Implementation for User Story 1

- [X] T010 [US1] كتابة HTML الكامل لشاشة `screens/reports/customer-account-report/customer-account-report.html`:
  - ترويسة الصفحة: زر رجوع + عنوان "كشف حساب العميل"
  - شريط الفلاتر: حقل بحث العميل (اسم/جوال) + تاريخ من/إلى (افتراضي آخر 30 يوم) + زر "عرض"
  - بطاقة الملخص الإجمالي: الرصيد السابق، إجمالي المدين، إجمالي الدائن، المديونية الحالية، الرصيد الختامي
  - قسم ملخص الاشتراك (يظهر فقط إذا كان للعميل اشتراك): جدول فترات الاشتراك
  - جدول الحركات التفصيلي بأعمدة: التاريخ، رقم المستند، مرجع السداد، نوع الحركة، الوصف، المدين، الدائن، الرصيد
  - حالات: loadingState، emptyPrompt، reportContent
  - تحميل: `web-api.js`, `auth-guard.js`, `i18n.js`, `customer-account-report.js`
  - `lang="ar" dir="rtl"`, `data-i18n` على كل النصوص

- [X] T011 [US1] كتابة `screens/reports/customer-account-report/customer-account-report.css`:
  - تنسيق بطاقة الملخص (grid أو flex لعرض 5 قيم بجانب بعض)
  - ألوان: الرصيد الختامي الموجب = `#ef4444` (أحمر)، الصفر أو السالب = `#10b981` (أخضر)
  - تنسيق جدول الحركات: صفوف متناوبة، أعمدة المبالغ لليسار (LTR للأرقام)
  - تنسيق قسم ملخص الاشتراك (border مميز لونه مختلف)
  - تنسيق شريط الفلاتر متوافق مع desktop

- [X] T012 [US1] كتابة منطق البحث في `screens/reports/customer-account-report/customer-account-report.js`:
  - debounce 300ms على حقل البحث
  - استدعاء `window.api.getAllCustomers({ search, noPagination: true })` لجلب مقترحات العملاء
  - قائمة dropdown تظهر أسفل حقل البحث عند الكتابة وتختفي عند الاختيار
  - عند اختيار عميل: تخزين `selectedCustomerId` وعرض اسمه في الحقل

- [X] T013 [US1] كتابة دالة `loadReport()` في `customer-account-report.js`:
  - التحقق من اختيار عميل وتحديد نطاق تاريخ صحيح قبل الإرسال
  - استدعاء `window.api.getCustomerAccountStatement({ customerId, dateFrom, dateTo })`
  - عرض `loadingState` أثناء الانتظار
  - عند النجاح: إخفاء loading وعرض `reportContent`
  - عند الفشل أو عدم وجود حركات: عرض `emptyPrompt` برسالة واضحة

- [X] T014 [US1] كتابة دالة `renderSummary(data)` في `customer-account-report.js`:
  - عرض الرصيد السابق من `data.priorBalance`
  - حساب وعرض إجمالي المدين وإجمالي الدائن من الحركات
  - حساب الرصيد الختامي = priorBalance + مجموع المدين − مجموع الدائن
  - تطبيق اللون الأحمر/الأخضر على الرصيد الختامي
  - استخدام `<span class="sar">&#xE900;</span>` لرمز الريال

- [X] T015 [US1] كتابة دالة `renderMovementsTable(movements)` في `customer-account-report.js`:
  - حساب الرصيد التراكمي بعد كل حركة (يبدأ من `priorBalance`)
  - رسم الجدول بـ `innerHTML` مع template literals
  - ترميز نوع الحركة بشارة ملونة: فاتورة مدفوعة (أخضر)، آجلة (برتقالي)، سداد آجل (أزرق)، اشتراك (بنفسجي)، إيصال (رمادي)، مرتجع (أحمر فاتح)
  - خلايا المبالغ: `dir="ltr"` مع رمز الريال
  - عمود مرجع السداد: يُعرض النص أو `—` إذا فارغ
  - عرض `—` في خلية المدين إذا صفر، وكذلك الدائن

- [X] T016 [US1] كتابة دالة `renderSubscriptionSummary(periods)` في `customer-account-report.js`:
  - إخفاء قسم ملخص الاشتراك كلياً إذا كانت `periods` فارغة
  - جدول يعرض لكل فترة: تاريخ البدء، تاريخ الانتهاء، الحالة (نشط/منتهٍ بشارة ملونة)، القيمة الإجمالية، إجمالي الاستهلاك، الرصيد المتبقي

**Checkpoint**: الشاشة تعمل بالكامل — بحث عميل، اختيار، عرض تقرير بجميع الحركات، ملخص صحيح، رصيد تراكمي صحيح

---

## Phase 4: User Story 2 — طباعة PDF وتصدير Excel (Priority: P2)

**Goal**: زري "طباعة PDF" و"تصدير Excel" يُنتجان وثائق احترافية تشمل ترويسة المنشأة وبيانات العميل والرصيد السابق وملخص الاشتراك والجدول التفصيلي

**Independent Test**: اطبع كشف حساب عميل. تحقق من وجود شعار المنشأة والرقم الضريبي وبيانات العميل وملخص الاشتراك والجدول التفصيلي بأعمدة صحيحة وRTL وRiyal symbol صحيح. صدّر Excel وافتحه: تحقق من ورقتين، صحة الأرقام، وجود عمود مرجع السداد.

### Implementation for User Story 2

- [X] T017 [P] [US2] إضافة زري "طباعة PDF" و"تصدير Excel" في HTML لشاشة `customer-account-report.html` (في شريط الفلاتر بجانب زر "عرض") — مخفيَّان حتى يتم تحميل بيانات التقرير

- [X] T018 [US2] كتابة دالة `buildPdfHtml(data, customerInfo, settings)` في `customer-account-report.js`:
  - ترويسة بها: شعار المنشأة (Base64 من `settings.logoGzipBuffer`)، اسم المنشأة، الرقم الضريبي للمنشأة، اسم العميل ورقمه الضريبي (إن وجد) ورقم جواله ونوعه، نطاق التاريخ، تاريخ إنشاء التقرير
  - بطاقة ملخص تشمل الرصيد السابق وإجمالي المدين والدائن والرصيد الختامي
  - جدول ملخص الاشتراك (إن وجد)
  - جدول الحركات كاملاً مع `thead` يتكرر في كل صفحة (`<thead>` + CSS `thead { display: table-header-group }`)
  - كل النصوص RTL، الأرقام LTR، رمز الريال بـ `font-family: SaudiRiyal`
  - CSS `@page { size: A4; margin: 15mm; }`

- [X] T019 [US2] إضافة API method لجلب بيانات المنشأة: التحقق أن `getAppSettings` مسجّل في `web-api.js` — إذا لم يكن موجوداً أضفه (دالته موجودة بالفعل في `db.js`)

- [X] T020 [US2] كتابة معالج حدث زر "طباعة PDF" في `customer-account-report.js`:
  - جلب `settings` من `window.api.getAppSettings()`
  - بناء HTML الكامل بـ `buildPdfHtml()`
  - إرساله عبر `window.api.generatePdf({ html, filename })` أو فتح نافذة print مع الـ HTML
  - عرض toast "جاري إنشاء الملف..." أثناء الانتظار

- [X] T021 [US2] كتابة دالة `exportToExcel(data, customerInfo)` في `customer-account-report.js`:
  - بناء مصفوفة الصفوف للجدول التفصيلي: التاريخ، رقم المستند، مرجع السداد، نوع الحركة، الوصف، المدين، الدائن، الرصيد التراكمي
  - بناء مصفوفة ثانية لملخص الاشتراك (إن وجد)
  - استدعاء `window.api.exportExcel({ sheets: [{ name: 'كشف الحساب', rows }, { name: 'ملخص الاشتراك', rows }], filename })` — أو بناؤه client-side إذا توفر `xlsx` library في الـ assets

**Checkpoint**: زر PDF ينتج ملف مقروء بالكامل RTL مع رمز الريال الصحيح وترويسة المنشأة. زر Excel ينتج `.xlsx` يُفتح مباشرة بورقتين.

---

## Phase 5: User Story 3 — تصفية الحركات حسب النوع (Priority: P3)

**Goal**: dropdown فلتر نوع الحركة يُعيد رسم الجدول بالحركات المطابقة فقط مع تحديث الرصيد الختامي وإبقاء الرصيد السابق ثابتاً

**Independent Test**: افتح تقرير عميل به كل أنواع الحركات. اختر "فواتير آجلة فقط". تحقق من اختفاء كل الحركات الأخرى وتحديث الرصيد الختامي. ارجع لـ "الكل" وتحقق من عودة كل الحركات.

### Implementation for User Story 3

- [X] T022 [P] [US3] إضافة `<select id="filterMovementType">` في `customer-account-report.html` بجانب فلتري التاريخ، يحتوي خيارات: الكل، فاتورة مدفوعة، فاتورة آجلة، سداد آجل، اشتراك إنشاء/تجديد، إيصال استهلاك، مرتجع إيصال، فاتورة دائنة

- [X] T023 [US3] كتابة دالة `applyTypeFilter(type)` في `customer-account-report.js`:
  - إذا كان `type === 'all'`: استخدام `allMovements` الأصلية
  - غير ذلك: تصفية `allMovements` بـ `filter(m => m.movement_type === type)`
  - إعادة حساب الرصيد التراكمي للحركات المُصفَّاة ابتداءً من `priorBalance` (الرصيد السابق يبقى ثابتاً بغض النظر عن الفلتر)
  - إعادة رسم الجدول بـ `renderMovementsTable(filtered)`
  - تحديث بطاقة الملخص بإجمالي المدين/الدائن للحركات المُصفَّاة مع إبقاء الرصيد السابق كما هو

- [X] T024 [US3] ربط حدث `change` على `filterMovementType` يستدعي `applyTypeFilter()` في `customer-account-report.js` — التصفية تعمل على البيانات المحلية بدون إعادة طلب من السيرفر

**Checkpoint**: الفلتر يعمل فورياً client-side بدون تأخير، الرصيد السابق لا يتغير عند التصفية، الرصيد الختامي يتحدث بشكل صحيح

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: تحسينات تشمل جميع القصص معاً

- [X] T025 [P] إضافة i18n keys لجميع النصوص الجديدة في `assets/i18n.js` (أو الملف المعادل): `customer-account-report-title`, `customer-account-prior-balance`, `customer-account-closing-balance`, `customer-account-debt`, `customer-account-no-debt`, `customer-account-subscription-summary`, وكل أنواع الحركات السبعة
- [X] T026 [P] إضافة permission `report_customer_account` في جدول الصلاحيات وواجهة إدارة الأدوار في `screens/roles/` (إضافة checkbox جديد بجانب باقي صلاحيات التقارير)
- [ ] T027 التحقق من عمل التقرير مع عميل حقيقي فيه بيانات متنوعة: التحقق من صحة الرصيد التراكمي يدوياً، صحة الرصيد السابق، ظهور ملخص الاشتراك، عمل الـ PDF والـ Excel
- [ ] T028 التحقق من عمل الشاشة على دقة 1366×768 (الحد الأدنى للـ desktop) — لا overflow أفقي في الجدول

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: يبدأ فوراً — لا اعتمادية
- **Phase 2 (Foundational)**: يبدأ بعد Phase 1 — **يحجب جميع User Stories**
- **Phase 3 (US1)**: يبدأ بعد Phase 2 كاملاً — 🎯 MVP
- **Phase 4 (US2)**: يبدأ بعد Phase 3 كاملاً (يعتمد على `renderMovementsTable` و`renderSubscriptionSummary`)
- **Phase 5 (US3)**: يبدأ بعد Phase 3 كاملاً (يعتمد على `allMovements` المُخزَّنة)
- **Phase 6 (Polish)**: يبدأ بعد اكتمال US1 على الأقل

### User Story Dependencies

- **US1 (P1)**: اعتماد على Phase 2 فقط — اللبنة الأساسية
- **US2 (P2)**: اعتماد على US1 (يستخدم `renderMovementsTable`, `renderSubscriptionSummary`, `buildPdfHtml`)
- **US3 (P3)**: اعتماد على US1 (يستخدم `allMovements` المُخزَّنة، يستدعي `renderMovementsTable`)

### Parallel Opportunities Within US1

```
T010 [HTML]  ──┐
T011 [CSS]   ──┤──> T012 [Search] ──> T013 [loadReport] ──> T014+T015+T016
               │                                           (يمكن توازيها بعد T013)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. أكمل Phase 1 (T001–T003) — إنشاء الملفات وإضافة البطاقة
2. أكمل Phase 2 (T004–T009) — دالة قاعدة البيانات وتسجيلها ← **الخطوة الأصعب**
3. أكمل Phase 3 (T010–T016) — الشاشة التفاعلية الكاملة
4. **توقف وتحقق**: كشف الحساب يعمل بجميع حركاته وأرصدته ✅
5. تقدم لـ US2 (PDF/Excel) ثم US3 (فلتر)

### Incremental Delivery

1. Phase 1 + 2 + 3 → **MVP**: كشف حساب كامل على الشاشة
2. + Phase 4 → تصدير PDF وExcel احترافي
3. + Phase 5 → فلتر نوع الحركة
4. + Phase 6 → i18n كاملة، صلاحيات، اختبار نهائي

---

## Notes

- **مرجع السداد**: يُقرأ من `invoice_payments.notes` — حقل موجود بالفعل، لا يحتاج migration
- **الرصيد السابق**: يُحسب في الـ backend ويُعاد كحقل `priorBalance` — لا يحتاج input من المستخدم
- **الرصيد التراكمي**: يُحسب في الـ frontend بـ `reduce` على المصفوفة بعد إضافة `priorBalance` كنقطة بداية
- **ملخص الاشتراك**: يظهر فقط إذا كانت `subscriptionPeriods.length > 0`
- **رمز الريال**: `<span class="sar">&#xE900;</span>` في HTML، `font-family: SaudiRiyal` في PDF CSS
- **Excel**: إذا لم يكن هناك اشتراك للعميل تُضمَّن ورقة واحدة فقط في الملف
