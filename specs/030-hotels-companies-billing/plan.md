# Implementation Plan: نظام فواتير الفنادق والشركات

**Branch**: `030-hotels-companies-billing` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/030-hotels-companies-billing/spec.md`

---

## Summary

إضافة دعم عملاء الشركات والفنادق عبر ثلاث مراحل متكاملة:
1. **أمر التشغيل**: من شاشة البيع الحالية — يُطبع ويُحفظ بترقيم D-XXX دون سداد أو ZATCA
2. **شاشة الفنادق والشركات**: جديدة — عرض/بحث/إلغاء أوامر التشغيل وإصدار الفاتورة المجمعة
3. **الفاتورة المجمعة**: سجل في `orders` برقم تسلسلي طبيعي + A4 + ZATCA

**الاكتشاف الرئيسي**: `customer_type` و `tax_number` موجودان بالفعل في جدول `customers` — لا migration مطلوبة للعملاء.

---

## Technical Context

**Language/Version**: Node.js 20 (CommonJS), Vanilla JS (no framework)

**Backend**: Express.js + `mysql2/promise` — no ORM

**Frontend**: Vanilla JS + Tailwind CSS — no bundler, no TypeScript

**Storage**: MySQL/MariaDB — InnoDB, utf8mb4, `DECIMAL(10,2)` for money

**MySQL Compatibility**: MySQL 5.7 — جميع SQL يجب أن تكون متوافقة مع MySQL 5.7.
لا window functions، لا CTEs، لا `LATERAL`. استخدم subqueries وderived tables.

**Target Platform**: Windows 10/11 — bundled as `.exe` via `@yao-pkg/pkg`

**Deployment**: Windows Service (NSSM) — single-tenant on-premise

**API Pattern**: `POST /api/invoke` → `invokeHandlers.js` → `db.js`

**Screen Pattern**: `screens/<feature>/<feature>.{html,js,css}` (self-contained)

**Constraints**: No ES modules server-side. No shared components across screens.

---

## Constitution Check

### Priority Order Compliance

| Priority | Concern | Impact on This Feature |
|----------|---------|----------------------|
| 1 | Data integrity | work_orders داخل transaction؛ createConsolidatedInvoice داخل transaction كاملة تنسخ البنود وتحدث الحالات atomically |
| 2 | ZATCA compliance | أوامر التشغيل لا تُرسل لـ ZATCA إطلاقاً؛ الفاتورة المجمعة تُرسل عبر الآلية القائمة بدون تعديل |
| 3 | Workflow stability | مسار POS للأفراد لا يُمس — التفرع للشركات يضيف كود جديد ولا يعدّل الموجود |
| 4 | Backward compatibility | جميع الإضافات additive؛ عمودا is_consolidated وwork_order_id بـ DEFAULT 0/NULL — جميع السجلات الحالية آمنة |
| 5 | Correct business behavior | حسابات الفاتورة المجمعة تتبع صيغة total=subtotal-discount+vat الثابتة |

### 4-Step API Checklist

| Method Name | db.js | invokeHandlers.js | web-api.js | Screen JS |
|-------------|-------|-------------------|------------|-----------|
| `createWorkOrder` | ☐ | ☐ | ☐ | ☐ (pos.js) |
| `getWorkOrders` | ☐ | ☐ | ☐ | ☐ (hotels-companies.js) |
| `cancelWorkOrder` | ☐ | ☐ | ☐ | ☐ (hotels-companies.js) |
| `getWorkOrderForPrint` | ☐ | ☐ | ☐ | ☐ (hotels-companies.js) |
| `createConsolidatedInvoice` | ☐ | ☐ | ☐ | ☐ (hotels-companies.js) |
| `getConsolidatedInvoiceForPrint` | ☐ | ☐ | ☐ | ☐ (hotels-companies.js) |
| `getCorporateCustomers` | ☐ | ☐ | ☐ | ☐ (hotels-companies.js) |

### Forbidden Changes Proximity

| # | Forbidden Area | Proximity | Mitigation |
|---|---------------|-----------|------------|
| 7 | ZATCA submission workflow | قريب | لا تعديل على الآلية — نفس columns على orders تُملأ بنفس الطريقة |
| 12 | createOrder في POS | قريب | التفرع يضيف كود جديد ولا يغير createOrder — فقط if(corporate) |

### MySQL 5.7 Compatibility

- [x] جميع SQL يستخدم MySQL 5.7 compatible syntax
- [x] لا window functions — نستخدم MAX() + subqueries
- [x] لا CTEs — نستخدم derived tables
- [x] FOR UPDATE للترقيم التسلسلي (متوافق 5.7)

---

## Feature Impact Checklist

| Area | Affected? | What Changes / What to Verify |
|------|-----------|-------------------------------|
| **Database** | ☑ Yes | جدولان جديدان + عمودان additive — try/catch + registered in db.initialize() |
| **POS Checkout** | ☑ Yes | إضافة تفرع if(corporate) — مسار الفرد لا يتغير؛ createOrder لا يُمس |
| **ZATCA** | ☑ Yes | الفاتورة المجمعة تُملأ ZATCA columns وتُرسل عبر الآلية القائمة |
| **Subscriptions** | ☐ No | لا علاقة بالاشتراكات |
| **Payments** | ☐ No | أوامر التشغيل لا تمر بمنطق السداد |
| **Printing** | ☑ Yes | طباعة حرارية لأمر التشغيل (76mm/margin:0 auto)؛ A4 للفاتورة المجمعة |
| **Backward Compatibility** | ☑ Yes | كل الإضافات additive؛ عملاء الأفراد والفواتير الحالية لا تتغير |

---

## Project Structure

### Documentation (this feature)

```text
specs/030-hotels-companies-billing/
├── plan.md              <- هذا الملف
├── spec.md
├── research.md
├── data-model.md
├── contracts/
│   └── api-methods.md
├── quickstart.md
└── tasks.md             <- /speckit-tasks
```

### Source Code (this feature)

```text
database/db.js
  migrations:
    migrateAddConsolidatedFlag()          -- ALTER orders ADD is_consolidated
    migrateAddWorkOrderRefOnItems()       -- ALTER order_items ADD work_order_id
    migrateCreateWorkOrders()             -- CREATE TABLE work_orders
    migrateCreateWorkOrderItems()         -- CREATE TABLE work_order_items + indexes
  query functions:
    createWorkOrder(data)
    getWorkOrders(filters)
    cancelWorkOrder({ workOrderId })
    getWorkOrderForPrint({ workOrderId })
    createConsolidatedInvoice(data)
    getConsolidatedInvoiceForPrint({ orderId })
    getCorporateCustomers(filters)

