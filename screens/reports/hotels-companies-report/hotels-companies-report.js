window.addEventListener('DOMContentLoaded', () => {
  // ── DOM refs ───────────────────────────────────────────────────────────────
  const btnBack          = document.getElementById('btnBack');
  const btnExcelExport   = document.getElementById('btnExcelExport');
  const btnPdfExport     = document.getElementById('btnPdfExport');
  const btnApplyFilter   = document.getElementById('btnApplyFilter');
  const customerSearch   = document.getElementById('customerSearch');
  const customerDropdown = document.getElementById('customerDropdown');
  const filterDateFrom   = document.getElementById('filterDateFrom');
  const filterDateTo     = document.getElementById('filterDateTo');
  const typeFilterWrap   = document.getElementById('typeFilterWrap');
  const statusFilterWrap = document.getElementById('statusFilterWrap');
  const filterDocType    = document.getElementById('filterDocType');
  const filterStatus     = document.getElementById('filterStatus');
  const loadingState     = document.getElementById('loadingState');
  const emptyPrompt      = document.getElementById('emptyPrompt');
  const emptyMessage     = document.getElementById('emptyMessage');
  const detailContent    = document.getElementById('detailContent');
  const summaryContent   = document.getElementById('summaryContent');
  const customerInfoBar  = document.getElementById('customerInfoBar');
  const summaryGrid      = document.getElementById('summaryGrid');
  const movementsBadge   = document.getElementById('movementsBadge');
  const movementsTableBody = document.getElementById('movementsTableBody');
  const companiesBadge   = document.getElementById('companiesBadge');
  const companiesTableBody = document.getElementById('companiesTableBody');
  const companiesTableFoot = document.getElementById('companiesTableFoot');
  const btnReset         = document.getElementById('btnReset');

  if (window.I18N && typeof window.I18N.apply === 'function') window.I18N.apply();
  if (window.I18N && typeof window.I18N.enableArabicPrint === 'function') window.I18N.enableArabicPrint();

  // ── State ───────────────────────────────────────────────────────────────────
  let selectedCustomer = null;   // { id, customer_name, phone, tax_number }
  let currentMode      = null;   // 'detail' | 'summary'
  let searchDebounce   = null;

  // ── Default dates: current month → now ──────────────────────────────────────
  const today = new Date();
  const pad   = x => String(x).padStart(2, '0');
  filterDateTo.value   = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}T23:59`;
  filterDateFrom.value = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01T00:00`;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function fmt(n) { return Number(n || 0).toFixed(2); }
  function sarHtml(n) { return `<span class="sar">&#xE900;</span> ${fmt(n)}`; }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtDT(dt) {
    if (!dt) return '—';
    try { const d = new Date(dt); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
    catch { return String(dt); }
  }
  function showToast(msg, type = 'error') {
    const tc = document.getElementById('toastContainer');
    const t  = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<div class="toast-text">${escHtml(msg)}</div>`;
    tc.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 350); }, 3000);
  }
  function getDates() {
    return {
      dateFrom: filterDateFrom.value ? filterDateFrom.value + ':00' : null,
      dateTo:   filterDateTo.value   ? filterDateTo.value   + ':00' : null,
    };
  }
  function t(k, fb) { return (window.I18N && window.I18N.t(k)) || fb || k; }

  function validRange() {
    const { dateFrom, dateTo } = getDates();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      showToast(t('hcr-date-range-err', 'نطاق التاريخ غير صحيح'));
      return false;
    }
    return true;
  }

  const woStatusLabels  = () => ({ pending: t('hcr-st-pending','في الانتظار'), invoiced: t('hcr-st-invoiced','مُفوتر'), cancelled: t('hcr-st-cancelled','ملغي') });
  const payStatusLabels = () => ({ paid: t('hcr-pay-paid','مدفوعة'), pending: t('hcr-pay-deferred','آجلة'), partial: t('hcr-pay-partial','جزئية') });
  function woStatusBadge(s) { const lbl = woStatusLabels(); return `<span class="st-badge st-${s === 'cancelled' ? 'cancelled' : (s === 'invoiced' ? 'invoiced' : 'pending')}">${escHtml(lbl[s] || s)}</span>`; }
  function payStatusBadge(s) { const lbl = payStatusLabels(); return `<span class="st-badge st-${s === 'paid' ? 'paid' : 'deferred'}">${escHtml(lbl[s] || s)}</span>`; }

  // ── Navigation ──────────────────────────────────────────────────────────────
  btnBack.addEventListener('click', () => { location.href = '/screens/reports/reports.html'; });

  // ── Customer search (debounced, corporate only) ─────────────────────────────
  customerSearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    selectedCustomer = null;   // clearing/editing resets the chosen customer
    const q = customerSearch.value.trim();
    if (!q) { customerDropdown.style.display = 'none'; return; }
    searchDebounce = setTimeout(() => doCustomerSearch(q), 300);
  });
  customerSearch.addEventListener('focus', () => {
    const q = customerSearch.value.trim();
    if (q) doCustomerSearch(q);
  });
  document.addEventListener('click', e => {
    if (!customerSearch.contains(e.target) && !customerDropdown.contains(e.target)) {
      customerDropdown.style.display = 'none';
    }
  });

  async function doCustomerSearch(q) {
    try {
      const res = await window.api.getCorporateCustomers({ search: q, pageSize: 50 });
      const list = (res && res.rows) || [];
      const filtered = list.filter(c =>
        (c.customer_name || '').includes(q) ||
        (c.phone || '').includes(q) ||
        (c.tax_number || '').includes(q)
      );
      const show = q ? (filtered.length ? filtered : list) : list;
      if (!show.length) {
        customerDropdown.innerHTML = `<div class="customer-dropdown-empty">${t('hcr-no-match','لا توجد شركات/فنادق مطابقة')}</div>`;
        customerDropdown.style.display = 'block';
        return;
      }
      customerDropdown.innerHTML = show.slice(0, 12).map(c => `
        <div class="customer-dropdown-item" data-id="${c.id}"
             data-name="${escHtml(c.customer_name)}"
             data-phone="${escHtml(c.phone || '')}"
             data-tax="${escHtml(c.tax_number || '')}">
          <div class="item-name">${escHtml(c.customer_name)}</div>
          <div class="item-phone">${escHtml(c.phone || '')}</div>
        </div>`).join('');
      customerDropdown.style.display = 'block';
      customerDropdown.querySelectorAll('.customer-dropdown-item').forEach(el => {
        el.addEventListener('click', () => {
          selectedCustomer = {
            id:            Number(el.dataset.id),
            customer_name: el.dataset.name,
            phone:         el.dataset.phone,
            tax_number:    el.dataset.tax,
          };
          customerSearch.value = el.dataset.phone || el.dataset.name;
          customerDropdown.style.display = 'none';
        });
      });
    } catch { /* silent */ }
  }

  // ── Apply / show ────────────────────────────────────────────────────────────
  btnApplyFilter.addEventListener('click', () => {
    if (!validRange()) return;
    if (selectedCustomer) loadDetail();
    else loadSummary();
  });

  function beforeLoad() {
    emptyPrompt.style.display    = 'none';
    detailContent.style.display  = 'none';
    summaryContent.style.display = 'none';
    loadingState.style.display   = 'flex';
    btnExcelExport.style.display = 'none';
    btnPdfExport.style.display   = 'none';
    typeFilterWrap.style.display   = 'none';
    statusFilterWrap.style.display = 'none';
  }
  function showEmptyMsg(msg) {
    loadingState.style.display = 'none';
    emptyMessage.textContent = msg;
    emptyPrompt.style.display = 'flex';
  }

  // ── Detail mode (single customer) ───────────────────────────────────────────
  async function loadDetail() {
    beforeLoad();
    const { dateFrom, dateTo } = getDates();
    try {
      const res = await window.api.getCorporateReportStatement({
        customerId: selectedCustomer.id, dateFrom, dateTo,
        docType: filterDocType.value, status: filterStatus.value,
      });
      loadingState.style.display = 'none';
      if (!res.success) { showEmptyMsg(res.message || t('hcr-load-err','حدث خطأ أثناء تحميل التقرير')); return; }

      currentMode = 'detail';
      const timeline = buildTimeline(res.workOrders || [], res.consolidatedInvoices || []);

      renderCustomerInfoBar(res.customer, res.dateFrom, res.dateTo);
      renderSummary(res.summary || {});

      if (!timeline.length) {
        movementsBadge.textContent = '0';
        movementsTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:#94a3b8">${t('hcr-no-movements','لا توجد حركات لهذا العميل في هذه الفترة')}</td></tr>`;
      } else {
        renderMovements(timeline);
      }

      typeFilterWrap.style.display   = '';
      statusFilterWrap.style.display = '';
      btnReset.style.display = '';
      detailContent.style.display  = 'block';
      btnExcelExport.style.display = '';
      btnPdfExport.style.display   = '';
    } catch (err) {
      showEmptyMsg(t('hcr-err-prefix','حدث خطأ:') + ' ' + (err.message || t('hcr-unknown-err','خطأ غير معروف')));
    }
  }

  function buildTimeline(workOrders, invoices) {
    const tl = [];
    workOrders.forEach(w => tl.push({
      kind:'wo', date:w.created_at, docNo:w.work_order_number,
      desc: w.consolidated_invoice_seq ? `${t('hcr-invoiced-with','مُفوتر بالفاتورة #')}${w.consolidated_invoice_seq}` : '—',
      status:w.status, statusHtml: woStatusBadge(w.status),
      subtotal:w.subtotal, discount:w.discount_amount, vat:w.vat_amount, total:w.total_amount,
      paid:null, outstanding:null,
    }));
    invoices.forEach(inv => tl.push({
      kind:'inv', date:inv.created_at, docNo:`${inv.invoice_seq}`,
      desc: (inv.work_order_numbers && inv.work_order_numbers.length) ? `${t('hcr-contains','يضم:')} ${inv.work_order_numbers.join('، ')}` : `${inv.work_orders_count || 0} ${t('hcr-wo-label','أمر تشغيل')}`,
      status:inv.payment_status, statusHtml: payStatusBadge(inv.payment_status),
      subtotal:inv.subtotal, discount:inv.discount_amount, vat:inv.vat_amount, total:inv.total_amount,
      paid:inv.paid_amount, outstanding:inv.remaining_amount,
    }));
    tl.sort((a, b) => new Date(a.date) - new Date(b.date));
    return tl;
  }

  function renderCustomerInfoBar(cust, from, to) {
    customerInfoBar.innerHTML = `
      <div class="cust-info-item"><span class="cust-info-label">${t('hcr-cust-label','العميل:')}</span><span class="cust-info-value">${escHtml(cust.customer_name)}</span></div>
      <div class="cust-info-item"><span class="cust-info-label">${t('hcr-phone-label','الجوال:')}</span><span class="cust-info-value" dir="ltr">${escHtml(cust.phone || '—')}</span></div>
      ${cust.tax_number
        ? `<div class="cust-info-item"><span class="cust-info-label">${t('hcr-vat-label','الرقم الضريبي:')}</span><span class="cust-info-value" dir="ltr">${escHtml(cust.tax_number)}</span></div>`
        : `<div class="cust-info-item"><span class="cust-no-vat">${t('hcr-no-vat','بدون رقم ضريبي')}</span></div>`}
      <div class="cust-info-item"><span class="cust-type-badge">${t('hcr-corp-badge','شركة / فندق')}</span></div>
      <div class="cust-info-item"><span class="cust-info-label">${t('hcr-period-label','الفترة:')}</span><span class="cust-info-value">${fmtDT(from)} — ${fmtDT(to)}</span></div>`;
  }

  function renderSummary(s) {
    summaryGrid.innerHTML = `
      <div class="summary-card ordered"><div class="summary-card-label">${t('hcr-sum-worked','إجمالي المُشغَّل')}</div><div class="summary-card-value">${sarHtml(s.totalWorkOrdered)}</div></div>
      <div class="summary-card invoiced"><div class="summary-card-label">${t('hcr-sum-invoiced','إجمالي المُفوتَر')}</div><div class="summary-card-value">${sarHtml(s.totalInvoiced)}</div></div>
      <div class="summary-card vat"><div class="summary-card-label">${t('hcr-sum-vat','إجمالي الضريبة')}</div><div class="summary-card-value">${sarHtml(s.totalVat)}</div></div>
      <div class="summary-card paid"><div class="summary-card-label">${t('hcr-sum-paid','إجمالي المدفوع')}</div><div class="summary-card-value">${sarHtml(s.totalPaid)}</div></div>
      <div class="summary-card outstanding"><div class="summary-card-label">${t('hcr-sum-outstanding','المستحق الآجل')}</div><div class="summary-card-value">${sarHtml(s.totalOutstanding)}</div></div>
      <div class="summary-card counts"><div class="summary-card-label">${t('hcr-sum-counts','أوامر / فواتير')}${s.cancelledCount ? ' (' + t('hcr-sum-cancelled','ملغية:') + ' ' + s.cancelledCount + ')' : ''}</div><div class="summary-card-value">${s.workOrdersCount || 0} / ${s.invoicesCount || 0}</div></div>`;
  }

  function renderMovements(timeline) {
    movementsBadge.textContent = timeline.length;
    movementsTableBody.innerHTML = timeline.map(row => {
      const outClr = Number(row.outstanding || 0) > 0 ? 'debt' : 'clear';
      return `<tr class="${row.status === 'cancelled' ? 'row-cancelled' : ''}">
        <td style="white-space:nowrap">${fmtDT(row.date)}</td>
        <td><span class="doc-badge ${row.kind === 'wo' ? 'doc-wo' : 'doc-inv'}">${row.kind === 'wo' ? t('hcr-doc-wo','أمر تشغيل') : t('hcr-doc-inv','فاتورة مجمعة')}</span></td>
        <td class="doc-cell">${escHtml(row.docNo)}</td>
        <td>${row.statusHtml}</td>
        <td class="num-cell">${sarHtml(row.subtotal)}</td>
        <td class="num-cell">${sarHtml(row.discount)}</td>
        <td class="num-cell">${sarHtml(row.vat)}</td>
        <td class="num-cell">${sarHtml(row.total)}</td>
        <td class="paid-cell">${row.paid == null ? '—' : sarHtml(row.paid)}</td>
        <td class="outstanding-cell ${outClr}">${row.outstanding == null ? '—' : sarHtml(row.outstanding)}</td>
      </tr>`;
    }).join('');
  }

  // ── Filters (detail mode) ───────────────────────────────────────────────────
  [filterDocType, filterStatus].forEach(el => {
    el.addEventListener('change', () => { if (currentMode === 'detail' && selectedCustomer) loadDetail(); });
  });
  btnReset.addEventListener('click', () => {
    filterDocType.value = 'all';
    filterStatus.value  = 'all';
    if (selectedCustomer) loadDetail();
  });

  // ── Summary mode (all companies) ────────────────────────────────────────────
  async function loadSummary() {
    beforeLoad();
    const { dateFrom, dateTo } = getDates();
    try {
      const res = await window.api.getCorporateReportSummary({ dateFrom, dateTo });
      loadingState.style.display = 'none';
      if (!res.success) { showEmptyMsg(res.message || t('hcr-load-err','حدث خطأ أثناء تحميل التقرير')); return; }

      currentMode = 'summary';
      const rows = res.rows || [];
      companiesBadge.textContent = rows.length;

      if (!rows.length) {
        companiesTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8">${t('hcr-no-companies','لا توجد فنادق/شركات نشطة في هذه الفترة')}</td></tr>`;
        companiesTableFoot.innerHTML = '';
      } else {
        companiesTableBody.innerHTML = rows.map(r => {
          const outClr = Number(r.total_outstanding || 0) > 0 ? 'debt' : 'clear';
          return `<tr data-id="${r.id}" data-name="${escHtml(r.customer_name)}" data-tax="${escHtml(r.tax_number || '')}">
            <td><strong>${escHtml(r.customer_name)}</strong></td>
            <td class="doc-cell">${r.tax_number ? escHtml(r.tax_number) : '—'}</td>
            <td class="num-cell">${r.wo_count || 0}</td>
            <td class="num-cell">${sarHtml(r.total_work_ordered)}</td>
            <td class="num-cell">${r.inv_count || 0}</td>
            <td class="num-cell">${sarHtml(r.total_invoiced)}</td>
            <td class="paid-cell">${sarHtml(r.total_paid)}</td>
            <td class="outstanding-cell ${outClr}">${sarHtml(r.total_outstanding)}</td>
          </tr>`;
        }).join('');

        const totals = res.totals || {};
        companiesTableFoot.innerHTML = `<tr>
          <td class="label-cell" colspan="2">${t('hcr-grand-total','الإجمالي الكلي')}</td>
          <td>${totals.wo_count || 0}</td>
          <td>${sarHtml(totals.total_work_ordered)}</td>
          <td>${totals.inv_count || 0}</td>
          <td>${sarHtml(totals.total_invoiced)}</td>
          <td>${sarHtml(totals.total_paid)}</td>
          <td>${sarHtml(totals.total_outstanding)}</td>
        </tr>`;

        companiesTableBody.querySelectorAll('tr[data-id]').forEach(tr => {
          tr.addEventListener('click', () => {
            selectedCustomer = {
              id:            Number(tr.dataset.id),
              customer_name: tr.dataset.name,
              phone:         '',
              tax_number:    tr.dataset.tax,
            };
            customerSearch.value = tr.dataset.name;
            filterDocType.value = 'all';
            filterStatus.value  = 'all';
            loadDetail();
          });
        });
      }

      summaryContent.style.display = 'block';
      btnExcelExport.style.display = '';
      btnPdfExport.style.display   = '';
    } catch (err) {
      showEmptyMsg(t('hcr-err-prefix','حدث خطأ:') + ' ' + (err.message || t('hcr-unknown-err','خطأ غير معروف')));
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  async function doExport(exportType) {
    if (!currentMode) { showToast(t('hcr-export-first','اعرض التقرير أولاً')); return; }
    const { dateFrom, dateTo } = getDates();
    btnExcelExport.disabled = true;
    btnPdfExport.disabled = true;
    try {
      const payload = currentMode === 'detail'
        ? { type: exportType, mode: 'detail', customerId: selectedCustomer.id, dateFrom, dateTo, docType: filterDocType.value, status: filterStatus.value }
        : { type: exportType, mode: 'summary', dateFrom, dateTo };
      const res = await window.api.exportHotelsCompaniesReport(payload);
      if (!res || !res.success) showToast((res && res.message) || t('hcr-export-fail','فشل التصدير'));
      else showToast(t('hcr-export-success','تم التصدير بنجاح'), 'success');
    } catch (err) {
      showToast(t('hcr-export-fail-prefix','فشل التصدير:') + ' ' + (err.message || t('hcr-unknown-err','خطأ غير معروف')));
    } finally {
      btnExcelExport.disabled = false;
      btnPdfExport.disabled = false;
    }
  }
  btnExcelExport.addEventListener('click', () => doExport('excel'));
  btnPdfExport.addEventListener('click', () => doExport('pdf'));
});
