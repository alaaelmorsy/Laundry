# Feature 10 — Deferred & Partial Payments

## Goal
التعامل مع الفواتير الآجلة (Credit) والسماح بدفعات متعددة جزئية عليها حتى السداد الكامل.

## Entry points
- UI: `screens/payment/payment.html|js|css`, تبويب "آجل" ضمن `screens/invoices`.
- API: `getDeferredOrders`, `payDeferredOrder`, `getInvoiceWithPayments`, `recordInvoicePayment`, `getPaymentHistory`.

## Inputs
- `getDeferredOrders`: `{ search? }`.
- `payDeferredOrder`: `{ orderId, paymentMethod? }` (افتراضي `cash`). يسدّد الكامل.
- `recordInvoicePayment`: `{ orderId, paymentAmount, paymentMethod?, cashAmount?, cardAmount?, notes?, createdBy? }`.
- `getInvoiceWithPayments`: `{ orderId }`.

## Outputs
- `getInvoiceWithPayments` → الفاتورة + قائمة `invoice_payments` + مجموع المدفوع والمتبقي.

## Rules
- جدول `invoice_payments (order_id, payment_amount, payment_method, payment_date, created_by, notes)`.
- `getDeferredOrders` (سلوك البحث):
  - بدون بحث: يعرض فقط الفواتير الآجلة (`pending`, `partial`).
  - بحث بالاسم أو الجوال: يعرض فقط الفواتير الآجلة أيضًا.
  - بحث برقم الفاتورة (`invoice_seq`): يسمح بإظهار الفاتورة حتى لو كانت مدفوعة (`paid`).
- فلترة واجهة "الفواتير الآجلة" (تبويب POS):
  - الخيارات: `غير مدفوعة` (افتراضي)، `تم السداد`، `تم التنظيف`، `تم التسليم`.
  - لا توجد خيارات مستقلة لـ `الكل` أو `مدفوعة` (لأن `تم السداد` تمثل الفواتير المدفوعة).
- كل دفعة جزئية تُحدّث `orders.paid_amount += x` و `remaining_amount -= x`.
- عند `remaining_amount == 0`:
  - `payment_status = 'paid'`.
  - `fully_paid_at = now`.
- `payDeferredOrder` اختصار يسدّد الكامل ويعلّم الحالة `paid` + `paid_at`.
- `FOREIGN KEY` مع `ON DELETE CASCADE` → حذف الفاتورة يحذف دفعاتها.

## Edge cases
- دفع مبلغ يفوق المتبقي: يجب التحقق في الواجهة (السيرفر قد يقبله ويؤدي لسالب — راجع الكود قبل التعديل).
- تسجيل دفعة على فاتورة مدفوعة بالكامل: يحتاج التحقق.
- عملات عشرية: `DECIMAL(10,2)` — لا تمرر قيم ذات أكثر من خانتين عشريتين.
- `createdBy` يُسحب من `req.user.username` كافتراضي.

## UI hints
- تبويب "فواتير آجلة" يُستخدم عبر plan `deferred_invoices_tab_plan.md` (تاريخي).
- سلوك Partial Payment موصّف في `partial_payment_plan.md`.
