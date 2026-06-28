# API Contracts: نظام فواتير الفنادق والشركات

جميع الطلبات عبر `POST /api/invoke` بـ `{ method, payload }`.
الاستجابة دائماً `{ success: true, ...data }` أو `{ success: false, message }`.

---

## 1. `createWorkOrder`

**الوصف**: يحفظ أمر تشغيل جديد ويعيد بياناته للطباعة.

**Payload**:
```json
{
  "customerId": 42,
  "items": [
    {
      "productName": "قميص",
      "serviceName": "غسيل وكوي",
      "quantity": 3,
      "unitPrice": 15.00,
      "lineTotal": 45.00,
      "itemType": "product"
    }
  ],
  "subtotal": 45.00,
  "discountAmount": 0,
  "vatRate": 15,
  "vatAmount": 6.75,
  "totalAmount": 51.75,
  "priceDisplayMode": "exclusive",
  "notes": "",
  "createdBy": "أحمد"
}
```

**Response (success)**:
```json
{
  "success": true,
  "workOrderId": 7,
  "workOrderNumber": "D-7",
  "workOrderSeq": 7,
  "customerName": "فندق النخيل",
  "customerTaxNumber": "300000000000003",
  "createdAt": "2026-06-27T10:30:00.000Z"
}
```

**Errors**:
| code | سبب |
|------|-----|
| `CUSTOMER_NOT_CORPORATE` | العميل ليس من نوع شركة |
| `CUSTOMER_NOT_FOUND` | العميل غير موجود |
| `ITEMS_EMPTY` | لا توجد بنود |

---

## 2. `getWorkOrders`

**الوصف**: استعلام أوامر التشغيل مع فلاتر.

**Payload**:
```json
{
  "status": "pending",
  "customerId": 42,
  "search": "D-7",
  "dateFrom": "2026-06-01",
  "dateTo": "2026-06-30",
  "page": 1,
  "pageSize": 20
}
```
جميع الحقول اختيارية. `status` يقبل: `"pending"` | `"invoiced"` | `"cancelled"` | `null` (الكل).

**Response**:
```json
{
  "success": true,
  "rows": [
    {
      "id": 7,
      "workOrderNumber": "D-7",
      "customerId": 42,
      "customerName": "فندق النخيل",
      "customerTaxNumber": "300000000000003",
      "subtotal": 45.00,
      "discountAmount": 0,
      "vatAmount": 6.75,
      "totalAmount": 51.75,
      "status": "pending",
      "consolidatedOrderId": null,
      "consolidatedInvoiceSeq": null,
      "createdAt": "2026-06-27T10:30:00.000Z",
      "items": [
        {
          "productName": "قميص",
          "serviceName": "غسيل وكوي",
          "quantity": 3,
          "unitPrice": 15.00,
          "lineTotal": 45.00
        }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

---

## 3. `cancelWorkOrder`

**الوصف**: إلغاء أمر تشغيل بحالة `pending`.

**Payload**:
```json
{ "workOrderId": 7 }
```

**Response**:
```json
{ "success": true }
```

**Errors**:
| code | سبب |
|------|-----|
| `NOT_FOUND` | الأمر غير موجود |
| `NOT_PENDING` | الأمر ليس في حالة انتظار |

---

## 4. `getWorkOrderForPrint`

**الوصف**: بيانات أمر تشغيل لإعادة الطباعة.

**Payload**:
```json
{ "workOrderId": 7 }
```

**Response**: نفس بنية صف واحد من `getWorkOrders` (مع `items`).

---

## 5. `createConsolidatedInvoice`

**الوصف**: ينشئ فاتورة مجمعة من أوامر تشغيل محددة (transaction كاملة).

**Payload**:
```json
{
  "workOrderIds": [5, 6, 7],
  "discountAmount": 10.00,
  "discountPercent": null,
  "notes": "",
  "createdBy": "مدير",
  "confirmNoVat": false
}
```
- `discountAmount` أو `discountPercent` — أحدهما فقط (أو كلاهما null).
- `confirmNoVat: true` — المستخدم أكّد إصدار فاتورة مبسطة بدون رقم ضريبي.

**Response (success)**:
```json
{
  "success": true,
  "orderId": 312,
  "invoiceSeq": 312,
  "orderNumber": "ORD-312"
}
```

**Errors**:
| code | سبب |
|------|-----|
| `NEEDS_VAT_CONFIRM` | العميل بدون رقم ضريبي، يجب `confirmNoVat: true` |
| `MIXED_CUSTOMERS` | الأوامر تخص عملاء مختلفين |
| `SOME_NOT_PENDING` | بعض الأوامر ليست `pending` |
| `NO_ORDERS_SELECTED` | لا أوامر محددة |
| `DISCOUNT_EXCEEDS_TOTAL` | الخصم أكبر من المجموع |

---

## 6. `getConsolidatedInvoiceForPrint`

**الوصف**: بيانات فاتورة مجمعة لعرضها في invoice-a4.

**Payload**:
```json
{ "orderId": 312 }
```

**Response**:
```json
{
  "success": true,
  "invoice": {
    "orderId": 312,
    "invoiceSeq": 312,
    "orderNumber": "ORD-312",
    "isConsolidated": true,
    "customerId": 42,
    "customerName": "فندق النخيل",
    "customerTaxNumber": "300000000000003",
    "subtotal": 135.00,
    "discountAmount": 10.00,
    "vatRate": 15,
    "vatAmount": 18.75,
    "totalAmount": 143.75,
    "priceDisplayMode": "exclusive",
    "createdAt": "2026-06-27T11:00:00.000Z",
    "workOrders": [
      {
        "workOrderNumber": "D-5",
        "createdAt": "2026-06-25T09:00:00.000Z",
        "items": [ { "productName": "بدلة", "serviceName": "تنظيف جاف", "quantity": 1, "unitPrice": 45.00, "lineTotal": 45.00 } ],
        "subtotal": 45.00,
        "totalAmount": 51.75
      }
    ]
  }
}
```

---

## 7. `getCorporateCustomers`

**الوصف**: قائمة عملاء الشركات مع إجمالي أوامر الانتظار.

**Payload**:
```json
{ "search": "فندق", "page": 1, "pageSize": 20 }
```

**Response**:
```json
{
  "success": true,
  "rows": [
    {
      "id": 42,
      "customerName": "فندق النخيل",
      "phone": "0501234567",
      "taxNumber": "300000000000003",
      "pendingWorkOrders": 3,
      "pendingTotal": 155.25
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```
