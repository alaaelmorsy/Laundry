/** Extracted from main.js */
function formatDateSimple(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const pad2 = (x) => String(x).padStart(2, '0');
    const day   = pad2(d.getDate());
    const month = pad2(d.getMonth() + 1);
    const year  = d.getFullYear();
    let result = `${day}/${month}/${year}`;
    const h24 = d.getHours();
    const mins = d.getMinutes();
    if (h24 !== 0 || mins !== 0 || (dateStr instanceof Date) || String(dateStr).length > 10) {
      const h12 = h24 % 12 || 12;
      const ampm = h24 < 12 ? 'AM' : 'PM';
      result += ` ${pad2(h12)}:${pad2(mins)} ${ampm}`;
    }
    return result;
  } catch { return String(dateStr); }
}

function buildExcelData(expenses, summary, filters) {
  const printDate = formatDateSimple(new Date().toISOString());
  const rows = [
    ['تقرير المصروفات - نظام المغسلة'],
    [`تاريخ الطباعة: ${printDate}`],
  ];
  if (filters.dateFrom || filters.dateTo) {
    rows.push([`الفترة: ${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`]);
  }
  rows.push([]);
  rows.push(['#', 'العنوان', 'الفئة', 'التاريخ', 'المبلغ قبل الضريبة (\uE900)', 'ضريبة؟', 'الضريبة 15% (\uE900)', 'الإجمالي (\uE900)', 'ملاحظات']);
  expenses.forEach((e, i) => {
    rows.push([
      i + 1,
      e.title        || '',
      e.category     || '',
      formatDateSimple(e.expense_date),
      Number(e.amount).toFixed(2),
      e.is_taxable ? 'نعم' : 'لا',
      Number(e.tax_amount).toFixed(2),
      Number(e.total_amount).toFixed(2),
      e.notes        || ''
    ]);
  });
  rows.push([]);
  rows.push(['', '', '', 'إجمالي المصروفات (قبل الضريبة):', Number(summary.total_before_tax).toFixed(2), '', '', '', '']);
  rows.push(['', '', '', 'إجمالي الضريبة (15%):', Number(summary.total_tax).toFixed(2), '', '', '', '']);
  rows.push(['', '', '', 'الإجمالي الكلي:', Number(summary.grand_total).toFixed(2), '', '', '', '']);
  return rows;
}

