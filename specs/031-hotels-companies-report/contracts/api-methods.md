# API Contracts: تقرير الفنادق والشركات

**Feature**: `031-hotels-companies-report`

> كل الطرق **قراءة فقط**. لا تُعدّل أي بيانات. الاستجابة تتبع النمط الموحّد `{ success, ... }` /
> `{ success:false, message }`. كل الرسائل بالعربية.

---

## 1. `getCorporateReportStatement` — كشف حساب عميل مؤسسي (تفصيلي)

**نمط**: `POST /api/invoke` → `invokeHandlers.js` → `db.getCorporateReportStatement(payload)`

**Payload**:
```jsonc
{
  "customerId": 12,            // إلزامي
  "dateFrom": "2026-06-01T00:00",  // إلزامي
  "dateTo":   "2026-06-28T23:59",  // إلزامي
  "docType":  "all",          // اختياري: 'all' | 'work_orders' | 'invoices'
  "status":   "all"           // اختياري: 'all' | 'pending' | 'invoiced' | 'cancelled'
}
```

**Response (success)**: انظر `data-model.md §1` (customer, workOrders[], consolidatedInvoices[], summary{}).

**أخطاء**:
| الحالة | message (عربي) |
|--------|----------------|
| `customerId` مفقود | "يجب اختيار عميل" |
| العميل ليس `corporate` | "العميل المحدد ليس شركة/فندق" |
| `dateFrom > dateTo` | "نطاق التاريخ غير صحيح" |

**الخطوات الأربع**:
- [ ] `db.js`: `getCorporateReportStatement({ customerId, dateFrom, dateTo, docType, status })`
- [ ] `invokeHandlers.js`: `case 'getCorporateReportStatement'`
- [ ] `web-api.js`: `api.getCorporateReportStatement = (p) => invoke('getCorporateReportStatement', p)`
- [ ] الشاشة: `window.api.getCorporateReportStatement(payload)`

---

## 2. `getCorporateReportSummary` — ملخص كل الشركات/الفنادق

**نمط**: `POST /api/invoke` → `invokeHandlers.js` → `db.getCorporateReportSummary(payload)`

**Payload**:
```jsonc
{
  "dateFrom": "2026-06-01T00:00",  // إلزامي
  "dateTo":   "2026-06-28T23:59",  // إلزامي
  "search":   ""              // اختياري: فلترة بالاسم
}
```

**Response (success)**: انظر `data-model.md §2` (rows[], totals{}).

**أخطاء**:
| الحالة | message |
|--------|---------|
| `dateFrom > dateTo` | "نطاق التاريخ غير صحيح" |

**الخطوات الأربع**:
- [ ] `db.js`: `getCorporateReportSummary({ dateFrom, dateTo, search })`
- [ ] `invokeHandlers.js`: `case 'getCorporateReportSummary'`
- [ ] `web-api.js`: `api.getCorporateReportSummary = (p) => invoke('getCorporateReportSummary', p)`
- [ ] الشاشة: `window.api.getCorporateReportSummary(payload)`

---

## 3. `getCorporateCustomers` — بحث/اختيار العميل (موجودة — إعادة استخدام)

**الحالة**: ✅ موجودة في `db.js:8925` + `invokeHandlers.js:2029`.

**Payload**: `{ search, page, pageSize }` — للتقرير نستخدم `{ search }` فقط.

**مطلوب التحقق فقط**:
- [ ] التأكد من وجود `api.getCorporateCustomers = (p) => invoke('getCorporateCustomers', p)` في `web-api.js`؛
      إضافتها إن لم تكن موجودة (الخطوة 3 من الـ checklist).

---

## 4. `exportHotelsCompaniesReport` — تصدير PDF/Excel (route ثنائي)

**نمط** (مختلف عن invoke — تصدير ثنائي):
`web-api.exportHotelsCompaniesReport(d)` → `exportBinary('/api/export/hotels-companies-report', d)`
→ `server/index.js` route (authMiddleware) → `exportsService.exportHotelsCompaniesReport(type, body)`

**Payload**:
```jsonc
{
  "type": "pdf",              // 'pdf' | 'excel'
  "mode": "detail",          // 'detail' | 'summary'
  "customerId": 12,          // إلزامي عند mode='detail'
  "dateFrom": "2026-06-01T00:00",
  "dateTo":   "2026-06-28T23:59",
  "docType":  "all",
  "status":   "all"
}
```

**السلوك**:
- الخادم **يعيد بناء** البيانات باستدعاء `db.getCorporateReportStatement` أو `db.getCorporateReportSummary`
  (لا يثق ببيانات الواجهة).
- **PDF**: A4، RTL، `cairoFonts()`، خط `SaudiRiyal`، ترويسة `branding.js` (شعار/اسم/رقم ضريبي للمنشأة)،
  ثم بيانات العميل (وضع التفصيل)، الفترة، الجدول، الملخص، الرصيد الختامي. `thead` يتكرر لكل صفحة.
- **Excel**: جدول بأعمدة (التاريخ، نوع المستند، رقم المستند، الوصف، الحالة، قبل الضريبة، الخصم، الضريبة،
  الإجمالي، المدفوع، المستحق) + صف مجاميع ختامي.

**Response**: ملف ثنائي (`Content-Disposition: attachment`) باسم مثل
`hotels-companies-report-YYYYMMDD-HHMMSS.pdf|.xls`.

**الخطوات**:
- [ ] `exportsService.js`: `exportHotelsCompaniesReport(type, body)` + إضافته إلى `module.exports`
- [ ] `server/index.js`: `app.post('/api/export/hotels-companies-report', authMiddleware, …)`
- [ ] `web-api.js`: `api.exportHotelsCompaniesReport = (d) => exportBinary('/api/export/hotels-companies-report', d)`
- [ ] الشاشة: زرّا التصدير

---

## 5. تسجيل واجهة المستخدم والصلاحيات (غير-API)

- [ ] `screens/reports/reports.html`: بطاقة `#cardHotelsCompaniesReport`
- [ ] `screens/reports/reports.js`: إدخال في `REPORT_CARDS` (perm: `report_hotels_companies`) + إضافته لمصفوفة `hasSubPerms`
- [ ] `screens/roles/roles.html`: checkbox `data-perm="report_hotels_companies"`
- [ ] `assets/i18n.js`: مفاتيح `reports-card-hotels-companies-title/desc`، `roles-perm-report-hotels-companies`،
      ومفاتيح الشاشة (`hcr-*`)

---

## ملخص قائمة الطرق

| # | Method/Route | نوع | جديد؟ | كتابة بيانات؟ |
|---|--------------|-----|-------|----------------|
| 1 | `getCorporateReportStatement` | invoke | جديد | ❌ قراءة |
| 2 | `getCorporateReportSummary` | invoke | جديد | ❌ قراءة |
| 3 | `getCorporateCustomers` | invoke | موجود (reuse) | ❌ قراءة |
| 4 | `exportHotelsCompaniesReport` | export route | جديد | ❌ قراءة |
