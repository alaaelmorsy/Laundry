# Implementation Plan: أسعار مخصصة للعميل

**Branch**: `029-customer-custom-prices` | **Date**: 2026-06-26 | **Spec**: [spec.md](spec.md)

---

## Summary

إضافة شاشة إدارية جديدة "الأسعار المخصصة" تُتيح تعيين سعر خاص لكل عميل على مستوى (عميل × صنف × خدمة). الشاشة بتصميم Master-Detail احترافي. عند اختيار العميل في POS تُطبَّق الأسعار المخصصة تلقائياً. المنطق مبني على جدول جديد `customer_custom_prices` مع 3 API methods جديدة.

---

## Technical Context

**Language/Version**: Node.js 20 (CommonJS) + Vanilla JS (ES5-compatible)

**Primary Dependencies**: Express.js, mysql2/promise

**Storage**: MySQL — جدول جديد `customer_custom_prices` مع UNIQUE KEY + CASCADE FKs

**Testing**: يدوي — سيناريوهات quickstart.md

**Target Platform**: Windows (NSSM service), متصفح محلي

**Project Type**: Desktop POS web application (single-tenant)

**Performance Goals**: شاشة تفتح < 2 ثانية، حفظ < 1 ثانية

**Constraints**: لا framework، لا ORM، لا ES modules، لا DDL من invokeHandlers

**Scale/Scope**: شاشة واحدة + 3 API methods + تعديل بسيط على POS

---

## Constitution Check

| القاعدة | الحالة | الملاحظة |
|---------|--------|----------|
| 4-Step API Checklist | ✅ | db.js → invokeHandlers → web-api.js → screen JS |
| لا framework | ✅ | Vanilla JS فقط |
| لا ORM | ✅ | raw mysql2 queries |
| لا fetch مباشر | ✅ | window.api فقط |
| لا DDL من invokeHandlers | ✅ | migration في db.initialize() |
| Migrations additive + try/catch | ✅ | CREATE TABLE IF NOT EXISTS |
| DECIMAL(10,2) للأموال | ✅ | custom_price DECIMAL(10,2) |
| لا تأثير على ZATCA | ✅ | السعر النهائي هو مصدر الحقيقة |
| لا تغيير على thermal print | ✅ | الفاتورة تعرض السعر النهائي فقط |
| POS checkout الحالي محمي | ✅ | unitPrice يبقى مصدر الحساب |

---

## Project Structure

### Documentation
```
specs/029-customer-custom-prices/
├── plan.md              ← هذا الملف
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-methods.md
└── tasks.md             ← يُنشأ بـ /speckit-tasks
```

### Source Files
```
database/db.js                          ← migration + 3 دوال
server/invokeHandlers.js                ← 3 cases
assets/web-api.js                       ← 3 methods
assets/sidebar.js                       ← بند جديد
assets/i18n.js                          ← مفاتيح ترجمة
screens/customer-custom-prices/         ← جديد (html + js + css)
screens/customers/customers.js          ← زر "أسعار خاصة"
screens/pos/pos.js                      ← تكامل الأسعار المخصصة
```

---

## Phase 1 — Database Migration

**الملف**: `database/db.js` داخل `db.initialize()`

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
  KEY idx_ccp_customer (customer_id),
  KEY idx_ccp_product_svc (product_id, laundry_service_id),
  CONSTRAINT fk_ccp_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ccp_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_ccp_service FOREIGN KEY (laundry_service_id)
    REFERENCES laundry_services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

يُلفَّف في try/catch كباقي migrations.

---

## Phase 2 — Backend API

### دالة `getCustomPricesScreenData(customerId)`

```js
async function getCustomPricesScreenData(customerId) {
  // 1. جلب بيانات العميل
  // 2. JOIN: products × product_price_lines × laundry_services LEFT JOIN customer_custom_prices
  // 3. تجميع النتائج في JavaScript (group by product)
  // 4. حساب summary: totalServices, customServices, averageDifferencePercent
}
```

**SQL الأساسي**:
```sql
SELECT
  p.id AS product_id,
  p.name_ar, p.name_en,
  p.sort_order AS product_sort,
  ppl.laundry_service_id,
  ls.name_ar AS service_name_ar,
  ls.name_en AS service_name_en,
  ls.sort_order AS service_sort,
  ppl.price AS general_price,
  ccp.custom_price
FROM products p
JOIN product_price_lines ppl ON ppl.product_id = p.id
JOIN laundry_services ls ON ls.id = ppl.laundry_service_id AND ls.is_active = 1
LEFT JOIN customer_custom_prices ccp
  ON ccp.product_id = p.id
  AND ccp.laundry_service_id = ppl.laundry_service_id
  AND ccp.customer_id = ?
WHERE p.is_active = 1
ORDER BY p.sort_order, p.id, ls.sort_order, ls.id
```

### دالة `saveCustomerCustomPrices(customerId, changes, deletes, userId)`

- Transaction كامل
- Upsert: `INSERT ... ON DUPLICATE KEY UPDATE`
- Delete: `DELETE WHERE customer_id=? AND product_id=? AND laundry_service_id=?`
- Validation: كل (productId, serviceId) يجب أن يكون في `product_price_lines`

### دالة `getCustomerPosCustomPrices(customerId)`

```sql
SELECT product_id, laundry_service_id, custom_price
FROM customer_custom_prices
WHERE customer_id = ?
```

يُعاد كـ object: `{ "productId:serviceId": { productId, laundryServiceId, customPrice } }`

### invokeHandlers.js

```js
case 'getCustomPricesScreenData':
  result = await db.getCustomPricesScreenData(payload.customerId); break;

case 'saveCustomerCustomPrices':
  result = await db.saveCustomerCustomPrices(
    payload.customerId, payload.changes, payload.deletes,
    req.user?.id || null
  ); break;

case 'getCustomerPosCustomPrices':
  result = await db.getCustomerPosCustomPrices(payload.customerId); break;
```

