# خطة ميزة الدفع المختلط (Mixed Payment)

> **الإصدار:** 1.0  
> **المرجع السياقي:** اقرأ `ai_context/PROJECT_CONTEXT.md` و `ai_context/BUSINESS_RULES.md` قبل البدء.  
> **نمط المشروع:** Node.js/Express + MySQL (mysql2/promise) + Vanilla JS + Tailwind CSS 4 (RTL عربي).

---

## 1. ملخص الميزة

عند اختيار طريقة الدفع **مختلط** في أي مكان يسمح بالدفع، يُوزَّع المبلغ الإجمالي على نوعين:

| الحقل | القيمة |
|-------|--------|
| **نقداً (Cash)** | يدخله الكاشير يدوياً |
| **شبكة (Card)** | تُحسب تلقائياً = الإجمالي − نقداً |

تظهر القيمتان في:
1. **شاشة نقطة البيع (POS)** — عند اختيار `مختلط` تنبثق حقلان بجانب القائمة.
2. **الإيصال الحراري** — سطران تحت "الإجمالي شامل الضريبة".
3. **فاتورة A4** — سطران تحت سطر الإجمالي الكبير.
4. **مودال سداد الفاتورة الآجلة (POS)** — نفس المنطق عند اختيار `مختلط` في الدفع الجزئي.

---

## 2. الملفات المتأثرة (نظرة عامة)

| الملف | التغيير |
|-------|---------|
| `database/db.js` | Migration + تعديل `createOrder` + `payDeferredOrder` + `recordInvoicePayment` + `getOrderById` |
| `server/invokeHandlers.js` | تمرير `paidCash`/`paidCard` في الحالات الثلاث |
| `screens/pos/pos.html` | حقلان بجانب `paymentSelect` + سطران في `invoiceModal` + حقلان في `payDeferredModal` |
| `screens/pos/pos.js` | منطق الحساب التلقائي + إرسال الحقول + عرضها في المودال |
| `screens/pos/pos.css` | تنسيق حقلي المختلط في كلا الموضعين |
| `screens/invoice-a4/invoice-a4.html` | سطران بعد `a4Total` |
| `screens/invoice-a4/invoice-a4.js` | `fillInvoice()` تملأ الحقلين الجديدين |
| `screens/invoices/invoices.js` | `openInvoice()` + `fillA4InvoiceModal()` تمرر `paidCash`/`paidCard` |
| `screens/invoices/invoices.html` | سطران في `invoiceModal` + سطران في `a4Modal` |
| `screens/payment/payment.js` | حقلان عند اختيار `مختلط` + إرسالهما في `recordInvoicePayment` |
| `screens/payment/payment.html` | حقلان في نموذج الدفعة |
| `ai_context/BUSINESS_RULES.md` | تحديث §7 و §8 بقواعد الدفع المختلط |
| `ai_context/specs/feature-08-pos.md` | تحديث Inputs و Rules |
| `ai_context/specs/feature-10-deferred-partial-payments.md` | تحديث Inputs و Rules |

---

## 3. قاعدة البيانات — `database/db.js`

### 3.1 Migration: إضافة أعمدة `paid_cash` و `paid_card` إلى `orders`

في دالة `initialize()` (داخل كتلة migrations)، أضف دالة migration جديدة:

```js
async function migrateMixedPaymentColumns() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'`
    );
    const colSet = new Set(cols.map(c => c.COLUMN_NAME));

    if (!colSet.has('paid_cash')) {
      await pool.query(
        `ALTER TABLE orders ADD COLUMN paid_cash DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER remaining_amount`
      );
    }
    if (!colSet.has('paid_card')) {
      await pool.query(
        `ALTER TABLE orders ADD COLUMN paid_card DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER paid_cash`
      );
    }
  } catch (e) {
    console.error('migrateMixedPaymentColumns:', e);
  }
}
```

استدعِها في `initialize()` بعد `migratePartialInvoicePayments()`.

### 3.2 Migration: إضافة `cash_amount` و `card_amount` إلى `invoice_payments`

```js
async function migrateMixedPaymentInvoiceColumns() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'invoice_payments'`
    );
    const colSet = new Set(cols.map(c => c.COLUMN_NAME));

    if (!colSet.has('cash_amount')) {
      await pool.query(
        `ALTER TABLE invoice_payments ADD COLUMN cash_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER payment_method`
      );
    }
    if (!colSet.has('card_amount')) {
      await pool.query(
        `ALTER TABLE invoice_payments ADD COLUMN card_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER cash_amount`
      );
    }
  } catch (e) {
    console.error('migrateMixedPaymentInvoiceColumns:', e);
  }
}
```

### 3.3 تعديل `createOrder`

**الباراميتر**: أضف `paidCash = 0` و `paidCard = 0` إلى signature الدالة.

**قواعد الحساب:**
```js
// احسب paid_cash / paid_card فقط عند مختلط
let dbPaidCash = 0;
let dbPaidCard = 0;
if (pm === 'mixed') {
  dbPaidCash = Math.max(0, Math.min(Number(paidCash || 0), Number(totalAmount)));
  dbPaidCard = Math.max(0, Number(totalAmount) - dbPaidCash);
  // تقريب لتفادي الفاصلة العشرية الزائدة
  dbPaidCash = Math.round(dbPaidCash * 100) / 100;
  dbPaidCard = Math.round(dbPaidCard * 100) / 100;
}
```

