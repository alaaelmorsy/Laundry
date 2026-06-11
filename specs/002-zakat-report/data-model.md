# Data Model: تقرير هيئة الزكاة

**Date**: 2026-06-11

## Entities Used (Read-Only)

### orders (الفواتير)

| Column | Type | Notes |
|--------|------|-------|
| id | INT | Primary key |
| invoice_seq | INT | رقم الفاتورة التسلسلي |
| order_number | VARCHAR | رقم الطلب |
| customer_id | INT | FK → customers |
| subtotal | DECIMAL(10,2) | المبلغ قبل الضريبة |
| vat_amount | DECIMAL(10,2) | مبلغ الضريبة |
| total_amount | DECIMAL(10,2) | الإجمالي شامل الضريبة |
| payment_status | ENUM | paid / pending / partial |
| payment_method | VARCHAR | طريقة الدفع |
| created_at | TIMESTAMP | **تاريخ الإنشاء — الأساس للتصفية** |
| is_refund | TINYINT | استبعاد الفواتير المرتجعة (=0) |

**Filter**: `created_at BETWEEN ? AND ?` AND `is_refund = 0`

**JOIN**: `customers c ON c.id = o.customer_id` لجلب `c.name`

---

### credit_notes (الإشعارات الدائنة)

| Column | Type | Notes |
|--------|------|-------|
| id | INT | Primary key |
| credit_note_number | VARCHAR | رقم الإشعار |
| credit_note_seq | INT | الرقم التسلسلي |
| customer_id | INT | FK → customers |
| subtotal | DECIMAL(10,2) | المبلغ قبل الضريبة |
| vat_amount | DECIMAL(10,2) | مبلغ الضريبة |
| total_amount | DECIMAL(10,2) | الإجمالي شامل الضريبة |
| created_at | TIMESTAMP | **تاريخ الإنشاء — الأساس للتصفية** |

**Filter**: `created_at BETWEEN ? AND ?`

**JOIN**: `customers c ON c.id = cn.customer_id` لجلب `c.name`

---

### expenses (المصروفات)

| Column | Type | Notes |
|--------|------|-------|
| id | INT | Primary key |
| title | VARCHAR | بيان المصروف |
| category | VARCHAR | الفئة |
| amount | DECIMAL(10,2) | المبلغ قبل الضريبة |
| tax_amount | DECIMAL(10,2) | مبلغ الضريبة |
| total_amount | DECIMAL(10,2) | الإجمالي |
| expense_date | DATE | **تاريخ المصروف — الأساس للتصفية** |

**Filter**: `expense_date BETWEEN ? AND ?`

---

## Summary Calculations

| السطر | الحساب |
|-------|--------|
| مجموع الفواتير | SUM(orders.subtotal) / SUM(orders.vat_amount) / SUM(orders.total_amount) |
| مجموع الإشعارات الدائنة | SUM(cn.subtotal) / SUM(cn.vat_amount) / SUM(cn.total_amount) |
| مجموع المصروفات | SUM(expenses.total_amount) |
| الصافي | SUM(orders.total_amount) − SUM(cn.total_amount) − SUM(expenses.total_amount) |

---

## API Contract

**Method**: `getZakatReport`

**Payload**: `{ dateFrom: "YYYY-MM-DD", dateTo: "YYYY-MM-DD" }`

**Response**:
```json
{
  "success": true,
  "orders": [...],
  "creditNotes": [...],
  "expenses": [...],
  "summary": {
    "ordersSubtotal": 0,
    "ordersVat": 0,
    "ordersTotal": 0,
    "creditNotesSubtotal": 0,
    "creditNotesVat": 0,
    "creditNotesTotal": 0,
    "expensesTotal": 0,
    "netTotal": 0
  }
}
```
