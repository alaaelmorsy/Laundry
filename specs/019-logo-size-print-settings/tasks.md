# Tasks: Logo Size in Print Settings

**Input**: Design documents from `specs/019-logo-size-print-settings/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Organization**: Tasks مُنظَّمة حسب User Story لتمكين التنفيذ والاختبار المستقل.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تشغيله بالتوازي (ملفات مختلفة، لا تبعيات)
- **[Story]**: User Story المرتبطة بالمهمة

---

## Phase 1: Setup (لا يوجد — البنية موجودة)

لا يوجد setup مطلوب — الـ DB والـ API والـ settings UI موجودون بالفعل.

---

## Phase 2: Foundational (لا يوجد — الأساس موجود)

لا توجد مهام تأسيسية — `logo_width`/`logo_height` موجودان في `app_settings` وإعدادات الـ settings screen موجودة.

**Checkpoint**: يمكن البدء مباشرة بتنفيذ User Stories.

---

## Phase 3: User Story 1 — ضبط حجم الشعار في شاشة POS (Priority: P1) 🎯 MVP

**Goal**: تطبيق `logoWidth`/`logoHeight` من الإعدادات على الشعار في طباعة POS (حرارية + A4).

**Independent Test**: افتح الإعدادات → غيّر العرض إلى 150 والطول إلى 100 → احفظ → اطبع فاتورة من POS → تحقق من ظهور الشعار بالحجم الجديد.

### Implementation for User Story 1

- [X] T001 [US1] في `screens/pos/pos.js` — تطبيق inline style للعرض والطول على جميع DOM elements الشعار (invLogo، crModalLogo، a4mLogo)
- [X] T002 [US1] في `screens/pos/pos.js` — إضافة `logoWidth`/`logoHeight` لـ `state.lastA4Data` object
- [X] T003 [US1] في `screens/pos/pos.js` — تطبيق الأبعاد في `fillA4InvoiceModal` على `a4mLogo`
- [ ] T004 [US1] تحقق يدوياً: غيّر الأبعاد من الإعدادات واطبع فاتورة حرارية وA4 من POS وتأكد من تطبيق الحجم

**Checkpoint**: شاشة POS تعكس الأبعاد المحددة في الطباعة الحرارية وA4.

---

## Phase 4: User Story 2 — تطبيق الحجم في جميع شاشات الطباعة (Priority: P2)

**Goal**: تطبيق نفس الأبعاد على الشعار في شاشات Invoices، Credit Invoices، Consumption Receipts، Hangers، وAll-Invoices Report.

**Independent Test**: اطبع من كل شاشة وتحقق من ظهور الشعار بنفس الأبعاد المحددة في الإعدادات.

### Implementation for User Story 2

- [X] T005 [P] [US2] في `screens/invoices/invoices.js` — إضافة `logoWidth`/`logoHeight` للـ data object + تطبيق inline style على A4 logo element
- [X] T006 [P] [US2] في `screens/invoices/invoices.js` — تطبيق inline style على `els.invLogo` في modal الفاتورة الحرارية
- [X] T007 [US2] في `screens/invoices/invoices.js` — إضافة `logoWidth`/`logoHeight` لـ `state.lastA4Data`
- [X] T008 [P] [US2] في `screens/credit-invoices/credit-invoices.js` — تطبيق inline style على A4 logo (a4mLogo) و CN logo (cnA4mLogo)
- [X] T009 [US2] في `screens/credit-invoices/credit-invoices.js` — تطبيق inline style على `els.invLogo` و `els.cnLogo` + إضافة logoWidth/Height لـ data objects
- [X] T010 [P] [US2] في `screens/consumption-receipts/consumption-receipts.js` — تطبيق inline style على logo element
- [X] T011 [P] [US2] في `screens/hangers/hangers.js` — تطبيق inline style على جميع logo elements + إضافة logoWidth/Height لـ data object
- [X] T012 [P] [US2] في `screens/reports/all-invoices-report/all-invoices-report.js` — تطبيق inline style على جميع logo elements (invLogo، cnLogo، crLogo)
- [ ] T013 [US2] تحقق يدوياً: اطبع من كل شاشة وتأكد من تطبيق الأبعاد في كل مكان

**Checkpoint**: جميع شاشات الطباعة تعرض الشعار بالأبعاد المحددة.

---

## Phase 5: User Story 3 — القيم الافتراضية والتحقق من الإدخال (Priority: P3)

**Goal**: التأكد من أن القيم الافتراضية معقولة وأن الإدخال غير الصالح يُعالَج بشكل صحيح.

**Independent Test**: أدخل `0` في خانة العرض واحفظ → تحقق من عدم حفظ القيمة أو استبدالها بـ 180.

### Implementation for User Story 3

- [X] T014 [US3] في `screens/settings/settings.html` — إضافة `placeholder="180"` و`placeholder="70"` لخانتي العرض والطول
- [X] T015 [US3] الـ validation موجود بالفعل في `database/db.js` (يستبدل القيم غير الصالحة بالافتراضي)، و`min="1"` موجود في HTML
- [ ] T016 [US3] تحقق يدوياً: أدخل `0`، `-5` في الخانتين وتأكد من استبدالها بالافتراضي عند الحفظ

**Checkpoint**: الـ settings screen تمنع القيم غير الصالحة.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T017 تشغيل سيناريوهات `quickstart.md` كاملة للتحقق من جميع User Stories

---

## Dependencies & Execution Order

- **Phase 3-5**: مكتملة
- **Phase 6**: تحقق يدوي نهائي

---

## Notes

- [P] = ملفات مختلفة، لا تبعيات — يمكن التوازي
- لا يوجد تغيير في DB أو API
- `object-fit: contain` مُطبَّق في كل مكان للحفاظ على جودة الصورة
- الـ fallback الافتراضي: `logoWidth || 180` و `logoHeight || 70`
