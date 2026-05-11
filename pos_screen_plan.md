# خطة تنفيذ شاشة نقطة البيع (POS)

## ملخص
إنشاء شاشة بيع متكاملة (POS) ضمن نظام إدارة المغسلة، تُضاف كبطاقة جديدة في الصفحة الرئيسية وتفتح شاشة مستقلة مقسمة إلى قسمين: عرض المنتجات + السلة.

---

## المكدس التقني
- **Backend**: Node.js + Express
- **Frontend**: Vanilla JS + Tailwind CSS v4
- **قاعدة البيانات**: MySQL (pool + mysql2)
- **الاتجاه**: RTL عربي، خط Cairo
- **API**: `window.api.method()` → `POST /api/invoke` → `invokeHandlers.js`

---

## الملفات التي ستُنشأ
| الملف | الوصف |
|-------|--------|
| `screens/pos/pos.html` | HTML الشاشة الرئيسية |
| `screens/pos/pos.css` | تنسيقات CSS الكاملة |
| `screens/pos/pos.js` | منطق JS بالكامل |

## الملفات التي ستُعدَّل
| الملف | التغيير |
|-------|---------|
| `screens/dashboard/dashboard.html` | إضافة بطاقة "نقطة البيع" |
| `assets/web-api.js` | إضافة 4 دوال API |
| `assets/i18n.js` | إضافة ~50 مفتاح ترجمة عربي/إنجليزي |
| `database/db.js` | إضافة جدولين + 5 دوال قاعدة بيانات |
| `server/invokeHandlers.js` | إضافة 4 حالات جديدة في switch |

---

## 1. تغييرات قاعدة البيانات — `database/db.js`

