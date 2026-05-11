# Barcode Feature for Invoices — Implementation Plan

## Overview
Add barcode (with invoice number) to thermal invoices, barcode scanning payment on the deferred invoices screen, and a settings toggle to control auto pay+clean+deliver on scan.

---

## Phase 1: Barcode on Thermal Invoice

### 1.1 Add JsBarcode library
- Download `JsBarcode.min.js` (CDN: https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js) and save to `assets/JsBarcode.min.js`
- Add `<script src="../../assets/JsBarcode.min.js"></script>` before `pos.js` in:
  - `screens/pos/pos.html`
  - `screens/credit-invoices/credit-invoices.html`
  - `screens/reports/period-report/period-report.html`
  - `screens/reports/daily-report/daily-report.html`
  - `screens/reports/all-invoices-report/all-invoices-report.html`

### 1.2 Add barcode SVG element in thermal invoice template
In **`screens/pos/pos.html`** — above the QR code section (line ~1084):
```html
<!-- Barcode (above QR) -->
<div class="inv-barcode-wrap">
  <svg id="invBarcode"></svg>
</div>
<!-- QR Code -->
<div class="inv-qr-wrap">
  <div id="invQR" class="inv-qr"></div>
</div>
```

In **`screens/credit-invoices/credit-invoices.html`** — same pattern above `invQR` and `cnQR`.

In **report HTML files** — same pattern above each `invQR` / `cnQR`.

### 1.3 Add barcode DOM ref in pos.js
In **`screens/pos/pos.js`** `els` object (after `invQR`):
```js
invBarcode: document.getElementById('invBarcode'),
```

### 1.4 Render barcode in `renderInvoiceModal` / `renderInvoiceQR`
In **`screens/pos/pos.js`** — after `renderInvoiceQR()` call (around line 2157), add:
```js
// Render barcode with invoice_seq
if (els.invBarcode && invoiceSeq) {
  try { JsBarcode(els.invBarcode, String(invoiceSeq), { format: 'CODE128', width: 2, height: 50, displayValue: true, fontSize: 14, margin: 4 }); }
  catch(e) { els.invBarcode.innerHTML = ''; }
}
```

Same pattern in the credit note rendering section (~line 2841).

### 1.5 Add barcode rendering in report JS files
Same `JsBarcode()` call in:
- `screens/reports/period-report/period-report.js`
- `screens/reports/daily-report/daily-report.js`
- `screens/reports/all-invoices-report/all-invoices-report.js`
- `screens/credit-invoices/credit-invoices.js`

### 1.6 CSS for barcode
In **`screens/pos/pos.css`** (and report CSS files):
```css
.inv-barcode-wrap { text-align: center; margin-bottom: 4px; }
.inv-barcode-wrap svg { max-width: 100%; height: auto; }
```

---

## Phase 2: Barcode Scanning on Deferred Invoices Screen

### 2.1 Add barcode scanner input in deferred panel
In **`screens/pos/pos.html`** — inside `deferred-toolbar` (after the search row, ~line 381):
```html
<!-- Barcode scanner row -->
<div class="deferred-barcode-row">
  <div class="deferred-barcode-inner">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
    <input id="deferredBarcodeInput" type="text" class="deferred-barcode-input"
      placeholder="امسح الباركود للدفع السريع..."
      autocomplete="off" />
  </div>
</div>
```

### 2.2 Add DOM ref in pos.js
In `els` object:
```js
deferredBarcodeInput: document.getElementById('deferredBarcodeInput'),
```

