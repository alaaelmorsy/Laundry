# Tasks: نظام فواتير الفنادق والشركات

**Input**: Design documents from `specs/030-hotels-companies-billing/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api-methods.md ✅

**Organization**: مُنظَّمة حسب قصص المستخدم لتمكين التسليم التدريجي المستقل.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تشغيله بالتوازي مع مهام [P] أخرى في نفس المرحلة
- **[Story]**: قصة المستخدم المرتبطة (US1–US4)
- المسارات كاملة ومحددة في كل مهمة

---

## Phase 1: Setup — هيكل الشاشة الجديدة

**Purpose**: إنشاء ملفات شاشة الفنادق والشركات الجديدة (هيكل فارغ جاهز للتعبئة)

- [ ] T001 إنشاء مجلد وملفات شاشة الفنادق: `screens/hotels-companies/hotels-companies.html`، `screens/hotels-companies/hotels-companies.js`، `screens/hotels-companies/hotels-companies.css` بهيكل HTML أساسي (RTL، Cairo font، Tailwind، web-api.js script tag)
- [ ] T002 إضافة رابط "الفنادق والشركات" في الـ sidebar الموجود في `screens/` (نفس نمط الروابط الأخرى)

---

## Phase 2: Foundational — قاعدة البيانات والـ API (تحجب جميع القصص)

**Purpose**: جميع migrations وdب functions وhandlers وweb-api.js يجب أن تكتمل قبل أي عمل على الشاشات

**⚠️ CRITICAL**: لا يمكن البدء في أي قصة مستخدم قبل اكتمال هذه المرحلة

### Migrations — `database/db.js`

- [ ] T003 إضافة دالة `migrateAddConsolidatedFlag()` في `database/db.js`: `ALTER TABLE orders ADD COLUMN is_consolidated TINYINT(1) NOT NULL DEFAULT 0` مع try/catch، وتسجيلها في `db.initialize()` في مكانها الصحيح زمنياً
- [ ] T004 إضافة دالة `migrateAddWorkOrderRefOnItems()` في `database/db.js`: `ALTER TABLE order_items ADD COLUMN work_order_id INT DEFAULT NULL` مع try/catch، وتسجيلها في `db.initialize()`
- [ ] T005 إضافة دالة `migrateCreateWorkOrders()` في `database/db.js`: `CREATE TABLE IF NOT EXISTS work_orders` بجميع الأعمدة من data-model.md (id، work_order_seq، work_order_number، customer_id، subtotal، discount_amount، vat_rate، vat_amount، total_amount، price_display_mode، status، consolidated_order_id، notes، created_by، created_at) مع try/catch، وتسجيلها في `db.initialize()`
- [ ] T006 إضافة دالة `migrateCreateWorkOrderItems()` في `database/db.js`: `CREATE TABLE IF NOT EXISTS work_order_items` + جميع indexes (idx_wo_customer، idx_wo_status، idx_wo_created_at، idx_wo_consolidated، idx_woi_order) من data-model.md مع try/catch، وتسجيلها في `db.initialize()`

### DB Query Functions — `database/db.js`

- [ ] T007 إضافة دالة `createWorkOrder(data)` في `database/db.js`: transaction كاملة — `SELECT COALESCE(MAX(work_order_seq),0) FOR UPDATE` → `INSERT work_orders` → `INSERT work_order_items` (loop على items) → تُعيد `{ workOrderId, workOrderNumber, workOrderSeq, customerName, customerTaxNumber, createdAt }`
- [ ] T008 [P] إضافة دالة `getWorkOrders(filters)` في `database/db.js`: SELECT مع JOIN على `customers` + subquery لجلب items، يقبل `{ status, customerId, search, dateFrom, dateTo, page, pageSize }` — يعيد `{ rows, total, page, pageSize, totalPages }` — متوافق MySQL 5.7 (بدون window functions)
- [ ] T009 [P] إضافة دالة `cancelWorkOrder({ workOrderId })` في `database/db.js`: `UPDATE work_orders SET status='cancelled' WHERE id=? AND status='pending'` — يُعيد خطأ `NOT_PENDING` إذا لم يتأثر أي صف
- [ ] T010 [P] إضافة دالة `getWorkOrderForPrint({ workOrderId })` في `database/db.js`: SELECT work_order + items + customer في استعلام واحد
- [ ] T011 إضافة دالة `createConsolidatedInvoice(data)` في `database/db.js`: transaction كاملة — (1) SELECT work_orders FOR UPDATE والتحقق من `status='pending'` وتطابق `customer_id` (2) حساب المجاميع (3) `MAX(invoice_seq) FOR UPDATE` → invoiceSeq+1 (4) INSERT orders مع `is_consolidated=1` وجميع ZATCA columns (5) INSERT order_items منسوخة من work_order_items مع `work_order_id` (6) UPDATE work_orders SET `status='invoiced', consolidated_order_id=?` — تُعيد `{ orderId, invoiceSeq, orderNumber }`
- [ ] T012 [P] إضافة دالة `getConsolidatedInvoiceForPrint({ orderId })` في `database/db.js`: SELECT order + JOIN customers + subquery لجلب work_orders المرتبطة مع بنودها — تُعيد بنية `invoice` كاملة كما في contracts/api-methods.md
- [ ] T013 [P] إضافة دالة `getCorporateCustomers(filters)` في `database/db.js`: `SELECT customers WHERE customer_type='corporate'` + subquery لعدد الأوامر المعلقة `(SELECT COUNT(*) FROM work_orders WHERE customer_id=c.id AND status='pending') AS pendingWorkOrders` + subquery لمجموعها — يقبل `{ search, page, pageSize }`

### Handlers & API Registration

- [ ] T014 إضافة 7 cases في `server/invokeHandlers.js` داخل switch(m): `createWorkOrder`، `getWorkOrders`، `cancelWorkOrder`، `getWorkOrderForPrint`، `createConsolidatedInvoice`، `getConsolidatedInvoiceForPrint`، `getCorporateCustomers` — كل case مُغلّف بـ try/catch يُعيد `{ success: false, message }` عند الخطأ، وكودات الخطأ المحددة في contracts/api-methods.md عند الحاجة
- [ ] T015 [P] إضافة 7 methods في `assets/web-api.js`: `api.createWorkOrder = (p) => invoke('createWorkOrder', p)`، وكذلك لـ `getWorkOrders`، `cancelWorkOrder`، `getWorkOrderForPrint`، `createConsolidatedInvoice`، `getConsolidatedInvoiceForPrint`، `getCorporateCustomers`

**Checkpoint**: قاعدة البيانات وطبقة الـ API جاهزة — يمكن بدء جميع قصص المستخدم

---

## Phase 3: User Story 1 — تصنيف العميل كشركة/فندق (Priority: P1)

**Goal**: إظهار تنبيه للمستخدم عند عميل شركة بدون رقم ضريبي في شاشة العملاء

**Independent Test**: افتح شاشة العملاء → عدّل أي عميل إلى "شركة" بدون رقم ضريبي → يجب أن يظهر تنبيه أصفر أسفل حقل الرقم الضريبي قبل الحفظ وبعده

### Implementation for User Story 1

- [ ] T016 [US1] في `screens/customers/customers.js`: إضافة event listener على `inputCustomerType` — عند تغييره إلى `'corporate'`، يُظهر div تنبيه أصفر تحت `inputTaxNumber` بنص "الرقم الضريبي فارغ — ستُصدَر الفاتورة المجمعة كفاتورة ضريبية مبسطة"؛ يُخفى التنبيه عند وجود قيمة في `inputTaxNumber` أو عند تغيير النوع إلى `'individual'`
- [ ] T017 [US1] في `screens/customers/customers.html`: إضافة `<div id="vatWarning" class="...">` داخل مجموعة حقل الرقم الضريبي، مخفي افتراضياً (`display:none`)؛ وإضافة style في `screens/customers/customers.css` للتنبيه الأصفر

**Checkpoint**: US1 مكتملة — تصنيف العميل وتنبيه الرقم الضريبي يعملان

---

## Phase 4: User Story 2 — أمر التشغيل من شاشة البيع (Priority: P1)

**Goal**: عند اختيار عميل شركة في POS، يُطبع أمر تشغيل D-XXX ويُحفظ بحالة pending — لا سداد ولا ZATCA

**Independent Test**: اختر عميل شركة في POS → أضف أصناف → اضغط "طباعة أمر تشغيل" → يطبع ورقة بعنوان "أمر تشغيل" ورقم D-X → تحقق في DB: `SELECT * FROM work_orders ORDER BY id DESC LIMIT 1` يُعيد صفاً بحالة `pending`

### Implementation for User Story 2

- [ ] T018 [US2] في `screens/pos/pos.js`: إضافة دالة `isCorporateCustomer()` تُعيد `state.selectedCustomer?.customer_type === 'corporate'`؛ إضافة استدعاء لها في دالة تحديد العميل الموجودة (`selectCustomer` أو ما يعادلها) لتحديث واجهة السلة عند اختيار عميل شركة
- [ ] T019 [US2] في `screens/pos/pos.js`: إخفاء أزرار السداد (نقدي/بطاقة/آجل/مختلط) وإظهار زر "طباعة أمر تشغيل" عند `isCorporateCustomer() === true` — إخفاء هذا الزر وإظهار الأزرار العادية عند الأفراد — التغيير مقتصر على حالة العرض فقط، لا يمس دوال السداد الموجودة
- [ ] T020 [US2] في `screens/pos/pos.js`: إضافة دالة `handleWorkOrderFlow()` — تستدعي `window.api.createWorkOrder(payload)` ببيانات السلة الحالية، ثم عند النجاح تستدعي `printWorkOrderReceipt(result)` وتُفرّغ السلة
- [ ] T021 [US2] في `screens/pos/pos.js`: إضافة دالة `printWorkOrderReceipt(workOrder)` — تبني HTML بنفس نمط الفاتورة الحرارية الموجودة (inv-paper 76mm، margin:0 auto) مع تغيير العنوان إلى "أمر تشغيل" والرقم إلى D-{seq}، بدون QR Code ZATCA — تستخدم نمط printZone + afterprint القائم
- [ ] T022 [US2] في `screens/pos/pos.css` (أو قسم style داخل HTML): إضافة تنسيق خاص بـ "أمر تشغيل" إذا اختلف عن الفاتورة العادية (العنوان، الرقم)

**Checkpoint**: US2 مكتملة — أمر التشغيل يُطبع ويُحفظ من POS بدون أي تأثير على مسار الأفراد

---

## Phase 5: User Story 3 — إصدار الفاتورة المجمعة (Priority: P1)

**Goal**: المدير يختار أوامر تشغيل من شاشة الفنادق، يُدخل خصماً اختيارياً، يُصدر فاتورة مجمعة A4 مع ZATCA

**Independent Test**: أنشئ أمرَيْ تشغيل D-X وD-Y → افتح شاشة الفنادق → حددهما → اضغط "إصدار فاتورة مجمعة" → تظهر في شاشة الفواتير برقم تسلسلي طبيعي → `SELECT is_consolidated FROM orders ORDER BY id DESC LIMIT 1` يُعيد `1`

### Implementation for User Story 3

- [ ] T023 [US3] في `screens/hotels-companies/hotels-companies.html`: بناء هيكل الشاشة — header بار + حقل بحث بالاسم + جدول عملاء الشركات (الاسم، رقم الانتظار، المجموع المعلق، زر "عرض الأوامر") — بنفس أسلوب الجداول الموجودة في الشاشات الأخرى
- [ ] T024 [US3] في `screens/hotels-companies/hotels-companies.js`: دالة `loadCorporateCustomers()` تستدعي `window.api.getCorporateCustomers()` وتُعبئ جدول العملاء؛ تُشغَّل عند DOMContentLoaded وعند تغيير خانة البحث (debounce 300ms)
- [ ] T025 [US3] في `screens/hotels-companies/hotels-companies.js`: عند الضغط على "عرض الأوامر" لعميل محدد — استدعاء `window.api.getWorkOrders({ customerId, status:'pending' })` وعرض النتائج في panel/section ثانٍ بجدول أوامر مع checkboxes للتحديد + "تحديد الكل"
- [ ] T026 [US3] في `screens/hotels-companies/hotels-companies.js`: حقل الخصم (نسبة مئوية أو قيمة ثابتة) + حساب المجموع بعد الخصم مباشرة في الواجهة عند تغيير التحديد أو الخصم
- [ ] T027 [US3] في `screens/hotels-companies/hotels-companies.js`: دالة `issueConsolidatedInvoice()` — (1) التحقق من تحديد أمر واحد على الأقل (2) إذا كان `customerTaxNumber` فارغاً → عرض modal تأكيد "ستُصدَر كفاتورة مبسطة" مع زرَّي "تأكيد" و"العودة لتحديث البيانات" (3) عند التأكيد → `window.api.createConsolidatedInvoice(payload)` (4) عند النجاح → toast "تم إصدار الفاتورة" + تحديث القائمة
- [ ] T028 [US3] في `screens/hotels-companies/hotels-companies.js`: دالة `printConsolidatedInvoiceA4(orderId)` — تستدعي `window.api.getConsolidatedInvoiceForPrint({ orderId })` ثم تفتح `localStorage.setItem('a4InvoiceData', JSON.stringify(data))` + `window.open('/screens/invoice-a4/invoice-a4.html', ...)` بنفس النمط القائم في pos.js
- [ ] T029 [US3] في `screens/invoice-a4/invoice-a4.js`: إضافة section للفاتورة المجمعة — عند `data.isConsolidated === true`: إظهار "تفاصيل أوامر التشغيل" قبل الجدول الرئيسي (رقم D-XXX، التاريخ، المجموع لكل أمر)؛ إظهار اسم الشركة + الرقم الضريبي في قسم بيانات العميل؛ إخفاء هذا الـ section عند `isConsolidated !== true` (backward compatible)

**Checkpoint**: US3 مكتملة — الفاتورة المجمعة تُصدَر وتطبع A4 وترسل لـ ZATCA

---

## Phase 6: User Story 4 — التبويبات والبحث والإلغاء وإعادة الطباعة (Priority: P2)

**Goal**: شاشة الفنادق تدعم تبويبات (في الانتظار / مُفوترة / ملغية)، بحث متقدم، إلغاء الأوامر، إعادة طباعتها

**Independent Test**: أنشئ أوامر في حالات مختلفة → تحقق أن كل تبويب يعرض الأوامر الصحيحة → بحث بـ D-X يُعيد الأمر الصحيح

### Implementation for User Story 4

- [ ] T030 [US4] في `screens/hotels-companies/hotels-companies.html` و`hotels-companies.js`: إضافة ثلاثة تبويبات ("في الانتظار" / "مُفوترة" / "ملغية") فوق جدول الأوامر — عند الضغط على تبويب يُعاد تحميل الأوامر بـ `status` المقابل
- [ ] T031 [US4] في `screens/hotels-companies/hotels-companies.js`: إضافة حقل بحث ثانٍ (بعد اختيار العميل) يقبل: رقم D-XXX أو رقم فاتورة مجمعة؛ يُمرَّر كـ `search` في `getWorkOrders()` — debounce 300ms
- [ ] T032 [US4] في `screens/hotels-companies/hotels-companies.js`: إضافة فلتر تاريخ (من/إلى) يُمرَّر كـ `dateFrom`/`dateTo` في `getWorkOrders()`
- [ ] T033 [US4] في `screens/hotels-companies/hotels-companies.js`: زر "إلغاء" على كل أمر في تبويب "في الانتظار" — يعرض confirm dialog → عند التأكيد يستدعي `window.api.cancelWorkOrder({ workOrderId })` → toast نجاح + تحديث الجدول
- [ ] T034 [US4] في `screens/hotels-companies/hotels-companies.js`: زر "إعادة طباعة" على الأوامر في تبويبَي "في الانتظار" و"مُفوترة" — يستدعي `window.api.getWorkOrderForPrint({ workOrderId })` ثم يُنشئ نافذة طباعة حرارية بنفس نمط T021 (printWorkOrderReceipt)

**Checkpoint**: جميع القصص الأربع مكتملة واختُبرت بشكل مستقل

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T035 [P] في `screens/hotels-companies/hotels-companies.css`: تنسيق كامل للشاشة — تبويبات، جدول أوامر، panel التفاصيل، حقل الخصم، modal التأكيد — بنفس نمط التصميم العام للتطبيق (ألوان Tailwind، Cairo font، RTL)
- [ ] T036 [P] في `screens/hotels-companies/hotels-companies.js` و`pos.js`: إضافة رسائل خطأ عربية واضحة لجميع حالات الفشل المُعرَّفة في contracts/api-methods.md (`CUSTOMER_NOT_CORPORATE`، `SOME_NOT_PENDING`، `MIXED_CUSTOMERS`، `DISCOUNT_EXCEEDS_TOTAL`، `NEEDS_VAT_CONFIRM`)
- [ ] T037 تشغيل سيناريوهات التحقق الـ 11 من `specs/030-hotels-companies-billing/quickstart.md` والتأكد من نجاح جميعها — التحقق خصوصاً من: (1) عملاء الأفراد في POS لا يتأثرون (2) ZATCA scheduler يلتقط الفاتورة المجمعة (3) الفاتورة تظهر برقمها التسلسلي في شاشة الفواتير الرئيسية

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: تبدأ فوراً — لا تبعيات
- **Phase 2 (Foundational)**: تبدأ بعد Phase 1 — **تحجب جميع قصص المستخدم**
- **Phase 3 (US1)**: تبدأ بعد اكتمال Phase 2
- **Phase 4 (US2)**: تبدأ بعد اكتمال Phase 2 (مستقلة عن US1)
- **Phase 5 (US3)**: تبدأ بعد اكتمال Phase 2 (تحتاج شاشة hotels-companies من Phase 1)
- **Phase 6 (US4)**: تبدأ بعد اكتمال Phase 5 (تُوسّع شاشة الفنادق)
- **Phase 7 (Polish)**: بعد اكتمال جميع القصص

### User Story Dependencies

- **US1**: مستقلة — تعديل UI في شاشة العملاء فقط
- **US2**: مستقلة عن US1 — تعديل POS فقط
- **US3**: تحتاج شاشة hotels-companies (Phase 1) وجميع API methods (Phase 2)
- **US4**: تُوسّع US3 — تحتاج اكتمالها

### Parallel Opportunities داخل Phase 2

يمكن تشغيل T008–T010 و T012–T013 معاً (ملفات مختلفة في db.js — functions مستقلة):

```
T003 → T004 → T005 → T006  (migrations: sequential — ترتيب في db.initialize() مهم)
ثم بعد T006:
T007       (createWorkOrder — يعتمد على الجداول)
T008 [P]   (getWorkOrders)
T009 [P]   (cancelWorkOrder)
T010 [P]   (getWorkOrderForPrint)
T011       (createConsolidatedInvoice — أعقد function، يُبنى بعد T007-T010)
T012 [P]   (getConsolidatedInvoiceForPrint)
T013 [P]   (getCorporateCustomers)
ثم: T014 + T015 [P]  (handlers + web-api)
```

---

## Implementation Strategy

### MVP First (US2 + US3 فقط)

1. Phase 1: Setup
2. Phase 2: Foundational (كاملة)
3. Phase 4: US2 — أمر التشغيل من POS
4. Phase 5: US3 — الفاتورة المجمعة
5. **توقف وتحقق**: سيناريوهات 3–9 من quickstart.md
6. يمكن الشحن بدون US1 (التنبيه في شاشة العملاء) وبدون US4 (التبويبات المتقدمة)

### Incremental Delivery

1. Phase 1+2 → الأساس جاهز
2. + US1 → تنبيه الرقم الضريبي في شاشة العملاء
3. + US2 → أمر التشغيل من POS (قيمة فورية للكاشير)
4. + US3 → الفاتورة المجمعة (قيمة كاملة للمدير)
5. + US4 → تجربة متكاملة مع تبويبات وبحث

---

## Notes

- [P] = ملفات مختلفة، لا تبعيات داخل نفس المرحلة
- T003–T006 (migrations) يجب أن تكون sequential لضمان الترتيب في `db.initialize()`
- كل دالة في Phase 2 مستقلة — يمكن بناؤها بالتوازي بعد إنشاء الجداول
- نمط الطباعة الحرارية (T021): 76mm / margin:0 auto — لا استثناءات
- `createConsolidatedInvoice` (T011): أحرج function — transaction تضمن atomicity كاملة
- backward compatibility: `is_consolidated DEFAULT 0` و`work_order_id DEFAULT NULL` يضمنان سلامة جميع السجلات الحالية
