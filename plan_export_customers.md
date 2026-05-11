# إضافة تصدير PDF و Excel لشاشة العملاء

## نظرة عامة
إضافة وظائف تصدير PDF و Excel لشاشة العملاء بنفس التصميم والوظائف الموجودة في شاشة المصروفات.

## الملفات المطلوبة للتعديل

### 1. `screens/customers/customers.html`
**التغييرات:**
- إضافة أزرار التصدير (Excel و PDF) في شريط الأدوات بجانب زر "إضافة عميل"
- نفس تصميم أزرار المصروفات مع تغيير الألوان لتناسب شاشة العملاء

**الكود المطلوب إضافته:**
```html
<!-- في toolbar، قبل زر إضافة عميل -->
<div class="toolbar-actions">
  <button id="btnExportExcel" class="btn-export btn-excel">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
    <span data-i18n="customers-export-excel">Excel</span>
  </button>
  <button id="btnExportPdf" class="btn-export btn-pdf">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
    <span data-i18n="customers-export-pdf">PDF</span>
  </button>
</div>
```

### 2. `screens/customers/customers.html` (CSS)
**التغييرات:**
- إضافة CSS لأزرار التصدير في الـ inline style
- نفس CSS المستخدم في expenses.css

**الكود المطلوب إضافته (قبل إغلاق </style>):**
```css
.toolbar-actions{display:flex;align-items:center;gap:10px}
.btn-export{display:flex;align-items:center;gap:8px;padding:10px 18px;border:none;border-radius:50px;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .2s,transform .15s,box-shadow .2s;white-space:nowrap}
.btn-export svg{width:17px;height:17px}
.btn-export:hover{opacity:.9;transform:translateY(-1px)}
.btn-export:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-excel{background:linear-gradient(90deg,#10b981,#059669);color:#fff;box-shadow:0 2px 8px rgba(16,185,129,.3)}
.btn-excel:hover{box-shadow:0 4px 12px rgba(16,185,129,.4)}
.btn-pdf{background:linear-gradient(90deg,#ef4444,#dc2626);color:#fff;box-shadow:0 2px 8px rgba(239,68,68,.3)}
.btn-pdf:hover{box-shadow:0 4px 12px rgba(239,68,68,.4)}
```

### 3. `screens/customers/customers.js`
**التغييرات:**
- إضافة متغيرات لأزرار التصدير
- إضافة دالة `exportCustomers(type)`
- إضافة event listeners للأزرار

**الكود المطلوب إضافته:**

أ. بعد تعريف المتغيرات (بعد السطر 22):
```javascript
const btnExportExcel      = document.getElementById('btnExportExcel');
const btnExportPdf        = document.getElementById('btnExportPdf');
```

ب. بعد event listeners للـ pagination (بعد السطر 87):
```javascript
btnExportExcel.addEventListener('click', () => exportCustomers('excel'));
btnExportPdf.addEventListener('click', () => exportCustomers('pdf'));
```

ج. إضافة دالة التصدير (قبل الدالة formatNumber):
```javascript
async function exportCustomers(type) {
  btnExportExcel.disabled = true;
  btnExportPdf.disabled   = true;
  showToast(I18N.t('customers-exporting'), 'info');

  try {
    const result = await window.api.exportCustomers({ type, filters: { search: currentSearch } });
    if (result.success) {
      showToast(I18N.t('customers-export-success'), 'success');
    } else {
      showToast(result.message || I18N.t('customers-export-error'), 'error');
    }
  } catch (err) {
    showToast(I18N.t('customers-export-error'), 'error');
    console.error('Export error:', err);
  }

  btnExportExcel.disabled = false;
  btnExportPdf.disabled   = false;
}
```

### 4. `assets/i18n.js`
**التغييرات:**
- إضافة الترجمات الجديدة للعملاء

**الكود المطلوب إضافته في كائن الترجمات العربية:**
```javascript
'customers-export-excel': 'Excel',
'customers-export-pdf': 'PDF',
'customers-exporting': 'جارٍ تصدير البيانات...',
'customers-export-success': 'تم تصدير الملف بنجاح',
'customers-export-error': 'حدث خطأ أثناء التصدير',
```

### 5. `preload.js`
**التغييرات:**
- إضافة API جديد لتصدير العملاء

**الكود المطلوب إضافته (قبل القوس الأخير):**
```javascript
exportCustomers: (data) => ipcRenderer.invoke('export-customers', data)
```

### 6. `database/db.js`
**التغييرات:**
- إضافة دالة `getAllCustomers` لجلب كل العملاء (بدون pagination) للتصدير

**الكود المطلوب إضافته (بعد دالة getCustomers):**
```javascript
async function getAllCustomers(filters = {}) {
  const { search } = filters;
  
  let whereClauses = '';
  const params = [];
  
  if (search) {
    whereClauses += ' AND (customer_name LIKE ? OR phone LIKE ? OR subscription_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  const sql = `SELECT * FROM customers WHERE 1=1${whereClauses} ORDER BY id ASC`;
  const [rows] = await pool.query(sql, params);
  
  return { customers: rows, total: rows.length };
}
```

