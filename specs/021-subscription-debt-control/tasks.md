# Tasks: التحكم في مديونية الاشتراك عند نفاد الرصيد

**Input**: Design documents from `specs/021-subscription-debt-control/`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (لا يوجد — البنية التحتية موجودة)

**لا يوجد setup مطلوب** — العمود `allow_subscription_debt` والإعدادات والتمرير إلى `createOrder` كلها موجودة. لا migration جديد، لا API جديدة.

---

## Phase 2: Foundational (تعديل invokeHandlers لتمرير رمز الخطأ)

**Purpose**: تمكين الـ frontend من تمييز خطأ نفاد الرصيد عن الأخطاء الأخرى

**⚠️ CRITICAL**: هذا التعديل يجب أن يكتمل قبل أي عمل في pos.js

- [x] T001 تعديل `catch` handler في `server/invokeHandlers.js` (~line 898) لتمرير `code`, `creditRemaining`, `orderTotal` من كائن الخطأ في الاستجابة

**Checkpoint**: الـ backend يمرر رمز الخطأ بالكامل للـ frontend ✅

---

## Phase 3: User Story 1 — إتمام الطلب بمديونية عند تفعيل الخيار (Priority: P1) 🎯 MVP

**Goal**: عند `allowDebt=true` ورصيد الاشتراك صفر أو أقل من قيمة الطلب، يُتمّ الطلب ويُخزَّن الرصيد سالباً.

**Independent Test**: فعّل "الاشتراك بالمديونية" من الإعدادات، أنشئ طلباً بقيمة تتجاوز رصيد عميل، تحقق من أن الطلب اكتمل ورصيد الاشتراك أصبح سالباً في قاعدة البيانات، ويظهر الإيصال.

### Implementation for User Story 1

- [x] T002 [US1] مراجعة الكود الحالي في `database/db.js` (lines 4735-4741): تأكّد أن `consumptionAmount = numTotal` عند `allowDebt=true` — لا تغيير مطلوب، يعمل بالفعل.
- [x] T003 [US1] التأكد من أن `newBalance = creditRemaining - consumptionAmount` في `database/db.js` (line 4750) لا يستخدم `Math.max(0, ...)` — مؤكَّد، القيمة السالبة تُكتب مباشرةً.
- [ ] T004 [US1] اختبار يدوي عبر `quickstart.md` السيناريو 1: طلب يتجاوز الرصيد مع تفعيل المديونية → يُتمّ الطلب → رصيد سالب في DB

**Checkpoint**: السيناريو 1 من quickstart.md يعمل — المديونية تُقبل والرصيد يصبح سالباً

---

## Phase 4: User Story 2 — حجب الطلب وإظهار إشعار عند نفاد الرصيد بدون مديونية (Priority: P2)

**Goal**: عند `allowDebt=false` وطريقة الدفع "اشتراك" والرصيد غير كافٍ → حجب الطلب، إظهار إشعار مفصّل، عدم الطباعة.

**Independent Test**: أوقف "الاشتراك بالمديونية"، أنشئ طلباً بطريقة الدفع "اشتراك" يتجاوز الرصيد → لا يُنشأ أي طلب، يظهر إشعار بالرصيد المتاح وقيمة الطلب، السلة تبقى.

### Implementation for User Story 2

- [x] T005 [US2] في `database/db.js` في دالة `createOrder` — إضافة حجب `INSUFFICIENT_SUBSCRIPTION_CREDIT` بعد كتلة `else if (creditRemaining > 0)` وقبل `Math.round(...)`
- [x] T006 [P] [US2] في `screens/pos/pos.js` — إضافة دالة `showInsufficientCreditModal(creditRemaining, orderTotal)` تعرض modal يحتوي: عنوان الخطأ، الرصيد الحالي، قيمة الطلب، اقتراح بديل
- [x] T007 [US2] في `screens/pos/pos.js` — في فحص `!res.success`: إضافة معالجة `INSUFFICIENT_SUBSCRIPTION_CREDIT` تستدعي `showInsufficientCreditModal` ثم `return` (السلة تبقى)
- [ ] T008 [US2] اختبار يدوي عبر `quickstart.md` السيناريو 2: طلب بطريقة الدفع "اشتراك" مع رصيد صفر وبدون مديونية → لا طلب في DB، لا طباعة، الإشعار يظهر، السلة تبقى

**Checkpoint**: السيناريو 2 من quickstart.md يعمل — الحجب يعمل والإشعار يظهر

---

## Phase 5: User Story 3 — منع الطباعة دائماً عند فشل استكمال الاشتراك (Priority: P2)

**Goal**: التأكد أن أي حالة فشل في الاشتراك لا تؤدي لطباعة إيصال تحت أي ظرف.

**Independent Test**: في أي سيناريو يفشل فيه الاشتراك (رصيد صفر + مديونية ممنوعة) → لا يُصدر أمر طباعة، الكاشير يرى الإشعار.

### Implementation for User Story 3

- [x] T009 [US3] مراجعة `screens/pos/pos.js`: الـ `return` المُضاف في T007 يضمن عدم الوصول لـ `showConsumptionReceiptModal` — مؤكَّد صحيح.
- [ ] T010 [US3] اختبار يدوي: التحقق من عدم ظهور `window.print()` أو `showConsumptionReceiptModal` في السيناريو 2
- [ ] T011 [US3] اختبار السيناريو 4 من `quickstart.md`: دفع نقدي مع رصيد صفر → لا إشعار مديونية، الطلب يمر بشكل طبيعي

**Checkpoint**: جميع سيناريوهات quickstart.md تعمل — لا side effects على الطلبات النقدية

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T012 [P] مراجعة `screens/subscriptions/subscriptions.js`: `Number(s.credit_remaining).toFixed(2)` يعرض الرصيد السالب تلقائياً — لا تغيير مطلوب.
- [x] T013 [P] مراجعة فلتر `negative` في تقرير الاشتراكات: `credit_remaining <= 0` موجود — يلتقط الرصيد السالب الجديد تلقائياً.
- [ ] T014 التشغيل الكامل لجميع سيناريوهات `quickstart.md` والتأكد من اجتياز الكل

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: لا dependencies — يبدأ فوراً
- **Phase 3 (US1)**: يمكن أن يبدأ بالتوازي مع Phase 2 (ملفات مختلفة: db.js فقط)
- **Phase 4 (US2)**: يعتمد على Phase 2 (T001) لأن pos.js يحتاج `res.code` — و Phase 3 للـ db.js
- **Phase 5 (US3)**: يعتمد على اكتمال T007 من Phase 4
- **Phase 6 (Polish)**: يعتمد على اكتمال جميع الـ phases

### Parallel Opportunities

- T001 (invokeHandlers) وT002+T003 (db.js US1) يمكن تنفيذهما بالتوازي (ملفات مختلفة)
- T006 (دالة showInsufficientCreditModal في pos.js) يمكن كتابتها بالتوازي مع T005 (db.js block)
- T012 وT013 (Polish) يمكن تنفيذهما بالتوازي

---

## Notes

- [P] tasks = ملفات مختلفة، لا dependencies
- الـ `return` في T007 يضمن تلقائياً عدم الطباعة (US3) — لا كود إضافي مطلوب
- الـ rollback في `createOrder` يحدث تلقائياً عند throw — لا بيانات تُكتب في DB عند الحجب
- `paymentMethod === 'subscription'` هو المفتاح للحجب — الطلبات النقدية لا تتأثر
