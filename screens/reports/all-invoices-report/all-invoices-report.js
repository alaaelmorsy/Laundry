let _viewingOrderId = null;
let _allInvoicesData = [];
let _creditNotesData = [];
let _invPage = 1, _invPageSize = 50, _invTotalPages = 1;
let _cnPage = 1, _cnPageSize = 50, _cnTotalPages = 1;
let reportData = null;

window.addEventListener('DOMContentLoaded', () => {
  const btnBack        = document.getElementById('btnBack');
  const btnPrint       = document.getElementById('btnPrint');
  const btnExcelExport = document.getElementById('btnExcelExport');
  const btnPdfExport   = document.getElementById('btnPdfExport');
  const btnApplyFilter = document.getElementById('btnApplyFilter');
  const filterDateFrom = document.getElementById('filterDateFrom');
  const filterDateTo   = document.getElementById('filterDateTo');
  const loadingState   = document.getElementById('loadingState');
  const reportContent  = document.getElementById('reportContent');
  const emptyPrompt    = document.getElementById('emptyPrompt');
  const periodInfoBar  = document.getElementById('periodInfoBar');

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
  filterDateTo.value   = `${todayStr}T23:59`;

  let currentFilters = null;
  let colSetup       = false;
  let _appSettings   = null;

  function fmt(n)    { return Number(n || 0).toFixed(2); }
  function fmtLtr(n) { return Number(n || 0).toFixed(2); }
  function SAR(n)    { return `${fmt(n)} <span class="sar">&#xE900;</span>`; }
  function sarFmtA(n){ return `<span class="sar">&#xE900;</span> ${fmtLtr(n)}`; }
  function escHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function fmtDT(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      const dPad = (x) => String(x).padStart(2, '0');
      const dy = dPad(d.getDate()), mo = dPad(d.getMonth() + 1), yr = d.getFullYear();
      const h = d.getHours() % 12 || 12, mi = dPad(d.getMinutes());
      const ampm = d.getHours() < 12 ? 'am' : 'pm';
      return `${dy}/${mo}/${yr}, ${dPad(h)}:${mi} ${ampm}`;
    } catch { return String(dateStr); }
  }

  function fmtD(s) {
    if (!s) return '—';
    const [datePart, timePart] = String(s).split('T');
    const [y, m, d] = datePart.split('-');
    if (timePart) return `${d}/${m}/${y} ${timePart}`;
    return `${d}/${m}/${y}`;
  }

  function formatInvoiceDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' }) + ' ' +
             d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
    } catch { return dateStr; }
  }

  function payLabel(pm) {
    const map = { cash: I18N.t('payment-cash'), card: I18N.t('payment-card'), transfer: I18N.t('payment-bank'), subscription: I18N.t('payment-subscription'), mixed: I18N.t('payment-mixed'), credit: I18N.t('payment-credit') };
    return map[pm] || pm || '—';
  }

  function statusBadge(inv) {
    const pm = String(inv.payment_method || '');
    const ps = String(inv.payment_status || '');
    const remaining = Number(inv.remaining_amount || 0);
    if (pm === 'credit' && ps === 'paid' && remaining === 0) return `<span class="status-badge status-paid">${I18N.t('status-paid')}</span>`;
    if (pm === 'credit' && ps === 'partial') return `<span class="status-badge status-partial">${I18N.t('status-partial')}</span>`;
    if (pm === 'credit' || ps === 'pending') return `<span class="status-badge status-pending">${I18N.t('status-pending')}</span>`;
    if (remaining > 0) return `<span class="status-badge status-partial">${I18N.t('status-partial')}</span>`;
    return `<span class="status-badge status-paid">${I18N.t('status-paid')}</span>`;
  }

  function showToast(msg, type = 'success') {
    const tc = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<div class="toast-text">${msg}</div>`;
    tc.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 350); }, 3000);
  }

  const PAY_META = {
    cash:         { label: I18N.t('payment-cash'),   icon:'💵', cls:'pay-cash' },
    card:         { label: I18N.t('payment-card'),    icon:'💳', cls:'pay-card' },
    transfer:     { label: I18N.t('payment-bank'),   icon:'🏦', cls:'pay-transfer' },
    subscription: { label: I18N.t('payment-subscription'),  icon:'🔄', cls:'pay-subscription' },
    mixed:        { label: I18N.t('payment-mixed'),   icon:'🔀', cls:'pay-mixed' },
    credit:       { label: I18N.t('payment-credit'),     icon:'📋', cls:'pay-credit' },
  };

  function buildPaymentMethods(methods) {
    const el = document.getElementById('payMethodsGrid');
    if (!methods || !methods.length) {
      el.innerHTML = `<div class="pay-empty">${I18N.t('all-invoices-no-invoices-period')}</div>`;
      return;
    }
    el.innerHTML = methods.map((m) => {
      const meta = PAY_META[m.method] || { label: m.method, icon:'💰', cls:'pay-cash' };
      return `
        <div class="pay-card-item ${meta.cls}">
          <div class="pay-card-icon">${meta.icon}</div>
          <div class="pay-card-info">
            <div class="pay-card-label">${meta.label}</div>
            <div class="pay-card-count">${m.count} ${I18N.t('all-invoices-item')}</div>
          </div>
          <div class="pay-card-amounts">
            <div class="pay-card-main">${SAR(m.totalAfterTax)}</div>
          </div>
          ${m.method === 'subscription' ? '<div class="pay-card-note">(لا يدخل في الحساب)</div>' : ''}
        </div>`;
    }).join('');
  }

  function buildAllInvoicesTable(invoices) {
    if (!invoices.length) return `<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px">${I18N.t('all-invoices-no-invoices')}</td></tr>`;
    return invoices.map((inv) => {
      const total     = Number(inv.total_amount || 0);
      const cleaned   = inv.cleaning_date ? true : false;
      const delivered = inv.delivery_date  ? true : false;
      return `<tr
        data-payment-status="${inv.payment_status || ''}"
        data-payment-method="${inv.payment_method || ''}"
        data-cleaned="${cleaned ? '1' : '0'}"
        data-delivered="${delivered ? '1' : '0'}">
        <td class="num-cell">${inv.invoice_seq || inv.order_number || inv.id}</td>
        <td>${escHtml(inv.phone || inv.customer_name || '—')}</td>
        <td>${(() => { const dt = fmtDT(inv.created_at); const p = dt.split(', '); return p[0] + (p[1] ? '<br>' + p[1] : ''); })()}</td>
        <td>${payLabel(inv.payment_method)}</td>
        <td class="num-cell">${fmt(total)}</td>
        <td class="status-cell">${cleaned  ? `<span class="op-badge op-done">✓ ${I18N.t('all-invoices-yes')}</span>` : `<span class="op-badge op-pending">—</span>`}</td>
        <td class="status-cell">${delivered ? `<span class="op-badge op-done">✓ ${I18N.t('all-invoices-yes')}</span>` : `<span class="op-badge op-pending">—</span>`}</td>
        <td class="no-print">${statusBadge(inv)}</td>
        <td class="no-print"><button class="view-btn" onclick="showInvoiceModal(${inv.id})">${I18N.t('all-invoices-view')}</button></td>
      </tr>`;
    }).join('');
  }

  function buildCreditNotesTable(creditNotes) {
    if (!creditNotes.length) return `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px">${I18N.t('all-invoices-no-credit-notes')}</td></tr>`;
    return creditNotes.map((cn) => {
      const beforeTax = Number(cn.total_amount || 0) - Number(cn.vat_amount || 0);
      return `<tr>
        <td class="num-cell">${cn.credit_note_seq || cn.credit_note_number}</td>
        <td class="num-cell">${cn.original_invoice_seq || '—'}</td>
        <td>${escHtml(cn.customer_name || '—')}</td>
        <td>${(() => { const dt = fmtDT(cn.created_at); const p = dt.split(', '); return p[0] + (p[1] ? '<br>' + p[1] : ''); })()}</td>
        <td class="num-cell">${fmtLtr(beforeTax)}</td>
        <td class="tax-cell">${fmtLtr(cn.vat_amount)}</td>
        <td class="neg-cell">- ${fmtLtr(cn.total_amount)}</td>
        <td class="no-print"><button class="view-btn" onclick="showCreditNoteModal(${cn.id})">${I18N.t('all-invoices-view')}</button></td>
      </tr>`;
    }).join('');
  }

  function computeFilteredSummary(filterKey) {
    if (filterKey === 'all' || !reportData) return reportData ? reportData.summary : null;
    const invoices = getFilteredInvoices();
    const count    = invoices.length;
    const afterTax = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const tax      = invoices.reduce((s, i) => s + Number(i.vat_amount || 0), 0);
    const beforeTax = afterTax - tax;
    const discount = invoices.reduce((s, i) => s + Number(i.discount_amount || 0), 0);
    const paidAmt  = invoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    const remain   = invoices.reduce((s, i) => s + Number(i.remaining_amount || 0), 0);
    const labelMap = {
      paid: 'summary-paid', deferred: 'summary-deferred',
      cleaned: 'summary-cleaned', delivered: 'summary-delivered',
      subscription: 'summary-subscription',
    };
    const cn = reportData.summary.creditNotes;
    const netBefore = beforeTax - cn.beforeTax;
    const netTax    = tax - cn.tax;
    const netAfter  = afterTax - cn.afterTax;
    return {
      filtered: { count, beforeTax, tax, afterTax, discount, paidAmount: paidAmt, remaining: remain, label: labelMap[filterKey] || 'summary-all-invoices' },
      creditNotes: cn,
      net: { beforeTax: netBefore, tax: netTax, afterTax: netAfter },
    };
  }

  function buildSummaryTable(summary, filterKey) {
    const isFiltered = filterKey && filterKey !== 'all';
    const mainLabel  = isFiltered ? I18N.t(summary.filtered.label) : I18N.t('summary-all-invoices');
    const mainRow    = isFiltered
      ? { label: mainLabel, count: summary.filtered.count, before: summary.filtered.beforeTax, tax: summary.filtered.tax, after: summary.filtered.afterTax, cls: 'row-all' }
      : { label: mainLabel, count: summary.allInvoices.count, before: summary.allInvoices.beforeTax, tax: summary.allInvoices.tax, after: summary.allInvoices.afterTax, cls: 'row-all' };
    const rows = [
      mainRow,
      {
        label: I18N.t('summary-credit-notes'),
        count: summary.creditNotes.count,
        before: summary.creditNotes.beforeTax,
        tax: summary.creditNotes.tax,
        after: summary.creditNotes.afterTax,
        cls: 'row-credit',
        isNeg: true
      },
      {
        label: I18N.t('summary-net'),
        count: '',
        before: summary.net.beforeTax,
        tax: summary.net.tax,
        after: summary.net.afterTax,
        cls: 'row-net'
      },
    ];

    return rows.map(({ label, count, before, tax, after, cls, isNeg }) => {
      const countCell = count !== '' ? `<td class="count-cell">${count}</td>` : '<td class="count-cell">—</td>';
      const prefix = isNeg ? '- ' : '';
      return `<tr class="${cls}">
        <td>${label}</td>
        ${countCell}
        <td class="num-cell">${prefix}${SAR(before)}</td>
        <td class="tax-cell">${prefix}${SAR(tax)}</td>
        <td class="num-cell">${prefix}${SAR(after)}</td>
      </tr>`;
    }).join('');
  }

  function setupCollapsible(toggleId, bodyId) {
    const toggle = document.getElementById(toggleId);
    const body   = document.getElementById(bodyId);
    const arrow  = toggle.querySelector('.toggle-arrow');
    let open = true;
    body.classList.add('open');
    toggle.addEventListener('click', () => {
      open = !open;
      body.classList.toggle('open', open);
      arrow.style.transform = open ? '' : 'rotate(-90deg)';
    });
  }

  async function loadReport() {
    const df = filterDateFrom.value;
    const dt = filterDateTo.value;
    if (!df || !dt) { showToast(I18N.t('all-invoices-select-period'), 'error'); return; }
    if (df > dt)    { showToast(I18N.t('all-invoices-err-date-range'), 'error'); return; }

    const toApiDt = (s) => {
      if (!s) return s;
      const withSpace = s.replace('T', ' ');
      return withSpace.match(/\d{2}:\d{2}$/) ? withSpace + ':00' : withSpace;
    };

    const customerId     = document.getElementById('filterCustomerId').value.trim();
    const customerText   = document.getElementById('filterCustomer').value.trim();
    const subNumber      = document.getElementById('filterSubNumber').value.trim();
    currentFilters = {
      dateFrom: toApiDt(df),
      dateTo: toApiDt(dt),
      customerId: customerId || undefined,
      search: (!customerId && customerText) ? customerText : undefined,
      subscriptionNumber: subNumber || undefined,
      customerText: customerText || undefined,
    };
    emptyPrompt.style.display   = 'none';
    loadingState.style.display  = 'flex';
    reportContent.style.display = 'none';

    try {
      const res = await window.api.getAllInvoicesReport(currentFilters);
      if (!res.success) {
        showToast(res.message || I18N.t('all-invoices-err-load'), 'error');
        loadingState.style.display = 'none';
        return;
      }
      reportData = res;

      const customerPart = customerText ? ` · ${I18N.t('all-invoices-customer')} ${escHtml(customerText)}` : '';
      const subNumPart   = subNumber ? ` · ${I18N.t('all-invoices-sub-num')} ${escHtml(subNumber)}` : '';
      periodInfoBar.textContent = `${I18N.t('all-invoices-period')}: ${fmtD(df)} — ${fmtD(dt)}${customerPart}${subNumPart}`;
      document.getElementById('printMeta').textContent = `${I18N.t('all-invoices-from').replace(':','')} ${fmtD(df)} ${I18N.t('all-invoices-to').replace(':','')} ${fmtD(dt)}${customerPart}${subNumPart}`;

      const allInvoices  = res.allInvoices  || [];
      const creditNotes  = res.creditNotes  || [];
      const summary      = res.summary      || {};

      _allInvoicesData = allInvoices;
      _creditNotesData = creditNotes;
      _invPage = 1; _cnPage = 1;
      _invPageSize = parseInt(document.getElementById('invPageSize')?.value || '50', 10);
      _cnPageSize = parseInt(document.getElementById('cnPageSize')?.value || '50', 10);

      const allTotal      = allInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
      const allPaid       = allInvoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
      const allRemaining  = allInvoices.reduce((s, i) => s + Number(i.remaining_amount || 0), 0);

      document.getElementById('badgeAllInvoices').textContent = allInvoices.length;
      document.getElementById('allInvoicesTotals').innerHTML = '';
      renderAllInvoicesPage();

      const cnTotal = creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0);
      const cnCount = creditNotes.length;
      document.getElementById('badgeCreditNotes').textContent = cnCount;
      document.getElementById('creditTotals').innerHTML = `<span class="section-total-item">${I18N.t('all-invoices-total-after-tax')}: <span style="color:#dc2626">- ${fmtLtr(cnTotal)}</span></span>`;
      if (cnCount > 0) {
        document.getElementById('creditNotesFooter').innerHTML = `${cnCount} ${I18N.t('all-invoices-item-cn')} &nbsp;|&nbsp; ${I18N.t('all-invoices-total-after-tax')}: - ${fmtLtr(cnTotal)}`;
      }
      renderCreditNotesPage();

      document.getElementById('summaryTableBody').innerHTML = buildSummaryTable(summary);
      buildPaymentMethods(res.paymentMethods || []);

      setupInvFilters();

      if (!colSetup) {
        setupCollapsible('toggleAllInvoices', 'bodyAllInvoices');
        setupCollapsible('toggleCreditNotes', 'bodyCreditNotes');
        colSetup = true;
      }

      loadingState.style.display   = 'none';
      reportContent.style.display  = 'flex';
      reportContent.style.flexDirection = 'column';
      reportContent.style.gap      = '16px';
    } catch (err) {
      showToast(I18N.t('all-invoices-err-load'), 'error');
      loadingState.style.display = 'none';
      emptyPrompt.style.display  = 'flex';
    }
  }

  /* ── Pagination helpers ── */
  function getFilteredInvoices() {
    const sel = document.getElementById('invFilterSelect');
    const f = sel ? sel.value : 'all';
    if (f === 'all') return _allInvoicesData;
    return _allInvoicesData.filter(inv => {
      const ps = inv.payment_status || '';
      const pm = inv.payment_method || '';
      const cl = inv.cleaning_date ? 1 : 0;
      const dl = inv.delivery_date ? 1 : 0;
      if (f === 'paid')      return ps === 'paid';
      if (f === 'deferred')  return pm === 'credit' || ps === 'pending' || ps === 'partial';
      if (f === 'cleaned')       return cl;
      if (f === 'delivered')     return dl;
      if (f === 'subscription')  return pm === 'subscription';
      return true;
    });
  }

  function renderAllInvoicesPage() {
    const filtered = getFilteredInvoices();
    const total = filtered.length;
    _invTotalPages = Math.ceil(total / _invPageSize) || 1;
    if (_invPage > _invTotalPages) _invPage = _invTotalPages || 1;
    const start = (_invPage - 1) * _invPageSize;
    const pageItems = filtered.slice(start, start + _invPageSize);
    document.getElementById('allInvoicesTableBody').innerHTML = buildAllInvoicesTable(pageItems);
    document.getElementById('allInvoicesFooter').innerHTML = total > 0
      ? `${total} ${I18N.t('all-invoices-item')}`
      : I18N.t('all-invoices-no-invoices');
    renderInvPagination(total);
  }

  function renderCreditNotesPage() {
    const total = _creditNotesData.length;
    _cnTotalPages = Math.ceil(total / _cnPageSize) || 1;
    if (_cnPage > _cnTotalPages) _cnPage = _cnTotalPages || 1;
    const start = (_cnPage - 1) * _cnPageSize;
    const pageItems = _creditNotesData.slice(start, start + _cnPageSize);
    document.getElementById('creditNotesTableBody').innerHTML = buildCreditNotesTable(pageItems);
    renderCnPagination(total);
  }

  function buildPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...'); pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1); pages.push('...');
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1); pages.push('...');
      for (let i = current - 1; i <= current + 1; i++) pages.push(i);
      pages.push('...'); pages.push(total);
    }
    return pages;
  }

  function renderInvPagination(totalItems) {
    const bar = document.getElementById('invPaginationBar');
    if (!bar) return;
    if (_invTotalPages <= 1) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const start = (_invPage - 1) * _invPageSize + 1;
    const end = Math.min(_invPage * _invPageSize, totalItems);
    document.getElementById('invPaginationInfo').textContent = `${start}–${end} ${I18N.t('pagination-from')} ${totalItems}`;
    document.getElementById('invBtnFirst').disabled = _invPage === 1;
    document.getElementById('invBtnPrev').disabled = _invPage === 1;
    document.getElementById('invBtnNext').disabled = _invPage === _invTotalPages;
    document.getElementById('invBtnLast').disabled = _invPage === _invTotalPages;
    const pn = document.getElementById('invPageNumbers');
    pn.innerHTML = '';
    const pages = buildPageRange(_invPage, _invTotalPages);
    pages.forEach(p => {
      if (p === '...') {
        const span = document.createElement('span');
        span.className = 'page-ellipsis'; span.textContent = '…';
        pn.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.className = 'page-num' + (p === _invPage ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => { _invPage = p; renderAllInvoicesPage(); });
        pn.appendChild(btn);
      }
    });
  }

  function renderCnPagination(totalItems) {
    const bar = document.getElementById('cnPaginationBar');
    if (!bar) return;
    if (_cnTotalPages <= 1) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const start = (_cnPage - 1) * _cnPageSize + 1;
    const end = Math.min(_cnPage * _cnPageSize, totalItems);
    document.getElementById('cnPaginationInfo').textContent = `${start}–${end} ${I18N.t('pagination-from')} ${totalItems}`;
    document.getElementById('cnBtnFirst').disabled = _cnPage === 1;
    document.getElementById('cnBtnPrev').disabled = _cnPage === 1;
    document.getElementById('cnBtnNext').disabled = _cnPage === _cnTotalPages;
    document.getElementById('cnBtnLast').disabled = _cnPage === _cnTotalPages;
    const pn = document.getElementById('cnPageNumbers');
    pn.innerHTML = '';
    const pages = buildPageRange(_cnPage, _cnTotalPages);
    pages.forEach(p => {
      if (p === '...') {
        const span = document.createElement('span');
        span.className = 'page-ellipsis'; span.textContent = '…';
        pn.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.className = 'page-num' + (p === _cnPage ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => { _cnPage = p; renderCreditNotesPage(); });
        pn.appendChild(btn);
      }
    });
  }

  function applyInvFilter(f) {
    _invPage = 1;
    renderAllInvoicesPage();
    const filteredSummary = computeFilteredSummary(f);
    if (filteredSummary) {
      document.getElementById('summaryTableBody').innerHTML = buildSummaryTable(filteredSummary, f);
    }
  }

  function setupCustomerSearch() {
    const input    = document.getElementById('filterCustomer');
    const dropdown = document.getElementById('customerDropdown');
    const hiddenId = document.getElementById('filterCustomerId');
    let debounce;

    input.addEventListener('input', () => {
      hiddenId.value = '';
      clearTimeout(debounce);
      const q = input.value.trim();
      if (q.length < 2) { dropdown.style.display = 'none'; return; }
      debounce = setTimeout(() => doSearchCustomers(q), 260);
    });

    document.addEventListener('click', (e) => {
      if (!document.getElementById('customerSearchWrap').contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  async function doSearchCustomers(q) {
    const input    = document.getElementById('filterCustomer');
    const dropdown = document.getElementById('customerDropdown');
    const hiddenId = document.getElementById('filterCustomerId');
    try {
      const res = await window.api.getCustomers({ search: q, pageSize: 8, page: 1 });
      const customers = (res && (res.customers || res)) || [];
      const list = Array.isArray(customers) ? customers : (customers.customers || []);
      if (!list.length) { dropdown.style.display = 'none'; return; }

      dropdown.innerHTML = list.map((c) => `
        <div class="customer-dropdown-item" data-id="${c.id}" data-name="${escHtml(c.customer_name)}" data-phone="${escHtml(c.phone || '')}">
          <span class="cdi-name">${escHtml(c.customer_name)}</span>
          <span class="cdi-phone">${escHtml(c.phone || '')}</span>
        </div>
      `).join('') + `<div class="cdi-clear" id="cdiClearBtn">${I18N.t('all-invoices-clear-customer')}</div>`;

      dropdown.querySelectorAll('.customer-dropdown-item[data-id]').forEach((item) => {
        item.addEventListener('click', () => {
          hiddenId.value = item.dataset.id;
          input.value    = item.dataset.phone || item.dataset.name;
          dropdown.style.display = 'none';
        });
      });

      const clearBtn = dropdown.querySelector('#cdiClearBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          hiddenId.value = '';
          input.value    = '';
          dropdown.style.display = 'none';
        });
      }

      dropdown.style.display = 'block';
    } catch (_) {
      dropdown.style.display = 'none';
    }
  }

  function setupInvFilters() {
    const sel = document.getElementById('invFilterSelect');
    const bar = document.getElementById('invFilterBar');
    if (!sel) return;
    sel.value = 'all';
    sel.onchange = () => applyInvFilter(sel.value);
    if (bar) {
      bar.addEventListener('click', (e) => e.stopPropagation());
    }
  }

  setupCustomerSearch();
  btnApplyFilter.addEventListener('click', loadReport);
  filterDateFrom.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadReport(); });
  filterDateTo.addEventListener('keydown',   (e) => { if (e.key === 'Enter') loadReport(); });

  btnPrint.addEventListener('click', () => {
    if (window.I18N) {
      const prevLang = window.I18N.getLang();
      window.I18N.applyTemp('ar');
      const invBody = document.getElementById('allInvoicesTableBody');
      const cnBody  = document.getElementById('creditNotesTableBody');
      const filtered = getFilteredInvoices();
      if (invBody) invBody.innerHTML = buildAllInvoicesTable(filtered);
      if (cnBody)  cnBody.innerHTML = buildCreditNotesTable(_creditNotesData);
      if (reportData) {
        const _curFilter = document.getElementById('invFilterSelect')?.value || 'all';
        const _summary = computeFilteredSummary(_curFilter);
        document.getElementById('summaryTableBody').innerHTML = buildSummaryTable(_summary || reportData.summary, _curFilter);
        buildPaymentMethods(reportData.paymentMethods || []);
        if (currentFilters) {
          const _custPart = currentFilters.customerText ? ` · ${I18N.t('all-invoices-customer')} ${escHtml(currentFilters.customerText)}` : '';
          const _subPart  = currentFilters.subscriptionNumber ? ` · ${I18N.t('all-invoices-sub-num')} ${escHtml(currentFilters.subscriptionNumber)}` : '';
          periodInfoBar.textContent = `${I18N.t('all-invoices-period')}: ${fmtD(currentFilters.dateFrom)} — ${fmtD(currentFilters.dateTo)}${_custPart}${_subPart}`;
          document.getElementById('printMeta').textContent = `${I18N.t('all-invoices-from').replace(':','')} ${fmtD(currentFilters.dateFrom)} ${I18N.t('all-invoices-to').replace(':','')} ${fmtD(currentFilters.dateTo)}${_custPart}${_subPart}`;
        }
      }
      window.print();
      setTimeout(() => {
        window.I18N.applyTemp(prevLang);
        renderAllInvoicesPage();
        renderCreditNotesPage();
        if (reportData) {
          const _curFilter = document.getElementById('invFilterSelect')?.value || 'all';
          const _summary = computeFilteredSummary(_curFilter);
          document.getElementById('summaryTableBody').innerHTML = buildSummaryTable(_summary || reportData.summary, _curFilter);
          buildPaymentMethods(reportData.paymentMethods || []);
          if (currentFilters) {
            const _custPart = currentFilters.customerText ? ` · ${I18N.t('all-invoices-customer')} ${escHtml(currentFilters.customerText)}` : '';
            const _subPart  = currentFilters.subscriptionNumber ? ` · ${I18N.t('all-invoices-sub-num')} ${escHtml(currentFilters.subscriptionNumber)}` : '';
            periodInfoBar.textContent = `${I18N.t('all-invoices-period')}: ${fmtD(currentFilters.dateFrom)} — ${fmtD(currentFilters.dateTo)}${_custPart}${_subPart}`;
            document.getElementById('printMeta').textContent = `${I18N.t('all-invoices-from').replace(':','')} ${fmtD(currentFilters.dateFrom)} ${I18N.t('all-invoices-to').replace(':','')} ${fmtD(currentFilters.dateTo)}${_custPart}${_subPart}`;
          }
        }
      }, 500);
    } else {
      window.print();
    }
  });

  btnExcelExport.addEventListener('click', async () => {
    if (!currentFilters) { showToast(I18N.t('all-invoices-err-export'), 'error'); return; }
    btnExcelExport.disabled = true;
    const r = await window.api.exportAllInvoicesReport({ type: 'excel', filters: currentFilters });
    btnExcelExport.disabled = false;
    if (!r.success) showToast(r.message || I18N.t('all-invoices-err-export'), 'error');
  });

  btnPdfExport.addEventListener('click', async () => {
    if (!currentFilters) { showToast(I18N.t('all-invoices-err-export'), 'error'); return; }
    btnPdfExport.disabled = true;
    const r = await window.api.exportAllInvoicesReport({ type: 'pdf', filters: currentFilters });
    btnPdfExport.disabled = false;
    if (!r.success) showToast(r.message || I18N.t('all-invoices-err-export'), 'error');
  });

  /* ── Invoice Modal ── */
  window.showInvoiceModal = async function(id) {
    _viewingOrderId = id;
    if (!_appSettings) {
      const sres = await window.api.getAppSettings().catch(() => null);
      _appSettings = (sres && sres.success && sres.settings) ? sres.settings : {};
    }
    try {
      const res = await window.api.getOrderById({ id });
      if (!res || !res.success || !res.order) { showToast(I18N.t('all-invoices-err-load-invoice'), 'error'); return; }
      renderInvoiceModal(res.order, res.items || [], res.subscription || null);
    } catch { showToast(I18N.t('all-invoices-err-load-invoice'), 'error'); }
  };

  function renderInvoiceModal(order, items, subscription) {
    const s = _appSettings || {};
    const shopName = s.laundryNameAr || s.laundryNameEn || I18N.t('shop-name-default');
    const addressParts = [s.streetNameAr, s.districtAr, s.cityAr].filter(Boolean);
    const el = (id) => document.getElementById(id);

    if (el('invShopName'))    el('invShopName').textContent    = shopName;
    if (el('invShopAddress')) el('invShopAddress').textContent = addressParts.join('، ') || s.locationAr || '';
    if (el('invShopPhone'))   el('invShopPhone').textContent   = s.phone ? I18N.t('all-invoices-phone') + ': ' + s.phone : '';
    if (el('invVatNumber'))   el('invVatNumber').textContent   = s.vatNumber ? I18N.t('all-invoices-vat') + ': ' + s.vatNumber : '';
    if (el('invShopEmail'))   el('invShopEmail').textContent   = s.email || '';

    const invLogoWrap = el('invLogoWrap');
    const invLogo = el('invLogo');
    if (invLogoWrap && invLogo) {
      if (s.logoDataUrl) { invLogo.src = s.logoDataUrl; invLogoWrap.style.display = ''; }
      else { invLogoWrap.style.display = 'none'; }
    }

    const displaySeq = order.invoice_seq || order.order_number || order.id;
    if (el('invOrderNum')) el('invOrderNum').textContent = displaySeq ? String(displaySeq) : '—';
    if (el('invDate'))     el('invDate').textContent     = formatInvoiceDate(order.created_at);
    if (el('invPayment'))  el('invPayment').textContent  = payLabel(order.payment_method);

    const invPaidAtRow = el('invPaidAtRow');
    const invPaidAt    = el('invPaidAt');
    if (order.paid_at && invPaidAtRow && invPaidAt) {
      invPaidAt.textContent = formatInvoiceDate(order.paid_at);
      invPaidAtRow.style.display = '';
    } else if (invPaidAtRow) { invPaidAtRow.style.display = 'none'; }

    const invCleanedAtRow  = el('invCleanedAtRow');
    const invCleanedAt     = el('invCleanedAt');
    const invDeliveredAtRow = el('invDeliveredAtRow');
    const invDeliveredAt   = el('invDeliveredAt');
    if (order.cleaning_date && invCleanedAtRow && invCleanedAt) {
      invCleanedAt.textContent = formatInvoiceDate(order.cleaning_date);
      invCleanedAtRow.style.display = '';
    } else if (invCleanedAtRow) { invCleanedAtRow.style.display = 'none'; }
    if (order.delivery_date && invDeliveredAtRow && invDeliveredAt) {
      invDeliveredAt.textContent = formatInvoiceDate(order.delivery_date);
      invDeliveredAtRow.style.display = '';
    } else if (invDeliveredAtRow) { invDeliveredAtRow.style.display = 'none'; }

    const invCustomerSection = el('invCustomerSection');
    const invCustNameRow  = el('invCustNameRow');
    const invCustName     = el('invCustName');
    const invCustPhoneRow = el('invCustPhoneRow');
    const invCustPhone    = el('invCustPhone');
    if (order.customer_name || order.phone) {
      if (invCustomerSection) invCustomerSection.style.display = '';
      if (order.customer_name && invCustNameRow && invCustName) {
        invCustName.textContent = order.customer_name;
        invCustNameRow.style.display = '';
      } else if (invCustNameRow) invCustNameRow.style.display = 'none';
      if (order.phone && invCustPhoneRow && invCustPhone) {
        invCustPhone.textContent = order.phone;
        invCustPhoneRow.style.display = '';
      } else if (invCustPhoneRow) invCustPhoneRow.style.display = 'none';
    } else {
      if (invCustomerSection) invCustomerSection.style.display = 'none';
    }

    const invSubRefRow = el('invSubRefRow');
    const invSubRef    = el('invSubRef');
    const invSubBalRow = el('invSubBalRow');
    const invSubBalance = el('invSubBalance');
    if (subscription && (subscription.package_name || subscription.subscription_number)) {
      if (subscription.subscription_number && invSubRefRow && invSubRef) {
        invSubRef.textContent = subscription.subscription_number;
        invSubRefRow.style.display = '';
        if (invCustomerSection) invCustomerSection.style.display = '';
      } else if (invSubRefRow) { invSubRefRow.style.display = 'none'; }
      if (subscription.package_name && invSubBalRow && invSubBalance) {
        const bal = parseFloat(subscription.credit_remaining);
        if (!isNaN(bal)) {
          invSubBalance.innerHTML = '<span class="sar">&#xE900;</span> ' + fmtLtr(bal);
          invSubBalRow.style.display = '';
          if (invCustomerSection) invCustomerSection.style.display = '';
        } else if (invSubBalRow) { invSubBalRow.style.display = 'none'; }
      } else if (invSubBalRow) { invSubBalRow.style.display = 'none'; }
    } else {
      if (invSubRefRow)  invSubRefRow.style.display  = 'none';
      if (invSubBalRow)  invSubBalRow.style.display  = 'none';
    }

    const invItemsTbody = el('invItemsTbody');
    if (invItemsTbody) {
      invItemsTbody.innerHTML = (items || []).map(item => `<tr>
        <td class="inv-td-name">${escHtml(item.product_name_ar || '')}</td>
        <td class="inv-td-num">${item.quantity}</td>
        <td class="inv-td-amt">${fmtLtr(item.line_total)}</td>
        <td class="inv-td-name">${escHtml(item.service_name_ar || '—')}</td>
      </tr>`).join('');
    }

    const subtotal  = parseFloat(order.subtotal || 0);
    const discount  = parseFloat(order.discount_amount || 0);
    const vatRate   = parseFloat(order.vat_rate || 0);
    const vatAmount = parseFloat(order.vat_amount || 0);
    const total     = parseFloat(order.total_amount || 0);
    const paidAmt   = parseFloat(order.paid_amount || 0);
    const remaining = parseFloat(order.remaining_amount || 0);
    const isInclusive = order.price_display_mode === 'inclusive';

    const invSubtotalLabel = el('invSubtotalLabel');
    const invSubtotal      = el('invSubtotal');
    const invDiscRow       = el('invDiscRow');
    const invDiscount      = el('invDiscount');
    const invVatRow        = el('invVatRow');
    const invVatLabel      = el('invVatLabel');
    const invVat           = el('invVat');
    const invTotalLabel    = el('invTotalLabel');
    const invTotal         = el('invTotal');
    const invPaidRow       = el('invPaidRow');
    const invPaidAmount    = el('invPaidAmount');
    const invRemainingRow  = el('invRemainingRow');
    const invRemainingAmount = el('invRemainingAmount');

    if (isInclusive && vatRate > 0) {
      if (invSubtotal) invSubtotal.innerHTML = sarFmtA(subtotal * 100 / (100 + vatRate));
    } else {
      if (invSubtotal) invSubtotal.innerHTML = sarFmtA(subtotal);
    }

    if (discount > 0 && invDiscRow && invDiscount) {
      invDiscount.innerHTML = sarFmtA(discount);
      invDiscRow.style.display = '';
    } else if (invDiscRow) { invDiscRow.style.display = 'none'; }

    if (vatRate > 0 && vatAmount > 0) {
      if (invVatLabel) invVatLabel.textContent = `${I18N.t('invoice-vat-label-short')} (${vatRate}%)`;
      if (invVat)      invVat.innerHTML = sarFmtA(vatAmount);
      if (invVatRow)   invVatRow.style.display = '';
      if (invSubtotalLabel) invSubtotalLabel.textContent = I18N.t('invoice-subtotal-before-tax');
      if (invTotalLabel)    invTotalLabel.textContent    = I18N.t('invoice-grand-total-tax');
    } else {
      if (invVatRow) invVatRow.style.display = 'none';
      if (invSubtotalLabel) invSubtotalLabel.textContent = I18N.t('invoice-subtotal');
      if (invTotalLabel)    invTotalLabel.textContent    = I18N.t('invoice-total');
    }

    if (invTotal) invTotal.innerHTML = sarFmtA(total);

    const isDeferred = String(order.payment_method || '') === 'credit' || remaining > 0;
    if (isDeferred && invPaidRow && invRemainingRow) {
      if (invPaidAmount)    invPaidAmount.innerHTML    = sarFmtA(paidAmt);
      if (invRemainingAmount) invRemainingAmount.innerHTML = sarFmtA(remaining);
      invPaidRow.style.display     = '';
      invRemainingRow.style.display = '';
    } else {
      if (invPaidRow)      invPaidRow.style.display      = 'none';
      if (invRemainingRow) invRemainingRow.style.display = 'none';
    }

    const invQR = el('invQR');
    if (vatRate > 0 && invQR) {
      invQR.innerHTML = '';
      const isoTimestamp = (ds) => {
        const d = ds ? new Date(ds) : new Date();
        return (isNaN(d.getTime()) ? new Date() : d).toISOString().replace(/\.\d{3}Z$/, 'Z');
      };
      window.api.generateZatcaQR({
        sellerName: shopName, vatNumber: s.vatNumber || '',
        timestamp: isoTimestamp(order.created_at),
        totalAmount: fmtLtr(total), vatAmount: fmtLtr(vatAmount)
      }).then(res => { if (res && res.success && res.svg) invQR.innerHTML = res.svg; }).catch(() => {});
    } else if (invQR) { invQR.innerHTML = ''; }

    // Barcode
    const invBarcodeEl = document.getElementById('invBarcode');
    if (invBarcodeEl && order.invoice_seq) {
      try { JsBarcode(invBarcodeEl, String(order.invoice_seq), { format: 'CODE128', width: 3, height: 50, displayValue: true, fontSize: 14, margin: 0, background: 'transparent' }); } catch(e) { invBarcodeEl.innerHTML = ''; }
    } else if (invBarcodeEl) { invBarcodeEl.innerHTML = ''; }

    const invFooterNotes = el('invFooterNotes');
    if (invFooterNotes) {
      if (s.invoiceNotes) {
        const invNotesContent = el('invNotesContent');
        if (invNotesContent) invNotesContent.textContent = s.invoiceNotes;
        invFooterNotes.style.display = '';
      } else { invFooterNotes.style.display = 'none'; }
    }

    document.getElementById('invoiceViewModal').style.display = 'flex';
    const dialogBody = document.querySelector('.inv-dialog-body');
    if (dialogBody) dialogBody.scrollTop = 0;
  }

  /* ── Credit Note Modal ── */
  window.showCreditNoteModal = async function(id) {
    if (!_appSettings) {
      const sres = await window.api.getAppSettings().catch(() => null);
      _appSettings = (sres && sres.success && sres.settings) ? sres.settings : {};
    }
    try {
      const res = await window.api.getCreditNoteById({ id });
      if (!res || !res.success || !res.creditNote) { showToast(I18N.t('all-invoices-cant-load-cn'), 'error'); return; }
      let order = null;
      if (res.creditNote && res.creditNote.original_order_id) {
        try {
          const orderRes = await window.api.getOrderById({ id: res.creditNote.original_order_id });
          if (orderRes && orderRes.success) order = orderRes.order || null;
        } catch (_) {}
      }
      renderCreditNoteModal(res.creditNote, res.items || [], order, res.subscriptionRefund || null);
    } catch { showToast(I18N.t('all-invoices-cn-load-error'), 'error'); }
  };

  function renderCreditNoteModal(cn, items, order, subscriptionRefund) {
    const s = _appSettings || {};
    const shopName = s.laundryNameAr || s.laundryNameEn || I18N.t('shop-name-default');
    const addressParts = [s.streetNameAr, s.districtAr, s.cityAr].filter(Boolean);
    const el = (id) => document.getElementById(id);

    if (el('cnShopName'))    el('cnShopName').textContent    = shopName;
    if (el('cnShopAddress')) el('cnShopAddress').textContent = addressParts.join('، ') || s.locationAr || '';
    if (el('cnShopPhone'))   el('cnShopPhone').textContent   = s.phone ? I18N.t('all-invoices-phone') + ': ' + s.phone : '';
    if (el('cnVatNumber'))   el('cnVatNumber').textContent   = s.vatNumber ? I18N.t('all-invoices-vat') + ': ' + s.vatNumber : '';
    if (el('cnShopEmail'))   el('cnShopEmail').textContent   = s.email || '';

    const cnLogoWrap = el('cnLogoWrap');
    const cnLogo = el('cnLogo');
    if (cnLogoWrap && cnLogo) {
      if (s.logoDataUrl) { cnLogo.src = s.logoDataUrl; cnLogoWrap.style.display = ''; }
      else { cnLogoWrap.style.display = 'none'; }
    }

    if (el('cnNoteNum'))  el('cnNoteNum').textContent  = cn.credit_note_number || cn.credit_note_seq || '';
    if (el('cnOrigInv'))  el('cnOrigInv').textContent  = cn.original_invoice_seq ? String(cn.original_invoice_seq) : (cn.original_order_number || '—');
    if (el('cnDate'))     el('cnDate').textContent     = formatInvoiceDate(cn.created_at);
    if (el('cnPayment'))  el('cnPayment').textContent  = order ? payLabel(order.payment_method) : '—';

    // سطر استرجاع رصيد الاشتراك
    var cnRefundRow = el('cnRefundRow');
    var cnRefundText = el('cnRefundText');
    if (cnRefundRow && cnRefundText) {
      if (subscriptionRefund && Number(subscriptionRefund.amount) > 0) {
        var rAmt = Number(subscriptionRefund.amount).toFixed(2);
        var rInv = subscriptionRefund.originalInvoiceSeq || cn.original_invoice_seq || '—';
        cnRefundText.innerHTML =
          'الرصيد المتبقى: ' +
          '<span class="sar">&#xE900;</span> ' + Number(subscriptionRefund.newBalance).toFixed(2);
        cnRefundRow.style.display = '';
      } else {
        cnRefundRow.style.display = 'none';
        cnRefundText.textContent = '';
      }
    }

    const setRow = (rowId, val, valId) => {
      const row = el(rowId);
      const valEl = valId ? el(valId) : null;
      if (val) { if (valEl) valEl.textContent = formatInvoiceDate(val); if (row) row.style.display = ''; }
      else if (row) row.style.display = 'none';
    };
    setRow('cnPaidAtRow', order && order.paid_at, 'cnPaidAt');
    setRow('cnCleanedAtRow', order && order.cleaning_date, 'cnCleanedAt');
    setRow('cnDeliveredAtRow', order && order.delivery_date, 'cnDeliveredAt');

    const cnCRRow = el('cnCRRow');
    const cnCR = el('cnCR');
    if (s.commercialRegister && cnCRRow && cnCR) { cnCR.textContent = s.commercialRegister; cnCRRow.style.display = ''; }
    else if (cnCRRow) cnCRRow.style.display = 'none';

    const cnCreatedByRow = el('cnCreatedByRow');
    const cnCreatedBy = el('cnCreatedBy');
    if (cn.created_by && cnCreatedByRow && cnCreatedBy) { cnCreatedBy.textContent = cn.created_by; cnCreatedByRow.style.display = ''; }
    else if (cnCreatedByRow) cnCreatedByRow.style.display = 'none';

    const cnCustomerSection = el('cnCustomerSection');
    const cnCustNameRow = el('cnCustNameRow');
    const cnCustName = el('cnCustName');
    const cnCustPhoneRow = el('cnCustPhoneRow');
    const cnCustPhone = el('cnCustPhone');
    if (cn.customer_name || cn.phone) {
      if (cnCustomerSection) cnCustomerSection.style.display = '';
      if (cn.customer_name && cnCustNameRow && cnCustName) { cnCustName.textContent = cn.customer_name; cnCustNameRow.style.display = ''; } else if (cnCustNameRow) cnCustNameRow.style.display = 'none';
      if (cn.phone && cnCustPhoneRow && cnCustPhone) { cnCustPhone.textContent = cn.phone; cnCustPhoneRow.style.display = ''; } else if (cnCustPhoneRow) cnCustPhoneRow.style.display = 'none';
    } else {
      if (cnCustomerSection) cnCustomerSection.style.display = 'none';
    }

    const cnSubRefRow = el('cnSubRefRow');
    const cnSubRef = el('cnSubRef');
    const cnSubBalRow = el('cnSubBalRow');
    const cnSubBalance = el('cnSubBalance');
    if (subscriptionRefund && Number(subscriptionRefund.amount) > 0) {
      if (cnCustomerSection) cnCustomerSection.style.display = '';
      if (cnSubRefRow && cnSubRef && subscriptionRefund.subscriptionNumber) {
        cnSubRef.textContent = subscriptionRefund.subscriptionNumber;
        cnSubRefRow.style.display = '';
      } else if (cnSubRefRow) cnSubRefRow.style.display = 'none';
      if (cnSubBalRow && cnSubBalance) {
        cnSubBalance.innerHTML = '<span class="sar">&#xE900;</span> ' + fmtLtr(subscriptionRefund.newBalance);
        cnSubBalRow.style.display = '';
      }
    } else {
      if (cnSubRefRow) cnSubRefRow.style.display = 'none';
      if (cnSubBalRow) cnSubBalRow.style.display = 'none';
    }

    const cnItemsTbody = el('cnItemsTbody');
    if (cnItemsTbody) {
      cnItemsTbody.innerHTML = (items || []).map(item => `<tr>
        <td class="inv-td-name">${escHtml(item.product_name_ar || '')}</td>
        <td class="inv-td-num">${item.quantity}</td>
        <td class="inv-td-amt">${fmtLtr(item.line_total)}</td>
        <td class="inv-td-name">${escHtml(item.service_name_ar || '—')}</td>
      </tr>`).join('');
    }

    const subtotal  = parseFloat(cn.subtotal || 0);
    const discount  = parseFloat(cn.discount_amount || 0);
    const vatRate   = parseFloat(cn.vat_rate || 0);
    const vatAmount = parseFloat(cn.vat_amount || 0);
    const total     = parseFloat(cn.total_amount || 0);
    const isInclusive = cn.price_display_mode === 'inclusive';

    const cnSubtotalLabel = el('cnSubtotalLabel');
    const cnSubtotal = el('cnSubtotal');
    const cnDiscRow = el('cnDiscRow');
    const cnDiscount = el('cnDiscount');
    const cnVatRow = el('cnVatRow');
    const cnVatLabel = el('cnVatLabel');
    const cnVat = el('cnVat');
    const cnTotalLabel = el('cnTotalLabel');
    const cnTotalEl = el('cnTotal');
    const cnPaidRow = el('cnPaidRow');
    const cnPaidAmount = el('cnPaidAmount');
    const cnRemainingRow = el('cnRemainingRow');
    const cnRemainingAmount = el('cnRemainingAmount');

    if (isInclusive && vatRate > 0) {
      if (cnSubtotal) cnSubtotal.innerHTML = sarFmtA(subtotal * 100 / (100 + vatRate));
    } else {
      if (cnSubtotal) cnSubtotal.innerHTML = sarFmtA(subtotal);
    }

    if (discount > 0 && cnDiscRow && cnDiscount) {
      cnDiscount.innerHTML = sarFmtA(discount);
      cnDiscRow.style.display = '';
    } else if (cnDiscRow) { cnDiscRow.style.display = 'none'; }

    if (vatRate > 0 && vatAmount > 0) {
      if (cnVatLabel) cnVatLabel.textContent = `${I18N.t('invoice-vat-label-short')} (${vatRate}%)`;
      if (cnVat) cnVat.innerHTML = sarFmtA(vatAmount);
      if (cnVatRow) cnVatRow.style.display = '';
      if (cnSubtotalLabel) cnSubtotalLabel.textContent = I18N.t('invoice-subtotal-before-tax');
      if (cnTotalLabel) cnTotalLabel.textContent = I18N.t('invoice-grand-total-tax');
    } else {
      if (cnVatRow) cnVatRow.style.display = 'none';
      if (cnSubtotalLabel) cnSubtotalLabel.textContent = I18N.t('invoice-subtotal');
      if (cnTotalLabel) cnTotalLabel.textContent = I18N.t('invoice-total');
    }

    if (cnTotalEl) cnTotalEl.innerHTML = sarFmtA(total);

    const paidAmount = order ? parseFloat(order.paid_amount || 0) : 0;
    const remainingAmount = order ? parseFloat(order.remaining_amount || 0) : 0;
    const isDeferred = order && (String(order.payment_method || '') === 'credit' || remainingAmount > 0);
    if (isDeferred && cnPaidRow && cnRemainingRow) {
      if (cnPaidAmount) cnPaidAmount.innerHTML = sarFmtA(paidAmount);
      if (cnRemainingAmount) cnRemainingAmount.innerHTML = sarFmtA(remainingAmount);
      cnPaidRow.style.display = ''; cnRemainingRow.style.display = '';
    } else {
      if (cnPaidRow) cnPaidRow.style.display = 'none';
      if (cnRemainingRow) cnRemainingRow.style.display = 'none';
    }

    const cnQR = el('cnQR');
    if (vatRate > 0 && cnQR) {
      cnQR.innerHTML = '';
      const isoTs = (ds) => {
        const d = ds ? new Date(ds) : new Date();
        return (isNaN(d.getTime()) ? new Date() : d).toISOString().replace(/\.\d{3}Z$/, 'Z');
      };
      window.api.generateZatcaQR({
        sellerName: shopName, vatNumber: s.vatNumber || '',
        timestamp: isoTs(cn.created_at),
        totalAmount: fmtLtr(total), vatAmount: fmtLtr(vatAmount)
      }).then(res => { if (res && res.success && res.svg) cnQR.innerHTML = res.svg; }).catch(() => {});
    } else if (cnQR) { cnQR.innerHTML = ''; }

    // Barcode (credit note uses original invoice seq)
    const cnBarcodeEl = document.getElementById('cnBarcode');
    if (cnBarcodeEl && cn.original_invoice_seq) {
      try { JsBarcode(cnBarcodeEl, String(cn.original_invoice_seq), { format: 'CODE128', width: 3, height: 50, displayValue: true, fontSize: 14, margin: 0, background: 'transparent' }); } catch(e) { cnBarcodeEl.innerHTML = ''; }
    } else if (cnBarcodeEl) { cnBarcodeEl.innerHTML = ''; }

    const cnNotesSection = el('cnNotesSection');
    const cnNotes = el('cnNotes');
    if (cn.notes && cnNotesSection && cnNotes) { cnNotes.textContent = cn.notes; cnNotesSection.style.display = ''; }
    else if (cnNotesSection) cnNotesSection.style.display = 'none';

    const cnFooterNotes = el('cnFooterNotes');
    if (cnFooterNotes) {
      if (s.invoiceNotes) {
        const cnNotesContent = el('cnNotesContent');
        if (cnNotesContent) cnNotesContent.textContent = s.invoiceNotes;
        cnFooterNotes.style.display = '';
      } else { cnFooterNotes.style.display = 'none'; }
    }

    document.getElementById('cnViewModal').style.display = 'flex';
    const cnDialogBody = document.querySelector('#cnViewModal .inv-dialog-body');
    if (cnDialogBody) cnDialogBody.scrollTop = 0;
  }

  window.closeCreditNoteModal = function() {
    document.getElementById('cnViewModal').style.display = 'none';
  };

  window.closeInvoiceModal = function() {
    document.getElementById('invoiceViewModal').style.display = 'none';
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInvoiceModal(); });

  const btnInvClose      = document.getElementById('btnInvClose');
  const btnInvPrint      = document.getElementById('btnInvPrint');
  const btnInvExportPdf  = document.getElementById('btnInvExportPdf');
  const invoiceViewModal = document.getElementById('invoiceViewModal');
  if (btnInvClose) btnInvClose.addEventListener('click', closeInvoiceModal);
  if (invoiceViewModal) invoiceViewModal.addEventListener('click', (e) => { if (e.target === invoiceViewModal) closeInvoiceModal(); });
  if (btnInvExportPdf) btnInvExportPdf.addEventListener('click', async () => {
    if (!_viewingOrderId) {
      showToast(I18N.t('toast-id-not-found'), 'error');
      return;
    }
    try {
      btnInvExportPdf.disabled = true;
      btnInvExportPdf.innerHTML = `<span>${I18N.t('exporting')}</span>`;
      const paperType = (_appSettings && _appSettings.invoicePaperType) || 'thermal';
      const paperEl = paperType === 'a4'
        ? document.getElementById('invoicePaperA4m')
        : document.getElementById('invoicePaper');
      if (!paperEl) {
        showToast(I18N.t('toast-content-not-found'), 'error');
        btnInvExportPdf.disabled = false;
        btnInvExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>' + I18N.t('export-pdf') + '</span>';
        return;
      }
      const invoiceHTML = paperEl.outerHTML;
      const orderNum = document.getElementById('invOrderNum') ? document.getElementById('invOrderNum').textContent : '';
      const result = await window.api.exportInvoicePdfFromHtml({ html: invoiceHTML, paperType, orderNum });
      if (result.success) {
        showToast(I18N.t('toast-pdf-success'), 'success');
      } else {
        showToast(result.message || I18N.t('all-invoices-err-export'), 'error');
      }
      btnInvExportPdf.disabled = false;
      btnInvExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>' + I18N.t('export-pdf') + '</span>';
    } catch (err) {
      console.error('Export error:', err);
      showToast(I18N.t('export-error-generic'), 'error');
      btnInvExportPdf.disabled = false;
      btnInvExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>' + I18N.t('export-pdf') + '</span>';
    }
  });
  if (btnInvPrint) btnInvPrint.addEventListener('click', () => {
    const copies = Number(_appSettings && _appSettings.printCopies);
    const intCopies = (!Number.isFinite(copies) || copies < 1) ? 1 : Math.min(20, Math.floor(copies));
    let currentCopy = 0;
    function printNextCopy() {
      if (currentCopy >= intCopies) return;
      currentCopy++;
      let handled = false;
      function handleAfterPrint() {
        if (handled) return; handled = true;
        window.removeEventListener('afterprint', handleAfterPrint);
        if (currentCopy < intCopies) setTimeout(printNextCopy, 120);
      }
      window.addEventListener('afterprint', handleAfterPrint);
      window.print();
      setTimeout(handleAfterPrint, 2500);
    }
    printNextCopy();
  });

  /* ── Credit Note Modal Events ── */
  const btnCnClose     = document.getElementById('btnCnClose');
  const btnCnPrint     = document.getElementById('btnCnPrint');
  const btnCnExportPdf = document.getElementById('btnCnExportPdf');
  const cnViewModal    = document.getElementById('cnViewModal');
  if (btnCnClose) btnCnClose.addEventListener('click', closeCreditNoteModal);
  if (cnViewModal) cnViewModal.addEventListener('click', (e) => { if (e.target === cnViewModal) closeCreditNoteModal(); });
  if (btnCnPrint) btnCnPrint.addEventListener('click', () => {
    const copies = Number(_appSettings && _appSettings.printCopies);
    const intCopies = (!Number.isFinite(copies) || copies < 1) ? 1 : Math.min(20, Math.floor(copies));
    let currentCopy = 0;
    function printNextCopy() {
      if (currentCopy >= intCopies) return;
      currentCopy++;
      let handled = false;
      function handleAfterPrint() {
        if (handled) return; handled = true;
        window.removeEventListener('afterprint', handleAfterPrint);
        if (currentCopy < intCopies) setTimeout(printNextCopy, 120);
      }
      window.addEventListener('afterprint', handleAfterPrint);
      window.print();
      setTimeout(handleAfterPrint, 2500);
    }
    printNextCopy();
  });
  if (btnCnExportPdf) btnCnExportPdf.addEventListener('click', async () => {
    try {
      btnCnExportPdf.disabled = true;
      btnCnExportPdf.innerHTML = `<span>${I18N.t('exporting')}</span>`;
      const paperEl = document.getElementById('cnPaper');
      if (!paperEl) {
        showToast(I18N.t('toast-cn-content-not-found'), 'error');
        btnCnExportPdf.disabled = false;
        btnCnExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>' + I18N.t('export-pdf') + '</span>';
        return;
      }
      const invoiceHTML = paperEl.outerHTML;
      const noteNum = document.getElementById('cnNoteNum') ? document.getElementById('cnNoteNum').textContent : '';
      const result = await window.api.exportInvoicePdfFromHtml({ html: invoiceHTML, paperType: 'thermal', orderNum: noteNum });
      if (result.success) {
        showToast(I18N.t('toast-pdf-success'), 'success');
      } else {
        showToast(result.message || I18N.t('all-invoices-err-export'), 'error');
      }
      btnCnExportPdf.disabled = false;
      btnCnExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>' + I18N.t('export-pdf') + '</span>';
    } catch (err) {
      console.error('Export error:', err);
      showToast(I18N.t('export-error-generic'), 'error');
      btnCnExportPdf.disabled = false;
      btnCnExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>' + I18N.t('export-pdf') + '</span>';
    }
  });

  /* ── Pagination event listeners ── */
  document.getElementById('invBtnFirst')?.addEventListener('click', () => { _invPage = 1; renderAllInvoicesPage(); });
  document.getElementById('invBtnPrev')?.addEventListener('click', () => { if (_invPage > 1) { _invPage--; renderAllInvoicesPage(); } });
  document.getElementById('invBtnNext')?.addEventListener('click', () => { if (_invPage < _invTotalPages) { _invPage++; renderAllInvoicesPage(); } });
  document.getElementById('invBtnLast')?.addEventListener('click', () => { _invPage = _invTotalPages; renderAllInvoicesPage(); });
  document.getElementById('invPageSize')?.addEventListener('change', (e) => { _invPageSize = parseInt(e.target.value, 10); _invPage = 1; renderAllInvoicesPage(); });

  document.getElementById('cnBtnFirst')?.addEventListener('click', () => { _cnPage = 1; renderCreditNotesPage(); });
  document.getElementById('cnBtnPrev')?.addEventListener('click', () => { if (_cnPage > 1) { _cnPage--; renderCreditNotesPage(); } });
  document.getElementById('cnBtnNext')?.addEventListener('click', () => { if (_cnPage < _cnTotalPages) { _cnPage++; renderCreditNotesPage(); } });
  document.getElementById('cnBtnLast')?.addEventListener('click', () => { _cnPage = _cnTotalPages; renderCreditNotesPage(); });
  document.getElementById('cnPageSize')?.addEventListener('change', (e) => { _cnPageSize = parseInt(e.target.value, 10); _cnPage = 1; renderCreditNotesPage(); });

  /* ── Print: show all rows (skip pagination) ── */
  let _printRestoring = false;
  window.addEventListener('beforeprint', () => {
    if (_printRestoring) return;
    const invBody = document.getElementById('allInvoicesTableBody');
    const cnBody  = document.getElementById('creditNotesTableBody');
    const filtered = getFilteredInvoices();
    if (invBody) invBody.innerHTML = buildAllInvoicesTable(filtered);
    if (cnBody)  cnBody.innerHTML = buildCreditNotesTable(_creditNotesData);
  });
  window.addEventListener('afterprint', () => {
    _printRestoring = true;
    renderAllInvoicesPage();
    renderCreditNotesPage();
    _printRestoring = false;
  });

  function rebuildReportContent() {
    if (!reportData) return;
    if (currentFilters) {
      periodInfoBar.textContent = `${I18N.t('all-invoices-period')}: ${fmtD(currentFilters.dateFrom)} — ${fmtD(currentFilters.dateTo)}`;
      document.getElementById('printMeta').textContent = `${I18N.t('all-invoices-from').replace(':','')} ${fmtD(currentFilters.dateFrom)} ${I18N.t('all-invoices-to').replace(':','')} ${fmtD(currentFilters.dateTo)}`;
    }
    document.getElementById('summaryTableBody').innerHTML = buildSummaryTable(reportData.summary || {});
    buildPaymentMethods(reportData.paymentMethods || []);
  }

  /* ── Print translation: rebuild dynamic content in Arabic ── */
  window.addEventListener('print-translate', () => rebuildReportContent());
  window.addEventListener('print-restore', () => rebuildReportContent());

  /* ── Escape handler (both modals) ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const invModal = document.getElementById('invoiceViewModal');
      const cnModal  = document.getElementById('cnViewModal');
      if (cnModal && cnModal.style.display !== 'none') closeCreditNoteModal();
      else if (invModal && invModal.style.display !== 'none') closeInvoiceModal();
    }
  });

  if (typeof I18N !== 'undefined') I18N.apply();
});
