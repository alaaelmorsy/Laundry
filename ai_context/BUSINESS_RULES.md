# BUSINESS_RULES — Laundry Management System

هذا الملف يجمع كل القواعد والحسابات والقيود الفعلية المستخرجة من الشيفرة (`database/db.js`, `server/invokeHandlers.js`, `server/index.js`). أي تغيير في السلوك يجب أن يُحدّث هنا.

## 1. Authentication & Users

- **Roles**: `admin`, `cashier` (ENUM في `users.role`).
- **كلمات المرور**: `bcryptjs` مع `BCRYPT_ROUNDS = 10`. إذا كانت كلمة مرور مستخدم قديم مخزّنة plain text، تُرقّى تلقائيًا إلى hash عند أول تسجيل دخول ناجح.
- **JWT**:
  - سر من `JWT_SECRET`. في `production` يُرفض إن كان < 16 حرفاً.
  - مدة صلاحية: `JWT_EXPIRES_IN` (افتراضي `7d`).
  - يُخزَّن في cookie `laundry_auth` بخصائص `httpOnly`, `sameSite=lax`, `path=/`, `maxAge=7d`, `secure=true` في production فقط.
- **Rate limit**: `/api/auth/login` ≤ 50 طلب / 15 دقيقة.
- **Seed admin افتراضي**: `admin / admin123 / role=admin`. لا يُعاد إنشاؤه إن وُجد بالفعل.
- **Active user**: فقط `users.is_active = 1` يمكنه الدخول.

## 2. Customers

- **الحقول الإلزامية**: `customer_name`, `phone`, `address`, `city`.
- **subscription_number**: يُعيَّن تلقائيًا فقط عند أول اشتراك للعميل، قيمته = `MAX(numeric subscription_number) + 1`. قبل ذلك يبقى `NULL`.
- **phone**:
  - يُطبَّع دومًا إلى أرقام ASCII (يحوَّل ٠-٩ العربية والفارسية ← 0-9، وتُحذف جميع الأحرف غير الرقمية).
  - طول بعد التطبيع: 1 ≤ length ≤ 32. إذا 0 → `PHONE_INVALID`، > 32 → `PHONE_TOO_LONG`.
  - **unique** عبر جميع العملاء → `PHONE_DUPLICATE`.
- **customer_name unique** → `NAME_DUPLICATE` (في الإنشاء والتعديل، باستثناء العميل نفسه).
- **customer_type**: `individual` (افتراضي) أو `corporate`.
- **حذف عميل**: `DELETE` مباشر. الاشتراكات مرتبطة بـ `ON DELETE RESTRICT`، أي لا يمكن حذف عميل لديه اشتراك.

## 3. Laundry Services

- **الحقول**: `name_ar` (مطلوب)، `name_en` (مطلوب)، `is_active`, `sort_order`.
- **Seeding افتراضي** عند فراغ الجدول: غسيل وكوي عادي، غسيل وكوي مستعجل، كوي فقط، تنظيف جاف.
- **`reorderLaundryService({ id, beforeId })`**: إعادة ترتيب نسبي داخل transaction، إعادة كتابة `sort_order = index+1` للكل.
- **حذف خدمة**: `ON DELETE RESTRICT` من `product_price_lines` → لا يمكن حذف خدمة مرتبطة بأسعار.

## 4. Products & Price Lines

- **products**: `name_ar` (مطلوب)، `name_en` (اختياري)، `image_blob` (gzip)، `image_mime`، `is_active`, `sort_order`.
- **صورة المنتج**:
  - أقصى حجم خام: **15 MB** = `15 * 1024 * 1024 bytes`. تُضغط بـ `zlib.gzipSync(level: 9)`.
  - `removeImage=true` → يمسح الـ blob والـ mime.
- **product_price_lines**: `UNIQUE(product_id, laundry_service_id)`. عند الحفظ يتم `DELETE` ثم إعادة إدراج كل الأسطر.
  - يُهمَل أي سطر بـ `price <= 0` أو بدون `laundryServiceId`.

## 5. Prepaid Packages

- **الحقول الإلزامية**: `name_ar`, `prepaid_price >= 0`, `service_credit_value >= 0`, `duration_days` (يُقصّ إلى ≥ 1، افتراضي 30).
- **الحذف**: ممنوع إذا كانت الباقة مرتبطة بأي `subscription_periods` (`"لا يمكن حذف الباقة لارتباطها بفترات اشتراك"`).
- **is_active**: الباقات غير المفعّلة لا تُستخدم في `createSubscription` / `renewSubscription` (`"الباقة غير موجودة أو غير مفعّلة"`).

## 6. Customer Subscriptions & Periods

- **قاعدة أساسية**: العميل الواحد يُسمح له بـ **اشتراك واحد** (عبر `customer_subscriptions`). محاولة إنشاء ثاني ترفض برسالة:
  `"هذا العميل لديه اشتراك بالفعل. يمكن التجديد فقط من قائمة الاشتراكات."`