### web-api.js

```js
api.getCustomPricesScreenData  = p => invoke('getCustomPricesScreenData', p);
api.saveCustomerCustomPrices   = p => invoke('saveCustomerCustomPrices', p);
api.getCustomerPosCustomPrices = p => invoke('getCustomerPosCustomPrices', p);
```

---

## Phase 3 — Admin Screen

### الهيكل العام للشاشة

```
┌─ Header ─────────────────────────────────────────────────┐
│ ← عنوان   [dropdown: اختر العميل ▼]      [💾 حفظ]       │
├─ Summary Cards ──────────────────────────────────────────┤
│  [ إجمالي الخدمات: 12 ]  [ مخصصة: 3 ]  [ متوسط: 18% ]  │
├─ Master Panel ──────────────┬─ Detail Panel ─────────────┤
│ [🔍 بحث...]                │  [اسم الصنف]               │
│                             │  ┌──────┬───────┬────────┐ │
│ ● بدلة رجالي    1 مخصصة   │  │خدمة │ عام  │ خاص    │ │
│ ○ قميص          0           │  ├──────┼───────┼────────┤ │
│ ● معطف          2 مخصصة   │  │ ... │ ...  │[input] │ │
│ ○ بنطلون        0           │  └──────┴───────┴────────┘ │
└─────────────────────────────┴────────────────────────────┘
```

### State

```js
const state = {
  selectedCustomer: null,
  products: [],               // من API
  selectedProductId: null,
  customPrices: {},           // { "pid:sid": price } — live edits
  originalPrices: {},         // { "pid:sid": price } — من قاعدة البيانات
  isDirty: false
};
```

### Visual Rules

| الحالة | التأثير البصري |
|--------|----------------|
| سعر خاص أقل من العام | حقل أخضر + "وفّر X%" |
| سعر خاص أعلى من العام | حقل برتقالي تحذيري |
| سعر خاص = صفر | حقل أحمر + تأكيد قبل الحفظ |
| حقل معدَّل غير محفوظ | shadow أزرق (dirty state) |
| السعر العام إذا وجد خاص | مشطوب + باهت |

---

## Phase 4 — Navigation & Permissions

### sidebar.js
```js
// في gsb-section-admin، بعد customers
{
  screen: 'customer-custom-prices',
  labelKey: 'gsb-nav-customer-custom-prices',
  label: { ar: 'الأسعار المخصصة', en: 'Custom Prices' },
  permission: 'customer_custom_prices',
  svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
}
```

### customers.js
إضافة زرار في صف العميل:
```js
`<button class="btn-sm btn-outline" onclick="openCustomPrices(${customer.id})" title="أسعار خاصة">
  <svg>...</svg>
</button>`

function openCustomPrices(customerId) {
  window.api.navigateTo(`customer-custom-prices?customer_id=${customerId}`);
}
```

### Query Parameter Handling
```js
// في customer-custom-prices.js عند DOMContentLoaded
const params = new URLSearchParams(window.location.search);
const preId = parseInt(params.get('customer_id'));
if (preId) await selectCustomer(preId);
```

---

## Phase 5 — POS Integration

### تعديلات pos.js

**1. إضافة للـ state** (حول line 11):
```js
customerCustomPrices: {},   // { "productId:serviceId": { customPrice } }
```

**2. عند اختيار عميل** (حول line 1600، بعد تحميل الاشتراك):
```js
state.customerCustomPrices = {};
const cpr = await window.api.getCustomerPosCustomPrices({ customerId: customer.id });
if (cpr.success) state.customerCustomPrices = cpr.prices || {};
```

**3. عند إزالة العميل** (حول line 1686):
```js
state.customerCustomPrices = {};
state.cart.forEach(item => {
  if (item.priceSource === 'custom') {
    item.unitPrice = item.generalPrice;
    item.customPrice = null;
    item.priceSource = 'general';
    item.lineTotal = item.qty * item.unitPrice;
  }
});
renderCart();
```

**4. تعديل `addToCart`** (line 1036):
```js
function addToCart(product, priceLine) {
  const generalPrice = parseFloat(priceLine.price);
  const lookupKey = `${product.id}:${priceLine.laundry_service_id}`;
  const customEntry = state.customerCustomPrices?.[lookupKey];
  const customPrice = customEntry ? parseFloat(customEntry.customPrice) : null;
  const unitPrice = customPrice !== null ? customPrice : generalPrice;
  const priceSource = customPrice !== null ? 'custom' : 'general';

  state.cart.push({
    // ... الحقول الحالية بدون تغيير ...
    unitPrice,
    generalPrice,   // ★ جديد
    customPrice,    // ★ جديد
    priceSource,    // ★ جديد
    qty: 1,
    lineTotal: unitPrice
  });
}
```

**5. مؤشر بصري في renderCart**:
```js
// في template literal للبند
`${item.priceSource === 'custom' ? '<span class="badge-custom-price" title="سعر خاص">★</span>' : ''}`
```

---

## ملاحظات تنفيذية

1. **ترتيب التنفيذ**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
2. **لا تُعدِّل `product_price_lines`** — قراءة فقط
3. **`unitPrice` في POS** يبقى مصدر الحقيقة للحسابات والطباعة وZATCA
4. **نسبة الفرق**: `((generalPrice - customPrice) / generalPrice * 100).toFixed(1)`
5. **Debounce البحث**: 300ms كمعيار المشروع
6. **سعر صفر**: تأكيد client-side قبل الحفظ
7. **تغيير عميل في POS**: إعادة تسعير `general` و`custom` فقط، `manual` يبقى
