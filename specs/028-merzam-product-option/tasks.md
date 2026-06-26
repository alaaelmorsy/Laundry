# Tasks: خيار المزرام للمنتجات

**Input**: Design documents from `/specs/028-merzam-product-option/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Organization**: Tasks grouped by user story — كل قصة مستقلة تماماً للتطبيق والاختبار.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تنفيذه بالتوازي (ملفات مختلفة، لا تبعيات)
- **[Story]**: القصة المرتبطة بالمهمة (US1 → US4)

---

## Phase 1: Setup (لا يوجد)

لا توجد بنية تحتية تحتاج إعداداً — المشروع قائم، جميع الأدوات موجودة.

---

## Phase 2: Foundational (المتطلبات الأساسية المانعة)

**Purpose**: قاعدة البيانات وطبقة الـ API — يجب اكتمالها قبل أي قصة مستخدم.

**⚠️ CRITICAL**: لا يمكن البدء في أي قصة قبل اكتمال هذه المرحلة.

- [ ] T001 إنشاء جدول `merzam_types` في `database/db.js` داخل `db.initialize()` (CREATE TABLE IF NOT EXISTS + بيانات افتراضية بـ INSERT IGNORE)
- [ ] T002 إضافة migration لعمود `merzam_enabled TINYINT(1) DEFAULT 0` على جدول `products` في `database/db.js`
- [ ] T003 إضافة migration لعمودَي `merzam_type_id INT NULL` و`merzam_type_name VARCHAR(100) NULL` على جدول `order_items` في `database/db.js`
- [ ] T004 [P] كتابة دالة `getMerzamTypes()` في `database/db.js` (SELECT فعّال مرتب بـ sort_order)
- [ ] T005 [P] كتابة دالة `saveMerzamType(data)` في `database/db.js` (INSERT أو UPDATE)
- [ ] T006 [P] كتابة دالة `deleteMerzamType(id)` في `database/db.js` (DELETE)
- [ ] T007 تعديل دالة `saveProduct(data)` في `database/db.js` لقبول واستخدام `merzamEnabled`
- [ ] T008 تعديل دالة `getProductsForPos()` في `database/db.js` لإضافة `p.merzam_enabled` في SELECT
- [ ] T009 [P] إضافة case `getMerzamTypes` في `server/invokeHandlers.js`
- [ ] T010 [P] إضافة case `saveMerzamType` في `server/invokeHandlers.js`
- [ ] T011 [P] إضافة case `deleteMerzamType` في `server/invokeHandlers.js`
- [ ] T012 [P] تسجيل `api.getMerzamTypes` في `assets/web-api.js`
- [ ] T013 [P] تسجيل `api.saveMerzamType` في `assets/web-api.js`
- [ ] T014 [P] تسجيل `api.deleteMerzamType` في `assets/web-api.js`

**Checkpoint**: قاعدة البيانات جاهزة، الـ API متاح — يمكن البدء في القصص.

---

## Phase 3: User Story 1 — تفعيل خيار المزرام على منتج (Priority: P1) 🎯 MVP

**Goal**: إضافة مفتاح "إضافة مزرام" في نموذج تعديل/إضافة المنتج بشاشة الخدمات.

**Independent Test**: افتح شاشة الخدمات → عدّل منتجاً → فعّل المفتاح → احفظ → أعد فتحه → المفتاح لا يزال مفعّلاً.

- [ ] T015 [US1] إضافة عنصر HTML لمفتاح التبديل "إضافة مزرام" في نموذج المنتج داخل `screens/services/services.html`
- [ ] T016 [US1] تعديل دالة `openProductModal()` (أو ما يعادلها) في `screens/services/services.js` لتحميل وعرض قيمة `merzam_enabled` للمنتج المحدد
- [ ] T017 [US1] تعديل دالة `saveProduct()` في `screens/services/services.js` لتضمين `merzamEnabled` في payload الإرسال لـ `window.api.saveProduct`
- [ ] T018 [US1] إضافة i18n keys اللازمة (`services-merzam-toggle` وما شابه) في `assets/i18n.js`

**Checkpoint**: تفعيل المزرام على منتج يعمل ويُحفظ بشكل صحيح.

---

## Phase 4: User Story 2 — اختيار المزرام في سلة البيع (Priority: P1)

**Goal**: إظهار قائمة منسدلة لاختيار نوع المزرام في السلة عند إضافة منتج مفعّل.

**Independent Test**: أضف منتجاً مفعّل المزرام للسلة → تظهر قائمة منسدلة → اختر "مزرام مقلوب" → أكمل الفاتورة → تُحفظ بنجاح.

- [ ] T019 [US2] تحميل `state.merzamTypes` عند `loadData()` في `screens/pos/pos.js` باستدعاء `window.api.getMerzamTypes()`
- [ ] T020 [US2] إضافة حقول `merzamEnabled`, `merzamTypeId`, `merzamTypeName` لكل عنصر في `state.cart[]` عند `addToCart()` في `screens/pos/pos.js`
- [ ] T021 [US2] تعديل دالة `renderCart()` في `screens/pos/pos.js` لإضافة القائمة المنسدلة (HTML `<select>`) أسفل خانة العملية لعناصر `merzamEnabled=true`، مخفية في وضع process/readonly
- [ ] T022 [US2] إضافة event listener لقائمة المزرام المنسدلة في `renderCart()` بـ `screens/pos/pos.js` لتحديث `item.merzamTypeId` و`item.merzamTypeName` عند التغيير
- [ ] T023 [US2] تعديل دالة `changeItemService()` في `screens/pos/pos.js` للإبقاء على اختيار المزرام عند تغيير العملية
- [ ] T024 [US2] تعديل دالة `createOrder` / payload إرسال الفاتورة في `screens/pos/pos.js` لتضمين `merzamTypeId` و`merzamTypeName` في كل عنصر
- [ ] T025 [US2] تعديل `createOrder` (أو `createOrderItems`) في `database/db.js` لحفظ `merzam_type_id` و`merzam_type_name` في `order_items`
- [ ] T026 [US2] تعديل handler `createOrder` في `server/invokeHandlers.js` لتمرير حقول المزرام لـ db
- [ ] T027 [US2] إضافة CSS لقائمة المزرام المنسدلة في `screens/pos/pos.css` (تناسق مع `.cart-item-service-select`)
- [ ] T028 [US2] إضافة i18n keys لقائمة المزرام في السلة في `assets/i18n.js`

**Checkpoint**: اختيار المزرام في السلة يعمل ويُحفظ في الفاتورة.

---

## Phase 5: User Story 3 — ظهور المزرام في الفاتورة المطبوعة (Priority: P2)

**Goal**: إظهار اسم المزرام في الإيصال الحراري (80mm) وفاتورة A4.

**Independent Test**: افتح فاتورة بمزرام محدد → اطبعها → يظهر اسم المزرام تحت العملية في الإيصال.

- [ ] T029 [US3] تعديل دالة بناء الإيصال الحراري في `screens/pos/pos.js` لإضافة سطر اسم المزرام أسفل خانة العملية لكل عنصر (`item.merzamTypeName`)
- [ ] T030 [US3] تعديل دالة بناء جدول بنود الفاتورة (A4 / `els.invItemsTbody`) في `screens/pos/pos.js` لإضافة اسم المزرام تحت خلية العملية
- [ ] T031 [US3] تعديل عرض الفواتير التاريخية (`getOrderDetails`) في `screens/pos/pos.js` لتحميل `merzam_type_name` من `order_items` وعرضه في الطباعة
- [ ] T032 [US3] تعديل `getOrderDetails` في `database/db.js` لإضافة `merzam_type_name` في SELECT من `order_items`

**Checkpoint**: الطباعة الحرارية والـ A4 تعرضان المزرام بشكل صحيح.

---

## Phase 6: User Story 4 — إدارة أنواع المزرام (Priority: P3)

**Goal**: قسم إداري في شاشة الإعدادات لإضافة/تعديل/حذف أنواع المزرام.

**Independent Test**: أضف نوعاً جديداً "مزرام خاص" → افتح شاشة البيع → أضف منتجاً مفعّل للسلة → يظهر "مزرام خاص" في القائمة.

- [ ] T033 [US4] إضافة قسم HTML "أنواع المزرام" في `screens/settings/settings.html` (جدول + نموذج إضافة/تعديل)
- [ ] T034 [US4] كتابة دالة `loadMerzamTypes()` في `screens/settings/settings.js` لجلب وعرض الأنواع الحالية
- [ ] T035 [US4] كتابة دالة `saveMerzamType()` في `screens/settings/settings.js` لإضافة/تعديل نوع عبر `window.api.saveMerzamType`
- [ ] T036 [US4] كتابة دالة `deleteMerzamType()` في `screens/settings/settings.js` مع تأكيد الحذف
- [ ] T037 [US4] إضافة CSS خاص بقسم المزرام في `screens/settings/settings.html` (inline أو ملف css إذا موجود)
- [ ] T038 [US4] إضافة i18n keys لقسم إدارة المزرام في `assets/i18n.js`

**Checkpoint**: إدارة الأنواع كاملة — إضافة نوع جديد يظهر فوراً في شاشة البيع.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T039 [P] مراجعة شاشة الفواتير (`screens/invoices/invoices.js`) — إضافة `merzam_type_name` لعرض التفاصيل إذا كانت تعرض العملية
- [ ] T040 [P] مراجعة شاشة الفواتير الآجلة (`screens/credit-invoices/credit-invoices.js`) بنفس المنطق
- [ ] T041 التحقق من تشغيل سيناريوهات quickstart.md الـ6 بنجاح
- [ ] T042 التحقق من صحة طباعة الإيصال الحراري: 76mm / margin: 0 auto لم تتغير

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: لا تبعيات — يبدأ فوراً. يُمنع البدء في أي قصة قبله.
- **US1 (Phase 3)**: يعتمد على T007 فقط (saveProduct في db.js)
- **US2 (Phase 4)**: يعتمد على T001+T003+T004+T008 (جدول merzam_types + order_items + getProductsForPos)
- **US3 (Phase 5)**: يعتمد على US2 (بيانات المزرام محفوظة في الفاتورة)
- **US4 (Phase 6)**: يعتمد على T001+T004+T005+T006+T009+T010+T011+T012+T013+T014
- **Polish (Phase 7)**: يعتمد على اكتمال US1+US2+US3

### Parallel Opportunities

```
Phase 2 بالكامل:
  T001 → T002 → T003 (sequential - migrations)
  T004, T005, T006, T007 [P] — ملفات مختلفة في db.js (دوال مستقلة)
  T008 [P] — تعديل دالة موجودة
  T009, T010, T011 [P] — invokeHandlers.js (cases مختلفة)
  T012, T013, T014 [P] — web-api.js (سطور مستقلة)