- **subscription_ref** عند الإنشاء: `SUB-` + `String(subId).padStart(6, '0')`.
- **period_from**:
  - `createSubscription`: إذا تُرك فارغًا، يأخذ `CURDATE()`.
  - `renewSubscription`: إذا فارغ، يحسب تلقائيًا `period_to(السابقة) + 1 day` (أو `CURDATE()` إن كان التاريخ قبل اليوم).
- **period_to**: اختياري. NULL = **باقة مفتوحة بلا تاريخ انتهاء**.
- **credit_value_granted** = `package.service_credit_value`.
- **credit_remaining**:
  - عند الإنشاء = `service_credit_value`.
  - عند التجديد = `service_credit_value + carry` حيث `carry = max(0, آخر فترة.credit_remaining)` إذا `carryOverRemaining` (افتراضي true).
- **status** في `subscription_periods`:
  - `active` عند الإنشاء/التجديد.
  - يُحوَّل إلى `expired` تلقائيًا في أي قراءة إذا `period_to < CURDATE()`.
  - يتحوّل إلى `closed` عند التجديد (الفترة السابقة) أو عند `stopSubscription`.
- **display_status** (محسوب SQL):
  - `none` لا توجد فترة.
  - `active` لو (period_to NULL أو ≥ CURDATE) والـ status active.
  - `expired` إن انتهى.
  - `closed` إن أُوقف.
- **stopSubscription**: يجب أن توجد فترة `active` → تصبح `closed`. يرمي خطأ `"لا توجد فترة نشطة لإيقافها"`.
- **resumeSubscription**: يجب **عدم** وجود active، وأن تكون آخر فترة `closed` فقط. وإلا خطأ `"الاشتراك مفعّل بالفعل"` أو `"لا توجد فترة موقوفة لإعادة تفعيلها"`.
- **updateActiveSubscriptionPeriod**: يُعدّل period_from/period_to/credit_remaining على الفترة النشطة.
  - شرط: `period_from ≤ period_to` إن وُجدا.
  - رصيد جديد يجب ≥ 0.
  - أي تغيير في الرصيد يُسجَّل ledger كـ `entry_type=adjustment` مع الـ delta.
- **subscription_ledger.entry_type**: `purchase | renewal | consumption | adjustment | refund`. `balance_after` يُخزَّن بعد كل حركة.
- **deleteSubscription**: حذف مباشر (CASCADE على periods و ledger).

## 7. Orders (POS) & Pricing

- **order_number**: `MAX(CAST(order_number AS UNSIGNED)) + 1`.
- **invoice_seq**: `MAX(invoice_seq) + 1` داخل الـ transaction (عداد مستقل).
- **payment_method**: `cash` افتراضيًا. أي قيمة غير معروفة تُحفظ كما هي. القيمة `credit` = آجل.
- **payment_status**:
  - `credit` → `pending`, `paid_at = NULL`.
  - غير ذلك → `paid`, `paid_at = now`.
- **paid_amount / remaining_amount**:
  - `credit` → `paid_amount=0`, `remaining_amount=total`.
  - غير ذلك → `paid_amount=total`, `remaining_amount=0`.
- **payment_method = 'mixed'**:
  - `orders.paid_cash`: المبلغ النقدي (يُدخله الكاشير).
  - `orders.paid_card`: المبلغ عبر الشبكة = `total_amount − paid_cash` (يُحسب تلقائياً).
  - القيد المنطقي: `paid_cash + paid_card == total_amount` (فرق تقريبي ≤ 0.01 مقبول).
  - كلا العمودين `DECIMAL(10,2) DEFAULT 0` في `orders`.
- **price_display_mode**: `inclusive` أو `exclusive` (افتراضي exclusive). يُحفظ مع الفاتورة لأن الإعداد العام قد يتغيّر لاحقًا.

### خصم تلقائي من الاشتراك (داخل نفس transaction)
عند `createOrder` مع `customer_id` له اشتراك ذو فترة `active` و `credit_remaining > 0`:
1. `deduct = min(total_amount, credit_remaining)`.
2. `credit_remaining -= deduct`.
3. يُسجَّل ledger: `entry_type='consumption'`, `ref_type='order'`, `ref_id=order.id`, `notes=فاتورة رقم {invoiceSeq}`.
4. فشل خطوة الخصم لا يُوقف إنشاء الفاتورة (catch + console.error).

## 8. Deferred & Partial Payments

- **getDeferredOrders**:
  - بدون بحث: يُرجع الفواتير ذات `payment_status IN ('pending','partial')`.
  - بحث بالاسم/الجوال: يظل مقيّدًا بالفواتير الآجلة فقط (`pending`,`partial`).
  - بحث برقم الفاتورة (`invoice_seq`): غير مقيّد بالحالة، ويمكن أن يُرجع فاتورة `paid`.
  - عند `statusFilter='settled'` (فلتر "تم السداد" في الواجهة): لا يُقيَّد البحث بالآجل فقط حتى يمكن إرجاع الفواتير المسددة للعميل.
  - الفلتر الافتراضي في الواجهة هو `غير مدفوعة` (`statusFilter='unpaid'`).
