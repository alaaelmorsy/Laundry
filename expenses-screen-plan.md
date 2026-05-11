# خطة إضافة شاشة المصروفات - نظام المغسلة

## نظرة عامة

إضافة شاشة **المصروفات** كاملة لنظام المغسلة السعودي مع دعم ضريبة القيمة المضافة (VAT) بنسبة **15%** وفق لوائح هيئة الزكاة والضريبة والجمارك (ZATCA).

---

## هيكل المشروع الحالي

```
Laundry/
├── main.js                    ← Electron main process + IPC handlers
├── preload.js                 ← Context Bridge API
├── database/db.js             ← MySQL functions
├── assets/
│   ├── i18n.js                ← ترجمات عربي/إنجليزي
│   └── tailwind.css           ← CSS مُجمَّع
└── screens/
    ├── dashboard/             ← الشاشة الرئيسية (الكروت)
    ├── customers/             ← نموذج مرجعي للتصميم
    ├── users/
    └── login/
```

---

## الملفات التي ستُعدَّل أو تُنشأ

| الملف | نوع العملية |
|-------|-------------|
| `database/db.js` | **تعديل** - إضافة جدول ودوال المصروفات |
| `main.js` | **تعديل** - إضافة IPC handlers |
| `preload.js` | **تعديل** - إضافة API للمصروفات |
| `screens/dashboard/dashboard.html` | **تعديل** - إضافة كرت المصروفات |
| `assets/i18n.js` | **تعديل** - إضافة ترجمات عربي/إنجليزي |
| `screens/expenses/expenses.html` | **إنشاء جديد** |
| `screens/expenses/expenses.js` | **إنشاء جديد** |
| `screens/expenses/expenses.css` | **إنشاء جديد** |

---

## الخطوة 1 — قاعدة البيانات (`database/db.js`)

### 1.1 إضافة جدول `expenses` في دالة `createTables()`

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  category      VARCHAR(100) NOT NULL DEFAULT 'عام',
  amount        DECIMAL(10,2) NOT NULL,
  is_taxable    TINYINT(1) DEFAULT 0,
  tax_rate      DECIMAL(5,2) DEFAULT 15.00,
  tax_amount    DECIMAL(10,2) DEFAULT 0.00,
  total_amount  DECIMAL(10,2) NOT NULL,
  expense_date  DATE NOT NULL,
  notes         TEXT DEFAULT NULL,
  created_by    VARCHAR(100) DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

**منطق الحساب:**
- إذا `is_taxable = 1`: `tax_amount = amount × 0.15`، `total_amount = amount + tax_amount`
- إذا `is_taxable = 0`: `tax_amount = 0`، `total_amount = amount`

### 1.2 إضافة الدوال في `db.js`

```js
async function getAllExpenses(filters = {})
async function getExpensesSummary()      // إجمالي المبالغ والضرائب
async function createExpense(data)
async function updateExpense(data)
async function deleteExpense(id)
```

### 1.3 تصدير الدوال الجديدة في `module.exports`

```js
module.exports = {
  // ... الموجودة حالياً ...
  getAllExpenses, getExpensesSummary, createExpense, updateExpense, deleteExpense
};
```

---

## الخطوة 2 — IPC Handlers (`main.js`)

إضافة المعالجات التالية باتباع نفس النمط الموجود:

```js
ipcMain.handle('get-expenses', async (event, filters) => { ... })
ipcMain.handle('get-expenses-summary', async () => { ... })
ipcMain.handle('create-expense', async (event, data) => { ... })
ipcMain.handle('update-expense', async (event, data) => { ... })
ipcMain.handle('delete-expense', async (event, { id }) => { ... })
```

---

## الخطوة 3 — Context Bridge (`preload.js`)

إضافة الدوال إلى `contextBridge.exposeInMainWorld('api', { ... })`:

```js
getExpenses: (filters) => ipcRenderer.invoke('get-expenses', filters),
getExpensesSummary: () => ipcRenderer.invoke('get-expenses-summary'),
createExpense: (data) => ipcRenderer.invoke('create-expense', data),
updateExpense: (data) => ipcRenderer.invoke('update-expense', data),
deleteExpense: (data) => ipcRenderer.invoke('delete-expense', data),
```

---

## الخطوة 4 — كرت الداشبورد (`screens/dashboard/dashboard.html`)

إضافة كرت جديد في شبكة الكروت (`grid grid-cols-4`):

```html
<div class="menu-card" data-screen="expenses">
  <div class="card-icon" style="background:linear-gradient(135deg,#f43f5e,#e11d48)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  </div>
  <h3 class="card-title" data-i18n="card-expenses-title">المصروفات</h3>
  <p class="card-desc" data-i18n="card-expenses-desc">متابعة وإدارة المصروفات</p>
</div>
```

