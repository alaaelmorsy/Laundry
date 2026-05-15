const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const XLSX = require('xlsx');
const db = require('../../database/db');
const reportHtml = require('./reportHtml');
const { loadAppBrandingForReceipts } = require('./branding');
const { htmlToPdfBuffer } = require('../pdfFromHtml');

const ROOT = path.join(__dirname, '..', '..');

function readFontB64(file) {
  return fs.readFileSync(path.join(ROOT, 'assets', 'fonts', file)).toString('base64');
}

function cairoFonts() {
  return {
    cairoRegularB64: readFontB64('Cairo-Regular.woff2'),
    cairoBoldB64: readFontB64('Cairo-Bold.woff2'),
    saudiRiyalB64: readFontB64('saudi-riyal.woff')
  };
}

function ts() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
}

async function exportExpenses(type, filters = {}) {
  const { expenses } = await db.getAllExpenses(filters);
  const summary = await db.getExpensesSummary(filters);
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const wsData = reportHtml.buildExcelData(expenses, summary, filters);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 24 }];
    if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
    ws['!sheetViews'][0].rightToLeft = true;
    XLSX.utils.book_append_sheet(wb, ws, 'المصروفات');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `expenses_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtml(expenses, summary, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64);
    const buffer = await htmlToPdfBuffer(html, { landscape: true });
    return { buffer, filename: `expenses_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

async function exportCustomers(type, filters = {}) {
  const { customers } = await db.getAllCustomers(filters);
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const wsData = reportHtml.buildExcelDataForCustomers(customers, filters);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 24 }];
    if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
    ws['!sheetViews'][0].rightToLeft = true;
    XLSX.utils.book_append_sheet(wb, ws, 'العملاء');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `customers_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtmlForCustomers(customers, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64);
    const buffer = await htmlToPdfBuffer(html, { landscape: true });
    return { buffer, filename: `customers_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

async function exportProducts(type, filters = {}) {
  const rows = await db.getProductsExportRows(filters);
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const wsData = reportHtml.buildExcelDataForProducts(rows, filters);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 14 }];
    if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
    ws['!sheetViews'][0].rightToLeft = true;
    XLSX.utils.book_append_sheet(wb, ws, 'الخدمات');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `products_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtmlForProducts(rows, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64);
    const buffer = await htmlToPdfBuffer(html, { landscape: true });
    return { buffer, filename: `products_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

async function exportSubscriptions(type, filters = {}) {
  const rows = await db.getSubscriptionsExportRows(filters);
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const wsData = reportHtml.buildExcelDataForSubscriptions(rows, filters);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 4 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
      { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }
    ];
    if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
    ws['!sheetViews'][0].rightToLeft = true;
    XLSX.utils.book_append_sheet(wb, ws, 'الاشتراكات');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `subscriptions_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtmlForSubscriptions(rows, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64);
    const buffer = await htmlToPdfBuffer(html, { landscape: true });
    return { buffer, filename: `subscriptions_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

