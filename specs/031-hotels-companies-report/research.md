# Research: تقرير الفنادق والشركات

**Feature**: `031-hotels-companies-report`
**Date**: 2026-06-28

> كل عناصر "NEEDS CLARIFICATION" حُسمت أدناه. التقرير قراءة فقط يبني على ميزة 030.

---

## D1 — قيمة نوع العميل المؤسسي في قاعدة البيانات

- **Decision**: استخدام `customer_type = 'corporate'`.
- **Rationale**: قراءة الكود الفعلي: `customers.customer_type ENUM('individual','corporate') DEFAULT 'individual'`
  (db.js:1364)، ودالة `createConsolidatedInvoice` ترفض `customer_type !== 'corporate'` (db.js:8626).
  المواصفة استخدمت كلمة "company/شركة" وصفياً، لكن القيمة المخزّنة هي `corporate`.
- **Alternatives considered**: استخدام `'company'` — مرفوض لأنه لا يطابق ENUM الفعلي وسيُرجع نتائج فارغة.

---

## D2 — مصادر البيانات وعدم الحاجة لأي migration

- **Decision**: لا migration ولا تغيير schema إطلاقاً. القراءة من جداول موجودة:
  - `work_orders` (D-XXX، subtotal/discount/vat/total، status، consolidated_order_id، created_at)
  - `work_order_items` (بنود الأمر — للعرض التفصيلي عند الحاجة)
  - `orders` حيث `is_consolidated=1` (الفاتورة المجمعة: invoice_seq، payment_status، paid_amount، remaining_amount)
  - `order_items.work_order_id` (ربط بنود الفاتورة بأوامر التشغيل لاستخراج أرقام D-XXX المضمَّنة)
  - `customers` (الاسم، الجوال، tax_number، customer_type)
- **Rationale**: ميزة 030 أنشأت كل هذه الحقول بالفعل (مؤكَّد من db.js: migrations في الأسطر 213-292).
  التقرير تحليلي/عرضي بحت.
- **Alternatives considered**: جدول تجميع/مادي (materialized) — مرفوض: تعقيد وكتابة لا مبرر لها لتقرير قراءة.

---

## D3 — حساب "المُشغَّل / المُفوتَر / المدفوع / المستحق"

- **Decision**:
  - **المُشغَّل (Work Ordered)** = Σ `work_orders.total_amount` حيث `status <> 'cancelled'`.
  - **المُفوتَر (Invoiced)** = Σ `orders.total_amount` حيث `is_consolidated=1`.
  - **المدفوع (Paid)** = Σ `orders.paid_amount` للفواتير المجمعة.
  - **المستحق الآجل (Outstanding)** = Σ `orders.remaining_amount` للفواتير المجمعة (تظهر مديونية فقط على `payment_status` آجل/جزئي).
- **Rationale**: أعمدة `paid_amount`/`remaining_amount`/`payment_status` تُكتب فعلياً عند إنشاء الفاتورة المجمعة
  (مؤكَّد من INSERT في db.js:8820). أوامر التشغيل في الانتظار "مُشغَّلة وغير مفوترة" وليست مديونية مستحقة.
- **Alternatives considered**: احتساب المعلّق (pending work orders) ضمن المديونية — مرفوض: غير صحيح محاسبياً
  لأن المديونية لا تنشأ إلا بعد إصدار الفاتورة. (موثّق في Assumptions بالمواصفة.)

---

## D4 — تجنّب window functions (MySQL 5.7) للرصيد التراكمي والدمج الزمني

- **Decision**: SQL يعيد صفوفاً خاماً مفروزة؛ الدمج الزمني (work_orders + consolidated invoices)
  وحساب الرصيد التراكمي (running balance) يتمّان في Node.js.
- **Rationale**: MySQL 5.7 لا يدعم `ROW_NUMBER()/OVER()` ولا CTEs. الحساب التطبيقي بسيط وآمن (CLAUDE.md §6).
- **Alternatives considered**: متغيّرات الجلسة `@running := @running + x` — مرفوضة: هشّة، سلوك غير محدّد في 5.7
  مع ORDER BY، ويُعقّد الصيانة.

---

## D5 — نمط التصدير (PDF/Excel)

- **Decision**: إعادة استخدام النمط الموجود بالكامل:
  - `web-api.js`: `exportHotelsCompaniesReport = (d) => exportBinary('/api/export/hotels-companies-report', d)`.
  - `index.js`: route جديد تحت `/api/export/*` محمي بـ `authMiddleware`.
  - `exportsService.js`: دالة `exportHotelsCompaniesReport(type, body)` تعيد بناء البيانات على الخادم ثم تولّد المخرَج.
  - PDF: HTML→PDF مع `cairoFonts()` وخط `SaudiRiyal`، RTL، ترويسة `branding.js`.
  - Excel: نفس نمط جداول التقارير الحالية في `exportsService`.
- **Rationale**: المرجع الأقرب `exportCustomerAccountReport` (exportsService.js:1303) و
  `exportConsolidatedWorkOrdersList` (1540) — نمط مثبت يعمل في الإنتاج. إعادة البناء على الخادم تتفادى الثقة ببيانات العميل.
- **Alternatives considered**: توليد PDF في المتصفح (window.print) — مرفوض: التقارير في هذا المشروع تُصدَّر server-side
  لضمان الخطوط والشعار والرقم الضريبي ورمز الريال بثبات.

---

## D6 — التسجيل في شاشة التقارير والصلاحيات

- **Decision**: صلاحية جديدة `report_hotels_companies`؛ بطاقة في `reports.html` + إدخال في `REPORT_CARDS`
  بـ `reports.js` + checkbox في `roles.html` + مفاتيح i18n عربية.
- **Rationale**: نمط موحّد لكل التقارير (reports.js:4-15). admin يتجاوز الفحص؛ الإرث (legacy) بلا sub-perms يرى الكل.
- **Alternatives considered**: إعادة استخدام `report_customer_account` — مرفوض: تقريران مختلفان وظيفياً ويجب فصل الصلاحية.

---

## D7 — العلاقة بتقرير "كشف حساب العميل" الموجود (003)

- **Decision**: تقرير منفصل تماماً مخصّص للقطاع المؤسسي (أوامر تشغيل + فواتير مجمعة)، لا يستبدل ولا يعدّل تقرير 003.
- **Rationale**: تقرير 003 (`customer-account-report`) يغطي الأفراد والاشتراكات والإيصالات والرصيد العام؛
  هذا التقرير يركّز على دورة الفنادق/الشركات (D-XXX → فاتورة مجمعة). دمجهما يعقّد كليهما.
- **Alternatives considered**: توسيع 003 بوضع "corporate" — مرفوض: يخالف مبدأ الشاشة المستقلة ويخاطر بانحدار تقرير قائم.

---

## ملخص القرارات

| # | القرار |
|---|--------|
| D1 | `customer_type = 'corporate'` (لا 'company') |
| D2 | لا migration — قراءة فقط من جداول 030 الموجودة |
| D3 | مُشغَّل = Σ wo.total (غير ملغي)؛ مستحق = Σ orders.remaining_amount للفواتير المجمعة |
| D4 | الدمج الزمني + الرصيد التراكمي في Node.js (تجنّب window functions) |
| D5 | تصدير server-side (PDF cairoFonts/RTL + Excel) بنمط exportsService الموجود |
| D6 | صلاحية `report_hotels_companies` + بطاقة تقرير جديدة |
| D7 | تقرير مستقل عن تقرير كشف حساب العميل 003 |
