# API Contracts: أسعار مخصصة للعميل

جميع الـ methods تمر عبر `POST /api/invoke` بـ `{ method, payload }`.

---

## 1. `getCustomPricesScreenData`

**الغرض**: تحميل كامل بيانات شاشة الأسعار المخصصة لعميل.

**Payload**:
```js
{ customerId: number }
```

**Response (success)**:
```js
{
  success: true,
  customer: { id: number, name: string, phone: string },
  products: [
    {
      id: number,
      name_ar: string,
      name_en: string | null,
      totalServices: number,
      customCount: number,
      services: [
        {
          laundryServiceId: number,
          serviceName_ar: string,
          serviceName_en: string,
          generalPrice: number,
          customPrice: number | null
        }
      ]
    }
  ],
  summary: {
    totalServices: number,
    customServices: number,
    averageDifferencePercent: number  // مُدوَّر لرقمين عشريين
  }
}
```

**Response (error)**:
```js
{ success: false, message: 'العميل غير موجود' }
```

**Validation**:
- `customerId` مطلوب وعدد صحيح موجب.
- يُعيد فقط products التي لها price_lines على الأقل.
- يُعيد فقط laundry_services نشطة (`is_active = 1`).

---

## 2. `saveCustomerCustomPrices`

**الغرض**: حفظ وحذف الأسعار المخصصة دفعة واحدة في transaction.

**Payload**:
```js
{
  customerId: number,
  changes: [
    { productId: number, laundryServiceId: number, customPrice: number }
  ],
  deletes: [
    { productId: number, laundryServiceId: number }
  ]
}
```

**Response (success)**:
```js
{ success: true, saved: number, deleted: number }
```

**Response (error)**:
```js
{ success: false, message: 'فشل في حفظ الأسعار' }
```

**Validation**:
- `customerId` مطلوب.
- `changes` و`deletes` يمكن أن يكونا فارغَين لكن ليس كلاهما.
- كل `customPrice` يجب أن يكون `>= 0`.
- كل `(productId, laundryServiceId)` يجب أن يكون موجوداً في `product_price_lines`.
- يُنفَّذ داخل transaction — أي خطأ يُلغي كل التغييرات.

**Upsert SQL**:
```sql
INSERT INTO customer_custom_prices
  (customer_id, product_id, laundry_service_id, custom_price, created_by, updated_by)
VALUES (?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  custom_price = VALUES(custom_price),
  updated_by   = VALUES(updated_by),
  updated_at   = CURRENT_TIMESTAMP
```

---

## 3. `getCustomerPosCustomPrices`

**الغرض**: جلب خريطة سريعة من أسعار عميل للاستخدام في POS.

**Payload**:
```js
{ customerId: number }
```

**Response (success)**:
```js
{
  success: true,
  prices: {
    "productId:laundryServiceId": {
      productId: number,
      laundryServiceId: number,
      customPrice: number
    }
  }
}
```
مثال: `{ "12:3": { productId: 12, laundryServiceId: 3, customPrice: 7.00 } }`

**Response (no custom prices)**:
```js
{ success: true, prices: {} }
```

**Validation**:
- `customerId` مطلوب.
- إذا لم يوجد أسعار خاصة → `prices: {}` (ليس خطأ).

---

## 4. تعديل `window.api` (web-api.js)

```js
api.getCustomPricesScreenData    = (p) => invoke('getCustomPricesScreenData', p);
api.saveCustomerCustomPrices     = (p) => invoke('saveCustomerCustomPrices', p);
api.getCustomerPosCustomPrices   = (p) => invoke('getCustomerPosCustomPrices', p);
```
