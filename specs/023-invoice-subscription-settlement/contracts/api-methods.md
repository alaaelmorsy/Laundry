# API Contracts: تسوية الفواتير من رصيد الاشتراك

**Pattern**: `POST /api/invoke` — `{ method, payload }`

---

## getCustomerUnpaidInvoices

**Purpose**: جلب الفواتير الغير مسددة لعميل معين المؤهلة للتسوية.

### Request
```json
{
  "method": "getCustomerUnpaidInvoices",
  "payload": {
    "customerId": 42
  }
}
```

### Response (success)
```json
{
  "success": true,
  "invoices": [
    {
      "id": 101,
      "invoice_seq": 55,
      "total_amount": "150.00",
      "created_at": "2026-05-10T10:30:00.000Z"
    },
    {
      "id": 108,
      "invoice_seq": 62,
      "total_amount": "200.00",
      "created_at": "2026-05-20T14:00:00.000Z"
    }
  ]
}
```

### Response (no unpaid invoices)
```json
{
  "success": true,
  "invoices": []
}
```

### Response (error)
```json
{
  "success": false,
  "message": "معرّف العميل مطلوب"
}
```

### Filtering Logic (DB layer)
- `customer_id = customerId`
- `payment_status = 'pending'`
- `is_refund = 0`
- `is_consumption_only = 0`
- `settled_by_subscription_period_id IS NULL`
- ORDER BY `created_at ASC`

---

## settleInvoicesFromSubscription

**Purpose**: تسوية فواتير محددة من رصيد فترة اشتراك نشطة. عملية atomic كاملة.

### Request
```json
{
  "method": "settleInvoicesFromSubscription",
  "payload": {
    "subscriptionPeriodId": 7,
    "invoiceIds": [101, 108],
    "createdBy": "أحمد"
  }
}
```

| الحقل | النوع | مطلوب | الوصف |
|-------|-------|--------|-------|
| `subscriptionPeriodId` | INT | ✅ | معرّف فترة الاشتراك النشطة |
| `invoiceIds` | INT[] | ✅ | معرّفات الفواتير المراد تسويتها (1+ فاتورة) |
| `createdBy` | STRING | اختياري | اسم المستخدم للـ ledger |

### Response (success)
```json
{
  "success": true,
  "settledCount": 2,
  "totalSettled": "350.00",
  "creditRemainingAfter": "150.00"
}
```

### Response (error — تجاوز الرصيد)
```json
{
  "success": false,
  "message": "إجمالي الفواتير المختارة (350.00) يتجاوز رصيد الاشتراك (300.00)"
}
```

### Response (error — اشتراك غير نشط)
```json
{
  "success": false,
  "message": "فترة الاشتراك غير نشطة"
}
```

### Response (error — فاتورة غير مؤهلة)
```json
{
  "success": false,
  "message": "بعض الفواتير المختارة غير مؤهلة للتسوية"
}
```

### Transaction Steps (DB layer)
1. `SELECT ... FOR UPDATE` على `subscription_periods` للحصول على `credit_remaining`
2. `SELECT id, total_amount, customer_id, payment_status, is_refund, is_consumption_only, settled_by_subscription_period_id FROM orders WHERE id IN (?)`
3. Validate: كل فاتورة مؤهلة + نفس customer_id + إجمالي <= credit_remaining
4. `UPDATE orders SET payment_status='paid', paid_at=NOW(), settled_by_subscription_period_id=? WHERE id IN (?)`
5. `UPDATE subscription_periods SET credit_remaining = credit_remaining - ? WHERE id = ?`
6. `INSERT INTO subscription_ledger (...) VALUES (...)`
7. `commit`
