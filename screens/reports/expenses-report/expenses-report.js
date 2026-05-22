window.addEventListener('DOMContentLoaded', () => {
  const btnBack          = document.getElementById('btnBack');
  const btnExcelExport   = document.getElementById('btnExcelExport');
  const btnPdfExport     = document.getElementById('btnPdfExport');
  const btnApplyFilter   = document.getElementById('btnApplyFilter');
  const filterDateFrom   = document.getElementById('filterDateFrom');
  const filterDateTo     = document.getElementById('filterDateTo');
  const loadingState     = document.getElementById('loadingState');
  const reportContent    = document.getElementById('reportContent');
  const emptyPrompt      = document.getElementById('emptyPrompt');
  const periodInfoBar    = document.getElementById('periodInfoBar');

  if (window.I18N && typeof window.I18N.apply === 'function') {
    window.I18N.apply();
  }
  if (window.I18N && typeof window.I18N.enableArabicPrint === 'function') {
    window.I18N.enableArabicPrint();
  }

  btnBack.addEventListener('click', () => {
    location.href = '/screens/reports/reports.html';
  });

  document.querySelectorAll('.filter-field input[type="datetime-local"]').forEach(input => {
    input.addEventListener('mousedown', function(e) {
      if (typeof this.showPicker === 'function') {
        e.preventDefault();
        this.showPicker();
      }
    });
  });

  const today = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  filterDateFrom.value = `${todayStr}T00:00`;
  filterDateTo.value = `${todayStr}T23:59`;

  let currentFilters = null;
  let reportData = null;

  function fmt(n) { return Number(n || 0).toFixed(2); }
  function SAR(n, showSymbol = true) { return `${fmt(n)}${showSymbol ? ' <span class="sar">&#xE900;</span>' : ''}`; }
  function fmtD(dateStr) {
    if (!dateStr) return '—';
    const [datePart, timePart] = String(dateStr).split('T');
    const [y, m, d] = datePart.split('-');
    if (timePart) return `${d}/${m}/${y} ${timePart}`;
    return `${d}/${m}/${y}`;
  }
  function fmtDT(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      const dp = (x) => String(x).padStart(2, '0');
      const dy = dp(d.getDate()), mo = dp(d.getMonth() + 1), yr = d.getFullYear();
      const h = d.getHours() % 12 || 12, mi = dp(d.getMinutes());
      const ampm = d.getHours() < 12 ? 'am' : 'pm';
      return `${dy}/${mo}/${yr}, ${dp(h)}:${mi} ${ampm}`;
    } catch { return String(dateStr); }
  }
  function escHtml(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function showToast(msg, type = 'success') {
    const tc = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<div class="toast-text">${msg}</div>`;
    tc.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 350); }, 3000);
  }

  function buildExpensesTable(expenses) {
    if (!expenses || !expenses.length) {
      return `<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px">${I18N.t('expenses-report-no-data')}</td></tr>`;
    }
    return expenses.map((e, i) => {
      const dt = fmtDT(e.expense_date || e.created_at);
      const dtParts = dt.split(', ');
      const dateStr = dtParts[0] || dt;
      const timeStr = dtParts[1] || '';
      return `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${escHtml(e.title) || '—'}</td>
        <td>${escHtml(e.category) || '—'}</td>
        <td class="center">${dateStr}${timeStr ? '<br>' + timeStr : ''}</td>
        <td class="center num-cell">${SAR(e.amount, false)}</td>
        <td class="center">${e.is_taxable ? '<span class="badge yes">' + I18N.t('yes') + '</span>' : '<span class="badge no">' + I18N.t('no') + '</span>'}</td>
        <td class="center num-cell">${SAR(e.tax_amount, false)}</td>
        <td class="center num-cell">${SAR(e.total_amount, false)}</td>
        <td>${escHtml(e.notes) || '—'}</td>
      </tr>`;
    }).join('');
  }

  async function loadReport() {
    const df = filterDateFrom.value;
    const dt = filterDateTo.value;
    if (!df || !dt) { showToast(I18N.t('all-invoices-select-period'), 'error'); return; }
    if (df > dt) { showToast(I18N.t('all-invoices-err-date-range'), 'error'); return; }

    const toApiDt = (s) => {
      if (!s) return s;
      const withSpace = s.replace('T', ' ');
      return withSpace.match(/\d{2}:\d{2}$/) ? withSpace + ':00' : withSpace;
    };

    currentFilters = { dateFrom: toApiDt(df), dateTo: toApiDt(dt) };
    emptyPrompt.style.display = 'none';
    loadingState.style.display = 'flex';
    reportContent.style.display = 'none';

    try {
      const [expRes, sumRes] = await Promise.all([
        window.api.getExpenses(currentFilters),
        window.api.getExpensesSummary(currentFilters)
      ]);

      if (!expRes.success) { showToast(expRes.message || I18N.t('all-invoices-err-load'), 'error'); loadingState.style.display = 'none'; return; }

      const expenses = expRes.expenses || [];
      const summary = sumRes && sumRes.summary ? sumRes.summary : {
        total_before_tax: 0, total_tax: 0, grand_total: 0, count: 0
      };

      reportData = { expenses, summary };

      periodInfoBar.textContent = `${I18N.t('expenses-report-period')}: ${fmtD(df)} — ${fmtD(dt)}`;
      document.getElementById('printMeta').textContent = `${I18N.t('all-invoices-from').replace(':','')} ${fmtD(df)} ${I18N.t('all-invoices-to').replace(':','')} ${fmtD(dt)}`;

      document.getElementById('badgeExpenses').textContent = expenses.length;
      document.getElementById('expensesTableBody').innerHTML = buildExpensesTable(expenses);

      const expTotal = expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0);
      document.getElementById('expensesFooter').innerHTML = `${I18N.t('all-invoices-total-after-tax')}: ${expenses.length} &nbsp;|&nbsp; ${SAR(expTotal)}`;

      document.getElementById('summaryCount').textContent = `${expenses.length} ${I18N.t('expenses-report-records')}`;
      document.getElementById('summaryTotalBefore').innerHTML = `${SAR(summary.total_before_tax)}`;
      document.getElementById('summaryTax').innerHTML = `${SAR(summary.total_tax)}`;
      document.getElementById('summaryGrandTotal').innerHTML = `${SAR(summary.grand_total)}`;

      loadingState.style.display = 'none';
      reportContent.style.display = 'flex';
      reportContent.style.flexDirection = 'column';
      reportContent.style.gap = '16px';
    } catch (err) {
      showToast(I18N.t('all-invoices-err-load'), 'error');
      loadingState.style.display = 'none';
      emptyPrompt.style.display = 'flex';
    }
  }

  btnApplyFilter.addEventListener('click', loadReport);
  filterDateFrom.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadReport(); });
  filterDateTo.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadReport(); });

  btnExcelExport.addEventListener('click', async () => {
    if (!currentFilters) { showToast(I18N.t('period-report-load-first'), 'error'); return; }
    btnExcelExport.disabled = true;
    const r = await window.api.exportExpenses({ type: 'excel', filters: currentFilters });
    btnExcelExport.disabled = false;
    if (!r.success) showToast(r.message || I18N.t('all-invoices-err-export'), 'error');
  });

  btnPdfExport.addEventListener('click', async () => {
    if (!currentFilters) { showToast(I18N.t('period-report-load-first'), 'error'); return; }
    btnPdfExport.disabled = true;
    const r = await window.api.exportExpenses({ type: 'pdf', filters: currentFilters });
    btnPdfExport.disabled = false;
    if (!r.success) showToast(r.message || I18N.t('all-invoices-err-export'), 'error');
  });
});
