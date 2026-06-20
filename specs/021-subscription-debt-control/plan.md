# Implementation Plan: التحكم في مديونية الاشتراك عند نفاد الرصيد

**Branch**: `021-subscription-debt-control` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-subscription-debt-control/spec.md`

## Summary

عند اختيار طريقة الدفع "اشتراك" في نقطة البيع ورصيد الاشتراك غير كافٍ:
- إذا كان إعداد "السماح بالمديونية" **مفعّلاً** → يُكمل الطلب ويُخزَّن الرصيد سالباً (الكود الحالي يدعم هذا).
- إذا كان إعداد "السماح بالمديونية" **معطّلاً** → يُحجب الطلب في `createOrder`، يُعاد رمز خطأ مخصص، تعرض pos.js إشعاراً مفصّلاً، ولا يُطبع أي إيصال.

**التغييرات محدودة بملفين**: `database/db.js` و `screens/pos/pos.js`.

## Technical Context

**Language/Version**: Node.js (CommonJS) — Backend | Vanilla JS — Frontend

**Primary Dependencies**: mysql2/promise (pool + transactions)

**Storage**: MySQL — `subscription_periods.credit_remaining`, `app_settings.allow_subscription_debt`

**Testing**: اختبار يدوي عبر [quickstart.md](quickstart.md)

**Target Platform**: Electron desktop (Windows on-premise)

**Project Type**: Desktop POS application

**Performance Goals**: لا تأثير — التغيير إضافة `if` واحد في منطق موجود

**Constraints**: لا DB migration مطلوب — العمود موجود بالفعل

**Scale/Scope**: ملفان فقط يُعدَّلان

## Constitution Check

| القيد | التقييم |
|-------|---------|
| 4-Step API Checklist | ✅ مُستوفى — لا API جديدة، التعديل داخل `createOrder` الموجود |
| MySQL DECIMAL(10,2) | ✅ مُستوفى — `credit_remaining` بالنوع الصحيح |
| Parameterized queries | ✅ مُستوفى — لا استعلامات جديدة |
| Uniform Response Contract | ✅ `{ success: false, message, code, creditRemaining, orderTotal }` |
| Invariant #1 / Hard Constraint #9 | ⚠️ **استثناء متعمّد** — `credit_remaining` قد يصبح سالباً عند `allowDebt=true`. هذا تخفيف واعٍ للقيد عند تفعيل الإعداد من قِبَل المشغّل. |
| Single transaction in createOrder | ✅ الحجب يحدث داخل نفس الـ transaction |
| RTL / bilingual | ✅ رسائل الإشعار بالعربية |

## Project Structure

### Documentation (this feature)

```text
specs/021-subscription-debt-control/
├── plan.md              ← هذا الملف
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md             ← (/speckit-tasks)
```

### Source Code (ملفات تُعدَّل فقط)

```text
database/
└── db.js               ← createOrder: إضافة حجب INSUFFICIENT_SUBSCRIPTION_CREDIT

screens/
└── pos/
    └── pos.js          ← معالجة رمز الخطأ + عرض إشعار + منع الطباعة
```

**Structure Decision**: تطبيق يعمل على ملفَي backend وfrontend مباشرةً — لا بنية إضافية.

## Complexity Tracking

| الانتهاك | السبب | البديل المرفوض |
|----------|-------|----------------|
| `credit_remaining < 0` عند تفعيل المديونية | الميزة تتطلب تتبع الدَيْن في نفس الحقل | جدول دَيْن منفصل أعقد بلا فائدة إضافية |

## تفاصيل التنفيذ

### التعديل 1: database/db.js — createOrder (db.js ~line 4741)

بعد كتلة `if (allowDebt) / else if (creditRemaining > 0)` وقبل `consumptionAmount = Math.round(...)`:

```js
// حجب الطلب عندما طريقة الدفع "اشتراك" والرصيد غير كافٍ والمديونية ممنوعة
if (consumptionAmount === 0 && paymentMethod === 'subscription' && !allowDebt && activeSub) {
  const err = new Error('رصيد الاشتراك غير كافٍ لتغطية هذا الطلب');
  err.code = 'INSUFFICIENT_SUBSCRIPTION_CREDIT';
  err.creditRemaining = creditRemaining;
  err.orderTotal = numTotal;
  throw err;
}
```

الـ transaction يُلغى تلقائياً عبر `catch → rollback` الموجود في `createOrder`.

### التعديل 2: server/invokeHandlers.js — createOrder handler (~line 898)

تمرير `err.code` و `err.creditRemaining` و `err.orderTotal` في الاستجابة:

```js
} catch (err) {
  return {
    success: false,
    message: err.message,
    code: err.code || null,
    creditRemaining: err.creditRemaining !== undefined ? err.creditRemaining : undefined,
    orderTotal: err.orderTotal !== undefined ? err.orderTotal : undefined,
  };
}
```

**ملاحظة**: يتطلب تعديل invokeHandlers لأن الـ catch handler الحالي يُعيد فقط `{ success: false, message }`.

### التعديل 3: screens/pos/pos.js — معالجة الخطأ

في `catch` block بعد استدعاء `window.api.createOrder(...)`:

```js
if (res && !res.success && res.code === 'INSUFFICIENT_SUBSCRIPTION_CREDIT') {
  showInsufficientCreditModal(res.creditRemaining, res.orderTotal);
  return; // لا طباعة، السلة تبقى كما هي
}
```

دالة `showInsufficientCreditModal` تعرض نافذة (modal أو toast كبير) بالمعلومات التالية:
- عنوان: "رصيد الاشتراك غير كافٍ"
- الرصيد الحالي والمبلغ المطلوب
- اقتراح: شحن الاشتراك أو اختيار طريقة دفع أخرى