### 2.3 Implement barcode scan handler
In **`screens/pos/pos.js`** — add new function:
```js
async function handleDeferredBarcodeScan() {
  const barcodeVal = els.deferredBarcodeInput.value.trim();
  if (!barcodeVal) return;

  const invoiceSeq = Number(barcodeVal);
  if (isNaN(invoiceSeq) || invoiceSeq <= 0) {
    showTopToast('رقم باركود غير صالح', 'error');
    return;
  }

  // Look up invoice by invoice_seq
  const res = await window.api.getDeferredOrders({ search: String(invoiceSeq), statusFilter: 'unpaid' });
  if (!res || !res.success || !res.orders || res.orders.length === 0) {
    showTopToast('لم يتم العثور على فاتورة آجلة بهذا الرقم', 'error');
    els.deferredBarcodeInput.value = '';
    return;
  }

  const inv = res.orders[0];

  // Check if barcode auto-action is enabled
  const autoAction = state.appSettings && state.appSettings.barcodeAutoAction;

  if (autoAction === 'pay_clean_deliver') {
    // Pay + Clean + Deliver in sequence
    await barcodeAutoPayCleanDeliver(inv);
  } else {
    // Default: just open the pay modal
    openPayDeferredModal(inv.id);
  }

  els.deferredBarcodeInput.value = '';
}
```

### 2.4 Implement `barcodeAutoPayCleanDeliver`
```js
async function barcodeAutoPayCleanDeliver(inv) {
  const orderId = inv.id;
  const remaining = num(inv.remaining_amount);
  const total = num(inv.total_amount);

  // 1. Pay remaining amount if not fully paid
  if (inv.payment_status !== 'paid' && remaining > 0) {
    const payRes = await window.api.recordInvoicePayment({
      orderId,
      paymentAmount: remaining,
      paymentMethod: 'cash',
      cashAmount: remaining,
      cardAmount: 0,
      notes: 'دفع تلقائي بالباركود',
    });
    if (!payRes || !payRes.success) {
      showTopToast('فشل الدفع التلقائي: ' + (payRes?.message || ''), 'error');
      return;
    }
    showTopToast('تم الدفع تلقائياً', 'success');
  }

  // 2. Mark cleaned if not already
  if (!inv.cleaning_date) {
    const cleanRes = await window.api.markOrderCleaned({ orderId });
    if (!cleanRes || !cleanRes.success) {
      showTopToast('فشل تحديث حالة التنظيف', 'error');
      return;
    }
    showTopToast('تم التحديث: تنظيف', 'success');
  }

  // 3. Mark delivered if not already
  if (!inv.delivery_date) {
    const delRes = await window.api.markOrderDelivered({ orderId });
    if (!delRes || !delRes.success) {
      showTopToast('فشل تحديث حالة التسليم', 'error');
      return;
    }
    showTopToast('تم التحديث: تسليم', 'success');
  }

  // Refresh deferred list
  await searchDeferredInvoices();
  showTopToast('✅ تم الدفع والتنظيف والتسليم تلقائياً', 'success');
}
```

### 2.5 Wire up event listener
In the init section of `pos.js`:
```js
if (els.deferredBarcodeInput) {
  els.deferredBarcodeInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') handleDeferredBarcodeScan();
  });
}
```

### 2.6 CSS for barcode scanner row
```css
.deferred-barcode-row { margin-top: 8px; }
.deferred-barcode-inner { display: flex; align-items: center; gap: 8px; background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 10px; padding: 8px 12px; }
.deferred-barcode-input { flex: 1; border: none; background: transparent; font-size: 15px; outline: none; }
```

---

## Phase 3: Settings — Barcode Auto-Action Toggle

