# Implementation Plan: تقرير هيئة الزكاة

**Branch**: `002-zakat-report` | **Date**: 2026-06-11 | **Spec**: [spec.md](spec.md)

## Summary

إضافة تقرير "هيئة الزكاة" إلى شاشة التقارير. التقرير يجلب الفواتير (مدفوعة + آجلة) والإشعارات الدائنة والمصروفات لفترة زمنية محددة، مع ملخص يُظهر الصافي. البيانات تُستخرج من جداول `orders`, `credit_notes`, `expenses` بتصفية على تاريخ الإنشاء.

## Technical Context

**Language/Version**: Node.js (CommonJS), Vanilla JS

**Primary Dependencies**: Express.js, mysql2/promise

**Storage**: MySQL — جداول `orders`, `credit_notes`, `expenses`, `customers`

**Testing**: Manual (no test framework in project)

**Target Platform**: Local Express server + Browser (RTL)

**Project Type**: Web application (monolithic single-invoke API)

**Performance Goals**: < 5 ثوانٍ لتوليد التقرير

**Constraints**: يجب اتباع نمط `POST /api/invoke` بالكامل — لا REST endpoints مخصصة

**Scale/Scope**: Single-tenant on-premise, حجم بيانات لا يتجاوز آلاف السجلات

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| 4-Step API Checklist | ✅ | db.js → invokeHandlers.js → web-api.js → screen JS |
| POST /api/invoke only | ✅ | لا endpoints مخصصة |
| MySQL DECIMAL(10,2) | ✅ | جميع الأعمدة المالية معرّفة كذلك |
| RTL + `lang="ar"` | ✅ | الصفحة الجديدة ستتبع نفس النمط |
| SAR symbol font | ✅ | استخدام `.sar` و `&#xE900;` |
| No ES modules | ✅ | لا import/export |
| Parameterized queries | ✅ | لا string concatenation في SQL |
| Response contract `{success, ...data}` | ✅ | كل handler يُرجع النمط المعتاد |

## Project Structure

### Documentation (this feature)

```text
specs/002-zakat-report/
├── plan.md              # هذا الملف
├── spec.md              # المواصفة
├── research.md          # Phase 0 — قرارات تقنية
├── data-model.md        # Phase 1 — هيكل البيانات وعقد الـ API
├── quickstart.md        # Phase 1 — سيناريوهات التحقق
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — /speckit-tasks
```

### Source Code (files to create/modify)

```text
database/db.js                                    [MODIFY] — إضافة getZakatReport()
server/invokeHandlers.js                          [MODIFY] — إضافة case 'getZakatReport'
assets/web-api.js                                 [MODIFY] — تسجيل window.api.getZakatReport
assets/i18n.js                                    [MODIFY] — مفاتيح i18n الجديدة

screens/reports/reports.html                      [MODIFY] — إضافة بطاقة التقرير
screens/reports/reports.js                        [MODIFY] — إضافة navigation handler

screens/reports/zakat-report/
├── zakat-report.html                             [CREATE]
├── zakat-report.js                               [CREATE]
└── zakat-report.css                              [CREATE]
```

## Implementation Steps

### Step 1 — DB Function (`database/db.js`)

أضف دالة `getZakatReport({ dateFrom, dateTo })`:

```
SQL للفواتير:
  SELECT o.id, o.invoice_seq, o.order_number, c.name AS customer_name,
         o.subtotal, o.vat_amount, o.total_amount, o.payment_status, o.created_at
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  WHERE o.created_at BETWEEN ? AND ?
    AND o.is_refund = 0
  ORDER BY o.created_at ASC

SQL للإشعارات الدائنة:
  SELECT cn.id, cn.credit_note_number, cn.credit_note_seq, c.name AS customer_name,
         cn.subtotal, cn.vat_amount, cn.total_amount, cn.created_at
  FROM credit_notes cn
  LEFT JOIN customers c ON c.id = cn.customer_id
  WHERE cn.created_at BETWEEN ? AND ?
  ORDER BY cn.created_at ASC

SQL للمصروفات:
  SELECT id, title, category, amount, tax_amount, total_amount, expense_date
  FROM expenses
  WHERE expense_date BETWEEN ? AND ?
  ORDER BY expense_date ASC
```

حساب الملخص في JavaScript (لا aggregate SQL):
- `ordersSubtotal` = sum of orders.subtotal
- `ordersVat` = sum of orders.vat_amount
- `ordersTotal` = sum of orders.total_amount
- `creditNotesSubtotal`, `creditNotesVat`, `creditNotesTotal` = نفس النمط
- `expensesTotal` = sum of expenses.total_amount
- `netTotal` = ordersTotal − creditNotesTotal − expensesTotal

الدالة تُرجع: `{ orders, creditNotes, expenses, summary }`

### Step 2 — Invoke Handler (`server/invokeHandlers.js`)

```javascript
case 'getZakatReport': {
  const { dateFrom, dateTo } = payload;
  const result = await db.getZakatReport({ dateFrom, dateTo });
  return { success: true, ...result };
}
```

### Step 3 — Web API Registration (`assets/web-api.js`)

```javascript
getZakatReport: (payload) => invoke('getZakatReport', payload),
```

### Step 4 — Screen Files

**`zakat-report.html`**: نسخ هيكل `period-report.html` مع:
- عنوان "تقرير هيئة الزكاة"
- حقلَا تاريخ من/إلى (type="date")
- زر "عرض التقرير"
- ثلاثة أقسام: `#ordersSection`, `#creditNotesSection`, `#expensesSection`
- قسم ملخص `#summarySection` بأربعة سطور

**`zakat-report.js`**: نمط مطابق لـ `period-report.js`:
- تحقق من المدخلات (الحقلان مطلوبان، dateTo ≥ dateFrom)
- استدعاء `window.api.getZakatReport({ dateFrom, dateTo })`
- عرض الجداول بـ `innerHTML` + template literals
- عرض الملخص — الصافي السالب بلون أحمر
- دعم الطباعة `window.print()`

**`zakat-report.css`**: استيراد أنماط `period-report.css` الأساسية + أي تخصيصات

### Step 5 — Reports Landing (`reports.html` + `reports.js`)

- أضف `report-card` جديدة بمعرّف `cardZakatReport` بأيقونة مناسبة
- في `reports.js` أضف: `cardZakatReport.addEventListener('click', () => window.api.navigateTo('/screens/reports/zakat-report/zakat-report.html'))`

### Step 6 — i18n Keys (`assets/i18n.js`)

أضف المفاتيح:
```
zakat-report-title          = تقرير هيئة الزكاة / Zakat Report
zakat-report-orders-section = الفواتير / Invoices
zakat-report-cn-section     = الإشعارات الدائنة / Credit Notes
zakat-report-exp-section    = المصروفات / Expenses
zakat-report-summary        = الملخص / Summary
zakat-report-net            = الصافي / Net Total
reports-card-zakat-title    = تقرير هيئة الزكاة / Zakat Report
reports-card-zakat-desc     = ...
```

## Complexity Tracking

لا توجد انتهاكات للدستور.
