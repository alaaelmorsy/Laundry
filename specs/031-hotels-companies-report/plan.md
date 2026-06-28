# Implementation Plan: تقرير الفنادق والشركات (كشف حساب وتقرير شامل)

**Branch**: `031-hotels-companies-report` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/031-hotels-companies-report/spec.md`

---

## Summary

إضافة تقرير جديد **للقراءة فقط** في شاشة التقارير، خاص بالقطاع المؤسسي (الفنادق/الشركات)، يبني على ميزة 030 الموجودة. يعمل بوضعين:

1. **كشف حساب تفصيلي (عميل واحد)**: عند اختيار عميل `customer_type='corporate'` + فترة → جدول زمني موحّد يدمج أوامر التشغيل (`work_orders`, D-XXX) والفواتير المجمعة (`orders.is_consolidated=1`) مع ملخص مالي (مُشغَّل / مُفوتَر / مدفوع / مستحق آجل).
2. **نظرة إجمالية (كل الشركات)**: عند ترك العميل فارغاً → صف لكل عميل مؤسسي نشط في الفترة + إجمالي كلي.

التصدير (PDF A4 / Excel) عبر نفس البنية التحتية الموجودة (`exportsService` + route تحت `/api/export/*`).

**الاكتشاف الرئيسي**: كل البيانات المطلوبة موجودة بالفعل من ميزة 030 — `work_orders`, `work_order_items`, `orders.is_consolidated`, `order_items.work_order_id`, `customers.customer_type/tax_number`, و `getCorporateCustomers()` موجودة بالفعل في `db.js`. **لا migration مطلوبة على الإطلاق** — هذا تقرير قراءة فقط.

**تصحيح مهم من قراءة الكود**: قيمة نوع العميل المؤسسي في قاعدة البيانات هي `'corporate'` (وليست `'company'`) — `ENUM('individual','corporate')`. كل الكود الجديد يجب أن يستخدم `'corporate'`.

---

## Technical Context

**Language/Version**: Node.js 20 (CommonJS), Vanilla JS (no framework)

**Backend**: Express.js + `mysql2/promise` — no ORM

**Frontend**: Vanilla JS + Tailwind CSS — no bundler, no TypeScript

**Storage**: MySQL/MariaDB — InnoDB, utf8mb4, `DECIMAL(10,2)` for money (للقراءة فقط — لا كتابة)

**MySQL Compatibility**: MySQL 5.7 — لا window functions، لا CTEs، لا `LATERAL`. التقرير يستخدم
`SELECT` بسيط مع `JOIN` و `UNION ALL` و derived tables و `GROUP BY` فقط — كلها متوافقة 5.7.
التجميع الزمني والرصيد التراكمي يتمّان في Node.js (application-side) لتجنّب أي window function.

**Target Platform**: Windows 10/11 — bundled as `.exe` via `@yao-pkg/pkg`

**Deployment**: Windows Service (NSSM) — single-tenant on-premise

**API Pattern**: `POST /api/invoke` → `invokeHandlers.js` → `db.js` (للبيانات)؛
`POST /api/export/*` في `server/index.js` → `exportsService.js` (للتصدير الثنائي)

**Screen Pattern**: `screens/reports/hotels-companies-report/hotels-companies-report.{html,js,css}` (self-contained)

**Constraints**: No ES modules server-side. No shared components across screens. لا تعديل/كتابة أي مستند مالي.

**Reuse الموجود**:
- `db.getCorporateCustomers({ search, page, pageSize })` — موجودة (db.js:8925) لاختيار/بحث العميل.
- نمط بطاقات التقارير في `reports.js` + `reports.html` (صلاحيات `report_*`).
- نمط التصدير: `exportBinary()` في `web-api.js` + route في `index.js` + دالة في `exportsService.js`
  (المرجع الأقرب: `exportCustomerAccountReport` و `exportConsolidatedWorkOrdersList`).
- شعار/رقم المنشأة الضريبي من `branding.js` (كما في باقي التقارير).
- خطوط cairo في PDF عبر `cairoFonts()` في `exportsService.js`.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Priority Order Compliance

| Priority | Concern | Impact on This Feature |
|----------|---------|----------------------|
| 1 | Data integrity | تقرير **قراءة فقط** — صفر كتابة/تعديل/حذف. لا transactions. لا مخاطر على سلامة البيانات. |
| 2 | ZATCA compliance | لا مساس — لا يُنشأ مستند ضريبي ولا يُرسل/يُعدّل أي شيء لـ ZATCA. أعمدة ZATCA على `orders` تُقرأ فقط للعرض المرجعي إن لزم. |
| 3 | Workflow stability | لا تعديل على POS أو createOrder أو createConsolidatedInvoice. كود قراءة جديد منفصل تماماً. |
| 4 | Backward compatibility | لا migration، لا تغيير schema، لا تغيير على أي API موجود. شاشة + method + export route جديدة فقط. |
| 5 | Correct business behavior | المبالغ تُعرض كما خُزِّنت في المستندات (لا إعادة حساب). المستحق من الفواتير المجمعة الآجلة فقط. |

### 4-Step API Checklist

| Method Name | db.js | invokeHandlers.js | web-api.js | Screen JS |
|-------------|-------|-------------------|------------|-----------|
| `getCorporateReportStatement` (عميل واحد: كشف تفصيلي) | ☐ | ☐ | ☐ | ☐ (hotels-companies-report.js) |
| `getCorporateReportSummary` (كل الشركات: ملخص) | ☐ | ☐ | ☐ | ☐ (hotels-companies-report.js) |
| `getCorporateCustomers` (بحث العميل) | ✅ موجودة | ✅ موجودة | ☐ تحقّق/أضف | ☐ (hotels-companies-report.js) |

> ملاحظة: `getCorporateCustomers` موجودة في db.js + invokeHandlers.js. يجب التحقق من وجود
> `api.getCorporateCustomers` في web-api.js وإضافتها إن لزم (الخطوة 3 من checklist).

**التصدير (نمط مستقل عن invoke — route ثنائي):**

| Export | exportsService.js | index.js route | web-api.js | Screen JS |
|--------|-------------------|----------------|------------|-----------|
| `exportHotelsCompaniesReport(type, body)` (PDF+Excel) | ☐ | ☐ `/api/export/hotels-companies-report` | ☐ `exportHotelsCompaniesReport` | ☐ |

### Forbidden Changes Proximity

| # | Forbidden Area | Proximity | Mitigation |
|---|---------------|-----------|------------|
| 7 | ZATCA submission workflow | بعيد (قراءة فقط) | لا قراءة/كتابة لأعمدة ZATCA إلا للعرض إن لزم — لا استدعاء لأي مسار إرسال |
| 10 | DDL from invokeHandlers | غير منطبق | لا DDL إطلاقاً — لا migration |
| 3 | fetch('/api/invoke') مباشر | تجنُّب | كل نداءات البيانات عبر `window.api.*`؛ التصدير عبر `exportBinary` الموجود |

### MySQL 5.7 Compatibility

- [x] All SQL uses only MySQL 5.7 compatible syntax (SELECT/JOIN/UNION ALL/GROUP BY/derived tables)
- [x] No window functions — الرصيد التراكمي والدمج الزمني في Node.js (application-side)
- [x] No `WITH`/CTEs, `WITH RECURSIVE`, `JSON_TABLE`, `LATERAL`, or invisible columns

## Feature Impact Checklist

| Area | Affected? | What Changes / What to Verify |
|------|-----------|-------------------------------|
| **Database** | ☐ No | **لا migration، لا schema change** — قراءة فقط من جداول موجودة (`work_orders`, `orders`, `order_items`, `customers`) |
| **POS Checkout** | ☐ No | لا مساس بـ `createOrder` ولا مسار POS |
| **ZATCA** | ☐ No | أعمدة ZATCA على `orders` لا تُكتب؛ لا إرسال/تعديل |
| **Subscriptions** | ☐ No | لا علاقة بالاشتراكات |
| **Payments** | ☐ No | لا منطق سداد — يُقرأ `payment_status/paid_amount/remaining_amount` للعرض فقط |
| **Printing** | ☑ Yes | A4 PDF عبر `exportsService` (RTL، شعار، رقم ضريبي، تكرار الترويسة). لا طباعة حرارية. لا مساس بقياسات 76mm |
| **Backward Compatibility** | ☑ Yes | إضافات فقط (شاشة + 2 method + 1 export route + بطاقة تقرير + صلاحية). صفر تغيير على API/schema قائم |

## Project Structure

### Documentation (this feature)

```text
specs/031-hotels-companies-report/
├── plan.md              # هذا الملف (/speckit-plan output)
├── spec.md
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (شكل البيانات المقروءة + شكل الاستجابة)
├── contracts/
│   └── api-methods.md   # عقود الـ methods + export route
├── quickstart.md        # Phase 1 output (سيناريوهات تحقّق يدوية)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (this feature)

```text
database/db.js
  query functions (قراءة فقط — لا migration):
    getCorporateReportStatement({ customerId, dateFrom, dateTo, docType, status })
      -- يجمع work_orders + orders(is_consolidated=1) لعميل واحد داخل الفترة
      -- يعيد: customer{}, workOrders[], consolidatedInvoices[], summary{}
    getCorporateReportSummary({ dateFrom, dateTo, search })
      -- صف لكل عميل corporate نشط في الفترة + totals{}
    (getCorporateCustomers — موجودة، تُعاد استخدامها)

server/invokeHandlers.js
  -- case 'getCorporateReportStatement'
  -- case 'getCorporateReportSummary'
  -- (getCorporateCustomers — موجودة)

server/index.js
  -- app.post('/api/export/hotels-companies-report', authMiddleware, ...)

server/services/exportsService.js
  -- exportHotelsCompaniesReport(type, body)  // type: 'pdf' | 'excel'
  -- يُضاف إلى module.exports

assets/web-api.js
  -- api.getCorporateReportStatement = (p) => invoke('getCorporateReportStatement', p)
  -- api.getCorporateReportSummary   = (p) => invoke('getCorporateReportSummary', p)
  -- api.getCorporateCustomers       = (p) => invoke('getCorporateCustomers', p)   // تحقّق/أضف
  -- api.exportHotelsCompaniesReport = (d) => exportBinary('/api/export/hotels-companies-report', d)

screens/reports/hotels-companies-report/
  hotels-companies-report.html   -- فلاتر (فترة + بحث عميل corporate) + جدول كشف + جدول ملخص + أزرار تصدير
  hotels-companies-report.js     -- المنطق: بحث عميل، عرض، تبديل وضعَي تفصيل/ملخص، فلاتر، تصدير
  hotels-companies-report.css    -- التنسيق (RTL، ألوان مدين/دائن)

screens/reports/reports.html
  -- بطاقة جديدة #cardHotelsCompaniesReport (بعد cardCustomerAccountReport)

screens/reports/reports.js
  -- إضافة { id:'cardHotelsCompaniesReport', perm:'report_hotels_companies', url:'.../hotels-companies-report.html' }
  -- إضافة 'report_hotels_companies' إلى مصفوفة hasSubPerms

screens/roles/roles.html
  -- checkbox صلاحية جديدة data-perm="report_hotels_companies"

assets/i18n.js
  -- مفاتيح: reports-card-hotels-companies-title/desc, roles-perm-report-hotels-companies,
     ومفاتيح الشاشة الجديدة (hcr-*) عربي
```

---

## تفاصيل التنفيذ الحرجة

### 1. استعلام كشف الحساب التفصيلي (عميل واحد) — `getCorporateReportStatement`

منطق القراءة (كله MySQL 5.7-safe):

```
أ) العميل: SELECT id, customer_name, phone, tax_number, customer_type
           FROM customers WHERE id = ? AND customer_type = 'corporate'
           (إن لم يكن corporate → خطأ عربي)

ب) أوامر التشغيل خلال الفترة:
   SELECT wo.id, wo.work_order_number, wo.work_order_seq, wo.status, wo.created_at,
          wo.subtotal, wo.discount_amount, wo.vat_amount, wo.total_amount,
          wo.consolidated_order_id, o.invoice_seq AS consolidated_invoice_seq
   FROM work_orders wo
   LEFT JOIN orders o ON o.id = wo.consolidated_order_id
   WHERE wo.customer_id = ? AND wo.created_at BETWEEN ? AND ?
   [+ AND wo.status = ? عند فلتر الحالة]
   ORDER BY wo.created_at

ج) الفواتير المجمعة خلال الفترة:
   SELECT o.id, o.invoice_seq, o.order_number, o.created_at, o.subtotal,
          o.discount_amount, o.vat_amount, o.total_amount,
          o.payment_status, o.paid_amount, o.remaining_amount,
          (SELECT COUNT(DISTINCT oi.work_order_id) FROM order_items oi
            WHERE oi.order_id = o.id AND oi.work_order_id IS NOT NULL) AS work_orders_count
   FROM orders o
   WHERE o.customer_id = ? AND COALESCE(o.is_consolidated,0) = 1
     AND o.created_at BETWEEN ? AND ?
   ORDER BY o.created_at

د) أرقام D-XXX المضمَّنة بكل فاتورة (للعرض): استعلام واحد لكل الفواتير معاً
   SELECT DISTINCT oi.order_id, wo.work_order_number
   FROM order_items oi JOIN work_orders wo ON wo.id = oi.work_order_id
   WHERE oi.order_id IN (...) → تجميع في Node.js

هـ) الملخص (يُحسب في Node.js من النتائج):
   totalWorkOrdered   = Σ total_amount للأوامر status != 'cancelled'
   totalInvoiced      = Σ total_amount للفواتير المجمعة
   totalDiscount      = Σ discount_amount (أوامر غير ملغية + فواتير) [وفق العرض]
   totalVat           = Σ vat_amount
   totalPaid          = Σ paid_amount للفواتير المجمعة
   totalOutstanding   = Σ remaining_amount للفواتير المجمعة (payment_status='pending'/'partial')
```

**الرصيد التراكمي والدمج الزمني** يتمّان في Node.js (دمج المصفوفتين، فرز بالتاريخ، حساب running balance) — تفادياً لأي window function.

### 2. استعلام الملخص (كل الشركات) — `getCorporateReportSummary`

```
SELECT  c.id, c.customer_name, c.tax_number,
        (SELECT COUNT(*) FROM work_orders wo
           WHERE wo.customer_id=c.id AND wo.status<>'cancelled'
             AND wo.created_at BETWEEN ? AND ?) AS wo_count,
        (SELECT COALESCE(SUM(wo.total_amount),0) FROM work_orders wo
           WHERE wo.customer_id=c.id AND wo.status<>'cancelled'
             AND wo.created_at BETWEEN ? AND ?) AS total_work_ordered,
        (SELECT COUNT(*) FROM orders o
           WHERE o.customer_id=c.id AND COALESCE(o.is_consolidated,0)=1
             AND o.created_at BETWEEN ? AND ?) AS inv_count,
        (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o
           WHERE o.customer_id=c.id AND COALESCE(o.is_consolidated,0)=1
             AND o.created_at BETWEEN ? AND ?) AS total_invoiced,
        (SELECT COALESCE(SUM(o.paid_amount),0) FROM orders o ... ) AS total_paid,
        (SELECT COALESCE(SUM(o.remaining_amount),0) FROM orders o ... ) AS total_outstanding
FROM customers c
WHERE c.customer_type = 'corporate'
HAVING (wo_count > 0 OR inv_count > 0)   -- نشط في الفترة فقط
ORDER BY total_outstanding DESC, c.customer_name
```

> subqueries مرتبطة — متوافقة 5.7. `HAVING` على aliases مدعوم في 5.7. الإجمالي الكلي يُحسب في Node.js.

### 3. التصدير `exportHotelsCompaniesReport(type, body)`

- `body` يحمل: `mode` ('detail'|'summary')، `customerId`، `dateFrom`، `dateTo`، `docType`، `status`.
- الخادم يعيد استدعاء نفس دوال db (`getCorporateReportStatement`/`getCorporateReportSummary`) لإعادة بناء البيانات على الخادم (لا يثق ببيانات العميل) → ثم يولّد المخرَج.
- **PDF**: HTML→PDF بنفس نمط `exportCustomerAccountReport` (cairoFonts، RTL، ترويسة `branding.js`: شعار + اسم + رقم ضريبي للمنشأة، ثم بيانات العميل، الفترة، الجدول، الملخص، الرصيد الختامي؛ `thead` يتكرر لكل صفحة عبر `display:table-header-group`).
- **Excel**: نفس نمط الـ Excel في التقارير الأخرى (HTML table بترميز `.xls`/SpreadsheetML المستخدم حالياً في `exportsService`) بأعمدة الجدول + صف مجاميع.
- رمز الريال: `<span class="sar">&#xE900;</span>` مع تضمين خط `SaudiRiyal` كما في باقي التقارير.

### 4. سلوك الواجهة (hotels-companies-report.js)

- تواريخ افتراضية: أول الشهر الحالي → الآن (مطابقة لروح spec؛ نمط `pad()` كما في customer-account-report.js).
- بحث العميل: debounce 300ms عبر `window.api.getCorporateCustomers({ search })` — قائمة منسدلة، اختيار يملأ `selectedCustomer`.
- زر "عرض":
  - إن وُجد `selectedCustomer` → `getCorporateReportStatement` → عرض كشف تفصيلي + ملخص مالي.
  - إن لم يوجد → `getCorporateReportSummary` → جدول ملخص الشركات (نقر صف → يحمّل تفصيل ذلك العميل).
- فلاتر النوع/الحالة (P3): تصفية client-side على الجدول المعروض + تحديث المجاميع المعروضة، أو تمرير `docType/status` للخادم.
- أزرار "تصدير Excel" / "تصدير PDF" → `window.api.exportHotelsCompaniesReport({...filters, type})`.
- ألوان: المستحق أحمر، المدفوع أخضر (CSS classes).
- التحقق: من ≤ إلى قبل الاستدعاء؛ رسائل فارغة واضحة؛ toast للأخطاء.

### 5. التسجيل في شاشة التقارير والصلاحيات

- بطاقة جديدة في `reports.html` بعد `cardCustomerAccountReport` بمعرّف `cardHotelsCompaniesReport`.
- في `reports.js`: إضافة الإدخال للمصفوفة `REPORT_CARDS` + إضافة `report_hotels_companies` لمصفوفة فحص `hasSubPerms`.
- في `roles.html`: checkbox `data-perm="report_hotels_companies"`.
- admin يرى كل شيء (bypass)؛ المستخدمون يخضعون للصلاحية الجديدة.

---

## Complexity Tracking

لا توجد مخالفات للـ Constitution. التقرير قراءة فقط، يعيد استخدام بنية تحتية قائمة بالكامل (دوال 030، نمط بطاقات التقارير، نمط التصدير)، بلا migration وبلا تغيير على أي API/schema موجود.
