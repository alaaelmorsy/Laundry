# Data Model: نظام فواتير الفنادق والشركات

**Feature**: `030-hotels-companies-billing`
**Date**: 2026-06-27

---

## التغييرات على الجداول الموجودة

### `customers` — بدون migration
العمودان موجودان بالفعل:
- `customer_type ENUM('individual','corporate') DEFAULT 'individual'` ✅ موجود
- `tax_number VARCHAR(20) DEFAULT NULL` ✅ موجود (= الرقم الضريبي للشركة)

**التغيير المطلوب**: UI فقط — جعل `tax_number` بارزاً عند `corporate`.

---

### `orders` — إضافة عمود

```sql
-- Migration: migrateAddConsolidatedFlag
ALTER TABLE orders
  ADD COLUMN is_consolidated TINYINT(1) NOT NULL DEFAULT 0;
```

- `is_consolidated = 1` → فاتورة مجمعة صادرة من شاشة الفنادق
- `is_consolidated = 0` → فاتورة عادية (الافتراضي لجميع السجلات الموجودة)

---

### `order_items` — إضافة عمود

```sql
-- Migration: migrateAddWorkOrderRefOnItems
ALTER TABLE order_items
  ADD COLUMN work_order_id INT DEFAULT NULL;
```

- يُملأ فقط في order_items الخاصة بالفواتير المجمعة (reference للأمر الأصلي)
- `NULL` لجميع السجلات الموجودة — backward compatible تماماً

---

## الجداول الجديدة

### `work_orders`

```sql
CREATE TABLE IF NOT EXISTS work_orders (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  work_order_seq    INT NOT NULL,
  work_order_number VARCHAR(20) NOT NULL UNIQUE,   -- 'D-1', 'D-2', ...
  customer_id       INT NOT NULL,
  subtotal          DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_rate          DECIMAL(5,2)  NOT NULL DEFAULT 15,
  vat_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_display_mode ENUM('inclusive','exclusive') NOT NULL DEFAULT 'exclusive',
  status            ENUM('pending','invoiced','cancelled') NOT NULL DEFAULT 'pending',
  consolidated_order_id INT DEFAULT NULL,          -- orders.id بعد الفوترة
  notes             TEXT DEFAULT NULL,
  created_by        VARCHAR(100) DEFAULT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**حالات الـ status**:
```
pending → invoiced   (عند إصدار الفاتورة المجمعة)
pending → cancelled  (عند إلغاء الأمر من شاشة الفنادق)
```

---

### `work_order_items`

```sql
CREATE TABLE IF NOT EXISTS work_order_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id   INT NOT NULL,
  product_name    VARCHAR(200) NOT NULL,
  service_name    VARCHAR(200) DEFAULT NULL,
  quantity        DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_total      DECIMAL(10,2) NOT NULL DEFAULT 0,
  item_type       VARCHAR(50) DEFAULT 'product',
  sort_order      INT NOT NULL DEFAULT 0,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## العلاقات

```
customers (1) ──────────── (N) work_orders
                                   │
                              work_order_items (N)
                                   │
                         [upon invoice creation]
                                   │
                           orders (consolidated)
                                   │
                              order_items (work_order_id → work_orders.id)
```

---

## حسابات الفاتورة المجمعة

الصيغة الثابتة (لا تتغير):
```
total_amount = subtotal - discount_amount + vat_amount
```

عند تجميع أوامر متعددة مع خصم على المجموع:
```
مجموع_subtotals  = Σ work_order.subtotal  (الأوامر المحددة)
مجموع_totals     = Σ work_order.total_amount
نسبة_الخصم      = discount_amount / مجموع_subtotals
vat_rate         = من app_settings
```

**عمليات الحساب تتم في db.js وليس في الواجهة** — الواجهة ترسل فقط:
- `workOrderIds[]` — أرقام الأوامر المحددة
- `discountAmount` أو `discountPercent` — الخصم

---

## الترقيم التسلسلي D-XXX

```js
// داخل transaction مع FOR UPDATE:
const [seqRow] = await conn.execute(
  'SELECT COALESCE(MAX(work_order_seq), 0) AS mx FROM work_orders FOR UPDATE'
);
const seq = seqRow[0].mx + 1;
const workOrderNumber = `D-${seq}`;
```

---

## فهارس الأداء (Indexes)

```sql
-- على work_orders
CREATE INDEX idx_wo_customer   ON work_orders (customer_id);
CREATE INDEX idx_wo_status     ON work_orders (status);
CREATE INDEX idx_wo_created_at ON work_orders (created_at);
CREATE INDEX idx_wo_consolidated ON work_orders (consolidated_order_id);

-- على work_order_items
CREATE INDEX idx_woi_order ON work_order_items (work_order_id);
```
