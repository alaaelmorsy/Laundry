# Tasks: عروض الأصناف (Product-Specific Offers)

**Input**: Design documents from `specs/027-product-offers/`

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/api.md](./contracts/api.md)

**Organization**: Tasks grouped by user story — each story independently testable.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: إنشاء الجداول الجديدة وتسجيلها في دورة حياة قاعدة البيانات

- [x] T001 أضف دالة `createProductOffersTable()` في `database/db.js` (بعد `createOffersTable`)
- [x] T002 أضف دالة `createProductOfferLinesTable()` في `database/db.js` (بعد T001 — تحتاج FK على product_offers)
- [x] T003 سجّل الدالتين في `db.initialize()` في `database/db.js` بعد استدعاء `createOffersTable()`

**Checkpoint**: قاعدة البيانات تُنشئ الجدولين عند بدء الخادم — تحقق بـ `SHOW TABLES`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: دوال قاعدة البيانات وطبقة الـ API الكاملة — تحجب كل القصص

**⚠️ CRITICAL**: لا يمكن البدء في أي قصة مستخدم قبل اكتمال هذه المرحلة

- [x] T004 أضف دالة `getProductsForOffers()` في `database/db.js` — تُرجع الأصناف مع عملياتها (INNER JOIN product_price_lines + laundry_services) مُجمَّعة كـ `{ product_id, product_name, lines: [{price_line_id, service_name, price}] }`
- [x] T005 [P] أضف دالة `getAllProductOffers()` في `database/db.js` — تُرجع كل العروض مع `lines_count` (LEFT JOIN + COUNT)
- [x] T006 [P] أضف دالة `getProductOfferById(id)` في `database/db.js` — تُرجع بيانات العرض + مصفوفة `price_line_ids`
- [x] T007 [P] أضف دالة `createProductOffer(data)` في `database/db.js` — INSERT في transaction: product_offers ثم product_offer_lines بالـ bulk insert مع validation كامل (name, discountType, discountValue, dates, priceLineIds min 1)
- [x] T008 [P] أضف دالة `updateProductOffer(data)` في `database/db.js` — UPDATE في transaction: تحديث product_offers + حذف السطور القديمة + إدراج الجديدة
- [x] T009 [P] أضف دالة `toggleProductOfferStatus(id)` في `database/db.js` — `UPDATE ... SET is_active = IF(is_active=1,0,1)`
- [x] T010 [P] أضف دالة `deleteProductOffer(id)` في `database/db.js` — `DELETE FROM product_offers WHERE id=?` (cascade يحذف الـ lines تلقائياً)
- [x] T011 أضف الـ cases في `server/invokeHandlers.js`: `getProductsForOffers`, `getProductOffers`, `getProductOfferById`, `createProductOffer`, `updateProductOffer`, `toggleProductOfferStatus`, `deleteProductOffer` — كل case محاط بـ try/catch
- [x] T012 أضف في `assets/web-api.js`: `api.getProductsForOffers`, `api.getProductOffers`, `api.getProductOfferById`, `api.createProductOffer`, `api.updateProductOffer`, `api.toggleProductOfferStatus`, `api.deleteProductOffer`

**Checkpoint**: اختبر من console المتصفح: `await window.api.getProductsForOffers()` → يُرجع قائمة الأصناف

---

## Phase 3: User Story 1 — إنشاء عرض على أصناف محددة (Priority: P1) 🎯 MVP

**Goal**: المستخدم يستطيع فتح تيوب "عروض الأصناف" وإضافة عرض جديد وحفظه

**Independent Test**: فتح شاشة العروض → تيوب "عروض الأصناف" → إضافة عرض بصنفين → حفظ → يظهر في القائمة

### Implementation

