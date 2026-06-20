'use strict';

/* ── State ─────────────────────────────────────────────────────── */
let _periodsData    = [];
let _perPage        = 1;
let _perPageSize    = 50;
let _perTotalPages  = 1;
let _currentFilters = null;
let _reportLoaded   = false;
let _colSetup       = false;
let _crColSetup     = false;
let _crViewerSettings = {}; // إعدادات التطبيق للطباعة
let _crViewerReceiptNum = '';

/* ── Init ──────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  if (window.I18N && typeof window.I18N.enableArabicPrint === 'function') {
    window.I18N.enableArabicPrint();
  }
  if (window.I18N && typeof window.I18N.apply === 'function') {
    window.I18N.apply();
  }

  initDateDefaults();
  loadPackages();
  setupCustomerSearch();
  setupEventListeners();
  setupCrViewerListeners();
});

/* ── Date defaults (from = 1st of current month, to = today) ──── */
function initDateDefaults() {
  const today = new Date();
  const pad   = (x) => String(x).padStart(2, '0');
  const y = today.getFullYear();
  const m = pad(today.getMonth() + 1);
  const d = pad(today.getDate());
  const hh = pad(today.getHours());
  const mm = pad(today.getMinutes());
  document.getElementById('filterDateFrom').value = `${y}-${m}-01T00:00`;
  document.getElementById('filterDateTo').value   = `${y}-${m}-${d}T${hh}:${mm}`;
}

