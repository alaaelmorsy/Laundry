# Implementation Plan: إيصالات الاستهلاك في تقرير الاشتراكات

**Branch**: `017-subscription-consumption-receipts` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

## Summary

إضافة قسم "إيصالات الاستهلاك" إلى تقرير الاشتراك للعميل مع زر "عرض الإيصال" يفتح نفس الإيصال الحراري من شاشة البيع. يشمل: واجهة المستخدم + تصدير PDF + تحديث الـ API.

## Technical Context

**Language/Version**: Node.js (CommonJS), Vanilla JS
**Primary Dependencies**: Express.js, mysql2/promise, Puppeteer (PDF)
**Storage**: MySQL — جدول `consumption_receipts` موجود، لا تغييرات schema
**Target Platform**: Desktop browser, RTL Arabic-first
**Performance Goals**: عرض الإيصال < 1 ثانية
**Constraints**: لا ES modules، RTL إلزامي، 4-Step API Checklist إلزامي

## Constitution Check

- Principle I: 4-Step Checklist على كل API جديد
- Principle II: تغييرات داخل الشاشات الموجودة فقط
- Principle III: لا تغييرات schema، قراءة فقط
- Principle IV: Arabic-First RTL
- Hard Constraint #2: parameterized SQL
- Hard Constraint #11: SaudiRiyal font glyph

لا انتهاكات.

## Project Structure

### Documentation

```
specs/017-subscription-consumption-receipts/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md  (يُنشأ بـ /speckit-tasks)
```

### Source Code (الملفات المتأثرة)

```
database/db.js                                  تحديث: consumptionReceipts في report function
server/invokeHandlers.js                         تحقق: getConsumptionReceiptById
server/services/reportHtml.js                    تحديث: قسم PDF جديد
assets/web-api.js                                تحقق: getConsumptionReceiptById
screens/reports/subscriptions-report/
    subscriptions-report.html                    إضافة: section HTML + modal viewer
    subscriptions-report.js                      إضافة: renderConsumptionReceipts + openReceiptViewer
```

## Implementation Steps

### Step 1 — تحديث DB function (database/db.js)

ابحث في invokeHandlers.js عن الـ case الخاص بتقرير الاشتراك للعميل، ثم تتبع إلى db.js.
أضف استعلام:
```sql
SELECT cr.id, cr.receipt_seq, cr.created_at,
       cr.amount_consumed, cr.balance_before, cr.balance_after,
       cr.package_name, cr.items_json, c.customer_name, c.phone
FROM consumption_receipts cr
LEFT JOIN customers c ON c.id = cr.customer_id
WHERE cr.subscription_id = ?
ORDER BY cr.created_at ASC
```
أضف `consumptionReceipts: rows` لكائن الـ return.

### Step 2 — التحقق من تسجيل getConsumptionReceiptById (assets/web-api.js)

إذا غير موجود:
```js
getConsumptionReceiptById: (payload) => invoke('getConsumptionReceiptById', payload),
```

### Step 3 — إضافة section HTML (subscriptions-report.html)

أضف بعد الأقسام الموجودة:
- div#consumptionSection بجدول يحتوي: #، رقم الإيصال، التاريخ، الجوال، المستهلك، الرصيد بعد، عرض
- tbody#consumptionTableBody
- div#consumptionTotal للإجمالي
- div#consumptionReceiptViewer (modal مخفي) يحتوي div#crViewerPaper

### Step 4 — إضافة دوال JS (subscriptions-report.js)

**renderConsumptionReceipts(receipts)**: تملأ الجدول بالبيانات أو رسالة "لا توجد إيصالات".

**openReceiptViewer(receiptId)**: تستدعي getConsumptionReceiptById ثم تعرض الإيصال في الـ modal.

**populateCrViewer(receipt)**: تملأ #crViewerPaper بنفس محتوى #crPaper من consumption-receipts.html (نفس العناصر: اسم المغسلة، رقم الإيصال، العميل، البنود، المبالغ).

**closeReceiptViewer()**: تخفي الـ modal.

### Step 5 — تحديث PDF (server/services/reportHtml.js)

في buildPdfHtmlForSubscriptionCustomerReport، أضف قسم إيصالات الاستهلاك بعد الفواتير:
- جدول: #، رقم الإيصال، التاريخ، المستهلك، الرصيد قبل، الرصيد بعد
- يقرأ من report.consumptionReceipts
- نفس تنسيق باقي الجداول في نفس الدالة

### Step 6 — ربط القسم (subscriptions-report.js)

في دالة معالجة API response:
```javascript
renderConsumptionReceipts(data.consumptionReceipts || []);
```

## ترتيب التنفيذ

Step 1 (db.js) -> Step 2 (web-api.js) -> Step 3 (HTML) -> Step 4 (JS) -> Step 5 (PDF) -> Step 6 (wire)

## ملاحظات للمنفذ

1. نقطة البداية الأهم: ابحث في invokeHandlers.js عن handler تقرير الاشتراك للعميل ثم تتبع الى db.js
2. الإيصال المعروض: crViewerPaper يجب أن يكون نسخة طبق الأصل من crPaper في consumption-receipts.html
3. CSS: استخدم نفس CSS من consumption-receipts.css أو اجلبه لضمان التطابق البصري
4. أضف Escape key و backdrop click لإغلاق الـ modal