- **payDeferredOrder({ orderId, paymentMethod, paidCash?, paidCard? })**: يسدّد الكامل ويحوّل `payment_status='paid'` + `paid_at=now` ويضبط `paid_amount=total_amount`, `remaining_amount=0`، ومع `mixed` يملأ `paid_cash/paid_card`.
- **recordInvoicePayment** (دفعة جزئية):
  - يضيف صف في `invoice_payments`.
  - يُعدّل `orders.paid_amount` و `remaining_amount` تلقائيًا.
  - إذا `remaining_amount == 0` يُحدَّث `payment_status='paid'` و `fully_paid_at=now`.
- **recordInvoicePayment مع mixed**:
  - تُحفظ تفاصيل التقسيم في `invoice_payments.cash_amount` و `invoice_payments.card_amount` (كلاهما `DECIMAL(10,2) DEFAULT 0`).
- **getPaymentHistory**: قائمة `invoice_payments` مرتبة DESC حسب التاريخ.

## 9. Order Lifecycle Statuses

- `markOrderCleaned` → يعيّن `orders.cleaning_date=now`.
- `markOrderDelivered` → يعيّن `orders.delivery_date=now`.

## 10. Expenses

- **الحقول**: `title`, `category` (افتراضي `عام`), `amount`, `is_taxable`, `tax_rate` (افتراضي 15.00), `tax_amount`, `total_amount`, `expense_date`.
- **tax_amount** = يُرسَل من الواجهة، لكن من المتوقع: إن `is_taxable=1` فـ `tax_amount = amount * tax_rate / 100` و `total_amount = amount + tax_amount`.
- **getExpensesSummary**: يُجمّع المصاريف حسب الفلاتر (date range, search).

## 11. App Settings (single row id=1)

- **vat_rate**: افتراضي `15.00` (نسبة ضريبة القيمة المضافة KSA).
- **price_display_mode**: `exclusive` (افتراضي) أو `inclusive`.
- **invoice_paper_type**: `thermal` (افتراضي) أو `a4`.
- **logo_width / logo_height**: افتراضي 180×70 px.
- **print_copies**: افتراضي 1.
- **custom_fields**: حد أقصى **20** حقل (ثابت `MAX_APP_SETTINGS_CUSTOM_FIELDS=20`).
- **الشعار**:
  - يُخزَّن `LONGBLOB` مضغوط gzip + `logo_mime`.
  - أقصى حجم خام 15 MB.
  - `removeLogo=true` يمسحه.
- **ZATCA fields**: `vat_number`, `commercial_register`, `building_number`, `street_name_ar`, `district_ar`, `city_ar`, `postal_code`, `additional_number`.

## 12. ZATCA QR (Phase 1)

- ترميز TLV (tag, length, value): 
  - `tag 1` = sellerName
  - `tag 2` = vatNumber
  - `tag 3` = timestamp (ISO)
  - `tag 4` = totalAmount (string, "0.00")
  - `tag 5` = vatAmount (string, "0.00")
- Base64 من tlvBuffer ← يُحوَّل إلى SVG عبر `qrcode`:
  - `errorCorrectionLevel: 'M'`, `margin: 1`, `width: 120`.

## 13. Pagination

- جميع قوائم CRUD تقبل `{ page, pageSize }`. عند غيابهما تُرجع الكل.
- الحد الأعلى لعدد الأسطر في قائمة الاشتراكات: `pageSize` يُقيَّد بين 1 و 100.

## 14. Upload / Size Limits

- Express body JSON/urlencoded: حتى **25 MB** (`limit: '25mb'`).
- الصور (منتجات + شعار): raw ≤ 15 MB قبل gzip.

## 15. Localization / Digits

- دوال التطبيع تستبدل كل من الأرقام العربية (U+0660..U+0669) والفارسية (U+06F0..U+06F9) بالـ ASCII.
- التواريخ تُخزَّن `DATE`/`DATETIME` وتُعرض بالواجهة بصيغ عربية (راجع `FIX_ARABIC_NUMBERS_IN_DATES.md` للتاريخ).

## 16. Error Codes الموحّدة

| Code | الحالة |
|------|--------|
| `NAME_DUPLICATE` | اسم عميل مستخدم مسبقًا |
| `PHONE_DUPLICATE` | رقم جوال مستخدم مسبقًا |
| `PHONE_INVALID` | رقم جوال فارغ/بدون أرقام |
| `PHONE_TOO_LONG` | طول الرقم > 32 بعد التطبيع |
| `ER_DUP_ENTRY` (من MySQL) | اسم مستخدم مكرر / تكرار price line |

## 17. Business Invariants (اختصار)

1. الرصيد `credit_remaining ≥ 0` دائمًا.
2. فترة واحدة `active` فقط لكل `customer_subscriptions`.
3. حركات `subscription_ledger` لا تُحذف (لا يوجد DELETE مباشر).
4. `orders.total_amount = subtotal - discount + vat_amount`، محسوبًا في الواجهة ومُرسَل كما هو.
5. فواتير التصدير/التقارير تعتمد على `price_display_mode` الخاص بالفاتورة، ليس الإعداد الحالي.
6. الخصم من الاشتراك لا يُقلّل `remaining_amount` من الفاتورة — هو استخدام رصيد موازٍ وليس سدادًا نقديًا.
