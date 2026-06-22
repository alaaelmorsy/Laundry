# API Contracts: عروض الأصناف

**Pattern**: POST `/api/invoke` → `{ method, payload }` → `{ success, ...data }`

---

## `getProductsForOffers`

جلب كل الأصناف التي تملك عمليات، مجمّعة للعرض في الـ UI.

**Payload**: `{}`

**Response**:
```json
{
  "success": true,
  "products": [
    {
      "product_id": 1,
      "product_name": "قميص",
      "lines": [
        { "price_line_id": 5, "service_name": "غسل فقط", "price": 15.00 },
        { "price_line_id": 6, "service_name": "غسل وكوي", "price": 20.00 }
      ]
    }
  ]
}
```

---

## `getProductOffers`

جلب كل عروض الأصناف مع عدد الأصناف المرتبطة بكل عرض.

**Payload**: `{}`

**Response**:
```json
{
  "success": true,
  "offers": [
    {
      "id": 1,
      "name": "عرض رمضان",
      "discount_type": "percentage",
      "discount_value": "20.00",
      "start_date": "2026-03-01 00:00:00",
      "end_date": "2026-03-31 23:59:59",
      "is_active": 1,
      "lines_count": 4,
      "created_at": "2026-06-22T10:00:00.000Z"
    }
  ]
}
```

---

## `getProductOfferById`

جلب عرض واحد مع سطوره الكاملة (للتعديل).

**Payload**: `{ "id": 1 }`

**Response**:
```json
{
  "success": true,
  "offer": {
    "id": 1,
    "name": "عرض رمضان",
    "discount_type": "percentage",
    "discount_value": "20.00",
    "start_date": "2026-03-01 00:00:00",
    "end_date": null,
    "is_active": 1
  },
  "price_line_ids": [5, 6, 12]
}
```

---

## `createProductOffer`

**Payload**:
```json
{
  "name": "عرض الصيف",
  "discountType": "percentage",
  "discountValue": 15,
  "startDate": "2026-07-01T00:00:00",
  "endDate": "2026-08-31T23:59:59",
  "priceLineIds": [5, 6, 12]
}
```

- `startDate` / `endDate`: اختياريان (null مقبول)
- `priceLineIds`: مصفوفة بها عنصر واحد على الأقل

**Response**:
```json
{ "success": true, "id": 3 }
```

**Error cases**:
```json
{ "success": false, "message": "اسم العرض مطلوب" }
{ "success": false, "message": "يجب اختيار صنف وعملية واحدة على الأقل" }
{ "success": false, "message": "قيمة الخصم غير صالحة" }
{ "success": false, "message": "النسبة لا يمكن أن تتجاوز 100%" }
{ "success": false, "message": "تاريخ البداية يجب أن يكون قبل النهاية" }
```

---

## `updateProductOffer`

**Payload**: نفس `createProductOffer` + `"id": 1`

يحذف السطور القديمة ويعيد إدراج الجديدة داخل transaction.

**Response**: `{ "success": true }`

---

## `toggleProductOfferStatus`

**Payload**: `{ "id": 1 }`

**Response**: `{ "success": true }`

---

## `deleteProductOffer`

**Payload**: `{ "id": 1 }`

حذف cascade تلقائي من `product_offer_lines` عبر FK.

**Response**: `{ "success": true }`