US1 + US4 (Phases 3 و6) يمكن تنفيذهما بالتوازي بعد اكتمال Phase 2
```

---

## Implementation Strategy

### MVP (User Stories 1 + 2 فقط)

1. اكتمال Phase 2: Foundational (T001–T014)
2. اكتمال Phase 3: US1 — تفعيل المزرام على منتج (T015–T018)
3. اكتمال Phase 4: US2 — القائمة في السلة + الحفظ (T019–T028)
4. **توقف والتحقق**: quickstart سيناريوهات 1–3 تعمل
5. المنتج جاهز للاستخدام الفعلي

### Incremental Delivery

1. Phase 2 (Foundational) → قاعدة جاهزة
2. Phase 3 (US1) → المستخدم يستطيع تفعيل المزرام
3. Phase 4 (US2) → المستخدم يختار المزرام في السلة ويحفظ ✅ MVP
4. Phase 5 (US3) → يظهر في الطباعة
5. Phase 6 (US4) → المدير يدير الأنواع
6. Phase 7 (Polish) → جودة عالية

---

## Notes

- [P] = ملفات مختلفة أو دوال مستقلة، يمكن تنفيذها بالتوازي
- Migrations (T001–T003) sequential لأنها في `db.initialize()` بترتيب
- اسم المزرام العربي فقط في القائمة المنسدلة — الاسم الإنجليزي للأرشيف
- `merzam_type_name` يُحفظ وقت إنشاء الفاتورة — لا يتأثر بتغيير الجدول لاحقاً
- لا تغيير على حسابات الأسعار أو الإجماليات في أي مرحلة
