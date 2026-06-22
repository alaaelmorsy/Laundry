# Data Model: عروض الأصناف

**Date**: 2026-06-22

---

## الجداول الجديدة

### `product_offers`

```sql
CREATE TABLE IF NOT EXISTS product_offers (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  discount_type  ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL,
  start_date     DATETIME DEFAULT NULL,
  end_date       DATETIME DEFAULT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR(200) NOT NULL | اسم العرض |
| discount_type | ENUM('percentage','fixed') | نسبة أو مبلغ ثابت |
| discount_value | DECIMAL(10,2) | قيمة الخصم — لا تتجاوز 100 إذا نسبة |
| start_date | DATETIME NULL | null = بدون تاريخ بداية |
| end_date | DATETIME NULL | null = بدون تاريخ نهاية |
| is_active | TINYINT(1) | 1=مفعّل، 0=معطّل |
| created_at | TIMESTAMP | auto |
| updated_at | TIMESTAMP | auto on update |

**Validation Rules**:
- `name`: مطلوب، trim، max 200 حرف
- `discount_value`: > 0 دائماً، ≤ 100 إذا percentage
- `start_date` < `end_date` إذا كلاهما موجودان
- `discount_type`: 'percentage' أو 'fixed' فقط

---

### `product_offer_lines`

```sql
CREATE TABLE IF NOT EXISTS product_offer_lines (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  offer_id      INT NOT NULL,
  price_line_id INT NOT NULL,
  UNIQUE KEY uq_offer_priceline (offer_id, price_line_id),
  FOREIGN KEY (offer_id) REFERENCES product_offers(id) ON DELETE CASCADE,
  FOREIGN KEY (price_line_id) REFERENCES product_price_lines(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| offer_id | INT NOT NULL FK | → product_offers.id CASCADE DELETE |
| price_line_id | INT NOT NULL FK | → product_price_lines.id CASCADE DELETE |

**Constraints**:
- UNIQUE(offer_id, price_line_id) — لا تكرار نفس السطر في عرض واحد
- CASCADE DELETE من الطرفين

---

## الجداول الموجودة (للقراءة فقط)

### `product_price_lines` (موجود — لا تعديل)

```sql
-- البنية الحالية المعروفة:
product_price_lines (
  id                INT PK,
  product_id        INT FK → products.id,
  laundry_service_id INT FK → laundry_services.id,
  price             DECIMAL(10,2)
)
```

### `products` (موجود — للقراءة فقط)

```sql
products (id, name, ...)
```

### `laundry_services` (موجود — للقراءة فقط)

```sql
laundry_services (id, name, ...)
```

---

## Query: جلب الأصناف مع عملياتها للـ UI

```sql
SELECT
  p.id        AS product_id,
  p.name      AS product_name,
  ppl.id      AS price_line_id,
  ls.name     AS service_name,
  ppl.price
FROM products p
INNER JOIN product_price_lines ppl ON ppl.product_id = p.id
INNER JOIN laundry_services ls     ON ls.id = ppl.laundry_service_id
ORDER BY p.name, ls.name
```

---

## Query: جلب عروض نشطة (للـ POS مستقبلاً)

```sql
SELECT po.*, pol.price_line_id
FROM product_offers po
JOIN product_offer_lines pol ON pol.offer_id = po.id
WHERE po.is_active = 1
  AND (po.start_date IS NULL OR po.start_date <= NOW())
  AND (po.end_date   IS NULL OR po.end_date   >= NOW())
```

---

## Registration في `db.initialize()`

```js
await createProductOffersTable();
await createProductOfferLinesTable();
```

يُضافان بعد `createOffersTable()` الحالية.
