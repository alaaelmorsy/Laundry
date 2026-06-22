# Implementation Plan: خصم العميل — حل تضارب الخصمَين (Customer Discount — Dual Discount Conflict)

**Branch**: `001-customer-discount` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)

## Summary

### المشكلة الحالية

الكود الحالي في `pos.js` يحسب `manualDisc` و`customerDisc` بشكل صحيح داخل `calcDiscount()` لكنه يجمعهما ويعرضهما في **سطر خصم واحد** بتسمية "خصم العميل (50%)" — مما يُظهر مبلغًا أكبر من المتوقع تحت تسمية مضللة، ويُخالف روح التوافق مع هيئة الزكاة.

**مثال من الشاشة**:
- المجموع قبل الضريبة: 1.74 ر.س
- الخصم المعروض: 1.57 ر.س تحت "خصم العميل (50%)" ← لكن 50% من 1.74 = 0.87 فقط!
- المبلغ الفعلي 1.57 = خصم العميل 50% + خصم يدوي إضافي من الكاشير

### الحل

عرض كل خصم في **سطر مستقل** في الفاتورة، وتخزين `manual_discount_amount` بشكل منفصل في قاعدة البيانات، مع إبقاء `discountAmount` الإجمالي صحيحًا لـ ZATCA.

## Technical Context

**Language/Version**: Node.js 20 (CommonJS), Vanilla JS (ES5/ES2015 بدون bundler)

**Primary Dependencies**: Express.js, mysql2/promise, Tailwind CSS

**Storage**: MySQL/MariaDB

**Testing**: اختبار يدوي عبر quickstart.md

**Target Platform**: Windows on-premise desktop app (NSSM service)

**Constraints**: لا تغيير على أبعاد الطباعة الحرارية، لا DDL من invokeHandlers، جميع الحقول النقدية DECIMAL(10,2)

## الحالة الراهنة للكود (Current Code State)

### ما هو موجود بالفعل ✅

| الملف | ما هو موجود |
|-------|------------|
| `database/db.js` | Migration: أعمدة `discount_type/value/expiry` على `customers` — موجودة |
| `database/db.js` | Migration: عمود `customer_discount_amount` على `orders` — موجود |
| `database/db.js` | `createOrder()` يقبل ويُخزِّن `customerDiscountAmount` — موجود |
| `screens/customers/customers.html` | حقول الخصم (نوع + قيمة + تاريخ) في مودال العميل |
| `screens/customers/customers.js` | تمرير حقول الخصم عند الحفظ |
| `screens/pos/pos.js` | `calcDiscount()` يحسب `manualDisc` و`customerDisc` منفصلَين |
| `screens/pos/pos.js` | `getCustomerDiscountAmount()` دالة جاهزة |
| `screens/pos/pos.js` | `createOrder` call يُرسل `customerDiscountAmount` |
| `screens/pos/pos.js` | عند اختيار العميل يُحمَّل `state.customerDiscount` |

### ما هو **مفقود / خاطئ** ❌

| المشكلة | الموقع |
|---------|--------|
| `manual_discount_amount` غير موجود في `orders` table | `database/db.js` |
| `createOrder()` لا يقبل `manualDiscountAmount` كمعامل مستقل | `database/db.js` |
| `discountLabel` لا يشمل تسمية الخصم اليدوي | `pos.js:3611-3623` |
| `showInvoiceModal` يعرض سطرًا واحدًا للخصم المدمج | `pos.js:3062-3104` |
| `pos.html` لا يحتوي سطرًا ثانيًا للخصم اليدوي | `screens/pos/pos.html` |
| `invokeHandlers.js` لا يُمرِّر `manualDiscountAmount` لـ `createOrder` | `server/invokeHandlers.js` |

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| 4-step API checklist | ✅ | db → handler → web-api (موجود) → screen |
| لا DDL في invokeHandlers | ✅ | Migration في db.initialize() فقط |
| لا ORM | ✅ | raw mysql2 queries |
| لا fetch('/api/invoke') مباشرة | ✅ | window.api فقط |
| DECIMAL(10,2) للمبالغ | ✅ | manual_discount_amount سيكون DECIMAL(10,2) |
| migrations additive + try/catch | ✅ | ALTER TABLE ADD COLUMN فقط |
| أبعاد الطباعة الحرارية 76mm / margin: 0 auto | ✅ | لن تُعدَّل |
| ZATCA fields on orders untouched | ✅ | لا تغيير على discount_amount الإجمالي |
| Arabic UI / RTL | ✅ | جميع النصوص عربية |

## Project Structure — الملفات المطلوب تعديلها

```text
database/
└── db.js
    ├── [Migration] ALTER TABLE orders ADD COLUMN manual_discount_amount
    └── [createOrder()] إضافة manualDiscountAmount = 0 كمعامل + تخزينه

server/
└── invokeHandlers.js
    └── case 'createOrder': تمرير manualDiscountAmount من payload

assets/
└── web-api.js
    └── لا تغيير — api.createOrder موجود ويُمرِّر payload as-is

screens/pos/
├── pos.html
│   ├── إضافة سطر خصم العميل (invCustomerDiscRow)
│   └── إضافة سطر الخصم اليدوي (invManualDiscRow)
└── pos.js
    ├── discountLabel: إضافة تسمية الخصم اليدوي
    ├── showInvoiceModal: ملء السطرَين بشكل مستقل
    └── createOrder call: إضافة manualDiscountAmount
```

## Implementation Steps

### Step 1 — Database Migration (`database/db.js`)

**في `db.initialize()`** أضف migration جديد بعد migration `customer_discount_amount`:

```js
// Migration: manual_discount_amount on orders
try {
  const [[cols2]] = await pool.query(`
    SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'manual_discount_amount'`);
  if (!cols2.cnt) {
    await pool.query(`ALTER TABLE orders ADD COLUMN manual_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0`);
  }
} catch (e) {
  console.error('migrate manual_discount_amount:', e);
}
```

**في `createOrder()` signature** (السطر 4844):
```js
// قبل:
async function createOrder({ ..., customerDiscountAmount = 0 })
// بعد:
async function createOrder({ ..., customerDiscountAmount = 0, manualDiscountAmount = 0 })
```

**في INSERT query** (السطر 4952-4964):
- أضف `manual_discount_amount` للأعمدة وقيمة `Number(manualDiscountAmount) || 0` للقيم

### Step 2 — invokeHandlers.js

في `case 'createOrder':` أضف تمرير `manualDiscountAmount`:
```js
manualDiscountAmount: Number(payload.manualDiscountAmount) || 0,
```

### Step 3 — pos.html (Invoice Display)

**الهدف**: فصل سطر خصم العميل عن سطر الخصم اليدوي.

استبدل سطر الخصم الحالي (`invDiscRow`) بسطرَين:

```html
<!-- سطر خصم العميل — يظهر فقط إذا كان خصم العميل > 0 -->
<tr id="invCustomerDiscRow" class="inv-total-row" style="display:none">
  <td class="inv-total-label" id="invCustomerDiscLabel">خصم العميل</td>
  <td class="inv-total-val discount-val" id="invCustomerDisc"></td>
</tr>

<!-- سطر الخصم اليدوي — يظهر فقط إذا كان الخصم اليدوي > 0 -->
<tr id="invManualDiscRow" class="inv-total-row" style="display:none">
  <td class="inv-total-label">خصم إضافي</td>
  <td class="inv-total-val discount-val" id="invManualDisc"></td>
</tr>
```

> ⚠️ تأكد من إبقاء `invDiscRow` إذا كان مرجعًا في أماكن أخرى من الكود، أو أبدله بالسطرَين الجديدَين وحدِّث كل المراجع.

### Step 4 — pos.js

**4a. DOM refs** — أضف refs جديدة:
```js
invCustomerDiscRow:  document.getElementById('invCustomerDiscRow'),
invCustomerDisc:     document.getElementById('invCustomerDisc'),
invCustomerDiscLabel:document.getElementById('invCustomerDiscLabel'),
invManualDiscRow:    document.getElementById('invManualDiscRow'),
invManualDisc:       document.getElementById('invManualDisc'),
```

**4b. discountLabel** (السطر 3611-3623) — أضف الخصم اليدوي:
```js
if (state.discount > 0) {
  const dType = state.discountType === 'pct' ? state.discount + '%' : state.discount.toFixed(2) + ' ر.س';
  parts.push('خصم إضافي (' + dType + ')');
}
```

**4c. showInvoiceModal — ملء السطرَين** (السطر ~3062-3104):

احسب كلا الخصمَين بشكل مستقل:
```js
const customerDiscAmt = getCustomerDiscountAmount(totals.subtotal);
const manualDiscAmt   = totals.discount - customerDiscAmt
                        - getOfferDiscountAmount(totals.subtotal)
                        - Math.max(0, state.loyaltyDiscount || 0);
const manualDiscAmtClamped = Math.max(0, manualDiscAmt);
```

ثم ملء سطر خصم العميل:
```js
if (customerDiscAmt > 0) {
  const cd = state.customerDiscount;
  const cdLabel = 'خصم العميل (' + (cd.type === 'percentage' ? cd.value + '%' : cd.value.toFixed(2) + ' ر.س') + ')';
  els.invCustomerDiscLabel.textContent = cdLabel;
  els.invCustomerDisc.innerHTML = sarFmt(customerDiscAmt);
  els.invCustomerDiscRow.style.display = '';
} else {
  els.invCustomerDiscRow.style.display = 'none';
}
```

وملء سطر الخصم اليدوي:
```js
if (manualDiscAmtClamped > 0) {
  els.invManualDisc.innerHTML = sarFmt(manualDiscAmtClamped);
  els.invManualDiscRow.style.display = '';
} else {
  els.invManualDiscRow.style.display = 'none';
}
```

> **تنبيه**: سطر `invAfterDiscRow` (المجموع بعد الخصم) لا يزال يعرض بعد كلا السطرَين — لا تغيير.

**4d. createOrder call** (السطر 3606+) — أضف:
```js
manualDiscountAmount: parseFloat(
  Math.max(0, calcDiscount(subtotal)
    - getCustomerDiscountAmount(subtotal)
    - getOfferDiscountAmount(subtotal)
    - Math.max(0, state.loyaltyDiscount || 0)
  ).toFixed(2)
),
```

**4e. updateSummary()** (اختياري للـ summary panel في POS):
- حاليًا يعرض `manualDiscOnly = discount - loyaltyDiscount` — يمكن الإبقاء عليه أو فصله لاحقًا. ليس ضروريًا للـ spec الحالي.

### Step 5 — Verify ZATCA Unaffected

- `discountAmount` الإجمالي يُبعَث لـ ZATCA في `allowanceChargeAmount` — لا تغيير.
- `customer_discount_amount` تُحفَظ في DB للتقارير — لا تغيير.
- `manual_discount_amount` تُضاف للتخزين فقط — لا تؤثر على ZATCA.

## Complexity Tracking

لا انتهاكات للدستور. التغييرات additive بالكامل — لا حذف لأي عمود أو منطق.

**الإجمالي**: 5 ملفات، 4 خطوات متسلسلة، لا تغييرات على ZATCA.
