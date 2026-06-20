# Data Model: التحكم في مديونية الاشتراك

## الكيانات المتأثرة

### 1. app_settings (موجود — لا تغيير في المخطط)

| الحقل | النوع | القيمة الافتراضية | الوصف |
|-------|-------|-------------------|-------|
| `allow_subscription_debt` | `TINYINT(1)` | `0` | 0 = ممنوعة المديونية، 1 = مسموح |

**موجود بالفعل** — لا يلزم migration جديد.

---

### 2. subscription_periods (موجود — تعديل على القيد المنطقي فقط)

| الحقل | النوع | القيد الحالي | القيد الجديد |
|-------|-------|-------------|-------------|
| `credit_remaining` | `DECIMAL(10,2)` | افتراض ضمني: `>= 0` | يُسمح بالسالب عند `allow_subscription_debt = 1` |

**لا يوجد تغيير في DDL** — القاعدة لا تفرض CHECK constraint على هذا الحقل، التغيير منطقي فقط في التطبيق.

---

### 3. رمز الخطأ الجديد (Application-level)

هذا ليس كياناً في قاعدة البيانات، بل contract بين backend وfrontend:

```
code: 'INSUFFICIENT_SUBSCRIPTION_CREDIT'
```

يُعاد في `{ success: false, message: "...", code: "INSUFFICIENT_SUBSCRIPTION_CREDIT", creditRemaining: <number>, orderTotal: <number> }` عند حجب الطلب.

---

## العلاقات والتأثيرات

```
app_settings.allow_subscription_debt
    │
    ├─── = 1 (مسموح) ──→ createOrder يخصم كامل المبلغ
    │                      subscription_periods.credit_remaining قد يصبح سالباً
    │
    └─── = 0 (ممنوع) ──→ إذا كان paymentMethod='subscription' AND credit < total
                           ──→ إعادة INSUFFICIENT_SUBSCRIPTION_CREDIT (لا يُنشأ order)
                           ──→ pos.js يعرض إشعار ويمنع الطباعة
```

## السيناريوهات والحالات

| allowDebt | creditRemaining | paymentMethod | النتيجة |
|-----------|-----------------|---------------|---------|
| true | أي قيمة | subscription | يُكمل الطلب، الرصيد قد يصبح سالباً |
| false | >= total | subscription | يُكمل الطلب، الرصيد يُخصم |
| false | 0 أو < total | subscription | **حجب** — INSUFFICIENT_SUBSCRIPTION_CREDIT |
| false | جزئي > 0 | cash/card | يُكمل الطلب (خصم جزئي + دفع نقدي/بطاقة) |
| false | 0 | cash/card | يُكمل الطلب كدفع نقدي عادي بلا خصم |