**عدّل استعلام INSERT:**
```sql
INSERT INTO orders
  (order_number, invoice_seq, customer_id, subtotal, discount_amount, vat_rate, vat_amount,
   total_amount, paid_amount, remaining_amount, paid_cash, paid_card,
   payment_method, payment_status, paid_at, notes, created_by, price_display_mode)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```
مع تمرير `dbPaidCash, dbPaidCard` في القيم.

### 3.4 تعديل `payDeferredOrder`

أضف `paidCash = 0` و `paidCard = 0` إلى signature:

```js
async function payDeferredOrder({ orderId, paymentMethod, paidCash = 0, paidCard = 0 }) {
  const pm = String(paymentMethod || 'cash');
  let dbPaidCash = 0, dbPaidCard = 0;
  // جلب total_amount من orders لحساب paid_card
  if (pm === 'mixed') {
    const [[ord]] = await pool.query('SELECT total_amount FROM orders WHERE id = ?', [id]);
    const total = Number((ord && ord.total_amount) || 0);
    dbPaidCash = Math.max(0, Math.min(Number(paidCash || 0), total));
    dbPaidCard = Math.round((total - dbPaidCash) * 100) / 100;
    dbPaidCash = Math.round(dbPaidCash * 100) / 100;
  }
  await pool.query(`
    UPDATE orders
    SET payment_status = 'paid',
        paid_at = NOW(),
        paid_amount = total_amount,
        remaining_amount = 0,
        payment_method = ?,
        paid_cash = ?,
        paid_card = ?
    WHERE id = ? AND payment_status = 'pending'
  `, [pm, dbPaidCash, dbPaidCard, id]);
  // ... باقي الكود
}
```

### 3.5 تعديل `recordInvoicePayment`

أضف `cashAmount = 0` و `cardAmount = 0` إلى signature:

```js
async function recordInvoicePayment({ orderId, paymentAmount, paymentMethod,
                                      cashAmount = 0, cardAmount = 0,
                                      createdBy, notes }) {
```

**حساب cash/card:**
```js
let dbCash = 0, dbCard = 0;
if (paymentMethod === 'mixed') {
  dbCash = Math.max(0, Math.min(Number(cashAmount || 0), validatedAmount));
  dbCard = Math.round((validatedAmount - dbCash) * 100) / 100;
  dbCash = Math.round(dbCash * 100) / 100;
}
```

**عدّل INSERT في `invoice_payments`:**
```sql
INSERT INTO invoice_payments (order_id, payment_amount, payment_method, cash_amount, card_amount, created_by, notes)
VALUES (?, ?, ?, ?, ?, ?, ?)
```

### 3.6 تعديل `getOrderById`

في استعلام SELECT لجدول `orders` أضف الحقلين:
```sql
SELECT o.id, ..., o.paid_cash, o.paid_card, ...
FROM orders o ...
```

### 3.7 تعديل `getInvoiceWithPayments`

في استعلام SELECT لجدول `orders` أضف الحقلين:
```sql
o.paid_cash, o.paid_card
```

وفي استعلام `invoice_payments` أضف:
```sql
cash_amount, card_amount
```

---

## 4. Backend — `server/invokeHandlers.js`

### 4.1 حالة `createOrder`

```js
case 'createOrder': {
  try {
    const orderNumber = await db.generateOrderNumber();
    const result = await db.createOrder({
      ...payload,
      orderNumber,
      paidCash: payload.paidCash || 0,      // ← جديد
      paidCard: payload.paidCard || 0,      // ← جديد
      createdBy: _user && _user.username ? _user.username : null
    });
    return { success: true, ...result };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
```

### 4.2 حالة `payDeferredOrder`

```js
case 'payDeferredOrder': {
  try {
    await db.payDeferredOrder({
      orderId: payload && payload.orderId,
      paymentMethod: (payload && payload.paymentMethod) || 'cash',
      paidCash: (payload && payload.paidCash) || 0,      // ← جديد
      paidCard: (payload && payload.paidCard) || 0,      // ← جديد
    });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
```

### 4.3 حالة `recordInvoicePayment`

```js
case 'recordInvoicePayment': {
  try {
    const createdBy = (_user && (_user.username || _user.name)) || 'system';
    const result = await db.recordInvoicePayment({
      orderId:       payload && payload.orderId,
      paymentAmount: payload && payload.paymentAmount,
      paymentMethod: (payload && payload.paymentMethod) || 'cash',
      cashAmount:    (payload && payload.cashAmount) || 0,     // ← جديد
      cardAmount:    (payload && payload.cardAmount) || 0,     // ← جديد
      notes:         (payload && payload.notes) || null,
      createdBy,
    });
    return result;
  } catch (err) {
    return { success: false, message: err.message, code: err.appCode };
  }
}
```

---

## 5. شاشة نقطة البيع — `screens/pos/`

### 5.1 `pos.html` — حقلا الدفع المختلط في منطقة POS

**الموقع:** بعد `<div class="payment-section">` (السطر الذي يحتوي `paymentSelect`)، أضف مباشرة:

