# خطة تنفيذ: تبويب الفواتير الآجلة في شاشة نقطة البيع

## ملخص
إضافة تبويب جديد **"الفواتير الآجلة"** إلى شاشة POS يتيح البحث عن الفواتير غير المدفوعة، ودفعها، وتسجيل التنظيف والتسليم — بتصميم احترافي يخدم مغاسل الملابس في السعودية.

---

## المكدس التقني
- **Frontend**: Vanilla JS + Tailwind CSS + HTML (RTL عربي، خط Cairo)
- **Backend**: Node.js + Express
- **قاعدة البيانات**: MySQL (pool + mysql2)
- **API**: `window.api.method()` → `POST /api/invoke` → `invokeHandlers.js`

---

## الملفات التي ستُعدَّل
| الملف | التغيير |
|-------|---------|
| `database/db.js` | migration + 4 دوال جديدة + تحديث `createOrder` + exports |
| `server/invokeHandlers.js` | 4 حالات جديدة في switch |
| `assets/web-api.js` | 4 دوال API جديدة |
| `assets/i18n.js` | ~30 مفتاح ترجمة (ar + en) |
| `screens/pos/pos.html` | شريط التبويبات + panel الفواتير الآجلة + modal الدفع |
| `screens/pos/pos.js` | state + DOM refs + منطق التبويبات والبحث والدفع |
| `screens/pos/pos.css` | أنماط التبويبات + بطاقات الفواتير |

---

## 1. قاعدة البيانات — `database/db.js`

### 1a. دالة Migration جديدة: `migrateOrdersDeferredColumns()`

تُضاف داخل `createOrdersTables()` أو كدالة مستقلة تُستدعى بعده في `initialize()`.

**خطوات SQL (idempotent):**

```sql
-- 1. تحويل payment_method من ENUM إلى VARCHAR(30) لدعم 'credit','mixed','bank'
ALTER TABLE orders
  MODIFY COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'cash';

-- 2. إضافة payment_status
ALTER TABLE orders
  ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'paid';

-- 3. إضافة paid_at
ALTER TABLE orders
  ADD COLUMN paid_at DATETIME NULL DEFAULT NULL;

-- 4. إضافة cleaning_date
ALTER TABLE orders
  ADD COLUMN cleaning_date DATETIME NULL DEFAULT NULL;

-- 5. إضافة delivery_date
ALTER TABLE orders
  ADD COLUMN delivery_date DATETIME NULL DEFAULT NULL;

-- 6. Backfill: الطلبات بـ payment_method='credit' تصبح payment_status='pending'
UPDATE orders
SET payment_status = 'pending'
WHERE payment_method = 'credit' AND payment_status = 'paid';
```

**استدعاء في `initialize()`:**
```javascript
await createOrdersTables();
await migrateOrdersDeferredColumns(); // ← جديد
```

### 1b. تحديث `createOrder()` — ضبط payment_status و paid_at

داخل دالة `createOrder`، قبل الـ INSERT:
```javascript
const payStatus = (paymentMethod === 'credit') ? 'pending' : 'paid';
const paidAt    = (paymentMethod === 'credit') ? null : new Date();
```

وتعديل جملة INSERT لتشمل: `payment_status, paid_at`

### 1c. الدوال الجديدة

**`getDeferredOrders({ search })`**
```javascript
// يجلب الطلبات بـ payment_status='pending' مع فلترة برقم الفاتورة أو جوال العميل أو اسمه
SELECT o.id, o.order_number, o.invoice_seq, o.total_amount,
       o.payment_method, o.payment_status,
       o.created_at, o.paid_at, o.cleaning_date, o.delivery_date,
       c.id AS customer_id, c.customer_name, c.phone
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
WHERE o.payment_status = 'pending'
  AND (o.order_number LIKE ? OR COALESCE(c.phone,'') LIKE ? OR COALESCE(c.customer_name,'') LIKE ?)
ORDER BY o.created_at DESC
```

**`payDeferredOrder({ orderId, paymentMethod })`**
```javascript
// يضبط payment_status='paid', paid_at=NOW(), يحدّث payment_method
UPDATE orders
SET payment_status='paid', paid_at=NOW(), payment_method=?
WHERE id=? AND payment_status='pending'
// إذا affectedRows=0 → يرفع استثناء "الفاتورة غير موجودة أو مدفوعة مسبقاً"
```

**`markOrderCleaned({ orderId })`**
```javascript
UPDATE orders SET cleaning_date=NOW() WHERE id=?
```

