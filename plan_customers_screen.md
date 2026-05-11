# خطة شاشة إدارة العملاء - نظام المغسلة

## نظرة عامة
إضافة شاشة كاملة لإدارة العملاء في برنامج المغسلة السعودي (Electron + MySQL + Cairo font + Dark theme RTL).

**ملاحظة مهمة**: بطاقة "العملاء" موجودة بالفعل في `dashboard.html` (`data-screen="customers"`) — لا يلزم تعديل لوحة التحكم.

---

## الملفات التي ستُعدَّل / تُنشأ

| الملف | الحالة | الوصف |
|-------|--------|-------|
| `database/db.js` | تعديل | إضافة جدول customers + CRUD functions |
| `main.js` | تعديل | إضافة IPC handlers للعملاء |
| `preload.js` | تعديل | كشف API للعملاء عبر contextBridge |
| `assets/i18n.js` | تعديل | إضافة مفاتيح الترجمة العربية والإنجليزية |
| `screens/customers/customers.html` | جديد | هيكل الشاشة |
| `screens/customers/customers.js` | جديد | منطق الشاشة |
| `screens/customers/customers.css` | جديد | تنسيق الشاشة (مطابق لـ users.css مع إضافات) |

---

## 1. قاعدة البيانات — `database/db.js`

