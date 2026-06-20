# Implementation Plan: إصلاح بطء تحميل شاشتي الخدمات والمنتجات

**Branch**: `018-fix-screens-loading-performance` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/018-fix-screens-loading-performance/spec.md`

## Summary

شاشتا الخدمات والمنتجات تعانيان من بطء التحميل بسبب:
1. **Correlated subquery N+1** في `getProducts` — يُنفَّذ استعلام لكل منتج لحساب عدد عملياته
2. **غياب الفهارس** على أعمدة البحث والفرز في جدولي `products` و`laundry_services`
3. **SELECT \*** في استعلام الخدمات

الحل: تعديل `database/db.js` فقط — استبدال الـ correlated subquery بـ LEFT JOIN، وإضافة 5 فهارس، وتحديد الأعمدة في استعلام الخدمات.

## Technical Context

**Language/Version**: Node.js (CommonJS), MySQL/MariaDB

**Primary Dependencies**: mysql2/promise (connection pool)

**Storage**: MySQL/MariaDB — الجداول المتأثرة: `products`, `product_price_lines`, `laundry_services`

**Testing**: يدوي — فتح الشاشات وملاحظة السرعة + `SHOW INDEX FROM table`

**Target Platform**: Windows (on-premise, single-tenant)

**Performance Goals**: شاشة المنتجات < 2 ثانية، شاشة الخدمات < 1 ثانية

**Constraints**: لا تغييرات في الـ schema — فهارس فقط + تحسين الاستعلامات. جميع الواجهات الأمامية تبقى بدون تعديل.

**Scale/Scope**: بضع مئات من المنتجات والخدمات (نظام أحادي المستأجر)

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| 4-Step API Checklist | ✅ لا ينطبق | لا توجد API methods جديدة — تحسين queries موجودة فقط |
| Parameterized queries | ✅ محفوظ | لا تغيير في طريقة bind الـ params |
| DECIMAL(10,2) للقيم المالية | ✅ محفوظ | لا تغيير في schema |
| Idempotent migrations | ✅ مطلوب | استخدام `CREATE INDEX IF NOT EXISTS` + `.catch(() => {})` |
| RTL / Arabic-first | ✅ لا ينطبق | لا تغيير في الواجهة |
| No ES modules | ✅ لا ينطبق | تغييرات backend فقط |

**نتيجة**: لا انتهاكات — الخطة تتوافق مع الـ Constitution.

## Project Structure

### Documentation (this feature)

```text
specs/018-fix-screens-loading-performance/
├── plan.md         ← هذا الملف
├── research.md     ← قرارات التصميم والبدائل
├── data-model.md   ← الجداول المتأثرة وشكل الاستعلامات
├── quickstart.md   ← سيناريوهات التحقق
└── tasks.md        ← (يُنشأ بـ /speckit-tasks)
```

### Source Code (repository root)

```text
database/
└── db.js           ← الملف الوحيد الذي يتغير
```

**Structure Decision**: تغيير واحد في ملف واحد — لا هيكل جديد مطلوب.

## Implementation Steps (مرتبة حسب الأولوية)

### الخطوة 1 — إضافة الفهارس في `db.initialize()`

في نهاية كتلة الفهارس الموجودة (بعد السطر ~1153 في `db.js`)، أضف:

```js
await pool.query(`CREATE INDEX IF NOT EXISTS idx_ppl_product_id ON product_price_lines (product_id)`).catch(() => {});
await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products (sort_order)`).catch(() => {});
await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_search ON products (name_ar, name_en)`).catch(() => {});
await pool.query(`CREATE INDEX IF NOT EXISTS idx_services_sort_order ON laundry_services (sort_order)`).catch(() => {});
await pool.query(`CREATE INDEX IF NOT EXISTS idx_services_search ON laundry_services (name_ar, name_en)`).catch(() => {});
```

### الخطوة 2 — تعديل `buildProductsOrderBy` (`db.js:1940`)

```js
// قبل:
lines: '(SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id)',

// بعد:
lines: 'COUNT(ppl.id)',
```

### الخطوة 3 — تعديل `getProducts` (`db.js:2097`)

استبدال الاستعلامات لاستخدام LEFT JOIN + GROUP BY بدلاً من correlated subquery:

**paginated query**:
```sql
SELECT p.id, p.name_ar, p.name_en, p.is_active, p.created_at, p.sort_order,
  (p.image_blob IS NOT NULL) AS has_image,
  COUNT(ppl.id) AS price_line_count
FROM products p
LEFT JOIN product_price_lines ppl ON ppl.product_id = p.id
WHERE 1=1{whereClauses}
GROUP BY p.id
{orderSql}
LIMIT ? OFFSET ?
```

**count query** (يبقى بدون JOIN):
```sql
SELECT COUNT(*) as total FROM products p WHERE 1=1{whereClauses}
```

**non-paginated query** (نفس التغيير):
```sql
SELECT p.id, p.name_ar, ..., COUNT(ppl.id) AS price_line_count
FROM products p
LEFT JOIN product_price_lines ppl ON ppl.product_id = p.id
WHERE 1=1{whereClauses}
GROUP BY p.id
{orderSql}
```

### الخطوة 4 — تعديل `getAllLaundryServices` (`db.js:1947`)

```js
// قبل:
const dataSql = `SELECT * ${baseFrom} ${orderSql} LIMIT ? OFFSET ?`;
// و:
const [rows] = await pool.query(`SELECT * ${baseFrom} ${orderSql}`, params);

// بعد — تحديد الأعمدة:
const cols = 'id, name_ar, name_en, is_active, sort_order, created_at';
const dataSql = `SELECT ${cols} ${baseFrom} ${orderSql} LIMIT ? OFFSET ?`;
// و:
const [rows] = await pool.query(`SELECT ${cols} ${baseFrom} ${orderSql}`, params);
```

## Complexity Tracking

*لا انتهاكات للـ Constitution — لا حاجة لهذا القسم.*