```html
<!-- Mixed Payment Fields -->
<div class="mixed-pay-section" id="mixedPaySection" style="display:none">
  <div class="mixed-pay-row">
    <div class="mixed-pay-group">
      <label class="mixed-pay-label" for="mixedCashInput">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <span>نقداً</span>
      </label>
      <div class="mixed-pay-input-wrap">
        <span class="sar mixed-pay-sar">&#xE900;</span>
        <input id="mixedCashInput" type="text" inputmode="decimal"
               class="mixed-pay-input" placeholder="0.00" dir="ltr" autocomplete="off" />
      </div>
    </div>
    <div class="mixed-pay-divider">+</div>
    <div class="mixed-pay-group">
      <label class="mixed-pay-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        <span>شبكة (تلقائي)</span>
      </label>
      <div class="mixed-pay-input-wrap mixed-pay-card-wrap">
        <span class="sar mixed-pay-sar">&#xE900;</span>
        <input id="mixedCardInput" type="text"
               class="mixed-pay-input mixed-pay-input-auto" readonly
               placeholder="0.00" dir="ltr" />
      </div>
    </div>
  </div>
  <div id="mixedPayError" class="mixed-pay-error" style="display:none"></div>
</div>
```

### 5.2 `pos.html` — سطرا نقداً/شبكة في `#invoiceModal` (الإيصال الحراري)

**الموقع:** بعد العنصر `<div ... id="invTotal">` مباشرة، أضف:

```html
<!-- Mixed payment breakdown (thermal) -->
<div class="inv-total-row inv-mixed-cash-row" id="invMixedCashRow" style="display:none">
  <span class="inv-total-label inv-mixed-label">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11" style="vertical-align:middle;margin-left:3px">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
    منها نقداً
  </span>
  <span class="inv-total-val inv-mixed-val" id="invMixedCash" dir="ltr"></span>
</div>
<div class="inv-total-row inv-mixed-card-row" id="invMixedCardRow" style="display:none">
  <span class="inv-total-label inv-mixed-label">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11" style="vertical-align:middle;margin-left:3px">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
    منها شبكة
  </span>
  <span class="inv-total-val inv-mixed-val" id="invMixedCard" dir="ltr"></span>
</div>
```

### 5.3 `pos.html` — حقلا المختلط في `#payDeferredModal`

**الموقع:** بعد `<div class="pay-form-row pay-form-row-split">` (الذي يحتوي `payMethodSelect`)، أضف:

```html
<!-- Mixed payment fields in deferred modal -->
<div class="pay-mixed-section" id="payMixedSection" style="display:none">
  <div class="pay-mixed-row">
    <div class="pay-mixed-group">
      <label class="pay-mixed-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        نقداً
      </label>
      <div class="pay-mixed-input-wrap">
        <span class="sar pay-mixed-sar">&#xE900;</span>
        <input id="payMixedCashInput" type="text" inputmode="decimal"
               class="form-input pay-mixed-input" placeholder="0.00" dir="ltr" autocomplete="off" />
      </div>
    </div>
    <span class="pay-mixed-plus">+</span>
    <div class="pay-mixed-group">
      <label class="pay-mixed-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        شبكة (تلقائي)
      </label>
      <div class="pay-mixed-input-wrap pay-mixed-card-wrap">
        <span class="sar pay-mixed-sar">&#xE900;</span>
        <input id="payMixedCardInput" type="text"
               class="form-input pay-mixed-input pay-mixed-input-auto" readonly
               placeholder="0.00" dir="ltr" />
      </div>
    </div>
  </div>
</div>
```

### 5.4 `pos.css` — تنسيقات الدفع المختلط

```css
/* ── Mixed Payment Section (POS checkout) ── */
.mixed-pay-section {
  padding: 10px 0 4px;
  border-top: 1px dashed var(--border-color, #e2e8f0);
  margin-top: 8px;
  animation: fadeIn 0.18s ease;
}

.mixed-pay-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.mixed-pay-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mixed-pay-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}

.mixed-pay-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.mixed-pay-sar {
  position: absolute;
  right: 8px;
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
  pointer-events: none;
}

.mixed-pay-input {
  width: 100%;
  padding: 6px 28px 6px 8px;
  border: 1.5px solid var(--border-color, #cbd5e1);
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  direction: ltr;
  text-align: left;
  transition: border-color 0.15s;
  background: #fff;
}

.mixed-pay-input:focus {
  outline: none;
  border-color: var(--primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.mixed-pay-input-auto {
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-secondary, #64748b);
  border-color: var(--border-color, #e2e8f0);
  cursor: default;
}

.mixed-pay-card-wrap .mixed-pay-sar { color: #0ea5e9; }
.mixed-pay-input-auto { border-left: 3px solid #0ea5e9; }

.mixed-pay-divider {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-secondary, #94a3b8);
  padding-bottom: 6px;
  flex-shrink: 0;
}

.mixed-pay-error {
  font-size: 11px;
  color: #ef4444;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.06);
  border-radius: 6px;
  border-right: 3px solid #ef4444;
}

/* ── Mixed rows in thermal invoice ── */
.inv-mixed-label {
  color: var(--text-secondary, #64748b);
  font-size: 11px;
}

.inv-mixed-val {
  font-size: 11.5px;
  color: #475569;
}

.inv-mixed-cash-row { border-top: 1px dashed #e2e8f0; margin-top: 2px; padding-top: 3px; }

/* ── Mixed payment section in deferred modal ── */
.pay-mixed-section {
  margin-top: 10px;
  padding: 12px;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 10px;
  border: 1px dashed var(--border-color, #cbd5e1);
  animation: fadeIn 0.18s ease;
}

.pay-mixed-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.pay-mixed-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.pay-mixed-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #475569);
}

.pay-mixed-input-wrap {
  position: relative;
}

.pay-mixed-sar {
  position: absolute;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: #94a3b8;
  pointer-events: none;
}

.pay-mixed-input {
  padding-right: 28px !important;
}

.pay-mixed-input-auto {
  background: #f1f5f9 !important;
  color: #64748b !important;
  cursor: default !important;
  border-left: 3px solid #0ea5e9 !important;
}

.pay-mixed-card-wrap .pay-mixed-sar { color: #0ea5e9; }

.pay-mixed-plus {
  font-size: 20px;
  font-weight: 700;
  color: #94a3b8;
  padding-bottom: 8px;
  flex-shrink: 0;
}
```

