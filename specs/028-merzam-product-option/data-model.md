# Data Model: خيار المزرام للمنتجات

---

## جدول جديد: merzam_types

```sql
CREATE TABLE IF NOT EXISTS merzam_types (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name_ar    VARCHAR(100) NOT NULL,
  name_en    VARCHAR(100) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**البيانات الافتراضية** (تُدرج عند التهيئة إذا كان الجدول فارغاً):

| name_ar | name_en | sort_order |
|---------|---------|------------|
| مزرام | Merzam | 1 |
| مربع | Moraba3 | 2 |
| بدون مزرام | Bdon Merzam | 3 |
| قطري | Qatary | 4 |
| كويتي | Kuwaity | 5 |
| مزرام مقلوب | Merzam Maklob | 6 |
| مثلث | Triangle | 7 |
| دوبل مزرام | Double Merzam | 8 |

---

## تعديل جدول: products

**Migration** (additive, try/catch):

```sql
ALTER TABLE products ADD COLUMN merzam_enabled TINYINT(1) NOT NULL DEFAULT 0;
```

| العمود | النوع | الافتراضي | الغرض |
|--------|-------|-----------|-------|
| `merzam_enabled` | TINYINT(1) | 0 | تفعيل خيار المزرام على هذا المنتج |

---

## تعديل جدول: order_items

**Migrations** (additive, try/catch لكل عمود):

```sql
ALTER TABLE order_items ADD COLUMN merzam_type_id   INT NULL;
ALTER TABLE order_items ADD COLUMN merzam_type_name VARCHAR(100) NULL;
```

| العمود | النوع | الغرض |
|--------|-------|-------|
| `merzam_type_id` | INT NULL | مرجع لـ merzam_types.id (soft reference, لا FK لحماية الأرشيف) |
| `merzam_type_name` | VARCHAR(100) NULL | اسم المزرام العربي محفوظ وقت إنشاء الفاتورة |

> **لماذا لا FK؟** — حذف نوع مزرام لا يجب أن يؤثر على الفواتير التاريخية. النص المحفوظ في `merzam_type_name` هو المصدر الموثوق للعرض.

---

## العلاقات

```
products (merzam_enabled=1)
    │
    └── [POS Cart] يُحمَّل مع merzam_types list
            │
            └── order_items.merzam_type_id  → merzam_types.id  (soft ref)
            └── order_items.merzam_type_name (نص أرشيفي)
```

---

## Cart Item State (pos.js)

الحقول المضافة لكل عنصر في `state.cart[]`:

```js
{
  // ... الحقول الحالية ...
  merzamEnabled:   Boolean,  // من product.merzam_enabled
  merzamTypeId:    Number|null,
  merzamTypeName:  String|null,
}
```