**`markOrderDelivered({ orderId })`**
```javascript
UPDATE orders SET delivery_date=NOW() WHERE id=?
```

**تحديث `module.exports`:** إضافة الأربع دوال الجديدة.

---

## 2. معالجات API — `server/invokeHandlers.js`

أربع حالات جديدة قبل `default:`:

```javascript
case 'getDeferredOrders': {
  const rows = await db.getDeferredOrders({ search: payload.search || '' });
  return { success: true, orders: rows };
}

case 'payDeferredOrder': {
  await db.payDeferredOrder({ orderId: payload.orderId, paymentMethod: payload.paymentMethod || 'cash' });
  return { success: true };
}

case 'markOrderCleaned': {
  await db.markOrderCleaned({ orderId: payload.orderId });
  return { success: true };
}

case 'markOrderDelivered': {
  await db.markOrderDelivered({ orderId: payload.orderId });
  return { success: true };
}
```
*(كل حالة محاطة بـ try/catch ترجع `{ success: false, message: err.message }`)*

---

## 3. دوال API — `assets/web-api.js`

يُضاف بعد `getOrderById`:
```javascript
getDeferredOrders:  (data) => invoke('getDeferredOrders',  data),
payDeferredOrder:   (data) => invoke('payDeferredOrder',   data),
markOrderCleaned:   (data) => invoke('markOrderCleaned',   data),
markOrderDelivered: (data) => invoke('markOrderDelivered', data),
```

---

## 4. مفاتيح i18n — `assets/i18n.js`

### عربي (`ar: { ... }`)
```javascript
'pos-tab-sale':                    'البيع الجديد',
'pos-tab-deferred':                'الفواتير الآجلة',
'pos-deferred-search-placeholder': 'ابحث برقم الفاتورة أو رقم الجوال...',
'pos-deferred-search-btn':         'بحث',
'pos-deferred-loading':            'جارٍ البحث...',
'pos-deferred-no-results':         'لا توجد فواتير آجلة مطابقة',
'pos-deferred-invoice-num':        'رقم الفاتورة',
'pos-deferred-customer':           'العميل',
'pos-deferred-phone':              'الجوال',
'pos-deferred-amount':             'المبلغ',
'pos-deferred-date':               'تاريخ الفاتورة',
'pos-deferred-payment-date':       'تاريخ السداد',
'pos-deferred-cleaning-date':      'تاريخ التنظيف',
'pos-deferred-delivery-date':      'تاريخ التسليم',
'pos-deferred-payment-method':     'طريقة السداد',
'pos-deferred-btn-pay':            'دفع الفاتورة',
'pos-deferred-btn-clean':          'تنظيف',
'pos-deferred-btn-deliver':        'تسليم',
'pos-deferred-pay-title':          'سداد الفاتورة الآجلة',
'pos-deferred-pay-success':        'تم سداد الفاتورة بنجاح',
'pos-deferred-clean-success':      'تم تسجيل التنظيف بنجاح',
'pos-deferred-deliver-success':    'تم تسجيل التسليم بنجاح',
'pos-deferred-status-pending':     'معلق',
'pos-deferred-status-paid':        'مدفوع',
'pos-deferred-status-cleaned':     'نُظّف',
'pos-deferred-status-delivered':   'سُلّم',
```

### إنجليزي (`en: { ... }`)
```javascript
'pos-tab-sale':                    'New Sale',
'pos-tab-deferred':                'Deferred Invoices',
'pos-deferred-search-placeholder': 'Search by invoice # or mobile...',
'pos-deferred-search-btn':         'Search',
'pos-deferred-loading':            'Searching...',
'pos-deferred-no-results':         'No matching deferred invoices',
'pos-deferred-invoice-num':        'Invoice #',
'pos-deferred-customer':           'Customer',
'pos-deferred-phone':              'Mobile',
'pos-deferred-amount':             'Amount',
'pos-deferred-date':               'Invoice Date',
'pos-deferred-payment-date':       'Payment Date',
'pos-deferred-cleaning-date':      'Cleaning Date',
'pos-deferred-delivery-date':      'Delivery Date',
'pos-deferred-payment-method':     'Payment Method',
'pos-deferred-btn-pay':            'Pay Invoice',
'pos-deferred-btn-clean':          'Mark Cleaned',
'pos-deferred-btn-deliver':        'Mark Delivered',
'pos-deferred-pay-title':          'Pay Deferred Invoice',
'pos-deferred-pay-success':        'Invoice paid successfully',
'pos-deferred-clean-success':      'Cleaning recorded successfully',
'pos-deferred-deliver-success':    'Delivery recorded successfully',
'pos-deferred-status-pending':     'Pending',
'pos-deferred-status-paid':        'Paid',
'pos-deferred-status-cleaned':     'Cleaned',
'pos-deferred-status-delivered':   'Delivered',
```

