# خطة: بحث موحد (فواتير آجلة + ايصالات استهلاك) في تبويبة الفواتير الآجلة بشاشة POS

## الهدف
تحويل خانة البحث في تبويبة **الفواتير الآجلة** (pos.js) لتجلب معاً:
- الفواتير الآجلة (من جدول `orders`)
- ايصالات الاستهلاك (من جدول `consumption_receipts`)

الغرض: يقدر الموظف يشوف **كل شغل العميل** (فواتير + ايصالات) ويعمل تنظيف وتسليم لهم من مكان واحد.

---

## الملفات المتأثرة

| الملف | الوظيفة |
|-------|---------|
| `database/db.js` | دالة `getDeferredOrders()` — تعديل البحث |
| `screens/pos/pos.js` | `searchDeferredInvoices()` + `renderDeferredTable()` |
| `screens/pos/pos.html` | إضافة عمود "النوع" في رأس الجدول (اختياري) |

---

## سيناريوهات البحث المطلوبة

| نوع البحث | مثال | النتيجة |
|-----------|------|---------|
| رقم فاتورة | `104` (رقم قصير) | فاتورة آجلة واحدة |
| رقم ايصال | `C-5` أو `c5` | ايصال استهلاك واحد |
| رقم جوال | `0555xxxxxxx` | فواتير آجلة + ايصالات للعميل |
| اسم عميل | `علاء` | فواتير آجلة + ايصالات للعميل |
| رقم اشتراك | `3` أو `SUB-3` | فواتير آجلة + ايصالات المشترك |

---

## التغييرات المطلوبة

### 1. `database/db.js` — تعديل `getDeferredOrders()`

#### أ) كشف نوع البحث

```js
const isReceiptSearch = /^C-?\d+$/i.test(trimmed);
const receiptSeq = isReceiptSearch ? Number(trimmed.replace(/\D/g, '')) : null;
```

#### ب) إذا كان البحث رقم ايصال (C-X)
→ ابحث في `consumption_receipts` فقط وأرجع النتيجة مع `rowType: 'receipt'`

#### ج) إذا كان البحث رقم جوال / اسم / اشتراك
→ نفّذ استعلامين بالتوازي (`Promise.all`):
1. الفواتير الآجلة (الاستعلام الحالي)
2. ايصالات الاستهلاك للعميل نفسه

#### د) دمج النتائج وإرجاعها
```js
return {
  success: true,
  orders: [
    ...invoiceRows.map(r => ({ ...r, rowType: 'invoice' })),
    ...receiptRows.map(r => ({ ...r, rowType: 'receipt' }))
  ]
};
```

#### هـ) استعلام ايصالات الاستهلاك
```sql
SELECT
  cr.id, cr.receipt_seq, cr.amount_consumed,
  cr.created_at, cr.cleaning_date, cr.delivery_date,
  cr.notes, cr.subscription_id,
  c.customer_name, c.phone, c.subscription_number,
  ref.id AS refund_id
FROM consumption_receipts cr
JOIN customers c ON c.id = cr.customer_id
LEFT JOIN refunds ref ON ref.consumption_receipt_id = cr.id
WHERE (c.phone LIKE ? OR c.customer_name LIKE ? OR c.subscription_number LIKE ?)
ORDER BY cr.created_at DESC
LIMIT 500
```

> **ملاحظة:** جدول `consumption_receipts` ليس عليه `cleaning_date` أو `delivery_date` حالياً.
> يجب إضافة هذين العمودين بـ `ALTER TABLE` أو إدارتهما من خلال جدول الـ `orders` المرتبط.

---

### 2. `screens/pos/pos.js` — تعديل `renderDeferredTable()`

#### صف فاتورة (rowType = 'invoice') — نفس العرض الحالي
```
| رقم الفاتورة | العميل | التاريخ | السداد | التنظيف | التسليم | المبلغ | الإجراءات |
| INV-104      | علاء  | ...    | ✓      | ...    | ...    | 100   | عرض | سداد | تنظيف | تسليم |
```

#### صف ايصال (rowType = 'receipt') — عرض مختلف
```
| رقم الايصال | العميل | التاريخ | — | التنظيف | التسليم | المبلغ | الإجراءات |
| C-5         | علاء  | ...    | — | ...    | ...    | 50    | عرض | تنظيف | تسليم |
```

- زر **سداد**: مخفي على صفوف الايصالات (مدفوعة باشتراك)
- زر **مرتجع**: مخفي (موجود في شاشة الايصالات)
- زر **تنظيف** و**تسليم**: موجودان في الاثنين

#### Badge تمييز النوع (اختياري)
```html
<!-- في خانة رقم الفاتورة -->
<span class="badge-invoice">فاتورة</span>   <!-- أزرق -->
<span class="badge-receipt">إيصال</span>    <!-- أخضر -->
```

---

### 3. إضافة `cleaning_date` و `delivery_date` لايصالات الاستهلاك

**الخيار أ (موصى به):** إضافة عمودين في جدول `consumption_receipts`
```sql
ALTER TABLE consumption_receipts
  ADD COLUMN cleaning_date DATETIME DEFAULT NULL,
  ADD COLUMN delivery_date DATETIME DEFAULT NULL;
```

**الخيار ب:** استخدام `cleaning_date` و `delivery_date` من جدول `orders` عبر `cr.order_id`
→ يعني نربط الايصال بالطلب الأصلي ونأخذ منه البيانات.

---

### 4. دوال التنظيف والتسليم للايصالات

نضيف في `db.js`:
```js
async function markReceiptCleaned(receiptId)  { ... }
async function markReceiptDelivered(receiptId) { ... }
```

وفي `pos.js` نضيف handlers:
```js
window._posMarkReceiptCleaned   = (id) => { ... }
window._posMarkReceiptDelivered = (id) => { ... }
```

---

## خطوات التنفيذ (بالترتيب)

1. **`db.js`** — إضافة `ALTER TABLE` لعمودي التنظيف/التسليم في `consumption_receipts`
2. **`db.js`** — تعديل `getDeferredOrders()` ليجلب الايصالات مع الفواتير
3. **`db.js`** — إضافة `markReceiptCleaned()` و `markReceiptDelivered()`
4. **`preload.js` / `main.js`** — تسجيل الدوال الجديدة في الـ API
5. **`pos.js`** — تعديل `renderDeferredTable()` لعرض صفين مختلفين
6. **`pos.js`** — إضافة handlers للتنظيف/التسليم على الايصالات

---

## ملاحظات مهمة

- الفلتر **"غير مدفوع"** يطبّق فقط على الفواتير، الايصالات دائماً مدفوعة (اشتراك)
- الفلتر **"تم التسليم"** يطبّق على الاثنين
- لو كان البحث فارغ → لا تُظهر ايصالات (لأن الايصالات ليس عليها `pending` payment)
