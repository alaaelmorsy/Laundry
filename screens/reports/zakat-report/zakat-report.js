window.addEventListener('DOMContentLoaded', () => {
  const btnBack        = document.getElementById('btnBack');
  const btnPdfExport   = document.getElementById('btnPdfExport');
  const btnExcelExport = document.getElementById('btnExcelExport');
  const btnApplyFilter = document.getElementById('btnApplyFilter');
  const filterDateFrom = document.getElementById('filterDateFrom');
  const filterDateTo   = document.getElementById('filterDateTo');
  const loadingState   = document.getElementById('loadingState');
  const reportContent  = document.getElementById('reportContent');
  const emptyPrompt    = document.getElementById('emptyPrompt');
  const periodInfoBar  = document.getElementById('periodInfoBar');
  const printMeta      = document.getElementById('printMeta');

  if (window.I18N && typeof window.I18N.enableArabicPrint === 'function') {
    window.I18N.enableArabicPrint();
  }

  let lastFilters = null;

  btnBack.addEventListener('click', () => { location.href = '/screens/reports/reports.html'; });

  btnPdfExport.addEventListener('click', async () => {
    if (!lastFilters) { showToast('عرض التقرير أولاً'); return; }
    btnPdfExport.disabled = true;
    const orig = btnPdfExport.innerHTML;
    btnPdfExport.innerHTML = '<span class="btn-label">جارٍ التصدير...</span>';
    const sections = {
      showOrders:      document.getElementById('bodyOrders')?.classList.contains('open')      ?? true,
      showCreditNotes: document.getElementById('bodyCreditNotes')?.classList.contains('open') ?? true,
      showExpenses:    document.getElementById('bodyExpenses')?.classList.contains('open')    ?? true,
    };
    const r = await window.api.exportZakatReport({ type: 'pdf', filters: { ...lastFilters, ...sections } });
    btnPdfExport.disabled = false;
    btnPdfExport.innerHTML = orig;
    if (!r.success) showToast('فشل تصدير PDF');
    else showToast('تم تصدير PDF بنجاح', 'success');
  });

  btnExcelExport.addEventListener('click', async () => {
    if (!lastFilters) { showToast('عرض التقرير أولاً'); return; }
    btnExcelExport.disabled = true;
    const orig = btnExcelExport.innerHTML;
    btnExcelExport.innerHTML = '<span class="btn-label">جارٍ التصدير...</span>';
    const r = await window.api.exportZakatReport({ type: 'excel', filters: lastFilters });
    btnExcelExport.disabled = false;
    btnExcelExport.innerHTML = orig;
    if (!r.success) showToast('فشل تصدير Excel');
    else showToast('تم تصدير Excel بنجاح', 'success');
  });

  const today = new Date();
  const pad = x => String(x).padStart(2, '0');
  const todayStr     = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T23:59`;
  const firstOfMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01T00:00`;
  filterDateFrom.value = firstOfMonth;
  filterDateTo.value   = todayStr;

  [filterDateFrom, filterDateTo].forEach(inp => {
    inp.addEventListener('mousedown', function(e) {
      if (typeof this.showPicker === 'function') { e.preventDefault(); this.showPicker(); }
    });
  });

  function fmtLtr(n) { return Number(n || 0).toFixed(2); }
  function sarHtml(v) { return `<span class="sar">&#xE900;</span> ${v}`; }
  function sarFmt(n)  { return sarHtml(fmtLtr(n)); }
  function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function formatDate(d) {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      const date = dt.toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' });
      const time = dt.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12: false });
      return `${date} ${time}`;
    } catch(_) { return String(d); }
  }

  function paymentLabel(s) {
    const map = { paid: 'مدفوع', pending: 'آجل', partial: 'جزئي' };
    return map[s] || s || '';
  }

  function showToast(msg, type = 'error') {
    const tc = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-text">${escHtml(msg)}</span>`;
    tc.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 350); }, 3200);
  }

  function setupCollapsible(toggleId, bodyId) {
    const toggle = document.getElementById(toggleId);
    const body   = document.getElementById(bodyId);
    if (!toggle || !body) return;
    const arrow = toggle.querySelector('.toggle-arrow');
    toggle.addEventListener('click', () => {
      const open = body.classList.toggle('open');
      if (arrow) arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  }

  setupCollapsible('toggleOrders',      'bodyOrders');
  setupCollapsible('toggleCreditNotes', 'bodyCreditNotes');
  setupCollapsible('toggleExpenses',    'bodyExpenses');

  btnApplyFilter.addEventListener('click', loadReport);

  async function loadReport() {
    const dateFrom = filterDateFrom.value;
    const dateTo   = filterDateTo.value;

    lastFilters = { dateFrom, dateTo };
    if (!dateFrom || !dateTo) {
      showToast('يرجى تحديد تاريخ البداية والنهاية');
      return;
    }
    if (dateTo < dateFrom) {
      showToast('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }

    emptyPrompt.style.display   = 'none';
    reportContent.style.display = 'none';
    loadingState.style.display  = 'flex';

    try {
      const res = await window.api.getZakatReport({ dateFrom, dateTo });
      loadingState.style.display = 'none';

      if (!res.success) {
        showToast(res.message || 'حدث خطأ أثناء تحميل التقرير');
        emptyPrompt.style.display = 'flex';
        return;
      }

      renderReport(res, dateFrom, dateTo);
      reportContent.style.display = 'block';

      ['bodyOrders','bodyCreditNotes','bodyExpenses'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.classList.add('open');
      });
      document.querySelectorAll('.toggle-arrow').forEach(a => { a.style.transform = 'rotate(0deg)'; });

    } catch(e) {
      loadingState.style.display = 'none';
      emptyPrompt.style.display  = 'flex';
      showToast('حدث خطأ في الاتصال بالخادم');
    }
  }

  function renderReport(data, dateFrom, dateTo) {
    const { orders, creditNotes, expenses, summary } = data;

    periodInfoBar.innerHTML = `الفترة من: <span dir="ltr">${escHtml(formatDate(dateFrom))}</span>  إلى: <span dir="ltr">${escHtml(formatDate(dateTo))}</span>`;
    printMeta.innerHTML    = `من: <span dir="ltr">${escHtml(formatDate(dateFrom))}</span>  إلى: <span dir="ltr">${escHtml(formatDate(dateTo))}</span>`;

    document.getElementById('badgeOrders').textContent      = orders.length;
    document.getElementById('badgeCreditNotes').textContent = creditNotes.length;
    document.getElementById('badgeExpenses').textContent    = expenses.length;

    // Orders table
    const obody = document.getElementById('ordersTableBody');
    if (orders.length === 0) {
      obody.innerHTML = `<tr><td colspan="7" class="empty-row">لا توجد فواتير في هذه الفترة</td></tr>`;
    } else {
      obody.innerHTML = orders.map(o => `
        <tr>
          <td class="num-cell" dir="ltr">${escHtml(String(o.invoice_seq || o.order_number || ''))}</td>
          <td dir="ltr">${escHtml(formatDate(o.created_at))}</td>
          <td dir="ltr">${escHtml(o.customer_phone || '')}</td>
          <td class="num-cell" dir="ltr">${sarFmt(o.subtotal)}</td>
          <td class="tax-cell" dir="ltr">${sarFmt(o.vat_amount)}</td>
          <td class="num-cell" dir="ltr">${sarFmt(o.total_amount)}</td>
          <td><span class="status-badge status-${escHtml(o.payment_status)}">${escHtml(paymentLabel(o.payment_status))}</span></td>
        </tr>`).join('');
    }

    // Credit Notes table
    const cnbody = document.getElementById('creditNotesTableBody');
    if (creditNotes.length === 0) {
      cnbody.innerHTML = `<tr><td colspan="6" class="empty-row">لا توجد إشعارات دائنة في هذه الفترة</td></tr>`;
    } else {
      cnbody.innerHTML = creditNotes.map(cn => `
        <tr>
          <td class="num-cell" dir="ltr">${escHtml(cn.credit_note_seq ? String(cn.credit_note_seq) : cn.credit_note_number)}</td>
          <td dir="ltr">${escHtml(formatDate(cn.created_at))}</td>
          <td dir="ltr">${escHtml(cn.customer_phone || '')}</td>
          <td class="num-cell" dir="ltr">${sarFmt(cn.subtotal)}</td>
          <td class="tax-cell" dir="ltr">${sarFmt(cn.vat_amount)}</td>
          <td class="num-cell" dir="ltr">${sarFmt(cn.total_amount)}</td>
        </tr>`).join('');
    }

    // Expenses table
    const expbody = document.getElementById('expensesTableBody');
    if (expenses.length === 0) {
      expbody.innerHTML = `<tr><td colspan="6" class="empty-row">لا توجد مصروفات في هذه الفترة</td></tr>`;
    } else {
      expbody.innerHTML = expenses.map(e => `
        <tr>
          <td dir="ltr">${escHtml(formatDate(e.expense_date))}</td>
          <td>${escHtml(e.title)}</td>
          <td>${escHtml(e.category)}</td>
          <td class="num-cell" dir="ltr">${sarFmt(e.amount)}</td>
          <td class="tax-cell" dir="ltr">${sarFmt(e.tax_amount)}</td>
          <td class="num-cell" dir="ltr">${sarFmt(e.total_amount)}</td>
        </tr>`).join('');
    }

    // Summary table
    const sbody = document.getElementById('summaryTableBody');
    const netNeg = summary.netTotal < 0;
    sbody.innerHTML = `
      <tr>
        <td>الفواتير</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.ordersSubtotal)}</td>
        <td class="tax-cell" dir="ltr">${sarFmt(summary.ordersVat)}</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.ordersTotal)}</td>
      </tr>
      <tr>
        <td>الإشعارات الدائنة</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.creditNotesSubtotal)}</td>
        <td class="tax-cell" dir="ltr">${sarFmt(summary.creditNotesVat)}</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.creditNotesTotal)}</td>
      </tr>
      <tr>
        <td>المصروفات</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.expensesSubtotal)}</td>
        <td class="tax-cell" dir="ltr">${sarFmt(summary.expensesVat)}</td>
        <td class="num-cell" dir="ltr">${sarFmt(summary.expensesTotal)}</td>
      </tr>
      <tr class="row-net">
        <td>الصافي</td>
        <td class="num-cell ${summary.netSubtotal < 0 ? 'neg-cell' : ''}" dir="ltr">${sarFmt(summary.netSubtotal)}</td>
        <td class="tax-cell ${summary.netVat < 0 ? 'neg-cell' : ''}" dir="ltr">${sarFmt(summary.netVat)}</td>
        <td class="num-cell ${netNeg ? 'neg-cell' : ''}" dir="ltr">${sarFmt(summary.netTotal)}</td>
      </tr>`;
  }
});