- [x] T013 [US1] أضف HTML لتيوب "عروض الأصناف" في `screens/offers/offers.html`:
  - زر تيوب ثانٍ "عروض الأصناف" بجانب "العروض العامة" الحالي
  - قسم `#productOffersTab` يحتوي: زر "إضافة عرض" + `<table id="productOffersTable">`
  - modal إضافة/تعديل `#productOfferModal` يحتوي:
    - حقل اسم العرض `#poName`
    - اختيار نوع الخصم `#poDiscountType` (نسبة/مبلغ ثابت)
    - حقل قيمة الخصم `#poDiscountValue`
    - حقل تاريخ البداية `#poStartDate` (اختياري)
    - حقل تاريخ النهاية `#poEndDate` (اختياري)
    - قسم اختيار الأصناف `#poProductsList` (يُملأ ديناميكياً)
    - زرا "حفظ" و"إلغاء"

- [x] T014 [US1] أضف في `screens/offers/offers.js` دالة `loadProductOffers()`:
  - استدعاء `window.api.getProductOffers()`
  - رسم الجدول بالأعمدة: الاسم، نوع الخصم، القيمة، عدد الأصناف، تاريخ البداية، تاريخ النهاية، الحالة، الإجراءات
  - عرض الحالة كـ badge (مفعّل/معطّل/منتهي)

- [x] T015 [US1] أضف دالة `openProductOfferModal(offerId = null)` في `screens/offers/offers.js`:
  - لو `offerId` null: وضع الإضافة — تنظيف الحقول وتحميل قائمة الأصناف عبر `window.api.getProductsForOffers()`
  - لو `offerId` موجود: وضع التعديل — تحميل `getProductOfferById` وتعبئة الحقول مع الأصناف المحددة مسبقاً
  - رسم قائمة الأصناف: كل صنف كقسم قابل للطي (accordion أو checkbox group) تحته checkboxes للعمليات

- [x] T016 [US1] أضف دالة `saveProductOffer()` في `screens/offers/offers.js`:
  - قراءة الحقول وبناء payload
  - جمع `price_line_ids` المختارة (كل checkbox محدد)
  - validation في الـ frontend: اسم مطلوب، قيمة > 0، صنف واحد على الأقل، start < end إذا كلاهما موجودان
  - استدعاء `createProductOffer` أو `updateProductOffer` حسب الوضع
  - إغلاق الـ modal وإعادة تحميل القائمة عند النجاح

- [x] T017 [US1] ربط أحداث التيوب في `screens/offers/offers.js`:
  - زر "إضافة عرض" → `openProductOfferModal()`
  - زر حفظ الـ modal → `saveProductOffer()`
  - زر إلغاء / backdrop click / Escape → إغلاق الـ modal
  - تحميل `loadProductOffers()` عند تفعيل التيوب

**Checkpoint**: إنشاء عرض كامل يعمل — يظهر في القائمة ويُخزَّن في DB صحيحاً

---

## Phase 4: User Story 2 — اختيار الأصناف والعمليات (Priority: P1)

**Goal**: قائمة الأصناف في الـ modal تعمل بشكل صحيح — كل صنف يعرض عملياته فقط

**Independent Test**: فتح modal الإضافة → ظهور الأصناف → اختيار صنف → ظهور عملياته فقط → حفظ → التحقق من `product_offer_lines`

### Implementation

- [x] T018 [US2] حسّن `renderProductsList(products, selectedIds = [])` في `screens/offers/offers.js`:
  - تجميع الأصناف في groups — كل صنف header وتحته checkboxes للعمليات
  - checkbox لكل عملية قيمته `price_line_id`
  - تحديد مسبق للـ checkboxes لو `selectedIds` ممرّرة (وضع التعديل)
  - زر "تحديد الكل / إلغاء الكل" لكل صنف
  - عداد "X عملية محددة" يتحدث ديناميكياً

- [x] T019 [US2] أضف validation في `saveProductOffer()` في `screens/offers/offers.js`:
  - رسالة خطأ واضحة "يجب اختيار صنف وعملية واحدة على الأقل" عند محاولة الحفظ بدون اختيار

**Checkpoint**: اختيار الأصناف يعمل بدقة — `product_offer_lines` تحتوي فقط الـ price_line_ids المختارة

---