### 3.1 Database migration
In **`database/db.js`** — add migration function:
```js
async function migrateAppSettingsBarcodeAutoAction() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'app_settings' AND column_name = 'barcode_auto_action'`
    );
    if (!cols.length) {
      await pool.query(
        `ALTER TABLE app_settings ADD COLUMN barcode_auto_action VARCHAR(30) NOT NULL DEFAULT 'none' AFTER allow_subscription_debt`
      );
    }
  } catch (e) {
    console.error('migrateAppSettingsBarcodeAutoAction:', e);
  }
}
```
Call it in `initialize()`.

### 3.2 Server: include in save/get settings
In **`server/invokeHandlers.js`**:
- `saveAppSettings` case: add `barcodeAutoAction: data.barcodeAutoAction` to `savePayload`
- `getAppSettings` case: already returns all columns, no change needed

In **`database/db.js`** `saveAppSettings` function: add `barcode_auto_action` to the UPDATE query.

### 3.3 Settings HTML
In **`screens/settings/settings.html`** — inside the "Sales Rules" card in the printer panel (after `allowSubscriptionDebt`, ~line 1212):
```html
<div class="fld" style="display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:10px;background:#f8fafc;border:1px solid var(--bdr)">
  <div style="flex:1">
    <span class="flbl" style="margin:0;font-size:13px">سلوك مسح الباركود</span>
    <p class="hint" style="margin-top:4px">عند مسح باركود الفاتورة من شاشة الفواتير الآجلة: هل يتم الدفع والتنظيف والتسليم تلقائياً؟</p>
    <div class="fwrap" style="margin-top:8px">
      <select class="finp" id="barcodeAutoAction">
        <option value="none">بدون إجراء تلقائي (فتح نافذة الدفع فقط)</option>
        <option value="pay_clean_deliver">دفع + تنظيف + تسليم تلقائي</option>
      </select>
    </div>
  </div>
</div>
```

### 3.4 Settings JS
In **`screens/settings/settings.js`**:
- Add to `fields` object: `barcodeAutoAction: document.getElementById('barcodeAutoAction')`
- In `applySettingsToForm`: add `fields.barcodeAutoAction.value = s.barcodeAutoAction || 'none'`
- In `buildSavePayload`: add `barcodeAutoAction: fields.barcodeAutoAction ? fields.barcodeAutoAction.value : 'none'`

---

## Phase 4: A4 Invoice Barcode (Optional)

Add barcode element in the A4 template (`invoicePaperA4m`) near the QR section, similar pattern. Lower priority since user specifically mentioned thermal.

---

## Files Modified (Summary)

| File | Change |
|------|--------|
| `assets/JsBarcode.min.js` | **NEW** — barcode generation library |
| `screens/pos/pos.html` | Add barcode SVG above QR, add barcode scanner input in deferred panel, add script tag |
| `screens/pos/pos.js` | Add barcode DOM ref, render barcode, add barcode scan handler + auto-action logic |
| `screens/pos/pos.css` | Add barcode + scanner CSS styles |
| `screens/credit-invoices/credit-invoices.html` | Add barcode SVG above QR, add script tag |
| `screens/credit-invoices/credit-invoices.js` | Render barcode on invoice view |
| `screens/reports/period-report/period-report.html` | Add barcode SVG, add script tag |
| `screens/reports/period-report/period-report.js` | Render barcode |
| `screens/reports/daily-report/daily-report.html` | Add barcode SVG, add script tag |
| `screens/reports/daily-report/daily-report.js` | Render barcode |
| `screens/reports/all-invoices-report/all-invoices-report.html` | Add barcode SVG, add script tag |
| `screens/reports/all-invoices-report/all-invoices-report.js` | Render barcode |
| `screens/settings/settings.html` | Add barcode auto-action dropdown |
| `screens/settings/settings.js` | Add field ref, apply, save |
| `database/db.js` | Add migration for `barcode_auto_action` column, update `saveAppSettings` |
| `server/invokeHandlers.js` | Add `barcodeAutoAction` to save payload |

---

## Implementation Order

1. **JsBarcode library** — download and add script tags
2. **Database migration** — add `barcode_auto_action` column
3. **Server-side** — update `saveAppSettings` payload + `invokeHandlers`
4. **Settings UI** — add dropdown in settings screen
5. **Thermal invoice barcode** — HTML + JS rendering in POS
6. **Report screen barcodes** — HTML + JS in all report screens
7. **Credit invoices barcode** — HTML + JS
8. **Deferred barcode scanner** — HTML input + JS handler + auto-action logic
9. **CSS styling** — barcode + scanner styles
10. **Testing** — verify barcode prints, scanner works, settings toggle works
