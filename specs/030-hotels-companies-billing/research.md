# Research: نظام فواتير الفنادق والشركات

**Date**: 2026-06-27
**Feature**: `030-hotels-companies-billing`

---

## Q1: هل يحتاج جدول `customers` أي تعديل؟

**Decision**: لا يحتاج أي تعديل في Schema.

**Rationale**:
- العمود `customer_type ENUM('individual','corporate')` موجود بالفعل منذ الإنشاء (db.js line 1262)
- العمود `tax_number VARCHAR(20)` موجود بالفعل — هذا هو الرقم الضريبي للشركة
- `createCustomer()` و `updateCustomer()` يقبلان ويخزنان `customerType` و `taxNumber` بالفعل
- شاشة العملاء تحتوي على `inputCustomerType` select و `inputTaxNumber` بالفعل

**ما يحتاج تعديل (UI فقط)**:
- جعل حقل `tax_number` بارزاً (إلزامي بصرياً) عند اختيار `corporate`
- إضافة تنبيه مرئي "الرقم الضريبي فارغ — ستصدر فاتورة مبسطة" للعميل الشركة بدون رقم ضريبي

---

## Q2: كيف يتم ترقيم أوامر التشغيل (D-XXX)؟

**Decision**: نفس نمط `invoice_seq` — `MAX(work_order_seq) + 1` مع `FOR UPDATE`.

**Rationale**:
- النمط القائم يضمن تسلسلاً بدون ثغرات وبأمان تحت الحمل المتوازي
- العمود `work_order_seq INT` على جدول `work_orders`، والرقم المعروض = `'D-' + seq`
- لا حاجة لجدول counter منفصل — نفس الأسلوب المستخدم في `createOrder`

---

## Q3: هل تُحفظ أصناف أمر التشغيل في جدول منفصل أم JSON؟

**Decision**: جدول `work_order_items` منفصل (لا JSON).

**Rationale**:
- يتوافق مع نمط `order_items` القائم في الكود
- يُمكّن الاستعلام والتجميع في الفاتورة المجمعة بـ SQL عادي
- يتجنب حساب المجاميع من JSON في التطبيق
- JSON يصعب الاستعلام عنه بـ MySQL 5.7

---

## Q4: كيف تُصدر الفاتورة المجمعة — سجل جديد في `orders` أم جدول منفصل؟

**Decision**: سجل في جدول `orders` الموجود مع عمود إضافي `is_consolidated`.

**Rationale**:
- تستفيد مباشرة من منطق `invoice_seq` الموجود (بدون إعادة اختراع)
- تظهر تلقائياً في شاشة الفواتير الموجودة
- تُرسل لـ ZATCA بنفس الآلية القائمة (scheduler)
- العمود `is_consolidated TINYINT(1) DEFAULT 0` يُضاف additive بـ migration

**ماذا تحتوي بنوده (order_items)**؟
- تُنسخ بنود أوامر التشغيل المضمَّنة إلى `order_items` عند إصدار الفاتورة
- كل بند يحمل `work_order_id` كـ reference (عمود اختياري جديد على `order_items`)

---

## Q5: هل يؤثر مسار POS على `createOrder` الموجود؟

**Decision**: لا يُمس `createOrder` — مسار أمر التشغيل مستقل تماماً.

**Rationale**:
- عند اختيار عميل `corporate` في POS، يتجاوز الكود مسار `createOrder` كلياً
- يستدعي بدلاً منه `createWorkOrder` (دالة جديدة في db.js)
- مسار الفرد يبقى بدون أي تغيير — صفر انحدار

**نقطة التفرع في pos.js**:
```
إذا state.selectedCustomer.customer_type === 'corporate'
  → createWorkOrder + طباعة أمر تشغيل
إذا غير ذلك
  → السلوك الحالي بدون تغيير
```

---

## Q6: كيف تُطبع الفاتورة المجمعة A4؟

**Decision**: تستخدم شاشة `invoice-a4` الموجودة مع بيانات موسّعة.

**Rationale**:
- شاشة `invoice-a4` تأخذ بياناتها من `localStorage.getItem('a4InvoiceData')`
- يمكن تمرير `isConsolidated: true` وقائمة أوامر التشغيل في نفس الكائن
- إضافة section جديدة في `invoice-a4.js` تُعيّن عند `isConsolidated === true`
- لا حاجة لشاشة A4 جديدة

---

## Q7: ما نوع الفاتورة ZATCA للفاتورة المجمعة؟

**Decision**: فاتورة ضريبية B2B (مع رقم الاشتراك في الضريبة) إذا توفّر `tax_number`، وفاتورة ضريبية مبسطة إذا لم يتوفر.

**Rationale**:
- القرار مبني على وجود/غياب `tax_number` في بيانات العميل
- هذا ما تفعله شاشة `invoice-a4` حالياً (line 3331 في pos.js: checks `custVat`)
- لا يحتاج منطق ZATCA جديد — يستخدم المسار القائم

---

## Q8: ماذا يحدث لبنود الفاتورة المجمعة في `order_items`؟

**Decision**: تُنسخ كل بنود أوامر التشغيل المحددة إلى `order_items` ضمن transaction.

**Rationale**:
- يضمن سلامة البيانات — الفاتورة تحتوي نسخة مجمّدة من البنود وقت الإصدار
- تتوافق مع بنية `order_items` الموجودة لا تحتاج تغيير schema على الجدول
- يُضاف عمود `work_order_id INT DEFAULT NULL` على `order_items` كـ reference اختياري

---

## الملخص التنفيذي

| القرار | الحل |
|--------|------|
| تعديل `customers` | بدون migration — UI تحسينات فقط |
| ترقيم أوامر التشغيل | `MAX(work_order_seq)+1 FOR UPDATE` → `D-{seq}` |
| تخزين البنود | جدول `work_order_items` منفصل |
| الفاتورة المجمعة | سجل في `orders` + عمود `is_consolidated` |
| مسار POS | تفرع بدون مساس `createOrder` |
| طباعة A4 | `invoice-a4` الموجود مع بيانات موسّعة |
| ZATCA نوع الفاتورة | B2B إذا وُجد `tax_number`، مبسطة إذا لم يوجد |
| بنود الفاتورة | نسخ من `work_order_items` إلى `order_items` داخل transaction |
