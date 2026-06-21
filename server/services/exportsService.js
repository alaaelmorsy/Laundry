const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const XLSX = require('xlsx');
const db = require('../../database/db');
const reportHtml = require('./reportHtml');
const { loadAppBrandingForReceipts } = require('./branding');
const { htmlToPdfBuffer } = require('../pdfFromHtml');

const { APP_ROOT: ROOT } = require('../paths');

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
    ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 24 }];
    if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
    ws['!sheetViews'][0].rightToLeft = true;
    XLSX.utils.book_append_sheet(wb, ws, 'المصروفات');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `مصروفات_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtml(expenses, summary, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64);
    const buffer = await htmlToPdfBuffer(html, { landscape: true });
    return { buffer, filename: `مصروفات_${ts()}.pdf`, mimeType: 'application/pdf' };
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
#invFooterNotes{text-align:center}
.inv-notes-title{display:block;font-size:11px;font-weight:900;color:#000;margin-bottom:3px}
#invFooterNotes .inv-notes-title,#invFooterNotes .inv-notes-content{text-align:center}
.inv-notes-content{display:block;font-size:10px;font-weight:700;color:#000;white-space:pre-wrap;line-height:1.7}
.inv-shop-contact-row{display:flex;align-items:center;justify-content:center;gap:4px;direction:ltr}
.inv-contact-icon{width:11px!important;height:11px!important;min-width:11px;min-height:11px;max-width:11px;max-height:11px;flex-shrink:0;display:inline-block;overflow:hidden}
.cr-info-grid{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #000;margin:2px 0}
.cr-info-cell{display:flex;flex-direction:column;padding:2px 4px;border:1px solid #000}
.cr-info-label{font-size:9px;font-weight:700;color:#000;line-height:1.3}
.cr-info-val{font-size:10px;font-weight:900;color:#000;line-height:1.3;word-break:break-word}
.inv-paid-row,.inv-remaining-row{border-top:1px dashed #ccc;padding:2px 8px}
.inv-loyalty-row{border-top:1px dashed #000;padding:2px 8px;font-size:10px}
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
.a4m-totals-col{display:flex;flex-direction:column;gap:3mm;flex-shrink:0}
.a4m-totals{border:3px solid #000;width:95mm;flex-shrink:0;background:#fff}
.a4m-notes-box{width:100%;background:#fff;padding:2mm 0 0 0;font-size:8pt;font-weight:700;color:#000;line-height:1.7;direction:rtl;text-align:center}
.a4m-notes-title{font-size:8.5pt;font-weight:900;color:#000;border-bottom:1.5px solid #000;padding-bottom:1mm;margin-bottom:2mm;display:block;text-align:center}
.a4m-notes-content{font-size:7.5pt;font-weight:700;color:#000;white-space:pre-wrap;line-height:1.8;text-align:center}
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
.a4-summary{display:flex;flex-direction:row;direction:rtl;gap:4mm;align-items:flex-start;justify-content:space-between;margin-bottom:16mm}
.a4-qr-box{text-align:center;flex-shrink:0;width:38mm}
.a4-qr{width:34mm;height:34mm;margin:0 auto 1.5mm;border:2px solid #000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff}
.a4-qr svg{display:block;width:30mm!important;height:30mm!important;max-width:none!important}
.a4-qr-label{font-size:7pt;font-weight:700;color:#000}
.a4-totals{border:2px solid #000;width:95mm;flex-shrink:0;background:#fff;direction:rtl}
.a4-totals-col{display:flex;flex-direction:column;gap:3mm;flex-shrink:0}
.a4-notes-box{width:100%;background:#fff;direction:rtl;padding:2.5mm 0 0 0;font-size:8.5pt;font-weight:700;color:#000;line-height:1.7;text-align:center}
.a4-notes-title{font-size:9pt;font-weight:900;color:#000;border-bottom:1.5px solid #000;padding-bottom:1mm;margin-bottom:2mm;display:block;text-align:center}
.a4-notes-content{font-size:8pt;font-weight:700;color:#000;white-space:pre-wrap;line-height:1.8;text-align:center}
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
  const invoiceNum = String(data.order.invoice_seq || data.order.order_number || data.order.id || '');
  const hangerNum = String(data.order.hanger_number || '');
  const html = reportHtml.buildHangerTicketHtml(
    data.order,
    { hanger_number: data.order.hanger_number },
    branding,
    f.cairoRegularB64,
    f.cairoBoldB64,
    f.saudiRiyalB64
  );
  return { html, barcodeValue: `INV-${invoiceNum}|${hangerNum}` };
}

async function exportCreditNotes(type, filters = {}) {
  const { creditNotes } = await db.getCreditNotes({ ...filters, page: 1, pageSize: 100000 });
  const f = cairoFonts();
  const branding = await loadAppBrandingForReceipts().catch(() => ({}));

  const shopName = branding.laundryNameAr || branding.laundryNameEn || 'نظام المغسلة';
  const printDate = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const printTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  let period = 'اليوم';
  if (filters.dateFrom && filters.dateTo) {
    period = `من ${filters.dateFrom} إلى ${filters.dateTo}`;
  } else if (filters.dateFrom) {
    period = `من ${filters.dateFrom}`;
  } else if (filters.dateTo) {
    period = `إلى ${filters.dateTo}`;
  }

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const rows = [];
    const merges = [];
    let r = 0;

    const addMergedRow = (text, cols) => {
      rows.push([text]);
      merges.push({ s: { r, c: 0 }, e: { r, c: cols - 1 } });
      r++;
    };

    // Header info
    addMergedRow(shopName, 11);
    if (branding.vatNumber) {
      addMergedRow(`الرقم الضريبي: ${branding.vatNumber}`, 11);
    }
    if (branding.commercialRegister) {
      addMergedRow(`السجل التجاري: ${branding.commercialRegister}`, 11);
    }
    const addressStr = [branding.buildingNumber, branding.streetNameAr, branding.districtAr, branding.cityAr, branding.postalCode].filter(Boolean).join('، ');
    if (addressStr) {
      addMergedRow(`العنوان: ${addressStr}`, 11);
    }
    addMergedRow('تقرير الفواتير الدائنة (المرتجعات)', 11);
    addMergedRow(`الفترة: ${period}`, 11);
    addMergedRow(`تاريخ الطباعة: ${printDate} ${printTime}`, 11);

    rows.push([]); r++; // blank row

    // Table Headers
    rows.push([
      '#',
      'رقم الإشعار',
      'رقم الفاتورة الأصلية',
      'التاريخ',
      'العميل',
      'الهاتف',
      'المبلغ (قبل الضريبة)',
      'الضريبة (15%)',
      'الإجمالي شامل الضريبة',
      'ملاحظات',
      'بواسطة'
    ]);
    r++;

    let totalSubtotal = 0;
    let totalVat = 0;
    let totalAmount = 0;

    creditNotes.forEach((cn, i) => {
      const sub = Number(cn.subtotal || 0);
      const vat = Number(cn.vat_amount || 0);
      const tot = Number(cn.total_amount || 0);

      totalSubtotal += sub;
      totalVat += vat;
      totalAmount += tot;

      rows.push([
        i + 1,
        cn.credit_note_number || '',
        cn.original_invoice_seq ? String(cn.original_invoice_seq) : (cn.original_order_number || '—'),
        cn.created_at ? new Date(cn.created_at).toLocaleDateString('en-US') : '',
        cn.customer_name || '—',
        cn.phone || '—',
        sub.toFixed(2),
        vat.toFixed(2),
        tot.toFixed(2),
        cn.notes || '—',
        cn.created_by || ''
      ]);
      r++;
    });

    rows.push([]); r++; // blank row

    // Summary/Footer Row
    rows.push([
      `الإجمالي: ${creditNotes.length} إشعار`,
      '', '', '', '', '',
      totalSubtotal.toFixed(2),
      totalVat.toFixed(2),
      totalAmount.toFixed(2),
      '',
      ''
    ]);
    r++;

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 },  // #
      { wch: 15 }, // رقم الإشعار
      { wch: 18 }, // رقم الفاتورة الأصلية
      { wch: 18 }, // التاريخ
      { wch: 22 }, // العميل
      { wch: 15 }, // الهاتف
      { wch: 18 }, // قبل الضريبة
      { wch: 15 }, // الضريبة
      { wch: 22 }, // شامل الضريبة
      { wch: 25 }, // ملاحظات
      { wch: 16 }  // بواسطة
    ];
    ws['!merges'] = merges;
    if (!ws['!sheetViews']) ws['!sheetViews'] = [{}];
    ws['!sheetViews'][0].rightToLeft = true;
    XLSX.utils.book_append_sheet(wb, ws, 'الفواتير الدائنة');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `credit_notes_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const sarSymbol = '&#xE900;';
    const cairoRegularB64 = f.cairoRegularB64;
    const cairoBoldB64 = f.cairoBoldB64;
    const saudiRiyalB64 = f.saudiRiyalB64;

    let totalSubtotal = 0;
    let totalVat = 0;
    let totalAmount = 0;

    const tableRowsHtml = creditNotes.map((cn, i) => {
      const sub = Number(cn.subtotal || 0);
      const vat = Number(cn.vat_amount || 0);
      const tot = Number(cn.total_amount || 0);

      totalSubtotal += sub;
      totalVat += vat;
      totalAmount += tot;

      const origInvoice = cn.original_invoice_seq ? String(cn.original_invoice_seq) : (cn.original_order_number || '—');

      return `
        <tr class="${i % 2 !== 0 ? 'alt' : ''}">
          <td>${i + 1}</td>
          <td dir="ltr" style="font-weight:bold;">${cn.credit_note_number || ''}</td>
          <td dir="ltr">${origInvoice}</td>
          <td dir="ltr">${cn.created_at ? new Date(cn.created_at).toLocaleDateString('en-US') + ' ' + new Date(cn.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}</td>
          <td>${cn.customer_name || '—'}</td>
          <td dir="ltr">${cn.phone || '—'}</td>
          <td>${cn.created_by || ''}</td>
          <td class="num"><span class="sar">${sarSymbol}</span> ${sub.toFixed(2)}</td>
          <td class="num"><span class="sar">${sarSymbol}</span> ${vat.toFixed(2)}</td>
          <td class="num" style="color:#7e22ce; font-weight: bold;"><span class="sar">${sarSymbol}</span> ${tot.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const logoHtml = branding.logoDataUrl
      ? `<img src="${branding.logoDataUrl}" class="hdr-logo-img" alt="logo" />`
      : `<svg class="hdr-logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="16" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <path d="M8 14h8M8 18h5"/>
         </svg>`;

    const shopAddress = [branding.streetNameAr, branding.districtAr, branding.cityAr].filter(Boolean).join('، ');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';font-weight:400;src:url('data:font/woff2;base64,${cairoRegularB64}') format('woff2')}
@font-face{font-family:'Cairo';font-weight:700;src:url('data:font/woff2;base64,${cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';font-weight:400;src:url('data:font/woff;base64,${saudiRiyalB64}') format('woff')}
.sar{font-family:'SaudiRiyal';font-weight:400;font-style:normal;font-size:1.08em;vertical-align:middle;display:inline-block;line-height:1}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
body{direction:rtl;background:#fff;color:#000;font-size:10px;padding:20px}
@page{size:A4 landscape;margin:0.8cm}
.page{background:#fff;width:100%}

/* Header Style - Elegant Purple Gradient */
.hdr{background:linear-gradient(135deg,#7e22ce 0%,#8b5cf6 55%,#a78bfa 100%);padding:18px 24px;color:#fff;border-radius:12px;display:flex;align-items:center;gap:15px;margin-bottom:15px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)}
.hdr-logo{width:55px;height:55px;border-radius:12px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.hdr-logo-img{max-width:50px;max-height:50px;object-fit:contain}
.hdr-logo-svg{width:32px;height:32px;color:#fff}
.hdr-info{flex:1;min-width:0}
.hdr-shop{font-size:19px;font-weight:900;line-height:1.2}
.hdr-sub{font-size:10px;font-weight:400;opacity:.85;margin-top:4px}
.hdr-right{margin-right:auto;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.hdr-badge{background:rgba(255,255,255,.22);border-radius:20px;padding:5px 15px;font-size:10px;font-weight:700;white-space:nowrap}
.hdr-ts{font-size:9px;opacity:.75;text-align:left}

/* Metadata Bar */
.info-bar{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:8px 20px;display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#4c1d95;font-weight:700;margin-bottom:15px}

/* KPI Summary Cards */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.kpi-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 15px;display:flex;flex-direction:column;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.02)}
.kpi-card.purple{border-left:4px solid #7e22ce;background:#faf5ff}
.kpi-card.green{border-left:4px solid #10b981;background:#f0fdf4}
.kpi-label{font-size:9.5px;color:#64748b;font-weight:700}
.kpi-val{font-size:16px;font-weight:900;color:#1e293b}
.kpi-val.purple-text{color:#7e22ce}
.kpi-val.green-text{color:#0f766e}

/* Table Style */
.sec{border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.02)}
.sec-hdr{background:linear-gradient(90deg,#7e22ce,#8b5cf6);padding:9px 16px;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:space-between}
.sec-badge{background:rgba(255,255,255,.25);border-radius:20px;padding:3px 12px;font-size:9.5px;font-weight:700;white-space:nowrap}
.sec-body{background:#fff}

table{width:100%;border-collapse:collapse;font-size:10.5px}
thead th{padding:9px 12px;background:#7e22ce;color:#fff;font-weight:700;text-align:right;white-space:nowrap}
thead th.num{text-align:left;direction:ltr}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:last-child{border-bottom:none}
tbody tr:nth-child(even){background:#fcfaff}
tbody td{padding:8px 12px;color:#334155;text-align:right;vertical-align:middle}
td.num{font-weight:700;color:#0f172a;text-align:left;direction:ltr;white-space:nowrap}
.tbl-foot td{background:#faf5ff;font-weight:900;font-size:11px;color:#4c1d95;border-top:2px solid #ddd6fe;padding:9px 12px}
.tbl-foot td.num{color:#7e22ce!important}

/* Footer */
.footer{border-top:1px solid #e2e8f0;padding:12px 5px;display:flex;justify-content:space-between;align-items:center;margin-top:20px;font-size:9.5px;color:#64748b}

@media print{
  *{color:#000!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{padding:0}
  .page{width:100%;height:100%}
}
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-logo">${logoHtml}</div>
    <div class="hdr-info">
      <div class="hdr-shop">${shopName}</div>
      <div class="hdr-sub">تقرير الفواتير الدائنة (المرتجعات) ${shopAddress ? ' &nbsp;·&nbsp; ' + shopAddress : ''}</div>
    </div>
    <div class="hdr-right">
      <div class="hdr-badge">📅 الفترة: ${period}</div>
      <div class="hdr-ts">🖨️ طُبع في: ${printDate} ${printTime}</div>
    </div>
  </div>

  <!-- Info Bar -->
  <div class="info-bar">
    <span>${branding.vatNumber ? 'الرقم الضريبي: ' + branding.vatNumber : ''}</span>
    <span>${branding.commercialRegister ? 'السجل التجاري: ' + branding.commercialRegister : ''}</span>
    <span>عدد الإشعارات: ${creditNotes.length}</span>
  </div>

  <!-- KPI Cards -->
  <div class="kpi-grid">
    <div class="kpi-card purple">
      <span class="kpi-label">عدد الفواتير الدائنة</span>
      <span class="kpi-val purple-text">${creditNotes.length}</span>
    </div>
    <div class="kpi-card green">
      <span class="kpi-label">إجمالي المرتجعات (قبل الضريبة)</span>
      <span class="kpi-val green-text"><span class="sar">&#xE900;</span> ${totalSubtotal.toFixed(2)}</span>
    </div>
    <div class="kpi-card purple">
      <span class="kpi-label">إجمالي الضريبة (15%)</span>
      <span class="kpi-val purple-text"><span class="sar">&#xE900;</span> ${totalVat.toFixed(2)}</span>
    </div>
    <div class="kpi-card green">
      <span class="kpi-label">الإجمالي شامل الضريبة</span>
      <span class="kpi-val green-text"><span class="sar">&#xE900;</span> ${totalAmount.toFixed(2)}</span>
    </div>
  </div>

  <!-- Details Section -->
  <div class="sec">
    <div class="sec-hdr">
      <span>تفاصيل الفواتير الدائنة (المرتجعات)</span>
      <span class="sec-badge">${creditNotes.length} سجل</span>
    </div>
    <div class="sec-body">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>رقم الإشعار</th>
            <th>الفاتورة الأصلية</th>
            <th>التاريخ</th>
            <th>العميل</th>
            <th>الهاتف</th>
            <th>بواسطة</th>
            <th class="num">قبل الضريبة</th>
            <th class="num">الضريبة</th>
            <th class="num">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml.length ? tableRowsHtml : `<tr><td colspan="10" class="empty-msg" style="text-align:center;padding:20px;">لا توجد فواتير دائنة في هذه الفترة</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>نظام إدارة المغسلة الذكي</span>
    <span>تصدير تقرير الفواتير الدائنة</span>
  </div>

</div>
</body>
</html>`;

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

async function exportWorkerReport(type, filters = {}) {
  const [data, branding] = await Promise.all([
    db.getWorkerReportData(filters),
    loadAppBrandingForReceipts().catch(() => ({}))
  ]);
  const f = cairoFonts();

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();
    const sheets = reportHtml.buildWorkerReportExcelSheets(data, filters, branding);
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
    return { buffer: Buffer.from(buf), filename: `worker_report_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  if (type === 'pdf') {
    const html = reportHtml.buildPdfHtmlForWorkerReport(data, filters, f.cairoRegularB64, f.cairoBoldB64, f.saudiRiyalB64, branding);
    const buffer = await htmlToPdfBuffer(html, { landscape: false });
    return { buffer, filename: `worker_report_${ts()}.pdf`, mimeType: 'application/pdf' };
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

async function exportZakatReport(type, filters = {}) {
  const data = await db.getZakatReport(filters);
  const branding = await loadAppBrandingForReceipts().catch(() => ({}));
  const f = cairoFonts();

  if (type === 'pdf') {
    const { orders, creditNotes, expenses, summary } = data;
    const { dateFrom = '', dateTo = '',
            showOrders = true, showCreditNotes = true, showExpenses = true } = filters;
    const nameAr      = branding.laundryNameAr || '';
    const nameEn      = branding.laundryNameEn || '';
    const vatNumber   = branding.vatNumber || '';
    const cr          = branding.commercialRegister || '';
    const phone       = branding.phone || '';
    const email       = branding.email || '';
    const locationAr  = branding.locationAr || '';
    const locationEn  = branding.locationEn || '';
    const addNum      = branding.additionalNumber || '';
    const addrParts   = [branding.buildingNumber, branding.streetNameAr, branding.districtAr, branding.cityAr, branding.postalCode].filter(Boolean);
    const addrAr      = addrParts.join('، ');
    const customFields = Array.isArray(branding.customFields) ? branding.customFields : [];
    const logo        = branding.logoDataUrl || '';

    function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function fmt(n) { return Number(n || 0).toFixed(2); }
    function sarCell(n) { return `${fmt(n)} <span class="sar">&#xE900;</span>`; }
    function payLabel(s) { return s === 'paid' ? 'مدفوع' : s === 'pending' ? 'آجل' : s === 'partial' ? 'جزئي' : (s || ''); }
    function fmtDate(d) {
      if (!d) return '';
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        const date = dt.toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'});
        const time = dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
        return `${date} ${time}`;
      } catch(_) { return String(d); }
    }
    function fmtDisplay(d) {
      if (!d) return '';
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        const date = dt.toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'});
        const time = dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
        return `${date} ${time}`;
      } catch(_) { return String(d); }
    }

    const ordersRows = orders.map(o => `<tr>
      <td>${esc(o.invoice_seq || o.order_number || '')}</td>
      <td dir="ltr">${esc(fmtDate(o.created_at))}</td>
      <td dir="ltr">${esc(o.customer_phone || '')}</td>
      <td class="num">${sarCell(o.subtotal)}</td>
      <td class="num tax">${sarCell(o.vat_amount)}</td>
      <td class="num">${sarCell(o.total_amount)}</td>
      <td>${esc(payLabel(o.payment_status))}</td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty">لا توجد فواتير</td></tr>`;

    const cnRows = creditNotes.map(cn => `<tr>
      <td>${esc(cn.credit_note_seq ? String(cn.credit_note_seq) : cn.credit_note_number)}</td>
      <td dir="ltr">${esc(fmtDate(cn.created_at))}</td>
      <td dir="ltr">${esc(cn.customer_phone || '')}</td>
      <td class="num">${sarCell(cn.subtotal)}</td>
      <td class="num tax">${sarCell(cn.vat_amount)}</td>
      <td class="num">${sarCell(cn.total_amount)}</td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty">لا توجد إشعارات دائنة</td></tr>`;

    const expRows = expenses.map(e => `<tr>
      <td dir="ltr">${esc(fmtDate(e.expense_date))}</td>
      <td>${esc(e.title)}</td>
      <td>${esc(e.category)}</td>
      <td class="num">${sarCell(e.amount)}</td>
      <td class="num tax">${sarCell(e.tax_amount)}</td>
      <td class="num">${sarCell(e.total_amount)}</td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty">لا توجد مصروفات</td></tr>`;

    const netNeg = summary.netTotal < 0;
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
@font-face{font-family:'Cairo';src:url('data:font/woff2;base64,${f.cairoBoldB64}') format('woff2')}
@font-face{font-family:'SaudiRiyal';src:url('data:font/woff;base64,${f.saudiRiyalB64}') format('woff')}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif;font-size:9pt}
body{direction:rtl;padding:12mm 10mm;color:#000;background:#fff}
.zk-header{display:grid;grid-template-columns:1fr 90px 1fr;gap:3mm;align-items:center;margin-bottom:4mm;padding-bottom:3mm;border-bottom:2px solid #059669}
.zk-header-ar{text-align:right;direction:rtl}
.zk-header-en{text-align:left;direction:ltr}
.zk-header-logo{display:flex;justify-content:center;align-items:center}
.zk-header-logo img{max-height:60px;max-width:80px;object-fit:contain}
.zk-brand-name{font-size:11pt;font-weight:900;margin-bottom:1mm}
.zk-brand-sub{font-size:7.5pt;font-weight:700;margin-bottom:.5mm;color:#333}
.zk-title{text-align:center;font-size:12pt;font-weight:900;margin-bottom:2mm}
.zk-period{text-align:center;font-size:8pt;color:#555;margin-bottom:4mm}
.section-title{font-size:10pt;font-weight:700;margin:5mm 0 2mm;border-right:3px solid #059669;padding-right:6px;color:#059669}
table{width:100%;border-collapse:collapse;margin-bottom:4mm}
thead tr{background:#e6f7f1}
th,td{padding:3px 6px;border:1px solid #ccc;text-align:right}
th{font-size:8pt;color:#059669;text-align:center}
td{font-size:8pt}
.num{text-align:center;white-space:nowrap}
.tax{color:#b45309}
.empty{text-align:center;color:#999}
.sar{font-family:'SaudiRiyal';font-size:1em}
.summary-table th{background:#059669;color:#fff}
.summary-table tr.orders-row td{background:#f0fdf4}
.summary-table tr.cn-row td{background:#fff7ed}
.summary-table tr.exp-row td{background:#fefce8}
.summary-table tr.net-row td{background:#1e293b;color:#fff;font-size:10pt}
.summary-table tr.net-row .sar{color:#fff}
.neg{color:#ef4444 !important}
</style>
</head>
<body>
<div class="zk-header">
  <div class="zk-header-ar">
    ${nameAr ? `<div class="zk-brand-name">${esc(nameAr)}</div>` : ''}
    ${locationAr ? `<div class="zk-brand-sub">${esc(locationAr)}</div>` : ''}
    ${addrAr ? `<div class="zk-brand-sub">${esc(addrAr)}${addNum ? ' — ' + esc(addNum) : ''}</div>` : (addNum ? `<div class="zk-brand-sub">${esc(addNum)}</div>` : '')}
    ${phone ? `<div class="zk-brand-sub">جوال: ${esc(phone)}</div>` : ''}
    ${vatNumber ? `<div class="zk-brand-sub">الرقم الضريبي: ${esc(vatNumber)}</div>` : ''}
    ${cr ? `<div class="zk-brand-sub">س.ت: ${esc(cr)}</div>` : ''}
    ${customFields.filter(f => f.labelAr && f.value).map(f => `<div class="zk-brand-sub">${esc(f.labelAr)}: ${esc(f.value)}</div>`).join('')}
  </div>
  <div class="zk-header-logo">
    ${logo ? `<img src="${logo}" alt="logo" />` : ''}
  </div>
  <div class="zk-header-en">
    ${nameEn ? `<div class="zk-brand-name">${esc(nameEn)}</div>` : ''}
    ${locationEn ? `<div class="zk-brand-sub">${esc(locationEn)}</div>` : ''}
    ${email ? `<div class="zk-brand-sub">${esc(email)}</div>` : ''}
    ${vatNumber ? `<div class="zk-brand-sub">VAT No: ${esc(vatNumber)}</div>` : ''}
    ${cr ? `<div class="zk-brand-sub">CR No: ${esc(cr)}</div>` : ''}
    ${customFields.filter(f => f.labelEn && f.value).map(f => `<div class="zk-brand-sub">${esc(f.labelEn)}: ${esc(f.value)}</div>`).join('')}
  </div>
</div>
<div class="zk-title">تقرير هيئة الزكاة والضريبة والجمارك</div>
<div class="zk-period">الفترة من: ${esc(fmtDisplay(dateFrom))} إلى: ${esc(fmtDisplay(dateTo))}</div>

${showOrders ? `
<div class="section-title">الفواتير (${orders.length})</div>
<table>
<thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>جوال العميل</th><th>قبل الضريبة</th><th>الضريبة</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
<tbody>${ordersRows}</tbody>
</table>` : ''}

${showCreditNotes ? `
<div class="section-title">الإشعارات الدائنة (${creditNotes.length})</div>
<table>
<thead><tr><th>رقم الإشعار</th><th>التاريخ</th><th>جوال العميل</th><th>قبل الضريبة</th><th>الضريبة</th><th>الإجمالي</th></tr></thead>
<tbody>${cnRows}</tbody>
</table>` : ''}

${showExpenses ? `
<div class="section-title">المصروفات (${expenses.length})</div>
<table>
<thead><tr><th>التاريخ</th><th>البيان</th><th>الفئة</th><th>قبل الضريبة</th><th>الضريبة</th><th>الإجمالي</th></tr></thead>
<tbody>${expRows}</tbody>
</table>` : ''}

<div class="section-title">الملخص</div>
<table class="summary-table">
<thead><tr><th>البيان</th><th>قبل الضريبة</th><th>الضريبة</th><th>الإجمالي شامل الضريبة</th></tr></thead>
<tbody>
<tr class="orders-row"><td>الفواتير</td><td class="num">${sarCell(summary.ordersSubtotal)}</td><td class="num tax">${sarCell(summary.ordersVat)}</td><td class="num">${sarCell(summary.ordersTotal)}</td></tr>
<tr class="cn-row"><td>الإشعارات الدائنة</td><td class="num">${sarCell(summary.creditNotesSubtotal)}</td><td class="num tax">${sarCell(summary.creditNotesVat)}</td><td class="num">${sarCell(summary.creditNotesTotal)}</td></tr>
<tr class="exp-row"><td>المصروفات</td><td class="num">${sarCell(summary.expensesSubtotal)}</td><td class="num tax">${sarCell(summary.expensesVat)}</td><td class="num">${sarCell(summary.expensesTotal)}</td></tr>
<tr class="net-row"><td>الصافي</td><td class="num ${summary.netSubtotal<0?'neg':''}">${sarCell(summary.netSubtotal)}</td><td class="num tax ${summary.netVat<0?'neg':''}">${sarCell(summary.netVat)}</td><td class="num ${netNeg?'neg':''}">${sarCell(summary.netTotal)}</td></tr>
</tbody>
</table>
</body></html>`;

    const buffer = await htmlToPdfBuffer(html, { landscape: false });
    return { buffer, filename: `zakat-report_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  if (type === 'excel') {
    const { orders, creditNotes, expenses, summary } = data;
    const { dateFrom = '', dateTo = '' } = filters;
    const wb = XLSX.utils.book_new();

    const xNameAr  = branding.laundryNameAr || '';
    const xNameEn  = branding.laundryNameEn || '';
    const xVat     = branding.vatNumber || '';
    const xCr      = branding.commercialRegister || '';
    const xPhone   = branding.phone || '';
    const xEmail   = branding.email || '';
    const xLocAr   = branding.locationAr || '';
    const xLocEn   = branding.locationEn || '';
    const xAddNum  = branding.additionalNumber || '';
    const xAddrParts = [branding.buildingNumber, branding.streetNameAr, branding.districtAr, branding.cityAr, branding.postalCode].filter(Boolean);
    if (xAddNum) xAddrParts.push(xAddNum);
    const xAddr    = xAddrParts.join('، ');
    const xCustom  = Array.isArray(branding.customFields) ? branding.customFields : [];

    function fmtDt(d) {
      if (!d) return '';
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        const y  = dt.getFullYear();
        const mo = String(dt.getMonth() + 1).padStart(2, '0');
        const dy = String(dt.getDate()).padStart(2, '0');
        const h  = String(dt.getHours()).padStart(2, '0');
        const mi = String(dt.getMinutes()).padStart(2, '0');
        return `${y}-${mo}-${dy} ${h}:${mi}`;
      } catch(_) { return String(d); }
    }

    function buildSheetHeader(colCount) {
      const rows = [];
      const merges = [];
      let r = 0;
      const add = (text) => {
        rows.push([text]);
        merges.push({ s: { r, c: 0 }, e: { r, c: colCount - 1 } });
        r++;
      };
      if (xNameAr)  add(xNameAr);
      if (xNameEn)  add(xNameEn);
      if (xLocAr)   add(`الموقع: ${xLocAr}`);
      if (xLocEn)   add(`Location: ${xLocEn}`);
      if (xAddr)    add(`العنوان: ${xAddr}`);
      if (xPhone)   add(`جوال: ${xPhone}`);
      if (xEmail)   add(`Email: ${xEmail}`);
      if (xVat)     add(`الرقم الضريبي: ${xVat}`);
      if (xCr)      add(`السجل التجاري: ${xCr}`);
      xCustom.filter(f => f.value).forEach(f => add(`${f.labelAr || f.labelEn || ''}: ${f.value}`));
      add('تقرير هيئة الزكاة والضريبة والجمارك');
      if (dateFrom || dateTo) add(`الفترة من: ${fmtDt(dateFrom)} إلى: ${fmtDt(dateTo)}`);
      rows.push([]); r++;
      return { rows, merges, startRow: r };
    }


    // Orders sheet
    const oHdr = buildSheetHeader(7);
    const oData = [
      ['رقم الفاتورة', 'التاريخ', 'جوال العميل', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'الحالة'],
      ...orders.map(o => [
        o.invoice_seq || o.order_number || '',
        fmtDt(o.created_at),
        o.customer_phone || '',
        Number(o.subtotal), Number(o.vat_amount), Number(o.total_amount),
        o.payment_status === 'paid' ? 'مدفوع' : o.payment_status === 'pending' ? 'آجل' : o.payment_status === 'partial' ? 'جزئي' : (o.payment_status || '')
      ])
    ];
    const oWs = XLSX.utils.aoa_to_sheet([...oHdr.rows, ...oData]);
    oWs['!merges'] = oHdr.merges;
    XLSX.utils.book_append_sheet(wb, oWs, 'الفواتير');

    // Credit Notes sheet
    const cnHdr = buildSheetHeader(6);
    const cnData = [
      ['رقم الإشعار', 'التاريخ', 'جوال العميل', 'قبل الضريبة', 'الضريبة', 'الإجمالي'],
      ...creditNotes.map(cn => [
        cn.credit_note_seq ? String(cn.credit_note_seq) : cn.credit_note_number,
        fmtDt(cn.created_at),
        cn.customer_phone || '',
        Number(cn.subtotal), Number(cn.vat_amount), Number(cn.total_amount)
      ])
    ];
    const cnWs = XLSX.utils.aoa_to_sheet([...cnHdr.rows, ...cnData]);
    cnWs['!merges'] = cnHdr.merges;
    XLSX.utils.book_append_sheet(wb, cnWs, 'الإشعارات الدائنة');

    // Expenses sheet
    const expHdr = buildSheetHeader(6);
    const expData = [
      ['التاريخ', 'البيان', 'الفئة', 'قبل الضريبة', 'الضريبة', 'الإجمالي'],
      ...expenses.map(e => [
        fmtDt(e.expense_date),
        e.title || '', e.category || '',
        Number(e.amount), Number(e.tax_amount), Number(e.total_amount)
      ])
    ];
    const expWs = XLSX.utils.aoa_to_sheet([...expHdr.rows, ...expData]);
    expWs['!merges'] = expHdr.merges;
    XLSX.utils.book_append_sheet(wb, expWs, 'المصروفات');

    // Summary sheet
    const sumHdr = buildSheetHeader(4);
    const sumData = [
      ['البيان', 'قبل الضريبة', 'الضريبة', 'الإجمالي شامل الضريبة'],
      ['الفواتير', summary.ordersSubtotal, summary.ordersVat, summary.ordersTotal],
      ['الإشعارات الدائنة', summary.creditNotesSubtotal, summary.creditNotesVat, summary.creditNotesTotal],
      ['المصروفات', summary.expensesSubtotal, summary.expensesVat, summary.expensesTotal],
      ['الصافي', summary.netSubtotal, summary.netVat, summary.netTotal]
    ];
    const sumWs = XLSX.utils.aoa_to_sheet([...sumHdr.rows, ...sumData]);
    sumWs['!merges'] = sumHdr.merges;
    XLSX.utils.book_append_sheet(wb, sumWs, 'الملخص');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `zakat-report_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  throw new Error('نوع التصدير غير مدعوم');
}

async function exportCustomerAccountReport(body) {
  const { type, customerInfo = {}, dateFrom, dateTo, reportData = {} } = body || {};
  const { movements = [], summary = {}, subscriptionPeriods = [] } = reportData;

  const f = cairoFonts();
  const zlib = require('zlib');

  const pad    = x => String(x).padStart(2, '0');
  const fmt    = n => Number(n || 0).toFixed(2);
  const esc    = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const fmtDT  = dt => {
    if (!dt) return '—';
    try { const d = new Date(dt); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; } catch { return String(dt); }
  };
  const fmtDate = dt => {
    if (!dt) return '—';
    try { const d = new Date(dt); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; } catch { return String(dt); }
  };
  const sarCell = n => `${fmt(n)}&nbsp;<span style="font-family:SaudiRiyal">&#xE900;</span>`;
  const typeLabels = {
    paid_invoice:'فاتورة مدفوعة', deferred_invoice:'فاتورة آجلة', deferred_payment:'سداد آجل',
    subscription:'اشتراك', consumption:'إيصال استهلاك', consumption_refund:'مرتجع إيصال', credit_note:'فاتورة دائنة',
  };
  const custTypeLabels = { individual:'فرد', company:'شركة', hotel:'فندق' };

  let branding = {};
  try { branding = await loadAppBrandingForReceipts(); } catch { /* ignore */ }

  const laundryNameAr = branding.laundryNameAr || '';
  const vatNumber     = branding.vatNumber || '';
  const now    = new Date();
  const nowStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let logoHtml = '';
  if (branding.logoGzipBuffer) {
    try {
      const buf = Buffer.isBuffer(branding.logoGzipBuffer) ? branding.logoGzipBuffer : Buffer.from(branding.logoGzipBuffer);
      const raw = await new Promise((res, rej) => zlib.gunzip(buf, (e, r) => e ? rej(e) : res(r)));
      logoHtml = `<img src="data:image/png;base64,${raw.toString('base64')}" style="height:56px;object-fit:contain;display:block">`;
    } catch { /* no logo */ }
  }

  if (type === 'pdf') {
    let running = Number(summary.priorBalance || 0);
    let totalD = 0, totalC = 0;
    const rows = movements.map(m => {
      const d = Number(m.debit  || 0);
      const c = Number(m.credit || 0);
      running = Math.round((running + d - c) * 100) / 100;
      totalD += d; totalC += c;
      const balClr = running > 0 ? '#dc2626' : '#059669';
      const paidCell     = m.paid_at       ? `<span style="color:#059669;font-weight:700" title="${esc(fmtDT(m.paid_at))}">✓</span>`      : '<span style="color:#cbd5e1">—</span>';
      const cleaningCell = m.cleaning_date ? `<span style="color:#059669;font-weight:700" title="${esc(fmtDT(m.cleaning_date))}">✓</span>` : '<span style="color:#cbd5e1">—</span>';
      const deliveryCell = m.delivery_date ? `<span style="color:#059669;font-weight:700" title="${esc(fmtDT(m.delivery_date))}">✓</span>` : '<span style="color:#cbd5e1">—</span>';
      return `<tr>
        <td style="white-space:nowrap;font-size:7.5px">${esc(fmtDT(m.mv_date))}</td>
        <td>${esc(typeLabels[m.mv_type] || m.mv_type)}</td>
        <td>${esc(m.description || '')}</td>
        <td style="direction:ltr;text-align:left">${d > 0 ? sarCell(d) : '—'}</td>
        <td style="direction:ltr;text-align:left">${c > 0 ? sarCell(c) : '—'}</td>
        <td style="direction:ltr;text-align:left;color:${balClr};font-weight:600">${sarCell(running)}</td>
        <td style="text-align:center">${paidCell}</td>
        <td style="text-align:center">${cleaningCell}</td>
        <td style="text-align:center">${deliveryCell}</td>
      </tr>`;
    }).join('');
    totalD = Math.round(totalD * 100) / 100;
    totalC = Math.round(totalC * 100) / 100;
    const footerClr = running > 0 ? '#dc2626' : '#059669';
    const footerRow = `<tr style="background:#f1f5f9;font-weight:700">
        <td colspan="3" style="text-align:left">الإجمالي</td>
        <td style="direction:ltr;text-align:left">${sarCell(totalD)}</td>
        <td style="direction:ltr;text-align:left">${sarCell(totalC)}</td>
        <td style="direction:ltr;text-align:left;color:${footerClr}">${sarCell(running)}</td>
        <td colspan="3"></td>
      </tr>`;

    const subRows = subscriptionPeriods.map(sp => {
      const clr = sp.status === 'active' ? '#059669' : '#94a3b8';
      return `<tr>
        <td style="color:${clr};font-weight:600">${sp.status === 'active' ? 'نشط' : 'منتهٍ'}</td>
        <td>${fmtDate(sp.period_from)}</td>
        <td>${sp.period_to ? fmtDate(sp.period_to) : '—'}</td>
        <td style="direction:ltr;text-align:left">${sarCell(sp.total_value)}</td>
        <td style="direction:ltr;text-align:left">${sarCell(sp.total_consumed)}</td>
        <td style="direction:ltr;text-align:left">${sarCell(sp.credit_remaining)}</td>
      </tr>`;
    }).join('');

    const closingClr = Number(summary.closingBalance || 0) > 0 ? '#dc2626' : '#059669';

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8">
<style>
@font-face{font-family:Cairo;src:url('data:font/woff2;base64,${f.cairoBoldB64}') format('woff2');font-weight:700}
@font-face{font-family:Cairo;src:url('data:font/woff2;base64,${f.cairoRegularB64}') format('woff2');font-weight:400}
@font-face{font-family:SaudiRiyal;src:url('data:font/woff;base64,${f.saudiRiyalB64}') format('woff')}
*{font-family:Cairo,sans-serif;box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:12mm}
body{font-size:9px;color:#1e293b;background:#fff}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f97316;padding-bottom:8px;margin-bottom:10px}
.rpt-title{font-size:13px;font-weight:700;color:#f97316;text-align:center}
.co-name{font-size:12px;font-weight:700} .co-meta{font-size:8px;color:#64748b;margin-top:2px}
.cust-bar{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px 10px;margin-bottom:8px;display:flex;gap:16px;flex-wrap:wrap}
.cust-bar span{color:#64748b} .cust-bar strong{color:#1e293b}
.sg{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:10px}
.sc{border:1px solid #e2e8f0;border-radius:3px;padding:5px 6px;text-align:center}
.sc .lbl{font-size:7.5px;color:#64748b;margin-bottom:2px}
.sc .val{font-size:9px;font-weight:700}
.sc.p1{border-right:3px solid #6366f1}.sc.p2{border-right:3px solid #ef4444}
.sc.p3{border-right:3px solid #10b981}.sc.p4{border-right:3px solid #f59e0b}
.sc.p5{border-right:3px solid ${closingClr}}
h3{font-size:9px;font-weight:700;margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid #e2e8f0}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#f1f5f9;padding:4px 5px;text-align:right;font-weight:700;border:1px solid #e2e8f0;font-size:8px}
td{padding:3px 5px;border:1px solid #f1f5f9;font-size:8px;vertical-align:top}
tr:nth-child(even) td{background:#fafbfc}
thead{display:table-header-group}
.ft{font-size:7.5px;color:#94a3b8;text-align:center;margin-top:6px;border-top:1px solid #e2e8f0;padding-top:5px}
</style></head>
<body>
<div class="hdr">
  <div>${logoHtml}</div>
  <div style="text-align:center">
    <div class="rpt-title">كشف حساب العميل</div>
    <div style="font-size:8px;color:#64748b;margin-top:3px">الفترة: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}</div>
  </div>
  <div style="text-align:left">
    <div class="co-name">${esc(laundryNameAr)}</div>
    ${vatNumber ? `<div class="co-meta">الرقم الضريبي: ${esc(vatNumber)}</div>` : ''}
    <div class="co-meta">تاريخ الإنشاء: ${nowStr}</div>
  </div>
</div>
<div class="cust-bar">
  <div><span>العميل: </span><strong>${esc(customerInfo.customer_name || '')}</strong></div>
  ${customerInfo.phone ? `<div><span>الجوال: </span><strong dir="ltr">${esc(customerInfo.phone)}</strong></div>` : ''}
  ${customerInfo.tax_number ? `<div><span>الرقم الضريبي: </span><strong>${esc(customerInfo.tax_number)}</strong></div>` : ''}
  <div><span>النوع: </span><strong>${esc(custTypeLabels[customerInfo.customer_type] || 'فرد')}</strong></div>
</div>
<div class="sg">
  <div class="sc p1"><div class="lbl">الرصيد السابق</div><div class="val">${sarCell(summary.priorBalance)}</div></div>
  <div class="sc p2"><div class="lbl">إجمالي المدين</div><div class="val">${sarCell(summary.totalDebit)}</div></div>
  <div class="sc p3"><div class="lbl">إجمالي الدائن</div><div class="val">${sarCell(summary.totalCredit)}</div></div>
  <div class="sc p4"><div class="lbl">المديونية الآجلة</div><div class="val">${sarCell(summary.deferredOutstanding)}</div></div>
  <div class="sc p5"><div class="lbl">الرصيد الختامي</div><div class="val" style="color:${closingClr}">${sarCell(summary.closingBalance)}</div></div>
</div>
${subscriptionPeriods.length ? `
<h3>ملخص الاشتراك</h3>
<table>
<thead><tr><th>الحالة</th><th>تاريخ البدء</th><th>تاريخ الانتهاء</th><th>القيمة</th><th>الاستهلاك</th><th>المتبقي</th></tr></thead>
<tbody>${subRows}</tbody>
</table>` : ''}
<h3>الحركات التفصيلية (${movements.length} حركة)</h3>
<table>
<thead><tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th><th>تم الدفع</th><th>التنظيف</th><th>التسليم</th></tr></thead>
<tbody>${rows}${footerRow}</tbody>
</table>
<div class="ft">PLUS Laundry System — كشف حساب العميل — ${nowStr}</div>
</body></html>`;

    const buffer = await htmlToPdfBuffer(html, { landscape: false });
    return { buffer, filename: `كشف-حساب_${ts()}.pdf`, mimeType: 'application/pdf' };
  }

  if (type === 'excel') {
    const wb = XLSX.utils.book_new();

    let running = Number(summary.priorBalance || 0);
    let totalD = 0, totalC = 0;
    const mvRows = movements.map(m => {
      const d = Number(m.debit  || 0);
      const c = Number(m.credit || 0);
      running = Math.round((running + d - c) * 100) / 100;
      totalD += d; totalC += c;
      return [
        fmtDT(m.mv_date),
        typeLabels[m.mv_type] || m.mv_type,
        m.description || '',
        d || '',
        c || '',
        running,
        m.paid_at       ? '✓' : '—',
        m.cleaning_date ? '✓' : '—',
        m.delivery_date ? '✓' : '—',
      ];
    });
    totalD = Math.round(totalD * 100) / 100;
    totalC = Math.round(totalC * 100) / 100;

    const custTypeLabelsEx = { individual:'فرد', company:'شركة', hotel:'فندق' };
    const mvInfo = [
      [`كشف حساب العميل: ${customerInfo.customer_name || ''}`],
      [`الجوال: ${customerInfo.phone || '—'}`],
      ...(customerInfo.tax_number ? [[`الرقم الضريبي: ${customerInfo.tax_number}`]] : []),
      [`نوع العميل: ${custTypeLabelsEx[customerInfo.customer_type] || 'فرد'}`],
      [`الفترة: ${fmtDT(dateFrom)} — ${fmtDT(dateTo)}`],
      [],
      [`الرصيد السابق: ${fmt(summary.priorBalance)}`, '', `إجمالي المدين: ${fmt(summary.totalDebit)}`, '', `إجمالي الدائن: ${fmt(summary.totalCredit)}`],
      [`المديونية الآجلة الحالية: ${fmt(summary.deferredOutstanding)}`, '', `الرصيد الختامي: ${fmt(summary.closingBalance)}`],
      [],
      ['التاريخ والوقت','نوع الحركة','الوصف','المدين','الدائن','الرصيد التراكمي','تم الدفع','التنظيف','التسليم'],
      ...mvRows,
      ['الإجمالي', '', '', totalD, totalC, running, '', '', ''],
    ];
    const mvWs = XLSX.utils.aoa_to_sheet(mvInfo);
    mvWs['!cols'] = [{wch:18},{wch:16},{wch:34},{wch:12},{wch:12},{wch:14},{wch:10},{wch:10},{wch:10}];
    if (!mvWs['!sheetViews']) mvWs['!sheetViews'] = [{}];
    mvWs['!sheetViews'][0].rightToLeft = true;
    XLSX.utils.book_append_sheet(wb, mvWs, 'كشف الحساب');

    if (subscriptionPeriods.length) {
      const spWs = XLSX.utils.aoa_to_sheet([
        ['الحالة','تاريخ البدء','تاريخ الانتهاء','القيمة الإجمالية','الاستهلاك','الرصيد المتبقي'],
        ...subscriptionPeriods.map(sp => [
          sp.status === 'active' ? 'نشط' : 'منتهٍ',
          fmtDate(sp.period_from),
          sp.period_to ? fmtDate(sp.period_to) : '—',
          Number(sp.total_value    || 0),
          Number(sp.total_consumed || 0),
          Number(sp.credit_remaining || 0),
        ]),
      ]);
      spWs['!cols'] = [{wch:10},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14}];
      if (!spWs['!sheetViews']) spWs['!sheetViews'] = [{}];
      spWs['!sheetViews'][0].rightToLeft = true;
      XLSX.utils.book_append_sheet(wb, spWs, 'ملخص الاشتراك');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buf), filename: `كشف-حساب_${ts()}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
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
  exportWorkerReport,
  exportAllInvoicesReport,
  exportSubscriptionsReport,
  exportTypesReport,
  exportZakatReport,
  exportCustomerAccountReport,
  MAX_PRODUCT_IMAGE_RAW_BYTES,
  cairoFonts
};
