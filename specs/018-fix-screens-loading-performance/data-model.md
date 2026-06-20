# Data Model: إصلاح بطء التحميل

لا تغييرات في schema الجداول — هذه التغييرات في طبقة الاستعلامات فقط.

## الجداول المتأثرة

### `products`
```
id          INT PK AUTO_INCREMENT
name_ar     VARCHAR(200) NOT NULL
name_en     VARCHAR(200)
image_blob  LONGBLOB          ← لا يُجلَب في قائمة المنتجات (فقط has_image flag)
image_mime  VARCHAR(255)
is_active   TINYINT(1)
sort_order  INT
created_at  TIMESTAMP
```
**فهارس جديدة**:
- `idx_products_sort_order` ON `(sort_order)`
- `idx_products_search` ON `(name_ar, name_en)`

### `product_price_lines`
```
id                  INT PK AUTO_INCREMENT
product_id          INT FK→products(id) ON DELETE CASCADE
laundry_service_id  INT FK→laundry_services(id) ON DELETE RESTRICT
price               DECIMAL(10,2)
UNIQUE (product_id, laundry_service_id)   ← يعمل كفهرس ضمني على (product_id, ...)
```
**فهرس جديد** (safety net):
- `idx_ppl_product_id` ON `(product_id)` — إذا لم يكن موجوداً

### `laundry_services`
```
id         INT PK AUTO_INCREMENT
name_ar    VARCHAR(150) NOT NULL
name_en    VARCHAR(150) NOT NULL
is_active  TINYINT(1) DEFAULT 1
sort_order INT DEFAULT 0
created_at TIMESTAMP
```
**فهارس جديدة**:
- `idx_services_sort_order` ON `(sort_order)`
- `idx_services_search` ON `(name_ar, name_en)`

## تغيير شكل الاستعلام

### قبل التعديل — `getProducts` (N+1)
```sql
SELECT p.id, p.name_ar, ...,
  (SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id) AS price_line_count
FROM products p
WHERE 1=1
ORDER BY p.sort_order ASC
LIMIT 50 OFFSET 0
-- = 1 استعلام رئيسي + N subquery لكل صف
```

### بعد التعديل — `getProducts` (استعلام واحد)
```sql
SELECT p.id, p.name_ar, ...,
  COUNT(ppl.id) AS price_line_count
FROM products p
LEFT JOIN product_price_lines ppl ON ppl.product_id = p.id
WHERE 1=1
GROUP BY p.id
ORDER BY p.sort_order ASC
LIMIT 50 OFFSET 0
-- = استعلام واحد فقط
```

### قبل التعديل — `getAllLaundryServices`
```sql
SELECT * FROM laundry_services WHERE 1=1 ORDER BY sort_order ASC, id ASC LIMIT 50 OFFSET 0
```

### بعد التعديل
```sql
SELECT id, name_ar, name_en, is_active, sort_order, created_at
FROM laundry_services WHERE 1=1 ORDER BY sort_order ASC, id ASC LIMIT 50 OFFSET 0
```