### 5.5 `pos.js` — الدعم الكامل للمختلط

#### أ. State

```js
const state = {
  // ... الحقول الموجودة ...
  mixedCash: 0,   // ← جديد
  mixedCard: 0,   // ← جديد
};
```

#### ب. DOM Refs

```js
const els = {
  // ... الحقول الموجودة ...
  mixedPaySection:  document.getElementById('mixedPaySection'),   // ← جديد
  mixedCashInput:   document.getElementById('mixedCashInput'),     // ← جديد
  mixedCardInput:   document.getElementById('mixedCardInput'),     // ← جديد
  mixedPayError:    document.getElementById('mixedPayError'),       // ← جديد
  invMixedCashRow:  document.getElementById('invMixedCashRow'),    // ← جديد
  invMixedCardRow:  document.getElementById('invMixedCardRow'),    // ← جديد
  invMixedCash:     document.getElementById('invMixedCash'),       // ← جديد
  invMixedCard:     document.getElementById('invMixedCard'),       // ← جديد
  // Modal deferred mixed:
  payMixedSection:    document.getElementById('payMixedSection'),   // ← جديد
  payMixedCashInput:  document.getElementById('payMixedCashInput'), // ← جديد
  payMixedCardInput:  document.getElementById('payMixedCardInput'), // ← جديد
};
```

#### ج. دالة `updateMixedPayFields()`

```js
function updateMixedPayFields() {
  const { total } = getOrderTotals();
  const rawCash = parseFloat(els.mixedCashInput.value) || 0;
  const cashClamped = Math.max(0, Math.min(rawCash, total));

  // إذا كتب المستخدم قيمة أكبر من الإجمالي، صحّح تلقائياً
  if (rawCash > total && total > 0) {
    els.mixedCashInput.value = total.toFixed(2);
    state.mixedCash = total;
  } else {
    state.mixedCash = cashClamped;
  }

  state.mixedCard = Math.max(0, Math.round((total - state.mixedCash) * 100) / 100);
  els.mixedCardInput.value = state.mixedCard.toFixed(2);

  // إخفاء الخطأ دائماً (التحقق يتم في handlePay)
  els.mixedPayError.style.display = 'none';
}
```

#### د. تعديل `bindEvents()` — إضافة أحداث الدفع المختلط

```js
// عند تغيير طريقة الدفع
els.paymentSelect.addEventListener('change', () => {
  state.paymentMethod = els.paymentSelect.value;
  const isMixed = state.paymentMethod === 'mixed';
  els.mixedPaySection.style.display = isMixed ? '' : 'none';
  if (isMixed) {
    updateMixedPayFields();
    setTimeout(() => els.mixedCashInput.focus(), 50);
  }
});

// عند إدخال مبلغ Cash
els.mixedCashInput.addEventListener('input', (e) => {
  // تصفية: أرقام وفاصلة عشرية فقط
  const v = e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*/, '$1');
  if (v !== e.target.value) e.target.value = v;
  updateMixedPayFields();
});

// تحديث حقول المختلط عند تغيير الإجمالي
// (اضبط داخل updateSummary() أيضاً)
```

#### هـ. تعديل `updateSummary()`

في نهاية `updateSummary()`:
```js
// تحديث الكارد تلقائياً عند تغيير الإجمالي
if (state.paymentMethod === 'mixed') {
  updateMixedPayFields();
}
```

#### و. تعديل `handlePay()`

