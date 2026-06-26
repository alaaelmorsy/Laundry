# Research: أسعار مخصصة للعميل

## 1. هيكل قاعدة البيانات الحالي

### جدول `product_price_lines`
```sql
id                 INT PK AUTO_INCREMENT
product_id         INT NOT NULL  → FK products(id) CASCADE DELETE
laundry_service_id INT NOT NULL  → FK laundry_services(id) RESTRICT DELETE
price              DECIMAL(10,2) NOT NULL
UNIQUE KEY uq_product_service (product_id, laundry_service_id)
```
هذا هو مصدر السعر العام. الجدول الجديد `customer_custom_prices` سيُكمله ولن يعدّله.

### جدول `laundry_services`
```sql
id, name_ar, name_en, is_active TINYINT DEFAULT 1, sort_order INT DEFAULT 0, created_at
```

### جدول `products`
```sql
id, name_ar, name_en, image_blob, image_mime, is_active, sort_order, created_at
```

---

## 2. بنية POS الحالية — addToCart

```js
// screens/pos/pos.js : line 1036
function addToCart(product, priceLine) {
  const key = `${product.id}_${priceLine.laundry_service_id}_${Date.now()}`;
  const unitPrice = parseFloat(priceLine.price);
  state.cart.push({
    key,
    productId: product.id,
    serviceId: priceLine.laundry_service_id,
    priceLineId: priceLine.price_line_id || null,
    productNameAr, productNameEn,
    serviceNameAr, serviceNameEn, serviceName,
    merzamEnabled, merzamTypeId, merzamTypeName,
    unitPrice,
    qty: 1,
    lineTotal: unitPrice
  });
}
```

**القرار**: إضافة الحقول `generalPrice`, `customPrice`, `priceSource` لبند الـ cart — لا يكسر السلوك الحالي لأن `unitPrice` يبقى هو مصدر الحساب.

---

## 3. بنية القائمة الجانبية

```js
// assets/sidebar.js — SIDEBAR_ITEMS[]
{
  screen: 'customer-custom-prices',
  labelKey: 'gsb-nav-customer-custom-prices',
  label: { ar: 'الأسعار المخصصة', en: 'Custom Prices' },
  permission: 'customer_custom_prices',
  adminOnly: false,
  svg: '...'
}
```
يُضاف في مجموعة `gsb-section-admin` بعد `customers`.

---

## 4. نمط الـ upsert المعتمد في المشروع

المشروع يستخدم `INSERT ... ON DUPLICATE KEY UPDATE` لعمليات upsert في عدة أماكن. هذا النمط مناسب لجدول `customer_custom_prices` لأن UNIQUE KEY على `(customer_id, product_id, laundry_service_id)`.

---

## 5. نمط الـ Transaction في المشروع

```js
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  // ... operations
  await conn.commit();
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
}
```

---

## 6. نظام الصلاحيات

الصلاحيات في `sidebar.js` تُحدَّد بـ string مثل `'customers'`, `'products'`. صلاحية الشاشة الجديدة:
```
permission: 'customer_custom_prices'
```
المدير (`admin`) يرى كل الشاشات تلقائياً. الكاشير لا يرى الشاشة إلا إذا مُنح الصلاحية.

---

## 7. قرارات التصميم

| القرار | الاختيار | السبب |
|--------|----------|-------|
| نمط تحميل أسعار POS | استدعاء واحد عند اختيار العميل | أسرع من الاستدعاء لكل بند |
| شكل خريطة الأسعار | `"productId:serviceId"` → `{customPrice}` | بحث O(1) في POS |
| حفظ الأسعار | Batch (كل التغييرات دفعة واحدة) | أبسط UX وأقل طلبات |
| حذف سعر خاص | DELETE من قاعدة البيانات | لا يُخزَّن NULL |
| Foreign keys | CASCADE على customer وproduct | لا يبقى يتيم في البيانات |
| FK على laundry_services | CASCADE (لا RESTRICT) | يتوافق مع حذف الخدمة |
| تأثير ZATCA | صفر — السعر النهائي هو نفسه | لا منطق ضريبي جديد |