---

## 5. HTML — `screens/pos/pos.html`

### 5a. شريط التبويبات — بعد `</header>` وقبل `<main>`
```html
<div class="pos-main-tabs" id="posMainTabs">
  <button class="pos-tab-btn active" id="tabSale" type="button" data-i18n="pos-tab-sale">البيع الجديد</button>
  <button class="pos-tab-btn" id="tabDeferred" type="button" data-i18n="pos-tab-deferred">الفواتير الآجلة</button>
</div>
```

### 5b. إضافة `id="saleView"` للـ `<main class="pos-main">`
```html
<main class="pos-main" id="saleView">
```

### 5c. Panel الفواتير الآجلة — بعد `</main>` وقبل أول modal
```html
<div class="deferred-panel" id="deferredView" style="display:none">

  <!-- Search row -->
  <div class="deferred-search-row">
    <div class="deferred-search-inner">
      <span class="search-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </span>
      <input id="deferredSearch" type="search" class="deferred-search-input"
        data-i18n-placeholder="pos-deferred-search-placeholder"
        placeholder="ابحث برقم الفاتورة أو رقم الجوال..."
        autocomplete="off" />
    </div>
    <button id="btnDeferredSearch" class="btn-deferred-search" type="button"
      data-i18n="pos-deferred-search-btn">بحث</button>
  </div>

  <!-- Results -->
  <div class="deferred-results-wrap" id="deferredResultsWrap">
    <div class="deferred-empty-state" id="deferredEmptyState">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      <p data-i18n="pos-deferred-no-results">لا توجد فواتير آجلة مطابقة</p>
    </div>
    <div id="deferredList" class="deferred-list"></div>
  </div>

</div>
```

### 5d. Modal الدفع — مع بقية المودالات
```html
<div id="payDeferredModal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true">
  <div class="modal-box">
    <div class="modal-header">
      <h2 class="modal-title" data-i18n="pos-deferred-pay-title">سداد الفاتورة الآجلة</h2>
      <button class="modal-close-btn" id="btnPayDeferredClose" type="button">✕</button>
    </div>
    <div class="modal-body">
      <input type="hidden" id="payDeferredOrderId" value="" />
      <div class="form-group">
        <label class="form-label" data-i18n="pos-deferred-payment-method">طريقة السداد</label>
        <div class="form-select-wrap">
          <select id="payDeferredMethod" class="form-input form-select"></select>
        </div>
      </div>
      <div id="payDeferredError" class="form-error" style="display:none"></div>
    </div>
    <div class="modal-footer">
      <button id="btnPayDeferredCancel" class="btn-modal-cancel" type="button">إلغاء</button>
      <button id="btnPayDeferredConfirm" class="btn-modal-save" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span data-i18n="pos-deferred-btn-pay">دفع الفاتورة</span>
      </button>
    </div>
  </div>
</div>
```

---

## 6. JavaScript — `screens/pos/pos.js`

### 6a. إضافات `state`
```javascript
deferredInvoices: [],
deferredSearchTimer: null,
activeTab: 'sale',
```

### 6b. إضافات `els`
```javascript
tabSale:              document.getElementById('tabSale'),
tabDeferred:          document.getElementById('tabDeferred'),
saleView:             document.getElementById('saleView'),
deferredView:         document.getElementById('deferredView'),
deferredSearch:       document.getElementById('deferredSearch'),
btnDeferredSearch:    document.getElementById('btnDeferredSearch'),
deferredEmptyState:   document.getElementById('deferredEmptyState'),
deferredList:         document.getElementById('deferredList'),
payDeferredModal:     document.getElementById('payDeferredModal'),
payDeferredOrderId:   document.getElementById('payDeferredOrderId'),
payDeferredMethod:    document.getElementById('payDeferredMethod'),
payDeferredError:     document.getElementById('payDeferredError'),
btnPayDeferredClose:  document.getElementById('btnPayDeferredClose'),
btnPayDeferredCancel: document.getElementById('btnPayDeferredCancel'),
btnPayDeferredConfirm:document.getElementById('btnPayDeferredConfirm'),
```

