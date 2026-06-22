# Tasks: خصم العميل — حل تضارب الخصمَين (Customer Discount)

**Input**: Design documents from `specs/001-customer-discount/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | quickstart.md ✅

**Organization**: Tasks organized by user story to enable independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تنفيذه بالتوازي (ملفات مختلفة، لا تبعيات)
- **[Story]**: القصة التي تنتمي إليها المهمة (US1–US4)

---

## Phase 1: Setup

- [x] T001 قراءة plan.md وdata-model.md والتأكد من الفهم الكامل قبل البدء

---

## Phase 2: Foundational — Database Migrations

**Purpose**: إضافة الأعمدة الجديدة — يجب اكتمالها قبل أي شاشة أو منطق.

**⚠️ يُوقف كل شيء**: لا يمكن بدء أي قصة قبل اكتمال هذه المرحلة.

- [x] T002 في `database/db.js` — Migration لإضافة `discount_type`, `discount_value`, `discount_expiry` لجدول `customers` (try/catch, idempotent ALTER TABLE ADD COLUMN)
- [x] T003 في `database/db.js` — Migration لإضافة `customer_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0` لجدول `orders`
- [x] T004 في `database/db.js` — Migration لإضافة `manual_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0` لجدول `orders` — بنفس نمط T003 مباشرةً بعده في `db.initialize()`

**Checkpoint**: شغِّل `npm start` وتحقق من السجلات. تحقق بـ SQL: `SHOW COLUMNS FROM orders LIKE '%discount%'` — يجب ظهور `discount_amount`, `customer_discount_amount`, `manual_discount_amount`.

---

## Phase 3: User Story 1 — تعيين خصم على العميل من شاشة العملاء (Priority: P1) 🎯 MVP Partial

**Goal**: يستطيع المستخدم حفظ خصم (نسبة أو مبلغ) على العميل من شاشة العملاء، ويُطبَّق تلقائيًا في POS.

**Independent Test**: (1) أنشئ عميلًا بخصم 10% من شاشة العملاء. (2) في POS أضف منتجًا بـ 100 ر.س واختر العميل. (3) تحقق أن الخصم = 10 ر.س والضريبة تُحسب على 90 ر.س.

### Implementation

- [x] T005 [US1] في `database/db.js` — عدِّل `createCustomer(data)` لاستقبال `discountType`, `discountValue`, `discountExpiry` وإدراجهم في INSERT مع validation (نسبة ≤ 100، قيمة موجبة)
- [x] T006 [US1] في `database/db.js` — عدِّل `updateCustomer(data)` لاستقبال `discountType`, `discountValue`, `discountExpiry` وتحديثهم في UPDATE
- [x] T007 [P] [US1] في `server/invokeHandlers.js` — عدِّل case `'createCustomer'` لاستخراج وتمرير `discountType`, `discountValue`, `discountExpiry` من payload
- [x] T008 [P] [US1] في `server/invokeHandlers.js` — عدِّل case `'updateCustomer'` لاستخراج وتمرير `discountType`, `discountValue`, `discountExpiry` من payload
- [x] T009 [US1] في `screens/customers/customers.html` — أضف حقول الخصم في مودال التعديل/الإضافة: `<select id="inputDiscountType">` (لا خصم / نسبة مئوية / مبلغ ثابت)، `<input id="inputDiscountValue">` يظهر عند الاختيار، `<input id="inputDiscountExpiry" type="date">` اختياري
- [x] T010 [US1] في `screens/customers/customers.js` — أضف refs للحقول + منطق `change` على `inputDiscountType` لإظهار/إخفاء حقل القيمة والانتهاء
- [x] T011 [US1] في `screens/customers/customers.js` — في دالة حفظ المودال: أضف `discountType`, `discountValue`, `discountExpiry` للـ payload المُرسَل لـ `window.api.createCustomer()` و`window.api.updateCustomer()` مع validation (قيمة ≤ 100 للنسبة، قيمة > 0 للمبلغ الثابت)
- [x] T012 [US1] في `screens/customers/customers.js` — عند فتح مودال التعديل: عبِّئ حقول الخصم من بيانات العميل (`discount_type`, `discount_value`, `discount_expiry`)
- [x] T013 [US1] في `screens/customers/customers.js` — في دالة رسم جدول العملاء: أضف عمود "الخصم" يعرض القيمة ("10%" أو "50 ر.س" أو "—")
- [x] T014 [US1] في `screens/pos/pos.js` — في دالة تحديد العميل (عند تحميل بيانات العميل الكاملة): خزِّن `state.customerDiscount = { type, value }` من `discount_type` و`discount_value` مع فحص `discount_expiry` (إذا انتهى → `state.customerDiscount = null`)
- [x] T015 [US1] في `screens/pos/pos.js` — تحقق من أن `calcDiscount(subtotal)` يستخدم `state.customerDiscount` بشكل صحيح في حساب `customerDisc` (الكود موجود في السطور 1174–1183، تحقق من الصحة فقط)

**Checkpoint**: نفِّذ السيناريوهات 1 و2 و3 من quickstart.md. تحقق أن حسابات الضريبة صحيحة.

---

## Phase 4: User Story 2 — حل تضارب الخصمَين في الفاتورة (Priority: P1) 🔴 Critical Fix

**Goal**: عند وجود خصم عميل وخصم يدوي معًا، يظهران في سطرَين منفصلَين بمبالغ صحيحة — لا تضارب ولا مبلغ مضلِّل تحت تسمية خاطئة.

**Independent Test**: عميل بخصم 50% + خصم يدوي 10 ر.س على منتج 100 ر.س → الفاتورة تُظهر "خصم العميل (50%): 50 ر.س" في سطر و"خصم إضافي: 10 ر.س" في سطر منفصل.

### Implementation

- [x] T016 [US2] في `database/db.js` — عدِّل `createOrder()` signature: أضف `manualDiscountAmount = 0` كمعامل. أضف `manual_discount_amount` لأعمدة INSERT وقيمته `Number(manualDiscountAmount) || 0`
- [x] T017 [US2] في `server/invokeHandlers.js` — في case `'createOrder'`: أضف `manualDiscountAmount: Number(payload.manualDiscountAmount) || 0` ضمن كائن الوسائط المُمرَّر لـ `db.createOrder()`
- [x] T018 [US2] في `screens/pos/pos.html` — ابحث عن سطر الخصم الحالي (`invDiscRow`) واستبدله بسطرَين مستقلَّين:
  ```html
  <!-- سطر خصم العميل -->
  <tr id="invCustomerDiscRow" class="inv-total-row" style="display:none">
    <td class="inv-total-label" id="invCustomerDiscLabel">خصم العميل</td>
    <td class="inv-total-val discount-val" id="invCustomerDisc"></td>
  </tr>
  <!-- سطر الخصم اليدوي -->
  <tr id="invManualDiscRow" class="inv-total-row" style="display:none">
    <td class="inv-total-label">خصم إضافي</td>
    <td class="inv-total-val discount-val" id="invManualDisc"></td>
  </tr>
  ```
  ⚠️ تحقق من جميع أماكن استخدام `invDiscRow` في pos.js وحدِّثها
- [x] T019 [US2] في `screens/pos/pos.js` — أضف DOM refs جديدة في كتلة `els = {}`:
  ```js
  invCustomerDiscRow:   document.getElementById('invCustomerDiscRow'),
  invCustomerDisc:      document.getElementById('invCustomerDisc'),
  invCustomerDiscLabel: document.getElementById('invCustomerDiscLabel'),
  invManualDiscRow:     document.getElementById('invManualDiscRow'),
  invManualDisc:        document.getElementById('invManualDisc'),
  ```
- [x] T020 [US2] في `screens/pos/pos.js` — في `showInvoiceModal` (وضع inclusive): استبدل منطق `invDiscRow` الحالي بملء السطرَين الجديدَين:
  - احسب `customerDiscAmt = getCustomerDiscountAmount(totals.subtotal)`
  - احسب `manualDiscAmt = Math.max(0, totals.discount - customerDiscAmt - getOfferDiscountAmount(totals.subtotal) - Math.max(0, state.loyaltyDiscount||0))`
  - ملء `invCustomerDiscRow` بالمبلغ والتسمية إذا `customerDiscAmt > 0`
  - ملء `invManualDiscRow` بالمبلغ إذا `manualDiscAmt > 0`
  - إخفاء `invAfterDiscRow` عند غياب كلا الخصمَين
- [x] T021 [US2] في `screens/pos/pos.js` — في `showInvoiceModal` (وضع exclusive): نفس التغييرات في فرع `else` (السطور ~3092–3104)
- [x] T022 [US2] في `screens/pos/pos.js` — في دالة بناء `discountLabel` قبل `window.api.createOrder(...)` (السطر ~3611): أضف الخصم اليدوي للـ label:
  ```js
  if (state.discount > 0) {
    const dTxt = state.discountType === 'pct'
      ? state.discount + '%'
      : parseFloat(state.discount).toFixed(2) + ' ر.س';
    parts.push('خصم إضافي (' + dTxt + ')');
  }
  ```
- [x] T023 [US2] في `screens/pos/pos.js` — في `window.api.createOrder(...)` call: أضف:
  ```js
  manualDiscountAmount: parseFloat(
    Math.max(0,
      calcDiscount(subtotal)
      - getCustomerDiscountAmount(subtotal)
      - getOfferDiscountAmount(subtotal)
      - Math.max(0, state.loyaltyDiscount || 0)
    ).toFixed(2)
  ),
  ```

**Checkpoint**: نفِّذ السيناريو 5 و5b من quickstart.md. تحقق بـ SQL أن `manual_discount_amount` مُخزَّن بشكل صحيح. تحقق أن الفاتورة تُظهر سطرَين منفصلَين.

---

## Phase 5: User Story 3 — تحديد تاريخ انتهاء الخصم (Priority: P2)

**Goal**: خصم منتهي الصلاحية لا يُطبَّق في POS ويُعلَم الكاشير.

**Independent Test**: عميل بخصم 10% بتاريخ انتهاء أمس → في POS: لا يُطبَّق الخصم + رسالة "خصم العميل منتهي".

### Implementation

- [x] T024 [US3] في `screens/pos/pos.js` — في منطق تحديد العميل (T014): إذا كان `discount_expiry` موجودًا وانتهى → `state.customerDiscount = null`، وأظهر toast أو رسالة في chip العميل "خصم العميل منتهي (انتهى [تاريخ])"
- [x] T025 [P] [US3] في `screens/customers/customers.js` — في عمود "الخصم" (T013): إذا كان `discount_expiry` ماضيًا → أظهر النص بلون رمادي مع "(منتهي)"
- [x] T026 [P] [US3] في `screens/customers/customers.html` — أضف label توضيحية بجانب `inputDiscountExpiry`: "اختياري — لا تحديد يعني خصم دائم"

**Checkpoint**: نفِّذ السيناريو 4 من quickstart.md.

---

## Phase 6: User Story 4 — توافق الفاتورة مع هيئة الزكاة (Priority: P1)

**Goal**: بيانات ZATCA صحيحة بالكامل — الضريبة تُحسب على ما بعد مجموع الخصومات.

**Independent Test**: فاتورة بخصم عميل 10% + خصم يدوي 5 ر.س على 100 ر.س → `discount_amount` = 15، `vat_amount` = 12.75، `total_amount` = 97.75. QR code يحتوي الإجمالي الصحيح.

**Note**: ZATCA QR يعتمد `discount_amount` الإجمالي المُخزَّن في `createOrder` — لا تغيير على `zatcaBridge.js`.

### Implementation

- [x] T027 [US4] في `screens/pos/pos.js` — تحقق أن `calcDiscount(subtotal)` يُعيد القيمة الصحيحة عند كلا الخصمَين (راجع أن `manualDisc + customerDisc + offerDisc + loyaltyCapped` مجموعهم صحيح). لا تعديل مطلوب إذا كان الكود صحيحًا.
- [x] T028 [P] [US4] في `screens/pos/pos.js` — تحقق أن `discountAmount` المُرسَل لـ `createOrder` هو نفس `totals.discount` (الإجمالي) وليس مبلغًا مُقتطَعًا
- [x] T029 [P] [US4] في `screens/pos/pos.js` (A4 invoice modal: `fillA4InvoiceModal`) — إذا كانت الفاتورة A4 تعرض خصمًا: أضف منطقًا مشابهًا لعرض سطرَي الخصم بشكل منفصل (customerDisc + manualDisc)

**Checkpoint**: أصدر فاتورة بخصم عميل وخصم يدوي معًا → افتح من قائمة الفواتير. تحقق بـ SQL كما في quickstart.md السيناريو 6 (المحدَّث).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T030 [P] في `screens/customers/customers.html` — تحقق أن حقول الخصم متناسقة بصريًا مع باقي الحقول (RTL، classes Tailwind موحَّدة)
- [x] T031 [P] في `screens/pos/pos.js` — عند مسح العميل (`clearCustomer()`): تأكد من إعادة تعيين `state.customerDiscount` لـ null وإعادة حساب الإجمالي
- [ ] T032 نفِّذ كل سيناريوهات quickstart.md (السيناريوهات 1–5b) وتحقق من النتائج
- [x] T033 [P] تحقق أن POS checkout بدون خصم عميل (عميل عادي) يعمل end-to-end بدون تغيير في السلوك
- [x] T034 [P] تحقق أن الطباعة الحرارية لا تزال 76mm وmargin: 0 auto بعد إضافة السطرَين الجديدَين

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2** (T002–T004): لا تبعيات — ابدأ فورًا
- **Phase 3** (T005–T015): بعد Phase 2 (T002 مطلوب لـ customers، T003 لـ createOrder)
- **Phase 4** (T016–T023): بعد T004 (migration manual_discount) + T014 (state.customerDiscount)
- **Phase 5** (T024–T026): بعد T014 (state.customerDiscount موجود)
- **Phase 6** (T027–T029): بعد T023 (createOrder يُرسِل discountAmount كاملًا)
- **Phase 7**: بعد Phase 3 على الأقل

### User Story Dependencies

| القصة | تعتمد على | مستقلة؟ |
|-------|-----------|---------|
| US1 (P1) | Phase 2 | ✅ MVP مستقل |
| US2 (P1) | T004 + T014 من US1 | ⚠️ تعتمد على T014 |
| US3 (P2) | T014 من US1 | ⚠️ تعتمد على T014 |
| US4 (P1) | T023 من US2 | ⚠️ تعتمد على US2 |

### Within Phase 4 (US2 — Critical Path)

```
T004 (migration manual_discount_amount)
    ↓
