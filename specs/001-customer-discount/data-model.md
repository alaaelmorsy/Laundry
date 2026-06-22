# Data Model: خصم العميل (Customer Discount)

## 1. تعديل جدول `customers` (migration additive)

```sql
-- Migration: إضافة حقول الخصم للعميل
ALTER TABLE customers
  ADD COLUMN discount_type  ENUM('percentage','fixed') DEFAULT NULL,
  ADD COLUMN discount_value DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN discount_expiry DATE DEFAULT NULL;
```

| عمود | النوع | القيمة الافتراضية | الوصف |
|------|-------|------------------|-------|
| `discount_type` | `ENUM('percentage','fixed')` | NULL | نوع الخصم: نسبة أو مبلغ ثابت. NULL = لا خصم |
| `discount_value` | `DECIMAL(10,2)` | NULL | قيمة الخصم (0–100 للنسبة، > 0 للمبلغ) |
| `discount_expiry` | `DATE` | NULL | تاريخ انتهاء الخصم. NULL = دائم |

**قاعدة الصحة:**
- `discount_type` و`discount_value` يجب أن يكونا معًا (كلاهما NULL أو كلاهما مُعيَّنان).
- `discount_value` للنسبة: بين 0.01 و 100.00.
- `discount_value` للمبلغ: > 0.
- `discount_expiry` اختياري في كلتا الحالتين.

---

## 2. تعديل جدول `orders` (migration additive)

```sql
-- Migration: حفظ قيمة خصم العميل المُطبَّق في الفاتورة
ALTER TABLE orders
  ADD COLUMN customer_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
```

| عمود | النوع | الوصف |
|------|-------|-------|
| `customer_discount_amount` | `DECIMAL(10,2)` | قيمة خصم العميل المُطبَّق عند إصدار الفاتورة (مُجمَّد) |

**ملاحظة**: `discount_amount` الموجود يبقى بدون تغيير — يمثل إجمالي كل الخصومات. `customer_discount_amount` للتقارير التحليلية.

---

## 2b. تعديل جدول `orders` — إضافة `manual_discount_amount` (migration additive)

```sql
-- Migration: حفظ الخصم اليدوي الذي أدخله الكاشير منفصلاً
ALTER TABLE orders
  ADD COLUMN manual_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
```

| عمود | النوع | الوصف |
|------|-------|-------|
| `manual_discount_amount` | `DECIMAL(10,2)` | الخصم اليدوي الذي أدخله الكاشير من شاشة POS (مُجمَّد) |

**العلاقة بين حقول الخصم في `orders`**:

| الحقل | المحتوى |
|-------|---------|
| `discount_amount` | إجمالي كل الخصومات (يُرسَل لـ ZATCA) — لا يتغير |
| `customer_discount_amount` | خصم العميل المحدد من شاشة العملاء |
| `manual_discount_amount` | الخصم اليدوي من الكاشير في POS |

---

## 3. تدفق البيانات (المحدَّث)

```
customers (discount_type, discount_value, discount_expiry)
        ↓  عند اختيار العميل في POS
pos.js: state.customerDiscount = { type, value }
        ↓  calcDiscount() تحسب manualDisc + customerDisc + offerDisc + loyaltyDisc
orders.discount_amount = total of all discounts         (ZATCA)
orders.customer_discount_amount = customerDiscAmt       (مُجمَّد)
orders.manual_discount_amount = manualDiscAmt           (مُجمَّد) ← جديد
orders.discount_label = "خصم العميل (X%) + خصم إضافي (Y%)" (محدَّث)

الفاتورة المطبوعة:
  سطر "خصم العميل (X%)"  ← customer_discount_amount
  سطر "خصم إضافي"        ← manual_discount_amount
  سطر "المجموع بعد الخصم" ← subtotal - total_discount
```

---

## 4. دوال قاعدة البيانات (db.js)

### تعديل `createCustomer(data)`
إضافة استقبال: `discountType`, `discountValue`, `discountExpiry`

```
INSERT INTO customers (..., discount_type, discount_value, discount_expiry)
VALUES (..., ?, ?, ?)
```

### تعديل `updateCustomer(data)`
إضافة تحديث: `discount_type`, `discount_value`, `discount_expiry`

```
UPDATE customers SET ..., discount_type=?, discount_value=?, discount_expiry=? WHERE id=?
```

### `getAllCustomers()` — لا تغيير مطلوب
الأعمدة الجديدة ستُعاد تلقائيًا عبر `customers.*` الموجودة.

### تعديل `createOrder()`
إضافة استقبال: `customerDiscountAmount` وتخزينه في `customer_discount_amount`.
