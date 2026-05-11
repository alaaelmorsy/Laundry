# Feature 06 — Prepaid Packages

## Goal
تعريف الباقات مدفوعة مسبقًا التي يشتريها العملاء ثم يخصمون منها خدمات المغسلة حتى نفاد رصيدها.

## Entry points
- UI: ضمن `screens/subscriptions/subscriptions.html|js` (تبويب الباقات) وأيضًا `screens/settings` حسب الواجهة.
- API: `getPrepaidPackages`, `savePrepaidPackage`, `togglePrepaidPackage`, `deletePrepaidPackage`.

## Inputs
- `savePrepaidPackage`: `{ id?, nameAr, prepaidPrice, serviceCreditValue, durationDays, isActive?, notes?, sortOrder? }`
- `getPrepaidPackages`: `{ activeOnly?, search? }`

## Outputs
- `packages: [{ id, name_ar, prepaid_price, service_credit_value, duration_days, is_active, sort_order, notes, created_at }]`.

## Rules
- `name_ar` مطلوب — وإلا `"اسم الباقة مطلوب"`.
- `prepaidPrice`, `serviceCreditValue`: أرقام ≥ 0 وإلا `"المبالغ غير صالحة"`.
- `durationDays`: عدد صحيح ≥ 1 (افتراضي 30). يُطبَّق `Math.max(1, Math.floor(n))`.
- ترتيب عرض: `ORDER BY sort_order ASC, id ASC`. جديد = `MAX(sort_order)+1`.

## Edge cases
- حذف باقة مرتبطة بأي `subscription_periods` يرفض برسالة `"لا يمكن حذف الباقة لارتباطها بفترات اشتراك"`.
- باقة غير مفعّلة لا يمكن استخدامها في `createSubscription` / `renewSubscription` (`"الباقة غير موجودة أو غير مفعّلة"`).
- الفرق بين `prepaidPrice` (ما يدفعه العميل) و `serviceCreditValue` (الرصيد الممنوح) يسمح بعرض مكافآت.
