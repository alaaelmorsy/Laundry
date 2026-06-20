# Tasks: Global Sidebar Navigation

**Input**: Design documents from `specs/022-global-sidebar-navigation/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | quickstart.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: [US1], [US2], [US3] — maps to spec.md user stories
- Exact file paths included in all task descriptions

---

## Phase 1: Setup (الملفات المشتركة)

**Purpose**: إنشاء الملفين المشتركين للقائمة الجانبية كهيكل أساسي فارغ

- [x] T001 إنشاء `assets/sidebar.css` — ملف CSS فارغ للقائمة الجانبية (CSS variables, media query skeleton)
- [x] T002 إنشاء `assets/sidebar.js` — ملف JS فارغ مع `(function(){})()` wrapper وتعريف `window.Sidebar`

---

## Phase 2: Foundational (المكوّن الأساسي)

**Purpose**: بناء القائمة الجانبية كمكوّن كامل يعمل بمفرده — يجب اكتماله قبل إضافته لأي شاشة

**⚠️ CRITICAL**: لا يمكن البدء في أي User Story حتى يكتمل هذا الـ Phase

- [x] T003 في `assets/sidebar.css` — تعريف CSS variables: `--gsb-w:248px`, `--gsb-w-col:64px`, `--gsb-hdr-h:52px` وتنسيقات `#globalSidebar` الأساسية (position, width, background, border, transition) مستوحاة من `.s-side` في `screens/settings/settings.html`
- [x] T004 في `assets/sidebar.css` — تنسيقات عناصر القائمة: `.gsb-hdr`, `.gsb-toggle`, `.gsb-nav`, `.gsb-sec`, `.gsb-item`, `.gsb-item.active`, `.gsb-ico`, `.gsb-lbl` مطابقة لتصميم settings sidebar
- [x] T005 في `assets/sidebar.css` — تنسيقات body wrapper: `.gsb-layout` (display:flex مع القائمة والمحتوى) ومتغير `--gsb-content-margin` لدفع المحتوى عن القائمة
- [x] T006 في `assets/sidebar.js` — تعريف مصفوفة `SIDEBAR_ITEMS` الكاملة: 18 شاشة مقسمة لمجموعتين (رئيسي + إدارة) بحسب `research.md` — كل عنصر: `{screen, labelKey, permission, svg}`
- [x] T007 في `assets/sidebar.js` — دالة `Sidebar.render()`: تبني HTML القائمة الجانبية كاملةً (aside#globalSidebar > header + nav > sections + items)
- [x] T008 في `assets/sidebar.js` — دالة `Sidebar.detectActive()`: تقارن `location.pathname` بـ pattern `/screens/{screen}/` وتضيف `.active` للعنصر المطابق
- [x] T009 في `assets/sidebar.js` — دالة `Sidebar.applyPermissions()`: تستمع لحدث `userReady` من `auth-guard.js` وتخفي العناصر التي لا يملك المستخدم صلاحيتها باستخدام `window.hasPermission()`
- [x] T010 في `assets/sidebar.js` — دالة `Sidebar.setupNavigation()`: تربط كل `.gsb-item` بـ click handler يستدعي `window.api.navigateTo(screen)` أو `window.location.href = '/screens/dashboard/dashboard.html'` للرئيسية
- [x] T011 في `assets/sidebar.js` — استدعاء `Sidebar.init()` عند `DOMContentLoaded` لحقن `#globalSidebar` في `document.body` ثم استدعاء `render()`, `detectActive()`, `applyPermissions()`, `setupNavigation()`
- [x] T012 في `assets/i18n.js` — إضافة مفاتيح i18n للقائمة الجانبية: `gsb-section-main`, `gsb-section-admin`, وأسماء الشاشات إن لم تكن موجودة (`gsb-nav-dashboard`, `gsb-nav-pos`, `gsb-nav-invoices`... إلخ) بالعربية والإنجليزية

**Checkpoint**: القائمة الجانبية كمكوّن مستقل جاهزة — يمكن اختبارها عبر فتح أي صفحة HTML وإضافة السكريبتين يدوياً

---

## Phase 3: User Story 1 — التنقل السريع بين الشاشات (Priority: P1) 🎯 MVP

**Goal**: إضافة القائمة الجانبية لجميع الشاشات الرئيسية مع تمييز الشاشة النشطة والتنقل بنقرة واحدة

**Independent Test**: فتح `/screens/invoices/invoices.html` والتحقق من ظهور القائمة والتنقل منها إلى التقارير بنقرة واحدة مع تمييز الشاشة النشطة

### Implementation for User Story 1

- [x] T013 [P] [US1] في `screens/dashboard/dashboard.html` — إضافة `<link href="../../assets/sidebar.css">` في `<head>` وإضافة `<script src="../../assets/sidebar.js">` قبل `</body>` (بعد web-api.js وauth-guard.js) — تعديل `.main-dashboard` wrapper لاستيعاب layout القائمة
- [x] T014 [P] [US1] في `screens/pos/pos.html` — إضافة `sidebar.css` و`sidebar.js` — مراجعة دقيقة لـ layout POS المعقد لضمان عدم التأثير على الـ flex layout الداخلي
- [x] T015 [P] [US1] في `screens/invoices/invoices.html` — إضافة `sidebar.css` و`sidebar.js` — تعديل `.page-wrapper` layout
- [x] T016 [P] [US1] في `screens/credit-invoices/credit-invoices.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T017 [P] [US1] في `screens/consumption-receipts/consumption-receipts.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T018 [P] [US1] في `screens/hangers/hangers.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T019 [P] [US1] في `screens/subscriptions/subscriptions.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T020 [P] [US1] في `screens/customers/customers.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T021 [P] [US1] في `screens/reports/reports.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T022 [P] [US1] في `screens/products/products.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T023 [P] [US1] في `screens/services/services.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T024 [P] [US1] في `screens/users/users.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T025 [P] [US1] في `screens/roles/roles.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T026 [P] [US1] في `screens/expenses/expenses.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T027 [P] [US1] في `screens/offers/offers.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T028 [P] [US1] في `screens/whatsapp/whatsapp.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T029 [P] [US1] في `screens/zatca-settings/zatca-settings.html` — إضافة `sidebar.css` و`sidebar.js`
- [x] T030 [US1] في `screens/settings/settings.html` — إضافة `sidebar.js` (sidebar.css غير مطلوب لأن التنسيقات مدمجة) — تعديل `.s-body` layout لاستيعاب القائمة العامة جنباً إلى جنب مع القائمة الداخلية للإعدادات — التأكد من عدم التعارض بين الـ sidebar العام وتبويبات الإعدادات

**Checkpoint**: فتح أي شاشة → ظهور القائمة → النقر على رابط → الانتقال → الشاشة الجديدة تُظهر العنصر النشط

---

## Phase 4: User Story 2 — إخفاء القائمة على الجوال (Priority: P2)

**Goal**: القائمة تختفي تماماً على الشاشات الضيقة (< 768px) دون أثر على layout

**Independent Test**: فتح أي شاشة وتصغير عرض النافذة إلى أقل من 768px → لا تظهر القائمة ولا فراغ جانبي

### Implementation for User Story 2

- [x] T031 [US2] في `assets/sidebar.css` — إضافة `@media (max-width: 767px)` block: `#globalSidebar { display:none !important }` ومسح margin/padding أضافه الـ sidebar للمحتوى (إعادة عرض المحتوى لـ 100%)
- [x] T032 [US2] في `assets/sidebar.js` — إضافة `ResizeObserver` أو `window.resize` listener لإعادة حساب layout عند تغيير حجم النافذة بين الكمبيوتر والجوال دون تحديث الصفحة
- [x] T033 [US2] اختبار يدوي من `quickstart.md` سيناريو رقم 4: فتح DevTools → وضع الجوال → التحقق من اختفاء القائمة في جميع الشاشات المستهدفة

**Checkpoint**: الجوال يعمل كما كان قبل الميزة — لا قائمة، لا فراغ، المحتوى بعرض كامل

---

## Phase 5: User Story 3 — القائمة المطوية (Priority: P3)

**Goal**: زر يطوي القائمة إلى شريط أيقونات ضيق والحالة تُحفظ بين الجلسات

**Independent Test**: ضغط زر الطي → القائمة تتضيق → التنقل لشاشة أخرى → القائمة لا تزال مطوية → ضغط زر التوسيع → تعود

### Implementation for User Story 3

- [x] T034 [US3] في `assets/sidebar.js` — دالة `Sidebar.loadState()`: قراءة `localStorage.getItem('sidebar_collapsed')` وتطبيق كلاس `.gsb-collapsed` على `#globalSidebar` و `document.body` عند التحميل قبل الرسم
- [x] T035 [US3] في `assets/sidebar.js` — دالة `Sidebar.toggle()`: قلب حالة الطي → تحديث `localStorage` → تبديل `.gsb-collapsed` class → تشغيل CSS transition
- [x] T036 [US3] في `assets/sidebar.js` — ربط زر `.gsb-toggle` في الـ header بـ `Sidebar.toggle()` عند النقر
- [x] T037 [US3] في `assets/sidebar.css` — تنسيقات الحالة المطوية: `#globalSidebar.gsb-collapsed` → `width: var(--gsb-w-col)` و `.gsb-lbl { opacity:0; max-width:0 }` و`.gsb-sec { display:none }` مطابقة لتصميم settings sidebar المطوي (`.s-side.col`)
- [x] T038 [US3] في `assets/sidebar.css` — تنسيق body عند الطي: `body.gsb-collapsed-body .gsb-content-area` يضيق/يتسع ببطء مع الـ transition

**Checkpoint**: زر الطي يعمل، الحالة محفوظة، التنقل يعمل في الوضعين

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: تحسينات تشمل جميع الشاشات والتحقق النهائي

- [x] T039 [P] التحقق من دعم LTR: فتح أي شاشة وتغيير اللغة للإنجليزية → التحقق من أن القائمة تنتقل للجانب الأيسر (`html[dir="ltr"]` selectors في `assets/sidebar.css`)
- [x] T040 [P] في `assets/sidebar.css` — إضافة `@media print { #globalSidebar { display:none } }` لضمان عدم طباعة القائمة مع الفواتير
- [x] T041 التحقق من regression لشاشة POS: التأكد من أن الـ layout الداخلي (عربة التسوق، المنتجات، الكاشير) لا يتأثر
- [x] T042 التحقق من regression لشاشة الإعدادات: التأكد من أن تبويبات الإعدادات الداخلية (Laundry, Tax, Printer...) تعمل بشكل صحيح بجانب القائمة العامة
- [x] T043 تنفيذ سيناريوهات التحقق الكاملة من `specs/022-global-sidebar-navigation/quickstart.md` (السيناريوهات 1-7 + Regression Checks)
- [x] T044 [P] في `assets/sidebar.css` — تنسيقات Tooltip عند الطي: عند hover على أيقونة وهي مطوية يظهر tooltip يعرض اسم الشاشة

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: لا dependencies — يبدأ فوراً
- **Foundational (Phase 2)**: يتطلب Phase 1 — يحجب جميع User Stories
- **US1 (Phase 3)**: يتطلب Phase 2 — جميع مهام T013-T030 يمكن تنفيذها بالتوازي
- **US2 (Phase 4)**: يتطلب Phase 2 — مستقلة عن US1 نظرياً لكن يُفضَّل بعدها للتحقق الكامل
- **US3 (Phase 5)**: يتطلب Phase 2 — مستقلة، تعتمد على البنية التي بناها US1
- **Polish (Phase 6)**: يتطلب اكتمال US1 + US2 + US3

### User Story Dependencies

- **US1 (P1)**: يبدأ بعد Phase 2 — الأولوية القصوى (MVP)
- **US2 (P2)**: يبدأ بعد Phase 2 — مستقلة، تعديل CSS فقط
- **US3 (P3)**: يبدأ بعد Phase 2 — تبني على البنية الأساسية من US1

### داخل كل User Story

- T003-T005 (CSS) يمكن تنفيذها بالتوازي مع T006-T007 (JS data + render)
- T008-T011 تسلسلية (تعتمد على T007)
- T013-T029 كلها بالتوازي بعد اكتمال Phase 2

---

## Parallel Example: Phase 2 (Foundational)

```
T003 sidebar.css variables     ←─ بالتوازي ─→ T006 SIDEBAR_ITEMS array
T004 sidebar.css item styles   ←─ بالتوازي ─→ T007 Sidebar.render()
T005 sidebar.css layout        ←─ بالتوازي ─→ T012 i18n keys
                                        ↓
                               T008 detectActive()
                               T009 applyPermissions()
                               T010 setupNavigation()
                               T011 Sidebar.init()
```

## Parallel Example: Phase 3 (US1 — إضافة الشاشات)

```
T013 dashboard.html
T014 pos.html
T015 invoices.html
T016 credit-invoices.html    ← جميعها بالتوازي (ملفات مختلفة، لا تعارض)
T017 consumption-receipts.html
...
T029 zatca-settings.html
                    ↓
         T030 settings.html (يحتاج مراجعة دقيقة — أخيراً)
```

---

## Implementation Strategy

### MVP First (US1 فقط — يكفي للتسليم المبدئي)

1. ✅ Phase 1: Setup (T001-T002)
2. ✅ Phase 2: Foundational (T003-T012)
3. ✅ Phase 3: US1 (T013-T030)
4. **STOP & VALIDATE**: اختبار التنقل في جميع الشاشات
5. **تسليم**: القائمة تعمل على الكمبيوتر ✓

### Incremental Delivery

1. Phase 1 + 2 → المكوّن جاهز
2. Phase 3 (US1) → التنقل يعمل في جميع الشاشات (MVP ✓)
3. Phase 4 (US2) → الجوال لا يتأثر
4. Phase 5 (US3) → خيار الطي متاح
5. Phase 6 → Polish ونهائي

---

## Notes

- [P] = ملفات مختلفة، لا تعارض، يمكن التنفيذ بالتوازي
- شاشة POS (T014) تحتاج انتباهاً خاصاً بسبب تعقيد الـ layout — راجع `pos.js` و`pos.css` قبل التعديل
- شاشة الإعدادات (T030) لها sidebar داخلي — يجب التأكد من عدم التعارض
- CSS القائمة مستوحى من `screens/settings/settings.html` للحفاظ على التناسق البصري
- لا تغييرات على backend أو قاعدة البيانات
- i18n مفاتيح القائمة تُضاف لـ `assets/i18n.js` (T012)
