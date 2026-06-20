# Data Model: إيصالات الاستهلاك في تقرير الاشتراكات

## لا تغييرات في قاعدة البيانات

جدول `consumption_receipts` موجود ومكتمل. الميزة تقرأ البيانات فقط.

---

## الكيانات المستخدمة

### consumption_receipts (موجود — قراءة فقط)

```
id                INT PK
receipt_seq       INT          ← رقم الإيصال للعرض
order_id          INT FK       ← ربط بالطلب
customer_id       INT FK       ← ربط بالعميل
subscription_id   INT FK       ← الفلتر الأساسي للجلب
period_id         INT FK       ← الفترة التي ينتمي لها الإيصال
package_name      VARCHAR(200) ← اسم الباقة
amount_consumed   DECIMAL(10,2)← المبلغ المستهلك
balance_before    DECIMAL(10,2)← الرصيد قبل
balance_after     DECIMAL(10,2)← الرصيد بعد
items_json        JSON         ← تفاصيل البنود (المنتجات/الخدمات)
notes             TEXT
created_by        VARCHAR(100)
created_at        DATETIME     ← تاريخ الإيصال للعرض
cleaning_date     DATETIME
delivery_date     DATETIME
```

---

## بنية البيانات في الـ API Response

### getSubscriptionCustomerReport (تحديث)

البيانات الحالية للـ response:
```json
{
  "customer": {...},
  "subscriptions": [...],
  "periods": [...],
  "ledger": [...],
  "invoices": [...]
}
```

البيانات بعد الإضافة:
```json
{
  "customer": {...},
  "subscriptions": [...],
  "periods": [...],
  "ledger": [...],
  "invoices": [...],
  "consumptionReceipts": [
    {
      "id": 1,
      "receipt_seq": 5,
      "created_at": "2026-05-10T...",
      "customer_name": "...",
      "phone": "...",
      "package_name": "...",
      "amount_consumed": "150.00",
      "balance_before": "500.00",
      "balance_after": "350.00",
      "items_json": [...]
    }
  ]
}
```

### getConsumptionReceiptById (موجود — بدون تغيير)

يُستخدم لجلب تفاصيل إيصال محدد عند الضغط على "عرض الإيصال":
```json
{
  "success": true,
  "receipt": {
    "id": 1,
    "receipt_seq": 5,
    "amount_consumed": "150.00",
    "balance_before": "500.00", 
    "balance_after": "350.00",
    "items_json": [...],
    "customer_name": "...",
    "phone": "...",
    "package_name": "...",
    "created_at": "...",
    "cleaning_date": null,
    "delivery_date": null
  }
}
```

---

## علاقات الكيانات (ذات الصلة بالميزة)

```
customer_subscriptions (1)
    └── consumption_receipts (N)  ← subscription_id FK
    └── subscription_periods  (N) ← period_id FK في consumption_receipts
```