### جدول customers
```sql
CREATE TABLE IF NOT EXISTS customers (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  subscription_number VARCHAR(20)  NOT NULL UNIQUE,
  customer_name       VARCHAR(100) NOT NULL,
  phone               VARCHAR(15)  NOT NULL,
  tax_number          VARCHAR(20)  DEFAULT NULL,
  national_id         VARCHAR(20)  DEFAULT NULL,
  address             TEXT         NOT NULL,
  city                VARCHAR(60)  NOT NULL,
  email               VARCHAR(100) DEFAULT NULL,
  customer_type       ENUM('individual','corporate') DEFAULT 'individual',
  notes               TEXT         DEFAULT NULL,
  is_active           TINYINT(1)   DEFAULT 1,
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### رقم الاشتراك
يُولَّد تلقائياً بعد الإدراج: `'CUS-' + String(insertId).padStart(6, '0')`  
مثال: `CUS-000001`, `CUS-000002`

### الدوال المضافة
- `getAllCustomers()` — جلب كل العملاء مرتبين بـ id
- `createCustomer(data)` — إدراج ثم تحديث subscription_number
- `updateCustomer(data)` — تحديث بيانات العميل
- `toggleCustomerStatus(id, isActive)` — تفعيل/إيقاف
- `deleteCustomer(id)` — حذف

تُضاف إلى `module.exports`.

---

## 2. معالجات IPC — `main.js`

تُضاف بعد آخر `ipcMain.handle('delete-user', ...)`:

- `'get-customers'` → `db.getAllCustomers()`
- `'create-customer'` → `db.createCustomer(data)`
- `'update-customer'` → `db.updateCustomer(data)`
- `'toggle-customer-status'` → `db.toggleCustomerStatus(id, isActive)`
- `'delete-customer'` → `db.deleteCustomer(id)`

---

## 3. Preload — `preload.js`

تُضاف بعد `deleteUser`:

```js
getCustomers:         ()     => ipcRenderer.invoke('get-customers'),
createCustomer:       (data) => ipcRenderer.invoke('create-customer', data),
updateCustomer:       (data) => ipcRenderer.invoke('update-customer', data),
toggleCustomerStatus: (data) => ipcRenderer.invoke('toggle-customer-status', data),
deleteCustomer:       (data) => ipcRenderer.invoke('delete-customer', data),
```

---

## 4. مفاتيح الترجمة — `assets/i18n.js`

**مفاتيح عربية وإنجليزية** لتُضاف في قسمَي `ar` و`en`:

```
customers-header-title, customers-back, customers-search-placeholder,
customers-btn-add, customers-col-sub, customers-col-name, customers-col-phone,
customers-col-type, customers-col-city, customers-col-status, customers-col-date,
customers-col-actions, customers-loading, customers-empty,
customers-modal-add-title, customers-modal-edit-title,
customers-label-sub, customers-placeholder-sub,
customers-label-name, customers-placeholder-name,
customers-label-phone, customers-placeholder-phone,
customers-label-city, customers-placeholder-city,
customers-label-address, customers-placeholder-address,
customers-label-type, customers-type-individual, customers-type-corporate,
customers-label-national-id, customers-placeholder-national-id,
customers-label-tax, customers-placeholder-tax,
customers-label-email, customers-placeholder-email,
customers-label-status, customers-status-active, customers-status-inactive,
customers-label-notes, customers-placeholder-notes,
customers-btn-cancel, customers-btn-save, customers-btn-delete,
customers-btn-edit-title, customers-btn-deactivate-title, customers-btn-activate-title,
customers-confirm-title, customers-confirm-msg,
customers-err-load, customers-err-db, customers-err-name, customers-err-phone,
customers-err-city, customers-err-address, customers-err-unexpected,
customers-success-add, customers-success-update, customers-success-delete,
customers-success-activate, customers-success-deactivate,
customers-err-delete, customers-err-generic,
page-title-customers
```

---

## 5. `screens/customers/customers.html`

**نفس هيكل `users.html` تماماً** مع:
- جدول بـ 8 أعمدة: رقم الاشتراك، الاسم، الجوال، النوع، المدينة، الحالة، تاريخ التسجيل، الإجراءات
- مودال بشبكة عمودين (`form-grid`) تحتوي على:
  - رقم الاشتراك (للقراءة فقط — يُولَّد تلقائياً)
  - اسم العميل *
  - رقم الجوال * (Saudi format: 05XXXXXXXX)
  - المدينة *
  - العنوان * (full-width)
  - نوع العميل (select: فرد / شركة)
  - رقم الهوية / الإقامة (optional)
  - الرقم الضريبي (optional, 15 chars max)
  - البريد الإلكتروني (optional)
  - الحالة (toggle switch)
  - الملاحظات (textarea, full-width)
- نفس بنية: toast، confirm dialog، loading spinner، empty state

---

## 6. `screens/customers/customers.js`

**نفس نمط `users.js` تماماً**:
- `loadCustomers()` → `window.api.getCustomers()`
- `renderTable(customers, search)` — يبحث في الاسم أو الجوال
- `openModal(customer)` — add أو edit
- `saveCustomer()` — validation ثم `createCustomer` أو `updateCustomer`
- `deleteCustomer(id, name)` — confirm dialog
- `toggleStatus(id, currentActive)` — `toggleCustomerStatus`
- نفس `showToast`, `showModalError`, `escHtml`
- `I18N.apply()` عند التحميل

**التحقق من صحة البيانات**:
- اسم العميل: إلزامي
- رقم الجوال: إلزامي، يبدأ بـ 05، طوله 10 أرقام بالضبط
- المدينة: إلزامي
- العنوان: إلزامي

---

## 7. `screens/customers/customers.css`

**نسخة من `users.css` بالكامل** مع إضافات:
- `.modal-wide` — أعرض من المودال العادي (max-width: 760px)
- `.form-grid` — شبكة عمودين: `display: grid; grid-template-columns: 1fr 1fr; gap: 16px;`
- `.field-group-full` — يمتد على العمودين: `grid-column: 1 / -1`
- `.field-readonly` — خلفية معتمة + cursor: default
- `.toggle-wrap` — عرض toggle switch مع label
- `.toggle-switch`, `.toggle-slider` — CSS toggle component
- `.customers-table` — بدلاً من `.users-table`
- `.badge-individual`, `.badge-corporate` — ألوان مختلفة للنوع

---

## ترتيب التنفيذ

1. `database/db.js` — إضافة جدول + functions
2. `main.js` — إضافة IPC handlers
3. `preload.js` — كشف API
4. `assets/i18n.js` — إضافة مفاتيح الترجمة
5. `screens/customers/customers.css` — نسخ وتخصيص
6. `screens/customers/customers.html` — هيكل الشاشة
7. `screens/customers/customers.js` — منطق الشاشة

---

## اختبار النهاية

1. تشغيل التطبيق: `npx electron .` أو `npm start`
2. تسجيل الدخول بـ admin/admin123
3. النقر على بطاقة "العملاء" في لوحة التحكم
4. التحقق من:
   - ظهور جدول فارغ مع empty state
   - إضافة عميل ← يظهر في الجدول برقم اشتراك تلقائي (CUS-000001)
   - تعديل بيانات العميل
   - تفعيل/إيقاف الحالة
   - حذف عميل مع confirm dialog
   - البحث بالاسم أو الجوال
   - التحقق من صحة الجوال السعودي (يبدأ بـ 05، 10 أرقام)
   - التبديل بين العربية والإنجليزية