---

## الخطوة 5 — الترجمات (`assets/i18n.js`)

### Arabic (`ar`):

```js
'card-expenses-title': 'المصروفات',
'card-expenses-desc': 'متابعة وإدارة المصروفات',
'page-title-expenses': 'المصروفات - نظام المغسلة',
'expenses-header-title': 'إدارة المصروفات',
'expenses-back': 'العودة',
'expenses-search-placeholder': 'بحث بالعنوان أو الفئة...',
'expenses-btn-add': 'إضافة مصروف',
'expenses-col-title': 'العنوان',
'expenses-col-category': 'الفئة',
'expenses-col-date': 'التاريخ',
'expenses-col-amount': 'المبلغ',
'expenses-col-taxable': 'خاضع للضريبة',
'expenses-col-tax': 'الضريبة (15%)',
'expenses-col-total': 'الإجمالي',
'expenses-col-actions': 'الإجراءات',
'expenses-taxable-yes': 'نعم',
'expenses-taxable-no': 'لا',
'expenses-summary-total-before': 'إجمالي المصروفات (قبل الضريبة)',
'expenses-summary-tax': 'إجمالي الضريبة (15%)',
'expenses-summary-grand-total': 'الإجمالي الكلي',
'expenses-modal-add-title': 'إضافة مصروف جديد',
'expenses-modal-edit-title': 'تعديل المصروف',
'expenses-label-title': 'عنوان المصروف',
'expenses-placeholder-title': 'مثال: إيجار المحل',
'expenses-label-category': 'الفئة',
'expenses-placeholder-category': 'مثال: إيجار، رواتب، مواد...',
'expenses-label-amount': 'المبلغ (ريال)',
'expenses-placeholder-amount': '0.00',
'expenses-label-date': 'تاريخ المصروف',
'expenses-label-is-taxable': 'خاضع لضريبة القيمة المضافة (15%)',
'expenses-tax-preview': 'قيمة الضريبة',
'expenses-total-preview': 'الإجمالي بعد الضريبة',
'expenses-label-notes': 'ملاحظات',
'expenses-placeholder-notes': 'أي ملاحظات إضافية...',
'expenses-btn-save': 'حفظ',
'expenses-btn-cancel': 'إلغاء',
'expenses-btn-edit-title': 'تعديل',
'expenses-btn-delete-title': 'حذف',
'expenses-confirm-delete': 'هل تريد حذف المصروف "{name}"؟',
'expenses-empty': 'لا توجد مصروفات مسجلة',
'expenses-err-title': 'يرجى إدخال عنوان المصروف',
'expenses-err-amount': 'يرجى إدخال مبلغ صحيح',
'expenses-err-date': 'يرجى إدخال تاريخ المصروف',
'expenses-err-category': 'يرجى إدخال فئة المصروف',
'expenses-success-add': 'تم إضافة المصروف بنجاح',
'expenses-success-update': 'تم تعديل المصروف بنجاح',
'expenses-success-delete': 'تم حذف المصروف بنجاح',
'expenses-err-delete': 'حدث خطأ أثناء الحذف',
'expenses-err-load': 'حدث خطأ أثناء تحميل البيانات',
'expenses-err-db': 'خطأ في الاتصال بقاعدة البيانات',
'expenses-err-generic': 'حدث خطأ غير متوقع',
```

### English (`en`) — نفس المفاتيح بالإنجليزية:

```js
'card-expenses-title': 'Expenses',
'card-expenses-desc': 'Track and manage expenses',
'page-title-expenses': 'Expenses - Laundry System',
// ... إلخ
```

---

## الخطوة 6 — شاشة المصروفات HTML (`screens/expenses/expenses.html`)

### هيكل الصفحة:

```
┌─────────────────────────────────────────────────────┐
│  HEADER: [← رجوع] [شعار] [أزرار النافذة]           │
├─────────────────────────────────────────────────────┤
│  SUMMARY CARDS (3 بطاقات):                          │
│  [إجمالي المصروفات] [إجمالي الضريبة] [الإجمالي الكلي]│
├─────────────────────────────────────────────────────┤
│  TOOLBAR: [بحث] [فلتر تاريخ من/إلى] [+ إضافة]      │
├─────────────────────────────────────────────────────┤
│  TABLE:                                             │
│  العنوان | الفئة | التاريخ | المبلغ | ضريبة؟ |      │
│  الضريبة | الإجمالي | الإجراءات                     │
├─────────────────────────────────────────────────────┤
│  MODAL: نموذج الإضافة/التعديل                       │
│  CONFIRM DIALOG: تأكيد الحذف                        │
│  TOAST: رسائل النجاح/الخطأ                          │
└─────────────────────────────────────────────────────┘
```

### حقول المودال:

| الحقل | النوع | ملاحظة |
|-------|-------|---------|
| `title` | text | مطلوب |
| `category` | text | مطلوب (مع اقتراحات: إيجار، رواتب، كهرباء، ماء، مواد تنظيف، صيانة، أخرى) |
| `expense_date` | date | مطلوب، افتراضي اليوم |
| `amount` | number | مطلوب، موجب |
| `is_taxable` | checkbox | مربع تحديد - هل تطبق الضريبة؟ |
| **tax_preview** | readonly | يظهر عند تفعيل is_taxable: `المبلغ × 0.15` |
| **total_preview** | readonly | `المبلغ + الضريبة` |
| `notes` | textarea | اختياري |

### منطق حساب الضريبة في الـ UI:

```
عند تغيير amount أو is_taxable:
  إذا is_taxable مُفعَّل:
    tax_amount  = amount × 0.15
    total       = amount × 1.15
    اعرض قسم الضريبة
  إذا is_taxable غير مُفعَّل:
    tax_amount  = 0
    total       = amount
    أخفِ قسم الضريبة
```

---

## الخطوة 7 — منطق JavaScript (`screens/expenses/expenses.js`)

### الدوال الرئيسية:

```js
loadExpenses()         // تحميل كل المصروفات من DB
loadSummary()          // تحميل الإجماليات (بطاقات الملخص)
renderTable(expenses, search)   // رسم الجدول مع الفلترة
openModal(expense)     // فتح مودال الإضافة أو التعديل
closeModal()
saveExpense()          // إضافة أو تعديل (validate → calculate → save)
deleteExpense(id, name)
calculateTax()         // حساب الضريبة لحظياً عند تغيير الحقول
showToast(msg, type)   // نفس نمط customers.js
escHtml(str)
```

### التحقق من البيانات (Validation):

```js
if (!title.trim())          → خطأ: "يرجى إدخال عنوان المصروف"
if (amount <= 0 || isNaN)   → خطأ: "يرجى إدخال مبلغ صحيح"
if (!date)                  → خطأ: "يرجى إدخال تاريخ المصروف"
if (!category.trim())       → خطأ: "يرجى إدخال فئة المصروف"
```

---

## الخطوة 8 — CSS (`screens/expenses/expenses.css`)

اتبع نفس نمط ملف `customers.html` (inline CSS) أو ملف CSS منفصل، مع إضافة:

```css
/* بطاقات الملخص */
.summary-card { ... }
.summary-card.total-before  { border-right: 4px solid #6366f1; }
.summary-card.total-tax     { border-right: 4px solid #f59e0b; }
.summary-card.grand-total   { border-right: 4px solid #10b981; }

/* شارة خاضع/غير خاضع للضريبة */
.badge-taxable   { background: rgba(245,158,11,.1); color:#d97706; }
.badge-no-tax    { background: rgba(100,116,139,.1); color:#64748b; }

/* معاينة الضريبة في المودال */
.tax-preview-box { 
  background: #fefce8;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 12px;
}
```

---

## تدفق البيانات الكامل

```
[expenses.html]
     │
     │  window.api.getExpenses()
     ▼
[preload.js]  →  ipcRenderer.invoke('get-expenses')
     │
     ▼
[main.js]  →  ipcMain.handle('get-expenses')
     │
     ▼
[database/db.js]  →  getAllExpenses()  →  MySQL query
     │
     ▼
[expenses] returned back to screen → renderTable()
```

---

## ترتيب التنفيذ المقترح

1. **`database/db.js`** — إضافة الجدول والدوال أولاً
2. **`main.js`** — إضافة IPC handlers
3. **`preload.js`** — تعريض الـ API
4. **`assets/i18n.js`** — إضافة الترجمات
5. **`screens/dashboard/dashboard.html`** — إضافة الكرت
6. **`screens/expenses/expenses.html`** — بناء الشاشة
7. **`screens/expenses/expenses.js`** — منطق الشاشة
8. **`screens/expenses/expenses.css`** — التنسيق

---

## التحقق من الصحة (Verification)

1. تشغيل التطبيق: `npm start` أو `npx electron .`
2. تسجيل الدخول بـ `admin / admin123`
3. التحقق من ظهور كرت **المصروفات** في الداشبورد
4. الضغط على الكرت والتأكد من فتح الشاشة
5. إضافة مصروف **بدون ضريبة** والتحقق من `total = amount`
6. إضافة مصروف **مع ضريبة** والتحقق من `tax = amount × 0.15`، `total = amount × 1.15`
7. التحقق من صحة بطاقات الملخص في أعلى الشاشة
8. تعديل مصروف والتحقق من تحديث البيانات
9. حذف مصروف والتحقق من ظهور رسالة التأكيد
10. اختبار البحث والفلترة
11. اختبار تبديل اللغة (AR/EN)
