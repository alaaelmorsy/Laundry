# خطة تطوير شاشة المصروفات — المرحلة الثانية

## الوضع الحالي

شاشة المصروفات **مكتملة ومشغّلة** بالميزات الأساسية (إضافة/تعديل/حذف/بحث). الهدف هو إضافة:

1. **تصدير PDF و Excel باللغة العربية** مع تنزيل تلقائي وفتح تلقائي
2. **ترقيم الصفحات (Pagination) وعمود الرقم التسلسلي (Index)**
3. **فلترة التاريخ من/إلى**
4. **أداء عالٍ مع مليون سجل**

---

## الملفات التي ستُعدَّل

| الملف | التعديلات المطلوبة |
|-------|-------------------|
| `database/db.js` | دعم Pagination في `getAllExpenses` + إضافة `getExpensesCount` + فهرسة |
| `main.js` | IPC جديد لـ export-expenses (PDF/Excel) + تحديث get-expenses |
| `preload.js` | تعريض `exportExpenses` للـ renderer |
| `screens/expenses/expenses.html` | إضافة حقلي التاريخ + أزرار التصدير + شريط Pagination |
| `screens/expenses/expenses.js` | تحديث loadExpenses + renderTable + دوال Pagination + Export |
| `assets/i18n.js` | مفاتيح ترجمة جديدة للميزات الجديدة |

---

## الميزة 1 — تصدير PDF و Excel (عربي، تنزيل تلقائي، فتح تلقائي)

### المكتبات المتاحة (مثبّتة مسبقاً)
- **jsPDF** + **jspdf-autotable** → للـ PDF
- **xlsx** → للـ Excel
- **Electron shell** + **app.getPath('downloads')** → للحفظ والفتح التلقائي

### المشكلة: دعم العربية في jsPDF
jsPDF لا يدعم العربية افتراضياً. الحل: استخدام خط **Cairo** الموجود مسبقاً في `assets/fonts/` وتضمينه في jsPDF عبر Base64.

**بديل أسهل وأسرع للتنفيذ:** نُنشئ جدول HTML مخصص ذو RTL ونُحوّله إلى PDF بدون مشاكل خط، أو نستخدم المسار الصحيح:
- تحميل ملف الخط Cairo وتضمينه في jsPDF كـ base64
- تعيين `doc.setFont('Cairo')` + `doc.setR2L(true)`

### التصميم المعماري (Architecture)

```
[expenses.js]  
  يجمع البيانات الكاملة (بدون pagination) من IPC  
     ↓  
[main.js: ipcMain.handle('export-expenses')]  
  يستلم البيانات + نوع التصدير ('pdf' | 'excel')  
  يبني الملف في Main Process (Node.js)  
  يحفظ في app.getPath('downloads') + timestamp  
  يفتح الملف بـ shell.openPath()  
     ↓  
  يرجع { success: true, filePath }
```

> **السبب:** Main Process يملك صلاحية الكتابة لملفات النظام وفتح البرامج الخارجية، بعكس Renderer.

### كود main.js — IPC Handler للتصدير

```js
const { shell, app } = require('electron');
const path = require('path');
const fs = require('fs');

ipcMain.handle('export-expenses', async (event, { type, expenses, summary, filters }) => {
  try {
    const downloadsPath = app.getPath('downloads');
    const timestamp = new Date().toISOString().slice(0,19).replace(/[:]/g, '-');
    
    if (type === 'excel') {
      // إنشاء Excel بـ xlsx
      const XLSX = require('xlsx');
      const wsData = buildExcelData(expenses, summary);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // عرض الأعمدة
      ws['!cols'] = [
        {wch:6}, {wch:25}, {wch:15}, {wch:12},
        {wch:14}, {wch:10}, {wch:12}, {wch:14}, {wch:20}
      ];
      // RTL للورقة
      ws['!sheetView'] = { rightToLeft: true };
      XLSX.utils.book_append_sheet(wb, ws, 'المصروفات');
      const filePath = path.join(downloadsPath, `expenses_${timestamp}.xlsx`);
      XLSX.writeFile(wb, filePath);
      shell.openPath(filePath);
      return { success: true, filePath };
    }
    
    if (type === 'pdf') {
      // إنشاء PDF بـ jsPDF + jspdf-autotable مع خط Cairo
      const { jsPDF } = require('jspdf');
      require('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      // تضمين خط Cairo (Base64 مخزّن في ملف منفصل)
      const cairoFont = fs.readFileSync(path.join(__dirname, 'assets/fonts/Cairo-Regular-base64.txt'), 'utf8');
      doc.addFileToVFS('Cairo-Regular.ttf', cairoFont);
      doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
      doc.setFont('Cairo');
      buildPdfContent(doc, expenses, summary, filters);
      const filePath = path.join(downloadsPath, `expenses_${timestamp}.pdf`);
      doc.save(filePath);
      shell.openPath(filePath);
      return { success: true, filePath };
    }
    
    return { success: false, message: 'نوع التصدير غير مدعوم' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});
```