```js
async function handlePay() {
  if (state.cart.length === 0) { ... }

  // ── تحقق من الدفع المختلط ──
  if (state.paymentMethod === 'mixed') {
    const { total } = getOrderTotals();
    if (total > 0 && state.mixedCash <= 0 && state.mixedCard <= 0) {
      els.mixedPayError.textContent = 'أدخل المبلغ النقدي للدفع المختلط';
      els.mixedPayError.style.display = '';
      return;
    }
    // التحقق من أن cash + card == total تقريباً
    const sum = Math.round((state.mixedCash + state.mixedCard) * 100) / 100;
    const roundedTotal = Math.round(total * 100) / 100;
    if (Math.abs(sum - roundedTotal) > 0.01) {
      els.mixedPayError.textContent = 'مجموع نقداً + شبكة لا يساوي الإجمالي';
      els.mixedPayError.style.display = '';
      return;
    }
    els.mixedPayError.style.display = 'none';
  }

  const { subtotal, discount, vatAmount, total } = getOrderTotals();
  els.btnPay.disabled = true;
  els.btnPay.classList.add('loading');

  try {
    const res = await window.api.createOrder({
      customerId: state.selectedCustomer ? state.selectedCustomer.id : null,
      items: state.cart.map(item => ({ ... })),
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountAmount: parseFloat(discount.toFixed(2)),
      vatRate: state.vatRate,
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      totalAmount: parseFloat(total.toFixed(2)),
      paymentMethod: state.paymentMethod,
      paidCash: state.paymentMethod === 'mixed' ? state.mixedCash : 0,   // ← جديد
      paidCard: state.paymentMethod === 'mixed' ? state.mixedCard : 0,   // ← جديد
      priceDisplayMode: state.priceDisplayMode,
    });
    // ... باقي الكود
  }
}
```

#### ز. تعديل `showInvoiceModal()` — عرض نقداً/شبكة في الإيصال

في دالة `showInvoiceModal` بعد `els.invTotal.innerHTML = sarFmt(totals.total);`:

```js
/* ── Mixed payment breakdown ── */
const isMixed = (currentPm === 'mixed' || (state.viewingDeferredInvoice &&
  (order && order.payment_method === 'mixed')));

if (isMixed && (totals.paidCash > 0 || totals.paidCard > 0)) {
  if (els.invMixedCash)  els.invMixedCash.innerHTML  = sarFmt(totals.paidCash);
  if (els.invMixedCard)  els.invMixedCard.innerHTML  = sarFmt(totals.paidCard);
  if (els.invMixedCashRow) els.invMixedCashRow.style.display = '';
  if (els.invMixedCardRow) els.invMixedCardRow.style.display = '';
} else {
  if (els.invMixedCashRow) els.invMixedCashRow.style.display = 'none';
  if (els.invMixedCardRow) els.invMixedCardRow.style.display = 'none';
}
```

**تمرير البيانات:** قبل استدعاء `showInvoiceModal` من `handlePay`:
```js
showInvoiceModal(res.orderNumber, res.createdAt || null,
  {
    subtotal, discount, vatAmount, total,
    paidCash: state.paymentMethod === 'mixed' ? state.mixedCash : 0,  // ← جديد
    paidCard: state.paymentMethod === 'mixed' ? state.mixedCard : 0,  // ← جديد
  },
  subscription, res.invoiceSeq);
```

#### ح. تعديل `state.lastA4Data` في `showInvoiceModal`

```js
state.lastA4Data = {
  // ... الحقول الموجودة ...
  paidCash: totals.paidCash || 0,   // ← جديد
  paidCard: totals.paidCard || 0,   // ← جديد
};
```

#### ط. تعديل `resetForNewSale()`

```js
function resetForNewSale() {
  // ... الكود الموجود ...
  state.mixedCash = 0;              // ← جديد
  state.mixedCard = 0;              // ← جديد
  if (els.mixedCashInput) els.mixedCashInput.value = '';   // ← جديد
  if (els.mixedCardInput) els.mixedCardInput.value = '';   // ← جديد
  if (els.mixedPaySection) els.mixedPaySection.style.display = 'none';  // ← جديد
}
```

#### ي. منطق مودال الدفع الآجل — `payMixedSection`

في `bindEvents()` أضف:

```js
// عند تغيير طريقة السداد في مودال الآجل
els.payMethodSelect.addEventListener('change', () => {
  payModalState.selectedMethod = els.payMethodSelect.value || 'cash';
  const isMixed = payModalState.selectedMethod === 'mixed';
  els.payMixedSection.style.display = isMixed ? '' : 'none';
  if (isMixed) {
    updatePayMixedFields();
    setTimeout(() => els.payMixedCashInput.focus(), 50);
  }
});

// عند إدخال Cash في مودال الآجل
els.payMixedCashInput.addEventListener('input', (e) => {
  const v = e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*/, '$1');
  if (v !== e.target.value) e.target.value = v;
  updatePayMixedFields();
});
```

**دالة `updatePayMixedFields()`:**

```js
function updatePayMixedFields() {
  const inv = payModalState.invoice;
  if (!inv) return;
  const payAmt = parseFloat(els.payAmountInput.value) || 0;
  const rawCash = parseFloat(els.payMixedCashInput.value) || 0;
  const cashClamped = Math.max(0, Math.min(rawCash, payAmt));
  const card = Math.max(0, Math.round((payAmt - cashClamped) * 100) / 100);
  els.payMixedCardInput.value = card.toFixed(2);
}
```

**تحديث `payAmountInput.input`** — بعد `updateAfterInfo()` أضف:
```js
if (payModalState.selectedMethod === 'mixed') updatePayMixedFields();
```

**تعديل `confirmPayDeferred()`:**