function buildPdfHtml(expenses, summary, filters, cairoRegularB64, cairoBoldB64, saudiRiyalB64) {
  const printDate = formatDateSimple(new Date().toISOString());

  const tableRows = expenses.map((e, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td class="center">${i + 1}</td>
      <td>${e.title || '—'}</td>
      <td>${e.category || '—'}</td>
      <td class="center">${formatDateSimple(e.expense_date)}</td>
      <td class="num"><span class="sar">&#xE900;</span> ${Number(e.amount).toFixed(2)}</td>
      <td class="center">${e.is_taxable ? '<span class="badge yes">نعم</span>' : '<span class="badge no">لا</span>'}</td>
      <td class="num tax"><span class="sar">&#xE900;</span> ${Number(e.tax_amount).toFixed(2)}</td>
      <td class="num total"><span class="sar">&#xE900;</span> ${Number(e.total_amount).toFixed(2)}</td>
    </tr>
  `).join('');

  const filterInfo = (filters.dateFrom || filters.dateTo)
    ? `<p class="sub">الفترة: ${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}</p>`
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
body{direction:rtl;background:#fff;color:#000;padding:16px;font-size:11px}
.header{text-align:center;margin-bottom:18px;border-bottom:2px solid #f43f5e;padding-bottom:12px}
.header h1{font-size:18px;font-weight:700;color:#f43f5e}
.header p{font-size:10px;color:#000;margin-top:4px}
.sub{font-size:10px;color:#000;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead tr{background:linear-gradient(90deg,#f43f5e,#e11d48);color:#fff}
thead th{padding:9px 10px;font-size:10px;font-weight:700;text-align:right;white-space:nowrap}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr.even{background:#fafbfc}
tbody td{padding:8px 10px;font-size:10px;color:#000;text-align:right}
td.center,th.center{text-align:center}
td.num{font-weight:700;color:#000;text-align:left;direction:ltr}
td.tax{color:#000}
td.total{color:#000}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700}
.badge.yes{background:rgba(245,158,11,.1);color:#000}
.badge.no{background:rgba(100,116,139,.1);color:#000}
.summary{display:flex;gap:16px;margin-top:12px}
.summary-card{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;text-align:center}
.summary-card.c1{border-top:3px solid #6366f1}
.summary-card.c2{border-top:3px solid #f59e0b}
.summary-card.c3{border-top:3px solid #10b981}
.s-label{font-size:9px;color:#000;font-weight:700;margin-bottom:6px}
.s-value{font-size:15px;font-weight:700;color:#000}
.s-currency{font-size:14px;color:#000}
.footer{text-align:center;font-size:9px;color:#000;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{
  @page{size:A4 landscape;margin:1cm}
  body{padding:0}
  .footer{position:running(footer)}
  @bottom-center{content:element(footer)}
}
</style>
</head>
<body>
<div class="header">
  <h1>تقرير المصروفات - نظام المغسلة</h1>
  <p>تاريخ الطباعة: ${printDate} &nbsp;|&nbsp; عدد السجلات: ${expenses.length.toLocaleString()}</p>
  ${filterInfo}
</div>

<table>
  <thead>
    <tr>
      <th class="center" style="width:40px">#</th>
      <th>العنوان</th>
      <th>الفئة</th>
      <th class="center">التاريخ</th>
      <th>المبلغ (<span class="sar">&#xE900;</span>)</th>
      <th class="center">ضريبة؟</th>
      <th>الضريبة 15%</th>
      <th>الإجمالي (<span class="sar">&#xE900;</span>)</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>

<div class="summary">
  <div class="summary-card c1">
    <div class="s-label">إجمالي المصروفات (قبل الضريبة)</div>
    <div class="s-value">${Number(summary.total_before_tax).toLocaleString('en-US',{minimumFractionDigits:2})} <span class="s-currency sar">&#xE900;</span></div>
  </div>
  <div class="summary-card c2">
    <div class="s-label">إجمالي الضريبة (15%)</div>
    <div class="s-value">${Number(summary.total_tax).toLocaleString('en-US',{minimumFractionDigits:2})} <span class="s-currency sar">&#xE900;</span></div>
  </div>
  <div class="summary-card c3">
    <div class="s-label">الإجمالي الكلي</div>
    <div class="s-value">${Number(summary.grand_total).toLocaleString('en-US',{minimumFractionDigits:2})} <span class="s-currency sar">&#xE900;</span></div>
  </div>
</div>

<div class="footer">نظام إدارة المغسلة — تم إنشاء هذا التقرير بتاريخ ${printDate}</div>
</body>
</html>`;
}

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
body{direction:rtl;background:#fff;color:#000;padding:16px;font-size:10px}
.header{text-align:center;margin-bottom:18px;border-bottom:2px solid #6366f1;padding-bottom:12px}
.header h1{font-size:18px;font-weight:700;color:#6366f1}
.header p{font-size:10px;color:#000;margin-top:4px}
.sub{font-size:10px;color:#000;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead tr{background:linear-gradient(90deg,#6366f1,#8b5cf6);color:#fff}
thead th{padding:9px 10px;font-size:10px;font-weight:700;text-align:right;white-space:nowrap}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr.even{background:#fafbfc}
tbody td{padding:8px 10px;font-size:10px;color:#000;text-align:right}
td.center,th.center{text-align:center}
td.sub-num{font-weight:700;color:#6366f1;text-align:center}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700}
.badge.active{background:rgba(34,197,94,.1);color:#16a34a}
.badge.inactive{background:rgba(100,116,139,.1);color:#000}
.summary{display:flex;gap:16px;margin-top:12px}
.summary-card{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;text-align:center;border-top:3px solid #6366f1}
.s-label{font-size:9px;color:#000;font-weight:700;margin-bottom:6px}
.s-value{font-size:15px;font-weight:700;color:#000}
.footer{text-align:center;font-size:9px;color:#000;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}
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

function buildExcelDataForProducts(exportRows, filters) {
  const printDate = formatDateSimple(new Date().toISOString());
  const rows = [
    ['تقرير الخدمات (المنتجات والأسعار) - نظام المغسلة'],
    [`تاريخ الطباعة: ${printDate}`],
  ];
  if (filters.search) {
    rows.push([`بحث: ${filters.search}`]);
  }
  rows.push([]);
  rows.push([
    '#', 'المنتج (عربي)', 'المنتج (إنجليزي)', 'صورة في القاعدة',
    'العملية (عربي)', 'العملية (إنجليزي)', 'السعر (\uE900)'
  ]);
  exportRows.forEach((r, i) => {
    rows.push([
      i + 1,
      r.product_name_ar || '',
      r.product_name_en || '',
      r.has_image ? 'نعم' : 'لا',
      r.service_name_ar || '',
      r.service_name_en || '',
      Number(r.price).toFixed(2)
    ]);
  });
  rows.push([]);
  rows.push(['', '', '', '', '', 'عدد الأسطر:', String(exportRows.length)]);
  return rows;
}

function buildPdfHtmlForProducts(exportRows, filters, cairoRegularB64, cairoBoldB64, saudiRiyalB64) {
  const printDate = formatDateSimple(new Date().toISOString());

  const tableRows = exportRows.map((r, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td class="center">${i + 1}</td>
      <td>${r.product_name_ar || '—'}</td>
      <td dir="ltr" class="ltr">${r.product_name_en || '—'}</td>
      <td class="center">${r.has_image ? 'نعم' : 'لا'}</td>
      <td>${r.service_name_ar || '—'}</td>
      <td dir="ltr" class="ltr">${r.service_name_en || '—'}</td>
      <td class="num"><span class="sar">&#xE900;</span> ${Number(r.price).toFixed(2)}</td>
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
body{direction:rtl;background:#fff;color:#000;padding:16px;font-size:9px}
.header{text-align:center;margin-bottom:18px;border-bottom:2px solid #10b981;padding-bottom:12px}
.header h1{font-size:18px;font-weight:700;color:#059669}
.header p{font-size:10px;color:#000;margin-top:4px}
.sub{font-size:10px;color:#000;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead tr{background:linear-gradient(90deg,#10b981,#059669);color:#fff}
thead th{padding:8px 6px;font-size:9px;font-weight:700;text-align:right;white-space:nowrap}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr.even{background:#fafbfc}
tbody td{padding:6px 6px;font-size:9px;color:#000;text-align:right}
td.center,th.center{text-align:center}
td.ltr{text-align:left}
td.num{font-weight:700;color:#000;text-align:left;direction:ltr}
.summary{display:flex;gap:16px;margin-top:12px}
.summary-card{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;text-align:center;border-top:3px solid #10b981}
.s-label{font-size:9px;color:#000;font-weight:700;margin-bottom:6px}
.s-value{font-size:15px;font-weight:700;color:#000}
.footer{text-align:center;font-size:9px;color:#000;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{
  @page{size:A4 landscape;margin:1cm}
  body{padding:0}
}
</style>
</head>
<body>
<div class="header">
  <h1>تقرير الخدمات (المنتجات والأسعار)</h1>
  <p>تاريخ الطباعة: ${printDate} &nbsp;|&nbsp; عدد أسطر التسعير: ${exportRows.length.toLocaleString()}</p>
  ${filterInfo}
</div>

<table>
  <thead>
    <tr>
      <th class="center" style="width:32px">#</th>
      <th>المنتج (عربي)</th>
      <th>المنتج (EN)</th>
      <th class="center">صورة</th>
      <th>العملية (عربي)</th>
      <th>العملية (EN)</th>
      <th>السعر</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>

<div class="summary">
  <div class="summary-card">
    <div class="s-label">إجمالي أسطر التسعير</div>
    <div class="s-value">${exportRows.length.toLocaleString()}</div>
  </div>
</div>

<div class="footer">نظام إدارة المغسلة — ${printDate}</div>
</body>
</html>`;
}
function subscriptionStatusLabelAr(s) {
  const map = { active: 'نشط', expired: 'منتهي', closed: 'مغلق', none: 'بدون فترة' };
  return map[s] || s || '—';
}

function ledgerEntryLabelAr(t) {
  const map = {
    purchase: 'شراء / تفعيل',
    renewal: 'تجديد',
    consumption: 'استهلاك',
    adjustment: 'تعديل',
    refund: 'استرجاع'
  };
  return map[t] || t || '—';
}

function escHtmlPdf(s) {
  if (s == null || s === '') return '—';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** يحوّل SUB-000003 إلى 3 للعرض */
function fmtSubRef(ref) {
  if (!ref) return '—';
  const m = String(ref).match(/^SUB-0*(\d+)$/i);
  return m ? m[1] : String(ref);
}

function buildNationalAddressPlain(branding) {
  if (!branding) return '';
  const parts = [];
  const line1 = [branding.buildingNumber, branding.streetNameAr].filter(Boolean).join(' ');
  if (line1) parts.push(line1);
  if (branding.districtAr) parts.push(branding.districtAr);
  if (branding.cityAr) parts.push(branding.cityAr);
  const zip = [branding.postalCode, branding.additionalNumber].filter(Boolean).join(' — ');
  if (zip) parts.push(zip);
  return parts.join('، ');
}

function buildExcelDataForSubscriptions(rows, filters) {
  const printDate = formatDateSimple(new Date().toISOString());
  const printTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const out = [
    ['تقرير الاشتراكات المسبقة — نظام المغسلة'],
    [`تاريخ الطباعة: ${printDate} ${printTime}`]
  ];
  if (filters.search) out.push([`بحث: ${filters.search}`]);
  if (filters.customerId) out.push([`عميل محدد: ${filters.customerId}`]);
  if (filters.statusFilter && filters.statusFilter !== 'all') {
    out.push([`الحالة: ${subscriptionStatusLabelAr(filters.statusFilter)}`]);
  }
  out.push([]);
  out.push([
    '#',
    'رقم الاشتراك',
    'اسم العميل',
    'الجوال',
    'الباقة',
    'من تاريخ',
    'إلى تاريخ',
    'الرصيد المتبقي (ر.س)',
    'الحالة'
  ]);
  rows.forEach((r, i) => {
    out.push([
      i + 1,
      r.customer_file_ref || r.subscription_ref || '—',
      r.customer_name || '',
      r.phone || '',
      r.package_name || '',
      formatDateSimple(r.period_from),
      formatDateSimple(r.period_to),
      r.credit_remaining != null ? Number(r.credit_remaining).toFixed(2) : '',
      subscriptionStatusLabelAr(r.display_status)
    ]);
  });
  out.push([]);
  out.push(['', '', '', '', '', '', '', `العدد: ${rows.length}`, '']);
  return out;
}

function buildPdfHtmlForSubscriptions(rows, filters, cairoRegularB64, cairoBoldB64, saudiRiyalB64) {
  const printDate = formatDateSimple(new Date().toISOString());
  const printTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const tableRows = rows.map((r, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td class="center">${i + 1}</td>
      <td class="sub-num">${escHtmlPdf(r.customer_file_ref || r.subscription_ref || '—')}</td>
      <td>${escHtmlPdf(r.customer_name)}</td>
      <td class="center" dir="ltr">${escHtmlPdf(r.phone)}</td>
      <td>${escHtmlPdf(r.package_name)}</td>
      <td class="center">${formatDateSimple(r.period_from)}</td>
      <td class="center">${formatDateSimple(r.period_to)}</td>
      <td class="num"><span class="sar">&#xE900;</span> ${r.credit_remaining != null ? Number(r.credit_remaining).toFixed(2) : '—'}</td>
      <td class="center">${subscriptionStatusLabelAr(r.display_status)}</td>
    </tr>
  `).join('');
  const filterInfo = (filters.search || (filters.statusFilter && filters.statusFilter !== 'all'))
    ? `<p class="sub">بحث: ${escHtmlPdf(filters.search || '—')} — الحالة: ${escHtmlPdf(filters.statusFilter || 'الكل')}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
.sar{font-family:'SaudiRiyal';font-weight:400;font-style:normal;font-size:1.1em;vertical-align:middle;display:inline-block;line-height:1}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
body{direction:rtl;background:#fff;color:#000;padding:16px;font-size:9px}
.header{text-align:center;margin-bottom:14px;border-bottom:2px solid #0d9488;padding-bottom:10px}
.header h1{font-size:16px;font-weight:700;color:#0d9488}
.sub{font-size:9px;color:#000;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:linear-gradient(90deg,#14b8a6,#0d9488);color:#fff}
thead th{padding:7px 6px;font-size:8px;font-weight:700;text-align:right;white-space:nowrap}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr.even{background:#fafbfc}
tbody td{padding:6px;font-size:8px;color:#000;text-align:right}
td.center,th.center{text-align:center}
td.num{text-align:left;direction:ltr;font-weight:700}
td.sub-num{font-weight:700;color:#000}
.footer{text-align:center;font-size:8px;color:#000;margin-top:12px;border-top:1px solid #e2e8f0;padding-top:6px}
@media print{@page{size:A4 landscape;margin:1cm}}
</style>
</head>
<body>
<div class="header">
  <h1>تقرير الاشتراكات المسبقة</h1>
  <p>تاريخ الطباعة: ${printDate} ${printTime} — عدد السجلات: ${rows.length}</p>
  ${filterInfo}
</div>
<table>
  <thead><tr>
    <th class="center">#</th><th>رقم الاشتراك</th><th>الاسم</th><th class="center">الجوال</th><th>الباقة</th>
    <th class="center">من</th><th class="center">إلى</th><th>الرصيد</th><th class="center">الحالة</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="footer">نظام إدارة المغسلة — ${printDate}</div>
</body>
</html>`;
}

function buildExcelDataForSubscriptionCustomerReport(report, filters) {
  const printDate = formatDateSimple(new Date().toISOString());
  const c = report.customer;
  const rows = [
    ['تقرير اشتراكات العميل — نظام المغسلة'],
    [`تاريخ الطباعة: ${printDate}`],
    [],
    ['بيانات العميل'],
    ['الاسم', c ? c.customer_name : '', 'الجوال', c ? c.phone : '', 'المدينة', c ? c.city : ''],
    [],
    ['الاشتراكات'],
    ['#', 'رقم الاشتراك', 'الباقة الحالية', 'تاريخ الإنشاء']
  ];
  (report.subscriptions || []).forEach((s, i) => {
    rows.push([
      i + 1,
      fmtSubRef(s.subscription_ref),
      s.package_name || '',
      formatDateSimple(s.created_at)
    ]);
  });
  rows.push([]);
  rows.push(['الفترات', '#', 'رقم الاشتراك', 'الباقة', 'من', 'إلى', 'مدفوع', 'رصيد ممنوح', 'متبقي', 'حالة الفترة']);
  let n = 1;
  (report.periods || []).forEach((p) => {
    const sub = (report.subscriptions || []).find((x) => x.id === p.customer_subscription_id);
    rows.push([
      '',
      n++,
      sub ? fmtSubRef(sub.subscription_ref) : p.customer_subscription_id,
      p.package_name || '',
      formatDateSimple(p.period_from),
      formatDateSimple(p.period_to),
      Number(p.prepaid_price_paid).toFixed(2),
      Number(p.credit_value_granted).toFixed(2),
      Number(p.credit_remaining).toFixed(2),
      p.status
    ]);
  });
  rows.push([]);
  rows.push(['سجل الحركات', '#', 'نوع القيد', 'المبلغ', 'الرصيد بعد العملية', 'ملاحظات', 'التاريخ']);
  (report.ledger || []).forEach((l, i) => {
    rows.push([
      '',
      i + 1,
      ledgerEntryLabelAr(l.entry_type),
      Number(l.amount).toFixed(2),
      Number(l.balance_after).toFixed(2),
      l.notes || '',
      formatDateSimple(l.created_at)
    ]);
  });
  rows.push([]);
  rows.push(['الفواتير المرتبطة', '#', 'رقم الفاتورة', 'التاريخ', 'المبلغ الإجمالي', 'المخصوم من الاشتراك', 'طريقة الدفع']);
  (report.invoices || []).forEach((inv, i) => {
    const pmMap = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك', other: 'أخرى' };
    rows.push([
      '',
      i + 1,
      inv.invoice_seq || inv.order_number || '',
      formatDateSimple(inv.created_at),
      Number(inv.total_amount).toFixed(2),
      Number(inv.deducted_amount).toFixed(2),
      pmMap[inv.payment_method] || inv.payment_method || ''
    ]);
  });
  return rows;
}

function buildPdfHtmlForSubscriptionCustomerReport(report, cairoRegularB64, cairoBoldB64, saudiRiyalB64) {
  const printDate = formatDateSimple(new Date().toISOString());
  const c = report.customer;
  const pmMap = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك', other: 'أخرى' };

  const custBlock = c
    ? `<div class="cust-grid">
        <div class="cust-field"><span class="cust-label">العميل</span><span class="cust-val">${escHtmlPdf(c.customer_name)}</span></div>
        <div class="cust-field"><span class="cust-label">الجوال</span><span class="cust-val" dir="ltr">${escHtmlPdf(c.phone)}</span></div>
        <div class="cust-field"><span class="cust-label">المدينة</span><span class="cust-val">${escHtmlPdf(c.city || '—')}</span></div>
      </div>`
    : '';

  const subRows = (report.subscriptions || []).map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtmlPdf(fmtSubRef(s.subscription_ref))}</td>
      <td>${escHtmlPdf(s.package_name)}</td>
      <td>${formatDateSimple(s.created_at)}</td>
    </tr>`).join('');

  const perRows = (report.periods || []).map((p, i) => {
    const sub = (report.subscriptions || []).find((x) => x.id === p.customer_subscription_id);
    const stClass = p.status === 'active' ? 'badge-act' : p.status === 'expired' ? 'badge-exp' : 'badge-cls';
    const stLabel = p.status === 'active' ? 'نشط' : p.status === 'expired' ? 'منتهي' : 'مغلق';
    return `<tr>
      <td>${i + 1}</td>
      <td>${escHtmlPdf(sub ? fmtSubRef(sub.subscription_ref) : '')}</td>
      <td>${escHtmlPdf(p.package_name)}</td>
      <td>${formatDateSimple(p.period_from)}</td>
      <td>${formatDateSimple(p.period_to)}</td>
      <td><span class="sar">&#xE900;</span> ${Number(p.prepaid_price_paid).toFixed(2)}</td>
      <td><span class="sar">&#xE900;</span> ${Number(p.credit_value_granted).toFixed(2)}</td>
      <td><span class="sar">&#xE900;</span> ${Number(p.credit_remaining).toFixed(2)}</td>
      <td><span class="badge ${stClass}">${stLabel}</span></td>
    </tr>`;
  }).join('');

  const ledRows = (report.ledger || []).map((l, i) => {
    const isConsumption = l.entry_type === 'consumption';
    const amtStyle = isConsumption ? 'color:#dc2626' : 'color:#16a34a';
    const amtSign  = isConsumption ? '−' : '+';
    return `<tr>
      <td>${i + 1}</td>
      <td>${ledgerEntryLabelAr(l.entry_type)}</td>
      <td style="${amtStyle}">${amtSign} <span class="sar">&#xE900;</span> ${Number(l.amount).toFixed(2)}</td>
      <td><span class="sar">&#xE900;</span> ${Number(l.balance_after).toFixed(2)}</td>
      <td>${escHtmlPdf(l.notes || '')}</td>
      <td>${formatDateSimple(l.created_at)}</td>
    </tr>`;
  }).join('');

  const invRows = (report.invoices || []).map((inv, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtmlPdf(String(inv.invoice_seq || inv.order_number || '—'))}</td>
      <td>${formatDateSimple(inv.created_at)}</td>
      <td><span class="sar">&#xE900;</span> ${Number(inv.total_amount).toFixed(2)}</td>
      <td><span class="sar">&#xE900;</span> ${Number(inv.deducted_amount).toFixed(2)}</td>
      <td>${escHtmlPdf(pmMap[inv.payment_method] || inv.payment_method || '—')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
.sar{font-family:'SaudiRiyal';font-size:1.05em;vertical-align:middle}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif;font-weight:700}
body{direction:rtl;background:#fff;color:#000;padding:14px;font-size:11px;font-weight:700}
.header{text-align:center;margin-bottom:12px;border-bottom:2px solid #0d9488;padding-bottom:8px}
.header h1{font-size:18px;color:#0d9488;font-weight:700}
.header p{font-size:10px;color:#000;margin-top:3px;font-weight:700}
/* بيانات العميل */
.cust-grid{display:flex;gap:0;margin:10px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
.cust-field{flex:1;padding:8px 10px;border-left:1px solid #e2e8f0;background:#f8fafc;text-align:center}
.cust-field:last-child{border-left:none}
.cust-label{display:block;font-size:9px;color:#000;font-weight:700;margin-bottom:3px}
.cust-val{display:block;font-size:12px;color:#000;font-weight:700}
/* عناوين الأقسام */
h2{font-size:12px;color:#0d9488;font-weight:700;margin:14px 0 5px;padding-bottom:3px;border-bottom:1.5px solid #ccfbf1}
/* الجداول */
table{width:100%;border-collapse:collapse;margin-bottom:4px}
thead tr{background:#0d9488;color:#fff}
thead th{padding:6px 7px;font-size:10px;text-align:center;font-weight:700;white-space:nowrap}
tbody td{padding:5px 7px;font-size:10px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:middle;font-weight:700}
tbody tr:nth-child(even){background:#f8fafc}
/* badges */
.badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700}
.badge-act{background:#dcfce7;color:#16a34a}
.badge-exp{background:#fee2e2;color:#dc2626}
.badge-cls{background:#f1f5f9;color:#000}
.footer{text-align:center;font-size:9px;color:#000;margin-top:12px;padding-top:6px;border-top:1px solid #e2e8f0;font-weight:700}
@media print{@page{size:A4 landscape;margin:0.8cm}}
</style>
</head>
<body>
<div class="header">
  <h1>تقرير اشتراكات العميل</h1>
  <p>تاريخ الطباعة: ${printDate}</p>
</div>
${custBlock}
<h2>الاشتراكات</h2>
<table>
  <thead><tr><th>#</th><th>رقم الاشتراك</th><th>الباقة</th><th>تاريخ الإنشاء</th></tr></thead>
  <tbody>${subRows || '<tr><td colspan="4">—</td></tr>'}</tbody>
</table>
<h2>الفترات</h2>
<table>
  <thead><tr><th>#</th><th>اشتراك</th><th>الباقة</th><th>من</th><th>إلى</th><th>مدفوع</th><th>ممنوح</th><th>متبقي</th><th>الحالة</th></tr></thead>
  <tbody>${perRows || '<tr><td colspan="9">—</td></tr>'}</tbody>
</table>
<h2>سجل الحركات</h2>
<table>
  <thead><tr><th>#</th><th>النوع</th><th>المبلغ</th><th>الرصيد بعد</th><th>ملاحظات</th><th>التاريخ</th></tr></thead>
  <tbody>${ledRows || '<tr><td colspan="6">—</td></tr>'}</tbody>
</table>
<h2>الفواتير المرتبطة</h2>
<table>
  <thead><tr><th>#</th><th>رقم الفاتورة</th><th>التاريخ</th><th>المبلغ الإجمالي</th><th>المخصوم من الاشتراك</th><th>طريقة الدفع</th></tr></thead>
  <tbody>${invRows || '<tr><td colspan="6">لا توجد فواتير مرتبطة</td></tr>'}</tbody>
</table>
<div class="footer">نظام إدارة المغسلة</div>
</body>
</html>`;
}

function buildPdfHtmlForSubscriptionReceipt(d, cairoRegularB64, cairoBoldB64, saudiRiyalB64, branding = {}) {
  const b = branding || {};
  const printDate = formatDateSimple(new Date().toISOString());
  const printTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const shopName = b.laundryNameAr || b.laundryNameEn || 'نظام المغسلة';
  const shopAddress = [b.streetNameAr, b.districtAr, b.cityAr].filter(Boolean).join('، ');
  const R = (n) => `<span class="sar">&#xE900;</span> ${fmt(n)}`;

  const logoHtml = b.logoDataUrl
    ? `<img src="${b.logoDataUrl.replace(/"/g, '%22')}" class="hdr-logo-img" alt="logo" />`
    : `<svg class="hdr-logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;

  const metaParts = [];
  if (b.vatNumber) metaParts.push(`الرقم الضريبي: ${escHtmlPdf(b.vatNumber)}`);
  if (b.commercialRegister) metaParts.push(`السجل التجاري: ${escHtmlPdf(b.commercialRegister)}`);
  const nat = buildNationalAddressPlain(b);
  if (nat) metaParts.push(escHtmlPdf(nat));

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
.sar{font-family:'SaudiRiyal';font-weight:400;font-style:normal;font-size:1.08em;vertical-align:middle;display:inline-block;line-height:1}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
body{direction:rtl;background:#f1f5f9;color:#000;font-size:10.5px}
@page{size:A4;margin:0}
.page{background:#fff;width:100%;min-height:100vh;display:flex;flex-direction:column}

/* Header */
.hdr{background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 55%,#0284c7 100%);padding:18px 24px;color:#fff;display:flex;align-items:center;gap:13px}
.hdr-logo{width:50px;height:50px;border-radius:10px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.hdr-logo-img{max-width:46px;max-height:46px;object-fit:contain}
.hdr-logo-svg{width:28px;height:28px;color:#fff}
.hdr-info{flex:1;min-width:0}
.hdr-shop{font-size:17px;font-weight:900;line-height:1.2;letter-spacing:.2px}
.hdr-sub{font-size:9.5px;font-weight:400;opacity:.82;margin-top:3px}
.hdr-right{margin-right:auto;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.hdr-badge{background:rgba(255,255,255,.22);border-radius:20px;padding:4px 14px;font-size:10px;font-weight:700;white-space:nowrap}
.hdr-ts{font-size:8.5px;opacity:.72;text-align:left}

/* Info bar */
.info-bar{background:#dbeafe;border-bottom:2px solid #93c5fd;padding:6px 22px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#000;font-weight:700}

/* Body */
.body{padding:16px 22px;display:flex;flex-direction:column;gap:14px;flex:1}

/* Section card */
.sec{border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;background:#fff}
.sec-hdr{background:linear-gradient(90deg,#1e3a8a,#2563eb);padding:8px 14px;color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;gap:8px}
.sec-hdr svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.sec-body{padding:12px 14px}

/* KV rows */
.kv{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:10.5px}
.kv:last-child{border-bottom:none;padding-bottom:0}
.kv:first-child{padding-top:0}
.kv-lbl{color:#000;font-weight:700;display:flex;align-items:center;gap:6px}
.kv-val{color:#000;font-weight:800}
.kv-val.num{direction:ltr;text-align:left;white-space:nowrap}
.kv-val.ltr{direction:ltr;unicode-bidi:embed}

/* Highlight rows */
.kv.hl{background:#eff6ff;border-radius:6px;padding:8px 10px;margin-bottom:6px;border:none}
.kv.hl .kv-lbl{color:#000}
.kv.hl .kv-val{color:#000;font-size:11px}
.kv.total{background:#dcfce7;border-radius:6px;padding:8px 10px;border:none}
.kv.total .kv-lbl{color:#000}
.kv.total .kv-val{color:#000;font-size:11.5px}

/* Table */
table{width:100%;border-collapse:collapse;font-size:10px}
thead th{padding:7px 10px;background:#1e3a8a;color:#fff;font-weight:700;text-align:right;font-size:9.5px;white-space:nowrap}
thead th.num{text-align:left;direction:ltr}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:last-child{border-bottom:none}
tbody td{padding:6px 10px;color:#000;text-align:right;vertical-align:middle;font-size:10px}
tbody td.num{font-weight:700;color:#000;text-align:left;direction:ltr;white-space:nowrap}
.tbl-foot td{background:#f0f9ff;font-weight:900;font-size:10px;color:#000;border-top:2px solid #bae6fd;padding:6px 10px}
.tbl-foot td.num{color:#000!important}

/* Footer */
.footer{border-top:2px solid #e2e8f0;padding:10px 22px;background:#f8fafc;display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:auto}
.footer-brand{font-size:10px;font-weight:900;color:#000;text-align:center}
.footer-meta{font-size:9px;color:#000;text-align:center}
.footer-thanks{font-size:11px;font-weight:900;color:#000;margin-top:4px}
</style>
</head>
<body>
<div class="page">

<div class="hdr">
  <div class="hdr-logo">${logoHtml}</div>
  <div class="hdr-info">
    <div class="hdr-shop">${escHtmlPdf(shopName)}</div>
    <div class="hdr-sub">${shopAddress ? escHtmlPdf(shopAddress) : 'إيصال اشتراك مسبق الدفع'}</div>
  </div>
  <div class="hdr-right">
    <div class="hdr-badge">إيصال اشتراك</div>
    <div class="hdr-ts">🖨️ ${printDate} ${printTime}</div>
  </div>
</div>

<div class="info-bar">
  <span>تاريخ الإصدار: ${printDate}</span>
  ${metaParts.length ? `<span>${metaParts.join(' &nbsp;·&nbsp; ')}</span>` : ''}
</div>

<div class="body">

<!-- بيانات العميل -->
<div class="sec">
  <div class="sec-hdr">
    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    <span>بيانات العميل</span>
  </div>
  <div class="sec-body">
    <div class="kv"><span class="kv-lbl">اسم العميل</span><span class="kv-val">${escHtmlPdf(d.customer_name || '—')}</span></div>
    <div class="kv"><span class="kv-lbl">رقم الجوال</span><span class="kv-val ltr">${escHtmlPdf(d.phone || '—')}</span></div>
    <div class="kv"><span class="kv-lbl">المدينة</span><span class="kv-val">${escHtmlPdf(d.city || '—')}</span></div>
    <div class="kv"><span class="kv-lbl">تاريخ ووقت الإصدار</span><span class="kv-val ltr">${printDate} ${printTime}</span></div>
    <div class="kv total"><span class="kv-lbl">رقم الاشتراك</span><span class="kv-val">${escHtmlPdf(d.customer_file_ref || d.subscription_ref || '—')}</span></div>
  </div>
</div>

<!-- تفاصيل الباقة -->
<div class="sec">
  <div class="sec-hdr">
    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="11" y2="17"/></svg>
    <span>تفاصيل الباقة والفترة</span>
  </div>
  <div class="sec-body">
    <table>
      <thead><tr><th>البيان</th><th class="num">القيمة</th></tr></thead>
      <tbody>
        <tr><td>اسم الباقة</td><td class="num">${escHtmlPdf(d.package_name || '—')}</td></tr>
        <tr><td>المبلغ المدفوع مسبقاً</td><td class="num">${R(d.prepaid_price_paid)}</td></tr>
        <tr><td>رصيد الخدمات الممنوح</td><td class="num">${R(d.credit_value_granted)}</td></tr>
        <tr><td>مدة الباقة</td><td class="num">${d.duration_days || '—'} يوماً</td></tr>
        <tr><td>من تاريخ</td><td class="num">${formatDateSimple(d.period_from)}</td></tr>
        <tr><td>إلى تاريخ</td><td class="num">${formatDateSimple(d.period_to)}</td></tr>
      </tbody>
      <tfoot class="tbl-foot"><tr><td>الرصيد المتبقي</td><td class="num">${R(d.credit_remaining)}</td></tr></tfoot>
    </table>
  </div>
</div>

</div>

<div class="footer">
  <span class="footer-brand">${escHtmlPdf(shopName)}${b.vatNumber ? ' &nbsp;·&nbsp; الرقم الضريبي: ' + escHtmlPdf(b.vatNumber) : ''}${b.commercialRegister ? ' &nbsp;·&nbsp; س.ت: ' + escHtmlPdf(b.commercialRegister) : ''}</span>
  <span class="footer-meta">تم إصدار هذا الإيصال بتاريخ ${printDate} ${printTime}</span>
  <span class="footer-thanks">شكراً لتعاملكم معنا 🤝</span>
</div>

</div>
</body>
</html>`;
}

/** إيصال ضيق لطابعات الحرارية (عرض ~80مم) */
function buildThermalSubscriptionReceiptHtml(d, cairoRegularB64, cairoBoldB64, saudiRiyalB64, branding = {}) {
  const printDate = formatDateSimple(new Date().toISOString());
  const printTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const b = branding || {};
  const hasCo = b.laundryNameAr && String(b.laundryNameAr).trim();
  const h1Title = hasCo ? escHtmlPdf(b.laundryNameAr) : 'إيصال اشتراك';
  const subHtml = hasCo
    ? `إيصال اشتراك<br/>${escHtmlPdf(printDate)} ${printTime}`
    : `${escHtmlPdf(printDate)} ${printTime}`;
  const logoThermal = b.logoDataUrl
    ? `<div class="logo-t"><img src="${b.logoDataUrl.replace(/"/g, '%22')}" alt="" style="max-height:36px;max-width:100%;object-fit:contain"/></div>`
    : '';
  const metaThermal = [];
  if (b.vatNumber && String(b.vatNumber).trim()) {
    metaThermal.push(`الرقم الضريبي: ${escHtmlPdf(b.vatNumber)}`);
  }
  if (b.commercialRegister && String(b.commercialRegister).trim()) {
    metaThermal.push(`س.ت: ${escHtmlPdf(b.commercialRegister)}`);
  }
  const natT = buildNationalAddressPlain(b);
  if (natT) metaThermal.push(escHtmlPdf(natT));
  const metaBlockThermal = metaThermal.length
    ? `<p class="meta">${metaThermal.join('<br/>')}</p>`
    : '';
  /* DOM: رقم ثم رمز + row-reverse + ltr = يظهر الرمز يسار الرقم (يتفادى إعادة ترتيب bidi في الطباعة) */
  const amt = (n) =>
    `<td class="val"><span class="amt"><span class="num">${Number(n).toFixed(2)}</span><span class="sar" aria-hidden="true">&#xE900;</span></span></td>`;
  const row2 = (lbl, valInner, valClass = '') =>
    `<tr><td class="lbl">${lbl}</td><td class="val ${valClass}">${valInner}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
/* خط عريض موحّد؛ فواصل صلبة (لا منقط/شرطات تتكسر على الحراري) */
@font-face{font-family:'CairoThermal';font-weight:700;font-style:normal;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;font-style:normal;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
*{box-sizing:border-box;margin:0;padding:0;color:#000;font-family:'CairoThermal','Cairo',sans-serif;font-weight:700;-webkit-font-smoothing:antialiased}
.sar{font-family:'SaudiRiyal','CairoThermal',sans-serif;font-size:1.12em;font-weight:400;line-height:1;vertical-align:middle;color:#000}
body{direction:rtl;background:#fff;color:#000;width:72mm;max-width:72mm;padding:1.5mm 2mm;font-size:10px;line-height:1.25;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1{text-align:center;font-size:12px;font-weight:700;margin:0 0 2px;color:#000}
.sub{text-align:center;font-size:9px;font-weight:700;margin:0 0 4px;color:#000}
.rule{height:0;border:0;border-top:2px solid #000;margin:3px 0}
.kv{width:100%;border-collapse:collapse;table-layout:auto;font-size:10px;font-weight:700}
.kv td{border-bottom:2px solid #000;padding:2px 0;vertical-align:middle}
.kv .lbl{white-space:nowrap;text-align:right;padding-left:5px;color:#000}
.kv .val{text-align:left;direction:ltr;font-weight:700;color:#000}
.kv .val.name-rtl{direction:rtl;text-align:left;word-break:break-word}
.kv .val .amt{display:inline-flex;flex-direction:row-reverse;align-items:center;justify-content:flex-end;gap:4px;direction:ltr;unicode-bidi:isolate;font-weight:700}
.amt .num{font-variant-numeric:tabular-nums;font-weight:700;color:#000}
.logo-t{text-align:center;margin:0 0 3px}
.meta{text-align:center;font-size:8px;font-weight:700;margin:0 0 4px;line-height:1.25;word-break:break-word}
.block{margin:4px 0;padding:3px;border:2px solid #000}
.block .kv{margin:0}
.block h2{font-size:9px;font-weight:700;margin:0 0 3px;padding-bottom:2px;border-bottom:2px solid #000;color:#000}
.footer{text-align:center;margin-top:6px;font-size:9px;font-weight:700;color:#000}
@media print{
  @page{size:80mm auto;margin:0}
  html,body{overflow:visible!important;height:auto!important;max-height:none!important}
  body{width:72mm;max-width:72mm;padding:1.5mm 2mm}
  *{color:#000!important}
  .kv td,.rule,.block{border-color:#000!important}
}
</style>
</head>
<body>
  ${logoThermal}
  <h1>${h1Title}</h1>
  <p class="sub">${subHtml}</p>
  ${metaBlockThermal}
  <div class="rule" aria-hidden="true"></div>
  <table class="kv" role="presentation">
    <tbody>
      ${row2('رقم الاشتراك', escHtmlPdf(d.customer_file_ref || d.subscription_ref || '—'))}
      ${row2('العميل', escHtmlPdf(d.customer_name), 'name-rtl')}
      ${row2('الجوال', escHtmlPdf(d.phone))}
    </tbody>
  </table>
  <div class="block">
    <h2>الباقة / الفترة</h2>
    <table class="kv" role="presentation">
      <tbody>
        ${row2('الباقة', escHtmlPdf(d.package_name), 'name-rtl')}
        <tr><td class="lbl">مدفوع</td>${amt(d.prepaid_price_paid)}</tr>
        <tr><td class="lbl">رصيد ممنوح</td>${amt(d.credit_value_granted)}</tr>
        <tr><td class="lbl">متبقي</td>${amt(d.credit_remaining)}</tr>
        ${row2('من', formatDateSimple(d.period_from))}
        ${row2('إلى', d.period_to ? formatDateSimple(d.period_to) : '—')}
        ${d.period_to ? row2('المدة', `${d.duration_days} يوم`) : ''}
      </tbody>
    </table>
  </div>
  <p class="footer">شكراً لتعاملكم معنا</p>
</body>
</html>`;
}

function buildThermalInvoiceHtml(order, cairoRegularB64, cairoBoldB64, saudiRiyalB64, branding = {}) {
  const b = branding || {};
  const printDate = formatDateSimple(new Date().toISOString());
  const invoiceNum = order.invoice_seq || order.order_number || order.id;
  const vatRate = Number(order.vat_rate || 0);
  const priceMode = order.price_display_mode || 'exclusive';
  
  // Logo
  const logoHtml = b.logoDataUrl
    ? `<div class="logo-wrap"><img src="${b.logoDataUrl.replace(/"/g, '%22')}" alt="Logo" style="max-height:50px;max-width:100%;object-fit:contain"/></div>`
    : '';
  
  // Header info
  const shopNameAr = b.laundryNameAr || 'المغسلة';
  const vatNumber = b.vatNumber || '';
  const commercialRegister = b.commercialRegister || '';
  
  // Payment method
  const pmMap = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك', other: 'أخرى' };
  const paymentMethod = pmMap[order.payment_method] || order.payment_method || 'نقداً';
  
  // Customer info
  const custName = order.customer_name || '—';
  const custPhone = order.phone || '—';
  
  // Items - format like in the image
  const sarSpan = '<span class="sar">&#xE900;</span>';
  const itemsHtml = (order.items || []).map((it, i) => {
    const qty = it.quantity || 1;
    const unitPrice = Number(it.unit_price || 0).toFixed(2);
    const productName = escHtmlPdf(it.product_name_ar || it.product_name_en || '');
    const serviceName = escHtmlPdf(it.service_name_ar || it.service_name_en || '');
    return `<div class="item-row">
      <div class="item-num">${i + 1} × ${unitPrice}</div>
      <div class="item-desc">.${i + 1} ${productName} (${serviceName})</div>
    </div>`;
  }).join('');
  
  // Totals
  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discount_amount || 0);
  const vatAmount = Number(order.vat_amount || 0);
  const total = Number(order.total_amount || 0);
  
  const discountRow = discount > 0
    ? `<div class="total-row"><span class="total-label">الخصم</span><span class="total-val">${sarSpan} ${discount.toFixed(2)}</span></div>`
    : '';
  
  const subtotalLabel = vatRate > 0 ? 'المجموع قبل الضريبة' : 'المجموع';
  const totalLabel = vatRate > 0 ? 'الإجمالي شامل الضريبة' : 'الإجمالي';
  const vatLabel = vatRate > 0 ? `ضريبة ${vatRate}%` : 'ضريبة 15%';
  
  const vatRow = vatRate > 0
    ? `<div class="total-row"><span class="total-label">${vatLabel}</span><span class="total-val">${sarSpan} ${vatAmount.toFixed(2)}</span></div>`
    : '';
  
  // Mixed payment
  const paidCash = Number(order.paid_cash || 0);
  const paidCard = Number(order.paid_card || 0);
  const mixedRows = (paidCash > 0 || paidCard > 0) && order.payment_method === 'mixed'
    ? `<div class="total-row mixed"><span class="total-label">المدفوع كاش</span><span class="total-val">${sarSpan} ${paidCash.toFixed(2)}</span></div>
       <div class="total-row mixed"><span class="total-label">المدفوع شبكة</span><span class="total-val">${sarSpan} ${paidCard.toFixed(2)}</span></div>`
    : '';
  
  // Subscription info
  const subRefRow = order.subscription && order.subscription.subscription_number
    ? `<div class="info-row"><span class="info-label">رقم الاشتراك</span><span class="info-val">${escHtmlPdf(order.subscription.subscription_number)}</span></div>`
    : '';

  const subPackageRow = order.subscription && order.subscription.package_name
    ? `<div class="info-row"><span class="info-label">الباقة</span><span class="info-val">${escHtmlPdf(order.subscription.package_name)}</span></div>`
    : '';

  const subBalanceRow = order.subscription && order.subscription.credit_remaining != null
    ? `<div class="info-row"><span class="info-label">الرصيد</span><span class="info-val">${sarSpan} ${Number(order.subscription.credit_remaining).toFixed(2)}</span></div>`
    : '';
  
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<title>فاتورة ${invoiceNum}</title>
<style>
@font-face{font-family:'Cairo';font-weight:700 900;font-style:normal;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;font-style:normal;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}

*{box-sizing:border-box;margin:0;padding:0}
body{
  direction:rtl;
  background:#fff;
  color:#000;
  width:80mm;
  max-width:80mm;
  padding:3mm 4mm;
  font-family:'Cairo',sans-serif;
  font-size:11px;
  font-weight:700;
  line-height:1.3;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
.sar{font-family:'SaudiRiyal',sans-serif;font-size:1.1em;font-weight:400;vertical-align:middle}

.logo-wrap{text-align:center;margin:0 0 3mm}
.header-title{text-align:center;font-size:14px;font-weight:900;margin:0 0 2mm;color:#000}
.header-subtitle{text-align:center;font-size:10px;font-weight:700;margin:0 0 1mm;color:#000}
.header-date{text-align:center;font-size:10px;font-weight:700;margin:0 0 2mm;color:#000}
.header-meta{text-align:center;font-size:9px;font-weight:700;margin:0 0 3mm;color:#000;line-height:1.4}

.divider{
  height:0;
  border:0;
  border-top:2px solid #000;
  margin:2mm 0;
}

.info-section{
  border:2px solid #000;
  padding:2mm 3mm;
  margin-bottom:2mm;
}
.info-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:1.5mm 0;
  border-bottom:1px solid #000;
  font-size:10px;
}
.info-row:last-child{border-bottom:none}
.info-label{color:#000;font-weight:700}
.info-val{color:#000;font-weight:900;text-align:left;direction:ltr}

.items-section{
  border:2px solid #000;
  padding:2mm 3mm;
  margin-bottom:2mm;
}
.items-title{
  font-size:10px;
  font-weight:900;
  color:#000;
  text-align:center;
  padding-bottom:2mm;
  margin-bottom:2mm;
  border-bottom:2px solid #000;
}
.item-row{
  padding:1.5mm 0;
  border-bottom:1px solid #000;
  font-size:10px;
}
.item-row:last-child{border-bottom:none}
.item-num{
  font-weight:900;
  color:#000;
  text-align:left;
  direction:ltr;
  margin-bottom:1mm;
}
.item-desc{
  font-weight:700;
  color:#000;
  text-align:right;
  direction:rtl;
}

.totals-section{
  margin-bottom:2mm;
}
.total-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:2mm 3mm;
  border-bottom:2px solid #000;
  font-size:10px;
  background:#fff;
}
.total-row:last-child{border-bottom:none}
.total-row.grand{
  font-size:11px;
  font-weight:900;
  border-top:2px solid #000;
}
.total-row.mixed{
  font-size:9px;
  border-top:1px dashed #ccc;
  border-bottom:1px solid #ccc;
}
.total-label{color:#000;font-weight:700}
.total-val{color:#000;font-weight:900;text-align:left;direction:ltr}

.footer{
  text-align:center;
  font-size:9px;
  font-weight:700;
  color:#000;
  margin-top:3mm;
  padding-top:2mm;
  border-top:1px solid #000;
}

@media print{
  @page{size:80mm auto;margin:0}
  html,body{overflow:visible!important;height:auto!important;max-height:none!important}
  body{width:80mm;max-width:80mm;padding:3mm 4mm}
  *{color:#000!important}
  .divider,.info-row,.item-row,.total-row,.info-section,.items-section{border-color:#000!important}
}
</style>
</head>
<body>
  ${logoHtml}
  <div class="header-title">${escHtmlPdf(shopNameAr)}</div>
  <div class="header-subtitle">فاتورة ضريبية مبسطة</div>
  <div class="header-date">${escHtmlPdf(printDate)}</div>
  ${vatNumber ? `<div class="header-meta">الرقم الضريبي: ${escHtmlPdf(vatNumber)}</div>` : ''}
  
  <div class="divider"></div>
  
  <div class="info-section">
    <div class="info-row">
      <span class="info-label">رقم الفاتورة</span>
      <span class="info-val">${escHtmlPdf(String(invoiceNum))}</span>
    </div>
    <div class="info-row">
      <span class="info-label">التاريخ</span>
      <span class="info-val">${formatDateSimple(order.created_at)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">طريقة الدفع</span>
      <span class="info-val">${paymentMethod}</span>
    </div>
    ${custName !== '—' ? `<div class="info-row"><span class="info-label">العميل</span><span class="info-val">${escHtmlPdf(custName)}</span></div>` : ''}
    ${custPhone !== '—' ? `<div class="info-row"><span class="info-label">الجوال</span><span class="info-val">${escHtmlPdf(custPhone)}</span></div>` : ''}
    ${subRefRow}
    ${subPackageRow}
    ${subBalanceRow}
    ${order.starch ? `<div class="info-row"><span class="info-label">نشا</span><span class="info-val">${escHtmlPdf(order.starch)}</span></div>` : ''}
    ${order.bluing ? `<div class="info-row"><span class="info-label">النيلة</span><span class="info-val">${escHtmlPdf(order.bluing)}</span></div>` : ''}
  </div>
  
  <div class="items-section">
    <div class="items-title">الأصناف</div>
    ${itemsHtml}
  </div>
  
  <div class="totals-section">
    <div class="total-row">
      <span class="total-label">${subtotalLabel}</span>
      <span class="total-val">${sarSpan} ${subtotal.toFixed(2)}</span>
    </div>
    ${discountRow}
    ${vatRow}
    <div class="total-row grand">
      <span class="total-label">${totalLabel}</span>
      <span class="total-val">${sarSpan} ${total.toFixed(2)}</span>
    </div>
    ${mixedRows}
  </div>
  
  <div class="footer">شكراً لتعاملكم معنا</div>
</body>
</html>`;
}

function buildInvoicePdfHtml(order, cairoRegularB64, cairoBoldB64, saudiRiyalB64, branding = {}) {
  const b = branding || {};
  const printDate = formatDateSimple(new Date().toISOString());
  const invoiceNum = order.invoice_seq || order.order_number || order.id;
  const vatRate = Number(order.vat_rate || 0);
  const priceMode = order.price_display_mode || 'exclusive';
  
  // Logo - show only if exists
  const logoImg = b.logoDataUrl
    ? `<img src="${b.logoDataUrl.replace(/"/g, '%22')}" alt="Logo" style="max-height:70px;max-width:100px;object-fit:contain;display:block"/>`
    : '';
  
  // Header info
  const shopNameAr = b.laundryNameAr || 'المغسلة';
  const shopNameEn = b.laundryNameEn || 'Laundry';
  const shopAddressAr = b.shopAddressAr || '';
  const shopAddressEn = b.shopAddressEn || '';
  const shopPhone = b.shopPhone || '';
  const shopEmail = b.shopEmail || '';
  const vatNumber = b.vatNumber || '';
  const commercialRegister = b.commercialRegister || '';
  
  // Items
  const sarSpan = '<span style="font-family:SaudiRiyal;">&#xE900;</span>';
  const itemsHtml = (order.items || []).map((it, i) => {
    const lineTotal = Number(it.line_total || 0);
    let net, itemVat, gross;
    if (vatRate > 0) {
      if (priceMode === 'inclusive') {
        net = lineTotal / (1 + vatRate / 100);
        itemVat = lineTotal - net;
        gross = lineTotal;
      } else {
        net = lineTotal;
        itemVat = lineTotal * vatRate / 100;
        gross = lineTotal + itemVat;
      }
    } else {
      net = lineTotal;
      itemVat = 0;
      gross = lineTotal;
    }
    
    let nameCell = escHtmlPdf(it.product_name_ar || '');
    if (it.product_name_en && it.product_name_en !== it.product_name_ar) {
      nameCell += '<span class="a4-td-en">' + escHtmlPdf(it.product_name_en) + '</span>';
    }
    let svcCell = escHtmlPdf(it.service_name_ar || '—');
    if (it.service_name_en && it.service_name_en !== it.service_name_ar) {
      svcCell += '<span class="a4-td-en">' + escHtmlPdf(it.service_name_en) + '</span>';
    }
    
    return `<tr>
      <td class="a4-td-num">${i + 1}</td>
      <td class="a4-td-name">${nameCell}</td>
      <td class="a4-td-name">${svcCell}</td>
      <td class="a4-td-num">${it.quantity || 1}</td>
      <td class="a4-td-num">${sarSpan} ${Number(it.unit_price || 0).toFixed(2)}</td>
      <td class="a4-td-num">${sarSpan} ${net.toFixed(2)}</td>
      <td class="a4-td-num">${sarSpan} ${itemVat.toFixed(2)}</td>
      <td class="a4-td-num">${sarSpan} ${gross.toFixed(2)}</td>
    </tr>`;
  }).join('');
  
  // Payment method
  const pmMap = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك', other: 'أخرى' };
  const paymentMethod = pmMap[order.payment_method] || order.payment_method || 'نقداً';
  
  // Totals
  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discount_amount || 0);
  const vatAmount = Number(order.vat_amount || 0);
  const total = Number(order.total_amount || 0);
  
  const discountRow = discount > 0
    ? `<div class="a4-trow" id="a4DiscRow"><span>الخصم / Discount</span><b class="a4-neg" dir="ltr">${sarSpan} ${discount.toFixed(2)}</b></div>`
    : '';
  
  const subtotalLabel = vatRate > 0 ? 'المجموع قبل الضريبة / Subtotal' : 'المجموع / Subtotal';
  const totalLabel = vatRate > 0 ? 'الإجمالي شامل الضريبة / Grand Total' : 'الإجمالي / Total';
  const vatLabel = vatRate > 0 ? `ضريبة القيمة المضافة ${vatRate}%` : 'ضريبة 15%';
  
  const vatRow = vatRate > 0
    ? `<div class="a4-trow" id="a4VatRow"><span>${vatLabel} / VAT</span><b dir="ltr">${sarSpan} ${vatAmount.toFixed(2)}</b></div>`
    : '';
  
  // Mixed payment
  const paidCash = Number(order.paid_cash || 0);
  const paidCard = Number(order.paid_card || 0);
  const mixedCashRow = (paidCash > 0) && order.payment_method === 'mixed'
    ? `<div class="a4-trow a4-mixed-row" id="a4MixedCashRow">
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:middle;margin-left:4px">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          المدفوع كاش
        </span>
        <b dir="ltr">${sarSpan} ${paidCash.toFixed(2)}</b>
      </div>`
    : '';
  
  const mixedCardRow = (paidCard > 0) && order.payment_method === 'mixed'
    ? `<div class="a4-trow a4-mixed-row" id="a4MixedCardRow">
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:middle;margin-left:4px">
            <rect x="1" y="4" width="22" height="16" rx="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          المدفوع شبكة
        </span>
        <b dir="ltr">${sarSpan} ${paidCard.toFixed(2)}</b>
      </div>`
    : '';

  const mixedRows = [mixedCashRow, mixedCardRow].filter(Boolean).join('');

  // Customer info
  const custName = order.customer_name || '—';
  const custPhone = order.phone || '—';
  
  // Subscription info
  const subRefRow = order.subscription && order.subscription.subscription_number
    ? `<div class="a4-kv" id="a4RowSubRef"><span>رقم الاشتراك / Sub #</span><b>${escHtmlPdf(order.subscription.subscription_number)}</b></div>`
    : '';

  const subPackageRow = order.subscription && order.subscription.package_name
    ? `<div class="a4-kv" id="a4RowSubPackage"><span>الباقة / Package</span><b>${escHtmlPdf(order.subscription.package_name)}</b></div>`
    : '';

  const subBalanceRow = order.subscription && order.subscription.credit_remaining != null
    ? `<div class="a4-kv" id="a4RowSubBalance"><span>الرصيد / Balance</span><b dir="ltr">${sarSpan} ${Number(order.subscription.credit_remaining).toFixed(2)}</b></div>`
    : '';

  const subRows = [subRefRow, subPackageRow, subBalanceRow].filter(Boolean).join('');
  
  // Order dates
  const paidAtRow = order.paid_at
    ? `<div class="a4-kv" id="a4RowPaidAt"><span>تاريخ السداد / Paid</span><b dir="ltr">${formatDateSimple(order.paid_at)}</b></div>`
    : '';
  
  const cleanedAtRow = order.cleaning_date
    ? `<div class="a4-kv" id="a4RowCleanedAt"><span>تاريخ التنظيف / Cleaned</span><b dir="ltr">${formatDateSimple(order.cleaning_date)}</b></div>`
    : '';
  
  const deliveredAtRow = order.delivery_date
    ? `<div class="a4-kv" id="a4RowDeliveredAt"><span>تاريخ التسليم / Delivered</span><b dir="ltr">${formatDateSimple(order.delivery_date)}</b></div>`
    : '';
  
  // QR Code placeholder (will be empty in PDF but maintains structure)
  const qrHtml = `<div class="a4-qr-box">
    <div id="a4QR" class="a4-qr"></div>
  </div>`;
  
  // Footer notes
  const notesHtml = order.invoice_notes
    ? `<div id="a4FooterNotes" class="a4-notes-box">
        <span class="a4-notes-title">الشروط والأحكام (Terms):</span>
        <span class="a4-notes-content">${escHtmlPdf(order.invoice_notes)}</span>
      </div>`
    : '';
  
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<title>فاتورة ${invoiceNum}</title>
<style>
@font-face{font-family:'Cairo';src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2');font-weight:700 900;font-style:normal}
@font-face{font-family:'Cairo';src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2');font-weight:400 600;font-style:normal}
@font-face{font-family:'SaudiRiyal';src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff');font-weight:normal;font-style:normal}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;font-family:'Cairo',sans-serif;direction:rtl;max-width:100%;overflow-x:hidden}
.a4-paper{width:210mm;min-height:297mm;padding:8mm 10mm 18mm;margin:0 auto;background:#fff;color:#000;font-size:9.5pt;font-weight:700;line-height:1.4;position:relative}
.a4-header{display:grid;grid-template-columns:1fr 110px 1fr;gap:2mm 4mm;align-items:center;padding-bottom:1mm;margin-bottom:0}
.a4-header-ar{text-align:right;direction:rtl;grid-column:1;grid-row:1}
.a4-header-en{text-align:left;direction:ltr;grid-column:3;grid-row:1}
.a4-header-logo{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2mm;grid-column:2;grid-row:1}
.a4-brand-name{font-size:13pt;font-weight:900;color:#000;margin-bottom:1.5mm;line-height:1.2}
.a4-brand-sub{font-size:8pt;font-weight:700;color:#000;margin-bottom:0.5mm;line-height:1.3}
.a4-title-band{background:#fff;color:#000;text-align:center;padding:1mm 0 2mm;font-size:10pt;font-weight:900;letter-spacing:0.3px;line-height:1.2;display:flex;justify-content:center;align-items:center;gap:3mm;margin-bottom:3mm}
.a4-title-sep{color:#000;opacity:0.5}
.a4-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);border:2px solid #000;margin-bottom:3mm;background:#000;gap:0}
.a4-meta-cell{padding:2.5mm 3.5mm;background:#fff;border-left:2px solid #000;display:flex;flex-direction:column;align-items:center;text-align:center;gap:1mm}
.a4-meta-cell:last-child{border-left:none}
.a4-meta-lbl{font-size:7pt;font-weight:900;color:#000;letter-spacing:0.3px;text-transform:uppercase;border-bottom:1px solid #e0e0e0;padding-bottom:1mm;margin-bottom:0.5mm;width:100%;text-align:center}
.a4-meta-val{font-size:11pt;font-weight:900;color:#000;font-variant-numeric:tabular-nums;line-height:1.2;text-align:center}
.a4-bill-to{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:3mm}
.a4-card{border:2px solid #000;padding:2.5mm 3mm;background:#fff}
.a4-kv{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;font-size:8.5pt;padding:0.8mm 0;border-bottom:1px solid #000}
.a4-kv:last-child{border-bottom:none}
.a4-kv span{color:#000;font-weight:700}
.a4-kv b{color:#000;font-weight:900}
.a4-items{width:100%;border-collapse:collapse;font-size:8pt;font-weight:700;margin-bottom:3mm;border:2px solid #000}
.a4-th-num,.a4-th-name{background:#000;color:#fff;font-weight:900;padding:2mm 1.5mm;text-align:center;font-size:7.5pt;border:2px solid #fff}
.a4-th-name{text-align:start}
.a4-items tbody td{padding:1.5mm 1.5mm;border:2px solid #000;vertical-align:middle;color:#000;font-weight:700;background:#fff}
.a4-items tbody tr:nth-child(even) td{background:#f7f7f7}
.a4-td-num{text-align:center;direction:ltr;font-variant-numeric:tabular-nums;font-weight:800;white-space:nowrap}
.a4-td-name{text-align:start}
.a4-td-en{font-size:7.5pt;font-weight:700;color:#000;display:block;direction:ltr}
.a4-qr-row{display:flex;justify-content:center;align-items:center;width:100%;margin:0 0 4mm}
.a4-qr-box{text-align:center;flex-shrink:0;width:38mm;margin:0 auto}
.a4-qr{width:34mm;height:34mm;margin:0 auto 1.5mm;border:2px solid #000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff}
.a4-qr svg{display:block;width:30mm!important;height:30mm!important;max-width:none!important}
.a4-summary{display:flex;flex-direction:row;direction:rtl;gap:4mm;align-items:flex-start;justify-content:flex-end;margin-bottom:16mm}
.a4-totals-col{display:flex;flex-direction:column;gap:3mm;flex-shrink:0;margin-inline-end:auto}
.a4-totals{border:2px solid #000;width:95mm;flex-shrink:0;margin-inline-end:auto;background:#fff;direction:rtl}
.a4-trow{display:flex;justify-content:space-between;align-items:center;padding:0;font-size:9pt;font-weight:700;border-bottom:2px solid #000;gap:0;background:#fff}
.a4-trow:last-child{border-bottom:none}
.a4-trow span{color:#000;padding:2mm 3mm;flex:1}
.a4-trow b{color:#000;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap;padding:2mm 3mm;border-inline-start:2px solid #000;text-align:center;min-width:32mm}
.a4-neg{color:#000!important}
.a4-grand{background:#fff!important;border-top:2px solid #000!important}
.a4-grand span,.a4-grand b{color:#000!important;font-size:8pt;font-weight:900}
.a4-grand b{border-inline-start:2px solid #000!important}
  .a4-mixed-row{border-top:1px dashed #000}
  .a4-mixed-row span{color:#000;font-size:0.88em}
  .a4-mixed-row b{color:#000;font-size:0.9em}
@media print{
  @page{size:A4 portrait;margin:0}
  html,body{background:#fff!important}
  .a4-paper{width:210mm!important;min-height:297mm!important;margin:0!important;box-shadow:none!important;padding:8mm 10mm 18mm!important}
  .a4-items tbody tr{page-break-inside:avoid}
  .a4-items tbody td{background:#fff!important}
  .a4-items tbody tr:nth-child(even) td{background:#f7f7f7!important}
  .a4-trow{background:#fff!important}
  .a4-meta-cell{background:#fff!important}
  .a4-card{background:#fff!important}
  .a4-grand{background:#fff!important}
  .a4-th-num,.a4-th-name{background:#000!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .a4-title-band{background:#fff!important}
}
</style>
</head>
<body>
<div class="a4-paper">
  <header class="a4-header">
    <div class="a4-header-ar">
      <div class="a4-brand-name">${escHtmlPdf(shopNameAr)}</div>
      <div class="a4-brand-sub">${escHtmlPdf(shopAddressAr)}</div>
      <div class="a4-brand-sub">${shopPhone ? 'جوال: ' + escHtmlPdf(shopPhone) : ''}</div>
      <div class="a4-brand-sub">${vatNumber ? 'الرقم الضريبي: ' + escHtmlPdf(vatNumber) : ''}</div>
      <div class="a4-brand-sub">${commercialRegister ? 'س.ت: ' + escHtmlPdf(commercialRegister) : ''}</div>
    </div>
    ${logoHtml}
    <div class="a4-header-en">
      <div class="a4-brand-name">${escHtmlPdf(shopNameEn)}</div>
      <div class="a4-brand-sub">${escHtmlPdf(shopAddressEn)}</div>
      <div class="a4-brand-sub">${escHtmlPdf(shopEmail)}</div>
      <div class="a4-brand-sub">${vatNumber ? 'VAT No: ' + escHtmlPdf(vatNumber) : ''}</div>
      <div class="a4-brand-sub">${commercialRegister ? 'CR No: ' + escHtmlPdf(commercialRegister) : ''}</div>
    </div>
  </header>
  <div class="a4-title-band">
    <span>فاتورة ضريبية مبسطة</span>
    <span class="a4-title-sep">•</span>
    <span>Simplified Tax Invoice</span>
  </div>
  <section class="a4-meta-grid">
    <div class="a4-meta-cell">
      <div class="a4-meta-lbl">رقم الفاتورة / Invoice #</div>
      <div class="a4-meta-val" dir="ltr">${escHtmlPdf(String(invoiceNum))}</div>
    </div>
    <div class="a4-meta-cell">
      <div class="a4-meta-lbl">التاريخ / Date</div>
      <div class="a4-meta-val" dir="ltr">${formatDateSimple(order.created_at)}</div>
    </div>
    <div class="a4-meta-cell">
      <div class="a4-meta-lbl">طريقة الدفع / Payment</div>
      <div class="a4-meta-val">${paymentMethod}</div>
    </div>
  </section>
  <section class="a4-bill-to">
    <div class="a4-card">
      <div class="a4-kv"><span>الاسم / Name</span><b>${escHtmlPdf(custName)}</b></div>
      <div class="a4-kv"><span>الجوال / Mobile</span><b dir="ltr">${escHtmlPdf(custPhone)}</b></div>
      ${subRows}
    </div>
    <div class="a4-card">
      ${order.paid_at ? `<div class="a4-kv"><span>تاريخ السداد / Paid</span><b dir="ltr">${formatDateSimple(order.paid_at)}</b></div>` : ''}
      ${order.cleaning_date ? `<div class="a4-kv"><span>تاريخ التنظيف / Cleaned</span><b dir="ltr">${formatDateSimple(order.cleaning_date)}</b></div>` : ''}
      ${order.delivery_date ? `<div class="a4-kv"><span>تاريخ التسليم / Delivered</span><b dir="ltr">${formatDateSimple(order.delivery_date)}</b></div>` : ''}
      ${order.starch ? `<div class="a4-kv"><span>نشا / Starch</span><b>${escHtmlPdf(order.starch)}</b></div>` : ''}
      ${order.bluing ? `<div class="a4-kv"><span>النيلة / Bluing</span><b>${escHtmlPdf(order.bluing)}</b></div>` : ''}
    </div>
  </section>
  <table class="a4-items">
    <thead>
      <tr>
        <th class="a4-th-num">#</th>
        <th class="a4-th-name">النوع / Item</th>
        <th class="a4-th-name">العملية / Service</th>
        <th class="a4-th-num">الكمية / Qty</th>
        <th class="a4-th-num">سعر الوحدة / Unit Price</th>
        <th class="a4-th-num">قبل الضريبة / Net</th>
        <th class="a4-th-num">الضريبة / VAT</th>
        <th class="a4-th-num">الإجمالي / Total</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <section class="a4-summary">
    <div class="a4-totals-col">
      <div class="a4-totals">
        <div class="a4-trow"><span>${subtotalLabel}</span><b dir="ltr">${sarSpan}${subtotal.toFixed(2)}</b></div>
        ${discountRow}
        ${vatRow}
        <div class="a4-trow a4-grand"><span>${totalLabel}</span><b dir="ltr">${sarSpan}${total.toFixed(2)}</b></div>
        ${mixedRows}
      </div>
    </div>
  </section>
</div>
</body>
</html>`;
}

function buildHangerTicketHtml(order, hanger, branding, cairoRegularB64, cairoBoldB64, saudiRiyalB64) {
  const shopName = escHtmlPdf(branding.laundryNameAr || branding.laundryNameEn || 'المغسلة');
  const invoiceNum = escHtmlPdf(order.invoice_seq || order.order_number || order.id || '');
  const hangerNum = escHtmlPdf(hanger.hanger_number || '');
  
  // تنسيق التاريخ والوقت بصيغة 12 ساعة
  let dateTimeStr = '—';
  try {
    const d = new Date(order.created_at || new Date().toISOString());
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;
    dateTimeStr = `${day}/${month}/${year} - ${hours}:${minutes} ${ampm}`;
  } catch (_) {}
  
  const barcodeValue = escHtmlPdf(`INV-${invoiceNum}|${hangerNum}`);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
body{direction:rtl;background:#fff;color:#000;width:80mm;max-width:80mm;padding:3mm;font-size:12px;font-weight:700}
.shop-name{font-size:15px;font-weight:700;text-align:center;margin-bottom:5px;border-bottom:2px solid #000;padding-bottom:4px}
.info-row{display:flex;justify-content:space-between;align-items:flex-start;margin:4px 0;padding:0 1mm}
.col-right{text-align:right}
.col-left{text-align:left}
.label{font-size:10px;color:#333;margin-bottom:1px}
.value{font-size:14px;font-weight:700;line-height:1.2}
.date-sub{font-size:10px;font-weight:700;color:#333;margin-top:2px}
.barcode-wrap{text-align:center;margin:5px 0 0}
.barcode-wrap svg{max-width:100%;height:auto;display:block}
.barcode-text{text-align:center;font-size:13px;font-weight:700;margin:0;padding:0;line-height:1.2}
@media print{
  body{margin:0;padding:3mm;width:80mm}
  @page{size:80mm auto;margin:0}
}
</style>
</head>
<body>
<div class="shop-name">${shopName}</div>
<div class="info-row">
  <div class="col-right">
    <div class="label">فاتورة رقم</div>
    <div class="value">${invoiceNum}</div>
    <div class="date-sub">${dateTimeStr}</div>
  </div>
  <div class="col-left">
    <div class="label">شماعة رقم</div>
    <div class="value">${hangerNum}</div>
  </div>
</div>
<div class="barcode-wrap">
<svg class="barcode" jsbarcode-format="CODE128" jsbarcode-value="${barcodeValue}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold" jsbarcode-width="2" jsbarcode-height="45" jsbarcode-displayvalue="false"></svg>
</div>
<div class="barcode-text">${invoiceNum}</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
<script>JsBarcode(".barcode").init();</script>
</body>
</html>`;
}

function buildReportExcelSheets(data, filters, branding) {
  const { summary, paymentMethods, invoices, expenses, creditNotes, subscriptions } = data;
  const br = branding || {};
  const shopName = br.laundryNameAr || br.laundryNameEn || 'نظام المغسلة';
  const printDate = formatDateSimple(new Date().toISOString());
  const period = (filters.dateFrom || filters.dateTo)
    ? `${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`
    : 'اليوم';

  const pl = (pm) => {
    const map = { cash: 'نقداً', card: 'شبكة', transfer: 'تحويل', subscription: 'اشتراك', mixed: 'مختلط', credit: 'آجل' };
    return map[pm] || pm || '—';
  };

  const summarySheetRows = [];
  const summaryMerges = [];
  let r = 0;

  const addMergedRow = (text, cols) => {
    summarySheetRows.push([text]);
    summaryMerges.push({ s: { r, c: 0 }, e: { r, c: cols - 1 } });
    r++;
  };

  addMergedRow(shopName, 4);
  addMergedRow('التقرير المالي الشامل', 4);
  addMergedRow(`الفترة: ${period}`, 4);
  addMergedRow(`تاريخ الطباعة: ${printDate}`, 4);
  summarySheetRows.push([]); r++;

  addMergedRow('[ الملخص التفصيلي ]', 4);
  summarySheetRows.push(['البيان', 'قبل الضريبة', 'الضريبة', 'بعد الضريبة']); r++;
  summarySheetRows.push(['المبيعات', fmt(summary.sales.beforeTax), fmt(summary.sales.tax), fmt(summary.sales.afterTax)]); r++;
  summarySheetRows.push(['الخصومات', fmt(summary.discounts.beforeTax), fmt(summary.discounts.tax), fmt(summary.discounts.afterTax)]); r++;
  summarySheetRows.push(['المبيعات بعد الخصم', fmt(summary.salesAfterDisc.beforeTax), fmt(summary.salesAfterDisc.tax), fmt(summary.salesAfterDisc.afterTax)]); r++;
  summarySheetRows.push(['إشعارات الدائن (المرتجعات)', fmt(summary.creditNotes.beforeTax), fmt(summary.creditNotes.tax), fmt(summary.creditNotes.afterTax)]); r++;
  summarySheetRows.push(['*** إجمالي المبيعات بعد الخصم والمرتجعات ***', fmt(summary.totalNet.beforeTax), fmt(summary.totalNet.tax), fmt(summary.totalNet.afterTax)]); r++;
  summarySheetRows.push(['الاشتراكات', fmt(summary.subscriptions.beforeTax), fmt(summary.subscriptions.tax), fmt(summary.subscriptions.afterTax)]); r++;
  summarySheetRows.push(['المصروفات', fmt(summary.expenses.beforeTax), fmt(summary.expenses.tax), fmt(summary.expenses.afterTax)]); r++;
  summarySheetRows.push(['=== الصافي ===', fmt(summary.net.beforeTax), fmt(summary.net.tax), fmt(summary.net.afterTax)]); r++;
  summarySheetRows.push([]); r++;

  addMergedRow('[ طرق الدفع ]', 4);
  summarySheetRows.push(['طريقة الدفع', 'عدد الفواتير', 'الإجمالي (شامل الضريبة)', '']); r++;
  (paymentMethods || []).forEach(m => {
    const note = m.method === 'subscription' ? 'لا يدخل في الحساب' : '';
    summarySheetRows.push([pl(m.method), m.count, fmt(m.totalAfterTax), note]);
    r++;
  });
  summarySheetRows.push([]); r++;

  addMergedRow('[ إحصائيات عامة ]', 4);
  summarySheetRows.push(['إجمالي عدد الفواتير', invoices.length, '', '']); r++;
  summarySheetRows.push(['إجمالي عدد المصروفات', expenses.length, '', '']); r++;
  summarySheetRows.push(['إجمالي إشعارات الدائن', creditNotes.length, '', '']); r++;
  summarySheetRows.push(['إجمالي عدد الاشتراكات', subscriptions.length, '', '']); r++;
  summarySheetRows.push(['إجمالي المبيعات (شامل الضريبة)', '', '', fmt(summary.sales.afterTax)]); r++;
  summarySheetRows.push(['إجمالي المصروفات', '', '', fmt(summary.expenses.afterTax)]); r++;
  summarySheetRows.push(['الصافي', '', '', fmt(summary.net.afterTax)]); r++;
  if (br.vatNumber) { summarySheetRows.push(['الرقم الضريبي', br.vatNumber, '', '']); r++; }
  if (br.commercialRegister) { summarySheetRows.push(['السجل التجاري', br.commercialRegister, '', '']); r++; }

  const invSheetRows = [];
  const invMerges = [];
  let ri = 0;
  const addInvMerged = (text, cols) => {
    invSheetRows.push([text]);
    invMerges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: cols - 1 } });
    ri++;
  };
  addInvMerged(shopName, 5);
  addInvMerged('قائمة الفواتير', 5);
  addInvMerged(`الفترة: ${period}`, 5);
  addInvMerged(`تاريخ الطباعة: ${printDate}`, 5);
  invSheetRows.push([]); ri++;
  invSheetRows.push(['رقم الفاتورة', 'الجوال', 'التاريخ', 'طريقة الدفع', 'الإجمالي']); ri++;
  invoices.forEach(inv => {
    invSheetRows.push([
      inv.invoice_seq || inv.order_number || inv.id,
      inv.phone || '—',
      fmtDT(inv.created_at),
      pl(inv.payment_method),
      fmt(inv.total_amount)
    ]);
    ri++;
  });
  invSheetRows.push([]); ri++;
  invSheetRows.push([`الإجمالي: ${invoices.length} فاتورة`, '', '', '', invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0).toFixed(2)]);

  const expSheetRows = [];
  const expMerges = [];
  let re = 0;
  const addExpMerged = (text, cols) => {
    expSheetRows.push([text]);
    expMerges.push({ s: { r: re, c: 0 }, e: { r: re, c: cols - 1 } });
    re++;
  };
  addExpMerged(shopName, 4);
  addExpMerged('قائمة المصروفات', 4);
  addExpMerged(`الفترة: ${period}`, 4);
  addExpMerged(`تاريخ الطباعة: ${printDate}`, 4);
  expSheetRows.push([]); re++;
  expSheetRows.push(['البيان', 'التاريخ', 'الإجمالي', 'ملاحظات']); re++;
  expenses.forEach(e => {
    expSheetRows.push([e.title || '—', fmtDT(e.created_at), fmt(e.total_amount), e.notes || '']);
    re++;
  });
  expSheetRows.push([]); re++;
  expSheetRows.push([`الإجمالي: ${expenses.length} مصروف`, '', expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0).toFixed(2), '']);

  const cnSheetRows = [];
  const cnMerges = [];
  let rc = 0;
  const addCnMerged = (text, cols) => {
    cnSheetRows.push([text]);
    cnMerges.push({ s: { r: rc, c: 0 }, e: { r: rc, c: cols - 1 } });
    rc++;
  };
  addCnMerged(shopName, 4);
  addCnMerged('مرتجع / إشعارات دائنة', 4);
  addCnMerged(`الفترة: ${period}`, 4);
  addCnMerged(`تاريخ الطباعة: ${printDate}`, 4);
  cnSheetRows.push([]); rc++;
  cnSheetRows.push(['رقم الإشعار', 'العميل', 'التاريخ', 'القيمة']); rc++;
  creditNotes.forEach(cn => {
    cnSheetRows.push([
      cn.credit_note_seq || cn.credit_note_number,
      cn.customer_name || '—',
      fmtDT(cn.created_at),
      `-${fmt(cn.total_amount)}`
    ]);
    rc++;
  });
  if (creditNotes.length) {
    cnSheetRows.push([]); rc++;
    cnSheetRows.push([`الإجمالي: ${creditNotes.length} إشعار`, '', '', `-${creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0).toFixed(2)}`]);
  }

  const subSheetRows = [];
  const subMerges = [];
  let rs = 0;
  const addSubMerged = (text, cols) => {
    subSheetRows.push([text]);
    subMerges.push({ s: { r: rs, c: 0 }, e: { r: rs, c: cols - 1 } });
    rs++;
  };
  addSubMerged(shopName, 5);
  addSubMerged('قائمة الاشتراكات', 5);
  addSubMerged(`الفترة: ${period}`, 5);
  addSubMerged(`تاريخ الطباعة: ${printDate}`, 5);
  subSheetRows.push([]); rs++;
  subSheetRows.push(['رقم الجوال', 'رقم الاشتراك', 'التاريخ', 'القيمة', 'النوع']); rs++;
  subscriptions.forEach(sub => {
    const typeLabel = sub.entry_type === 'renewal' ? 'تجديد' : 'جديد';
    subSheetRows.push([
      sub.phone || '—',
      sub.subscription_number || sub.subscription_ref || '—',
      fmtDT(sub.created_at),
      fmt(sub.amount),
      typeLabel
    ]);
    rs++;
  });
  if (subscriptions.length) {
    subSheetRows.push([]); rs++;
    subSheetRows.push([`الإجمالي: ${subscriptions.length} اشتراك`, '', '', subscriptions.reduce((s, sub) => s + Number(sub.amount || 0), 0).toFixed(2), '']);
  }

  return [
    {
      name: 'ملخص التقرير',
      rows: summarySheetRows,
      cols: [{ wch: 42 }, { wch: 18 }, { wch: 14 }, { wch: 18 }],
      merges: summaryMerges,
      freezeRow: 6
    },
    {
      name: 'الفواتير',
      rows: invSheetRows,
      cols: [{ wch: 16 }, { wch: 26 }, { wch: 24 }, { wch: 14 }, { wch: 16 }],
      merges: invMerges,
      freezeRow: 6
    },
    {
      name: 'المصروفات',
      rows: expSheetRows,
      cols: [{ wch: 30 }, { wch: 24 }, { wch: 16 }, { wch: 30 }],
      merges: expMerges,
      freezeRow: 6
    },
    {
      name: 'الإشعارات الدائنة',
      rows: cnSheetRows,
      cols: [{ wch: 18 }, { wch: 26 }, { wch: 24 }, { wch: 16 }],
      merges: cnMerges,
      freezeRow: 6
    },
    {
      name: 'الاشتراكات',
      rows: subSheetRows,
      cols: [{ wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 14 }],
      merges: subMerges,
      freezeRow: 6
    },
  ];
}

function buildPdfHtmlForTypesReport({ rows, totals }, filters, cairoRegularB64, cairoBoldB64, saudiRiyalB64, branding) {
  const br = branding || {};
  const shopName = br.laundryNameAr || br.laundryNameEn || 'نظام المغسلة';

  const now = new Date();
  const printDate = formatDateSimple(now.toISOString());
  const pad = (x) => String(x).padStart(2, '0');
  const printTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const filterParts = [];
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? formatDateSimple(filters.dateFrom) : '—';
    const to   = filters.dateTo   ? formatDateSimple(filters.dateTo)   : '—';
    filterParts.push(`الفترة: ${from} — ${to}`);
  }
  if (filters.productId) filterParts.push('تصفية حسب الصنف');
  if (filters.serviceId) filterParts.push('تصفية حسب العملية');

  const Rv = (n) => `<span class="sar">&#xE900;</span> ${fmt(n)}`;

  const rowsHtml = (rows || []).length
    ? rows.map((r, i) => {
        const isZero = Number(r.total_qty || 0) === 0;
        return `
          <tr class="${isZero ? 'dim' : ''}${i % 2 === 0 ? ' even' : ''}">
            <td class="ctr">${i + 1}</td>
            <td class="prod">${escHtmlPdf(r.product_name_ar || r.product_name_en || '—')}</td>
            <td>${escHtmlPdf(r.service_name_ar || r.service_name_en || '—')}</td>
            <td class="num">${r.total_qty}</td>
            <td class="num gross">${Rv(r.total_gross)}</td>
          </tr>`;
      }).join('') + `
          <tr class="tbl-foot">
            <td colspan="3">الإجمالي: ${rows.length} صنف × عملية</td>
            <td class="num">${totals.total_qty}</td>
            <td class="num">${Rv(totals.total_gross)}</td>
          </tr>`
    : '<tr><td colspan="5" class="empty-msg">لا توجد بيانات في هذه الفترة</td></tr>';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
.sar{font-family:'SaudiRiyal';font-weight:400;font-size:1.1em;vertical-align:middle;display:inline-block;line-height:1}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
body{direction:rtl;background:#fff;color:#000;padding:14px 16px;font-size:10px}
.hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:2px solid #f59e0b;padding-bottom:10px;margin-bottom:12px}
.hdr-title{font-size:16px;font-weight:700;color:#d97706}
.hdr-sub{font-size:9px;color:#475569;margin-top:3px}
.hdr-right{text-align:left;direction:ltr}
.hdr-date{font-size:9px;font-weight:700;color:#1e293b}
.info-bar{background:linear-gradient(90deg,rgba(245,158,11,.08),rgba(217,119,6,.05));border:1px solid rgba(245,158,11,.25);border-radius:6px;padding:6px 12px;font-size:9px;color:#92400e;font-weight:700;text-align:center;margin-bottom:10px}
.totals-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-bottom:12px}
.tot-item{border:1px solid #e2e8f0;border-radius:7px;padding:7px 9px;text-align:center;border-top:2px solid #f59e0b}
.tot-lbl{font-size:8px;color:#64748b;font-weight:700;margin-bottom:3px}
.tot-val{font-size:11px;font-weight:700;color:#1e293b}
.tot-val.qty{color:#1d4ed8}.tot-val.sales{color:#15803d}.tot-val.vat{color:#9333ea}.tot-val.gross{color:#b45309}
.sec-hdr{background:linear-gradient(90deg,#d97706,#f59e0b);color:#fff;padding:6px 10px;border-radius:6px 6px 0 0;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:space-between}
.sec-badge{background:rgba(255,255,255,.25);border-radius:10px;padding:1px 7px;font-size:9px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-bottom:14px}
thead tr{background:linear-gradient(90deg,rgba(245,158,11,.12),rgba(217,119,6,.08))}
thead th{padding:7px 7px;font-size:9px;font-weight:700;color:#d97706;text-align:right;white-space:nowrap;border-bottom:2px solid #fed7aa}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:last-child{border-bottom:none}
tbody tr.even{background:#f8fafc}
tbody tr.dim{opacity:.55}
tbody td{padding:6px 7px;font-size:9px;color:#475569;text-align:right}
.ctr{text-align:center}
.prod{font-weight:700;color:#1e293b}
.num{text-align:left;direction:ltr;font-weight:700;white-space:nowrap}
.tax{color:#000}.gross{color:#000}
.tbl-foot td{background:#fefce8;font-weight:900;font-size:9px;color:#92400e;border-top:2px solid #fde68a;padding:6px 7px}
.tbl-foot td.num{color:#d97706!important}
.empty-msg{text-align:center;color:#94a3b8;padding:16px;font-size:9.5px}
.footer{border-top:2px solid #e2e8f0;padding:6px 12px;background:#f8fafc;display:flex;justify-content:space-between;margin-top:10px;font-size:8.5px;color:#64748b}
@media print{*{color:#000!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div class="hdr-title">تقرير الأنواع — ${shopName}</div>
    <div class="hdr-sub">${filterParts.join(' &nbsp;·&nbsp; ') || 'جميع الأصناف والعمليات'}</div>
  </div>
  <div class="hdr-right">
    <div class="hdr-date">🖨️ طُبع: ${printDate} ${printTime}</div>
  </div>
</div>

${filterParts.length ? `<div class="info-bar">${filterParts.join(' &nbsp;·&nbsp; ')}</div>` : ''}

<div class="totals-grid">
  <div class="tot-item">
    <div class="tot-lbl">إجمالي العدد</div>
    <div class="tot-val qty">${totals.total_qty || 0}</div>
  </div>
  <div class="tot-item">
    <div class="tot-lbl">الإجمالي الشامل</div>
    <div class="tot-val gross">${Rv(totals.total_gross)}</div>
  </div>
</div>

<div class="sec-hdr">
  <span>تفاصيل الأنواع والعمليات</span>
  <span class="sec-badge">${(rows || []).length} صنف × عملية</span>
</div>
<table>
  <thead>
    <tr>
      <th class="ctr">#</th>
      <th>اسم الصنف</th>
      <th>العملية</th>
      <th class="num">العدد</th>
      <th class="num">الإجمالي الشامل</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

<div class="footer">
  <span>نظام المغسلة — تقرير الأنواع</span>
  <span>تم الإنشاء: ${printDate} ${printTime}</span>
</div>
</body>
</html>`;
}

function buildTypesReportExcelSheets({ rows, totals }, filters, branding) {
  const br = branding || {};
  const shopName = br.laundryNameAr || br.laundryNameEn || 'نظام المغسلة';
  const printDate = formatDateSimple(new Date().toISOString());

  const headerRows = [
    [`تقرير الأنواع — ${shopName}`],
    [`تاريخ التصدير: ${printDate}`],
  ];
  if (filters.dateFrom || filters.dateTo) {
    headerRows.push([`الفترة: ${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`]);
  }
  headerRows.push([]);

  const dataRows = [
    ['#', 'اسم الصنف', 'العملية', 'العدد', 'الإجمالي الشامل'],
    ...(rows || []).map((r, i) => [
      i + 1,
      (r.product_name_ar || r.product_name_en || '—'),
      (r.service_name_ar  || r.service_name_en  || '—'),
      Number(r.total_qty   || 0),
      Number(r.total_gross || 0).toFixed(2),
    ]),
    [],
    ['', '', 'الإجمالي', Number(totals.total_qty || 0), Number(totals.total_gross || 0).toFixed(2)],
  ];

  const allRows = [...headerRows, ...dataRows];
  return [{
    name: 'تقرير الأنواع',
    rows: allRows,
    cols: [{ wch: 6 }, { wch: 24 }, { wch: 22 }, { wch: 10 }, { wch: 18 }],
    freezeRow: headerRows.length,
  }];
}

module.exports = {
  formatDateSimple,
  buildExcelData,
  buildPdfHtml,
  buildExcelDataForCustomers,
  buildPdfHtmlForCustomers,
  buildExcelDataForProducts,
  buildPdfHtmlForProducts,
  subscriptionStatusLabelAr,
  ledgerEntryLabelAr,
  escHtmlPdf,
  buildNationalAddressPlain,
  buildExcelDataForSubscriptions,
  buildPdfHtmlForSubscriptions,
  buildExcelDataForSubscriptionCustomerReport,
  buildPdfHtmlForSubscriptionCustomerReport,
  buildPdfHtmlForSubscriptionReceipt,
  buildThermalSubscriptionReceiptHtml,
  buildInvoicePdfHtml,
  buildThermalInvoiceHtml,
  buildHangerTicketHtml,
  buildExcelDataForReport,
  buildPdfHtmlForReport,
  buildReportExcelSheets,
  buildAllInvoicesReportExcelSheets,
  buildPdfHtmlForAllInvoicesReport,
  buildExcelDataForSubscriptionsReport,
  buildPdfHtmlForSubscriptionsReport,
  buildPdfHtmlForTypesReport,
  buildTypesReportExcelSheets,
};

function fmt(n) { return Number(n || 0).toFixed(2); }
function fmtDT(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const pad = (x) => String(x).padStart(2, '0');
    const day = pad(d.getDate()), mon = pad(d.getMonth() + 1), yr = d.getFullYear();
    const h = pad(d.getHours()), mi = pad(d.getMinutes());
    const ampm = d.getHours() < 12 ? 'am' : 'pm';
    const h12 = d.getHours() % 12 || 12;
    return `${day}/${mon}/${yr} ${pad(h12)}:${mi} ${ampm}`;
  } catch { return String(dateStr); }
}
function payLabel(pm) {
  if (pm === 'card') return 'شبكة';
  if (pm === 'bank' || pm === 'transfer') return 'تحويل بنكي';
  if (pm === 'subscription') return 'اشتراك';
  if (pm === 'mixed') return 'مختلط';
  return 'نقدا';
}

function buildExcelDataForReport(data, filters) {
  const { summary, paymentMethods, invoices, expenses, creditNotes } = data;
  const period = (filters.dateFrom || filters.dateTo)
    ? `${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`
    : filters.dateFrom || 'اليوم';

  const rows = [
    ['التقرير اليومي - نظام المغسلة'],
    [`الفترة: ${period}`],
    [],
    ['الملخص التفصيلي'],
    ['البيان', 'قبل الضريبة', 'الضريبة', 'بعد الضريبة'],
    ['المبيعات', fmt(summary.sales.beforeTax), fmt(summary.sales.tax), fmt(summary.sales.afterTax)],
    ['الخصومات', fmt(summary.discounts.beforeTax), fmt(summary.discounts.tax), fmt(summary.discounts.afterTax)],
    ['المبيعات بعد الخصم', fmt(summary.salesAfterDisc.beforeTax), fmt(summary.salesAfterDisc.tax), fmt(summary.salesAfterDisc.afterTax)],
    ['إشعارات الدائن (المرتجعات)', fmt(summary.creditNotes.beforeTax), fmt(summary.creditNotes.tax), fmt(summary.creditNotes.afterTax)],
    ['إجمالي المبيعات بعد الخصم بعد المرتجعات', fmt(summary.totalNet.beforeTax), fmt(summary.totalNet.tax), fmt(summary.totalNet.afterTax)],
    ['المصروفات', fmt(summary.expenses.beforeTax), fmt(summary.expenses.tax), fmt(summary.expenses.afterTax)],
    ['الصافي', fmt(summary.net.beforeTax), fmt(summary.net.tax), fmt(summary.net.afterTax)],
    [],
    ['طرق الدفع'],
    ['طريقة الدفع', 'عدد الفواتير', 'الإجمالي (شامل الضريبة)'],
    ...(paymentMethods || []).map((m) => [payLabel(m.method), m.count, fmt(m.totalAfterTax)]),
    [],
    ['الفواتير'],
    ['رقم', 'التاريخ', 'طريقة الدفع', 'الإجمالي'],
  ];
  invoices.forEach((inv) => {
    rows.push([
      inv.invoice_seq || inv.order_number || inv.id,
      fmtDT(inv.created_at),
      payLabel(inv.payment_method),
      fmt(inv.total_amount)
    ]);
  });
  rows.push([`الإجمالي: ${invoices.length}`, '', '', invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0).toFixed(2)]);
  rows.push([]);
  rows.push(['المصروفات']);
  rows.push(['البيان', 'التاريخ', 'الإجمالي', 'ملاحظات']);
  expenses.forEach((e) => {
    rows.push([e.title || '—', formatDateSimple(e.created_at), fmt(e.total_amount), e.notes || '']);
  });
  rows.push([`الإجمالي: ${expenses.length}`, '', expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0).toFixed(2), '']);
  rows.push([]);
  rows.push(['مرتجع/إشعارات دائنة']);
  rows.push(['رقم الإشعار', 'التاريخ', 'القيمة']);
  creditNotes.forEach((cn) => {
    rows.push([cn.credit_note_seq || cn.credit_note_number, fmtDT(cn.created_at), `-${fmt(cn.total_amount)}`]);
  });
  if (creditNotes.length) {
    rows.push([`الإجمالي: ${creditNotes.length}`, '', `-${creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0).toFixed(2)}`]);
  }
  return rows;
}

function buildPdfHtmlForReport(data, filters, cairoRegularB64, cairoBoldB64, saudiRiyalB64, branding) {
  const { summary, paymentMethods, invoices, expenses, creditNotes, subscriptions } = data;
  const br = branding || {};
  const shopName = br.laundryNameAr || br.laundryNameEn || 'نظام المغسلة';
  const shopAddress = [br.streetNameAr, br.districtAr, br.cityAr].filter(Boolean).join('، ');

  const printDate = formatDateSimple(new Date().toISOString());
  const printTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const period = (filters.dateFrom || filters.dateTo)
    ? `من ${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`
    : 'اليوم';

  const R = (n) => `<span class="sar">&#xE900;</span> ${fmt(n)}`;

  const summaryDefs = [
    { label: 'المبيعات', d: summary.sales, cls: '' },
    { label: 'الخصومات', d: summary.discounts, cls: '' },
    { label: 'المبيعات بعد الخصم', d: summary.salesAfterDisc, cls: '' },
    { label: 'إشعارات الدائن (المرتجعات)', d: summary.creditNotes, cls: '' },
    { label: 'إجمالي المبيعات بعد الخصم بعد المرتجعات', d: summary.totalNet, cls: 'row-total' },
    { label: 'الاشتراكات', d: summary.subscriptions, cls: '' },
    { label: 'المصروفات', d: summary.expenses, cls: '' },
    { label: 'الصافي', d: summary.net, cls: 'row-net' },
  ];

  const summaryHtml = summaryDefs.map(({ label, d, cls }, i) =>
    `<tr class="${cls}${!cls && i % 2 !== 0 ? ' alt' : ''}">
      <td>${label}</td>
      <td class="num">${R(d.beforeTax)}</td>
      <td class="num tax">${R(d.tax)}</td>
      <td class="num">${R(d.afterTax)}</td>
    </tr>`
  ).join('');

  const payMeta = {
    cash:         { label: 'نقداً',   icon: '💵', cls: 'p-cash' },
    card:         { label: 'شبكة',    icon: '💳', cls: 'p-card' },
    bank:         { label: 'تحويل بنكي', icon: '🏦', cls: 'p-bank' },
    transfer:     { label: 'تحويل',   icon: '🏦', cls: 'p-transfer' },
    subscription: { label: 'اشتراك',  icon: '🔄', cls: 'p-sub' },
    mixed:        { label: 'مختلط',   icon: '🔀', cls: 'p-mixed' },
    credit:       { label: 'آجل',     icon: '📋', cls: 'p-credit' },
  };

  const payGridHtml = (paymentMethods || []).length
    ? (paymentMethods || []).map((m) => {
        const meta = payMeta[m.method] || { label: m.method, icon: '💰', cls: 'p-cash' };
        const subNote = m.method === 'subscription' ? ' <span style="color:#dc2626;font-size:0.85em;">(لا يدخل في الحساب)</span>' : '';
        return `<div class="pay-item ${meta.cls}">
          <span class="pay-icon">${meta.icon}</span>
          <div class="pay-details">
            <div class="pay-lbl">${meta.label}</div>
            <div class="pay-cnt">${m.count} فاتورة${subNote}</div>
          </div>
          <div class="pay-amt">${R(m.totalAfterTax)}</div>
        </div>`;
      }).join('')
    : '<div class="empty-msg">لا توجد مبيعات في هذه الفترة</div>';

  const payBadge = (pm) => {
    const map = { cash: 'pb-cash', card: 'pb-card', bank: 'pb-bank', transfer: 'pb-transfer', subscription: 'pb-sub', mixed: 'pb-mixed', credit: 'pb-credit' };
    const lbl = payLabel(pm);
    return `<span class="pbadge ${map[pm] || 'pb-cash'}">${lbl}</span>`;
  };

  const invTotal = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const expTotal = expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0);
  const cnTotal  = creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0);
  const subTotal = subscriptions.reduce((s, sub) => s + Number(sub.amount || 0), 0);

  const invoicesHtml = invoices.length
    ? invoices.map((inv, i) => `
      <tr class="${i % 2 !== 0 ? 'alt' : ''}">
        <td class="num">${inv.invoice_seq || inv.order_number || inv.id}</td>
        <td>${inv.phone || '—'}</td>
        <td>${fmtDT(inv.created_at)}</td>
        <td>${payBadge(inv.payment_method)}</td>
        <td class="num">${R(inv.total_amount)}</td>
      </tr>`).join('') + `
      <tr class="tbl-foot">
        <td colspan="4">الإجمالي: ${invoices.length} فاتورة</td>
        <td class="num">${R(invTotal)}</td>
      </tr>`
    : '<tr><td colspan="5" class="empty-msg">لا توجد فواتير</td></tr>';

  const expHtml = expenses.length
    ? expenses.map((e, i) => `
      <tr class="${i % 2 !== 0 ? 'alt' : ''}">
        <td>${e.title || '—'}</td>
        <td>${fmtDT(e.created_at)}</td>
        <td class="num">${R(e.total_amount)}</td>
        <td class="note">${e.notes || '—'}</td>
      </tr>`).join('') + `
      <tr class="tbl-foot">
        <td colspan="2">الإجمالي: ${expenses.length} مصروف</td>
        <td class="num">${R(expTotal)}</td>
        <td></td>
      </tr>`
    : '<tr><td colspan="4" class="empty-msg">لا توجد مصروفات</td></tr>';

  const cnHtml = creditNotes.length
    ? creditNotes.map((cn, i) => `
      <tr class="${i % 2 !== 0 ? 'alt' : ''}">
        <td class="num">${cn.credit_note_seq || cn.credit_note_number}</td>
        <td>${cn.customer_name || '—'}</td>
        <td>${fmtDT(cn.created_at)}</td>
        <td class="num neg">-${R(cn.total_amount)}</td>
      </tr>`).join('') + `
      <tr class="tbl-foot">
        <td colspan="3">الإجمالي: ${creditNotes.length} إشعار</td>
        <td class="num neg">-${R(cnTotal)}</td>
      </tr>`
    : '<tr><td colspan="4" class="empty-msg">لا توجد إشعارات دائنة</td></tr>';

  const subHtml = subscriptions.length
    ? subscriptions.map((sub, i) => `
      <tr class="${i % 2 !== 0 ? 'alt' : ''}">
        <td>${sub.phone || '—'}</td>
        <td>${sub.subscription_number || sub.subscription_ref || '—'}</td>
        <td>${fmtDT(sub.created_at)}</td>
        <td class="num">${R(sub.amount)}</td>
        <td>${sub.entry_type === 'renewal' ? 'تجديد' : 'جديد'}</td>
      </tr>`).join('') + `
      <tr class="tbl-foot">
        <td colspan="4">الإجمالي: ${subscriptions.length} اشتراك</td>
        <td class="num">${R(subTotal)}</td>
      </tr>`
    : '<tr><td colspan="5" class="empty-msg">لا توجد اشتراكات</td></tr>';

  const logoHtml = br.logoDataUrl
    ? `<img src="${br.logoDataUrl}" class="hdr-logo-img" alt="logo" />`
    : `<svg class="hdr-logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
       </svg>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
.sar{font-family:'SaudiRiyal';font-weight:400;font-style:normal;font-size:1.08em;vertical-align:middle;display:inline-block;line-height:1}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
body{direction:rtl;background:#fff;color:#000;font-size:10.5px}
@page{size:A4;margin:0}
.page{background:#fff;width:100%}

.hdr{background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 55%,#0284c7 100%);padding:16px 22px;color:#fff;display:flex;align-items:center;gap:13px}
.hdr-logo{width:50px;height:50px;border-radius:10px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.hdr-logo-img{max-width:46px;max-height:46px;object-fit:contain}
.hdr-logo-svg{width:28px;height:28px;color:#fff}
.hdr-info{flex:1;min-width:0}
.hdr-shop{font-size:17px;font-weight:900;line-height:1.2;letter-spacing:.2px}
.hdr-sub{font-size:9.5px;font-weight:400;opacity:.82;margin-top:3px}
.hdr-right{margin-right:auto;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.hdr-badge{background:rgba(255,255,255,.22);border-radius:20px;padding:4px 14px;font-size:10px;font-weight:700;white-space:nowrap}
.hdr-ts{font-size:8.5px;opacity:.72;text-align:left}

.info-bar{background:#dbeafe;border-bottom:2px solid #93c5fd;padding:6px 22px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#000;font-weight:700}

.body{padding:13px 20px;display:flex;flex-direction:column;gap:12px}

.sec{border-radius:8px;overflow:hidden;border:1px solid #e2e8f0}
.sec-hdr{background:linear-gradient(90deg,#1e3a8a,#2563eb);padding:7px 14px;color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:space-between}
.sec-badge{background:rgba(255,255,255,.25);border-radius:20px;padding:2px 10px;font-size:9px;font-weight:700;white-space:nowrap}
.sec-body{background:#fff}

table{width:100%;border-collapse:collapse;font-size:9.5px}
thead th{padding:7px 10px;background:#1e3a8a;color:#fff;font-weight:700;text-align:right;font-size:9.5px;white-space:nowrap}
thead th.num{text-align:left;direction:ltr}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:last-child{border-bottom:none}
tbody tr.alt{background:#f8fafc}
tbody td{padding:6px 10px;color:#000;text-align:right;vertical-align:middle;font-size:9.5px}
td.num{font-weight:700;color:#000;text-align:left;direction:ltr;white-space:nowrap}
td.neg{font-weight:700;color:#dc2626;text-align:left;direction:ltr;white-space:nowrap}
td.tax{color:#000}
td.note{color:#000;font-size:9px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row-total td{background:#dcfce7!important;color:#000!important;font-weight:900}
.row-total td.num{color:#000!important}
.row-net td{background:#eff6ff!important;color:#000!important;font-weight:900;font-size:10px}
.row-net td.num,.row-net td.tax{color:#000!important}
.tbl-foot td{background:#f0f9ff;font-weight:900;font-size:10px;color:#000;border-top:2px solid #bae6fd;padding:6px 10px}
.tbl-foot td.num{color:#000!important}
.tbl-foot td.neg{color:#dc2626!important}

.pay-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:6px}
.pay-item{border-radius:6px;padding:5px 7px;display:flex;align-items:center;gap:5px}
.p-cash{background:#f0fdf4;border:1px solid #86efac}
.p-card{background:#eff6ff;border:1px solid #93c5fd}
.p-bank{background:#faf5ff;border:1px solid #c4b5fd}
.p-transfer{background:#faf5ff;border:1px solid #c4b5fd}
.p-sub{background:#fff7ed;border:1px solid #fdba74}
.p-mixed{background:#fefce8;border:1px solid #fde047}
.p-credit{background:#fff1f2;border:1px solid #fda4af}
.pay-icon{font-size:14px;flex-shrink:0}
.pay-details{flex:1;min-width:0}
.pay-lbl{font-size:9px;font-weight:900;color:#000}
.pay-cnt{font-size:8px;color:#000}
.pay-amt{font-size:9px;font-weight:900;color:#000;text-align:left;direction:ltr;white-space:nowrap}

.pbadge{display:inline-block;border-radius:12px;padding:2px 8px;font-size:9px;font-weight:700;color:#fff}
.pb-cash{background:#10b981}.pb-card{background:#3b82f6}.pb-bank{background:#8b5cf6}.pb-transfer{background:#8b5cf6}
.pb-sub{background:#f59e0b}.pb-mixed{background:#6366f1}.pb-credit{background:#ef4444}

.empty-msg{text-align:center;color:#000;padding:14px;font-size:9.5px}

.footer{border-top:2px solid #e2e8f0;padding:9px 22px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;margin-top:12px}
.footer-brand{font-size:10px;font-weight:900;color:#000}
.footer-meta{font-size:9px;color:#000}
@media print{*{color:#000!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style>
</head>
<body>
<div class="page">

<div class="hdr">
  <div class="hdr-logo">${logoHtml}</div>
  <div class="hdr-info">
    <div class="hdr-shop">${shopName}</div>
    <div class="hdr-sub">التقرير المالي الشامل${shopAddress ? ' &nbsp;·&nbsp; ' + shopAddress : ''}</div>
  </div>
  <div class="hdr-right">
    <div class="hdr-badge">📅 ${period}</div>
    <div class="hdr-ts">🖨️ طُبع: ${printDate} ${printTime}</div>
  </div>
</div>

<div class="info-bar">
  <span>الفترة: ${period}</span>
  <span>${br.vatNumber ? 'الرقم الضريبي: ' + br.vatNumber : ''}</span>
</div>

<div class="body">

<div class="sec">
  <div class="sec-hdr">
    <span>الملخص التفصيلي</span>
    <span class="sec-badge">${invoices.length} فاتورة</span>
  </div>
  <div class="sec-body">
    <table>
      <colgroup><col style="width:46%"/><col style="width:18%"/><col style="width:18%"/><col style="width:18%"/></colgroup>
      <thead><tr>
        <th>البيان</th>
        <th class="num">قبل الضريبة</th>
        <th class="num">الضريبة</th>
        <th class="num">بعد الضريبة</th>
      </tr></thead>
      <tbody>${summaryHtml}</tbody>
    </table>
  </div>
</div>

<div class="sec">
  <div class="sec-hdr">
    <span>طرق الدفع</span>
    <span class="sec-badge">${(paymentMethods || []).length} طريقة</span>
  </div>
  <div class="sec-body">
    <div class="pay-grid">${payGridHtml}</div>
  </div>
</div>

${invoices.length ? `<div class="sec">
  <div class="sec-hdr">
    <span>الفواتير</span>
    <span class="sec-badge">${invoices.length} فاتورة &nbsp;·&nbsp; ${R(invTotal)}</span>
  </div>
  <div class="sec-body">
    <table>
      <thead><tr><th>رقم</th><th>الجوال</th><th>التاريخ</th><th>طريقة الدفع</th><th class="num">الإجمالي</th></tr></thead>
      <tbody>${invoicesHtml}</tbody>
    </table>
  </div>
</div>` : ''}

${expenses.length ? `<div class="sec">
  <div class="sec-hdr">
    <span>المصروفات</span>
    <span class="sec-badge">${expenses.length} مصروف &nbsp;·&nbsp; ${R(expTotal)}</span>
  </div>
  <div class="sec-body">
    <table>
      <thead><tr><th>البيان</th><th>التاريخ</th><th class="num">الإجمالي</th><th>ملاحظات</th></tr></thead>
      <tbody>${expHtml}</tbody>
    </table>
  </div>
</div>` : ''}

${creditNotes.length ? `<div class="sec">
  <div class="sec-hdr">
    <span>مرتجع / إشعارات دائنة</span>
    <span class="sec-badge">${creditNotes.length} إشعار</span>
  </div>
  <div class="sec-body">
    <table>
      <thead><tr><th>رقم الإشعار</th><th>العميل</th><th>التاريخ</th><th class="num">القيمة</th></tr></thead>
      <tbody>${cnHtml}</tbody>
    </table>
  </div>
</div>` : ''}

${subscriptions.length ? `<div class="sec">
  <div class="sec-hdr">
    <span>الاشتراكات</span>
    <span class="sec-badge">${subscriptions.length} اشتراك &nbsp;·&nbsp; ${R(subTotal)}</span>
  </div>
  <div class="sec-body">
    <table>
      <thead><tr><th>رقم الجوال</th><th>رقم الاشتراك</th><th>التاريخ</th><th class="num">القيمة</th><th>النوع</th></tr></thead>
      <tbody>${subHtml}</tbody>
    </table>
  </div>
</div>` : ''}

</div>

<div class="footer">
  <span class="footer-brand">${shopName}${br.vatNumber ? ' &nbsp;·&nbsp; الرقم الضريبي: ' + br.vatNumber : ''}${br.commercialRegister ? ' &nbsp;·&nbsp; س.ت: ' + br.commercialRegister : ''}</span>
  <span class="footer-meta">تم إنشاء هذا التقرير بتاريخ ${printDate} ${printTime}</span>
</div>

</div>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════
   تقرير جميع الفواتير — Excel
═══════════════════════════════════════════════════════════ */
function buildAllInvoicesReportExcelSheets(data, filters) {
  const { allInvoices, creditNotes, paymentMethods, summary } = data;
  const period = (filters.dateFrom || filters.dateTo)
    ? `${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`
    : 'جميع الفترات';
  const customerInfo = [];
  if (filters.customerId || filters.search) customerInfo.push(`العميل: ${filters.customerText || filters.search || ''}`);
  if (filters.subscriptionNumber) customerInfo.push(`رقم الاشتراك: ${filters.subscriptionNumber}`);
  const customerInfoStr = customerInfo.length ? customerInfo.join(' · ') : '';

  const payLabelEx = (pm) => {
    const map = { cash: 'نقداً', card: 'شبكة', transfer: 'تحويل', subscription: 'اشتراك', mixed: 'مختلط', credit: 'آجل' };
    return map[pm] || pm || '—';
  };
  const statusLabelEx = (inv) => {
    const pm = String(inv.payment_method || '');
    const ps = String(inv.payment_status || '');
    const rem = Number(inv.remaining_amount || 0);
    if (pm === 'credit' && ps === 'paid' && rem === 0) return 'مدفوع';
    if (pm === 'credit' && ps === 'partial') return 'مدفوع جزئياً';
    if (pm === 'credit' || ps === 'pending') return 'غير مدفوع';
    if (rem > 0) return 'مدفوع جزئياً';
    return 'مدفوع';
  };

  const allRows = [
    ['تقرير جميع الفواتير'],
    [`الفترة: ${period}`],
    customerInfoStr ? [customerInfoStr] : [],
    ['رقم الفاتورة', 'الجوال', 'التاريخ', 'طريقة الدفع', 'الإجمالي', 'تم التنظيف', 'تم التسليم', 'الحالة'],
  ];
  allInvoices.forEach((inv) => {
    allRows.push([
      inv.invoice_seq || inv.order_number || inv.id,
      inv.phone || inv.customer_name || '—',
      fmtDT(inv.created_at),
      payLabelEx(inv.payment_method),
      fmt(inv.total_amount),
      inv.cleaning_date  ? 'تم' : '—',
      inv.delivery_date  ? 'تم' : '—',
      statusLabelEx(inv),
    ]);
  });
  allRows.push([`الإجمالي: ${allInvoices.length} فاتورة`, '', '', '', '', '', '', '']);

  const cnRows = [
    ['الفواتير الدائنة (المرتجعات)'],
    [`الفترة: ${period}`],
    customerInfoStr ? [customerInfoStr] : [],
    ['رقم الإشعار', 'الفاتورة الأصلية', 'العميل', 'التاريخ', 'قبل الضريبة', 'الضريبة', 'الإجمالي'],
  ];
  creditNotes.forEach((cn) => {
    const beforeTax = Number(cn.total_amount || 0) - Number(cn.vat_amount || 0);
    cnRows.push([
      cn.credit_note_seq || cn.credit_note_number,
      cn.original_invoice_seq || '—',
      cn.customer_name || '—',
      fmtDT(cn.created_at),
      fmt(beforeTax),
      fmt(cn.vat_amount),
      `-${fmt(cn.total_amount)}`,
    ]);
  });
  const cnTotal = creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0);
  if (creditNotes.length) {
    cnRows.push([`الإجمالي: ${creditNotes.length} إشعار`, '', '', '', '', '', `-${fmt(cnTotal)}`]);
  }

  const sumRows = [
    ['ملخص التقرير'],
    [`الفترة: ${period}`],
    customerInfoStr ? [customerInfoStr] : [],
    ['البيان', 'العدد', 'قبل الضريبة', 'الضريبة', 'الإجمالي'],
    ['إجمالي جميع الفواتير', summary.allInvoices.count, fmt(summary.allInvoices.beforeTax), fmt(summary.allInvoices.tax), fmt(summary.allInvoices.afterTax)],
    ['الفواتير الدائنة (المرتجعات)', summary.creditNotes.count, `-${fmt(summary.creditNotes.beforeTax)}`, `-${fmt(summary.creditNotes.tax)}`, `-${fmt(summary.creditNotes.afterTax)}`],
    ['الصافي (بعد خصم المرتجعات)', '—', fmt(summary.net.beforeTax), fmt(summary.net.tax), fmt(summary.net.afterTax)],
    [],
    ['طرق الدفع'],
    ['طريقة الدفع', 'عدد الفواتير', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'المدفوع', 'المتبقي'],
  ];
  (paymentMethods || []).forEach((m) => {
    sumRows.push([payLabelEx(m.method), m.count, fmt(m.totalBeforeTax), fmt(m.totalTax), fmt(m.totalAfterTax), fmt(m.totalPaid), fmt(m.totalRemaining)]);
  });

  const colsAll = [
    { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 10 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  const colsCn  = [{ wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
  const colsSum = [{ wch: 32 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];

  return [
    { name: 'جميع الفواتير',    rows: allRows, cols: colsAll, freezeRow: 4 },
    { name: 'الفواتير الدائنة', rows: cnRows,  cols: colsCn,  freezeRow: 4 },
    { name: 'الملخص',           rows: sumRows, cols: colsSum, freezeRow: null },
  ];
}

/* ═══════════════════════════════════════════════════════════
   تقرير جميع الفواتير — PDF
═══════════════════════════════════════════════════════════ */
function buildPdfHtmlForAllInvoicesReport(data, filters, cairoRegularB64, cairoBoldB64, saudiRiyalB64, branding) {
  const { allInvoices, creditNotes, paymentMethods, summary } = data;
  const br = branding || {};
  const shopName    = br.laundryNameAr || br.laundryNameEn || 'نظام المغسلة';
  const shopAddress = [br.streetNameAr, br.districtAr, br.cityAr].filter(Boolean).join('، ');

  const printDate = formatDateSimple(new Date().toISOString());
  const printTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const period = (filters.dateFrom || filters.dateTo)
    ? `من ${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`
    : 'جميع الفترات';
  const customerInfoParts = [];
  if (filters.customerId || filters.search) customerInfoParts.push(`العميل: ${filters.customerText || filters.search || ''}`);
  if (filters.subscriptionNumber) customerInfoParts.push(`رقم الاشتراك: ${filters.subscriptionNumber}`);
  const customerInfoStr = customerInfoParts.length ? customerInfoParts.join(' · ') : '';

  const Rv = (n) => `<span class="sar">&#xE900;</span> ${fmt(n)}`;

  const payLabelPdf = (pm) => {
    const map = { cash: 'نقداً', card: 'شبكة', transfer: 'تحويل', subscription: 'اشتراك', mixed: 'مختلط', credit: 'آجل' };
    return map[pm] || pm || '—';
  };
  const statusBadgePdf = (inv) => {
    const pm = String(inv.payment_method || '');
    const ps = String(inv.payment_status || '');
    const rem = Number(inv.remaining_amount || 0);
    if (pm === 'credit' && ps === 'paid' && rem === 0) return '<span class="sb sb-paid">مدفوع</span>';
    if (pm === 'credit' && ps === 'partial') return '<span class="sb sb-partial">جزئي</span>';
    if (pm === 'credit' || ps === 'pending') return '<span class="sb sb-pending">غير مدفوع</span>';
    if (rem > 0) return '<span class="sb sb-partial">جزئي</span>';
    return '<span class="sb sb-paid">مدفوع</span>';
  };
  const payBadgePdf = (pm) => {
    const map = { cash: 'pb-cash', card: 'pb-card', transfer: 'pb-transfer', subscription: 'pb-sub', mixed: 'pb-mixed', credit: 'pb-credit' };
    return `<span class="pbadge ${map[pm] || 'pb-cash'}">${payLabelPdf(pm)}</span>`;
  };

  const cnTotalV = creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0);

  const invoicesHtml = allInvoices.length
    ? allInvoices.map((inv, i) => {
        const cleaned   = inv.cleaning_date ? true : false;
        const delivered = inv.delivery_date  ? true : false;
        return `<tr class="${i % 2 !== 0 ? 'alt' : ''}">
          <td class="num">${inv.invoice_seq || inv.order_number || inv.id}</td>
          <td>${escHtmlPdf(inv.phone || inv.customer_name || '—')}</td>
          <td>${fmtDT(inv.created_at)}</td>
          <td>${payBadgePdf(inv.payment_method)}</td>
          <td class="num">${fmt(inv.total_amount)}</td>
          <td class="ctr">${cleaned   ? '<span class="op-done">✓ تم</span>' : '<span class="op-pend">—</span>'}</td>
          <td class="ctr">${delivered ? '<span class="op-done">✓ تم</span>' : '<span class="op-pend">—</span>'}</td>
          <td>${statusBadgePdf(inv)}</td>
        </tr>`;
      }).join('') + `
      <tr class="tbl-foot">
        <td colspan="8">${allInvoices.length} فاتورة</td>
      </tr>`
    : '<tr><td colspan="8" class="empty-msg">لا توجد فواتير</td></tr>';

  const cnHtml = creditNotes.length
    ? creditNotes.map((cn, i) => {
        const beforeTax = Number(cn.total_amount || 0) - Number(cn.vat_amount || 0);
        return `<tr class="${i % 2 !== 0 ? 'alt' : ''}">
          <td class="num">${cn.credit_note_seq || cn.credit_note_number}</td>
          <td class="num">${cn.original_invoice_seq || '—'}</td>
          <td>${escHtmlPdf(cn.customer_name || '—')}</td>
          <td>${fmtDT(cn.created_at)}</td>
          <td class="num">${Rv(beforeTax)}</td>
          <td class="num tax">${Rv(cn.vat_amount)}</td>
          <td class="num neg">-${Rv(cn.total_amount)}</td>
        </tr>`;
      }).join('') + `
      <tr class="tbl-foot">
        <td colspan="6">الإجمالي: ${creditNotes.length} إشعار</td>
        <td class="num neg">-${Rv(cnTotalV)}</td>
      </tr>`
    : '<tr><td colspan="7" class="empty-msg">لا توجد فواتير دائنة</td></tr>';

  const summaryRows = [
    { label: 'إجمالي جميع الفواتير',       count: summary.allInvoices.count,  before: summary.allInvoices.beforeTax,  tax: summary.allInvoices.tax,  after: summary.allInvoices.afterTax,  cls: 'row-all',    neg: false },
    { label: 'الفواتير الدائنة (المرتجعات)', count: summary.creditNotes.count, before: summary.creditNotes.beforeTax, tax: summary.creditNotes.tax, after: summary.creditNotes.afterTax, cls: 'row-credit',  neg: true },
    { label: 'الصافي (بعد خصم المرتجعات)', count: '',                         before: summary.net.beforeTax,          tax: summary.net.tax,          after: summary.net.afterTax,          cls: 'row-net',    neg: false },
  ];
  const summaryHtml = summaryRows.map(({ label, count, before, tax, after, cls, neg }) => {
    const p = neg ? '-' : '';
    return `<tr class="${cls}">
      <td>${label}</td>
      <td class="num">${count !== '' ? count : '—'}</td>
      <td class="num">${p}${Rv(before)}</td>
      <td class="num tax">${p}${Rv(tax)}</td>
      <td class="num">${p}${Rv(after)}</td>
    </tr>`;
  }).join('');

  const payMetaMap = {
    cash:         { label: 'نقداً',  icon: '💵', cls: 'p-cash' },
    card:         { label: 'شبكة',   icon: '💳', cls: 'p-card' },
    transfer:     { label: 'تحويل',  icon: '🏦', cls: 'p-transfer' },
    subscription: { label: 'اشتراك', icon: '🔄', cls: 'p-sub' },
    mixed:        { label: 'مختلط',  icon: '🔀', cls: 'p-mixed' },
    credit:       { label: 'آجل',    icon: '📋', cls: 'p-credit' },
  };
  const payGridHtml = (paymentMethods || []).length
    ? (paymentMethods || []).map((m) => {
        const meta = payMetaMap[m.method] || { label: m.method, icon: '💰', cls: 'p-cash' };
        return `<div class="pay-item ${meta.cls}">
          <span class="pay-icon">${meta.icon}</span>
          <div class="pay-details">
            <div class="pay-lbl">${meta.label}</div>
            <div class="pay-cnt">${m.count} فاتورة</div>
          </div>
          <div class="pay-right">
            <div class="pay-amt">${Rv(m.totalAfterTax)}</div>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty-msg">لا توجد مبيعات</div>';

  const logoHtmlAI = br.logoDataUrl
    ? `<img src="${br.logoDataUrl}" class="hdr-logo-img" alt="logo" />`
    : `<svg class="hdr-logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="16" rx="2"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M8 14h8M8 18h5"/>
       </svg>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
.sar{font-family:'SaudiRiyal';font-weight:400;font-style:normal;font-size:1.08em;vertical-align:middle;display:inline-block;line-height:1}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
body{direction:rtl;background:#fff;color:#000;font-size:10px}
@page{size:A4 landscape;margin:0}
.page{background:#fff;width:100%}
.hdr{background:linear-gradient(135deg,#0c4a6e 0%,#0284c7 55%,#0ea5e9 100%);padding:14px 22px;color:#fff;display:flex;align-items:center;gap:13px}
.hdr-logo{width:46px;height:46px;border-radius:10px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.hdr-logo-img{max-width:42px;max-height:42px;object-fit:contain}
.hdr-logo-svg{width:26px;height:26px;color:#fff}
.hdr-info{flex:1;min-width:0}
.hdr-shop{font-size:16px;font-weight:900;line-height:1.2}
.hdr-sub{font-size:9px;font-weight:400;opacity:.85;margin-top:3px}
.hdr-right{margin-right:auto;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.hdr-badge{background:rgba(255,255,255,.22);border-radius:20px;padding:4px 14px;font-size:10px;font-weight:700;white-space:nowrap}
.hdr-ts{font-size:8px;opacity:.72;text-align:left}
.info-bar{background:#e0f2fe;border-bottom:2px solid #7dd3fc;padding:5px 22px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#000;font-weight:700}
.body{padding:10px 18px;display:flex;flex-direction:column;gap:10px}
.sec{border-radius:7px;overflow:hidden;border:1px solid #e2e8f0}
.sec-hdr{background:linear-gradient(90deg,#0c4a6e,#0284c7);padding:6px 13px;color:#fff;font-size:10.5px;font-weight:900;display:flex;align-items:center;justify-content:space-between}
.sec-badge{background:rgba(255,255,255,.25);border-radius:20px;padding:2px 10px;font-size:8.5px;font-weight:700;white-space:nowrap}
.sec-body{background:#fff}
table{width:100%;border-collapse:collapse;font-size:9px}
thead th{padding:6px 8px;background:#0c4a6e;color:#fff;font-weight:700;text-align:right;white-space:nowrap}
thead th.num{text-align:left;direction:ltr}
thead th.ctr{text-align:center}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:last-child{border-bottom:none}
tbody tr.alt{background:#f8fafc}
tbody td{padding:5px 8px;color:#000;text-align:right;vertical-align:middle}
td.num{font-weight:700;color:#000;text-align:left;direction:ltr;white-space:nowrap}
td.ctr{text-align:center;vertical-align:middle}
td.neg{font-weight:700;color:#dc2626!important}
td.tax{color:#000}
.op-done{display:inline-block;background:#dcfce7;color:#000;border-radius:10px;padding:2px 8px;font-size:8px;font-weight:700;white-space:nowrap}
.op-pend{display:inline-block;color:#000;font-size:9px;font-weight:700}
.tbl-foot td{background:#f0f9ff;font-weight:900;font-size:9.5px;color:#000;border-top:2px solid #bae6fd;padding:5px 8px}
.tbl-foot td.num{color:#000!important}
.tbl-foot td.neg{color:#dc2626!important}
.row-all td{background:#eff6ff!important;color:#000!important;font-weight:900}
.row-all td.num,.row-all td.tax{color:#000!important}
.row-credit td{background:#fff1f2!important;color:#000!important;font-weight:800}
.row-credit td.num,.row-credit td.tax{color:#dc2626!important}
.row-net td{background:#f0fdf4!important;color:#000!important;font-weight:900;font-size:10px}
.row-net td.num,.row-net td.tax{color:#000!important}
.pay-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:9px}
.pay-item{border-radius:7px;padding:9px 10px;display:flex;align-items:center;gap:8px}
.p-cash{background:#f0fdf4;border:1px solid #86efac}
.p-card{background:#eff6ff;border:1px solid #93c5fd}
.p-bank{background:#faf5ff;border:1px solid #c4b5fd}
.p-transfer{background:#faf5ff;border:1px solid #c4b5fd}
.p-sub{background:#fff7ed;border:1px solid #fdba74}
.p-mixed{background:#fefce8;border:1px solid #fde047}
.p-credit{background:#fff1f2;border:1px solid #fda4af}
.pay-icon{font-size:18px;flex-shrink:0}
.pay-details{flex:1;min-width:0}
.pay-lbl{font-size:10px;font-weight:900;color:#000}
.pay-cnt{font-size:8.5px;color:#000}
.pay-right{text-align:left;direction:ltr}
.pay-amt{font-size:10px;font-weight:900;color:#000;white-space:nowrap}
.pay-rem{font-size:8px;color:#dc2626;white-space:nowrap}
.pbadge{display:inline-block;border-radius:10px;padding:1px 7px;font-size:8.5px;font-weight:700;color:#fff;white-space:nowrap}
.pb-cash{background:#10b981}.pb-card{background:#3b82f6}.pb-bank{background:#8b5cf6}.pb-transfer{background:#8b5cf6}
.pb-sub{background:#f59e0b}.pb-mixed{background:#6366f1}.pb-credit{background:#ef4444}
.sb{display:inline-block;border-radius:10px;padding:1px 7px;font-size:8px;font-weight:700;white-space:nowrap}
.sb-paid{background:#dcfce7;color:#000}
.sb-pending{background:#fee2e2;color:#000}
.sb-partial{background:#fef9c3;color:#000}
.empty-msg{text-align:center;color:#000;padding:12px;font-size:9px}
.footer{border-top:2px solid #e2e8f0;padding:7px 22px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.footer-brand{font-size:9.5px;font-weight:900;color:#000}
.footer-meta{font-size:8.5px;color:#000}
@media print{*{color:#000!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style>
</head>
<body>
<div class="page">
<div class="hdr">
  <div class="hdr-logo">${logoHtmlAI}</div>
  <div class="hdr-info">
    <div class="hdr-shop">${shopName}</div>
    <div class="hdr-sub">تقرير جميع الفواتير${shopAddress ? ' &nbsp;·&nbsp; ' + shopAddress : ''}</div>
  </div>
  <div class="hdr-right">
    <div class="hdr-badge">📅 ${period}</div>
    <div class="hdr-ts">🖨️ طُبع: ${printDate} ${printTime}</div>
  </div>
</div>
<div class="info-bar">
  <span>الفترة: ${period}${customerInfoStr ? ' &nbsp;·&nbsp; ' + customerInfoStr : ''}</span>
  <span>${br.vatNumber ? 'الرقم الضريبي: ' + br.vatNumber : ''}</span>
</div>
<div class="body">
<div class="sec">
  <div class="sec-hdr">
    <span>جميع الفواتير</span>
    <span class="sec-badge">${allInvoices.length} فاتورة</span>
  </div>
  <div class="sec-body">
    <table>
      <thead><tr>
        <th>رقم</th><th>العميل</th><th>التاريخ</th><th>طريقة الدفع</th>
        <th class="num">الإجمالي</th><th class="ctr">تم التنظيف</th>
        <th class="ctr">تم التسليم</th><th>الحالة</th>
      </tr></thead>
      <tbody>${invoicesHtml}</tbody>
    </table>
  </div>
</div>
${creditNotes.length ? `<div class="sec">
  <div class="sec-hdr">
    <span>الفواتير الدائنة (المرتجعات)</span>
    <span class="sec-badge">${creditNotes.length} إشعار &nbsp;·&nbsp; -${Rv(cnTotalV)}</span>
  </div>
  <div class="sec-body">
    <table>
      <thead><tr>
        <th>رقم الإشعار</th><th>الفاتورة الأصلية</th><th>العميل</th><th>التاريخ</th>
        <th class="num">قبل الضريبة</th><th class="num">الضريبة</th><th class="num">الإجمالي</th>
      </tr></thead>
      <tbody>${cnHtml}</tbody>
    </table>
  </div>
</div>` : ''}
<div class="sec">
  <div class="sec-hdr"><span>ملخص التقرير</span></div>
  <div class="sec-body">
    <table>
      <colgroup><col style="width:42%"/><col style="width:8%"/><col style="width:16%"/><col style="width:16%"/><col style="width:18%"/></colgroup>
      <thead><tr>
        <th>البيان</th><th class="num">العدد</th>
        <th class="num">قبل الضريبة</th><th class="num">الضريبة</th><th class="num">الإجمالي</th>
      </tr></thead>
      <tbody>${summaryHtml}</tbody>
    </table>
  </div>
</div>
<div class="sec">
  <div class="sec-hdr">
    <span>طرق الدفع</span>
    <span class="sec-badge">${(paymentMethods || []).length} طريقة</span>
  </div>
  <div class="sec-body">
    <div class="pay-grid">${payGridHtml}</div>
  </div>
</div>
</div>
<div class="footer">
  <span class="footer-brand">${shopName}${br.vatNumber ? ' &nbsp;·&nbsp; الرقم الضريبي: ' + br.vatNumber : ''}${br.commercialRegister ? ' &nbsp;·&nbsp; س.ت: ' + br.commercialRegister : ''}</span>
  <span class="footer-meta">تم إنشاء هذا التقرير بتاريخ ${printDate} ${printTime}</span>
</div>
</div>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   تقرير الاشتراكات — Subscriptions Report builders
   ═══════════════════════════════════════════════════════════════════ */

function _srFmtD(s) {
  if (!s) return '—';
  try {
    const d = s instanceof Date ? s : new Date(s);
    if (isNaN(d.getTime())) return String(s);
    const pad2 = (x) => String(x).padStart(2, '0');
    const day = pad2(d.getDate());
    const month = pad2(d.getMonth() + 1);
    const year = d.getFullYear();
    let result = `${day}/${month}/${year}`;
    const h24 = d.getHours();
    const mins = d.getMinutes();
    if (h24 !== 0 || mins !== 0 || (s instanceof Date) || String(s).length > 10) {
      const h12 = h24 % 12 || 12;
      const ampm = h24 < 12 ? 'AM' : 'PM';
      result += ` ${pad2(h12)}:${pad2(mins)} ${ampm}`;
    }
    return result;
  } catch { return String(s); }
}

function _srStatusAr(displayStatus, creditRemaining, daysUntilExpiry) {
  const cr = Number(creditRemaining || 0);
  const days = daysUntilExpiry !== null && daysUntilExpiry !== undefined ? Number(daysUntilExpiry) : null;
  if (displayStatus === 'active') {
    if (cr <= 0)                             return 'رصيد سالب';
    if (days !== null && days >= 0 && days <= 7) return 'قريب الانتهاء';
    return 'نشط';
  }
  if (displayStatus === 'expired') return 'منتهي';
  if (displayStatus === 'closed')  return 'مغلق';
  return displayStatus || '—';
}

function buildExcelDataForSubscriptionsReport({ periods, summary }, filters) {
  const printDate = formatDateSimple(new Date().toISOString());
  const filterParts = [];
  if (filters.dateFrom || filters.dateTo) {
    filterParts.push(`الفترة: ${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`);
  }
  const statusLabels = {
    all: 'الكل', active: 'نشط', near_expiry: 'قريب الانتهاء',
    negative: 'رصيد سالب', expired: 'منتهي', closed: 'مغلق',
  };
  if (filters.statusFilter && filters.statusFilter !== 'all') {
    filterParts.push(`الحالة: ${statusLabels[filters.statusFilter] || filters.statusFilter}`);
  }

  const R = '\uE900';

  /* ── ورقة 1: تفاصيل الفترات ── */
  const detailRows = [
    ['تقرير الاشتراكات — نظام المغسلة'],
    [`تاريخ الطباعة: ${printDate}`],
  ];
  if (filterParts.length) detailRows.push([filterParts.join(' · ')]);
  detailRows.push([]);
  detailRows.push([
    `إجمالي الفترات: ${summary.totalPeriods}`,
    '', '',
    `إجمالي الإيرادات: ${fmt(summary.totalRevenue)} ${R}`,
    '', '',
    `الرصيد المتبقي الكلي: ${fmt(summary.totalCreditRemaining)} ${R}`,
  ]);
  detailRows.push([]);
  detailRows.push([
    '#', 'رقم الاشتراك', 'اسم العميل', 'الجوال', 'الباقة',
    'من تاريخ', 'إلى تاريخ',
    `المبلغ المدفوع (${R})`, `الرصيد الممنوح (${R})`, `الرصيد المتبقي (${R})`,
    'الأيام المتبقية', 'الحالة',
  ]);
  periods.forEach((p, i) => {
    detailRows.push([
      i + 1,
      p.customer_file_ref || '',
      p.customer_name   || '',
      p.phone           || '',
      p.package_name    || '',
      _srFmtD(p.period_from),
      p.period_to ? _srFmtD(p.period_to) : '—',
      Number(p.prepaid_price_paid    || 0).toFixed(2),
      Number(p.credit_value_granted  || 0).toFixed(2),
      Number(p.credit_remaining      || 0).toFixed(2),
      p.days_until_expiry !== null && p.days_until_expiry !== undefined ? Number(p.days_until_expiry) : '—',
      _srStatusAr(p.display_status, p.credit_remaining, p.days_until_expiry),
    ]);
  });

  /* ── ورقة 2: ملخص ── */
  const summaryRows = [
    ['تقرير الاشتراكات — ملخص'],
    [`تاريخ الطباعة: ${printDate}`],
    [],
    ['البيان', 'العدد', `المبلغ (${R})`],
    ['إجمالي الفترات',         summary.totalPeriods,    fmt(summary.totalRevenue)],
    ['نشطة',                   summary.activeCount,      '—'],
    ['قريبة الانتهاء (7 أيام)', summary.nearExpiryCount,  '—'],
    ['رصيد سالب',              summary.negativeCount,    '—'],
    ['منتهية',                 summary.expiredCount,     '—'],
    ['مغلقة',                  summary.closedCount,      '—'],
    [],
    ['إجمالي الرصيد الممنوح',   '—', fmt(summary.totalCreditGranted)],
    ['إجمالي الرصيد المتبقي',   '—', fmt(summary.totalCreditRemaining)],
  ];

  return [
    {
      name: 'فترات الاشتراكات',
      rows: detailRows,
      cols: [
        { wch: 4 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 22 },
        { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 12 }, { wch: 14 },
      ],
      freezeRow: 7,
    },
    {
      name: 'ملخص',
      rows: summaryRows,
      cols: [{ wch: 28 }, { wch: 10 }, { wch: 18 }],
      freezeRow: 4,
    },
  ];
}

function buildPdfHtmlForSubscriptionsReport(
  { periods, summary },
  filters,
  cairoRegularB64,
  cairoBoldB64,
  saudiRiyalB64
) {
  const now = new Date();
  const printDate = formatDateSimple(now.toISOString());
  const pad = (x) => String(x).padStart(2, '0');
  const printTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const statusLabels = {
    all: 'الكل', active: 'نشط', near_expiry: 'قريب الانتهاء',
    negative: 'رصيد سالب', expired: 'منتهي', closed: 'مغلق',
  };

  const filterParts = [];
  if (filters.dateFrom || filters.dateTo) {
    filterParts.push(`الفترة: ${_srFmtD(filters.dateFrom)} — ${_srFmtD(filters.dateTo)}`);
  }
  if (filters.statusFilter && filters.statusFilter !== 'all') {
    filterParts.push(`الحالة: ${statusLabels[filters.statusFilter] || filters.statusFilter}`);
  }

  const Rv = (n) => `<span class="sar">&#xE900;</span> ${fmt(n)}`;

  const kpiHtml = [
    { label: 'إجمالي الفترات',         value: summary.totalPeriods,         isMoney: false },
    { label: 'نشطة',                   value: summary.activeCount,           isMoney: false },
    { label: 'قريبة الانتهاء',          value: summary.nearExpiryCount,      isMoney: false },
    { label: 'رصيد سالب',              value: summary.negativeCount,         isMoney: false },
    { label: 'منتهية / مغلقة',         value: (summary.expiredCount||0)+(summary.closedCount||0), isMoney: false },
    { label: 'إجمالي الإيرادات',        value: summary.totalRevenue,         isMoney: true  },
    { label: 'الرصيد الممنوح الكلي',   value: summary.totalCreditGranted,   isMoney: true  },
    { label: 'الرصيد المتبقي الكلي',   value: summary.totalCreditRemaining, isMoney: true  },
  ].map((k) => `
    <div class="kpi">
      <div class="kpi-lbl">${k.label}</div>
      <div class="kpi-val">${k.isMoney ? Rv(k.value) : k.value}</div>
    </div>
  `).join('');

  const periodsHtml = periods.map((p, i) => {
    const days = p.days_until_expiry !== null && p.days_until_expiry !== undefined
      ? Number(p.days_until_expiry) : null;
    const isNear = p.display_status === 'active' && days !== null && days >= 0 && days <= 7;
    const isNeg  = Number(p.credit_remaining || 0) <= 0 && p.display_status === 'active';
    const statusTxt = _srStatusAr(p.display_status, p.credit_remaining, days);
    const statusCls = isNeg ? 'sb-neg' : isNear ? 'sb-near'
      : p.display_status === 'active' ? 'sb-active'
      : p.display_status === 'expired' ? 'sb-expired' : 'sb-closed';
    return `
      <tr class="${i % 2 === 0 ? 'even' : ''}${isNear ? ' near-row' : ''}">
        <td class="ctr">${i + 1}</td>
        <td class="sub-ref">${escHtmlPdf(p.customer_file_ref || '—')}</td>
        <td>${escHtmlPdf(p.customer_name || '—')}</td>
        <td class="ltr">${escHtmlPdf(p.phone || '—')}</td>
        <td>${escHtmlPdf(p.package_name || '—')}</td>
        <td class="ctr">${_srFmtD(p.period_from)}</td>
        <td class="ctr">${p.period_to ? _srFmtD(p.period_to) : '—'}</td>
        <td class="num">${Rv(p.prepaid_price_paid)}</td>
        <td class="num">${Rv(p.credit_value_granted)}</td>
        <td class="num ${isNeg ? 'neg' : ''}">${Rv(p.credit_remaining)}</td>
        <td class="ctr">${days !== null && p.display_status === 'active' ? days + ' يوم' : '—'}</td>
        <td class="ctr"><span class="sb ${statusCls}">${statusTxt}</span></td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
.sar{font-family:'SaudiRiyal';font-weight:400;font-size:1.1em;vertical-align:middle;display:inline-block;line-height:1}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
body{direction:rtl;background:#fff;color:#000;padding:14px 16px;font-size:10px}
.hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:2px solid #0d9488;padding-bottom:10px;margin-bottom:12px}
.hdr-title{font-size:16px;font-weight:700;color:#0d9488}
.hdr-sub{font-size:9px;color:#475569;margin-top:3px}
.hdr-right{text-align:left;direction:ltr}
.hdr-date{font-size:9px;font-weight:700;color:#1e293b}
.info-bar{background:linear-gradient(90deg,rgba(20,184,166,.08),rgba(13,148,136,.05));border:1px solid rgba(20,184,166,.25);border-radius:6px;padding:6px 12px;font-size:9px;color:#0f766e;font-weight:700;text-align:center;margin-bottom:10px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px}
.kpi{border:1px solid #e2e8f0;border-radius:7px;padding:7px 9px;text-align:center;border-top:2px solid #14b8a6}
.kpi-lbl{font-size:8px;color:#64748b;font-weight:700;margin-bottom:3px}
.kpi-val{font-size:11px;font-weight:700;color:#1e293b}
.sec-hdr{background:linear-gradient(90deg,#0d9488,#14b8a6);color:#fff;padding:6px 10px;border-radius:6px 6px 0 0;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:space-between}
.sec-badge{background:rgba(255,255,255,.25);border-radius:10px;padding:1px 7px;font-size:9px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-bottom:14px}
thead tr{background:linear-gradient(90deg,rgba(20,184,166,.12),rgba(13,148,136,.08))}
thead th{padding:7px 7px;font-size:9px;font-weight:700;color:#0d9488;text-align:right;white-space:nowrap;border-bottom:2px solid #99f6e4}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:last-child{border-bottom:none}
tbody tr.even{background:#f8fafc}
tbody tr.near-row{background:#fffbeb !important}
tbody td{padding:6px 7px;font-size:9px;color:#475569;text-align:right}
.ctr{text-align:center}
.ltr{direction:ltr;text-align:left}
.num{text-align:left;direction:ltr;font-weight:700;white-space:nowrap}
.neg{color:#dc2626;font-weight:700}
.sub-ref{font-weight:700;color:#0d9488}
.sb{display:inline-block;border-radius:8px;padding:1px 6px;font-size:8px;font-weight:700;white-space:nowrap}
.sb-active {background:#dcfce7;color:#15803d}
.sb-near   {background:#fef3c7;color:#b45309}
.sb-neg    {background:#fee2e2;color:#b91c1c}
.sb-expired{background:#f1f5f9;color:#475569}
.sb-closed {background:#f1f5f9;color:#64748b}
.footer{border-top:2px solid #e2e8f0;padding:6px 12px;background:#f8fafc;display:flex;justify-content:space-between;margin-top:10px;font-size:8.5px;color:#64748b}
@media print{*{color:#000!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div class="hdr-title">تقرير الاشتراكات — نظام المغسلة</div>
    <div class="hdr-sub">${filterParts.join(' &nbsp;·&nbsp; ') || 'جميع الاشتراكات'}</div>
  </div>
  <div class="hdr-right">
    <div class="hdr-date">🖨️ طُبع: ${printDate} ${printTime}</div>
  </div>
</div>

${filterParts.length ? `<div class="info-bar">${filterParts.join(' &nbsp;·&nbsp; ')}</div>` : ''}

<div class="kpi-grid">${kpiHtml}</div>

<div class="sec-hdr">
  <span>فترات الاشتراكات</span>
  <span class="sec-badge">${periods.length} فترة</span>
</div>
<table>
  <thead>
    <tr>
      <th class="ctr">#</th>
      <th>رقم الملف</th>
      <th>اسم العميل</th>
      <th>الجوال</th>
      <th>الباقة</th>
      <th class="ctr">من تاريخ</th>
      <th class="ctr">إلى تاريخ</th>
      <th class="num">المبلغ المدفوع</th>
      <th class="num">الرصيد الممنوح</th>
      <th class="num">الرصيد المتبقي</th>
      <th class="ctr">الأيام المتبقية</th>
      <th class="ctr">الحالة</th>
    </tr>
  </thead>
  <tbody>${periodsHtml || '<tr><td colspan="12" style="text-align:center;padding:16px;color:#94a3b8">لا توجد بيانات</td></tr>'}</tbody>
</table>

<div class="footer">
  <span>نظام المغسلة — تقرير الاشتراكات</span>
  <span>تم الإنشاء: ${printDate} ${printTime}</span>
</div>
</body>
</html>`;
}