server/invokeHandlers.js
  -- 7 cases جديدة

assets/web-api.js
  -- 7 methods جديدة

screens/pos/pos.js
  -- تفرع if(corporate): إخفاء سداد + زر "طباعة أمر تشغيل" + createWorkOrder

screens/hotels-companies/
  hotels-companies.html   -- تبويبات + بحث + جدول الأوامر
  hotels-companies.js     -- المنطق الكامل
  hotels-companies.css    -- التنسيق

screens/invoice-a4/invoice-a4.js
  -- section إضافية عند isConsolidated=true
```

---

## تفاصيل التنفيذ الحرجة

### 1. تفرع POS

```js
// في pos.js — عند الضغط على زر الإتمام
const isCorporate = state.selectedCustomer?.customer_type === 'corporate';
if (isCorporate) {
  await handleWorkOrderFlow();   // مسار جديد
} else {
  await handleCheckout();        // المسار الحالي — لا يتغير
}
```

عند اختيار عميل corporate تُخفى أزرار (نقدي / بطاقة / آجل / مختلط) وتُظهر زر "طباعة أمر تشغيل" فقط.

### 2. Transaction `createConsolidatedInvoice`

```
BEGIN
1. SELECT work_orders WHERE id IN (...) AND status='pending' FOR UPDATE
2. تحقق: جميعها pending، جميعها لنفس العميل
3. احسب subtotal، discountAmount، vatAmount، totalAmount
4. SELECT COALESCE(MAX(invoice_seq),0) FROM orders FOR UPDATE → invoiceSeq+1
5. INSERT INTO orders (is_consolidated=1, ...)
6. INSERT INTO order_items (work_order_id=X, ...) من work_order_items
7. UPDATE work_orders SET status='invoiced', consolidated_order_id=?
COMMIT
```

### 3. طباعة أمر التشغيل الحرارية

- عرض `76mm`، `margin: 0 auto` — لا تغيير في القياسات
- العنوان "أمر تشغيل" بدلاً من "فاتورة ضريبية"
- الرقم "D-{seq}" بدلاً من invoice_seq
- لا QR Code ZATCA
- نمط `afterprint` القائم بدون تعديل

### 4. الفاتورة المجمعة A4

في `invoice-a4.js` عند `data.isConsolidated === true`:
- section "أوامر التشغيل المضمَّنة": D-XXX + تاريخ + مجموع لكل أمر
- البنود الكاملة في الجدول المعتاد
- اسم العميل = اسم الشركة
- الرقم الضريبي (إن وُجد)

### 5. تنبيه الرقم الضريبي

**شاشة العملاء**: عند corporate + tax_number فارغ → تنبيه أصفر مرئي فقط (لا يمنع الحفظ).

**شاشة الفنادق**: قبل إصدار الفاتورة لعميل بدون رقم ضريبي → modal تأكيد:
- "تأكيد — إصدار كفاتورة مبسطة" → يُرسل `confirmNoVat: true`
- "العودة لتحديث بيانات العميل" → يُغلق الـ modal

---

## Complexity Tracking

لا توجد مخالفات للـ Constitution — جميع القرارات تتبع الأنماط القائمة.