### 7. `main.js`
**التغييرات:**
- إضافة IPC handler لتصدير العملاء
- إضافة دالتين مساعدتين: `buildExcelDataForCustomers` و `buildPdfHtmlForCustomers`

**الكود المطلوب إضافته (بعد handler export-expenses):**

أ. IPC Handler:
```javascript
ipcMain.handle('export-customers', async (event, { type, filters = {} }) => {
  try {
    const downloadsPath = app.getPath('downloads');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

    const { customers } = await db.getAllCustomers(filters);

    if (type === 'excel') {
      const XLSX   = require('xlsx');
      const wb     = XLSX.utils.book_new();
      const wsData = buildExcelDataForCustomers(customers, filters);
      const ws     = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols']  = [{wch:5},{wch:18},{wch:25},{wch:15},{wch:15},{wch:20},{wch:15},{wch:12},{wch:20},{wch:20},{wch:12},{wch:24}];
      if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
      ws['!sheetViews'][0].rightToLeft = true;
      XLSX.utils.book_append_sheet(wb, ws, 'العملاء');
      const filePath = path.join(downloadsPath, `customers_${timestamp}.xlsx`);
      XLSX.writeFile(wb, filePath);
      shell.openPath(filePath);
      return { success: true, filePath };
    }

    if (type === 'pdf') {
      const cairoRegularB64 = fs.readFileSync(
        path.join(__dirname, 'assets', 'fonts', 'Cairo-Regular.woff2')
      ).toString('base64');
      const cairoBoldB64 = fs.readFileSync(
        path.join(__dirname, 'assets', 'fonts', 'Cairo-Bold.woff2')
      ).toString('base64');
      const saudiRiyalB64 = fs.readFileSync(
        path.join(__dirname, 'assets', 'fonts', 'saudi-riyal.woff')
      ).toString('base64');

      const htmlContent = buildPdfHtmlForCustomers(customers, filters, cairoRegularB64, cairoBoldB64, saudiRiyalB64);
      const tempHtml    = path.join(app.getPath('temp'), `cust_print_${Date.now()}.html`);
      fs.writeFileSync(tempHtml, htmlContent, 'utf8');

      const pdfWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      await pdfWin.loadFile(tempHtml);

      const pdfBuffer = await pdfWin.webContents.printToPDF({
        landscape:       true,
        pageSize:        'A4',
        printBackground: true,
        margins:         { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
      });

      pdfWin.close();
      try { fs.unlinkSync(tempHtml); } catch {}

      const filePath = path.join(downloadsPath, `customers_${timestamp}.pdf`);
      fs.writeFileSync(filePath, pdfBuffer);
      shell.openPath(filePath);
      return { success: true, filePath };
    }

    return { success: false, message: 'نوع التصدير غير مدعوم' };
  } catch (err) {
    console.error('Export error:', err);
    return { success: false, message: err.message };
  }
});
```

ب. دالة بناء بيانات Excel (بعد buildExcelData):
```javascript
function buildExcelDataForCustomers(customers, filters) {
  const printDate = formatDateSimple(new Date().toISOString());
  const rows = [
    ['تقرير العملاء - نظام المغسلة'],
    [`تاريخ الطباعة: ${printDate}`],
  ];
  if (filters.search) {
    rows.push([`بحث: ${filters.search}`]);
  }
  rows.push([]);
  rows.push(['#', 'رقم الاشتراك', 'اسم العميل', 'رقم الجوال', 'البريد الإلكتروني', 'النوع', 'المدينة', 'الهوية', 'الرقم الضريبي', 'العنوان', 'الحالة', 'ملاحظات']);
  customers.forEach((c, i) => {
    rows.push([
      i + 1,
      c.subscription_number || '',
      c.customer_name       || '',
      c.phone               || '',
      c.email               || '',
      c.customer_type === 'corporate' ? 'شركة' : 'فرد',
      c.city                || '',
      c.national_id         || '',
      c.tax_number          || '',
      c.address             || '',
      c.is_active ? 'نشط' : 'غير نشط',
      c.notes               || ''
    ]);
  });
  rows.push([]);
  rows.push(['', '', '', '', '', '', '', '', '', `إجمالي العملاء: ${customers.length}`, '', '']);
  return rows;
}
```