### جدول `orders`
```sql
CREATE TABLE IF NOT EXISTS orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  order_number     VARCHAR(20)  NOT NULL UNIQUE,
  customer_id      INT          NULL,
  subtotal         DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_rate         DECIMAL(5,2)  NOT NULL DEFAULT 15,
  vat_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method   ENUM('cash','card','other') NOT NULL DEFAULT 'cash',
  notes            TEXT         DEFAULT NULL,
  created_by       VARCHAR(100) DEFAULT NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### جدول `order_items`
```sql
CREATE TABLE IF NOT EXISTS order_items (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  order_id            INT NOT NULL,
  product_id          INT NOT NULL,
  laundry_service_id  INT NOT NULL,
  quantity            INT NOT NULL DEFAULT 1,
  unit_price          DECIMAL(10,2) NOT NULL,
  line_total          DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_oi_order   FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_oi_service FOREIGN KEY (laundry_service_id) REFERENCES laundry_services(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### دوال JS الجديدة في `db.js`
1. **`createOrdersTables()`** — تُستدعى في `initialize()` بعد `createTables()`
2. **`generateOrderNumber()`** — ينشئ رقم طلب بصيغة `ORD-YYYYMMDD-0001`
3. **`getPosProducts()`** — يجلب المنتجات النشطة مع أسطر التسعير + has_image flag
4. **`getPosServices()`** — يجلب العمليات النشطة (name_ar, name_en)
5. **`createOrder({...})`** — يحفظ الطلب + بنوده في معاملة (transaction)
6. **`getOrders({page, pageSize, search})`** — يجلب الطلبات مع اسم العميل

---

## 2. معالجات API — `server/invokeHandlers.js`

أربع حالات جديدة في switch:

```
case 'getPosProducts':
  - استدعاء db.getPosProducts()
  - جلب صور المنتجات (gunzip blob → base64 dataUrl) مثل نمط getProducts
  - return { success: true, products }

case 'getPosServices':
  - استدعاء db.getPosServices()
  - return { success: true, services }

case 'createOrder':
  - توليد رقم طلب: await db.generateOrderNumber()
  - استدعاء db.createOrder({ ...payload, orderNumber, createdBy: _user?.username })
  - return { success: true, id, orderNumber }

case 'getOrders':
  - استدعاء db.getOrders(payload || {})
  - return { success: true, orders, total, page, pageSize }
```

---

## 3. دوال API — `assets/web-api.js`

```js
getPosProducts: () => invoke('getPosProducts'),
getPosServices: () => invoke('getPosServices'),
createOrder: (data) => invoke('createOrder', data),
getOrders: (filters) => invoke('getOrders', filters),
```

---

## 4. بطاقة Dashboard — `screens/dashboard/dashboard.html`

إضافة قبل بطاقة "الإعدادات" (`data-screen="settings"`):
```html
<div class="menu-card" data-screen="pos">
  <div class="card-icon" style="background:linear-gradient(135deg,#22c55e,#16a34a)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
      <path d="M6 8h.01M10 8h4M6 12h12"/>
    </svg>
  </div>
  <h3 class="card-title" data-i18n="card-pos-title">نقطة البيع</h3>
  <p class="card-desc" data-i18n="card-pos-desc">إتمام البيع وإصدار الفواتير</p>
</div>
```

---

## 5. مفاتيح i18n — `assets/i18n.js`

مفاتيح جديدة تُضاف للكائنين `ar` و `en`:

```
card-pos-title / card-pos-desc
page-title-pos
pos-header-title / pos-back
pos-filter-all / pos-search-placeholder
pos-no-products / pos-loading
pos-select-service-title / pos-select-service-msg / pos-btn-select-service
pos-cart-title / pos-cart-empty
pos-customer-placeholder
pos-col-product / pos-col-service / pos-col-qty / pos-col-price / pos-col-total
pos-subtotal / pos-discount / pos-discount-placeholder / pos-vat / pos-total
pos-payment-label / pos-payment-cash / pos-payment-card / pos-payment-other
pos-btn-pay / pos-btn-clear / pos-btn-new-sale / pos-btn-print
pos-err-empty-cart / pos-err-save / pos-err-load
pos-success-title / pos-success-order / pos-success-total
pos-view-cart / pos-view-products
```

---

## 6. تصميم الشاشة

### هيكل HTML الرئيسي
```
pos-wrapper (flex column, 100dvh)
├── header-bar (نفس نمط باقي الشاشات)
│   ├── header-right: أيقونة + عنوان "نقطة البيع"
│   ├── header-center: mobile toggle (المنتجات | السلة 🔴badge)
│   └── header-left: زر "العودة"
└── pos-main (flex row)
    ├── pos-products-panel (60% desktop / 55% tablet / 100% mobile)
    │   ├── service-tabs: تبويبات قابلة للتمرير (الكل + عمليات نشطة)
    │   ├── products-search-input: بحث بالاسم
    │   └── products-grid: شبكة بطاقات
    │       └── product-card: صورة + اسم + سعر + onclick
    └── pos-cart-panel (40% desktop / 45% tablet / 100% mobile)
        ├── customer-search: autocomplete dropdown
        ├── cart-items-list: عناصر السلة (qty +/-, حذف)
        ├── order-summary: مجموع + خصم + ضريبة + إجمالي
        ├── payment-method: نقد | بطاقة | أخرى (3 أزرار toggle)
        └── cart-actions: زر "مسح" + زر "إتمام البيع"

مودالات:
├── service-select-modal: عند منتج بأكثر من عملية
└── success-modal: بعد إتمام البيع (رقم الطلب + الإجمالي + زر بيعة جديدة)
```

### CSS Layout Strategy
```css
/* Mobile first (< 768px): عمود واحد + toggle في الهيدر */
.pos-main { flex-direction: column; overflow: hidden; }
.pos-products-panel, .pos-cart-panel { width: 100%; flex: none; }
/* الـ panel المخفي يُخفى بـ display:none */

/* Tablet (≥ 768px): جنباً إلى جنب */
.pos-main { flex-direction: row; height: 100%; }
.pos-products-panel { flex: 0 0 55%; overflow: hidden; }
.pos-cart-panel { flex: 0 0 45%; border-inline-end: 1px solid #e2e8f0; }

/* Desktop (≥ 1024px): 60/40 */
.pos-products-panel { flex: 0 0 60%; }
.pos-cart-panel { flex: 0 0 40%; }
```

### JS Architecture — `pos.js`
```
State: { products, services, cart[], selectedCustomer, activeServiceId, searchTerm, paymentMethod, vatRate, discount }

Init:
  1. loadSettings() → vatRate
  2. loadServices() → state.services → renderServiceTabs()
  3. loadProducts() → state.products → renderProducts()

Events:
  - serviceTabs click → state.activeServiceId → renderProducts()
  - productSearch input → state.searchTerm → renderProducts()
  - productCard click → if 1 priceLine: addToCart() else: showServiceModal()
  - serviceModal confirm → addToCart()
  - cartItem qty+/- → updateCartItem()
  - cartItem remove → removeFromCart()
  - discountInput → state.discount → updateSummary()
  - paymentBtn → state.paymentMethod
  - btnPay → validateCart() → api.createOrder() → showSuccessModal()
  - btnClearCart → state.cart=[] → renderCart()
  - btnNewSale → reset all state
  - customerSearch → api.getCustomers({search}) → show dropdown
  - Mobile toggle → show/hide panels

Helpers:
  - formatAmount(n) → '1,234.50'
  - renderProductCard(p) → HTML string
  - renderCartRow(item) → HTML string
  - updateSummary() → calculates & updates DOM
```

---

## 7. ترتيب التنفيذ

1. `database/db.js` — إضافة الجدولين والدوال + استدعاء في initialize()
2. `server/invokeHandlers.js` — إضافة 4 حالات
3. `assets/web-api.js` — إضافة 4 دوال
4. `assets/i18n.js` — إضافة مفاتيح الترجمة (ar + en)
5. `screens/dashboard/dashboard.html` — إضافة البطاقة
6. `screens/pos/pos.css` — كتابة CSS الكامل
7. `screens/pos/pos.html` — بناء HTML
8. `screens/pos/pos.js` — منطق JS

---

## 8. التحقق من التنفيذ

1. تشغيل الخادم: `node server/index.js` (أو `npm start`)
2. تسجيل الدخول → الصفحة الرئيسية → التحقق من بطاقة "نقطة البيع" باللون الأخضر
3. النقر على البطاقة → التحقق من فتح الشاشة الصحيحة
4. التحقق من ظهور المنتجات وتبويبات العمليات
5. النقر على منتج بعملية واحدة → يُضاف مباشرة للسلة
6. النقر على منتج بعمليات متعددة → يظهر مودال الاختيار
7. تعديل الكمية، حذف عنصر، مسح السلة
8. البحث عن عميل واختياره
9. إدخال خصم → التحقق من تحديث الحسابات
10. اختيار طريقة دفع ← إتمام البيع
11. التحقق من ظهور مودال النجاح برقم الطلب
12. التحقق من حفظ الطلب في قاعدة البيانات (جدول orders + order_items)
13. اختبار الاستجابة: تصغير النافذة < 768px → toggle يظهر

---

## ملاحظات هامة
- صور المنتجات مخزنة كـ gzip blob → تُفك وتُحوّل لـ base64 dataUrl في المعالج
- معدل الضريبة يُؤخذ من `getAppSettings()` (حقل `vatRate`)
- الخصم رقمي بالريال (ليس نسبة مئوية)
- العميل اختياري تماماً
- التوافق مع الجوالات الصغيرة (min-width: 360px) أولوية قصوى
- نفس الخط (Cairo) والألوان والنمط البصري لباقي الشاشات
