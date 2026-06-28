---

description: "Task list for تقرير الفنادق والشركات (كشف حساب وتقرير شامل)"
---

# Tasks: تقرير الفنادق والشركات (كشف حساب وتقرير شامل)

**Input**: Design documents from `/specs/031-hotels-companies-report/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-methods.md](contracts/api-methods.md)

**Tests**: لم تُطلب اختبارات آلية في المواصفة. التحقق يدوي عبر [quickstart.md](quickstart.md). لا مهام اختبار آلية.

**Organization**: المهام مجمّعة حسب قصص المستخدم (US1→US4) بترتيب الأولوية، كل قصة قابلة للتسليم/الاختبار مستقلاً.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: قابلة للتوازي (ملفات مختلفة، بلا اعتماديات على مهام غير مكتملة)
- **[Story]**: قصة المستخدم (US1..US4)
- كل مهمة تتضمن المسار الدقيق للملف

## ⚠️ قواعد حاكمة (من CLAUDE.md + plan.md)

- **قراءة فقط**: ممنوع أي `INSERT/UPDATE/DELETE/DDL` أو migration في كل مهام هذه الميزة.
- **نوع العميل**: استخدم القيمة `'corporate'` (وليست `'company'`) — `ENUM('individual','corporate')`.
- **MySQL 5.7**: لا window functions / CTEs — الدمج الزمني والرصيد التراكمي في Node.js.
- **النمط**: بيانات عبر `/api/invoke`؛ تصدير عبر `/api/export/*` + `exportBinary`. لا `fetch('/api/invoke')` مباشر في الشاشة.
- **رمز الريال**: `<span class="sar">&#xE900;</span>`. واجهة عربية RTL.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: تهيئة بنية الشاشة الجديدة

- [X] T001 إنشاء مجلد الشاشة `screens/reports/hotels-companies-report/` بثلاثة ملفات فارغة الهيكل: `hotels-companies-report.html`، `hotels-companies-report.js`، `hotels-companies-report.css` (بنفس boilerplate شاشة `screens/reports/customer-account-report/`: تضمين `web-api.js`، `i18n.js`، `auth-guard.js`، `sidebar.js`، `<html lang="ar" dir="rtl">`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: تسجيل التقرير في شبكة التقارير + الصلاحيات + بحث العميل المُعاد استخدامه. **يجب إكماله قبل أي قصة مستخدم** لأن كل القصص تُفتح من بطاقة التقرير وتعتمد على بحث العميل.

- [X] T002 [P] إضافة بطاقة التقرير `#cardHotelsCompaniesReport` في `screens/reports/reports.html` بعد `#cardCustomerAccountReport` (أيقونة SVG + `data-i18n="reports-card-hotels-companies-title"` و`...-desc`).
- [X] T003 [P] في `screens/reports/reports.js`: إضافة إدخال إلى مصفوفة `REPORT_CARDS` `{ id:'cardHotelsCompaniesReport', perm:'report_hotels_companies', url:'/screens/reports/hotels-companies-report/hotels-companies-report.html' }` وإضافة `'report_hotels_companies'` إلى مصفوفة فحص `hasSubPerms`.
- [X] T004 [P] في `screens/roles/roles.html`: إضافة checkbox صلاحية `data-perm="report_hotels_companies"` مع `data-i18n="roles-perm-report-hotels-companies"` بعد صلاحية `report_customer_account`.
- [X] T005 [P] في `assets/i18n.js`: إضافة المفاتيح العربية: `reports-card-hotels-companies-title`، `reports-card-hotels-companies-desc`، `roles-perm-report-hotels-companies`، ومفاتيح الشاشة (`hcr-title`, `hcr-from`, `hcr-to`, `hcr-customer`, `hcr-show`, `hcr-export-pdf`, `hcr-export-excel`, `hcr-empty`, ... إلخ).
- [X] T006 التحقق من وجود `api.getCorporateCustomers = (p) => invoke('getCorporateCustomers', p)` في `assets/web-api.js` وإضافتها إن لم تكن موجودة (الدالة + handler موجودان في `db.js`/`invokeHandlers.js`).

**Checkpoint**: بطاقة التقرير تظهر للمخوّلين وتفتح شاشة فارغة؛ بحث العميل المؤسسي متاح عبر `window.api`.

---

## Phase 3: User Story 1 — كشف حساب فندق/شركة محدد خلال فترة (Priority: P1) 🎯 MVP

**Goal**: عند اختيار عميل `corporate` + فترة، عرض كشف حساب تفصيلي (أوامر تشغيل + فواتير مجمعة) مع ملخص مالي ورصيد مستحق.

**Independent Test**: اختر عميل شركة له أوامر/فواتير مختلطة الحالة خلال فترة → "عرض" → تظهر كل الحركات بمجاميع صحيحة (مُشغَّل/مُفوتَر/مدفوع/مستحق) مطابقة للسجلات.

### Backend (4-step API)

- [X] T007 [US1] في `database/db.js`: إضافة دالة القراءة `getCorporateReportStatement({ customerId, dateFrom, dateTo, docType, status })`:
  - تحقق العميل `customer_type='corporate'` (خطأ عربي إن لا).
  - استعلام `work_orders` للعميل ضمن الفترة (LEFT JOIN `orders` على `consolidated_order_id` لجلب `consolidated_invoice_seq`).
  - استعلام `orders` حيث `COALESCE(is_consolidated,0)=1` للعميل ضمن الفترة (+ subquery لعدد أوامر التشغيل المضمَّنة).
  - استعلام واحد لأرقام D-XXX المضمَّنة لكل الفواتير (`order_items` JOIN `work_orders`) وتجميعها في Node.js.
  - حساب `summary{}` في Node.js (مُشغَّل=Σ wo.total غير الملغي، مُفوتَر، خصم، ضريبة، مدفوع=Σ paid_amount، مستحق=Σ remaining_amount، أعداد).
  - تطبيق فلاتر `docType`/`status` إن مُرِّرت. **قراءة فقط، MySQL 5.7-safe**. (انظر contracts §1 + data-model §1)
- [X] T008 [US1] في `server/invokeHandlers.js`: إضافة `case 'getCorporateReportStatement':` داخل `switch(method)` مع try/catch وشكل الاستجابة الموحّد ورسائل عربية، يستدعي `db.getCorporateReportStatement(payload)`.
- [X] T009 [US1] في `assets/web-api.js`: إضافة `api.getCorporateReportStatement = (p) => invoke('getCorporateReportStatement', p)`.

### Frontend (الشاشة)

- [X] T010 [US1] في `hotels-companies-report.html`: بناء شريط الفلاتر (حقلا تاريخ من/إلى، حقل بحث العميل + قائمة منسدلة، زر "عرض")، وحاويات: ترويسة بيانات العميل، شبكة بطاقات الملخص، جدول الكشف التفصيلي، حالة فارغة، حاوية تحميل. (مرجع: `customer-account-report.html`)
- [X] T011 [US1] في `hotels-companies-report.js`: تواريخ افتراضية (أول الشهر→الآن بنمط `pad()`)؛ بحث عميل debounce 300ms عبر `window.api.getCorporateCustomers({ search })` يملأ القائمة المنسدلة و`selectedCustomer`؛ التحقق من `dateFrom<=dateTo`.
- [X] T012 [US1] في `hotels-companies-report.js`: زر "عرض" عند وجود `selectedCustomer` يستدعي `window.api.getCorporateReportStatement(...)`، يدمج `workOrders[]`+`consolidatedInvoices[]` زمنياً ويحسب الرصيد التراكمي client-side، ويرسم الجدول وبطاقات الملخص؛ المستحق بلون أحمر والمدفوع بأخضر؛ رسالة فارغة واضحة عند لا حركات؛ إشارة "بدون رقم ضريبي" عند غيابه؛ toast للأخطاء.
- [X] T013 [P] [US1] في `hotels-companies-report.css`: تنسيق RTL للفلاتر والجدول وبطاقات الملخص وألوان مدين (أحمر)/دائن (أخضر) وشارات الحالة (في الانتظار/مُفوتر/ملغي/آجل/مدفوع).

**Checkpoint**: US1 كاملة ومستقلة — كشف حساب تفصيلي يعمل end-to-end (SC-001, SC-002, SC-007).

---

## Phase 4: User Story 2 — طباعة وتصدير كشف الحساب PDF/Excel (Priority: P1)

**Goal**: تصدير الكشف المعروض كـ PDF A4 احترافي (RTL، شعار، رقمان ضريبيان) و Excel، مع إعادة بناء البيانات على الخادم.

**Independent Test**: من كشف حساب معروض → "تصدير PDF" يُنتج A4 كامل العناصر RTL؛ "تصدير Excel" يفتح بمجاميع مطابقة.

- [X] T014 [US2] في `server/services/exportsService.js`: إضافة `exportHotelsCompaniesReport(type, body)` (`type:'pdf'|'excel'`) يعيد بناء البيانات باستدعاء `db.getCorporateReportStatement`/`db.getCorporateReportSummary` حسب `body.mode`؛ PDF عبر `cairoFonts()` + خط `SaudiRiyal` + RTL + ترويسة `branding.js` (شعار/اسم/رقم ضريبي للمنشأة) + بيانات العميل + الفترة + الجدول + الملخص + الرصيد الختامي + `thead` متكرر؛ Excel بنمط جداول التقارير الحالية + صف مجاميع. (مرجع: `exportCustomerAccountReport` السطر ~1303)
- [X] T015 [US2] إضافة `exportHotelsCompaniesReport` إلى `module.exports` في `server/services/exportsService.js`.
- [X] T016 [US2] في `server/index.js`: إضافة `app.post('/api/export/hotels-companies-report', authMiddleware, async (req,res) => {...})` يستدعي `exportsService.exportHotelsCompaniesReport(req.body.type, req.body)` ويعيد الملف الثنائي مع `Content-Disposition` (مرجع: route `/api/export/customer-account-report` السطر ~507).
- [X] T017 [US2] في `assets/web-api.js`: إضافة `api.exportHotelsCompaniesReport = (d) => exportBinary('/api/export/hotels-companies-report', d)`.
- [X] T018 [US2] في `hotels-companies-report.html` + `hotels-companies-report.js`: إضافة زرّي "تصدير PDF" و"تصدير Excel" يستدعيان `window.api.exportHotelsCompaniesReport({ ...الفلاتر الحالية, mode, type })` مع تعطيل الأزرار أثناء التصدير وtoast عند الخطأ.

**Checkpoint**: US2 كاملة — تصدير PDF/Excel للكشف التفصيلي يعمل (SC-003, SC-004).

---

## Phase 5: User Story 3 — نظرة إجمالية على كل الفنادق والشركات (Priority: P2)

**Goal**: عند ترك العميل فارغاً، عرض جدول ملخّص لكل شركة نشطة + إجمالي كلي + نقر صف للانتقال للتفصيل + تصدير الملخص.

**Independent Test**: اترك العميل فارغاً + فترة بها عدة شركات → "عرض" → صف لكل شركة + إجمالي كلي مطابق؛ نقر صف يفتح التفصيل.

- [X] T019 [US3] في `database/db.js`: إضافة `getCorporateReportSummary({ dateFrom, dateTo, search })` — صف لكل عميل `corporate` نشط في الفترة عبر subqueries مرتبطة (wo_count, total_work_ordered للأوامر غير الملغية, inv_count, total_invoiced, total_paid, total_outstanding) مع `HAVING` للنشطين فقط؛ حساب `totals{}` في Node.js. **قراءة فقط، MySQL 5.7-safe**. (contracts §2 + data-model §2)
- [X] T020 [US3] في `server/invokeHandlers.js`: إضافة `case 'getCorporateReportSummary':` (try/catch، شكل موحّد، رسائل عربية).
- [X] T021 [US3] في `assets/web-api.js`: إضافة `api.getCorporateReportSummary = (p) => invoke('getCorporateReportSummary', p)`.
- [X] T022 [US3] في `hotels-companies-report.html`: إضافة حاوية/جدول الملخص (أعمدة: الاسم، عدد الأوامر، المُشغَّل، عدد الفواتير، المُفوتَر، المدفوع، المستحق) + صف الإجمالي الكلي.
- [X] T023 [US3] في `hotels-companies-report.js`: زر "عرض" عند عدم وجود `selectedCustomer` يستدعي `getCorporateReportSummary` ويرسم جدول الملخص؛ نقر صف شركة يضبط `selectedCustomer` ويُحمّل كشفها التفصيلي لنفس الفترة (يعيد استخدام منطق US1).
- [X] T024 [P] [US3] في `hotels-companies-report.css`: تنسيق جدول الملخص + صف الإجمالي + مؤشّر النقر على الصفوف (hover/cursor).
- [X] T025 [US3] في `hotels-companies-report.js`: تمكين "تصدير Excel/PDF" في وضع الملخص (تمرير `mode:'summary'`)؛ يعتمد على دالة التصدير من T014 التي تدعم الوضعين.

**Checkpoint**: US3 كاملة — الملخص الكلي والتنقّل للتفصيل والتصدير يعمل.

---

## Phase 6: User Story 4 — تصفية الحركات حسب النوع والحالة (Priority: P3)

**Goal**: داخل الكشف التفصيلي، تصفية النوع (أوامر تشغيل/فواتير مجمعة) والحالة، مع تحديث المجاميع وزر إعادة تعيين.

**Independent Test**: فعّل "فواتير مجمعة آجلة فقط" → تختفي بقية الأنواع وتتحدث المجاميع؛ "إعادة تعيين" يعيد الكل.

- [X] T026 [US4] في `hotels-companies-report.html`: إضافة عناصر فلترة النوع (`docType`) والحالة (`status`) + زر "إعادة تعيين" داخل قسم الكشف التفصيلي.
- [X] T027 [US4] في `hotels-companies-report.js`: تطبيق الفلترة على الجدول المعروض وتحديث المجاميع المعروضة (client-side على نتيجة US1، أو تمرير `docType/status` إلى `getCorporateReportStatement`)؛ زر "إعادة تعيين" يعيد عرض كل الحركات.

**Checkpoint**: US4 كاملة — التصفية تعمل دون كسر US1/US2/US3.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: تحقّق نهائي وصقل

- [X] T028 [P] التحقق من I18N: كل النصوص الظاهرة عربية وعبر `data-i18n`؛ `I18N.apply()` و`enableArabicPrint()` مستدعاة في الشاشة.
- [ ] T029 [P] تحقق الأداء: عرض عميل بمئات المستندات < 3 ثوانٍ دون تجميد الواجهة (SC-005)؛ ضبط حدود/فهرسة عند اللزوم (الفهارس موجودة من 030: `idx_wo_customer`, `idx_wo_created_at`).
- [ ] T030 تنفيذ كل سيناريوهات [quickstart.md](quickstart.md) (US1→US4 + الحواف: فترة فارغة، بدون رقم ضريبي، من>إلى، أمر ملغي).
- [ ] T031 فحوص الانحدار (SC-006): POS لعميل فرد + إصدار فاتورة مجمعة (030) + تقرير كشف حساب العميل (003) + باقي التقارير تعمل بلا تغيير؛ تأكيد عدم وجود أي migration أو تغيير schema.
- [ ] T032 [P] التحقق من مطابقة المجاميع (SC-002): مقارنة مُشغَّل/مُفوتَر/مدفوع/مستحق في التقرير مع شاشة الفنادق وسجلات `orders`/`work_orders` لعينة عملاء.

---

## Dependencies & Execution Order

```
Phase 1 (Setup: T001)
   └─> Phase 2 (Foundational: T002–T006)   ← يحجب كل القصص
          ├─> Phase 3 US1 (T007–T013)      ← MVP
          │      ├─> Phase 4 US2 (T014–T018)  [يعتمد على db.getCorporateReportStatement من US1]
          │      └─> Phase 6 US4 (T026–T027)  [يعتمد على عرض US1]
          └─> Phase 5 US3 (T019–T025)      [مستقل عن US1 في الـ backend؛ يعيد استخدام عرض US1 عند النقر]
                 └─ T025 يعتمد على T014 (دالة التصدير تدعم mode='summary')
   └─> Phase 7 (Polish: T028–T032)         ← بعد القصص المستهدفة
```

**اعتماديات صريحة**:
- US2 (التصدير) يعتمد على `db.getCorporateReportStatement` (T007) و`getCorporateReportSummary` (T019) لإعادة البناء على الخادم — أنجز T014 بعد T007؛ ودعم وضع الملخص في التصدير يكتمل مع T019.
- US4 يعتمد على عرض US1 (T012).
- T025 (تصدير الملخص) يعتمد على T014.

---

## Parallel Opportunities

- **Phase 2** كلها متوازية تقريباً: T002, T003, T004, T005 [P] (ملفات مختلفة) ثم T006.
- **داخل US1**: T013 [P] (CSS) بالتوازي مع منطق JS؛ T007→T008→T009 متسلسلة (نفس تدفق API).
- **داخل US3**: T024 [P] (CSS) بالتوازي.
- **Phase 7**: T028, T029, T032 [P] بالتوازي.

**مثال توازي Phase 2**:
```
T002 [P] reports.html card
T003 [P] reports.js registration
T004 [P] roles.html permission
T005 [P] i18n.js keys
(ثم) T006 web-api getCorporateCustomers check
```

---

## Implementation Strategy

- **MVP = Phase 1 + Phase 2 + Phase 3 (US1)**: كشف حساب تفصيلي يعمل ويُسلِّم القيمة الأساسية للمواصفة.
- **الزيادة التالية**: US2 (تصدير) — تكمّل القيمة التشغيلية (P1).
- **ثم**: US3 (ملخص كل الشركات، P2) → US4 (تصفية، P3).
- كل قصة قابلة للتسليم والاختبار مستقلاً عند نقطة Checkpoint الخاصة بها.
- بعد كل قصة: نفّذ فحوص الانحدار ذات الصلة من Phase 7 (لا تنتظر النهاية للتحقق من عدم وجود انحدار).