/* ── Load packages for dropdown ────────────────────────────────── */
async function loadPackages() {
  try {
    const res = await window.api.getPrepaidPackages();
    if (!res || !res.packages) return;
    const sel = document.getElementById('filterPackage');
    res.packages.forEach((pkg) => {
      const opt = document.createElement('option');
      opt.value       = pkg.id;
      opt.textContent = pkg.name_ar;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

/* ── Customer live-search ──────────────────────────────────────── */
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
    debounce = setTimeout(() => searchCustomers(q, input, dropdown, hiddenId), 260);
  });

  document.addEventListener('click', (e) => {
    if (!document.getElementById('customerSearchWrap').contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

async function searchCustomers(q, input, dropdown, hiddenId) {
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
    `).join('') + `<div class="cdi-clear" id="cdiClearBtn">${t('sub-report-clear-customer')}</div>`;

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

/* ── Event listeners ───────────────────────────────────────────── */
function setupEventListeners() {
  document.getElementById('btnBack').addEventListener('click', () => {
    location.href = '/screens/reports/reports.html';
  });

  document.getElementById('btnApplyFilter').addEventListener('click', loadReport);

  document.getElementById('filterDateFrom').addEventListener('mousedown', function (e) {
    if (typeof this.showPicker === 'function') { e.preventDefault(); this.showPicker(); }
  });
  document.getElementById('filterDateTo').addEventListener('mousedown', function (e) {
    if (typeof this.showPicker === 'function') { e.preventDefault(); this.showPicker(); }
  });

  document.getElementById('btnExcelExport').addEventListener('click', () => doExport('excel'));
  document.getElementById('btnPdfExport').addEventListener('click',   () => doExport('pdf'));

  document.getElementById('perBtnFirst').addEventListener('click', () => { _perPage = 1; renderPeriodsPage(); });
  document.getElementById('perBtnPrev').addEventListener('click',  () => { if (_perPage > 1) { _perPage--; renderPeriodsPage(); } });
  document.getElementById('perBtnNext').addEventListener('click',  () => { if (_perPage < _perTotalPages) { _perPage++; renderPeriodsPage(); } });
  document.getElementById('perBtnLast').addEventListener('click',  () => { _perPage = _perTotalPages; renderPeriodsPage(); });
  document.getElementById('perPageSize').addEventListener('change', (e) => {
    _perPageSize = parseInt(e.target.value, 10) || 50;
    _perPage = 1;
    renderPeriodsPage();
  });
}

/* ── Build filters object ──────────────────────────────────────── */
function buildFilters() {
  const customerId = document.getElementById('filterCustomerId').value.trim();
  const customerText = document.getElementById('filterCustomer').value.trim();
  const subNumber = document.getElementById('filterSubNumber').value.trim();
  return {
    dateFrom:          document.getElementById('filterDateFrom').value || undefined,
    dateTo:            document.getElementById('filterDateTo').value   || undefined,
    customerId:        customerId  || undefined,
    search:            (!customerId && customerText) ? customerText : undefined,
    subscriptionNumber: subNumber || undefined,
    statusFilter:      document.getElementById('filterStatus').value || 'all',
    packageId:         document.getElementById('filterPackage').value || undefined,
  };
}

/* ── Main load ─────────────────────────────────────────────────── */
async function loadReport() {
  _currentFilters = buildFilters();

  document.getElementById('emptyPrompt').style.display  = 'none';
  document.getElementById('loadingState').style.display = 'flex';
  document.getElementById('reportContent').style.display = 'none';

  try {
    const res = await window.api.getSubscriptionsReport(_currentFilters);
    if (!res || !res.success) {
      showToast(res?.message || t('sub-report-err-load'), 'error');
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('emptyPrompt').style.display  = 'flex';
      return;
    }

    _periodsData = res.periods || [];
    _perPage     = 1;
    _perPageSize = parseInt(document.getElementById('perPageSize').value, 10) || 50;

    renderPeriodInfoBar(_currentFilters);
    renderKpis(res.summary || {});
    renderPeriodsPage();

    if (!_colSetup) {
      setupCollapsible('togglePeriods', 'bodyPeriods');
      _colSetup = true;
    }

    // جلب إيصالات الاستهلاك بنفس الفلاتر
    loadConsumptionReceipts(_currentFilters);

    document.getElementById('loadingState').style.display  = 'none';
    const rc = document.getElementById('reportContent');
    rc.style.display       = 'flex';
    rc.style.flexDirection = 'column';
    rc.style.gap           = '14px';
    _reportLoaded = true;

  } catch (err) {
    showToast(t('sub-report-err-load'), 'error');
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('emptyPrompt').style.display  = 'flex';
  }
}

/* ── Period info bar ───────────────────────────────────────────── */
function renderPeriodInfoBar(filters) {
  const from = filters.dateFrom ? fmtD(filters.dateFrom) : '—';
  const to   = filters.dateTo   ? fmtD(filters.dateTo)   : '—';
  const statusLabels = {
    all: t('sub-report-status-all-short'), active: t('sub-report-status-active-short'), near_expiry: t('sub-report-status-near-short'),
    negative: t('sub-report-status-negative-short'), expired: t('sub-report-status-expired-short'), closed: t('sub-report-status-closed-short'),
  };
  const statusLabel = statusLabels[filters.statusFilter] || t('sub-report-status-all-short');
  const customerEl  = document.getElementById('filterCustomer');
  const customerPart = customerEl.value.trim() ? ` · ${t('sub-report-info-customer')}: ${escHtml(customerEl.value.trim())}` : '';
  const subNumEl    = document.getElementById('filterSubNumber');
  const subNumPart  = subNumEl.value.trim() ? ` · ${t('sub-report-sub-num')} ${escHtml(subNumEl.value.trim())}` : '';
  document.getElementById('periodInfoBar').innerHTML =
    `📅 ${t('sub-report-info-period')}: ${from} — ${to} &nbsp;·&nbsp; ${t('sub-report-info-status')}: ${statusLabel}${customerPart}${subNumPart}`;
}

/* ── KPI cards (6 cards) ───────────────────────────────────────── */
function renderKpis(summary) {
  const cards = [
    {
      cls: 'kpi-active', icon: '✅',
      label: t('sub-report-kpi-active'),
      value: summary.activeCount,
    },
    {
      cls: 'kpi-near', icon: '⚠️',
      label: t('sub-report-kpi-near'),
      value: summary.nearExpiryCount,
    },
    {
      cls: 'kpi-neg', icon: '🔴',
      label: t('sub-report-kpi-neg'),
      value: summary.negativeCount,
    },
    {
      cls: 'kpi-expired', icon: '📁',
      label: t('sub-report-kpi-expired'),
      value: (summary.expiredCount || 0) + (summary.closedCount || 0),
    },
    {
      cls: 'kpi-revenue', icon: '💰',
      label: t('sub-report-kpi-revenue'),
      sar: summary.totalRevenue,
      sub: `${summary.totalPeriods} ${t('sub-report-kpi-periods')}`,
    },
    {
      cls: 'kpi-credit', icon: '💳',
      label: t('sub-report-kpi-credit'),
      sar: summary.totalCreditRemaining,
      sub: `${t('sub-report-kpi-of-granted')} ${fmt(summary.totalCreditGranted)}`,
    },
  ];

  document.getElementById('kpiGrid').innerHTML = cards.map((c) => `
    <div class="kpi-card ${c.cls}">
      <div class="kpi-label">${c.icon} ${c.label}</div>
      <div class="kpi-value">${c.sar !== undefined ? SAR(c.sar) : (c.value ?? 0)}</div>
      ${c.sub ? `<div class="kpi-sub">${c.sub}</div>` : ''}
    </div>
  `).join('');
}

/* ── Periods table ─────────────────────────────────────────────── */
function renderPeriodsPage() {
  const total = _periodsData.length;
  _perTotalPages = Math.ceil(total / _perPageSize) || 1;
  if (_perPage > _perTotalPages) _perPage = _perTotalPages;
  const start = (_perPage - 1) * _perPageSize;
  const slice = _periodsData.slice(start, start + _perPageSize);

  document.getElementById('periodsTableBody').innerHTML = buildPeriodsRows(slice, start);
  document.getElementById('mobileCardsList').innerHTML  = buildMobileCards(slice, start);
  document.getElementById('badgePeriods').textContent  = total;

  const totalRev     = _periodsData.reduce((s, r) => s + Number(r.prepaid_price_paid  || 0), 0);
  const totalCredit  = _periodsData.reduce((s, r) => s + Number(r.credit_remaining    || 0), 0);
  document.getElementById('periodsTotals').innerHTML =
    `<span class="section-total-item">${t('sub-report-totals-revenue')}: <span>${fmt(totalRev)} ر.س</span></span>` +
    `<span class="section-total-item">${t('sub-report-totals-remaining')}: <span>${fmt(totalCredit)} ر.س</span></span>`;
  document.getElementById('periodsFooter').textContent = `${total} ${t('sub-report-footer-periods')}`;

  renderPerPagination(total);
}

function buildPeriodsRows(rows, offset) {
  if (!rows.length) {
    return `<tr><td colspan="12" style="text-align:center;color:#94a3b8;padding:28px;font-size:14px">${t('sub-report-no-data')}</td></tr>`;
  }
  return rows.map((r, i) => {
    const days    = r.days_until_expiry !== null && r.days_until_expiry !== undefined ? Number(r.days_until_expiry) : null;
    const isNear  = r.display_status === 'active' && days !== null && days >= 0 && days <= 7;
    const isNeg   = Number(r.credit_remaining) <= 0 && r.display_status === 'active';
    return `<tr class="${isNear ? 'row-near-expiry' : ''}">
      <td class="num-cell" style="color:#94a3b8">${offset + i + 1}</td>
      <td style="font-weight:700;color:#0d9488">${escHtml(r.customer_file_ref || '—')}</td>
      <td>${escHtml(r.customer_name || '—')}</td>
      <td dir="ltr" style="color:#64748b">${escHtml(r.phone || '—')}</td>
      <td style="color:#7c3aed;font-weight:700">${escHtml(r.package_name || '—')}</td>
      <td>${fmtD(r.period_from)}</td>
      <td>${r.period_to ? fmtD(r.period_to) : '<span style="color:#94a3b8">—</span>'}</td>
      <td>${daysLabel(days, r.display_status)}</td>
      <td class="num-cell">${SAR(r.prepaid_price_paid)}</td>
      <td class="num-cell" style="color:#0284c7">${SAR(r.credit_value_granted)}</td>
      <td class="num-cell ${isNeg ? 'neg-val' : ''}">${SAR(r.credit_remaining)}</td>
      <td>${statusBadge(r)}</td>
    </tr>`;
  }).join('');
}

function buildMobileCards(rows, offset) {
  if (!rows.length) {
    return `<div class="mob-empty">${t('sub-report-no-data')}</div>`;
  }
  return rows.map((r, i) => {
    const days   = r.days_until_expiry !== null && r.days_until_expiry !== undefined ? Number(r.days_until_expiry) : null;
    const isNear = r.display_status === 'active' && days !== null && days >= 0 && days <= 7;
    const isNeg  = Number(r.credit_remaining) <= 0 && r.display_status === 'active';

    let cardCls = 'mob-card--active';
    if (isNeg)                             cardCls = 'mob-card--negative';
    else if (isNear)                       cardCls = 'mob-card--near';
    else if (r.display_status === 'expired') cardCls = 'mob-card--expired';
    else if (r.display_status === 'closed')  cardCls = 'mob-card--closed';

    const granted   = Number(r.credit_value_granted) || 0;
    const remaining = Number(r.credit_remaining)     || 0;
    const pct       = granted > 0 ? Math.max(0, Math.min(100, (remaining / granted) * 100)) : 0;
    const pctCls    = pct >= 50 ? 'mob-progress-ok' : pct >= 20 ? 'mob-progress-mid' : 'mob-progress-low';

    const dateRange = `📅 ${fmtD(r.period_from)} ← ${r.period_to ? fmtD(r.period_to) : `<span style="color:#94a3b8">${t('sub-report-mob-open')}</span>`}`;

    return `
      <div class="mob-card ${cardCls}" style="animation-delay:${i * 0.04}s">
        <div class="mob-card-header">
          <div class="mob-card-identity">
            <span class="mob-card-num">${offset + i + 1}</span>
            <div class="mob-card-names">
              <span class="mob-card-customer">${escHtml(r.customer_name || '—')}</span>
              <span class="mob-card-sub-info">${escHtml(r.package_name || '—')} · #${escHtml(r.customer_file_ref || '—')}</span>
            </div>
          </div>
          ${statusBadge(r)}
        </div>
        <div class="mob-card-dates">
          <span>${dateRange}</span>
          <span class="mob-days">${daysLabel(days, r.display_status)}</span>
        </div>
        <div class="mob-card-financials">
          <div class="mob-fin-item">
            <span class="mob-fin-label">${t('sub-report-mob-paid')}</span>
            <span class="mob-fin-value">${SAR(r.prepaid_price_paid)}</span>
          </div>
          <div class="mob-fin-item">
            <span class="mob-fin-label">${t('sub-report-mob-granted')}</span>
            <span class="mob-fin-value">${SAR(r.credit_value_granted)}</span>
          </div>
        </div>
        <div class="mob-card-balance">
          <div class="mob-balance-info">
            <span class="mob-balance-label">${t('sub-report-mob-remaining')}</span>
            <span class="mob-balance-value ${isNeg ? 'neg-val' : ''}">${SAR(r.credit_remaining)}</span>
          </div>
          <div class="mob-progress-bar">
            <div class="mob-progress-fill ${pctCls}" style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ── Helpers ────────────────────────────────────────────────────── */
function t(key) { return window.I18N ? window.I18N.t(key) : key; }
function fmt(n)  { return Number(n || 0).toFixed(2); }
function SAR(n)  { return `${fmt(n)} <span class="sar">&#xE900;</span>`; }
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtD(s) {
  if (!s) return '—';
  const str = String(s);
  const hasTime = str.length > 10;
  const datePart = str.split('T')[0].split(' ')[0];
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return s;
  let result = `${d}/${m}/${y}`;
  if (hasTime) {
    const timePart = str.includes('T') ? str.split('T')[1] : str.split(' ')[1];
    if (timePart) {
      let [hh, mm] = timePart.split(':');
      if (hh && mm) {
        const h24 = Number(hh);
        const h12 = h24 % 12 || 12;
        const pad2 = (x) => String(x).padStart(2, '0');
        const ampm = h24 < 12 ? 'ص' : 'م';
        result += ` ${pad2(h12)}:${pad2(mm)} ${ampm}`;
      }
    }
  }
  return result;
}

function daysLabel(days, displayStatus) {
  if (displayStatus === 'expired' || displayStatus === 'closed') return '—';
  if (days === null || days === undefined) return '—';
  const n = Number(days);
  if (n < 0) return `<span style="color:#dc2626;font-weight:700">${t('sub-report-days-ago')} ${Math.abs(n)} ${t('sub-report-days-day')}</span>`;
  if (n === 0) return `<span style="color:#f59e0b;font-weight:700">${t('sub-report-days-today')}</span>`;
  if (n <= 7)  return `<span style="color:${n <= 3 ? '#ef4444' : '#d97706'};font-weight:700">${n} ${t('sub-report-days-days')}</span>`;
  return `<span style="color:#475569">${n} ${t('sub-report-days-day')}</span>`;
}

function statusBadge(row) {
  const s   = row.display_status;
  const isNeg = Number(row.credit_remaining) <= 0 && s === 'active';
  const days  = row.days_until_expiry !== null && row.days_until_expiry !== undefined
                ? Number(row.days_until_expiry) : null;
  const isNear = s === 'active' && days !== null && days >= 0 && days <= 7;

  if (isNeg)  return `<span class="status-badge sb-negative">${t('sub-report-status-negative-short')}</span>`;
  if (isNear) return `<span class="status-badge sb-near">⚠️ ${t('sub-report-status-near-short')}</span>`;
  const map = {
    active:  `<span class="status-badge sb-active">✅ ${t('sub-report-status-active-short')}</span>`,
    expired: `<span class="status-badge sb-expired">❌ ${t('sub-report-status-expired-short')}</span>`,
    closed:  `<span class="status-badge sb-closed">🔒 ${t('sub-report-status-closed-short')}</span>`,
  };
  return map[s] || `<span class="status-badge sb-expired">${escHtml(s)}</span>`;
}

/* ── Collapsible ────────────────────────────────────────────────── */
function setupCollapsible(toggleId, bodyId) {
  const toggle = document.getElementById(toggleId);
  const body   = document.getElementById(bodyId);
  const arrow  = toggle.querySelector('.toggle-arrow');
  let open = true;
  toggle.addEventListener('click', () => {
    open = !open;
    body.classList.toggle('open', open);
    arrow.style.transform = open ? '' : 'rotate(-90deg)';
  });
}

/* ── Pagination ─────────────────────────────────────────────────── */
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

function renderPerPagination(totalItems) {
  const bar = document.getElementById('periodsPaginationBar');
  if (!bar) return;
  if (_perTotalPages <= 1) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  const start = (_perPage - 1) * _perPageSize + 1;
  const end   = Math.min(_perPage * _perPageSize, totalItems);
  document.getElementById('periodsPaginationInfo').textContent = `${start}–${end} ${t('sub-report-pagination-of')} ${totalItems}`;
  document.getElementById('perBtnFirst').disabled = _perPage === 1;
  document.getElementById('perBtnPrev').disabled  = _perPage === 1;
  document.getElementById('perBtnNext').disabled  = _perPage === _perTotalPages;
  document.getElementById('perBtnLast').disabled  = _perPage === _perTotalPages;
  const pn = document.getElementById('perPageNumbers');
  pn.innerHTML = '';
  buildPageRange(_perPage, _perTotalPages).forEach((p) => {
    if (p === '...') {
      const sp = document.createElement('span');
      sp.className = 'page-ellipsis'; sp.textContent = '…';
      pn.appendChild(sp);
    } else {
      const btn = document.createElement('button');
      btn.className = 'page-num' + (p === _perPage ? ' active' : '');
      btn.textContent = p;
      btn.addEventListener('click', () => { _perPage = p; renderPeriodsPage(); });
      pn.appendChild(btn);
    }
  });
}

/* ── Export ─────────────────────────────────────────────────────── */
async function doExport(type) {
  if (!_reportLoaded) {
    showToast(t('sub-report-err-export'), 'error');
    return;
  }
  const btn = type === 'excel'
    ? document.getElementById('btnExcelExport')
    : document.getElementById('btnPdfExport');

  btn.disabled = true;
  showToast(type === 'excel' ? t('sub-report-exporting-excel') : t('sub-report-exporting-pdf'), 'info');

  try {
    const r = await window.api.exportSubscriptionsReport({ type, filters: _currentFilters });
    if (r && !r.success) showToast(r.message || t('sub-report-export-fail'), 'error');
  } catch (_) {
    showToast(t('sub-report-export-fail'), 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ── Consumption Receipts ───────────────────────────────────────── */
async function loadConsumptionReceipts(filters) {
  const section = document.getElementById('sectionConsumption');
  try {
    const payload = { pageSize: 1000, page: 1 };
    if (filters.customerId)  payload.customerId    = filters.customerId;
    if (filters.dateFrom)    payload.dateFrom       = filters.dateFrom.substring(0, 10);
    if (filters.dateTo)      payload.dateTo         = filters.dateTo.substring(0, 10);
    if (filters.search && !filters.customerId) payload.search = filters.search;

    const res = await window.api.getConsumptionReceipts(payload);
    const list = (res && res.success) ? (res.receipts || []) : [];

    renderConsumptionReceipts(list);
    section.style.display = '';

    if (!_crColSetup) {
      setupCollapsible('toggleConsumption', 'bodyConsumption');
      _crColSetup = true;
    }
  } catch (e) {
    section.style.display = 'none';
  }
}

function renderConsumptionReceipts(list) {
  document.getElementById('badgeConsumption').textContent = list.length;

  const total = list.reduce((s, r) => s + Number(r.amount_consumed || 0), 0);
  document.getElementById('consumptionTotals').innerHTML = list.length
    ? `<span class="section-total-item">الإجمالي المستهلك: <span>${fmt(total)} <span class="sar">&#xE900;</span></span></span>`
    : '';

  // desktop table
  document.getElementById('consumptionTableBody').innerHTML = list.length
    ? list.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td dir="ltr">C-${escHtml(String(r.receipt_seq || r.id))}</td>
        <td>${escHtml(r.customer_name || '—')}</td>
        <td dir="ltr">${escHtml(r.phone || '—')}</td>
        <td>${escHtml(r.package_name || '—')}</td>
        <td>${fmtD(r.created_at)}</td>
        <td>${SAR(r.amount_consumed)}</td>
        <td>${SAR(r.balance_before)}</td>
        <td>${SAR(r.balance_after)}</td>
        <td><button class="btn-view-cr" onclick="openCrViewer(${r.id})">عرض الإيصال</button></td>
      </tr>`).join('')
    : `<tr><td colspan="10" style="text-align:center;padding:12px;color:#888">لا توجد إيصالات استهلاك</td></tr>`;

  // mobile cards
  document.getElementById('consumptionMobileCards').innerHTML = list.length
    ? list.map((r, i) => `
      <div class="mobile-card">
        <div class="mc-row1">
          <span class="mc-num">C-${escHtml(String(r.receipt_seq || r.id))}</span>
          <span class="mc-date">${fmtD(r.created_at)}</span>
        </div>
        <div class="mc-customer">${escHtml(r.customer_name || '—')} · <span dir="ltr">${escHtml(r.phone || '')}</span></div>
        <div class="mc-pkg">${escHtml(r.package_name || '—')}</div>
        <div class="mc-row2">
          <span>مستهلك: ${SAR(r.amount_consumed)}</span>
          <span>رصيد بعد: ${SAR(r.balance_after)}</span>
        </div>
        <button class="btn-view-cr" onclick="openCrViewer(${r.id})" style="margin-top:6px;width:100%">عرض الإيصال</button>
      </div>`).join('')
    : '';

  document.getElementById('consumptionFooter').innerHTML = list.length
    ? `إجمالي: <strong>${list.length}</strong> إيصال — مجموع المستهلك: <strong>${fmt(total)} <span class="sar">&#xE900;</span></strong>`
    : '';
}

/* ── Receipt Viewer ─────────────────────────────────────────────── */
async function openCrViewer(receiptId) {
  try {
    const [crRes, settingsRes] = await Promise.all([
      window.api.getConsumptionReceiptById({ id: receiptId }),
      window.api.getAppSettings()
    ]);
    if (!crRes || !crRes.success || !crRes.receipt) { showToast('تعذّر تحميل الإيصال', 'error'); return; }

    const receipt  = crRes.receipt;
    const settings = (settingsRes && settingsRes.settings) || {};
    _crViewerSettings = settings;

    if (receipt.order_id) {
      try {
        const orderRes = await window.api.getOrderById({ id: receipt.order_id });
        if (orderRes && orderRes.success) {
          if (orderRes.items && orderRes.items.length) {
            receipt.items = orderRes.items.map(it => ({
              productNameAr: it.product_name_ar, productNameEn: it.product_name_en,
              serviceNameAr: it.service_name_ar, serviceNameEn: it.service_name_en,
              quantity: it.quantity, lineTotal: it.line_total
            }));
          }
          const ord = orderRes.order || null;
          if (!receipt.cleaning_date && ord && ord.cleaning_date) receipt.cleaning_date = ord.cleaning_date;
          if (!receipt.delivery_date && ord && ord.delivery_date) receipt.delivery_date = ord.delivery_date;
        }
      } catch (_) {}
    }

    populateCrViewer(receipt, settings);
    document.getElementById('crViewerModal').style.display = 'flex';
  } catch (e) {
    showToast('حدث خطأ أثناء تحميل الإيصال', 'error');
  }
}

function populateCrViewer(r, s) {
  s = s || {};

  // بيانات المغسلة
  document.getElementById('crVShopName').textContent    = s.laundryNameAr || s.laundryNameEn || '';
  document.getElementById('crVShopAddress').textContent = s.locationAr || s.locationEn || '';
  document.getElementById('crVShopPhone').textContent   = s.phone ? 'هاتف: ' + s.phone : '';

  const taxEl = document.getElementById('crVShopTax'), taxRow = document.getElementById('crVShopTaxRow');
  if (s.vatNumber) { taxEl.textContent = 'الرقم الضريبي: ' + s.vatNumber; taxRow.style.display = ''; }
  else taxRow.style.display = 'none';

  const crEl = document.getElementById('crVShopCr'), crRow = document.getElementById('crVShopCrRow');
  if (s.commercialRegister) { crEl.textContent = 'السجل التجاري: ' + s.commercialRegister; crRow.style.display = ''; }
  else crRow.style.display = 'none';

  const logoWrap = document.getElementById('crVLogoWrap'), logo = document.getElementById('crVLogo');
  if (s.logoDataUrl && logo) { logo.src = s.logoDataUrl; logoWrap.style.display = ''; }
  else if (logoWrap) logoWrap.style.display = 'none';

  // بيانات الإيصال
  _crViewerReceiptNum = r.receipt_seq ? 'C-' + r.receipt_seq : String(r.id || '');
  document.getElementById('crVReceiptNum').textContent = _crViewerReceiptNum;
  document.getElementById('crVDate').textContent       = fmtD(r.created_at);
  document.getElementById('crVCustomer').textContent   = r.customer_name || '—';
  document.getElementById('crVPhone').textContent      = r.phone || '—';
  document.getElementById('crVSubRef').textContent     = r.subscription_number ? '#' + r.subscription_number : (r.subscription_id ? '#' + r.subscription_id : '—');
  document.getElementById('crVPackage').textContent    = r.package_name || '—';

  const cleanRow = document.getElementById('crVCleanedAtRow'), deliverRow = document.getElementById('crVDeliveredAtRow');
  if (r.cleaning_date) { document.getElementById('crVCleanedAt').textContent = fmtD(r.cleaning_date); cleanRow.style.display = ''; }
  else cleanRow.style.display = 'none';
  if (r.delivery_date) { document.getElementById('crVDeliveredAt').textContent = fmtD(r.delivery_date); deliverRow.style.display = ''; }
  else deliverRow.style.display = 'none';

  // الأرقام
  document.getElementById('crVConsumed').innerHTML  = SAR(r.amount_consumed);
  document.getElementById('crVBalBefore').innerHTML = SAR(r.balance_before);
  document.getElementById('crVBalAfter').innerHTML  = SAR(r.balance_after);

  // البنود
  let items = r.items || [];
  try {
    if (!items.length && r.items_json) items = typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json;
  } catch (_) {}

  document.getElementById('crVItemsBody').innerHTML = items.length
    ? items.map(it => {
        const name = it.productNameAr || it.product_name_ar || it.productNameEn || it.product_name_en || it.name || '—';
        const svc  = it.serviceNameAr || it.service_name_ar || it.serviceNameEn || it.service_name_en || '—';
        const qty  = it.quantity || it.qty || 1;
        const tot  = it.lineTotal != null ? it.lineTotal : (it.line_total != null ? it.line_total : null);
        return `<tr>
          <td class="inv-td-name">${escHtml(String(name))}</td>
          <td class="inv-td-num">${escHtml(String(qty))}</td>
          <td class="inv-td-num">${tot != null ? SAR(tot) : '—'}</td>
          <td class="inv-td-name">${escHtml(String(svc))}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="4" style="text-align:center;padding:8px;color:#888">—</td></tr>`;
}

function closeCrViewer() {
  document.getElementById('crViewerModal').style.display = 'none';
}

function setupCrViewerListeners() {
  document.getElementById('crViewerCloseBtn').addEventListener('click', closeCrViewer);

  document.getElementById('crViewerPrintBtn').addEventListener('click', () => {
    const paper = document.getElementById('crViewerPaper');
    const zone  = document.getElementById('crViewerPrintZone');
    if (!paper || !zone) return;

    // تطبيق هوامش الطباعة من إعدادات التطبيق
    const s     = _crViewerSettings || {};
    const mLeft  = parseFloat(s.thermalMarginLeft  || 0) || 0;
    const mRight = parseFloat(s.thermalMarginRight || 0) || 0;
    const shift  = mLeft - mRight;
    const styleId = 'crPrintPageStyle';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
    styleEl.textContent = '@page { size: 80mm auto; margin: 0; } @media print { #crViewerPrintZone .inv-paper { width: 76mm !important; max-width: 76mm !important; margin: 0 auto !important;'
      + (shift !== 0 ? ' transform: translateX(' + shift + 'mm) !important;' : '') + ' } }';

    zone.innerHTML = paper.outerHTML;
    zone.style.setProperty('display', 'block', 'important');
    window.print();
    setTimeout(() => { zone.innerHTML = ''; zone.style.display = 'none'; if (styleEl) styleEl.textContent = ''; }, 1000);
  });

  document.getElementById('crViewerPdfBtn').addEventListener('click', async () => {
    const paper = document.getElementById('crViewerPaper');
    if (!paper) return;
    const btn = document.getElementById('crViewerPdfBtn');
    try {
      btn.disabled = true;
      btn.querySelector('span').textContent = 'جارٍ التصدير...';
      const s = _crViewerSettings || {};
      const paperType = s.invoicePaperType || 'thermal';
      const result = await window.api.exportInvoicePdfFromHtml({
        html: paper.outerHTML,
        paperType,
        orderNum: _crViewerReceiptNum || 'receipt'
      });
      if (result && result.success) {
        showToast('تم تنزيل PDF بنجاح', 'success');
      } else {
        showToast((result && result.message) || 'فشل تصدير PDF', 'error');
      }
    } catch (_) {
      showToast('حدث خطأ أثناء تصدير PDF', 'error');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'تصدير PDF';
    }
  });

  document.getElementById('crViewerModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('crViewerModal')) closeCrViewer();
  });

  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('crViewerModal');
    if (e.key === 'Escape' && modal && modal.style.display !== 'none') closeCrViewer();
  });
}

/* ── Toast ──────────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const tc = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<div class="toast-text">${msg}</div>`;
  tc.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-hide');
    setTimeout(() => el.remove(), 350);
  }, 3200);
}
