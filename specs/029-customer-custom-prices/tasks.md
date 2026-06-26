# Tasks: أسعار مخصصة للعميل

**Feature**: `029-customer-custom-prices`
**Input**: [plan.md](plan.md) · [spec.md](spec.md) · [data-model.md](data-model.md) · [contracts/api-methods.md](contracts/api-methods.md)

## Format: `[ID] [P?] [Story?] Description — file`

- **[P]**: قابل للتنفيذ بالتوازي (ملفات مختلفة، بدون تبعيات)
- **[US#]**: القصة التي تنتمي إليها المهمة

---

## Phase 1: Setup — ملفات الشاشة الجديدة

**Purpose**: إنشاء الملفات الأساسية للشاشة الجديدة

- [X] T001 [P] إنشاء `screens/customer-custom-prices/customer-custom-prices.html` — ملف فارغ بـ boilerplate HTML (lang=ar, dir=rtl, script tags)
- [X] T002 [P] إنشاء `screens/customer-custom-prices/customer-custom-prices.js` — ملف فارغ بـ IIFE wrapper
- [X] T003 [P] إنشاء `screens/customer-custom-prices/customer-custom-prices.css` — ملف فارغ

---

## Phase 2: Foundational — Database & API (يجب اكتمالها قبل أي قصة)

**Purpose**: البنية التحتية التي تعتمد عليها كل القصص

⚠️ **CRITICAL**: لا تبدأ أي قصة قبل اكتمال هذه المرحلة

- [X] T004 إضافة migration إنشاء جدول `customer_custom_prices` داخل `db.initialize()` في `database/db.js` (CREATE TABLE IF NOT EXISTS + UNIQUE KEY + 3 FKs CASCADE + 2 indexes + try/catch)
- [X] T005 إضافة دالة `getCustomPricesScreenData(customerId)` في `database/db.js` (JOIN: products × product_price_lines × laundry_services LEFT JOIN customer_custom_prices، تجميع في JS، إرجاع products array + summary)
- [X] T006 إضافة دالة `saveCustomerCustomPrices(customerId, changes, deletes, userId)` في `database/db.js` (transaction + upsert INSERT ON DUPLICATE KEY UPDATE + delete loop + validation أن كل productId/serviceId موجود في product_price_lines)
- [X] T007 إضافة دالة `getCustomerPosCustomPrices(customerId)` في `database/db.js` (SELECT من customer_custom_prices، إرجاع object بمفاتيح "productId:serviceId")
- [X] T008 إضافة 3 cases في `server/invokeHandlers.js`: `getCustomPricesScreenData`، `saveCustomerCustomPrices`، `getCustomerPosCustomPrices` (كل case مع try/catch وإرجاع `{ success: false, message }` عند الخطأ)
- [X] T009 إضافة 3 methods في `assets/web-api.js`: `api.getCustomPricesScreenData`، `api.saveCustomerCustomPrices`، `api.getCustomerPosCustomPrices`

**Checkpoint ✅**: قاعدة البيانات جاهزة + API يعمل — يمكن البدء في القصص

---

## Phase 3: US1 — تعيين وحفظ سعر خاص (Priority: P1) 🎯 MVP

**Goal**: المدير يختار عميلاً، يتصفح الأصناف، يدخل أسعاراً خاصة، ويحفظها.

**Independent Test**: اختيار عميل → اختيار صنف → إدخال سعر → حفظ → التحقق من السجل في `customer_custom_prices`

### HTML Structure

- [X] T010 [US1] بناء هيكل `customer-custom-prices.html`: header (زرار رجوع + عنوان + dropdown العميل + زرار حفظ) + منطقة summary cards + split layout (master panel يمين + detail panel يسار) — يجب تضمين `<script src="/assets/auth-guard.js">` و`data-permission="customer_custom_prices"` على `<body>` في `screens/customer-custom-prices/customer-custom-prices.html` (M1: صلاحية الشاشة محمية)

### CSS Layout & Visual Rules

- [X] T011 [US1] كتابة CSS للشاشة في `screens/customer-custom-prices/customer-custom-prices.css`:
  - Split layout: يمين 240px قائمة أصناف + يسار flex-1 تفاصيل
  - Summary cards: grid 3 أعمدة
  - Sidebar item: اسم + badge عدد المخصصة + نقطة خضراء (`.dot-indicator`)
  - جدول الخدمات: 5 أعمدة (خدمة / سعر عام / سعر خاص / فرق / مسح)
  - حالات الحقل: `.price-input` + `.saving` (أخضر) + `.higher` (برتقالي) + `.zero` (أحمر) + `.dirty` (shadow أزرق)
  - السعر العام المشطوب: `.general-price.crossed { text-decoration: line-through; opacity: 0.5 }`
  - Responsive: على شاشات < 768px: layout عمودي

### JS State & Init

- [X] T012 [US1] تعريف `state` في `screens/customer-custom-prices/customer-custom-prices.js`:
  ```js
  { selectedCustomer, products, selectedProductId, customPrices, originalPrices, isDirty }
  ```
  + دالة `init()` تجمع DOM refs وتربط event listeners وتستدعي `loadCustomers()`

- [X] T013 [US1] تنفيذ `loadCustomers()` في `screens/customer-custom-prices/customer-custom-prices.js`: استدعاء `window.api.getCustomers({ page:1, pageSize:200 })` وملء dropdown العميل، مع حالة فارغة

### Customer Selection & Data Loading

- [X] T014 [US1] تنفيذ `selectCustomer(customerId)` في `screens/customer-custom-prices/customer-custom-prices.js`: استدعاء `window.api.getCustomPricesScreenData({ customerId })` → ملء `state.products` + `state.customPrices` + `state.originalPrices` → استدعاء `renderProductList()` + `renderSummaryCards()`

### Master Panel (Product List)

- [X] T015 [US1] تنفيذ `renderProductList(filter)` في `screens/customer-custom-prices/customer-custom-prices.js`: رسم قائمة الأصناف مع نقطة خضراء وعدد المخصصة لكل صنف، وتحديد الصنف الأول افتراضياً

- [X] T016 [US1] ربط حقل البحث (debounce 300ms) لتصفية قائمة الأصناف في `screens/customer-custom-prices/customer-custom-prices.js`

### Detail Panel (Services Table)

- [X] T017 [US1] تنفيذ `selectProduct(productId)` + `renderServicesTable()` في `screens/customer-custom-prices/customer-custom-prices.js`: رسم جدول الخدمات مع اسم الخدمة، السعر العام (مشطوب إن وُجد خاص)، حقل إدخال السعر الخاص، نسبة الفرق، زرار ✕

### Price Input Handling

- [X] T018 [US1] ربط event listener لكل حقل سعر خاص في `screens/customer-custom-prices/customer-custom-prices.js`:
  - عند الإدخال: تحديث `state.customPrices` + تطبيق CSS class مناسب (saving/higher/zero/dirty) + تحديث نسبة الفرق + `state.isDirty = true`
  - زرار ✕: مسح القيمة من `state.customPrices` + إزالة CSS classes + تحديث العرض

### Save Logic

- [X] T019 [US1] تنفيذ دالة `handleSave()` في `screens/customer-custom-prices/customer-custom-prices.js`:
  1. فحص وجود سعر = 0 → `confirm()` تأكيد
  2. حساب `changes` (مقارنة customPrices بـ originalPrices) و`deletes`
  3. استدعاء `window.api.saveCustomerCustomPrices({ customerId, changes, deletes })`
  4. نجاح: تحديث `originalPrices` + `isDirty=false` + toast نجاح + `renderProductList()`
  5. فشل: toast خطأ

**Checkpoint ✅**: US1 مكتمل — المدير يستطيع تعيين وحفظ الأسعار الخاصة

---

## Phase 4: US2 — تطبيق الأسعار المخصصة في POS (Priority: P1)

**Goal**: عند اختيار عميل في POS تُطبَّق أسعاره الخاصة تلقائياً على البنود.

**Independent Test**: إنشاء سعر خاص → فتح POS → اختيار نفس العميل → إضافة الصنف → التحقق أن السعر الخاص ظهر تلقائياً

### POS State Extension

- [X] T020 [US2] إضافة `customerCustomPrices: {}` لـ `state` في `screens/pos/pos.js` (حول line 11)

### Load Custom Prices on Customer Select

- [X] T021 [US2] في دالة اختيار العميل في `screens/pos/pos.js` (حول line 1600): بعد تحديد `state.selectedCustomer`، استدعاء `window.api.getCustomerPosCustomPrices({ customerId })` وتخزين النتيجة في `state.customerCustomPrices`

### Clear Prices on Customer Remove

- [X] T022 [US2] في دالة إزالة العميل في `screens/pos/pos.js` (حول line 1686): إفراغ `state.customerCustomPrices = {}` + إعادة تسعير البنود ذات `priceSource='custom'` إلى `generalPrice` + `renderCart()`

### addToCart — Apply Custom Price

- [X] T023 [US2] تعديل دالة `addToCart` في `screens/pos/pos.js` (line 1036): إضافة منطق `resolveItemPrice`:
  - حساب `lookupKey = "${product.id}:${priceLine.laundry_service_id}"`
  - إذا وُجد في `state.customerCustomPrices`: `unitPrice = customPrice`, `priceSource = 'custom'`
  - وإلا: `unitPrice = generalPrice`, `priceSource = 'general'`
  - إضافة الحقول الجديدة `generalPrice`, `customPrice`, `priceSource` لكل cart item

### Manual Price Override — priceSource Tracking (H1)

- [X] T024 [US2] ربط حدث تعديل سعر البند يدوياً في `screens/pos/pos.js` (دالة تعديل السعر — حول line 1272): عند تغيير الكاشير للسعر يدوياً يُضبط `item.priceSource = 'manual'` + `item.unitPrice = newPrice` + `item.lineTotal = item.qty * newPrice` (لا يُحفظ كسعر خاص دائم)

### Visual Badge in Cart

- [X] T025 [US2] في دالة `renderCart` في `screens/pos/pos.js`: إضافة badge صغير ★ بلون أزرق على البنود ذات `priceSource === 'custom'` مع `title="سعر خاص"`

### Service Change Re-pricing (H2)

- [X] T026 [US2] معالجة تغيير الخدمة داخل بند موجود في `screens/pos/pos.js`: عند تغيير الخدمة لبند في الـ cart، استدعاء `resolveItemPrice(productId, newServiceId, newGeneralPrice)` وإعادة ضبط `unitPrice + priceSource` للبند — يُعيد السعر العام إذا لم يوجد سعر خاص للخدمة الجديدة

### Re-pricing on Customer Change (H3)

- [X] T027 [US2] عند تغيير العميل في POS مع وجود بنود في الـ cart في `screens/pos/pos.js`:
  - إعادة تحميل `state.customerCustomPrices` للعميل الجديد
  - إعادة تسعير البنود `priceSource='general'` و`priceSource='custom'` تلقائياً
  - إذا كانت هناك بنود `priceSource='manual'`: عرض `confirm()` "يوجد أسعار يدوية — هل تريد إعادة التسعير؟" — إذا وافق تُعاد تسعيرها، وإلا تبقى كما هي

**Checkpoint ✅**: US1 + US2 مكتملان — الدورة الكاملة تعمل: إعداد سعر → تطبيق في POS

---

## Phase 5: US3 — ملخص بصري للأسعار المخصصة (Priority: P2)

**Goal**: المدير يرى ملخصاً فورياً (إجمالي / مخصصة / متوسط الفرق) يتحدث مع كل تعديل.

**Independent Test**: فتح الشاشة لعميل لديه أسعار خاصة → التحقق من صحة الأرقام في بطاقات الملخص

- [X] T028 [US3] تنفيذ `renderSummaryCards()` في `screens/customer-custom-prices/customer-custom-prices.js`:
  - `totalServices`: مجموع عدد الخدمات في كل الأصناف
  - `customServices`: عدد الخدمات التي لها قيمة في `state.customPrices`
  - `averageDifferencePercent`: متوسط `((generalPrice - customPrice) / generalPrice * 100)` مُدوَّر لرقم واحد عشري
  - تستدعى من `selectCustomer()` وكل تحديث لحقل إدخال

- [X] T029 [US3] تحديث مؤشرات Master Panel بعد كل تعديل في `screens/customer-custom-prices/customer-custom-prices.js`: تحديث نقطة الصنف (خضراء/رمادية) وعدد مخصصاته عند كل تغيير في `state.customPrices` دون إعادة رسم كاملة للقائمة

**Checkpoint ✅**: US1 + US2 + US3 — الشاشة كاملة مع ملخص حي

---

## Phase 6: US4 — التنقل والوصول المتعدد (Priority: P2)

**Goal**: الشاشة متاحة من القائمة الجانبية ومن زرار في صفحة العملاء.

**Independent Test**: فتح الشاشة من القائمة الجانبية بدون عميل محدد → التحقق من طلب اختيار العميل. فتحها من زرار العميل → التحقق من اختياره تلقائياً.

- [X] T030 [US4] إضافة بند الشاشة في `SIDEBAR_ITEMS` في `assets/sidebar.js` (في مجموعة `gsb-section-admin` بعد customers):
  ```js
  { screen: 'customer-custom-prices', labelKey: 'gsb-nav-customer-custom-prices',
    label: { ar: 'الأسعار المخصصة', en: 'Custom Prices' },
    permission: 'customer_custom_prices',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>' }
  ```

- [X] T031 [P] [US4] إضافة مفاتيح الترجمة في `assets/i18n.js`: `gsb-nav-customer-custom-prices`, `ccp-title`, `ccp-select-customer`, `ccp-save`, `ccp-total-services`, `ccp-custom-services`, `ccp-avg-diff`, `ccp-search-products`, `ccp-no-products`, `ccp-select-product`, `ccp-general-price`, `ccp-custom-price`, `ccp-difference`, `ccp-confirm-zero`, `ccp-saved`, `ccp-save-error`

- [X] T032 [US4] إضافة زرار "أسعار خاصة" في صف العميل في `screens/customers/customers.js` (داخل دالة render الصف) مع `onclick` يستدعي `window.api.navigateTo('customer-custom-prices?customer_id=${id}')`

- [X] T033 [US4] معالجة query parameter `customer_id` في `screens/customer-custom-prices/customer-custom-prices.js` عند `DOMContentLoaded`: `const preId = parseInt(new URLSearchParams(location.search).get('customer_id')); if (preId) selectCustomer(preId);`

**Checkpoint ✅**: كل القصص مكتملة — الشاشة متاحة من كل الأماكن المطلوبة

---

## Phase 7: Polish & Edge Cases

**Purpose**: معالجة الحالات الحدية والتأكد من الجودة الكاملة

- [X] T034 إضافة حالات الشاشة الفارغة في `screens/customer-custom-prices/customer-custom-prices.js` + `customer-custom-prices.html`:
  - "اختر عميلاً أولاً" (قبل اختيار عميل)
  - "لا توجد أصناف متاحة للتسعير" (إذا لم توجد products)
  - "اختر صنفاً من القائمة" (قبل اختيار صنف)

- [X] T035 إضافة تحذير بصري واضح في `screens/customer-custom-prices/customer-custom-prices.css` + `customer-custom-prices.js` عند إدخال سعر خاص أعلى من السعر العام (class `.higher` + tooltip أو نص صغير "⚠ أعلى من السعر العام")

- [X] T036 تعطيل زرار "حفظ التغييرات" في `screens/customer-custom-prices/customer-custom-prices.js` إذا لم يُختر عميل أو `isDirty === false`، وتفعيله تلقائياً عند أول تعديل

- [X] T037 التحقق من سلوك POS الكامل في `screens/pos/pos.js`:
  - عميل بدون أسعار خاصة: لا تأثير (الأسعار العامة تبقى)
  - سعر خاص = 0: يُطبَّق بشكل صحيح
  - اختيار عميل مع cart مليء: إعادة تسعير صحيحة

- [ ] T038 تشغيل سيناريوهات `quickstart.md` كاملة والتحقق من كل نقطة تحقق

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: لا تبعيات — تبدأ فوراً
- **Phase 2 (Foundational)**: بعد Phase 1 — **تمنع** كل القصص حتى تكتمل
- **Phase 3 (US1)**: بعد Phase 2 — 🎯 MVP (يمكن التوقف هنا لاختبار الميزة الأساسية)
- **Phase 4 (US2)**: بعد Phase 2 — يمكن تشغيله بالتوازي مع Phase 3 (ملفات مختلفة)
- **Phase 5 (US3)**: بعد Phase 3 (يُكمِّل الشاشة)
- **Phase 6 (US4)**: بعد Phase 3 (يُضيف التنقل)
- **Phase 7 (Polish)**: بعد Phase 3-6

### User Story Dependencies

| القصة | تبعيات | ملاحظة |
|-------|--------|---------|
| US1 (P1) | Phase 2 فقط | MVP — مستقلة تماماً |
| US2 (P1) | Phase 2 فقط | ملفات مختلفة عن US1 |
| US3 (P2) | US1 | تُكمِّل الشاشة |
| US4 (P2) | US1 | تنقل مستقل |

### فرص التوازي

- T001 + T002 + T003 يعملون معاً (Phase 1)
- T004-T009 تتسلسل لكن T005+T006+T007 يمكن كتابتهم بشكل مستقل ثم ربطهم
- T024+T025+T026+T027 متسلسلة داخل POS لكن مستقلة عن Phase 3
- T030+T031+T032+T033 يمكن توزيعهم بعد اكتمال Phase 3
- Phase 3 (US1) + Phase 4 (US2) يمكن تشغيلهما بالتوازي (ملفات مختلفة)
- T029 يعمل بالتوازي مع أي مهمة أخرى في Phase 6

---

## Implementation Strategy

### MVP (US1 فقط — الميزة الأساسية)

1. Phase 1: إنشاء الملفات
2. Phase 2: DB + API ← **حرج**
3. Phase 3: الشاشة الكاملة
4. **توقف وتحقق**: المدير يستطيع تعيين وحفظ الأسعار الخاصة ✅

### الإصدار الكامل (كل القصص)

1. Phase 1-2 → أساس متين
2. Phase 3 (US1) → MVP ✅
3. Phase 4 (US2) → POS يطبق الأسعار ✅
4. Phase 5 (US3) → ملخص بصري ✅
5. Phase 6 (US4) → تنقل سهل ✅
6. Phase 7 → جودة وحالات حدية ✅

---

## Notes

- `[P]` = مختلف الملفات، لا تبعيات معلّقة
- `[US#]` = القصة التي تنتمي إليها المهمة
- لا تُعدِّل `product_price_lines` — قراءة فقط
- `unitPrice` في POS يبقى مصدر الحقيقة للحسابات والطباعة وZATCA
- التحقق من كل Checkpoint قبل الانتقال للمرحلة التالية


