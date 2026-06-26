window.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const btnPdfExport = document.getElementById('btnPdfExport');
  const btnExcelExport = document.getElementById('btnExcelExport');
  const btnApplyFilter = document.getElementById('btnApplyFilter');
  const filterDateFrom = document.getElementById('filterDateFrom');
  const filterDateTo = document.getElementById('filterDateTo');
  const loadingState = document.getElementById('loadingState');
  const reportContent = document.getElementById('reportContent');
  const emptyPrompt = document.getElementById('emptyPrompt');
  const periodInfoBar = document.getElementById('periodInfoBar');
  const printMeta = document.getElementById('printMeta');

  if (window.I18N && typeof window.I18N.enableArabicPrint === 'function') {
    window.I18N.enableArabicPrint();
  }

  let lastFilters = null;
  let lastReportData = null;

  function rt(key, ar, en) {
    const value = I18N.t(key);
    if (value && value !== key) return value;
    return I18N.getLang() === 'en' ? en : ar;
  }

  function fmtLtr(n) {
    return Number(n || 0).toFixed(2);
  }

  function sarHtml(v) {
    return `<span class="sar">&#xE900;</span> ${v}`;
  }

  function sarFmt(n) {
    return sarHtml(fmtLtr(n));
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(d) {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      const date = dt.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${date} ${time}`;
    } catch (_) {
      return String(d);
    }
  }

  function paymentLabel(status) {
    const map = {
      paid: rt('status-paid', 'مدفوع', 'Paid'),
      pending: rt('status-pending', 'غير مدفوع', 'Unpaid'),
      partial: rt('status-partial', 'مدفوع جزئياً', 'Partially Paid')
    };
    return map[status] || status || '';
  }

  function showToast(msg, type = 'error') {
    const tc = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-text">${escHtml(msg)}</span>`;
    tc.appendChild(t);
    setTimeout(() => {
      t.classList.add('toast-hide');
      setTimeout(() => t.remove(), 350);
    }, 3200);
  }

  function setupCollapsible(toggleId, bodyId) {
    const toggle = document.getElementById(toggleId);
    const body = document.getElementById(bodyId);
    if (!toggle || !body) return;
    const arrow = toggle.querySelector('.toggle-arrow');
    toggle.addEventListener('click', () => {
      const open = body.classList.toggle('open');
      if (arrow) arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  }

  function localizeStaticReportBits() {
    const printTitle = document.querySelector('.print-title');
    if (printTitle) {
      printTitle.textContent = rt('zakat-report-print-title', 'تقرير هيئة الزكاة والضريبة والجمارك', 'Zakat, Tax and Customs Authority Report');
    }
  }

  function renderReport(data, dateFrom, dateTo) {
    const orders = data.orders || [];
    const creditNotes = data.creditNotes || [];
    const expenses = data.expenses || [];
    const summary = data.summary || {};

    periodInfoBar.innerHTML = `${rt('period-report-period', 'الفترة', 'Period')}: <span dir="ltr">${escHtml(formatDate(dateFrom))}</span> - <span dir="ltr">${escHtml(formatDate(dateTo))}</span>`;
    printMeta.innerHTML = `${rt('zakat-report-from', 'من:', 'From:')} <span dir="ltr">${escHtml(formatDate(dateFrom))}</span> ${rt('zakat-report-to', 'إلى:', 'To:')} <span dir="ltr">${escHtml(formatDate(dateTo))}</span>`;

    document.getElementById('badgeOrders').textContent = orders.length;
    document.getElementById('badgeCreditNotes').textContent = creditNotes.length;
    document.getElementById('badgeExpenses').textContent = expenses.length;

    const obody = document.getElementById('ordersTableBody');
    if (!orders.length) {
      obody.innerHTML = `<tr><td colspan="7" class="empty-row">${rt('all-invoices-no-invoices-period', 'لا توجد فواتير في هذه الفترة', 'No invoices in this period')}</td></tr>`;
    } else {
      obody.innerHTML = orders.map((o) => `
        <tr>
          <td class="num-cell" dir="ltr">${escHtml(String(o.invoice_seq || o.order_number || ''))}</td>
          <td dir="ltr">${escHtml(formatDate(o.created_at))}</td>
          <td dir="ltr">${escHtml(o.customer_phone || '')}</td>
          <td class="num-cell" dir="ltr">${sarFmt(o.subtotal)}</td>
          <td class="tax-cell" dir="ltr">${sarFmt(o.vat_amount)}</td>
          <td class="num-cell" dir="ltr">${sarFmt(o.total_amount)}</td>
          <td><span class="status-badge status-${escHtml(o.payment_status)}">${escHtml(paymentLabel(o.payment_status))}</span></td>
        </tr>
      `).join('');
    }

    const cnbody = document.getElementById('creditNotesTableBody');
    if (!creditNotes.length) {
      cnbody.innerHTML = `<tr><td colspan="6" class="empty-row">${rt('zakat-report-no-credit-notes', 'لا توجد إشعارات دائنة في هذه الفترة', 'No credit notes in this period')}</td></tr>`;
    } else {
      cnbody.innerHTML = creditNotes.map((cn) => `
        <tr>
          <td class="num-cell" dir="ltr">${escHtml(cn.credit_note_seq ? String(cn.credit_note_seq) : cn.credit_note_number)}</td>
          <td dir="ltr">${escHtml(formatDate(cn.created_at))}</td>
          <td dir="ltr">${escHtml(cn.customer_phone || '')}</td>
          <td class="num-cell" dir="ltr">${sarFmt(cn.subtotal)}</td>
          <td class="tax-cell" dir="ltr">${sarFmt(cn.vat_amount)}</td>
          <td class="num-cell" dir="ltr">${sarFmt(cn.total_amount)}</td>
        </tr>
      `).join('');
    }

    const expbody = document.getElementById('expensesTableBody');
    if (!expenses.length) {
      expbody.innerHTML = `<tr><td colspan="6" class="empty-row">${rt('zakat-report-no-expenses', 'لا توجد مصروفات في هذه الفترة', 'No expenses in this period')}</td></tr>`;
    } else {
      expbody.innerHTML = expenses.map((e) => `
        <tr>
          <td dir="ltr">${escHtml(formatDate(e.expense_date))}</td>
          <td>${escHtml(e.title)}</td>
          <td>${escHtml(e.category)}</td>
          <td class="num-cell" dir="ltr">${sarFmt(e.amount)}</td>
          <td class="tax-cell" dir="ltr">${sarFmt(e.tax_amount)}</td>
          <td class="num-cell" dir="ltr">${sarFmt(e.total_amount)}</td>
        </tr>
      `).join('');
    }

    const netNeg = Number(summary.netTotal || 0) < 0;
    document.getElementById('summaryTableBody').innerHTML = `
      <tr>
        <td>${rt('zakat-report-orders-section', 'الفواتير', 'Invoices')}</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.ordersSubtotal)}</td>
        <td class="tax-cell" dir="ltr">${sarFmt(summary.ordersVat)}</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.ordersTotal)}</td>
      </tr>
      <tr>
        <td>${rt('zakat-report-cn-section', 'الإشعارات الدائنة', 'Credit Notes')}</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.creditNotesSubtotal)}</td>
        <td class="tax-cell" dir="ltr">${sarFmt(summary.creditNotesVat)}</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.creditNotesTotal)}</td>
      </tr>
      <tr>
        <td>${rt('zakat-report-exp-section', 'المصروفات', 'Expenses')}</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.expensesSubtotal)}</td>
        <td class="tax-cell" dir="ltr">${sarFmt(summary.expensesVat)}</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.expensesTotal)}</td>
      </tr>
      <tr class="row-net">
        <td>${rt('zakat-report-net', 'الصافي', 'Net Total')}</td>
        <td class="num-cell ${Number(summary.netSubtotal || 0) < 0 ? 'neg-cell' : ''}" dir="ltr">${sarFmt(summary.netSubtotal)}</td>
        <td class="tax-cell ${Number(summary.netVat || 0) < 0 ? 'neg-cell' : ''}" dir="ltr">${sarFmt(summary.netVat)}</td>
        <td class="num-cell ${netNeg ? 'neg-cell' : ''}" dir="ltr">${sarFmt(summary.netTotal)}</td>
      </tr>
    `;
  }

  async function loadReport() {
    const dateFrom = filterDateFrom.value;
    const dateTo = filterDateTo.value;

    lastFilters = { dateFrom, dateTo };
    if (!dateFrom || !dateTo) {
      showToast(rt('types-report-err-period', 'يرجى تحديد تاريخ البداية والنهاية', 'Please select start and end dates'));
      return;
    }
    if (dateTo < dateFrom) {
      showToast(rt('all-invoices-err-date-range', 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'Start date must be before end date'));
      return;
    }

    emptyPrompt.style.display = 'none';
    reportContent.style.display = 'none';
    loadingState.style.display = 'flex';

    try {
      const res = await window.api.getZakatReport({ dateFrom, dateTo });
      loadingState.style.display = 'none';

      if (!res.success) {
        showToast(res.message || rt('types-report-err-fetch', 'حدث خطأ أثناء جلب التقرير', 'Error fetching report'));
        emptyPrompt.style.display = 'flex';
        return;
      }

      lastReportData = res;
      renderReport(res, dateFrom, dateTo);
      reportContent.style.display = 'block';

      ['bodyOrders', 'bodyCreditNotes', 'bodyExpenses'].forEach((id) => {
        const body = document.getElementById(id);
        if (body) body.classList.add('open');
      });
      document.querySelectorAll('.toggle-arrow').forEach((arrow) => {
        arrow.style.transform = 'rotate(0deg)';
      });
    } catch (_) {
      loadingState.style.display = 'none';
      emptyPrompt.style.display = 'flex';
      showToast(rt('error-unexpected', 'حدث خطأ غير متوقع', 'Unexpected error'));
    }
  }

  btnBack.addEventListener('click', () => {
    location.href = '/screens/reports/reports.html';
  });

  btnPdfExport.addEventListener('click', async () => {
    if (!lastFilters) {
      showToast(rt('zakat-report-show-first', 'اعرض التقرير أولاً', 'Show the report first'));
      return;
    }

    btnPdfExport.disabled = true;
    const orig = btnPdfExport.innerHTML;
    btnPdfExport.innerHTML = `<span class="btn-label">${rt('exporting', 'جارٍ التصدير...', 'Exporting...')}</span>`;

    const sections = {
      showOrders: document.getElementById('bodyOrders')?.classList.contains('open') ?? true,
      showCreditNotes: document.getElementById('bodyCreditNotes')?.classList.contains('open') ?? true,
      showExpenses: document.getElementById('bodyExpenses')?.classList.contains('open') ?? true
    };

    const result = await window.api.exportZakatReport({ type: 'pdf', filters: { ...lastFilters, ...sections } });
    btnPdfExport.disabled = false;
    btnPdfExport.innerHTML = orig;

    if (!result.success) showToast(rt('zakat-report-export-pdf-failed', 'فشل تصدير PDF', 'Failed to export PDF'));
    else showToast(rt('toast-pdf-success', 'تم التصدير بنجاح', 'Exported successfully'), 'success');
  });

  btnExcelExport.addEventListener('click', async () => {
    if (!lastFilters) {
      showToast(rt('zakat-report-show-first', 'اعرض التقرير أولاً', 'Show the report first'));
      return;
    }

    btnExcelExport.disabled = true;
    const orig = btnExcelExport.innerHTML;
    btnExcelExport.innerHTML = `<span class="btn-label">${rt('exporting', 'جارٍ التصدير...', 'Exporting...')}</span>`;

    const result = await window.api.exportZakatReport({ type: 'excel', filters: lastFilters });
    btnExcelExport.disabled = false;
    btnExcelExport.innerHTML = orig;

    if (!result.success) showToast(rt('zakat-report-export-excel-failed', 'فشل تصدير Excel', 'Failed to export Excel'));
    else showToast(rt('zakat-report-export-excel-success', 'تم تصدير Excel بنجاح', 'Excel exported successfully'), 'success');
  });

  const today = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T23:59`;
  const firstOfMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01T00:00`;
  filterDateFrom.value = firstOfMonth;
  filterDateTo.value = todayStr;

  [filterDateFrom, filterDateTo].forEach((inp) => {
    inp.addEventListener('mousedown', function (e) {
      if (typeof this.showPicker === 'function') {
        e.preventDefault();
        this.showPicker();
      }
    });
  });

  setupCollapsible('toggleOrders', 'bodyOrders');
  setupCollapsible('toggleCreditNotes', 'bodyCreditNotes');
  setupCollapsible('toggleExpenses', 'bodyExpenses');
  btnApplyFilter.addEventListener('click', loadReport);

  window.addEventListener('app-language-changed', () => {
    localizeStaticReportBits();
    if (lastReportData && lastFilters) {
      renderReport(lastReportData, lastFilters.dateFrom, lastFilters.dateTo);
    }
  });

  if (typeof I18N !== 'undefined') I18N.apply();
  localizeStaticReportBits();
});