### بناء بيانات Excel (`buildExcelData`)

```js
function buildExcelData(expenses, summary) {
  const rows = [
    // العنوان الرئيسي
    ['تقرير المصروفات - نظام المغسلة'],
    [`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}`],
    [],
    // رؤوس الأعمدة (RTL: من اليسار إلى اليمين في مصفوفة، سيُعكس في Excel)
    ['#', 'العنوان', 'الفئة', 'التاريخ', 'المبلغ قبل الضريبة', 'خاضع للضريبة', 'الضريبة 15%', 'الإجمالي', 'ملاحظات'],
    // البيانات
    ...expenses.map((e, i) => [
      i + 1,
      e.title,
      e.category,
      new Date(e.expense_date).toLocaleDateString('ar-SA'),
      Number(e.amount).toFixed(2),
      e.is_taxable ? 'نعم' : 'لا',
      Number(e.tax_amount).toFixed(2),
      Number(e.total_amount).toFixed(2),
      e.notes || ''
    ]),
    [],
    // ملخص
    ['', '', '', 'إجمالي المصروفات (قبل الضريبة):', Number(summary.total_before_tax).toFixed(2)],
    ['', '', '', 'إجمالي الضريبة (15%):', Number(summary.total_tax).toFixed(2)],
    ['', '', '', 'الإجمالي الكلي:', Number(summary.grand_total).toFixed(2)],
  ];
  return rows;
}
```

### بناء PDF (`buildPdfContent`)

