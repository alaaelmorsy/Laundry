# Data Model: أسعار مخصصة للعميل

## الجدول الجديد: `customer_custom_prices`

```sql
CREATE TABLE IF NOT EXISTS customer_custom_prices (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  customer_id        INT NOT NULL,
  product_id         INT NOT NULL,
  laundry_service_id INT NOT NULL,
  custom_price       DECIMAL(10,2) NOT NULL,
  created_by         INT NULL,
  updated_by         INT NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_ccp (customer_id, product_id, laundry_service_id),

  KEY idx_ccp_customer   (customer_id),
  KEY idx_ccp_product_svc (product_id, laundry_service_id),

  CONSTRAINT fk_ccp_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ccp_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_ccp_service FOREIGN KEY (laundry_service_id)
    REFERENCES laundry_services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### قواعد:
- `custom_price >= 0` — السعر صفر مسموح (لكن يحتاج تأكيد من الواجهة).
- لا يُخزَّن NULL كسعر — الحذف يعني DELETE للصف بالكامل.
- المفتاح الفريد `uq_ccp` يضمن سجل واحد لكل ثلاثية (عميل × صنف × خدمة).
- CASCADE على customer وproduct وservice يضمن نظافة البيانات تلقائياً.

---

## العلاقات

```
customers (1) ──────────── (∞) customer_custom_prices
products  (1) ──────────── (∞) customer_custom_prices
laundry_services (1) ────── (∞) customer_custom_prices

product_price_lines (مصدر السعر العام) ─── مستقل ─── customer_custom_prices
```

`customer_custom_prices` لا يُعدِّل ولا يُكمِّل `product_price_lines` — يُضاف كطبقة منفصلة.

---

## Pricing Resolution في POS

```
هل العميل لديه سعر خاص لـ (productId + serviceId)؟
  ├── نعم → unitPrice = customPrice,  priceSource = 'custom'
  └── لا  → unitPrice = generalPrice, priceSource = 'general'

هل عدّل الكاشير السعر يدوياً؟
  └── نعم → unitPrice = manualPrice, priceSource = 'manual'
            (لا يحفظ كسعر خاص دائم)
```

---

## بنية Cart Item المُحدَّثة (POS state)

```js
{
  key,              // string — مفتاح فريد للبند
  productId,        // int
  serviceId,        // int — laundry_service_id
  priceLineId,      // int | null
  productNameAr, productNameEn,
  serviceNameAr, serviceNameEn, serviceName,
  merzamEnabled, merzamTypeId, merzamTypeName,
  unitPrice,        // DECIMAL — السعر الفعلي المستخدم في الحسابات
  generalPrice,     // DECIMAL — السعر العام من product_price_lines ★ جديد
  customPrice,      // DECIMAL | null — السعر الخاص إن وجد ★ جديد
  priceSource,      // 'general' | 'custom' | 'manual' ★ جديد
  qty,
  lineTotal         // qty * unitPrice
}
```

---

## خريطة الأسعار في POS state

```js
state.customerCustomPrices = {
  "12:3": { productId: 12, laundryServiceId: 3, customPrice: 7.00 },
  "12:5": { productId: 12, laundryServiceId: 5, customPrice: 12.50 },
  // ...
}
// key = `${productId}:${laundryServiceId}`
```

يُملَأ عند اختيار العميل، يُفرَّغ عند إزالته.

---

## API Response Shapes

### `getCustomPricesScreenData`
```js
{
  success: true,
  customer: { id, name, phone },
  products: [
    {
      id,
      name_ar,
      name_en,
      totalServices: 3,
      customCount: 1,
      services: [
        {
          laundryServiceId,
          serviceName_ar,
          serviceName_en,
          generalPrice,     // من product_price_lines
          customPrice,      // null إذا لم يوجد
        }
      ]
    }
  ],
  summary: {
    totalServices,          // مجموع كل الخدمات في كل الأصناف
    customServices,         // عدد التي لها سعر خاص
    averageDifferencePercent // متوسط نسبة الفرق (مُدوَّر لرقمين)
  }
}
```

### `saveCustomerCustomPrices`
```js
// payload
{
  customerId,
  changes: [{ productId, laundryServiceId, customPrice }],  // upsert
  deletes: [{ productId, laundryServiceId }]                 // delete
}
// response
{ success: true, saved: N, deleted: M }
```

### `getCustomerPosCustomPrices`
```js
// payload: { customerId }
// response
{
  success: true,
  prices: {
    "12:3": { productId: 12, laundryServiceId: 3, customPrice: 7.00 },
    // ...
  }
}
```
