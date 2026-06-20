# Data Model: تسوية الفواتير من رصيد الاشتراك

**Date**: 2026-06-20

---

## التغييرات على Schema

### عمود جديد في جدول `orders`

```sql
-- Migration (idempotent — في db.initialize())
ALTER TABLE orders
  ADD COLUMN settled_by_subscription_period_id INT DEFAULT NULL;

CREATE INDEX idx_orders_settled_by_sub
  ON orders(settled_by_subscription_period_id);
```

| العمود | النوع | القيمة الافتراضية | الوصف |
|--------|-------|-------------------|-------|
| `settled_by_subscription_period_id` | INT | NULL | معرّف فترة الاشتراك التي سوّت هذه الفاتورة. NULL = لم تُسوَّ |

---

## الجداول المُستخدَمة (موجودة، بدون تغيير على schema)

### `orders` — الفواتير

| العمود | النوع | الصلة بالفيتشر |
|--------|-------|----------------|
| `id` | INT PK | معرّف الفاتورة |
| `customer_id` | INT FK | ربط بالعميل |
| `invoice_seq` | INT | رقم الفاتورة المعروض |
| `total_amount` | DECIMAL(10,2) | القيمة الإجمالية للفاتورة |
| `remaining_amount` | DECIMAL(10,2) | المتبقي للسداد |
| `payment_status` | ENUM | `pending` = غير مسددة، `paid` = مسددة |
| `paid_at` | DATETIME | وقت السداد — يُحدَّث عند التسوية |
| `is_refund` | TINYINT | 1 = أمر استرداد — مستبعد من التسوية |
| `is_consumption_only` | TINYINT | 1 = إيصال استهلاك — مستبعد من التسوية |
| `settled_by_subscription_period_id` | INT | **عمود جديد** — مرجع فترة الاشتراك |

### `subscription_periods` — فترات الاشتراك

| العمود | النوع | الصلة بالفيتشر |
|--------|-------|----------------|
| `id` | INT PK | معرّف الفترة |
| `customer_subscription_id` | INT FK | معرّف الاشتراك |
| `credit_remaining` | DECIMAL(10,2) | الرصيد المتبقي — **يُخصَم منه** |
| `status` | ENUM | `active` = نشطة |

### `subscription_ledger` — سجل حركات الاشتراك

| العمود | النوع | الصلة بالفيتشر |
|--------|-------|----------------|
| `id` | INT PK | معرّف السجل |
| `subscription_period_id` | INT FK | الفترة المتأثرة |
| `entry_type` | ENUM | `adjustment` — نوع قيد التسوية |
| `amount` | DECIMAL(10,2) | القيمة السالبة = خصم |
| `balance_after` | DECIMAL(10,2) | الرصيد بعد القيد |
| `notes` | TEXT | `'تسوية فواتير — عدد الفواتير: N'` |
| `created_by` | VARCHAR | اسم المستخدم |

---

## تدفق البيانات عند التسوية

```
قبل التسوية:
  subscription_periods.credit_remaining = 500.00
  orders[1].payment_status = 'pending', total_amount = 150.00
  orders[2].payment_status = 'pending', total_amount = 200.00

بعد التسوية (اختيار الفاتورتين):
  subscription_periods.credit_remaining = 150.00  (500 - 350)
  orders[1].payment_status = 'paid'
  orders[1].paid_at = NOW()
  orders[1].settled_by_subscription_period_id = <period_id>
  orders[2].payment_status = 'paid'
  orders[2].paid_at = NOW()
  orders[2].settled_by_subscription_period_id = <period_id>
  subscription_ledger: entry_type='adjustment', amount=-350.00, balance_after=150.00
```

---

## Validation Rules (في DB layer)

1. `invoiceIds` يجب أن تكون array غير فارغة
2. كل فاتورة يجب أن تخص نفس `customer_id` للاشتراك
3. كل فاتورة يجب أن تكون `payment_status = 'pending'` وليست `is_refund=1` وليست `is_consumption_only=1`
4. `SUM(total_amount) <= credit_remaining` وإلا: throw `'إجمالي الفواتير يتجاوز رصيد الاشتراك'`
5. الفترة يجب أن تكون `status = 'active'` وإلا: throw `'الاشتراك غير نشط'`
