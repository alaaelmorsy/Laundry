# خطة: الدفع الجزئي للفواتير الآجلة (Partial Payments)

## 1. الهدف
إعادة تصميم تجربة "سداد الفاتورة الآجلة" في شاشة POS (تبويب الفواتير الآجلة) بحيث يمكن دفع الفاتورة على دفعات متعددة، مع حفظ كل دفعة في قاعدة البيانات وعرض الدفعات السابقة في نفس نافذة السداد، وربط شاشة السداد المستقلة (`screens/payment/`) بواجهة IPC الفعلية لعرض سجل الدفعات باحترافية.

## 2. الوضع الحالي
- المودال الحالي `payDeferredModal` في [./screens/pos/pos.html:341](./screens/pos/pos.html#L341) يسمح فقط بسداد كامل المبلغ مع اختيار طريقة الدفع.
- الحفظ يتم عبر [./screens/pos/pos.js:2263](./screens/pos/pos.js#L2263) → `window.api.payDeferredOrder` → [./server/invokeHandlers.js:629](./server/invokeHandlers.js#L629) → `db.payDeferredOrder` الذي يضع `payment_status='paid'` دفعة واحدة.
- جدول `invoice_payments` ودوال `recordInvoicePayment` / `getInvoiceWithPayments` / `getPaymentHistory` موجودة بالفعل في [./database/db.js:2551](./database/db.js#L2551) ومُصدَّرة، لكنها غير موصولة بـ IPC ولا بالواجهة.
- شاشة الدفع المستقلة [./screens/payment/payment.html](./screens/payment/payment.html) تستخدم `webAPI.get` / `webAPI.post` لمسارات REST (`/api/invoice/:id/payments`, `/api/invoice/:id/payment`) وهذه المسارات غير معرّفة في Express، لذا الشاشة معطّلة حالياً.
- استعلام `getDeferredOrders` يجلب فقط `payment_status='pending'` ولا يُرجع `paid_amount` / `remaining_amount`.

## 3. التغييرات المطلوبة

### 3.1 الطبقة الخلفية — [./database/db.js](./database/db.js)
- **تعديل `getDeferredOrders`** ليعيد أيضاً الحقول: `paid_amount`, `remaining_amount`, `fully_paid_at`, ويشمل الفواتير ذات `payment_status IN ('pending','partial')`. الترتيب الافتراضي: الجزئية أولاً ثم المعلّقة حسب الأحدث.
- لا تغييرات هيكلية مطلوبة — الجداول والأعمدة مُهيَّأة عبر `migratePartialInvoicePayments`.

### 3.2 معالجات IPC — [./server/invokeHandlers.js](./server/invokeHandlers.js)
إضافة ثلاث حالات جديدة مع نفس نمط معالجة الأخطاء المستخدم:
```js
case 'getInvoiceWithPayments': {
  try { return await db.getInvoiceWithPayments(payload && payload.orderId); }
  catch (err) { return { success: false, message: err.message, code: err.appCode }; }
}
case 'recordInvoicePayment': {
  try {
    const user = (req && req.session && req.session.user) || {};
    return await db.recordInvoicePayment({
      orderId: payload.orderId,
      paymentAmount: payload.paymentAmount,
      paymentMethod: payload.paymentMethod,
      notes: payload.notes,
      createdBy: user.username || user.name || 'system',
    });
  } catch (err) { return { success: false, message: err.message, code: err.appCode }; }
}
case 'getPaymentHistory': {
  try { return { success: true, payments: await db.getPaymentHistory(payload.orderId) }; }
  catch (err) { return { success: false, message: err.message, code: err.appCode }; }
}
```
ملاحظة: التحقق من توقيع دالة `invoke` الحالية لاستخراج المستخدم من الجلسة (تقليد استخدام الجلسة في الحالات المجاورة عند الحاجة).

### 3.3 واجهة window.api — [./assets/web-api.js](./assets/web-api.js)
إضافة بعد السطر 243:
```js
getInvoiceWithPayments: (data) => invoke('getInvoiceWithPayments', data),
recordInvoicePayment:   (data) => invoke('recordInvoicePayment',   data),
getPaymentHistory:      (data) => invoke('getPaymentHistory',      data),
```

### 3.4 إعادة تصميم مودال السداد — [./screens/pos/pos.html](./screens/pos/pos.html)
استبدال البلوك `#payDeferredModal` (السطور 341–394) بنافذة احترافية مكبّرة بتبويبين داخليين:

**الرأس**: أيقونة بطاقة + عنوان "سداد الفاتورة الآجلة" + زر إغلاق.

**ملخص الفاتورة (Summary Grid)** — ثلاث بطاقات عمودية ملوّنة:
- الإجمالي (أزرق فاتح)
- المدفوع (أخضر)
- المتبقي (برتقالي/أحمر حسب الحالة) — يتحدّث فورياً عند إدخال المبلغ.

بالإضافة إلى صف معلومات: رقم الفاتورة • العميل • الجوال • الحالة (شارة ملوّنة: `pending` / `partial` / `paid`).

**نموذج الدفعة**:
- حقل رقمي `payAmount` مع شارة العملة، يدعم الفواصل العشرية.
- أزرار نسبية سريعة: `25%` `50%` `75%` `المبلغ كاملاً` (تملأ الحقل من `remaining_amount`).
- شبكة أزرار طرق الدفع (Cards شكل Tiles) — نقداً / شبكة / تحويل / مختلط (تقرأ من `state.appSettings.enabledPaymentMethods` مع استبعاد `credit`).
- حقل ملاحظات اختياري.
- سطر تأكيد ديناميكي أسفل الحقل: "بعد هذه الدفعة سيتبقّى: X.XX" (يتغيّر لحظياً).

**سجل الدفعات السابقة** داخل نفس المودال — جدول مضغوط (التاريخ، المبلغ، الطريقة، المستخدم، ملاحظات) يظهر فقط إذا كانت `payments.length > 0`. ارتفاع محدود مع scroll داخلي.

**الأزرار السفلية**: إلغاء • تأكيد الدفعة (الزر الرئيسي) + حالة تحميل (spinner) أثناء الحفظ.

### 3.5 منطق المودال — [./screens/pos/pos.js](./screens/pos/pos.js)
تعديل `openPayDeferredModal(orderId)` (السطر 2230) و`confirmPayDeferred` (السطر 2263):

- عند الفتح: استدعاء `window.api.getInvoiceWithPayments({ orderId })` لجلب أحدث أرقام الفاتورة + سجل الدفعات، وتعبئة الـ DOM. الافتراضي في خانة المبلغ = `remaining_amount`.
- ربط حدث `input` على `payAmount`: تحقق المبلغ `>0` و`<=remaining`، تحديث سطر "المتبقي بعد الدفعة"، تفعيل/تعطيل زر التأكيد.
- ربط أزرار النسب السريعة (`25/50/75/100`).
- ربط أزرار طرق الدفع (toggle selected class).
- `confirmPayDeferred` الجديد:
  ```js
  const res = await window.api.recordInvoicePayment({
    orderId, paymentAmount: amount, paymentMethod, notes
  });
  ```
  - عند النجاح: `showTopToast('تم تسجيل الدفعة بنجاح')`، إعادة تحميل بيانات المودال من `getInvoiceWithPayments` (لتظهر الدفعة في السجل)، إذا أصبح `payment_status === 'paid'` → إغلاق المودال بعد ثانية، وإلا إبقاؤه مفتوحاً لسداد جزء آخر.
  - في كل الحالات: تحديث `state.deferredInvoices[i]` (paid_amount, remaining_amount, payment_status) وإعادة `renderDeferredTable()`.
- إبقاء `payDeferredOrder` كما هو للتوافق الخلفي (لن يُستخدم بعد الآن، لكن لا يحذف في هذا التغيير).

### 3.6 عرض الفواتير الجزئية في التبويب — [./screens/pos/pos.js](./screens/pos/pos.js)
- في `renderDeferredTable` / بطاقات الفاتورة: إظهار شارة "جزئية" + سطر صغير "مدفوع X من Y" عندما `payment_status === 'partial'`. يعتمد على الحقول الجديدة التي يُرجعها `getDeferredOrders` بعد التعديل.
- زر "الدفع" يعمل للحالتين `pending` و`partial`.

### 3.7 تنسيق المودال الجديد — [./screens/pos/pos.css](./screens/pos/pos.css)
- توسيع `.modal-pay-deferred` إلى `max-width: 680px` (`min(680px, 94vw)`).
- بطاقات الملخّص: `display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;` مع ألوان مميّزة لكل بطاقة وخط عريض للأرقام.
- أزرار النسب: مجموعة أزرار دائرية صغيرة (pill buttons) مع تأثير hover.
- طرق الدفع: شبكة Tiles 2×2 أو 4×1 مع أيقونة + تسمية، الحالة `selected` بإطار وخلفية بارزة.
- جدول السجل: جدول مضغوط بصفوف متناوبة (zebra) وحدود خفيفة، scroll عمودي (`max-height: 180px`).
- تصميم Responsive (نقطة توقف 640px): الملخص يصبح عموداً واحداً، طرق الدفع 2×2.
- الحفاظ على اتجاه RTL وخطوط ومفردات التصميم الحالية (المتغيرات اللونية والحواف والظلال المستخدمة في بقية الملف).

### 3.8 ربط شاشة الدفع المستقلة — [./screens/payment/payment.js](./screens/payment/payment.js)
استبدال استدعاءات `webAPI.get/post` غير الموجودة بـ `window.api` الفعلي:
- `loadInvoiceData` → `await window.api.getInvoiceWithPayments({ orderId: state.orderId })`.
- `confirmPayment` → `await window.api.recordInvoicePayment({ orderId, paymentAmount, paymentMethod, notes })`.
- استبدال `confirm(...)` بمودال تأكيد أنيق (اختياري) أو إبقاؤه مؤقتاً.
- إضافة طريقة الدفع `mixed` إذا مفعّلة في الإعدادات.
- الحفاظ على تنسيقات `payment.css` كما هي (الشاشة احترافية أصلاً).

### 3.9 ترجمات جديدة — [./assets/i18n.js](./assets/i18n.js)
إضافة المفاتيح:
```
pos-deferred-pay-amount: "مبلغ الدفعة" / "Payment amount"
pos-deferred-pay-full:   "المبلغ كاملاً" / "Full amount"
pos-deferred-remaining-after: "المتبقي بعد هذه الدفعة" / "Remaining after payment"
pos-deferred-payments-history: "سجل الدفعات" / "Payment history"
pos-deferred-no-payments: "لا توجد دفعات سابقة" / "No previous payments"
pos-deferred-partial-badge: "جزئية" / "Partial"
pos-deferred-paid-of-total: "مدفوع {paid} من {total}" / "{paid} of {total} paid"
pos-deferred-payment-saved: "تم تسجيل الدفعة بنجاح" / "Payment recorded successfully"
pos-deferred-notes: "ملاحظات (اختياري)" / "Notes (optional)"
```
اتباع النمط الموجود للمفاتيح `pos-deferred-*`.

## 4. الملفات المتأثرة (مرجع سريع)
| الملف | نوع التغيير |
|------|-------------|
| `database/db.js` | تعديل `getDeferredOrders` فقط (لا Schema) |
| `server/invokeHandlers.js` | +3 حالات IPC |
| `assets/web-api.js` | +3 دوال |
| `assets/i18n.js` | +مفاتيح ترجمة |
| `screens/pos/pos.html` | استبدال مودال `#payDeferredModal` |
| `screens/pos/pos.js` | إعادة كتابة فتح/تأكيد المودال + تعديل Render |
| `screens/pos/pos.css` | أنماط المودال الجديد |
| `screens/payment/payment.js` | استبدال REST → `window.api` |

## 5. التحقق من النتيجة (Verification)
1. **تشغيل الخادم**: `npm start` ثم فتح `http://localhost:PORT/screens/login/login.html`.
2. **تحضير بيانات**: إنشاء فاتورة POS بطريقة دفع "آجل" بمبلغ 100.
3. **اختبار الدفع الجزئي**: 
   - من تبويب الفواتير الآجلة، افتح المودال — تأكد أن الإجمالي=100 المدفوع=0 المتبقي=100.
   - أدخل 30 + نقداً + احفظ → يجب أن يظهر في "سجل الدفعات" داخل المودال فوراً، والمتبقي=70، والحالة تصبح "جزئية".
   - أغلق وافتح المودال مرة أخرى — يجب أن تبقى الدفعة السابقة مرئية والأرقام محفوظة.
   - أدخل 70 + شبكة + احفظ → الحالة تصبح "مدفوعة" والمودال يُغلق تلقائياً.
4. **التحقق من قاعدة البيانات**:
   ```sql
   SELECT id, total_amount, paid_amount, remaining_amount, payment_status, fully_paid_at FROM orders WHERE id=?;
   SELECT * FROM invoice_payments WHERE order_id=? ORDER BY payment_date;
   ```
   يجب وجود صفّين في `invoice_payments` وإجماليهما = `total_amount`.
5. **شاشة السداد المستقلة**: فتح `/screens/payment/payment.html?id=<orderId>` — تعرض نفس الأرقام وسجل الدفعات.
6. **حالات الخطأ**: محاولة دفع مبلغ > المتبقي → رسالة خطأ واضحة. محاولة دفع 0 أو سالب → منع + رسالة.
7. **Lint**: `npm run lint` إن وجد؛ وإلا تحقّق يدوي من Console عدم وجود أخطاء JS.

## 6. نقاط خارج النطاق (Out of scope)
- لا تغيير في طباعة الفاتورة A4 / إيصال POS (يمكن لاحقاً إضافة قائمة الدفعات إليها).
- لا إضافة تقارير دفعات جديدة في لوحة التحكم.
- لا تغيير على مسار `payDeferredOrder` القديم (يبقى للتوافق؛ يمكن حذفه لاحقاً).