ج. دالة بناء HTML للـ PDF (بعد buildPdfHtml):
```javascript
function buildPdfHtmlForCustomers(customers, filters, cairoRegularB64, cairoBoldB64, saudiRiyalB64) {
  const printDate = formatDateSimple(new Date().toISOString());

  const tableRows = customers.map((c, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td class="center">${i + 1}</td>
      <td class="sub-num">${c.subscription_number || '—'}</td>
      <td>${c.customer_name || '—'}</td>
      <td class="center">${c.phone || '—'}</td>
      <td>${c.email || '—'}</td>
      <td class="center">${c.customer_type === 'corporate' ? 'شركة' : 'فرد'}</td>
      <td>${c.city || '—'}</td>
      <td class="center">${c.national_id || '—'}</td>
      <td class="center">${c.tax_number || '—'}</td>
      <td>${c.address || '—'}</td>
      <td class="center">${c.is_active ? '<span class="badge active">نشط</span>' : '<span class="badge inactive">غير نشط</span>'}</td>
    </tr>
  `).join('');

  const filterInfo = filters.search
    ? `<p class="sub">بحث: ${filters.search}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
.sar{font-family:'SaudiRiyal';font-weight:400;font-style:normal;font-size:1.2em;vertical-align:middle;display:inline-block;line-height:1}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
body{direction:rtl;background:#fff;color:#1e293b;padding:16px;font-size:10px}
.header{text-align:center;margin-bottom:18px;border-bottom:2px solid #6366f1;padding-bottom:12px}
.header h1{font-size:18px;font-weight:700;color:#6366f1}
.header p{font-size:10px;color:#64748b;margin-top:4px}
.sub{font-size:10px;color:#475569;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead tr{background:linear-gradient(90deg,#6366f1,#8b5cf6);color:#fff}
thead th{padding:9px 10px;font-size:10px;font-weight:700;text-align:right;white-space:nowrap}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr.even{background:#fafbfc}
tbody td{padding:8px 10px;font-size:10px;color:#475569;text-align:right}
td.center,th.center{text-align:center}
td.sub-num{font-weight:700;color:#6366f1;text-align:center}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700}
.badge.active{background:rgba(34,197,94,.1);color:#16a34a}
.badge.inactive{background:rgba(100,116,139,.1);color:#64748b}
.summary{display:flex;gap:16px;margin-top:12px}
.summary-card{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;text-align:center;border-top:3px solid #6366f1}
.s-label{font-size:9px;color:#64748b;font-weight:700;margin-bottom:6px}
.s-value{font-size:15px;font-weight:700;color:#1e293b}
.footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{
  @page{size:A4 landscape;margin:1cm}
  body{padding:0}
}
</style>
</head>
<body>
<div class="header">
  <h1>تقرير العملاء - نظام المغسلة</h1>
  <p>تاريخ الطباعة: ${printDate} &nbsp;|&nbsp; عدد السجلات: ${customers.length.toLocaleString()}</p>
  ${filterInfo}
</div>

<table>
  <thead>
    <tr>
      <th class="center" style="width:40px">#</th>
      <th>رقم الاشتراك</th>
      <th>اسم العميل</th>
      <th class="center">رقم الجوال</th>
      <th>البريد الإلكتروني</th>
      <th class="center">النوع</th>
      <th>المدينة</th>
      <th class="center">الهوية</th>
      <th class="center">الرقم الضريبي</th>
      <th>العنوان</th>
      <th class="center">الحالة</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>

<div class="summary">
  <div class="summary-card">
    <div class="s-label">إجمالي العملاء</div>
    <div class="s-value">${customers.length.toLocaleString()}</div>
  </div>
</div>

<div class="footer">
  <p>نظام المغسلة - تقرير العملاء - ${printDate}</p>
</div>
</body>
</html>`;
}
```

## خطوات التنفيذ

1. ✅ تعديل `customers.html` - إضافة أزرار التصدير وCSS
2. ✅ تعديل `customers.js` - إضافة دالة التصدير وevent listeners
3. ✅ تعديل `i18n.js` - إضافة الترجمات
4. ✅ تعديل `preload.js` - إضافة API الجديد
5. ✅ تعديل `db.js` - إضافة دالة getAllCustomers
6. ✅ تعديل `main.js` - إضافة IPC handler والدوال المساعدة

## التحقق من التنفيذ

بعد التنفيذ، يجب اختبار:

1. **تصدير Excel:**
   - فتح شاشة العملاء
   - الضغط على زر Excel
   - التأكد من فتح الملف في التنزيلات
   - التحقق من:
     - اتجاه RTL صحيح
     - كل الأعمدة موجودة
     - البيانات صحيحة
     - التنسيق مناسب

2. **تصدير PDF:**
   - فتح شاشة العملاء
   - الضغط على زر PDF
   - التأكد من فتح الملف في التنزيلات
   - التحقق من:
     - الخط العربي (Cairo) يظهر بشكل صحيح
     - اتجاه RTL صحيح
     - كل الأعمدة موجودة
     - البيانات صحيحة
     - التنسيق والألوان مناسبة

3. **تصدير مع بحث:**
   - إدخال نص في حقل البحث
   - الضغط على زر التصدير
   - التأكد من تصدير النتائج المفلترة فقط

4. **تعطيل الأزرار أثناء التصدير:**
   - الضغط على زر التصدير
   - التأكد من تعطيل الأزرار أثناء المعالجة
   - إعادة تفعيلها بعد الانتهاء

## ملاحظات

- التصدير يتم في الخلفية باستخدام BrowserWindow مخفي للـ PDF
- يتم حفظ الملفات في مجلد التنزيلات الافتراضي
- يتم فتح الملف تلقائياً بعد الحفظ باستخدام `shell.openPath`
- الألوان المستخدمة في PDF للعملاء بنفسجي (#6366f1) لتمييزه عن المصروفات (أحمر #f43f5e)
- جميع الخطوط مضمنة في ملف PDF كـ base64