```js
function buildPdfContent(doc, expenses, summary, filters) {
  // عنوان التقرير
  doc.setFontSize(18);
  doc.text('تقرير المصروفات - نظام المغسلة', doc.internal.pageSize.width / 2, 20, { align: 'center' });
  
  // معلومات الفلترة
  doc.setFontSize(10);
  let yPos = 30;
  if (filters.dateFrom || filters.dateTo) {
    const dateRange = `الفترة: ${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`;
    doc.text(dateRange, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    yPos += 8;
  }
  doc.text(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}`, doc.internal.pageSize.width / 2, yPos, { align: 'center' });

  // الجدول
  doc.autoTable({
    startY: yPos + 10,
    head: [['#', 'العنوان', 'الفئة', 'التاريخ', 'المبلغ', 'ضريبة؟', 'الضريبة', 'الإجمالي']],
    body: expenses.map((e, i) => [
      i + 1,
      e.title,
      e.category,
      new Date(e.expense_date).toLocaleDateString('ar-SA'),
      `${Number(e.amount).toFixed(2)} ر`,
      e.is_taxable ? 'نعم' : 'لا',
      `${Number(e.tax_amount).toFixed(2)} ر`,
      `${Number(e.total_amount).toFixed(2)} ر`
    ]),
    foot: [[
      '', '', '', 'الإجمالي:',
      `${Number(summary.total_before_tax).toFixed(2)} ر`, '',
      `${Number(summary.total_tax).toFixed(2)} ر`,
      `${Number(summary.grand_total).toFixed(2)} ر`
    ]],
    styles: { font: 'Cairo', halign: 'right', fontSize: 9 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, halign: 'center' },
    footStyles: { fillColor: [240, 253, 244], textColor: [16, 185, 129], fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'center', cellWidth: 12 } },
    didDrawPage: (data) => {
      // ترقيم الصفحات
      doc.setFontSize(8);
      doc.text(
        `صفحة ${doc.internal.getCurrentPageInfo().pageNumber} من ${doc.internal.getNumberOfPages()}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 5,
        { align: 'center' }
      );
    }
  });
}
```

### ملف Base64 للخط
- إنشاء سكريبت مساعد لتحويل `Cairo-Regular.ttf` → `Cairo-Regular-base64.txt`
- الملف موجود في `assets/fonts/` بالفعل

### واجهة المستخدم — أزرار التصدير

إضافة في `expenses.html` داخل `.toolbar`:

```html
<div class="export-buttons">
  <button id="btnExportExcel" class="btn-export btn-excel" title="تصدير Excel">
    <svg><!-- أيقونة Excel --></svg>
    <span>Excel</span>
  </button>
  <button id="btnExportPdf" class="btn-export btn-pdf" title="تصدير PDF">
    <svg><!-- أيقونة PDF --></svg>
    <span>PDF</span>
  </button>
</div>
```

### preload.js — تعريض API

```js
exportExpenses: (data) => ipcRenderer.invoke('export-expenses', data),
```

### منطق expenses.js — دالة التصدير

```js
async function exportExpenses(type) {
  // جلب كل السجلات المفلترة (بدون pagination) للتصدير
  const result = await window.api.getExpenses({ 
    dateFrom: currentFilters.dateFrom, 
    dateTo: currentFilters.dateTo,
    search: currentFilters.search,
    pageSize: 999999, // كل السجلات
    page: 1
  });
  
  const summaryResult = await window.api.getExpensesSummary(currentFilters);
  
  showToast('جارٍ إنشاء الملف...', 'info');
  
  const result2 = await window.api.exportExpenses({
    type,
    expenses: result.expenses,
    summary: summaryResult.summary,
    filters: currentFilters
  });
  
  if (result2.success) {
    showToast(`تم تصدير الملف وحفظه في التنزيلات`, 'success');
  } else {
    showToast('حدث خطأ أثناء التصدير', 'error');
  }
}

btnExportPdf.addEventListener('click', () => exportExpenses('pdf'));
btnExportExcel.addEventListener('click', () => exportExpenses('excel'));
```

---

## الميزة 2 — ترقيم الصفحات (Pagination) وعمود الرقم التسلسلي

### الاستراتيجية: Server-Side Pagination

بدلاً من تحميل كل البيانات دفعة واحدة، نُحمّل فقط الصفحة الحالية من قاعدة البيانات.

### التعديلات على `database/db.js`

#### تحديث `getAllExpenses` لدعم Pagination

```js
async function getAllExpenses(filters = {}) {
  const { page = 1, pageSize = 50, search, dateFrom, dateTo } = filters;
  
  let countSql = 'SELECT COUNT(*) as total FROM expenses WHERE 1=1';
  let dataSql  = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];

  if (search) {
    const clause = ' AND (title LIKE ? OR category LIKE ?)';
    countSql += clause; dataSql += clause;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (dateFrom) {
    const clause = ' AND expense_date >= ?';
    countSql += clause; dataSql += clause;
    params.push(dateFrom);
  }
  if (dateTo) {
    const clause = ' AND expense_date <= ?';
    countSql += clause; dataSql += clause;
    params.push(dateTo);
  }

  dataSql += ' ORDER BY expense_date DESC, id DESC LIMIT ? OFFSET ?';
  
  const offset = (page - 1) * pageSize;
  const dataParams = [...params, pageSize, offset];

  const [[countRow], [rows]] = await Promise.all([
    pool.query(countSql, params),
    pool.query(dataSql, dataParams)
  ]);

  return {
    expenses: rows,
    total: countRow[0].total,
    page,
    pageSize,
    totalPages: Math.ceil(countRow[0].total / pageSize)
  };
}
```

#### إضافة فهرس على `expense_date` لتسريع الاستعلامات

```js
// في createTables()، بعد إنشاء الجدول:
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_expenses_date 
  ON expenses (expense_date DESC, id DESC)
`).catch(() => {});  // ignore if already exists
```

> مع هذا الفهرس، استعلامات الـ pagination ستكون فورية حتى مع مليون سجل.

#### تحديث `getExpensesSummary` لدعم الفلترة

```js
async function getExpensesSummary(filters = {}) {
  let sql = `
    SELECT 
      COALESCE(SUM(amount), 0) as total_before_tax,
      COALESCE(SUM(tax_amount), 0) as total_tax,
      COALESCE(SUM(total_amount), 0) as grand_total,
      COUNT(*) as count
    FROM expenses WHERE 1=1
  `;
  const params = [];
  
  if (filters.search) {
    sql += ' AND (title LIKE ? OR category LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.dateFrom) { sql += ' AND expense_date >= ?'; params.push(filters.dateFrom); }
  if (filters.dateTo)   { sql += ' AND expense_date <= ?'; params.push(filters.dateTo); }
  
  const [rows] = await pool.query(sql, params);
  return rows[0];
}
```

#### تحديث IPC في main.js

```js
ipcMain.handle('get-expenses', async (event, filters = {}) => {
  try {
    const result = await db.getAllExpenses(filters);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('get-expenses-summary', async (event, filters = {}) => {
  try {
    const summary = await db.getExpensesSummary(filters);
    return { success: true, summary };
  } catch (err) {
    return { success: false, message: err.message };
  }
});
```

#### تحديث preload.js

```js
getExpensesSummary: (filters) => ipcRenderer.invoke('get-expenses-summary', filters),
```

### واجهة Pagination في `expenses.html`

إضافة شريط Pagination أسفل الجدول:

```html
<div class="pagination-bar" id="paginationBar">
  <div class="pagination-info">
    <span id="paginationInfo">عرض 1-50 من 1,000 سجل</span>
  </div>
  <div class="pagination-controls">
    <button id="btnFirstPage" class="page-btn" title="أول صفحة">«</button>
    <button id="btnPrevPage" class="page-btn" title="السابق">‹</button>
    <div id="pageNumbers" class="page-numbers"></div>
    <button id="btnNextPage" class="page-btn" title="التالي">›</button>
    <button id="btnLastPage" class="page-btn" title="آخر صفحة">»</button>
  </div>
  <div class="page-size-selector">
    <label>عرض:</label>
    <select id="pageSizeSelect">
      <option value="25">25</option>
      <option value="50" selected>50</option>
      <option value="100">100</option>
      <option value="200">200</option>
    </select>
    <span>سجل</span>
  </div>
</div>
```

### عمود الرقم التسلسلي في الجدول

```html
<!-- في thead -->
<th data-i18n="expenses-col-index">#</th>
```

```js
// في renderTable — حساب الرقم التسلسلي الصحيح
const indexStart = (currentPage - 1) * currentPageSize;
expensesTableBody.innerHTML = expenses.map((e, i) => `
  <tr>
    <td class="index-cell">${indexStart + i + 1}</td>
    <!-- باقي الأعمدة -->
  </tr>
`).join('');
```

### منطق Pagination في `expenses.js`

```js
let currentPage     = 1;
let currentPageSize = 50;
let totalPages      = 1;
let totalRecords    = 0;
let currentFilters  = {};

async function loadExpenses() {
  const result = await window.api.getExpenses({
    page: currentPage,
    pageSize: currentPageSize,
    ...currentFilters
  });
  
  if (result.success) {
    totalPages   = result.totalPages;
    totalRecords = result.total;
    renderTable(result.expenses);
    renderPagination();
    loadSummary();
  }
}

function renderPagination() {
  const start  = (currentPage - 1) * currentPageSize + 1;
  const end    = Math.min(currentPage * currentPageSize, totalRecords);
  
  paginationInfo.textContent = `عرض ${start.toLocaleString('ar-SA')}-${end.toLocaleString('ar-SA')} من ${totalRecords.toLocaleString('ar-SA')} سجل`;
  
  btnFirstPage.disabled = currentPage === 1;
  btnPrevPage.disabled  = currentPage === 1;
  btnNextPage.disabled  = currentPage === totalPages;
  btnLastPage.disabled  = currentPage === totalPages;
  
  const pageRange = getPageRange(currentPage, totalPages);
  pageNumbers.innerHTML = pageRange.map(p => 
    p === '...' 
      ? `<span class="page-ellipsis">…</span>`
      : `<button class="page-num ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
  ).join('');
  
  pageNumbers.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => goToPage(Number(btn.dataset.page)));
  });
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({length: total}, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('...');
  for (let p = Math.max(2, current-1); p <= Math.min(total-1, current+1); p++) pages.push(p);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadExpenses();
}

btnFirstPage.addEventListener('click', () => goToPage(1));
btnPrevPage.addEventListener('click',  () => goToPage(currentPage - 1));
btnNextPage.addEventListener('click',  () => goToPage(currentPage + 1));
btnLastPage.addEventListener('click',  () => goToPage(totalPages));

pageSizeSelect.addEventListener('change', () => {
  currentPageSize = Number(pageSizeSelect.value);
  currentPage = 1;
  loadExpenses();
});
```

---

## الميزة 3 — فلترة التاريخ من/إلى

### الوضع الحالي
`getAllExpenses` في `db.js` **يدعم بالفعل** `dateFrom` و `dateTo` في الـ SQL — لكن واجهة المستخدم لا تملك حقول التاريخ.

### إضافة حقول التاريخ في `expenses.html`

إضافة في `.toolbar` بجوار حقل البحث:

```html
<div class="date-filter-wrap">
  <label class="date-filter-label" data-i18n="expenses-filter-from">من:</label>
  <input type="date" id="filterDateFrom" class="date-filter-input" />
  <label class="date-filter-label" data-i18n="expenses-filter-to">إلى:</label>
  <input type="date" id="filterDateTo" class="date-filter-input" />
  <button id="btnClearDates" class="btn-clear-dates" title="مسح التاريخ">✕</button>
</div>
```

### منطق الفلترة في `expenses.js`

```js
const filterDateFrom = document.getElementById('filterDateFrom');
const filterDateTo   = document.getElementById('filterDateTo');
const btnClearDates  = document.getElementById('btnClearDates');

let filterTimer = null;

function applyFilters() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => {
    currentPage = 1;
    currentFilters = {
      search:   searchInput.value.trim() || undefined,
      dateFrom: filterDateFrom.value || undefined,
      dateTo:   filterDateTo.value || undefined
    };
    loadExpenses();
  }, 300);
}

searchInput.addEventListener('input',     applyFilters);
filterDateFrom.addEventListener('change', applyFilters);
filterDateTo.addEventListener('change',   applyFilters);

btnClearDates.addEventListener('click', () => {
  filterDateFrom.value = '';
  filterDateTo.value   = '';
  applyFilters();
});
```

### تحديث الملخص ليعكس الفلاتر

```js
async function loadSummary() {
  const result = await window.api.getExpensesSummary(currentFilters);
  if (result.success) {
    const s = result.summary;
    summaryTotalBefore.innerHTML = `${formatNumber(s.total_before_tax)} <span class="currency">ريال</span>`;
    summaryTax.innerHTML         = `${formatNumber(s.total_tax)} <span class="currency">ريال</span>`;
    summaryGrandTotal.innerHTML  = `${formatNumber(s.grand_total)} <span class="currency">ريال</span>`;
  }
}
```

---

## الميزة 4 — الأداء العالي مع مليون سجل

### المشكلة الحالية
الكود الحالي يُحمّل كل السجلات دفعة واحدة (`getAllExpenses` بدون LIMIT) ويرسمها بـ `innerHTML`. هذا سيُجمّد التطبيق مع بيانات كبيرة.

### الحل: Server-Side Pagination + MySQL Index

#### 1. فهرسة قاعدة البيانات (الأهم)

```sql
-- فهرس مركّب على عمودَي الترتيب الافتراضي
CREATE INDEX idx_expenses_date_id ON expenses (expense_date DESC, id DESC);

-- فهرس للبحث النصي (اختياري، للسرعة الزائدة)
CREATE FULLTEXT INDEX idx_expenses_search ON expenses (title, category);
```

مع هذه الفهارس، استعلام `SELECT * LIMIT 50 OFFSET 500000` سيكون فورياً (< 50ms).

#### 2. إلغاء تحميل كل البيانات

بعد تطبيق Server-Side Pagination في الميزة 2، لن يتم تحميل أكثر من `pageSize` سجلاً في كل مرة (50 افتراضياً). هذا وحده يحل مشكلة الأداء.

#### 3. Debounce للبحث

```js
let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 300);
});
```

#### 4. Loading State أثناء التحميل

```js
async function loadExpenses() {
  expensesTableBody.innerHTML = `
    <tr>
      <td colspan="9" class="loading-cell">
        <div class="spinner"></div>
        <span>جارٍ التحميل...</span>
      </td>
    </tr>
  `;
  const result = await window.api.getExpenses({ ... });
  // ... باقي الكود
}
```

#### 5. Promise.all للاستعلامات المتوازية

```js
// في getAllExpenses — COUNT و DATA بالتوازي بدل التسلسل
const [[countRow], [rows]] = await Promise.all([
  pool.query(countSql, params),
  pool.query(dataSql, dataParams)
]);
```

---

## ترتيب التنفيذ المقترح

```
1. database/db.js
   ├── تحديث getAllExpenses → يقبل { page, pageSize, search, dateFrom, dateTo }
   ├── تحديث getExpensesSummary → يقبل filters للفلترة
   └── إضافة فهارس MySQL

2. main.js
   ├── تحديث get-expenses → يمرر filters كاملة
   ├── تحديث get-expenses-summary → يمرر filters
   └── إضافة export-expenses handler

3. preload.js
   ├── تحديث getExpensesSummary → يمرر filters
   └── إضافة exportExpenses

4. assets/fonts/Cairo-Regular-base64.txt
   └── إنشاء ملف base64 للخط (لدعم PDF العربي)

5. assets/i18n.js
   └── إضافة مفاتيح: expenses-filter-from, expenses-filter-to,
       expenses-export-pdf, expenses-export-excel, expenses-col-index

6. screens/expenses/expenses.html
   ├── إضافة عمود # في thead
   ├── إضافة حقول التاريخ في toolbar
   ├── إضافة أزرار Export (PDF/Excel) في toolbar
   └── إضافة شريط Pagination أسفل الجدول

7. screens/expenses/expenses.js
   ├── إضافة متغيرات: currentPage, currentPageSize, totalPages, currentFilters
   ├── تحديث loadExpenses → server-side pagination
   ├── تحديث loadSummary → يمرر currentFilters
   ├── تحديث renderTable → يحسب indexStart للرقم التسلسلي
   ├── إضافة renderPagination
   ├── إضافة applyFilters مع Debounce
   ├── إضافة exportExpenses (pdf/excel)
   └── ربط event listeners الجديدة

8. screens/expenses/expenses.css
   └── أنماط: .pagination-bar, .page-btn, .page-num, .date-filter-wrap,
       .btn-export, .index-cell, .loading-cell spinner
```

---

## التحقق من الصحة (Verification)

| الاختبار | الخطوات | النتيجة المتوقعة |
|---------|---------|----------------|
| **Pagination** | افتح شاشة المصروفات مع 1000+ سجل | يظهر شريط ترقيم، 50 سجل في الصفحة |
| **الرقم التسلسلي** | انتقل للصفحة 2 | تبدأ الأرقام من 51 |
| **فلترة التاريخ** | اختر تاريخ من/إلى | تتحدث البيانات والملخص فورياً |
| **مسح الفلتر** | اضغط ✕ | تعود كل البيانات |
| **تصدير Excel** | اضغط Excel | يُنزَّل ملف xlsx ويُفتح تلقائياً |
| **تصدير PDF** | اضغط PDF | يُنزَّل ملف pdf ويُفتح تلقائياً |
| **عربي في PDF** | افتح PDF المُصدَّر | النصوص عربية صحيحة بدون رموز مكسورة |
| **ترقيم PDF** | PDF متعدد الصفحات | يظهر "صفحة X من Y" في أسفل كل صفحة |
| **الأداء** | أدخل مليون سجل (seed script) | التحميل < 200ms، التنقل بين الصفحات سريع |
| **Debounce** | اكتب في البحث بسرعة | استعلام واحد فقط يُرسَل بعد توقف الكتابة |

---

## ملاحظات تقنية مهمة

### معالجة خط Cairo في PDF
ملف `Cairo-Regular-base64.txt` يجب إنشاؤه قبل تنفيذ ميزة PDF:
```js
// سكريبت لتحويل الخط (تُشغَّل مرة واحدة)
const fs = require('fs');
const font = fs.readFileSync('./assets/fonts/Cairo-Regular.ttf');
fs.writeFileSync('./assets/fonts/Cairo-Regular-base64.txt', font.toString('base64'));
```

### LIMIT/OFFSET مع بيانات ضخمة
مع **فهرس على expense_date** + `LIMIT 50 OFFSET N`:
- حتى N = 1,000,000: الاستعلام يكون < 100ms
- بدون فهرس: قد يصل لثوانٍ في OFFSET عالية

### التصدير مع بيانات ضخمة
إذا كانت نتائج الفلترة > 100,000 سجل، يُعرض تحذير:
```js
if (totalRecords > 100000) {
  const confirmed = await showConfirm(`سيتم تصدير ${totalRecords.toLocaleString()} سجل. هذا قد يستغرق وقتاً. هل تريد المتابعة؟`);
  if (!confirmed) return;
}
```