### 6c. `switchTab(tab)` — تبديل التبويبات
```javascript
function switchTab(tab) {
  state.activeTab = tab;
  const isSale = tab === 'sale';
  els.saleView.style.display     = isSale ? '' : 'none';
  els.deferredView.style.display = isSale ? 'none' : '';
  els.tabSale.classList.toggle('active', isSale);
  els.tabDeferred.classList.toggle('active', !isSale);
  if (!isSale) searchDeferredInvoices();
}
```

### 6d. أحداث تُضاف في `bindEvents()`
```javascript
els.tabSale.addEventListener('click', () => switchTab('sale'));
els.tabDeferred.addEventListener('click', () => switchTab('deferred'));
els.btnDeferredSearch.addEventListener('click', searchDeferredInvoices);
els.deferredSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchDeferredInvoices(); });
els.deferredSearch.addEventListener('input', () => {
  clearTimeout(state.deferredSearchTimer);
  state.deferredSearchTimer = setTimeout(searchDeferredInvoices, 450);
});
els.btnPayDeferredClose.addEventListener('click', closePayDeferredModal);
els.btnPayDeferredCancel.addEventListener('click', closePayDeferredModal);
els.btnPayDeferredConfirm.addEventListener('click', confirmPayDeferred);
```

### 6e. `searchDeferredInvoices()`
```javascript
async function searchDeferredInvoices() {
  const search = els.deferredSearch.value.trim();
  els.deferredList.innerHTML = '';
  els.deferredEmptyState.style.display = 'flex';
  els.deferredEmptyState.querySelector('p').textContent = t('pos-deferred-loading');

  const res = await window.api.getDeferredOrders({ search });
  if (!res || !res.success) {
    showToast(res && res.message ? res.message : t('pos-err-load'), 'error');
    els.deferredEmptyState.querySelector('p').textContent = t('pos-deferred-no-results');
    return;
  }
  state.deferredInvoices = res.orders || [];
  renderDeferredInvoices(state.deferredInvoices);
}
```

### 6f. `renderDeferredInvoices(invoices)`
بطاقة لكل فاتورة تُظهر:
- رقم الفاتورة + شارات الحالة (معلق/مدفوع/نُظّف/سُلّم)
- المبلغ الإجمالي بالريال السعودي
- اسم العميل + الجوال
- تاريخ الفاتورة، تاريخ التنظيف، تاريخ التسليم، تاريخ السداد
- أزرار: دفع الفاتورة (يفتح modal) | تنظيف | تسليم

زر الدفع معطّل إذا `payment_status === 'paid'`  
زر التنظيف معطّل إذا `cleaning_date` موجود  
زر التسليم معطّل إذا `delivery_date` موجود

### 6g. دوال Modal الدفع
```javascript
function openPayDeferredModal(orderId) { /* ضبط orderId + تعبئة payment methods بدون 'credit' */ }
function closePayDeferredModal()       { /* إخفاء modal */ }
async function confirmPayDeferred()    { /* استدعاء payDeferredOrder + toast + إعادة بحث */ }
```

### 6h. دوال التنظيف والتسليم
```javascript
async function markCleaned(orderId)   { /* markOrderCleaned → toast → searchDeferredInvoices */ }
async function markDelivered(orderId) { /* markOrderDelivered → toast → searchDeferredInvoices */ }
```

### 6i. Globals للـ onclick في HTML المُولَّد
```javascript
// في نهاية IIFE
window._posPayInvoice    = openPayDeferredModal;
window._posMarkCleaned   = markCleaned;
window._posMarkDelivered = markDelivered;
```

---

## 7. CSS — `screens/pos/pos.css`

يُضاف في نهاية الملف:

### شريط التبويبات
```css
.pos-main-tabs {
  display: flex; align-items: center;
  background: #fff; border-bottom: 2px solid #e2e8f0;
  padding: 0 16px; flex-shrink: 0; gap: 4px;
}
.pos-tab-btn {
  position: relative; padding: 10px 20px;
  font-size: 14px; font-weight: 600; color: #64748b;
  background: none; border: none; border-bottom: 3px solid transparent;
  cursor: pointer; transition: color 0.2s, border-color 0.2s;
  margin-bottom: -2px; white-space: nowrap; font-family: 'Cairo', sans-serif;
}
.pos-tab-btn:hover { color: #22c55e; }
.pos-tab-btn.active { color: #16a34a; border-bottom-color: #22c55e; }
```

### Panel الفواتير الآجلة
```css
.deferred-panel {
  flex: 1; overflow: hidden; display: flex;
  flex-direction: column; background: #f1f5f9;
  padding: 16px; gap: 12px;
}
```