T016 (db.createOrder + manualDiscountAmount)
T017 (invokeHandlers + manualDiscountAmount)  ← بالتوازي مع T016
    ↓
T018 (pos.html — سطران منفصلان)
    ↓
T019 (pos.js — DOM refs)
    ↓
T020 → T021 (showInvoiceModal inclusive/exclusive)
T022 → T023 (discountLabel + createOrder payload) ← بالتوازي مع T020/T021
```

### Parallel Opportunities

- T005 + T007 بالتوازي (db createCustomer + handler)
- T006 + T008 بالتوازي (db updateCustomer + handler)
- T011 + T012 + T013 بالتوازي (customers.js — أقسام مختلفة)
- T016 + T017 بالتوازي (db.js + invokeHandlers.js)
- T020 + T022 بالتوازي (showInvoiceModal + discountLabel — قسمان مختلفان في pos.js)
- T025 + T026 + T028 + T029 بالتوازي

---

## Parallel Example: Phase 4 (US2 Critical Fix)

```
# المجموعة الأولى (بالتوازي):
T016: db.createOrder() — إضافة manualDiscountAmount (database/db.js)
T017: invokeHandlers — تمرير manualDiscountAmount (server/invokeHandlers.js)

# تسلسلي:
T018: pos.html — إضافة سطرَين الخصم

