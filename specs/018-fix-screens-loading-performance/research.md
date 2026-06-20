# Research: إصلاح بطء تحميل شاشتي الخدمات والمنتجات

## Decision 1: استبدال Correlated Subquery بـ LEFT JOIN + GROUP BY

**Decision**: استبدال الـ correlated subquery في `getProducts` و`buildProductsOrderBy` بـ `LEFT JOIN` مع `COUNT(ppl.id)` في `GROUP BY`.

**Rationale**: الـ correlated subquery يُنفَّذ مرة لكل صف في النتيجة (N+1 pattern). مع 100 منتج = 101 استعلام SQL. بينما الـ `LEFT JOIN` يُنفَّذ استعلام واحد فقط.

**الكود الحالي** (`db.js:2115-2120`):
```sql
SELECT p.id, p.name_ar, ...,
  (SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id) AS price_line_count
FROM products p WHERE 1=1
ORDER BY p.sort_order ASC
LIMIT ? OFFSET ?
```

**الكود المقترح**:
```sql
SELECT p.id, p.name_ar, ...,
  COUNT(ppl.id) AS price_line_count
FROM products p
LEFT JOIN product_price_lines ppl ON ppl.product_id = p.id
WHERE 1=1
GROUP BY p.id
ORDER BY p.sort_order ASC
LIMIT ? OFFSET ?
```

**Alternatives considered**:
- إبقاء الـ subquery مع `EXPLAIN` — مرفوض لأنه أبطأ دائماً بدون فهرس
- استخدام CTE — MariaDB/MySQL 8 فقط، غير مضمون في بيئة المستخدم

---

## Decision 2: إضافة DB Indexes

**Decision**: إضافة 5 فهارس جديدة عبر `CREATE INDEX IF NOT EXISTS` في `db.initialize()`.

**الفهارس المطلوبة**:

| الفهرس | الجدول | العمود(ة) | السبب |
|--------|--------|-----------|-------|
| `idx_ppl_product_id` | `product_price_lines` | `product_id` | الـ JOIN الجديد + الـ subquery القديم |
| `idx_products_sort_order` | `products` | `sort_order` | ORDER BY الافتراضي |
| `idx_products_search` | `products` | `name_ar, name_en` | LIKE search |
| `idx_services_sort_order` | `laundry_services` | `sort_order` | ORDER BY الافتراضي |
| `idx_services_search` | `laundry_services` | `name_ar, name_en` | LIKE search |

**ملاحظة**: `product_price_lines` لديها بالفعل `UNIQUE KEY uq_product_service_new (product_id, laundry_service_id)` — هذا يعني أن MySQL تستخدم هذا الـ UNIQUE KEY كفهرس فعلي على `(product_id, laundry_service_id)`. لذا **`idx_ppl_product_id` قد لا يكون ضرورياً** لكنه يبقى كـ safety net في حالة تغيير الـ schema مستقبلاً. سنضيفه بـ `IF NOT EXISTS`.

**Pattern المستخدم** (مطابق للكود الموجود في `db.js:1143-1153`):
```js
await pool.query(`CREATE INDEX IF NOT EXISTS idx_name ON table (col)`).catch(() => {});
```

**Alternatives considered**:
- Composite index على `(sort_order, id)` للـ ORDER BY — مفيد لكن نبدأ بالبسيط أولاً
- Full-text index للبحث بدلاً من LIKE — مبالغة لعدد صفوف صغير

---

## Decision 3: تحديد الأعمدة في استعلام الخدمات

**Decision**: استبدال `SELECT *` في `getAllLaundryServices` (`db.js:1967, 1984`) بقائمة أعمدة صريحة.

**Rationale**: `SELECT *` يجلب كل الأعمدة بما فيها أي أعمدة مستقبلية قد تضاف. تحديد الأعمدة أفضل وأوضح.

**الأعمدة المطلوبة**: `id, name_ar, name_en, is_active, sort_order, created_at`

---

## Decision 4: تحديث `buildProductsOrderBy` للفرز بعمود "lines"

**Decision**: تغيير fragment الفرز لعمود `lines` من subquery إلى `COUNT(ppl.id)` — لكن هذا يعمل فقط لأن الاستعلام الرئيسي الآن يحتوي على `GROUP BY`.

**الكود الحالي** (`db.js:1936`):
```js
lines: '(SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id)',
```

**الكود الجديد**:
```js
lines: 'COUNT(ppl.id)',
```

**تحذير**: يجب التأكد من أن كل استعلامات `getProducts` تستخدم الـ JOIN الجديد قبل تغيير هذا.

---

## Conclusion

التغييرات مقتصرة على `database/db.js` فقط — 3 دوال:
1. `getProducts` (السطر 2097): تعديل الاستعلامات لاستخدام JOIN
2. `getAllLaundryServices` (السطر 1947): استبدال `SELECT *`
3. `buildProductsOrderBy` (السطر 1940): تحديث fragment الـ `lines`
4. `db.initialize()` (السطر ~650): إضافة الفهارس
