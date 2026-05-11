# Feature 03 — Customers Management

## Goal
إدارة بيانات العملاء (أفراد/شركات) والبحث والترقيم وتصديرهم، مع دعم ربطهم لاحقًا بالاشتراكات.

## Entry points
- UI: `screens/customers/customers.html|js|css`
- API methods: `getCustomers`, `createCustomer`, `updateCustomer`, `toggleCustomerStatus`, `deleteCustomer`.
- Export: `POST /api/export/customers` (Excel/PDF).

## Inputs
- `createCustomer/updateCustomer`: `{ customerName, phone, taxNumber?, nationalId?, address, city, email?, customerType?, notes?, isActive? }`
- `getCustomers`: `{ page?, pageSize?, search?, withoutSubscription? }`
- `toggleCustomerStatus`: `{ id, isActive }`
- `deleteCustomer`: `{ id }`

## Outputs
- `getCustomers` → `{ customers, total, page?, pageSize?, totalPages? }` مع حقول محسوبة: `sub_credit_remaining`, `sub_package_name`, `sub_display_status`.

## Rules
- **phone** يُطبَّع (أرقام عربية/فارسية → ASCII، حذف غير الأرقام)، طوله 1..32.
- **phone UNIQUE** و **customer_name UNIQUE** (error codes `PHONE_DUPLICATE` / `NAME_DUPLICATE`).
- `subscription_number` **لا يُعيَّن** يدويًا هنا — يُولَّد تلقائيًا عند أول اشتراك (انظر feature-07).
- البحث يغطي: `customer_name`, `phone`, `subscription_number`.
- `withoutSubscription=true` يستبعد أي عميل له سجل في `customer_subscriptions`.

## Edge cases
- تكرار الاسم/الهاتف → error code محدد يُترجَم في الواجهة.
- حذف عميل لديه اشتراك → يفشل بسبب FK `ON DELETE RESTRICT`.
- البحث بالأرقام العربية: يفضّل تطبيعها في الواجهة قبل الإرسال.
- العميل المعطَّل (`is_active=0`) لا يظهر في POS (مسؤولية الواجهة/الاستعلام).
