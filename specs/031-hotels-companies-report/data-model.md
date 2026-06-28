# Data Model: تقرير الفنادق والشركات

**Feature**: `031-hotels-companies-report`
**Date**: 2026-06-28

> **لا migration ولا تغيير schema.** هذا التقرير **للقراءة فقط** من جداول أنشأتها ميزة 030.
> هذا المستند يوثّق الجداول المقروءة وأشكال الاستجابة (response shapes) فقط.

---

## الجداول المقروءة (موجودة بالفعل — لا تُعدَّل)

### `customers` (قراءة)
| العمود | الاستخدام في التقرير |
|--------|----------------------|
| `id` | مفتاح العميل |
| `customer_name` | اسم الشركة/الفندق (يظهر في الكشف والـ PDF) |
| `phone` | يظهر في ترويسة العميل |
| `tax_number` | الرقم الضريبي للعميل (اختياري — قد يكون NULL) |
| `customer_type` | فلتر إلزامي = `'corporate'` |

### `work_orders` (قراءة)
| العمود | الاستخدام |
|--------|-----------|
| `id`, `work_order_number` (D-XXX), `work_order_seq` | تعريف أمر التشغيل |
| `customer_id` | الربط بالعميل |
| `subtotal`, `discount_amount`, `vat_amount`, `total_amount` | مبالغ السطر |
| `status` (`pending`/`invoiced`/`cancelled`) | الحالة + استبعاد الملغي من المجاميع |
| `consolidated_order_id` | الفاتورة المجمعة المرتبطة (إن مُفوتر) |
| `created_at` | الفرز والفلترة الزمنية |

### `work_order_items` (قراءة — للتفصيل عند الحاجة)
بنود الأمر (`product_name`, `service_name`, `quantity`, `unit_price`, `line_total`).

### `orders` حيث `is_consolidated=1` (قراءة)
| العمود | الاستخدام |
|--------|-----------|
| `id`, `invoice_seq`, `order_number` | تعريف الفاتورة المجمعة |
| `customer_id` | الربط بالعميل |
| `subtotal`, `discount_amount`, `vat_amount`, `total_amount` | مبالغ الفاتورة |
| `payment_status`, `paid_amount`, `remaining_amount` | المدفوع/المستحق |
| `created_at` | الفرز والفلترة الزمنية |

### `order_items` حيث `work_order_id IS NOT NULL` (قراءة)
لاستخراج أرقام D-XXX المضمَّنة في كل فاتورة مجمعة (للعرض).

---

## أشكال الاستجابة (Response Shapes)

### 1) `getCorporateReportStatement` (وضع التفصيل — عميل واحد)

```jsonc
{
  "success": true,
  "customer": {
    "id": 12, "customer_name": "فندق النخيل", "phone": "0555…",
    "tax_number": "3001…", "hasTaxNumber": true
  },
  "dateFrom": "2026-06-01T00:00", "dateTo": "2026-06-28T23:59",
  "workOrders": [
    {
      "id": 88, "work_order_number": "D-88", "work_order_seq": 88,
      "status": "invoiced", "created_at": "2026-06-03T10:12:00",
      "subtotal": 200.00, "discount_amount": 0.00, "vat_amount": 30.00,
      "total_amount": 230.00,
      "consolidated_order_id": 540, "consolidated_invoice_seq": 1203
    }
  ],
  "consolidatedInvoices": [
    {
      "id": 540, "invoice_seq": 1203, "order_number": "INV-1203",
      "created_at": "2026-06-10T14:00:00",
      "subtotal": 600.00, "discount_amount": 50.00, "vat_amount": 82.50,
      "total_amount": 632.50,
      "payment_status": "pending", "paid_amount": 0.00, "remaining_amount": 632.50,
      "work_orders_count": 3,
      "work_order_numbers": ["D-86","D-87","D-88"]
    }
  ],
  "summary": {
    "totalWorkOrdered": 1450.00,   // Σ total للأوامر غير الملغية
    "totalInvoiced":    632.50,    // Σ total للفواتير المجمعة
    "totalDiscount":    50.00,
    "totalVat":         82.50,
    "totalPaid":        0.00,
    "totalOutstanding": 632.50,    // Σ remaining_amount (المديونية)
    "workOrdersCount":  7,
    "cancelledCount":   1,
    "invoicesCount":    2
  }
}
```

> **ملاحظة الدمج الزمني/الرصيد التراكمي**: الواجهة تدمج `workOrders[]` و `consolidatedInvoices[]`
> في جدول زمني واحد وتحسب الرصيد التراكمي client-side (أو يوفّره الخادم كـ `timeline[]` اختيارياً).
> القرار: الدمج في الواجهة (تفادي window functions، وتبسيط db).

### 2) `getCorporateReportSummary` (وضع الملخص — كل الشركات)

```jsonc
{
  "success": true,
  "dateFrom": "2026-06-01T00:00", "dateTo": "2026-06-28T23:59",
  "rows": [
    {
      "id": 12, "customer_name": "فندق النخيل", "tax_number": "3001…",
      "wo_count": 7, "total_work_ordered": 1450.00,
      "inv_count": 2, "total_invoiced": 632.50,
      "total_paid": 0.00, "total_outstanding": 632.50
    }
  ],
  "totals": {
    "wo_count": 18, "total_work_ordered": 5400.00,
    "inv_count": 6, "total_invoiced": 3100.00,
    "total_paid": 1800.00, "total_outstanding": 1300.00
  }
}
```

### 3) خطأ موحّد (نمط المشروع)
```jsonc
{ "success": false, "message": "رسالة خطأ بالعربية" }
```

---

## قواعد التحقّق (Validation)

| القاعدة | المكان |
|---------|--------|
| `dateFrom <= dateTo` | الواجهة + الخادم |
| العميل (وضع التفصيل) يجب أن يكون `customer_type='corporate'` | الخادم (db) → خطأ عربي إن لا |
| أوامر `status='cancelled'` تُعرض لكن لا تدخل المجاميع | db/Node |
| المبالغ تُقرأ كما خُزِّنت — لا إعادة حساب VAT | db |
| لا أي عبارة كتابة (INSERT/UPDATE/DELETE/DDL) | كل الطبقات |

---

## كيانات العرض المشتقّة (لا تُخزَّن)

- **Statement Line**: تمثيل موحّد لصف في الجدول الزمني (تاريخ، نوع: أمر تشغيل/فاتورة مجمعة، رقم المستند،
  الحالة، subtotal/discount/vat/total، مدفوع، مستحق، رصيد تراكمي). يُبنى في الواجهة من `workOrders[]`+`consolidatedInvoices[]`.
- **Summary Totals**: مجاميع تُحسب server-side (للتصدير المتسق) وتُعرض client-side.
