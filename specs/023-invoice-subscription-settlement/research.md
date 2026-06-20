# Research: تسوية الفواتير من رصيد الاشتراك

**Date**: 2026-06-20

---

## 1. البنية الحالية لجدول الاشتراكات

### قرار: كيف يعرف الزر أن العميل عنده فواتير pending؟

**Decision**: جلب عدد الفواتير الغير مسددة مع قائمة الاشتراكات (subquery في `subscriptionListSelectSql`)، أو جلبها عند فتح الـ modal فقط.

**Rationale**: الخيار الأبسط والأقل تأثيراً على الأداء هو **عدم** تضمين الفواتير في query القائمة الرئيسية — الزر يظهر لكل الاشتراكات النشطة، ويكتشف "لا توجد فواتير" فقط عند فتح الـ modal. هذا يتجنب تعقيد الـ JOIN الإضافي الذي يؤثر على كل صفحة من الاشتراكات.

**Alternatives Considered**:
- إضافة `unpaid_invoices_count` في `subscriptionListSelectSql`: مكلف للصفحات الكبيرة ويُعقّد query موجودة.
- جلب منفصل بعد تحميل القائمة (batch): تعقيد غير ضروري.

---

## 2. تصميم دالة getCustomerUnpaidInvoices

**Decision**: دالة بسيطة تجلب `orders` حيث:
- `customer_id = ?`
- `payment_status = 'pending'`
- `is_refund = 0` (استبعاد أوامر الاسترداد)
- `is_consumption_only = 0` (استبعاد إيصالات الاستهلاك)
- `settled_by_subscription_period_id IS NULL` (لم تُسوَّ مسبقاً)
- مرتبة بـ `created_at ASC`

**Fields returned**: `id`, `invoice_seq`, `total_amount`, `created_at`, `remaining_amount`

**Rationale**: الفواتير المؤهلة للتسوية هي فقط الفواتير التجارية العادية الغير مسددة كلياً، وليس إيصالات الاستهلاك أو أوامر الاسترداد.

---

## 3. تصميم دالة settleInvoicesFromSubscription

**Decision**: Transaction كاملة بالترتيب التالي:
1. جلب `subscription_periods` للتحقق من `credit_remaining` الحالي
2. حساب `totalToSettle = SUM(total_amount)` للفواتير المختارة
3. Validation: `totalToSettle <= credit_remaining` وإلا throw
4. `UPDATE orders SET payment_status='paid', paid_at=NOW(), settled_by_subscription_period_id=? WHERE id IN (?)`
5. `UPDATE subscription_periods SET credit_remaining = credit_remaining - ? WHERE id = ?`
6. `INSERT INTO subscription_ledger (entry_type='adjustment', amount=-totalToSettle, ...)`
7. commit

**Rationale**: تتبع نمط `createSubscription` الموجود بالضبط — connection → beginTransaction → operations → commit/rollback → release.

---

## 4. عمود DB جديد: settled_by_subscription_period_id

**Decision**: إضافة عمود `settled_by_subscription_period_id INT DEFAULT NULL` في جدول `orders`.

**Rationale**:
- يربط الفاتورة المُسوَّاة بفترة الاشتراك التي سُوِّيت منها (للتقارير لاحقاً)
- يُستخدم في query `getCustomerUnpaidInvoices` لاستبعاد الفواتير المُسوَّاة مسبقاً
- idempotent migration بنمط try/catch الموجود

**Migration**:
```sql
ALTER TABLE orders ADD COLUMN settled_by_subscription_period_id INT DEFAULT NULL
```
مع index:
```sql
CREATE INDEX idx_orders_settled_by_sub ON orders(settled_by_subscription_period_id)
```

---

## 5. نوع قيد ledger entry

**Decision**: استخدام `entry_type = 'adjustment'` الموجود في `subscription_ledger`.

**Rationale**: الجدول الحالي يدعم: `purchase`, `renewal`, `consumption`, `adjustment`, `refund`. التسوية هي تعديل على الرصيد، لذا `adjustment` هو الأنسب دون الحاجة لإضافة نوع جديد.

**Notes في ledger**: `'تسوية فواتير — عدد الفواتير: N'`

---

## 6. موقع الزر في UI

**Decision**: الزر يُضاف في `subs-actions-compact` div داخل صف الجدول، بجانب أزرار "تفاصيل" و"تجديد" و"المزيد".

**Style**: `sub-action-btn` بدون class تمييز لوني إضافي — نفس style زر "تفاصيل" (`sub-action-btn--detail`) مع أيقونة فاتورة مناسبة.

**Visibility**: يظهر فقط إذا `display_status === 'active'` — نفس منطق زر "تجديد".

---

## 7. الفواتير المدفوعة جزئياً (partial)

**Decision**: الفواتير بـ `payment_status = 'partial'` **مستبعدة** من الإصدار الأول.

**Rationale**: التسوية الكاملة (`pending → paid`) أبسط وأوضح محاسبياً. التسوية الجزئية تحتاج منطقاً إضافياً (تحديث `remaining_amount`) ونطرحها خارج النطاق الآن.
