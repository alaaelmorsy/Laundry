(function () {
  'use strict';

  const state = {
    receipts: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    search: '',
    dateFrom: '',
    dateTo: '',
    searchTimer: null,
    appSettings: null,
    viewingReceiptNum: null
  };

  const els = {
    btnBack: document.getElementById('btnBack'),
    searchInput: document.getElementById('searchInput'),
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
    tableBody: document.getElementById('receiptsTableBody'),
    emptyState: document.getElementById('emptyState'),
    paginationBar: document.getElementById('paginationBar'),
    paginationInfo: document.getElementById('paginationInfo'),
    pageNumbers: document.getElementById('pageNumbers'),
    btnFirstPage: document.getElementById('btnFirstPage'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    btnLastPage: document.getElementById('btnLastPage'),
    pageSizeSelect: document.getElementById('pageSizeSelect'),
    receiptViewModal: document.getElementById('receiptViewModal'),
    btnCrClose: document.getElementById('btnCrClose'),
    btnCrExportPdf: document.getElementById('btnCrExportPdf')
  };

  function fmtLtr(n) { return Number(n || 0).toFixed(2); }
  function sarFmt(n) { return `<span class="sar">&#xE900;</span> ${fmtLtr(n)}`; }
  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function formatConsumptionReceiptNum(seq) {
    return 'C-' + (Number(seq) || 1);
  }
  function formatSubscriptionDisplayNum(val) {
    if (val == null || String(val).trim() === '') return '—';
    const s = String(val).trim();
    const m = s.match(/(\d+)\s*$/);
    if (m) return String(Number(m[1]));
    const n = Number(s.replace(/\D/g, ''));
    return Number.isNaN(n) ? s : String(n);
  }
  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function buildItemsHtml(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      return '<tr><td class="inv-td-name">—</td><td class="inv-td-num">—</td><td class="inv-td-amt">—</td><td class="inv-td-name">—</td></tr>';
    }
    return list.map((it) => {
      const nameAr = escHtml(it.productNameAr || it.product_name_ar || it.name || '');
      const nameEn = escHtml(it.productNameEn || it.product_name_en || '');
      const svcAr = escHtml(it.serviceNameAr || it.service_name_ar || it.service || '');
      const svcEn = escHtml(it.serviceNameEn || it.service_name_en || '');
      const productCell = nameAr
        + (nameEn && nameEn !== nameAr ? '<br><span class="inv-td-en">' + nameEn + '</span>' : '');
      const serviceCell = svcAr
        + (svcEn && svcEn !== svcAr ? '<br><span class="inv-td-en">' + svcEn + '</span>' : '');
      const qty = it.qty != null ? it.qty : (it.quantity != null ? it.quantity : 1);
      const line = it.lineTotal != null ? it.lineTotal : (it.line_total != null ? it.line_total : 0);
      return '<tr>'
        + '<td class="inv-td-name">' + (productCell || '—') + '</td>'
        + '<td class="inv-td-num">' + qty + '</td>'
        + '<td class="inv-td-amt">' + fmtLtr(line) + '</td>'
        + '<td class="inv-td-name">' + (svcAr ? serviceCell : '—') + '</td>'
        + '</tr>';
    }).join('');
  }

  async function loadReceipts() {
    const res = await window.api.getConsumptionReceipts({
      page: state.page,
      pageSize: state.pageSize,
      search: state.search,
      dateFrom: state.dateFrom || null,
      dateTo: state.dateTo || null
    });
    if (!res || !res.success) {
      els.tableBody.innerHTML = `<tr><td colspan="10" class="loading-cell" style="color:#b91c1c">${escHtml(res && res.message ? res.message : 'خطأ')}</td></tr>`;
      return;
    }
    state.receipts = res.receipts || [];
    state.total = res.total || 0;
    state.totalPages = res.totalPages || 1;
    renderTable();
    renderPagination();
  }

  function renderTable() {
    if (!state.receipts.length) {
      els.tableBody.innerHTML = '';
      els.emptyState.style.display = 'flex';
      els.paginationBar.style.display = 'none';
      return;
    }
    els.emptyState.style.display = 'none';
    els.paginationBar.style.display = 'flex';
    els.tableBody.innerHTML = state.receipts.map((r) => `
      <tr>
        <td class="cr-num-cell">${escHtml(formatConsumptionReceiptNum(r.receipt_seq))}</td>
        <td>${escHtml(r.customer_name || '—')}</td>
        <td dir="ltr">${escHtml(r.phone || '—')}</td>
        <td>${escHtml(formatSubscriptionDisplayNum(r.subscription_number || r.subscription_ref))}</td>
        <td>${escHtml(r.package_name || '—')}</td>
        <td class="amount-cell">${sarFmt(r.amount_consumed)}</td>
        <td>${sarFmt(r.balance_before)}</td>
        <td>${sarFmt(r.balance_after)}</td>
        <td>${escHtml(formatDateTime(r.created_at))}</td>
        <td>
          <button type="button" class="action-btn btn-view" data-id="${r.id}" title="عرض">عرض</button>
        </td>
      </tr>`).join('');

    els.tableBody.querySelectorAll('.btn-view').forEach((btn) => {
      btn.addEventListener('click', () => openReceipt(Number(btn.dataset.id)));
    });
  }

  function renderPagination() {
    const start = (state.page - 1) * state.pageSize + 1;
    const end = Math.min(state.page * state.pageSize, state.total);
    els.paginationInfo.textContent = state.total
      ? `${start}–${end} ${I18N.t('subscriptions-pagination-of')} ${state.total}`
      : '0';
    els.btnFirstPage.disabled = state.page <= 1;
    els.btnPrevPage.disabled = state.page <= 1;
    els.btnNextPage.disabled = state.page >= state.totalPages;
    els.btnLastPage.disabled = state.page >= state.totalPages;
  }

  async function openReceipt(id) {
    const res = await window.api.getConsumptionReceiptById({ id });
    if (!res || !res.success || !res.receipt) return;
    const r = res.receipt;
    const s = state.appSettings || {};

    const shopName = s.laundryNameAr || s.laundryNameEn || '';
    document.getElementById('crShopName').textContent = shopName;
    document.getElementById('crShopAddress').textContent = s.locationAr || s.locationEn || '';
    document.getElementById('crShopPhone').textContent = s.phone ? 'هاتف: ' + s.phone : '';
    const logoWrap = document.getElementById('crLogoWrap');
    const logo = document.getElementById('crLogo');
    if (s.logoDataUrl && logo) {
      logo.src = s.logoDataUrl;
      logoWrap.style.display = '';
    } else if (logoWrap) logoWrap.style.display = 'none';

    state.viewingReceiptNum = formatConsumptionReceiptNum(r.receipt_seq);
    document.getElementById('crReceiptNum').textContent = state.viewingReceiptNum;
    document.getElementById('crDate').textContent = formatDateTime(r.created_at);
    document.getElementById('crCustomer').textContent = r.customer_name || '—';
    document.getElementById('crPhone').textContent = r.phone || '—';
    document.getElementById('crSubRef').textContent = formatSubscriptionDisplayNum(r.subscription_number);
    document.getElementById('crPackage').textContent = r.package_name || '—';
    document.getElementById('crConsumed').innerHTML = sarFmt(r.amount_consumed);
    document.getElementById('crBalBefore').innerHTML = sarFmt(r.balance_before);
    document.getElementById('crBalAfter').innerHTML = sarFmt(r.balance_after);

    let items = r.items;
    if (r.order_id) {
      try {
        const orderRes = await window.api.getOrderById({ id: r.order_id });
        if (orderRes && orderRes.success && orderRes.items && orderRes.items.length) {
          items = orderRes.items.map((it) => ({
            productNameAr: it.product_name_ar,
            productNameEn: it.product_name_en,
            serviceNameAr: it.service_name_ar,
            serviceNameEn: it.service_name_en,
            quantity: it.quantity,
            lineTotal: it.line_total
          }));
        }
      } catch (_) {}
    }
    document.getElementById('crItemsBody').innerHTML = buildItemsHtml(items);

    els.receiptViewModal.style.display = 'flex';
  }

  function bindEvents() {
    els.btnBack.addEventListener('click', () => window.api.navigateBack());
    els.btnCrClose.addEventListener('click', () => { els.receiptViewModal.style.display = 'none'; });
    if (els.btnCrExportPdf) {
      els.btnCrExportPdf.addEventListener('click', async () => {
        const paperEl = document.getElementById('crPaper');
        if (!paperEl) return;
        try {
          els.btnCrExportPdf.disabled = true;
          els.btnCrExportPdf.innerHTML = '<span>جارٍ التصدير...</span>';
          const paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
          const result = await window.api.exportInvoicePdfFromHtml({
            html: paperEl.outerHTML,
            paperType,
            orderNum: state.viewingReceiptNum || 'consumption'
          });
          if (result.success) {
            alert(I18N.t('invoices-export-success') || 'تم تنزيل PDF');
          } else {
            alert(result.message || 'فشل التصدير');
          }
        } catch (_) {
          alert('فشل التصدير');
        } finally {
          els.btnCrExportPdf.disabled = false;
          els.btnCrExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>تصدير PDF</span>';
        }
      });
    }
    els.searchInput.addEventListener('input', () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => {
        state.search = els.searchInput.value.trim();
        state.page = 1;
        loadReceipts();
      }, 350);
    });
    [els.dateFrom, els.dateTo].forEach((inp) => {
      inp.addEventListener('change', () => {
        state.dateFrom = els.dateFrom.value;
        state.dateTo = els.dateTo.value;
        state.page = 1;
        loadReceipts();
      });
    });
    els.pageSizeSelect.addEventListener('change', () => {
      state.pageSize = Number(els.pageSizeSelect.value) || 50;
      state.page = 1;
      loadReceipts();
    });
    els.btnFirstPage.addEventListener('click', () => { state.page = 1; loadReceipts(); });
    els.btnPrevPage.addEventListener('click', () => { if (state.page > 1) { state.page--; loadReceipts(); } });
    els.btnNextPage.addEventListener('click', () => { if (state.page < state.totalPages) { state.page++; loadReceipts(); } });
    els.btnLastPage.addEventListener('click', () => { state.page = state.totalPages; loadReceipts(); });
  }

  window.addEventListener('DOMContentLoaded', async () => {
    I18N.apply();
    bindEvents();
    const settingsRes = await window.api.getAppSettings();
    if (settingsRes && settingsRes.success) state.appSettings = settingsRes.settings || settingsRes;
    await loadReceipts();
  });
})();