### صف البحث
```css
.deferred-search-row { display: flex; align-items: center; gap: 10px;
  background: #fff; border-radius: 12px; padding: 10px 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06); flex-shrink: 0; }
.deferred-search-inner { flex: 1; display: flex; align-items: center; gap: 8px; }
.deferred-search-input { flex: 1; border: none; outline: none;
  font-size: 14px; background: transparent; font-family: 'Cairo', sans-serif; }
.btn-deferred-search { padding: 8px 18px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff; border: none; border-radius: 8px;
  font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Cairo', sans-serif; }
```

### بطاقة الفاتورة
```css
.deferred-invoice-card { background: #fff; border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
.def-card-header { display: flex; align-items: flex-start;
  justify-content: space-between; padding: 12px 16px 8px;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9); }
.def-inv-num { font-size: 15px; font-weight: 700; color: #1e293b; direction: ltr; }
.def-amount  { font-size: 18px; font-weight: 800; color: #16a34a; direction: ltr; }
.def-card-body { padding: 10px 16px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
.def-info-label { font-size: 11px; color: #94a3b8; font-weight: 600; }
.def-info-val   { font-size: 13px; color: #334155; font-weight: 500; }
```

### شارات الحالة
```css
.def-badge          { display: inline-flex; align-items: center; padding: 2px 8px;
  border-radius: 20px; font-size: 11px; font-weight: 700; }
.def-badge-pending   { background: #fef3c7; color: #92400e; }
.def-badge-paid      { background: #dcfce7; color: #15803d; }
.def-badge-cleaned   { background: #dbeafe; color: #1d4ed8; }
.def-badge-delivered { background: #ede9fe; color: #6d28d9; }
```

### أزرار الإجراءات
```css
.def-card-actions { display: flex; gap: 8px; padding: 10px 16px 12px;
  border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
.def-btn { display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 14px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 700; font-family: 'Cairo', sans-serif;
  cursor: pointer; flex: 1; justify-content: center; min-width: 80px; }
.def-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.def-btn-pay     { background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; }
.def-btn-clean   { background: linear-gradient(135deg, #60a5fa, #2563eb); color: #fff; }
.def-btn-deliver { background: linear-gradient(135deg, #a78bfa, #7c3aed); color: #fff; }
```

### Responsive Mobile
```css
@media (max-width: 767px) {
  .pos-main-tabs { padding: 0 10px; }
  .pos-tab-btn { font-size: 13px; padding: 9px 14px; }
  .deferred-panel { padding: 10px; gap: 8px; }
  .def-card-body { grid-template-columns: 1fr; }
  .def-card-actions { flex-direction: column; }
  .def-btn { width: 100%; }
}
```

---

## 8. ترتيب التنفيذ

1. **`database/db.js`** — إضافة `migrateOrdersDeferredColumns()` + تحديث `createOrder` + 4 دوال + exports
2. **`server/invokeHandlers.js`** — 4 حالات جديدة
3. **`assets/web-api.js`** — 4 دوال جديدة
4. **`assets/i18n.js`** — المفاتيح (ar + en)
5. **`screens/pos/pos.html`** — شريط التبويبات + panel + modal
6. **`screens/pos/pos.js`** — state + DOM refs + كل الدوال الجديدة
7. **`screens/pos/pos.css`** — الأنماط الجديدة

---

## 9. التحقق من التنفيذ

1. تشغيل الخادم: `npm start`
2. MySQL: `DESCRIBE orders;` — التحقق من وجود الأعمدة الجديدة وأن `payment_method` أصبح `varchar(30)`
3. إنشاء فاتورة بـ `payment_method='credit'` من POS → التحقق من `payment_status='pending'` في DB
4. فتح POS → يظهر شريط تبويبين: "البيع الجديد" | "الفواتير الآجلة"
5. النقر على "الفواتير الآجلة" → يظهر panel البحث
6. البحث برقم جوال عميل له فواتير آجلة → تظهر البطاقات مع كل التواريخ والمبالغ
7. النقر على "دفع الفاتورة" → Modal يظهر مع طرق الدفع (بدون 'آجل') → تأكيد → toast نجاح + تحديث البطاقة
8. النقر على "تنظيف" → toast + تاريخ التنظيف يظهر في البطاقة + الزر يُعطَّل
9. النقر على "تسليم" → toast + تاريخ التسليم يظهر + الزر يُعطَّل
10. النقر على "البيع الجديد" → يعود panel البيع ويختفي panel الفواتير
11. اختبار الجوال (< 768px) → بطاقات بعمود واحد + أزرار مكدّسة عمودياً
