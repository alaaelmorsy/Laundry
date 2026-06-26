# API Contracts: خيار المزرام

جميع الطلبات عبر `POST /api/invoke` بصيغة `{ method, payload }`.

---

## getMerzamTypes

**الغرض**: جلب جميع أنواع المزرام النشطة لعرضها في القائمة المنسدلة.

**Payload**: `{}` (لا يلزم)

**Response**:
```json
{
  "success": true,
  "types": [
    { "id": 1, "name_ar": "مزرام", "name_en": "Merzam", "sort_order": 1 },
    { "id": 2, "name_ar": "مربع", "name_en": "Moraba3", "sort_order": 2 }
  ]
}
```

---

## saveMerzamType

**الغرض**: إضافة أو تعديل نوع مزرام (admin فقط).

**Payload**:
```json
{
  "id": null,
  "nameAr": "مزرام",
  "nameEn": "Merzam",
  "sortOrder": 1,
  "isActive": true
}
```
- `id`: null للإضافة، رقم للتعديل

**Response**:
```json
{ "success": true, "id": 1 }
```

---

## deleteMerzamType

**الغرض**: حذف نوع مزرام (لا يؤثر على الفواتير القديمة).

**Payload**: `{ "id": 3 }`

**Response**:
```json
{ "success": true }
```

**ملاحظة**: الحذف الفعلي من الجدول — الفواتير القديمة محمية بـ `merzam_type_name` (نص).

---

## saveProduct (تعديل موجود)

يُضاف `merzamEnabled` للـ payload الحالي:

```json
{
  "id": 5,
  "nameAr": "غترة",
  "nameEn": "Ghutra",
  "isActive": true,
  "merzamEnabled": true,
  "priceLines": [...]
}
```

---

## getProductsForPos (تعديل موجود)

يُضاف `merzam_enabled` لحقول SELECT في استجابة كل منتج:

```json
{
  "product_id": 5,
  "name_ar": "غترة",
  "merzam_enabled": 1,
  "priceLines": [...]
}
```

---

## createOrder / createOrderItems (تعديل موجود)

كل عنصر في `items[]` يقبل حقلين إضافيين اختياريين:

```json
{
  "productId": 5,
  "serviceId": 2,
  "qty": 1,
  "unitPrice": 15.00,
  "lineTotal": 15.00,
  "merzamTypeId": 6,
  "merzamTypeName": "مزرام مقلوب"
}
```
