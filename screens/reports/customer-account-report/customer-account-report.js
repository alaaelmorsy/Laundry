window.addEventListener('DOMContentLoaded', () => {
  // ── DOM refs ─────────────────────────────────────────────────────────────
  const btnBack             = document.getElementById('btnBack');
  const btnExcelExport      = document.getElementById('btnExcelExport');
  const btnPdfExport        = document.getElementById('btnPdfExport');
  const btnApplyFilter      = document.getElementById('btnApplyFilter');
  const customerSearch      = document.getElementById('customerSearch');
  const customerDropdown    = document.getElementById('customerDropdown');
  const filterDateFrom      = document.getElementById('filterDateFrom');
  const filterDateTo        = document.getElementById('filterDateTo');
  const typeFilterWrap      = document.getElementById('typeFilterWrap');
  const filterMovementType  = document.getElementById('filterMovementType');
  const filterPaid          = document.getElementById('filterPaid');
  const filterCleaning      = document.getElementById('filterCleaning');
  const filterDelivery      = document.getElementById('filterDelivery');
  const filterPaidWrap      = document.getElementById('filterPaidWrap');
  const filterCleaningWrap  = document.getElementById('filterCleaningWrap');
  const filterDeliveryWrap  = document.getElementById('filterDeliveryWrap');
  const loadingState        = document.getElementById('loadingState');
  const reportContent       = document.getElementById('reportContent');
  const emptyPrompt         = document.getElementById('emptyPrompt');
  const emptyMessage        = document.getElementById('emptyMessage');
  const customerInfoBar     = document.getElementById('customerInfoBar');
  const summaryGrid         = document.getElementById('summaryGrid');
  const subscriptionSection = document.getElementById('subscriptionSection');
  const subscriptionTableBody = document.getElementById('subscriptionTableBody');
  const movementsTableBody  = document.getElementById('movementsTableBody');
  const movementsBadge      = document.getElementById('movementsBadge');
  const movementsFooter     = document.getElementById('movementsFooter');

  if (window.I18N && typeof window.I18N.apply === 'function') window.I18N.apply();
  if (window.I18N && typeof window.I18N.enableArabicPrint === 'function') window.I18N.enableArabicPrint();

  // ── State ─────────────────────────────────────────────────────────────────
  let selectedCustomer   = null;   // { id, customer_name, phone, tax_number, customer_type }
  let allMovements       = [];
  let reportData         = null;   // full response from API
  let searchDebounceTimer = null;

  // ── Default dates: last 30 days ───────────────────────────────────────────
  const today = new Date();
  const pad   = x => String(x).padStart(2, '0');
  filterDateTo.value   = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}T23:59`;
  const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
  filterDateFrom.value = `${d30.getFullYear()}-${pad(d30.getMonth()+1)}-${pad(d30.getDate())}T00:00`;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(n)  { return Number(n || 0).toFixed(2); }
  function sarHtml(n, showSymbol = true) {
    return showSymbol
      ? `${fmt(n)} <span class="sar">&#xE900;</span>`
      : fmt(n);
  }
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtDT(dt) {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return String(dt); }
  }
  function fmtDate(dt) {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
    } catch { return String(dt); }
  }
  function showToast(msg, type = 'error') {
    const tc = document.getElementById('toastContainer');
    const t  = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<div class="toast-text">${escHtml(msg)}</div>`;
    tc.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 350); }, 3000);
  }
  function typeLabel(mv_type) {
    const map = {
      paid_invoice:       { ar: 'فاتورة مدفوعة',    cls: 'mv-paid'        },
      deferred_invoice:   { ar: 'فاتورة آجلة',       cls: 'mv-deferred'    },
      deferred_payment:   { ar: 'سداد آجل',          cls: 'mv-payment'     },
      subscription:       { ar: 'اشتراك',            cls: 'mv-subscription' },
      consumption:        { ar: 'إيصال استهلاك',     cls: 'mv-consumption' },
      consumption_refund: { ar: 'مرتجع إيصال',       cls: 'mv-refund'      },
      credit_note:        { ar: 'فاتورة دائنة',      cls: 'mv-credit'      },
    };
    const info = map[mv_type] || { ar: mv_type, cls: '' };
    return `<span class="mv-badge ${info.cls}">${escHtml(info.ar)}</span>`;
  }
  function customerTypeLabel(t) {
    const map = { individual: 'فرد', company: 'شركة', hotel: 'فندق' };
    return map[t] || t || 'فرد';
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  btnBack.addEventListener('click', () => { location.href = '/screens/reports/reports.html'; });

  // ── Customer search (debounced) ───────────────────────────────────────────
  customerSearch.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    const q = customerSearch.value.trim();
    if (!q) { customerDropdown.style.display = 'none'; return; }
    searchDebounceTimer = setTimeout(() => doCustomerSearch(q), 300);
  });
  customerSearch.addEventListener('focus', () => {
    if (customerSearch.value.trim()) doCustomerSearch(customerSearch.value.trim());
  });
  document.addEventListener('click', e => {
    if (!customerSearch.contains(e.target) && !customerDropdown.contains(e.target)) {
      customerDropdown.style.display = 'none';
    }
  });

  async function doCustomerSearch(q) {
    try {
      const res = await window.api.getCustomers({ search: q, noPagination: true });
      const list = res.customers || [];
      if (!list.length) {
        customerDropdown.innerHTML = `<div class="customer-dropdown-empty">لا توجد نتائج</div>`;
        customerDropdown.style.display = 'block';
        return;
      }
      customerDropdown.innerHTML = list.slice(0, 10).map(c => `
        <div class="customer-dropdown-item" data-id="${c.id}"
             data-name="${escHtml(c.customer_name)}"
             data-phone="${escHtml(c.phone || '')}"
             data-tax="${escHtml(c.tax_number || '')}"
             data-type="${escHtml(c.customer_type || 'individual')}">
          <div class="item-name">${escHtml(c.customer_name)}</div>
          <div class="item-phone">${escHtml(c.phone || '')}</div>
        </div>
      `).join('');
      customerDropdown.style.display = 'block';
      customerDropdown.querySelectorAll('.customer-dropdown-item').forEach(el => {
        el.addEventListener('click', () => {
          selectedCustomer = {
            id:            Number(el.dataset.id),
            customer_name: el.dataset.name,
            phone:         el.dataset.phone,
            tax_number:    el.dataset.tax,
            customer_type: el.dataset.type,
          };
          customerSearch.value = el.dataset.name;
          customerDropdown.style.display = 'none';
        });
      });
    } catch { /* silent */ }
  }

  // ── Apply filter button ───────────────────────────────────────────────────
  btnApplyFilter.addEventListener('click', loadReport);

  async function loadReport() {
    if (!selectedCustomer) {
      showToast('يرجى اختيار عميل أولاً');
      customerSearch.focus();
      return;
    }
    const dateFrom = filterDateFrom.value ? filterDateFrom.value + ':00' : null;
    const dateTo   = filterDateTo.value   ? filterDateTo.value   + ':00' : null;

    emptyPrompt.style.display    = 'none';
    reportContent.style.display  = 'none';
    loadingState.style.display   = 'flex';
    btnExcelExport.style.display = 'none';
    btnPdfExport.style.display   = 'none';

    try {
      const res = await window.api.getCustomerAccountStatement({
        customerId: selectedCustomer.id,
        dateFrom,
        dateTo,
      });
      loadingState.style.display = 'none';

      if (!res.success) {
        emptyMessage.textContent = res.message || 'حدث خطأ أثناء تحميل البيانات';
        emptyPrompt.style.display = 'flex';
        return;
      }

      reportData   = res;
      allMovements = res.movements || [];

      if (!allMovements.length) {
        emptyMessage.textContent = 'لا توجد حركات للعميل في هذه الفترة';
        emptyPrompt.style.display = 'flex';
        return;
      }

      renderCustomerInfoBar(selectedCustomer, dateFrom, dateTo);
      renderSummary(res.summary);
      renderSubscriptionSummary(res.subscriptionPeriods || []);
      renderMovementsTable(allMovements, res.summary.priorBalance);

      typeFilterWrap.style.display     = '';
      filterPaidWrap.style.display     = '';
      filterCleaningWrap.style.display = '';
      filterDeliveryWrap.style.display = '';
      filterMovementType.value         = 'all';
      filterPaid.value                 = 'all';
      filterCleaning.value             = 'all';
      filterDelivery.value             = 'all';
      reportContent.style.display      = 'block';
      btnExcelExport.style.display     = '';
      btnPdfExport.style.display       = '';

    } catch (err) {
      loadingState.style.display = 'none';
      emptyMessage.textContent = 'حدث خطأ: ' + (err.message || 'خطأ غير معروف');
      emptyPrompt.style.display = 'flex';
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  [filterMovementType, filterPaid, filterCleaning, filterDelivery].forEach(el => {
    el.addEventListener('change', () => { if (reportData) applyFilters(); });
  });

  function applyFilters() {
    const type     = filterMovementType.value;
    const paid     = filterPaid.value;
    const cleaning = filterCleaning.value;
    const delivery = filterDelivery.value;

    const filtered = allMovements.filter(m => {
      if (type !== 'all' && m.mv_type !== type) return false;
      if (paid !== 'all') {
        const hasPaid = !!m.paid_at;
        if (paid === 'yes' && !hasPaid) return false;
        if (paid === 'no'  &&  hasPaid) return false;
      }
      if (cleaning !== 'all') {
        const hasCleaning = !!m.cleaning_date;
        if (cleaning === 'yes' && !hasCleaning) return false;
        if (cleaning === 'no'  &&  hasCleaning) return false;
      }
      if (delivery !== 'all') {
        const hasDelivery = !!m.delivery_date;
        if (delivery === 'yes' && !hasDelivery) return false;
        if (delivery === 'no'  &&  hasDelivery) return false;
      }
      return true;
    });

    renderMovementsTable(filtered, reportData.summary.priorBalance);
    const totalDebit  = filtered.reduce((s, m) => s + m.debit,  0);
    const totalCredit = filtered.reduce((s, m) => s + m.credit, 0);
    const closing     = Math.round((reportData.summary.priorBalance + totalDebit - totalCredit) * 100) / 100;
    renderSummary({
      ...reportData.summary,
      totalDebit:     Math.round(totalDebit  * 100) / 100,
      totalCredit:    Math.round(totalCredit * 100) / 100,
      closingBalance: closing,
    });
  }

  // ── Render: customer info bar ─────────────────────────────────────────────
  function renderCustomerInfoBar(cust, from, to) {
    const fromStr = from ? fmtDT(from) : '—';
    const toStr   = to   ? fmtDT(to)   : '—';
    customerInfoBar.innerHTML = `
      <div class="cust-info-item">
        <span class="cust-info-label">العميل:</span>
        <span class="cust-info-value">${escHtml(cust.customer_name)}</span>
      </div>
      <div class="cust-info-item">
        <span class="cust-info-label">الجوال:</span>
        <span class="cust-info-value" dir="ltr">${escHtml(cust.phone || '—')}</span>
      </div>
      ${cust.tax_number ? `
      <div class="cust-info-item">
        <span class="cust-info-label">الرقم الضريبي:</span>
        <span class="cust-info-value" dir="ltr">${escHtml(cust.tax_number)}</span>
      </div>` : ''}
      <div class="cust-info-item">
        <span class="cust-type-badge">${escHtml(customerTypeLabel(cust.customer_type))}</span>
      </div>
      <div class="cust-info-item">
        <span class="cust-info-label">الفترة:</span>
        <span class="cust-info-value">${fromStr} — ${toStr}</span>
      </div>
    `;
  }

  // ── Render: summary cards ─────────────────────────────────────────────────
  function renderSummary(s) {
    const isDebt = s.closingBalance > 0;
    summaryGrid.innerHTML = `
      <div class="summary-card prior">
        <div class="summary-card-label">الرصيد السابق</div>
        <div class="summary-card-value">${sarHtml(s.priorBalance, false)}</div>
      </div>
      <div class="summary-card debit">
        <div class="summary-card-label">إجمالي المدين (على العميل)</div>
        <div class="summary-card-value">${sarHtml(s.totalDebit, false)}</div>
      </div>
      <div class="summary-card credit">
        <div class="summary-card-label">إجمالي الدائن (للعميل)</div>
        <div class="summary-card-value">${sarHtml(s.totalCredit, false)}</div>
      </div>
      <div class="summary-card deferred">
        <div class="summary-card-label">المديونية الآجلة الحالية</div>
        <div class="summary-card-value">${sarHtml(s.deferredOutstanding, false)}</div>
      </div>
      <div class="summary-card closing ${isDebt ? 'debt' : 'clear'}">
        <div class="summary-card-label">الرصيد الختامي</div>
        <div class="summary-card-value">${sarHtml(s.closingBalance, false)}</div>
        <div class="summary-card-label" style="font-size:10px;margin-top:2px">${isDebt ? '⚠ مديونية' : '✓ لا يوجد مديونية'}</div>
      </div>
    `;
  }

  // ── Render: subscription summary ─────────────────────────────────────────
  function renderSubscriptionSummary(periods) {
    if (!periods || !periods.length) {
      subscriptionSection.style.display = 'none';
      return;
    }
    subscriptionSection.style.display = '';
    subscriptionTableBody.innerHTML = periods.map(sp => {
      const statusCls = sp.status === 'active' ? 'sub-active' : 'sub-expired';
      const statusTxt = sp.status === 'active' ? 'نشط' : 'منتهٍ';
      return `
        <tr>
          <td><span class="sub-badge ${statusCls}">${statusTxt}</span></td>
          <td>${fmtDate(sp.period_from)}</td>
          <td>${sp.period_to ? fmtDate(sp.period_to) : '—'}</td>
          <td class="num-cell">${sarHtml(sp.total_value, false)}</td>
          <td class="num-cell">${sarHtml(sp.total_consumed, false)}</td>
          <td class="num-cell">${sarHtml(sp.credit_remaining, false)}</td>
        </tr>`;
    }).join('');
  }

  // ── Render: movements table ───────────────────────────────────────────────
  function renderMovementsTable(movements, priorBalance) {
    movementsBadge.textContent = movements.length;

    if (!movements.length) {
      movementsTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:#94a3b8">لا توجد حركات مطابقة للفلتر المختار</td></tr>`;
      movementsFooter.innerHTML = '';
      return;
    }

    let running = Number(priorBalance || 0);
    let totalD = 0, totalC = 0;

    movementsTableBody.innerHTML = movements.map(m => {
      const debit  = Number(m.debit  || 0);
      const credit = Number(m.credit || 0);
      running = Math.round((running + debit - credit) * 100) / 100;
      totalD += debit;
      totalC += credit;

      const isDebt   = running > 0;
      const balCls   = isDebt ? 'debt' : 'clear';

      const viewBtn = m.source_id
        ? `<button class="btn-view-doc" data-id="${m.source_id}" data-type="${escHtml(m.source_type || '')}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
           </button>`
        : '<span style="color:#cbd5e1">—</span>';
      const paidCell     = m.paid_at      ? `<span class="status-done" title="${fmtDT(m.paid_at)}">✓</span>`      : '<span class="status-none">—</span>';
      const cleaningCell = m.cleaning_date ? `<span class="status-done" title="${fmtDT(m.cleaning_date)}">✓</span>` : '<span class="status-none">—</span>';
      const deliveryCell = m.delivery_date ? `<span class="status-done" title="${fmtDT(m.delivery_date)}">✓</span>` : '<span class="status-none">—</span>';

      return `
        <tr>
          <td style="white-space:nowrap">${fmtDT(m.mv_date)}</td>
          <td>${typeLabel(m.mv_type)}</td>
          <td class="desc-cell" title="${escHtml(m.description)}">${escHtml(m.description)}</td>
          <td class="num-cell">${debit  > 0 ? sarHtml(debit,  false) : '<span style="color:#cbd5e1">—</span>'}</td>
          <td class="num-cell">${credit > 0 ? sarHtml(credit, false) : '<span style="color:#cbd5e1">—</span>'}</td>
          <td class="balance-cell ${balCls}">${sarHtml(running, false)}</td>
          <td class="status-cell">${paidCell}</td>
          <td class="status-cell">${cleaningCell}</td>
          <td class="status-cell">${deliveryCell}</td>
          <td class="view-cell">${viewBtn}</td>
        </tr>`;
    }).join('');

    // ربط أزرار العرض
    movementsTableBody.querySelectorAll('.btn-view-doc').forEach(btn => {
      btn.addEventListener('click', () => viewDocument(Number(btn.dataset.id), btn.dataset.type));
    });

    totalD = Math.round(totalD * 100) / 100;
    totalC = Math.round(totalC * 100) / 100;
    movementsFooter.innerHTML = `
      إجمالي المدين: <strong>${sarHtml(totalD, false)}</strong>
      &nbsp;|&nbsp;
      إجمالي الدائن: <strong>${sarHtml(totalC, false)}</strong>
      &nbsp;|&nbsp;
      الرصيد الختامي: <strong>${sarHtml(running, false)}</strong>
    `;
  }

  // ── View document – fullscreen iframe, same screen layout ─────────────────
  function viewDocument(sourceId, sourceType) {
    if (!sourceId) return;
    let src;
    if (sourceType === 'order') {
      localStorage.setItem('subscriptionViewOrderId', String(sourceId));
      src = '/screens/invoices/invoices.html';
    } else if (sourceType === 'consumption') {
      localStorage.setItem('viewReceiptId', String(sourceId));
      src = '/screens/consumption-receipts/consumption-receipts.html';
    } else {
      showToast('لا يوجد معاينة لهذا النوع');
      return;
    }

    const existing = document.getElementById('docViewerOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'docViewerOverlay';
    overlay.className = 'doc-viewer-overlay';
    overlay.innerHTML = `<iframe class="doc-viewer-iframe" src="${src}"></iframe>`;
    document.body.appendChild(overlay);

    // إغلاق عندما تُرسل الشاشة الداخلية إشارة الإغلاق
    function onMsg(e) {
      if (e.data === 'doc-viewer-close') {
        overlay.remove();
        window.removeEventListener('message', onMsg);
      }
    }
    window.addEventListener('message', onMsg);
  }

  // ── US2: PDF Export ───────────────────────────────────────────────────────
  btnPdfExport.addEventListener('click', async () => {
    if (!reportData || !selectedCustomer) return;
    btnPdfExport.disabled = true;
    const orig = btnPdfExport.innerHTML;
    btnPdfExport.innerHTML = '<span class="btn-label">جارٍ التصدير...</span>';
    try {
      const settings = await window.api.getAppSettings();
      const r = await window.api.exportCustomerAccountReport({
        type: 'pdf',
        customerId:    selectedCustomer.id,
        customerInfo:  selectedCustomer,
        dateFrom:      filterDateFrom.value ? filterDateFrom.value + ':00' : null,
        dateTo:        filterDateTo.value   ? filterDateTo.value   + ':00' : null,
        reportData,
        settings,
      });
      if (!r.success) showToast(r.message || 'فشل تصدير PDF');
      else showToast('تم تصدير PDF بنجاح', 'success');
    } catch (err) {
      showToast('فشل التصدير: ' + (err.message || ''));
    } finally {
      btnPdfExport.disabled = false;
      btnPdfExport.innerHTML = orig;
    }
  });

  // ── US2: Excel Export ─────────────────────────────────────────────────────
  btnExcelExport.addEventListener('click', async () => {
    if (!reportData || !selectedCustomer) return;
    btnExcelExport.disabled = true;
    const orig = btnExcelExport.innerHTML;
    btnExcelExport.innerHTML = '<span class="btn-label">جارٍ التصدير...</span>';
    try {
      const r = await window.api.exportCustomerAccountReport({
        type: 'excel',
        customerId:    selectedCustomer.id,
        customerInfo:  selectedCustomer,
        dateFrom:      filterDateFrom.value ? filterDateFrom.value + ':00' : null,
        dateTo:        filterDateTo.value   ? filterDateTo.value   + ':00' : null,
        reportData,
      });
      if (!r.success) showToast(r.message || 'فشل تصدير Excel');
      else showToast('تم تصدير Excel بنجاح', 'success');
    } catch (err) {
      showToast('فشل التصدير: ' + (err.message || ''));
    } finally {
      btnExcelExport.disabled = false;
      btnExcelExport.innerHTML = orig;
    }
  });
});