## Phase 5: User Story 3 — إدارة العروض (تعديل / تفعيل / حذف) (Priority: P2)

**Goal**: المستخدم يستطيع تعديل عرض قائم، تفعيله/تعطيله، وحذفه

**Independent Test**: بعد إنشاء عرض — تعديل قيمته، تعطيله، ثم حذفه والتحقق من اختفائه من DB

### Implementation

- [x] T020 [US3] أضف دالة `toggleProductOffer(id)` في `screens/offers/offers.js`:
  - استدعاء `window.api.toggleProductOfferStatus({ id })`
  - إعادة تحميل القائمة عند النجاح
  - toast تأكيد بالحالة الجديدة

- [x] T021 [US3] أضف دالة `deleteProductOffer(id)` في `screens/offers/offers.js`:
  - `confirm()` تأكيد الحذف بالعربية
  - استدعاء `window.api.deleteProductOffer({ id })`
  - إعادة تحميل القائمة عند النجاح

- [x] T022 [US3] ربط أزرار الإجراءات في صفوف جدول القائمة في `screens/offers/offers.js`:
  - زر "تعديل" → `openProductOfferModal(id)`
  - زر "تفعيل/تعطيل" → `toggleProductOffer(id)`
  - زر "حذف" → `deleteProductOffer(id)`

**Checkpoint**: دورة الحياة الكاملة تعمل — إنشاء، تعديل، تفعيل/تعطيل، حذف

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: تحسينات تشمل كل القصص

- [x] T023 [P] أضف CSS للتيوب الجديد وقسم الأصناف في `screens/offers/offers.css`:
  - styling لـ tab buttons (active/inactive)
  - styling لـ product groups في الـ modal (accordion أو bordered sections)
  - badges الحالة (مفعّل = أخضر، معطّل = رمادي، منتهي = أحمر)

- [x] T024 تأكد من عدم تأثر تيوب "العروض العامة" الحالي — اختبر functions القديمة لا تزال تعمل بعد إضافة التيوب الجديد في `screens/offers/offers.js`

- [ ] T025 تحقق من الـ quickstart scenarios الثمانية يدوياً كما في `specs/027-product-offers/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: لا تبعيات — ابدأ فوراً
- **Phase 2 (Foundational)**: تعتمد على Phase 1 — تحجب كل القصص
- **Phase 3 (US1)**: تعتمد على Phase 2 — MVP الأساسي
- **Phase 4 (US2)**: تعتمد على Phase 3 (تُحسّن الـ modal الذي أُنشئ في US1)
- **Phase 5 (US3)**: تعتمد على Phase 3 (تُضيف أزرار على القائمة)
- **Phase 6 (Polish)**: تعتمد على اكتمال كل القصص

### Parallel Opportunities

```
Phase 2: T005, T006, T007, T008, T009, T010 → كلها ملفات مستقلة (db.js دوال منفصلة) تُكتب معاً
Phase 3: T013 (HTML) بالتوازي مع T014+T015+T016+T017 (JS)
Phase 6: T023 (CSS) بالتوازي مع T024 (regression check)
```

---

## Implementation Strategy

### MVP (US1 + US2 فقط — الأهم)

1. Phase 1: إنشاء الجداول
2. Phase 2: دوال DB + API كاملة
3. Phase 3: الـ UI الأساسي (قائمة + modal + حفظ)
4. Phase 4: تحسين اختيار الأصناف
5. **STOP & VALIDATE**: quickstart scenarios 1–6

### Full Delivery

أكمل Phase 5 (إدارة) + Phase 6 (polish) ثم scenarios 7–8

---

## Notes

- [P] = ملف مختلف، لا تبعيات، يمكن التوازي
- [USx] = ربط المهمة بقصة المستخدم للتتبع
- لا تُعدّل منطق "العروض العامة" الحالية في offers.js — فقط أضف
- CASCADE DELETE في product_offer_lines يُغني عن حذف يدوي للـ lines
- التواريخ اختيارية — لا تُجبر المستخدم عليها في الـ UI
