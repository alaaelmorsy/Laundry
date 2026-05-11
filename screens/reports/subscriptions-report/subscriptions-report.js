'use strict';

/* ── State ─────────────────────────────────────────────────────── */
let _periodsData    = [];
let _perPage        = 1;
let _perPageSize    = 50;
let _perTotalPages  = 1;
let _currentFilters = null;
let _reportLoaded   = false;
let _colSetup       = false;

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