```js
async function confirmPayDeferred() {
  // ... التحقق الموجود ...

  const isMixed = payModalState.selectedMethod === 'mixed';
  let cashAmt = 0, cardAmt = 0;

  if (isMixed) {
    const payAmt = parseFloat(els.payAmountInput.value) || 0;
    cashAmt = Math.max(0, Math.min(parseFloat(els.payMixedCashInput.value) || 0, payAmt));
    cardAmt = Math.round((payAmt - cashAmt) * 100) / 100;
  }

  const res = await window.api.recordInvoicePayment({
    orderId: Number(els.payDeferredOrderId.value),
    paymentAmount: amount,
    paymentMethod: payModalState.selectedMethod,
    cashAmount: cashAmt,    // ← جديد
    cardAmount: cardAmt,    // ← جديد
    notes: els.payNotesInput ? els.payNotesInput.value.trim() : undefined,
  });

  // ... باقي منطق النجاح/الفشل ...
}
```

**تعديل `closePayDeferredModal()`** — إعادة تعيين حقلي المختلط:

```js
function closePayDeferredModal() {
  // ... الكود الموجود ...
  if (els.payMixedSection) els.payMixedSection.style.display = 'none';
  if (els.payMixedCashInput) els.payMixedCashInput.value = '';
  if (els.payMixedCardInput) els.payMixedCardInput.value = '';
}
```

---

## 6. فاتورة A4 المستقلة — `screens/invoice-a4/`

### 6.1 `invoice-a4.html`

في `<div class="a4-totals">` بعد سطر `a4Total`:

```html
<div class="a4-trow a4-mixed-row" id="a4MixedCashRow" style="display:none">
  <span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:middle;margin-left:4px">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
    منها نقداً / Paid Cash
  </span>
  <b id="a4MixedCash" dir="ltr"></b>
</div>
<div class="a4-trow a4-mixed-row" id="a4MixedCardRow" style="display:none">
  <span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:middle;margin-left:4px">
      <rect x="1" y="4" width="22" height="16" rx="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
    منها شبكة / Paid Card
  </span>
  <b id="a4MixedCard" dir="ltr"></b>
</div>
```

**تنسيق إضافي في CSS الفاتورة:**
```css
.a4-mixed-row { border-top: 1px dashed #e2e8f0; }
.a4-mixed-row span { color: #64748b; font-size: 0.88em; }
.a4-mixed-row b { color: #475569; font-size: 0.9em; }
```

### 6.2 `invoice-a4.js`

في دالة `fillInvoice(data)` بعد `setHtml('a4Total', ...)`:

```js
/* ── Mixed payment breakdown ── */
if (data.paidCash > 0 || data.paidCard > 0) {
  setHtml('a4MixedCash', sarSpan + Number(data.paidCash || 0).toFixed(2));
  showRow('a4MixedCashRow', true);
  setHtml('a4MixedCard', sarSpan + Number(data.paidCard || 0).toFixed(2));
  showRow('a4MixedCardRow', true);
} else {
  showRow('a4MixedCashRow', false);
  showRow('a4MixedCardRow', false);
}
```

---

## 7. شاشة الفواتير — `screens/invoices/`

### 7.1 `invoices.html` — سطرا المختلط في `#invoiceViewModal`

في القسم الذي يحتوي `invTotal`، بعده مباشرة:

```html
<div class="inv-total-row inv-mixed-cash-row" id="invMixedCashRow" style="display:none">
  <span class="inv-total-label" style="color:#64748b;font-size:0.85em">
    منها نقداً
  </span>
  <span class="inv-total-val" id="invMixedCash" dir="ltr" style="color:#475569"></span>
</div>
<div class="inv-total-row inv-mixed-card-row" id="invMixedCardRow" style="display:none">
  <span class="inv-total-label" style="color:#64748b;font-size:0.85em">
    منها شبكة
  </span>
  <span class="inv-total-val" id="invMixedCard" dir="ltr" style="color:#475569"></span>
</div>
```

في `#a4ModalContainer` (مودال A4 داخل invoices)، نفس السطرين بأمعرّف مختلف:
```html
id="a4mMixedCashRow" / id="a4mMixedCash"
id="a4mMixedCardRow" / id="a4mMixedCard"
```

### 7.2 `invoices.js` — `openInvoice(id, seqNum)`

عند جلب بيانات الفاتورة (`getOrderById`) أضف:

```js
const paidCash = parseFloat(data.order.paid_cash || 0);
const paidCard = parseFloat(data.order.paid_card || 0);
const isMixed  = data.order.payment_method === 'mixed';

// في قسم الإيصال الحراري:
const invMixedCashRow = document.getElementById('invMixedCashRow');
const invMixedCardRow = document.getElementById('invMixedCardRow');
if (isMixed && (paidCash > 0 || paidCard > 0)) {
  const invMixedCash = document.getElementById('invMixedCash');
  const invMixedCard = document.getElementById('invMixedCard');
  if (invMixedCash) invMixedCash.innerHTML = sarFmt(paidCash);
  if (invMixedCard) invMixedCard.innerHTML = sarFmt(paidCard);
  if (invMixedCashRow) invMixedCashRow.style.display = '';
  if (invMixedCardRow) invMixedCardRow.style.display = '';
} else {
  if (invMixedCashRow) invMixedCashRow.style.display = 'none';
  if (invMixedCardRow) invMixedCardRow.style.display = 'none';
}
```

في `fillA4InvoiceModal(data)` أضف بعد `a4mHtml('a4mTotal', ...)`:

```js
/* Mixed payment */
const a4mMixedCash = document.getElementById('a4mMixedCash');
const a4mMixedCard = document.getElementById('a4mMixedCard');
if (data.paidCash > 0 || data.paidCard > 0) {
  if (a4mMixedCash) { a4mMixedCash.innerHTML = sarFmt(data.paidCash); a4mShow('a4mMixedCashRow', true); }
  if (a4mMixedCard) { a4mMixedCard.innerHTML = sarFmt(data.paidCard); a4mShow('a4mMixedCardRow', true); }
} else {
  a4mShow('a4mMixedCashRow', false);
  a4mShow('a4mMixedCardRow', false);
}
```

وفي تجميع `data` الذي يُمرَّر لـ `openA4Invoice`:
```js
paidCash: paidCash,
paidCard: paidCard,
```

---

## 8. شاشة السداد الجزئي المستقلة — `screens/payment/`

### 8.1 `payment.html`

في قسم `#paymentInputCard`، بعد `.payment-method-row`، أضف:

```html
<!-- Mixed payment section (deferred screen) -->
<div id="mixedPaymentSection" style="display:none" class="mixed-payment-section">
  <div class="mixed-fields-row">
    <div class="mixed-field-group">
      <label class="mixed-field-label">نقداً</label>
      <div class="mixed-field-input-wrap">
        <span class="sar" style="position:absolute;right:10px;top:50%;transform:translateY(-50%)">&#xE900;</span>
        <input type="text" inputmode="decimal" id="mixedCashAmount"
               class="form-input" placeholder="0.00" dir="ltr"
               style="padding-right:28px" autocomplete="off" />
      </div>
    </div>
    <span class="mixed-field-plus">+</span>
    <div class="mixed-field-group">
      <label class="mixed-field-label">شبكة (تلقائي)</label>
      <div class="mixed-field-input-wrap">
        <span class="sar" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#0ea5e9">&#xE900;</span>
        <input type="text" id="mixedCardAmount" readonly
               class="form-input" placeholder="0.00" dir="ltr"
               style="padding-right:28px;background:#f1f5f9;border-left:3px solid #0ea5e9" />
      </div>
    </div>
  </div>
</div>
```

### 8.2 `payment.js`

```js
// في setupEventListeners():
const methodButtons = document.querySelectorAll('.payment-method-btn');
methodButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    selectPaymentMethod(btn.dataset.method);
    const isMixed = btn.dataset.method === 'mixed';
    const section = document.getElementById('mixedPaymentSection');
    if (section) section.style.display = isMixed ? '' : 'none';
    if (isMixed) updateMixedFields();
  });
});

document.getElementById('paymentAmount').addEventListener('input', () => {
  validateAmount();
  updateRemainingAfterPayment();
  if (state.selectedMethod === 'mixed') updateMixedFields();
});

document.getElementById('mixedCashAmount').addEventListener('input', (e) => {
  const v = e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*/, '$1');
  if (v !== e.target.value) e.target.value = v;
  updateMixedFields();
});

function updateMixedFields() {
  const payAmt = parseFloat(document.getElementById('paymentAmount').value) || 0;
  const cashEl = document.getElementById('mixedCashAmount');
  const cardEl = document.getElementById('mixedCardAmount');
  const rawCash = parseFloat(cashEl.value) || 0;
  const cash = Math.max(0, Math.min(rawCash, payAmt));
  const card = Math.max(0, Math.round((payAmt - cash) * 100) / 100);
  cardEl.value = card.toFixed(2);
}

// في confirmPayment():
async function confirmPayment() {
  if (!validateForm()) return;

  const isMixed = state.selectedMethod === 'mixed';
  const cashAmt = isMixed
    ? (parseFloat(document.getElementById('mixedCashAmount').value) || 0)
    : 0;
  const cardAmt = isMixed
    ? (parseFloat(document.getElementById('mixedCardAmount').value) || 0)
    : 0;

  const response = await window.api.recordInvoicePayment({
    orderId:       Number(state.orderId),
    paymentAmount: parseFloat(elements.paymentAmount.value),
    paymentMethod: state.selectedMethod,
    cashAmount:    cashAmt,   // ← جديد
    cardAmount:    cardAmt,   // ← جديد
    notes:         null,
  });
  // ... باقي الكود
}

// في selectPaymentMethod() — إعادة إخفاء المختلط عند اختيار طريقة أخرى:
function selectPaymentMethod(method) {
  state.selectedMethod = method;
  // ... الكود الموجود ...
  const section = document.getElementById('mixedPaymentSection');
  if (section) section.style.display = method === 'mixed' ? '' : 'none';
  if (method === 'mixed') updateMixedFields();
}
```

---

## 9. تحديث ملفات AI Context

بعد اكتمال التنفيذ، حدّث الملفات الآتية:

### `ai_context/BUSINESS_RULES.md` — أضف إلى §7 (Orders):

```
- **payment_method = 'mixed'**:
  - `paid_cash`: المبلغ النقدي (يُدخله الكاشير).
  - `paid_card`: المبلغ عبر الشبكة = total − paid_cash (يُحسب تلقائياً في الواجهة والسيرفر).
  - القيد: `paid_cash + paid_card == total_amount` (فارق < 0.01 مقبول للتقريب).
  - كلا العمودين `DECIMAL(10,2) DEFAULT 0` في `orders`.
  - في حالة `recordInvoicePayment` مع mixed: `invoice_payments.cash_amount` و `card_amount`.
```

### `ai_context/specs/feature-08-pos.md` — تحديث Inputs:

أضف إلى `createOrder` payload:
```json
"paidCash": number,   // 0 إذا لم يكن mixed
"paidCard": number    // 0 إذا لم يكن mixed
```

### `ai_context/specs/feature-10-deferred-partial-payments.md` — تحديث Inputs:

أضف إلى `recordInvoicePayment`:
```json
"cashAmount": number,  // 0 إذا لم يكن mixed
"cardAmount": number   // 0 إذا لم يكن mixed
```

---

## 10. قواعد التحقق (Validation Rules)

| القاعدة | الموضع |
|--------|--------|
| `mixedCash >= 0` | الواجهة: تصفية الحقل + `handlePay` |
| `mixedCash <= totalAmount` | الواجهة: `updateMixedPayFields()` يقيّد التلقائياً |
| `mixedCash + mixedCard ≈ totalAmount` | الواجهة: `handlePay()` → فارق > 0.01 يُظهر خطأ |
| قاعدة السيرفر: `dbPaidCash = min(paidCash, total)` | `db.js: createOrder` |
| قاعدة السيرفر: `dbPaidCard = total − dbPaidCash` | `db.js: createOrder` |
| في `recordInvoicePayment`: `cash ≤ paymentAmount` | `db.js` |

---

## 11. ترتيب التنفيذ الموصى به

```
1. database/db.js
   ├─ migrateMixedPaymentColumns()
   ├─ migrateMixedPaymentInvoiceColumns()
   ├─ تعديل createOrder
   ├─ تعديل payDeferredOrder
   ├─ تعديل recordInvoicePayment
   └─ تعديل getOrderById + getInvoiceWithPayments

2. server/invokeHandlers.js
   ├─ تمرير paidCash/paidCard في createOrder
   ├─ تمرير paidCash/paidCard في payDeferredOrder
   └─ تمرير cashAmount/cardAmount في recordInvoicePayment

3. screens/pos/pos.html
   ├─ حقلا المختلط (بجانب paymentSelect)
   ├─ سطرا invMixedCash/Card في invoiceModal
   └─ حقلا المختلط في payDeferredModal

4. screens/pos/pos.css
   └─ جميع أنماط .mixed-pay-* و .pay-mixed-*

5. screens/pos/pos.js
   ├─ State + DOM Refs
   ├─ updateMixedPayFields()
   ├─ updatePayMixedFields()
   ├─ تعديل bindEvents()
   ├─ تعديل updateSummary()
   ├─ تعديل handlePay()
   ├─ تعديل showInvoiceModal()
   ├─ تعديل state.lastA4Data
   ├─ تعديل resetForNewSale()
   └─ تعديل confirmPayDeferred()

6. screens/invoice-a4/invoice-a4.html + invoice-a4.js

7. screens/invoices/invoices.html + invoices.js

8. screens/payment/payment.html + payment.js

9. تحديث ai_context/
```

---

## 12. التحقق من الصحة (Verification Checklist)

```
POS - دفع فوري:
[ ] اختيار مختلط → تظهر الحقلان بأنيماشن ناعم
[ ] إدخال Cash = 30 من إجمالي 100 → Card يُحسب تلقائياً = 70
[ ] إدخال Cash > الإجمالي → يُقيَّد تلقائياً
[ ] Cash = 0 → رسالة خطأ واضحة عند الضغط على "إتمام البيع"
[ ] حفظ الفاتورة → paid_cash=30, paid_card=70 في قاعدة البيانات
[ ] الإيصال الحراري يعرض: "منها نقداً ﷼ 30.00" و "منها شبكة ﷼ 70.00"
[ ] فاتورة A4 تعرض نفس السطرين
[ ] تغيير الطريقة لـ cash → الحقلان تختفيان وتُصفَّر القيم
[ ] بيعة جديدة → إعادة تعيين كاملة

POS - الفواتير الآجلة (مودال السداد):
[ ] اختيار مختلط → تظهر الحقلان
[ ] إدخال Cash → Card يُحسب تلقائياً
[ ] تأكيد الدفعة → cash_amount/card_amount في invoice_payments
[ ] سجل الدفعات يعرض الطريقة = "مختلط"

شاشة السداد المستقلة (payment.html):
[ ] زر "مختلط" → تظهر الحقلان
[ ] إدخال Cash → Card يُحسب تلقائياً
[ ] تأكيد → cash_amount/card_amount محفوظان

شاشة الفواتير (invoices.html):
[ ] فتح فاتورة مدفوعة بـ "مختلط" → يعرض سطري نقداً/شبكة
[ ] فواتير أخرى → السطران مختفيان

DB:
SELECT id, payment_method, paid_cash, paid_card FROM orders WHERE payment_method='mixed';
SELECT cash_amount, card_amount FROM invoice_payments WHERE payment_method='mixed';
```

---

## 13. نقاط خارج النطاق (Out of Scope)

- لا تغيير في طريقة حساب ZATCA QR (يبقى يستخدم `totalAmount` و `vatAmount` فقط).
- لا تغيير في تقارير الـ Excel/PDF للمصاريف أو العملاء.
- لا إضافة عمود "مختلط" في تقرير الفواتير المُصدَّر.
- لا تغيير في منطق خصم رصيد الاشتراك (يعتمد على `totalAmount` وليس طريقة الدفع).
