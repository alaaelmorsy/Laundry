# Research: إيصالات الاستهلاك في تقرير الاشتراكات

## 1. جدول إيصالات الاستهلاك

**Decision**: الجدول `consumption_receipts` موجود ومكتمل — لا حاجة لتغيير قاعدة البيانات.

**الأعمدة ذات الصلة**:
```
id, receipt_seq, order_id, customer_id,
subscription_id, period_id, package_name,
amount_consumed, balance_before, balance_after,
items_json, notes, created_by, created_at,
cleaning_date, delivery_date
```

**Indexes موجودة**: `idx_cr_customer`, `idx_cr_subscription`, `idx_cr_created`

**Rationale**: الجدول مصمم مسبقًا للاستعلام حسب `subscription_id` وهو بالضبط ما نحتاجه.

---

## 2. الـ API الموجودة

### `getConsumptionReceipts` (invokeHandlers.js)
- يقبل `{ subscriptionId, customerId, page, pageSize, dateFrom, dateTo, search }`
- يُرجع `{ success, receipts, total, page, pageSize, totalPages }`
- **موجود ومناسب للاستخدام مباشرة** عبر تمرير `subscriptionId`

### `getConsumptionReceiptById` (invokeHandlers.js)
- يُرجع تفاصيل إيصال كامل بما فيها `items_json` و `customer` و `subscription`
- **مطلوب لعرض تفاصيل الإيصال** عند الضغط على "عرض الإيصال"

**Rationale**: نحتاج فقط تسجيل هاتين الـ methods في `web-api.js` إن لم تكونا مسجلتين بالفعل (التحقق مطلوب عند التنفيذ).

---

## 3. الشاشة التي تعرض تقرير الاشتراك (للعميل المحدد)

**Screen**: `screens/reports/subscriptions-report/subscriptions-report.js`

- تعرض قائمة الفترات لجميع الاشتراكات أو لعميل محدد
- يوجد `buildPdfHtmlForSubscriptionCustomerReport()` في `reportHtml.js` للتقرير PDF
- القسم الجديد يُضاف في:
  1. واجهة المستخدم (modal أو صفحة تفاصيل العميل إن وُجدت)
  2. PDF template في `buildPdfHtmlForSubscriptionCustomerReport`

**Action Required during impl**: تحديد الدالة التي تعرض التفاصيل للعميل المحدد وإضافة القسم فيها.

---

## 4. HTML الإيصال (نفس شاشة البيع)

**Decision**: الإيصال يُعرض بنفس HTML المستخدم في `screens/consumption-receipts/consumption-receipts.html` عبر `#crPaper`.

**الأسلوب المختار**: إعادة استخدام `getConsumptionReceiptById` لجلب البيانات ثم بناء HTML الإيصال من نفس template موجود في `consumption-receipts.html`.

**Approach**:
- إنشاء دالة `openConsumptionReceiptViewer(receiptId)` في شاشة الاشتراكات
- تجلب البيانات عبر `getConsumptionReceiptById`
- تفتح نافذة popup أو modal تحتوي على نفس HTML الإيصال الحراري من `consumption-receipts.html`

**Rationale**: هذا يضمن التطابق 100% بدون تكرار كود HTML — نفس العناصر، نفس CSS، نفس التنسيق.

**Alternatives considered**:
- إنشاء `buildConsumptionReceiptHtml()` في reportHtml.js: أكثر تعقيدًا وغير ضروري
- فتح `consumption-receipts.html` في iframe مع تمرير id: أبسط لكن قد يكون صعب للتحكم

---

## 5. بيانات موجودة في تقرير الاشتراك (للـ PDF)

الدالة `buildPdfHtmlForSubscriptionCustomerReport` تقبل `report` الذي يحتوي:
- `report.subscriptions` → جدول الاشتراكات
- `report.periods` → جدول الفترات  
- `report.ledger` → سجل الحركات
- `report.invoices` → الفواتير المرتبطة

**Decision**: إضافة `report.consumptionReceipts` كمصفوفة جديدة تُمرَّر من الـ API.

---

## 6. الـ API المطلوب تحديثه

الدالة في `db.js` التي تجلب بيانات تقرير الاشتراك للعميل (يُرجَّح أنها `getSubscriptionCustomerReport` أو مشابهة) تحتاج إضافة استعلام يجلب `consumption_receipts` حسب `subscription_id` وإضافتها لنتيجة الـ API.

---

## خلاصة القرارات

| القرار | الخيار المختار | السبب |
|--------|----------------|-------|
| قاعدة البيانات | لا تغيير | الجدول موجود |
| API الجلب | `getConsumptionReceipts({subscriptionId})` موجود | إعادة استخدام |
| عرض الإيصال | popup/modal بنفس HTML من consumption-receipts | تطابق 100% |
| PDF | إضافة section في `buildPdfHtmlForSubscriptionCustomerReport` | اتساق مع بقية الأقسام |