# تسلسلي:
T019: pos.js — DOM refs للسطرَين الجديدَين

# المجموعة الثانية (بالتوازي):
T020: showInvoiceModal inclusive
T021: showInvoiceModal exclusive
T022: discountLabel update
T023: createOrder payload + manualDiscountAmount
```

---

## Implementation Strategy

### MVP Minimum (Phase 2 + Phase 4 فقط — Fix الأهم)

1. T004 (migration)
2. T016–T023 (الـ conflict fix الكامل)
3. **توقف وتحقق**: السيناريو 5 من quickstart.md
4. الفاتورة تُظهر خصمَين منفصلَين ✅

### Full MVP (Phase 2 + 3 + 4)

1. Phase 2 (migrations) — 30 دقيقة
2. Phase 3 (customers screen + POS state) — ساعة
3. Phase 4 (conflict fix) — ساعة
4. **توقف وتحقق**: كل سيناريوهات quickstart.md

### Incremental Delivery

1. Phase 2 + 3 → خصم العميل يعمل في POS ✅
2. Phase 4 → تضارب الخصمَين مُصلَح ✅
3. Phase 5 → تاريخ انتهاء مع تنبيه ✅
4. Phase 6 → ZATCA compliance مُؤكَّد ✅
5. Phase 7 → polish ✅

---

## Notes

- `[P]` = ملفات مختلفة، لا تبعيات فعلية على مهمة غير مكتملة
- كل migration في try/catch منفصل داخل `db.initialize()`
- لا تُعدِّل أبعاد `.inv-paper` (76mm / margin: 0 auto) مطلقًا
- `customer_discount_amount` + `manual_discount_amount` للتقارير — ZATCA يعتمد `discount_amount` الإجمالي فقط
- عند مسح العميل من POS أعِد تعيين `state.customerDiscount` (T031)
- T015 و T027/T028 مهام تحقق فقط — إذا كان الكود صحيحًا بالفعل علِّمهم [x] وانتقل