async function exportSubscriptionCustomerReport(type, customerId, subscriptionId, filters = {}) {
  const report = await db.getSubscriptionCustomerReportRows(customerId, subscriptionId);
  if (!report.customer) {
    throw new Error('العميل غير موجود');
  }
  const f = cairoFonts();
  const safeRef = (report.customer.subscription_number || `cust_${customerId}`).replace(/[^\w\-]/g, '_');

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const wsData = reportHtml.buildExcelDataForSubscriptionCustomerReport(report, filters);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
    ws['!sheetViews'][0].rightToLeft = true;
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير العميل');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer: Buffer.from(buf),
      filename: `subscription_customer_${safeRef}_${ts()}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtmlForSubscriptionCustomerReport(report, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64);
    const buffer = await htmlToPdfBuffer(html, { landscape: true });
    return {
      buffer,
      filename: `subscription_customer_${safeRef}_${ts()}.pdf`,
      mimeType: 'application/pdf'
    };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

async function exportSubscriptionReceiptPdf(periodId) {
  const d = await db.getSubscriptionReceiptData(periodId);
  if (!d) throw new Error('الفترة غير موجودة');
  const branding = await loadAppBrandingForReceipts();
  const f = cairoFonts();
  const html = reportHtml.buildPdfHtmlForSubscriptionReceipt(d, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64, branding);
  const buffer = await htmlToPdfBuffer(html, { landscape: false });
  const safeRef = String(d.subscription_ref || periodId).replace(/[^\w\-]/g, '_');
  return { buffer, filename: `subscription_receipt_${safeRef}_${ts()}.pdf`, mimeType: 'application/pdf' };
}

async function buildThermalReceiptHtml(periodId) {
  const d = await db.getSubscriptionReceiptData(periodId);
  if (!d) return null;
  const branding = await loadAppBrandingForReceipts();
  const f = cairoFonts();
  return reportHtml.buildThermalSubscriptionReceiptHtml(d, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64, branding);
}

async function exportInvoicePdf(orderId, paperType = 'thermal') {
  const data = await db.getOrderById(orderId);
  if (!data || !data.order) throw new Error('الفاتورة غير موجودة');
  
  // دمج البيانات في كائن واحد
  const order = {
    ...data.order,
    items: data.items || [],
    subscription: data.subscription || null
  };
  
  const branding = await loadAppBrandingForReceipts();
  const f = cairoFonts();
  
  // اختيار نوع الفاتورة بناءً على معامل نوع الورق
  let html;
  if (paperType === 'thermal') {
    html = reportHtml.buildThermalInvoiceHtml(order, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64, branding);
  } else {
    html = reportHtml.buildInvoicePdfHtml(order, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64, branding);
  }
  
  const buffer = await htmlToPdfBuffer(html, { landscape: false });
  
  const invoiceNum = order.invoice_seq || order.order_number || orderId;
  const safeNum = String(invoiceNum).replace(/[^\w\-]/g, '_');
  return { buffer, filename: `invoice_${safeNum}_${ts()}.pdf`, mimeType: 'application/pdf' };
}

/** تحويل HTML (بنيته من الواجهة الأمامية) إلى PDF */
async function exportInvoicePdfFromHtml(htmlContent, paperType = 'thermal', orderNum = '') {
  const f = cairoFonts();
  
  const pageDirective = paperType === 'a4'
    ? '@page{size:A4 portrait;margin:0}'
    : '@page{size:80mm auto;margin:0}';
  
  const bodyStyle = paperType === 'a4'
    ? 'body{background:#fff;display:flex;justify-content:center;align-items:flex-start;padding:0}'
    : 'body{background:#fff;display:flex;justify-content:center;padding:0}';
  
  // CSS كامل مطابق للواجهة الأمامية
  const fullCss = `
@font-face{font-family:'Cairo';src:url('data:font/woff2;base64,${f.cairoBoldB64}') format('woff2');font-weight:700 900;font-style:normal}
@font-face{font-family:'Cairo';src:url('data:font/woff2;base64,${f.cairoRegularB64}') format('woff2');font-weight:400 600;font-style:normal}
@font-face{font-family:'SaudiRiyal';src:url('data:font/woff;base64,${f.saudiRiyalB64}') format('woff');font-weight:normal;font-style:normal}
.sar{font-family:'SaudiRiyal';font-style:normal;font-weight:400;font-size:1.15em;display:inline-block;line-height:1;vertical-align:middle}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif;font-weight:700}
${bodyStyle}
/* ===== THERMAL INV-PAPER ===== */
.inv-paper{background:#fff;width:80mm;max-width:80mm;border-radius:0;padding:4mm;font-family:'Cairo',sans-serif;font-size:12px;font-weight:700;color:#000;direction:rtl;text-align:right}
.inv-logo-wrap{display:flex;justify-content:center;align-items:center;margin-bottom:8px;width:100%}
.inv-logo{max-width:100px;max-height:70px;object-fit:contain;display:block;margin:0 auto}
.inv-shop-name{font-size:14px;font-weight:700;text-align:center;color:#000;line-height:1.3}
.inv-shop-sub{font-size:12px;font-weight:700;text-align:center;color:#000;line-height:1.5}
.inv-divider{border:none;margin:0;display:none}
.inv-divider-thick{border-top:2px solid #000}
.inv-sep{display:block;border:none;border-top:2px solid #000;margin:6px 0}
.inv-section-title{font-size:12px;font-weight:700;text-transform:uppercase;color:#000;margin-bottom:3px;letter-spacing:.5px}
.inv-meta-row{display:flex;justify-content:space-between;align-items:baseline;gap:4px;margin-bottom:2px;font-size:12px;font-weight:700;line-height:1.5}
.inv-meta-label{color:#000;flex-shrink:0;font-weight:700}
.inv-meta-val{font-weight:700;text-align:left;color:#000;word-break:break-all}
.inv-table{width:100%;border-collapse:collapse;font-size:12px;font-weight:700;margin-top:4px;border:3px solid #000}
.inv-table thead tr{background:transparent}
.inv-table th{font-weight:700;font-size:11px;padding:4px 5px;color:#000;border-bottom:3px solid #000;border-left:3px solid #000}
.inv-table th:last-child{border-left:none}
.inv-th-name{text-align:right}
.inv-th-num{text-align:center;white-space:nowrap}
.inv-table tbody tr{background:transparent;border-bottom:3px solid #000}
.inv-table tbody tr:last-child{border-bottom:none}
.inv-table td{padding:4px 5px;vertical-align:middle;font-weight:700;color:#000;border-left:3px solid #000}
.inv-table td:last-child{border-left:none}
.inv-td-name{text-align:right;font-size:9px;font-weight:700;color:#000;line-height:1.3;white-space:normal;word-break:break-word}
.inv-td-en{font-size:9px;font-weight:700;color:#000;display:block;direction:ltr;text-align:right;white-space:normal;word-break:break-word}
.inv-td-num{text-align:center;direction:ltr;white-space:nowrap;font-weight:700;color:#000}
.inv-td-amt{text-align:center;direction:ltr;white-space:nowrap;font-weight:700;color:#000}
.inv-totals-box{border:2px solid #000;margin:6px 0 4px}
.inv-totals-box .inv-total-row,.inv-totals-box .inv-grand-row{padding:2px 8px;margin-bottom:0}
.inv-totals-box .inv-grand-row{margin-top:0}
.inv-total-row{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;font-weight:700;margin-bottom:2px}
.inv-total-label{color:#000;font-weight:700}
.inv-total-val{font-weight:700;color:#000}
.inv-disc-val{color:#000!important}
.inv-grand-row{margin-top:4px}
.inv-grand-label{font-size:12px;font-weight:700;color:#000}
.inv-grand-val{font-size:13px;font-weight:700;color:#000}
.inv-mixed-cash-row,.inv-mixed-card-row{border-top:1px dashed #ccc;padding:2px 8px}
.inv-barcode-wrap{text-align:center;margin:4px 0 2px;width:100%;display:flex;justify-content:center}
.inv-barcode-wrap svg{max-width:100%;height:auto}
.inv-qr-wrap{text-align:center;margin:8px 0 4px}
.inv-qr{display:inline-block;background:#fff;line-height:0}
.inv-qr svg{display:block;max-width:130px;max-height:130px}
.inv-qr-label{font-size:10px;font-weight:700;color:#000;margin-top:3px}
.inv-footer{text-align:center;font-size:12px;font-weight:700;color:#000;line-height:1.6}
.inv-footer-sub{font-size:11px;font-weight:700;color:#000}
.inv-notes-box{margin-top:6px;padding-top:5px;border-top:1px dashed #000;direction:rtl;text-align:right}
.inv-notes-title{display:block;font-size:11px;font-weight:900;color:#000;margin-bottom:3px}
.inv-notes-content{display:block;font-size:10px;font-weight:700;color:#000;white-space:pre-wrap;line-height:1.7}
/* ===== A4 PAPER ===== */
.inv-paper-a4m{background:#fff;width:210mm;min-width:210mm;font-family:'Cairo',sans-serif;font-size:9.5pt;font-weight:700;color:#000;direction:rtl;position:relative;padding:8mm 10mm 20mm}
.a4m-header{display:grid;grid-template-columns:1fr 90px 1fr;gap:3mm;align-items:center;padding-bottom:1mm;border-bottom:none;margin-bottom:0}
.a4m-header-ar{text-align:right;direction:rtl}
.a4m-header-en{text-align:left;direction:ltr}
.a4m-header-logo{display:flex;justify-content:center;align-items:center}
.a4m-header-logo img{max-height:60px;max-width:80px;object-fit:contain}
.a4m-brand-name{font-size:12pt;font-weight:900;color:#000;margin-bottom:1mm;line-height:1.2}
.a4m-brand-sub{font-size:7.5pt;font-weight:700;color:#000;margin-bottom:.5mm;line-height:1.3}
.a4m-title-band{background:#fff;color:#000;text-align:center;padding:1mm 0 2mm;font-size:10pt;font-weight:900;display:flex;justify-content:center;align-items:center;gap:5mm;margin-bottom:3mm;border:none}
.a4m-title-sep{opacity:.6}
.a4m-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);border:2px solid #000;margin-bottom:3mm;background:#000;gap:0}
.a4m-meta-cell{padding:2.5mm 3.5mm;background:#fff;border-left:2px solid #000;display:flex;flex-direction:column;align-items:center;text-align:center;gap:1mm}
.a4m-meta-cell:last-child{border-left:none}
.a4m-meta-lbl{font-size:7pt;font-weight:900;color:#000;letter-spacing:.3px;text-transform:uppercase;border-bottom:1px solid #e0e0e0;padding-bottom:1mm;margin-bottom:.5mm;width:100%;text-align:center}
.a4m-meta-val{font-size:11pt;font-weight:900;color:#000;line-height:1.2;text-align:center}
.a4m-bill-to{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:3mm}
.a4m-card{border:3px solid #000;padding:2mm 3mm;background:#fff}
.a4m-card-title{font-size:8.5pt;font-weight:900;color:#000;border-bottom:2px solid #000;padding-bottom:1mm;margin-bottom:1mm;background:#fff}
.a4m-kv{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;font-size:8pt;padding:.5mm 0;border-bottom:2px solid #000}
.a4m-kv:last-child{border-bottom:none}
.a4m-kv span{color:#000;font-weight:700}
.a4m-kv b{color:#000;font-weight:900}
.a4m-items-wrap{overflow-x:visible}
.a4m-items{width:100%;border-collapse:collapse;font-size:8pt;font-weight:700;margin-bottom:3mm;border:3px solid #000}
.a4m-items thead th{background:#fff;color:#000;font-weight:900;padding:2mm 1.5mm;text-align:center;font-size:7pt;border-right:2px solid #000;border-bottom:2px solid #000}
.a4m-th-name{text-align:start!important}
.a4m-items thead th:first-child{border-right:none}
.a4m-items tbody td{padding:1.5mm 1.5mm;border-bottom:2px solid #000;border-right:2px solid #000;vertical-align:middle;color:#000;font-weight:700;background:#fff}
.a4m-items tbody td:first-child{border-right:none}
.a4m-items tbody tr:last-child td{border-bottom:none}
.a4m-items tbody tr:nth-child(even) td{background:#f7f7f7}
.a4m-td-num{text-align:center;direction:ltr;font-variant-numeric:tabular-nums;font-weight:800;white-space:nowrap}
.a4m-td-name{text-align:start}
.a4m-td-en{font-size:6.5pt;font-weight:700;color:#000;display:block;direction:ltr}
.a4m-qr-row{display:flex;justify-content:center;align-items:center;width:100%;margin:0 0 4mm}
.a4m-summary{display:flex;flex-direction:row;direction:rtl;gap:4mm;align-items:flex-start;justify-content:flex-end;margin-bottom:14mm}
.a4m-qr-box{text-align:center;flex-shrink:0;width:35mm;margin:0 auto}
.a4m-qr{width:30mm;height:30mm;margin:0 auto 1mm;border:2px solid #000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff}
.a4m-qr svg{display:block;width:26mm!important;height:26mm!important;max-width:none!important}
.a4m-qr-label{font-size:6.5pt;font-weight:700;color:#000}
.a4m-totals-col{display:flex;flex-direction:column;gap:3mm;flex-shrink:0;margin-inline-end:auto}
.a4m-totals{border:3px solid #000;width:95mm;flex-shrink:0;background:#fff}
.a4m-notes-box{width:95mm;background:#fff;padding:2mm 0 0 0;font-size:8pt;font-weight:700;color:#000;line-height:1.7;direction:rtl}
.a4m-notes-title{font-size:8.5pt;font-weight:900;color:#000;border-bottom:1.5px solid #000;padding-bottom:1mm;margin-bottom:2mm;display:block}
.a4m-notes-content{font-size:7.5pt;font-weight:700;color:#000;white-space:pre-wrap;line-height:1.8}
.a4m-trow{display:flex;justify-content:space-between;align-items:stretch;padding:0;font-size:8.5pt;font-weight:700;border-bottom:2px solid #000;gap:0;background:#fff}
.a4m-trow:last-child{border-bottom:none}
.a4m-trow span{color:#000;flex:1;padding:1.5mm 3mm;display:flex;align-items:center}
.a4m-trow b{font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap;color:#000;padding:1.5mm 3mm;display:flex;align-items:center;justify-content:flex-end;border-right:2px solid #000;min-width:30mm}
.a4m-neg{color:#000!important}
.a4m-grand{background:#fff!important}
.a4m-grand span,.a4m-grand b{color:#000!important;font-size:8pt;font-weight:900}
  .a4m-mixed-row{border-top:1px dashed #000}
  .a4m-mixed-row span{color:#000;font-size:.88em}
  .a4m-mixed-row b{color:#000;font-size:.9em}
.a4m-footer{position:absolute;left:10mm;right:10mm;bottom:5mm;background:#fff;color:#000;border:2px solid #000;padding:2mm 5mm;font-size:8pt;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:4mm}
/* ===== STANDALONE A4 PAPER (invoice-a4.html) ===== */
.a4-paper{width:210mm;min-height:297mm;padding:8mm 10mm 18mm;margin:0 auto;background:#fff;color:#000;font-size:9.5pt;font-weight:700;line-height:1.4;position:relative;box-shadow:none}
.a4-header{display:grid;grid-template-columns:1fr 110px 1fr;gap:2mm 4mm;align-items:center;padding-bottom:1mm;margin-bottom:0;border:none;outline:none;box-shadow:none}
.a4-header-ar{text-align:right;direction:rtl;grid-column:1;grid-row:1}
.a4-header-en{text-align:left;direction:ltr;grid-column:3;grid-row:1}
.a4-header-logo{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2mm;grid-column:2;grid-row:1}
.a4-header-logo img{max-height:70px;max-width:100px;object-fit:contain}
.a4-brand-name{font-size:13pt;font-weight:900;color:#000;margin-bottom:1.5mm;line-height:1.2}
.a4-brand-sub{font-size:8pt;font-weight:700;color:#000;margin-bottom:.5mm;line-height:1.3}
.a4-title-band{background:#fff;color:#000;text-align:center;padding:1mm 0 2mm;font-size:10pt;font-weight:900;letter-spacing:.3px;line-height:1.2;display:flex;justify-content:center;align-items:center;gap:3mm;margin-bottom:3mm;border:none}
.a4-title-sep{color:#000;opacity:.5}
.a4-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);border:2px solid #000;margin-bottom:3mm;background:#000;gap:0}
.a4-meta-cell{padding:2.5mm 3.5mm;background:#fff;border-left:2px solid #000;display:flex;flex-direction:column;align-items:center;text-align:center;gap:1mm}
.a4-meta-cell:last-child{border-left:none}
.a4-meta-lbl{font-size:7pt;font-weight:900;color:#000;letter-spacing:.3px;text-transform:uppercase;border-bottom:1px solid #e0e0e0;padding-bottom:1mm;margin-bottom:.5mm;width:100%;text-align:center}
.a4-meta-val{font-size:11pt;font-weight:900;color:#000;font-variant-numeric:tabular-nums;line-height:1.2;text-align:center}
.a4-bill-to{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:3mm}
.a4-card{border:2px solid #000;padding:2.5mm 3mm;background:#fff}
.a4-card-title{font-size:9pt;font-weight:900;color:#000;border-bottom:2px solid #000;padding-bottom:1.5mm;margin-bottom:1.5mm}
.a4-kv{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;font-size:8.5pt;padding:.8mm 0;border-bottom:1px solid #000}
.a4-kv:last-child{border-bottom:none}
.a4-kv span{color:#000;font-weight:700}
.a4-kv b{color:#000;font-weight:900}
.a4-items-wrap{overflow-x:visible}
.a4-items{width:100%;border-collapse:collapse;font-size:8pt;font-weight:700;margin-bottom:3mm;border:2px solid #000}
.a4-th-num,.a4-th-name{background:#000;color:#fff;font-weight:900;padding:2mm 1.5mm;text-align:center;font-size:7.5pt;border:2px solid #fff}
.a4-th-name{text-align:start}
.a4-items tbody td{padding:1.5mm 1.5mm;border:2px solid #000;vertical-align:middle;color:#000;font-weight:700;background:#fff}
.a4-items tbody tr:nth-child(even) td{background:#f7f7f7}
.a4-td-num{text-align:center;direction:ltr;font-variant-numeric:tabular-nums;font-weight:800;white-space:nowrap}
.a4-td-name{text-align:start}
.a4-td-en{font-size:7.5pt;font-weight:700;color:#000;display:block;direction:ltr}
.a4-qr-row{display:flex;justify-content:center;align-items:center;width:100%;margin:0 0 4mm}
.a4-summary{display:flex;flex-direction:row;direction:rtl;gap:4mm;align-items:flex-start;justify-content:flex-end;margin-bottom:16mm}
.a4-qr-box{text-align:center;flex-shrink:0;width:38mm;margin:0 auto}
.a4-qr{width:34mm;height:34mm;margin:0 auto 1.5mm;border:2px solid #000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff}
.a4-qr svg{display:block;width:30mm!important;height:30mm!important;max-width:none!important}
.a4-qr-label{font-size:7pt;font-weight:700;color:#000}
.a4-totals{border:2px solid #000;width:95mm;flex-shrink:0;margin-inline-end:auto;background:#fff;direction:rtl}
.a4-totals-col{display:flex;flex-direction:column;gap:3mm;flex-shrink:0;margin-inline-end:auto}
.a4-notes-box{width:95mm;background:#fff;direction:rtl;padding:2.5mm 0 0 0;font-size:8.5pt;font-weight:700;color:#000;line-height:1.7}
.a4-notes-title{font-size:9pt;font-weight:900;color:#000;border-bottom:1.5px solid #000;padding-bottom:1mm;margin-bottom:2mm;display:block}
.a4-notes-content{font-size:8pt;font-weight:700;color:#000;white-space:pre-wrap;line-height:1.8}
.a4-trow{display:flex;justify-content:space-between;align-items:center;padding:0;font-size:9pt;font-weight:700;border-bottom:2px solid #000;gap:0;background:#fff}
.a4-trow:last-child{border-bottom:none}
.a4-trow span{color:#000;padding:2mm 3mm;flex:1}
.a4-trow b{color:#000;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap;padding:2mm 3mm;border-inline-start:2px solid #000;text-align:center;min-width:32mm}
.a4-neg{color:#000!important}
.a4-grand{background:#fff!important;border-top:2px solid #000!important}
.a4-grand span,.a4-grand b{color:#000!important;font-size:8pt;font-weight:900}
.a4-grand b{border-inline-start:2px solid #000!important}
  .a4-mixed-row{border-top:1px dashed #000}
  .a4-mixed-row span{color:#000;font-size:.88em}
  .a4-mixed-row b{color:#000;font-size:.9em}
.a4-footer{position:absolute;left:10mm;right:10mm;bottom:6mm;background:#fff;color:#000;border:2px solid #000;padding:2.5mm 5mm;font-size:8.5pt;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:4mm}
/* ===== PRINT ===== */
@media print{
  ${pageDirective}
  html,body{background:#fff!important;overflow:visible!important;height:auto!important;max-height:none!important}
  .inv-paper{box-shadow:none!important;border-radius:0!important;width:80mm!important;max-width:80mm!important;margin:0 auto!important;padding:4mm!important}
  .inv-paper-a4m{display:block!important;width:210mm!important;max-width:210mm!important;padding:8mm 10mm 20mm!important}
  .a4m-items tbody td{background:#fff!important}
  .a4m-items tbody tr:nth-child(even) td{background:#f7f7f7!important}
  .a4m-items thead th{background:#fff!important;color:#000!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .a4m-grand{background:#fff!important}
  .a4m-title-band{background:#fff!important}
  .a4m-footer{background:#fff!important}
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
  .a4-footer{background:#fff!important}
}
`.trim();
  
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>${fullCss}</style>
</head>
<body>
${htmlContent}
</body>
</html>`;
  
  const buffer = await htmlToPdfBuffer(html, { landscape: false });
  const safeNum = String(orderNum || '0').replace(/[^\w\u0600-\u06FF\s\-]/g, '').trim();
  return { buffer, filename: `فاتورة رقم ${safeNum}.pdf`, mimeType: 'application/pdf' };
}

async function exportHangerTicketPdf(orderId) {
  const data = await db.getOrderById(orderId);
  if (!data || !data.order) throw new Error('الفاتورة غير موجودة');
  if (!data.order.hanger_id || !data.order.hanger_number) throw new Error('لا توجد شماعة مرتبطة بهذه الفاتورة');

  const branding = await loadAppBrandingForReceipts();
  const f = cairoFonts();
  const html = reportHtml.buildHangerTicketHtml(
    data.order,
    { hanger_number: data.order.hanger_number },
    branding,
    f.cairoRegularB64,
    f.cairoBoldB64,
    f.saudiRiyalB64
  );

  const buffer = await htmlToPdfBuffer(html, { landscape: false });
  const safeNum = String(data.order.hanger_number || '0').replace(/[^\w\u0600-\u06FF\s\-]/g, '').trim();
  return { buffer, filename: `تيكت شماعة ${safeNum}.pdf`, mimeType: 'application/pdf' };
}

async function buildThermalHangerTicketHtml(orderId) {
  const data = await db.getOrderById(orderId);
  if (!data || !data.order) return null;
  if (!data.order.hanger_id || !data.order.hanger_number) return null;

  const branding = await loadAppBrandingForReceipts();
  const f = cairoFonts();
  return reportHtml.buildHangerTicketHtml(
    data.order,
    { hanger_number: data.order.hanger_number },
    branding,
    f.cairoRegularB64,
    f.cairoBoldB64,
    f.saudiRiyalB64
  );
}

async function exportCreditNotes(type, filters = {}) {
  const { creditNotes } = await db.getCreditNotes({ ...filters, page: 1, pageSize: 100000 });
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['#', 'رقم الإشعار', 'رقم الفاتورة الأصلية', 'التاريخ', 'العميل', 'الهاتف', 'الإجمالي', 'ضريبة', 'الإجمالي شامل الضريبة', 'بواسطة']
    ];
    creditNotes.forEach((cn, i) => {
      rows.push([
        i + 1,
        cn.credit_note_number || '',
        cn.original_invoice_seq ? String(cn.original_invoice_seq) : (cn.original_order_number || ''),
        cn.created_at ? new Date(cn.created_at).toLocaleDateString('en-US') : '',
        cn.customer_name || '—',
        cn.phone || '—',
        Number(cn.subtotal || 0).toFixed(2),
        Number(cn.vat_amount || 0).toFixed(2),
        Number(cn.total_amount || 0).toFixed(2),
        cn.created_by || ''
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];
    if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
    ws['!sheetViews'][0].rightToLeft = true;
    XLSX.utils.book_append_sheet(wb, ws, 'الفواتير الدائنة');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `credit_notes_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const sarSymbol = '\uE900';
    const cairoB64 = f.cairoBoldB64;
    const saudiB64 = f.saudiRiyalB64;

    const rows = creditNotes.map((cn, i) => `
      <tr>
        <td>${i + 1}</td>
        <td dir="ltr">${cn.credit_note_number || ''}</td>
        <td dir="ltr">${cn.original_invoice_seq || cn.original_order_number || '—'}</td>
        <td dir="ltr">${cn.created_at ? new Date(cn.created_at).toLocaleDateString('en-US') : ''}</td>
        <td>${cn.customer_name || '—'}</td>
        <td dir="ltr">${cn.phone || '—'}</td>
        <td dir="ltr"><span class="sar">${sarSymbol}</span> ${Number(cn.total_amount || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
      <style>
        @font-face{font-family:'Cairo';src:url('data:font/woff2;base64,${cairoB64}') format('woff2');font-weight:700}
        @font-face{font-family:'SaudiRiyal';src:url('data:font/woff;base64,${saudiB64}') format('woff')}
        *{font-family:'Cairo',sans-serif;font-weight:700;box-sizing:border-box}
        body{margin:16px;color:#1e293b;direction:rtl}
        h1{font-size:18px;margin-bottom:12px;text-align:center}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:#8b5cf6;color:#fff;padding:7px 10px;text-align:right;white-space:nowrap}
        td{padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right}
        tr:nth-child(even) td{background:#f8fafc}
        .sar{font-family:'SaudiRiyal';font-size:1.1em}
      </style></head><body>
      <h1>الفواتير الدائنة</h1>
      <table><thead><tr>
        <th>#</th><th>رقم الإشعار</th><th>فاتورة أصلية</th><th>التاريخ</th>
        <th>العميل</th><th>الهاتف</th><th>الإجمالي</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;

    const buffer = await htmlToPdfBuffer(html, { landscape: true });
    return { buffer, filename: `credit_notes_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

const MAX_PRODUCT_IMAGE_RAW_BYTES = 15 * 1024 * 1024;

async function exportReport(type, filters = {}) {
  const [data, branding] = await Promise.all([
    db.getReportData(filters),
    loadAppBrandingForReceipts().catch(() => ({}))
  ]);
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const sheets = reportHtml.buildReportExcelSheets(data, filters, branding);
    sheets.forEach(({ name, rows, cols, merges, freezeRow }) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = cols;
      if (merges && merges.length) ws['!merges'] = merges;
      ws['!sheetViews'] = [{
        rightToLeft: true,
        state: freezeRow ? 'frozen' : undefined,
        ySplit: freezeRow || undefined,
        topLeftCell: freezeRow ? `A${freezeRow + 1}` : undefined
      }];
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `report_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtmlForReport(data, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64, branding);
    const buffer = await htmlToPdfBuffer(html, { landscape: false });
    return { buffer, filename: `report_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

async function exportAllInvoicesReport(type, filters = {}) {
  const [data, branding] = await Promise.all([
    db.getAllInvoicesReport(filters),
    loadAppBrandingForReceipts().catch(() => ({}))
  ]);
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const sheets = reportHtml.buildAllInvoicesReportExcelSheets(data, filters);
    sheets.forEach(({ name, rows, cols, freezeRow }) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = cols;
      ws['!sheetViews'] = [{
        rightToLeft: true,
        state: freezeRow ? 'frozen' : undefined,
        ySplit: freezeRow || undefined,
        topLeftCell: freezeRow ? `A${freezeRow + 1}` : undefined
      }];
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `all-invoices-report_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtmlForAllInvoicesReport(data, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64, branding);
    const buffer = await htmlToPdfBuffer(html, { landscape: true });
    return { buffer, filename: `all-invoices-report_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

async function exportSubscriptionsReport(type, filters = {}) {
  const data = await db.getSubscriptionsReport(filters);
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const sheets = reportHtml.buildExcelDataForSubscriptionsReport(data, filters);
    sheets.forEach(({ name, rows, cols, freezeRow }) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = cols;
      ws['!sheetViews'] = [{
        rightToLeft: true,
        state: freezeRow ? 'frozen' : undefined,
        ySplit: freezeRow || undefined,
        topLeftCell: freezeRow ? `A${freezeRow + 1}` : undefined,
      }];
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer: Buffer.from(buf),
      filename: `subscriptions-report_${ts()}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtmlForSubscriptionsReport(
      data, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64
    );
    const buffer = await htmlToPdfBuffer(html, { landscape: true });
    return { buffer, filename: `subscriptions-report_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

async function exportTypesReport(type, filters = {}) {
  const [data, branding] = await Promise.all([
    db.getTypesReport(filters),
    loadAppBrandingForReceipts().catch(() => ({}))
  ]);
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const sheets = reportHtml.buildTypesReportExcelSheets(data, filters, branding);
    sheets.forEach(({ name, rows, cols, freezeRow }) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = cols;
      ws['!sheetViews'] = [{
        rightToLeft: true,
        state: freezeRow ? 'frozen' : undefined,
        ySplit: freezeRow || undefined,
        topLeftCell: freezeRow ? `A${freezeRow + 1}` : undefined,
      }];
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `types-report_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtmlForTypesReport(
      data, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64, branding
    );
    const buffer = await htmlToPdfBuffer(html, { landscape: false });
    return { buffer, filename: `types-report_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

module.exports = {
  exportExpenses,
  exportCustomers,
  exportProducts,
  exportSubscriptions,
  exportSubscriptionCustomerReport,
  exportSubscriptionReceiptPdf,
  buildThermalReceiptHtml,
  exportInvoicePdf,
  exportInvoicePdfFromHtml,
  exportHangerTicketPdf,
  buildThermalHangerTicketHtml,
  exportCreditNotes,
  exportReport,
  exportAllInvoicesReport,
  exportSubscriptionsReport,
  exportTypesReport,
  MAX_PRODUCT_IMAGE_RAW_BYTES,
  cairoFonts
};
