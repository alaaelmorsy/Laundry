# Feature 09 — Invoices (List, Detail, Printing)

## Goal
عرض قائمة الفواتير مع بحث وفلاتر تواريخ، إظهار تفاصيلها مع رصيد الاشتراك إن وُجد، وطباعتها حراريًا أو A4.

## Entry points
- UI: `screens/invoices/invoices.html|js|css`, `screens/invoice-a4/*`
- API: `getOrders`, `getOrderById`, `getSubscriptionInvoices`, `getOrdersBySubscription`, `markOrderCleaned`, `markOrderDelivered`.
- ZATCA QR: `generateZatcaQR`.

## Inputs
- `getOrders`: `{ page=1, pageSize=50, search, dateFrom, dateTo }` — يبحث في `order_number`, `customer_name`, `phone`.
- `getOrderById`: `{ id }`.

## Outputs
- `getOrderById` → `{ order, items, subscription? }`.
  - `subscription` يأتي من:
    1. سجل ledger المرتبط (`ref_type=order, ref_id=order.id`) → `{ package_name, credit_remaining: balance_after }`.
    2. fallback: الاشتراك النشط للعميل إذا لم يوجد ledger (حالة الفاتورة الآجلة غير المسدَّدة).

## Rules
- الترتيب: `ORDER BY o.id DESC`.
- الفلترة بالتاريخ تستخدم `DATE(created_at)`.
- `invoice_seq` مستقل عن `order_number`.
- لوحة حالة القطع:
  - `cleaning_date` يُحدَّد بـ `markOrderCleaned`.
  - `delivery_date` يُحدَّد بـ `markOrderDelivered`.
- طباعة A4 تتبع `invoice_paper_type=a4` في الإعدادات، والإيصال الحراري هو الافتراضي.

## Edge cases
- فاتورة بدون عميل → لا تظهر معلومات اشتراك.
- فاتورة تم إنشاؤها قبل وجود اشتراك ثم دُفعت لاحقًا: fallback يعرض الاشتراك النشط الحالي (قد يتغيّر بمرور الوقت — هذا مقبول حسب التصميم).
- تغيير `price_display_mode` في الإعدادات بعد إصدار الفاتورة لا يؤثر عليها (الحقل محفوظ بالفاتورة).
- صفحة A4 تستخدم `puppeteer-core` — تأكد من توفر `CHROME_PATH` في بعض البيئات.
