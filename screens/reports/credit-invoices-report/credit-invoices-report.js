window.addEventListener('DOMContentLoaded', () => {
  const btnBack               = document.getElementById('btnBack');
  const btnExcelExport        = document.getElementById('btnExcelExport');
  const btnPdfExport          = document.getElementById('btnPdfExport');
  const btnApplyFilter        = document.getElementById('btnApplyFilter');
  const filterDateFrom        = document.getElementById('filterDateFrom');
  const filterDateTo          = document.getElementById('filterDateTo');
  const loadingState          = document.getElementById('loadingState');
  const reportContent         = document.getElementById('reportContent');
  const emptyPrompt           = document.getElementById('emptyPrompt');
  const periodInfoBar         = document.getElementById('periodInfoBar');

  if (window.I18N && typeof window.I18N.apply === 'function') {
    window.I18N.apply();
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

  // Default to today from 00:00 to 23:59
  const today = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  filterDateFrom.value = `${todayStr}T00:00`;
  filterDateTo.value = `${todayStr}T23:59`;

  let currentFilters = null;

  function fmt(n) { return Number(n || 0).toFixed(2); }
  
  function SAR(n, showSymbol = true) {
    return `${fmt(n)}${showSymbol ? ' <span class="sar">&#xE900;</span>' : ''}`;
  }

  function fmtD(dateStr) {
    if (!dateStr) return '—';
    const [datePart] = String(dateStr).split('T');
    const [y, m, d] = datePart.split('-');
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
    } catch {
      return String(dateStr);
    }
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showToast(msg, type = 'success') {
    const tc = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<div class="toast-text">${msg}</div>`;
    tc.appendChild(t);
    setTimeout(() => {
      t.classList.add('toast-hide');
      setTimeout(() => t.remove(), 350);
    }, 3000);
  }

  function buildCreditInvoicesTable(creditNotes) {
    if (!creditNotes || !creditNotes.length) {
      return `<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:20px">${I18N.t('credit-invoices-report-no-data')}</td></tr>`;
    }
    return creditNotes.map((cn, i) => {
      const dt = fmtDT(cn.created_at);
      const dtParts = dt.split(', ');
      const dateStr = dtParts[0] || dt;
      const timeStr = dtParts[1] || '';
      
      const origInvoice = cn.original_invoice_seq ? String(cn.original_invoice_seq) : (cn.original_order_number || '—');
      
      return `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="num-cell" style="direction:ltr; text-align:right;">${escHtml(cn.credit_note_number) || '—'}</td>
        <td class="center num-cell">${escHtml(origInvoice)}</td>
        <td class="center">${dateStr}${timeStr ? '<br>' + timeStr : ''}</td>
        <td>${escHtml(cn.customer_name) || '—'}</td>
        <td class="center num-cell">${escHtml(cn.phone) || '—'}</td>
        <td class="center num-cell">${SAR(cn.subtotal, false)}</td>
        <td class="center num-cell">${SAR(cn.vat_amount, false)}</td>
        <td class="center num-cell">${SAR(cn.total_amount, false)}</td>
        <td>${escHtml(cn.notes) || '—'}</td>
        <td class="center">${escHtml(cn.created_by) || '—'}</td>
      </tr>`;
    }).join('');
  }

  async function loadReport() {
    const df = filterDateFrom.value;
    const dt = filterDateTo.value;
    if (!df || !dt) {
      showToast(I18N.t('all-invoices-select-period'), 'error');
      return;
    }
    if (df > dt) {
      showToast(I18N.t('all-invoices-err-date-range'), 'error');
      return;
    }

    const toDateOnly = (s) => {
      if (!s) return '';
      return s.split('T')[0];
    };

    currentFilters = {
      dateFrom: toDateOnly(df),
      dateTo: toDateOnly(dt)
    };

    emptyPrompt.style.display = 'none';
    loadingState.style.display = 'flex';
    reportContent.style.display = 'none';

    try {
      const res = await window.api.getCreditNotes({
        ...currentFilters,
        page: 1,
        pageSize: 1000000
      });

      if (!res || !res.success) {
        showToast(res?.message || I18N.t('all-invoices-err-load'), 'error');
        loadingState.style.display = 'none';
        emptyPrompt.style.display = 'flex';
        return;
      }

      const creditNotes = res.creditNotes || [];
      
      const summary = creditNotes.reduce((acc, cn) => {
        acc.total_before_tax += Number(cn.subtotal || 0);
        acc.total_tax += Number(cn.vat_amount || 0);
        acc.grand_total += Number(cn.total_amount || 0);
        return acc;
      }, { total_before_tax: 0, total_tax: 0, grand_total: 0 });

      periodInfoBar.textContent = `${I18N.t('credit-invoices-report-period')}: ${fmtD(df)} — ${fmtD(dt)}`;
      
      const printFromLabel = I18N.t('all-invoices-from') ? I18N.t('all-invoices-from').replace(':', '') : 'From';
      const printToLabel = I18N.t('all-invoices-to') ? I18N.t('all-invoices-to').replace(':', '') : 'To';
      document.getElementById('printMeta').textContent = `${printFromLabel} ${fmtD(df)} ${printToLabel} ${fmtD(dt)}`;

      document.getElementById('badgeCreditInvoices').textContent = creditNotes.length;
      document.getElementById('creditInvoicesTableBody').innerHTML = buildCreditInvoicesTable(creditNotes);

      const recordLabel = I18N.t('credit-invoices-report-records') || 'record';
      document.getElementById('summaryCount').textContent = `${creditNotes.length} ${recordLabel}`;
      document.getElementById('summaryTotalBefore').innerHTML = `${SAR(summary.total_before_tax)}`;
      document.getElementById('summaryTax').innerHTML = `${SAR(summary.total_tax)}`;
      document.getElementById('summaryGrandTotal').innerHTML = `${SAR(summary.grand_total)}`;

      const totalAfterTaxLabel = I18N.t('all-invoices-total-after-tax') || 'Total After Tax';
      document.getElementById('creditInvoicesFooter').innerHTML = `${totalAfterTaxLabel}: ${creditNotes.length} &nbsp;|&nbsp; ${SAR(summary.grand_total)}`;

      loadingState.style.display = 'none';
      reportContent.style.display = 'flex';
      reportContent.style.flexDirection = 'column';
      reportContent.style.gap = '16px';
    } catch (err) {
      console.error(err);
      showToast(I18N.t('all-invoices-err-load'), 'error');
      loadingState.style.display = 'none';
      emptyPrompt.style.display = 'flex';
    }
  }

  btnApplyFilter.addEventListener('click', loadReport);
  filterDateFrom.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadReport(); });
  filterDateTo.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadReport(); });

  btnExcelExport.addEventListener('click', async () => {
    if (!currentFilters) {
      showToast(I18N.t('period-report-load-first'), 'error');
      return;
    }
    btnExcelExport.disabled = true;
    try {
      const r = await window.api.exportCreditNotes({ type: 'excel', filters: currentFilters });
      if (!r || !r.success) {
        showToast(r?.message || I18N.t('all-invoices-err-export'), 'error');
      }
    } catch (err) {
      showToast(I18N.t('all-invoices-err-export'), 'error');
    } finally {
      btnExcelExport.disabled = false;
    }
  });

  btnPdfExport.addEventListener('click', async () => {
    if (!currentFilters) {
      showToast(I18N.t('period-report-load-first'), 'error');
      return;
    }
    btnPdfExport.disabled = true;
    try {
      const r = await window.api.exportCreditNotes({ type: 'pdf', filters: currentFilters });
      if (!r || !r.success) {
        showToast(r?.message || I18N.t('all-invoices-err-export'), 'error');
      }
    } catch (err) {
      showToast(I18N.t('all-invoices-err-export'), 'error');
    } finally {
      btnPdfExport.disabled = false;
    }
  });
});
