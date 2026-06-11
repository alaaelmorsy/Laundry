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
    viewingReceiptNum: null,
    viewingOrderId: null
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
    btnCrExportPdf: document.getElementById('btnCrExportPdf'),
    btnCrPrint: document.getElementById('btnCrPrint'),
    btnCrMarkCleaned: document.getElementById('btnCrMarkCleaned'),
    btnCrMarkDelivered: document.getElementById('btnCrMarkDelivered'),
    crCleanedAtRow: document.getElementById('crCleanedAtRow'),
    crCleanedAt: document.getElementById('crCleanedAt'),
    crDeliveredAtRow: document.getElementById('crDeliveredAtRow'),
    crDeliveredAt: document.getElementById('crDeliveredAt')
  };

  function fmtLtr(n) { return Number(n || 0).toFixed(2); }
  function sarFmt(n) { return `${fmtLtr(n)} <span class="sar">&#xE900;</span>`; }
  function sarFmtModal(n) { return `<span class="sar">&#xE900;</span> ${fmtLtr(n)}`; }
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
    const h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(h12)}:${p(d.getMinutes())} ${ampm}`;
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
    els.tableBody.innerHTML = state.receipts.map((r) => {
      const refundBadge = r.refund_id
        ? ` <span class="badge-refunded" style="background-color: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: 6px; display: inline-block; border: 1px solid #fca5a5;">مرتجع</span>`
        : '';
      return `
      <tr>
        <td class="cr-num-cell">${escHtml(formatConsumptionReceiptNum(r.receipt_seq))}${refundBadge}</td>
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
      </tr>`;
    }).join('');

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
    
    const taxEl = document.getElementById('crShopTax');
    const taxRow = document.getElementById('crShopTaxRow');
    if (taxEl && taxRow) {
      if (s.vatNumber) { taxEl.textContent = 'الرقم الضريبي: ' + s.vatNumber; taxRow.style.display = ''; }
      else taxRow.style.display = 'none';
    }
    const crEl = document.getElementById('crShopCr');
    const crRow = document.getElementById('crShopCrRow');
    if (crEl && crRow) {
      if (s.commercialRegister) { crEl.textContent = 'السجل التجاري: ' + s.commercialRegister; crRow.style.display = ''; }
      else crRow.style.display = 'none';
    }

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

    // Handle refund mode vs consumption mode display
    const titleEl = document.querySelector('#receiptViewModal .cr-receipt-title');
    const refundNumRow = document.getElementById('crRefundNumRow');
    const refundReasonRow = document.getElementById('crRefundReasonRow');
    const amountLabel = document.getElementById('crAmountLabel');
    const balBeforeLabel = document.getElementById('crBalBeforeLabel');
    const balAfterLabel = document.getElementById('crBalAfterLabel');

    if (r.refund_id) {
      if (titleEl) titleEl.textContent = 'مرتجع / REFUND';
      if (refundNumRow) {
        refundNumRow.style.display = '';
        document.getElementById('crRefundNum').textContent = 'C-' + Number(r.receipt_seq);
      }
      if (refundReasonRow) {
        if (r.refund_reason) {
          refundReasonRow.style.display = '';
          document.getElementById('crRefundReason').textContent = r.refund_reason;
        } else {
          refundReasonRow.style.display = 'none';
        }
      }
      if (amountLabel) amountLabel.textContent = 'المبلغ المسترجع';
      if (balBeforeLabel) balBeforeLabel.textContent = 'الرصيد قبل الإرجاع';
      if (balAfterLabel) balAfterLabel.textContent = 'الرصيد بعد الإرجاع';

      document.getElementById('crConsumed').innerHTML = sarFmtModal(r.refund_amount || r.amount_consumed);
      document.getElementById('crBalBefore').innerHTML = sarFmtModal(r.refund_old_balance != null ? r.refund_old_balance : r.balance_before);
      document.getElementById('crBalAfter').innerHTML = sarFmtModal(r.refund_new_balance != null ? r.refund_new_balance : r.balance_after);

      state.viewingReceiptNum = 'C-' + Number(r.receipt_seq);
    } else {
      if (titleEl) titleEl.textContent = 'إيصال استهلاك';
      if (refundNumRow) refundNumRow.style.display = 'none';
      if (refundReasonRow) refundReasonRow.style.display = 'none';
      if (amountLabel) amountLabel.textContent = 'المبلغ المستهلك';
      if (balBeforeLabel) balBeforeLabel.textContent = 'الرصيد قبل';
      if (balAfterLabel) balAfterLabel.textContent = 'الرصيد بعد';

      document.getElementById('crConsumed').innerHTML = sarFmtModal(r.amount_consumed);
      document.getElementById('crBalBefore').innerHTML = sarFmtModal(r.balance_before);
      document.getElementById('crBalAfter').innerHTML = sarFmtModal(r.balance_after);
    }

    let items = r.items;
    state.viewingOrderId = r.order_id || null;
    const isRefunded = !!r.refund_id;

    // تاريخ التنظيف/التسليم — أولاً من الإيصال نفسه، ثم من الطلب
    const cleanDate = r.cleaning_date || null;
    const deliverDate = r.delivery_date || null;

    const showCleanDate = (date) => {
      if (els.crCleanedAt) els.crCleanedAt.textContent = formatDateTime(date);
      if (els.crCleanedAtRow) els.crCleanedAtRow.style.display = '';
    };
    const showDeliverDate = (date) => {
      if (els.crDeliveredAt) els.crDeliveredAt.textContent = formatDateTime(date);
      if (els.crDeliveredAtRow) els.crDeliveredAtRow.style.display = '';
    };

    if (cleanDate) {
      showCleanDate(cleanDate);
    } else {
      if (els.crCleanedAtRow) els.crCleanedAtRow.style.display = 'none';
    }
    if (deliverDate) {
      showDeliverDate(deliverDate);
    } else {
      if (els.crDeliveredAtRow) els.crDeliveredAtRow.style.display = 'none';
    }

    if (r.order_id) {
      try {
        const orderRes = await window.api.getOrderById({ id: r.order_id });
        if (orderRes && orderRes.success) {
          if (orderRes.items && orderRes.items.length) {
            items = orderRes.items.map((it) => ({
              productNameAr: it.product_name_ar,
              productNameEn: it.product_name_en,
              serviceNameAr: it.service_name_ar,
              serviceNameEn: it.service_name_en,
              quantity: it.quantity,
              lineTotal: it.line_total
            }));
          }
          const ord = orderRes.order || null;
          // استخدم تاريخ الطلب فقط إذا لم يكن للإيصال تاريخ خاص به
          if (!cleanDate && ord && ord.cleaning_date) showCleanDate(ord.cleaning_date);
          if (!deliverDate && ord && ord.delivery_date) showDeliverDate(ord.delivery_date);
        }
      } catch (_) {}
    } else {
      if (els.crCleanedAtRow) els.crCleanedAtRow.style.display = 'none';
      if (els.crDeliveredAtRow) els.crDeliveredAtRow.style.display = 'none';
    }
    fixCrInfoGrid();
    document.getElementById('crItemsBody').innerHTML = buildItemsHtml(items);

    // Barcode
    const crBarcodeWrap = document.getElementById('crBarcodeWrap');
    const crBarcode = document.getElementById('crBarcode');
    if (crBarcode && typeof JsBarcode !== 'undefined' && r.receipt_seq && !r.refund_id) {
      try {
        JsBarcode(crBarcode, 'C-' + r.receipt_seq, {
          format: 'CODE128', displayValue: true, fontSize: 11,
          height: 40, margin: 4, background: 'transparent'
        });
        if (crBarcodeWrap) crBarcodeWrap.style.display = '';
      } catch (_) {
        if (crBarcodeWrap) crBarcodeWrap.style.display = 'none';
      }
    } else {
      if (crBarcodeWrap) crBarcodeWrap.style.display = 'none';
      if (crBarcode) crBarcode.innerHTML = '';
    }

    els.receiptViewModal.style.display = 'flex';
  }

  function fixCrInfoGrid() {
    const grid = document.querySelector('#crPaper .cr-info-grid');
    if (!grid) return;
    const cells = Array.from(grid.querySelectorAll('.cr-info-cell'));
    cells.forEach(c => { c.style.gridColumn = ''; });
  }

  function printReceipt() {
    var copies = 1;
    if (state.appSettings && state.appSettings.printCopies) {
      const c = Number(state.appSettings.printCopies);
      if (Number.isFinite(c) && c > 0) copies = Math.floor(c);
    }
    if (copies > 20) copies = 20;

    // نسخ محتوى الإيصال لـ print zone للتوافق مع متصفحات الجوال
    var paperEl = document.getElementById('crPaper');
    var printZone = document.getElementById('invPrintZone');
    if (paperEl && printZone) {
      printZone.innerHTML = paperEl.outerHTML;
      printZone.style.setProperty('display', 'block', 'important');
    }

    var currentCopy = 0;
    function printNext() {
      if (currentCopy >= copies) {
        if (printZone) printZone.innerHTML = '';
        return;
      }
      currentCopy += 1;
      var handled = false;
      function afterPrint() {
        if (handled) return;
        handled = true;
        window.removeEventListener('afterprint', afterPrint);
        if (currentCopy < copies) {
          setTimeout(printNext, 120);
        } else {
          if (printZone) {
            printZone.innerHTML = '';
            printZone.style.setProperty('display', 'none', 'important');
          }
        }
      }
      window.addEventListener('afterprint', afterPrint);
      window.print();
      setTimeout(afterPrint, 2500);
    }
    printNext();
  }

  function bindEvents() {
    els.btnBack.addEventListener('click', () => window.api.navigateBack());
    els.btnCrClose.addEventListener('click', () => { els.receiptViewModal.style.display = 'none'; });
    if (els.btnCrMarkCleaned) {
      els.btnCrMarkCleaned.addEventListener('click', async () => {
        if (!state.viewingOrderId) return;
        try {
          els.btnCrMarkCleaned.disabled = true;
          await window.api.markOrderCleaned({ orderId: state.viewingOrderId });
          const now = formatDateTime(new Date().toISOString());
          els.crCleanedAt.textContent = now;
          els.crCleanedAtRow.style.display = '';
          els.btnCrMarkCleaned.style.display = 'none';
        } catch (e) {
          alert(e.message || 'فشل تحديث حالة التنظيف');
          els.btnCrMarkCleaned.disabled = false;
        }
      });
    }
    if (els.btnCrMarkDelivered) {
      els.btnCrMarkDelivered.addEventListener('click', async () => {
        if (!state.viewingOrderId) return;
        try {
          els.btnCrMarkDelivered.disabled = true;
          await window.api.markOrderDelivered({ orderId: state.viewingOrderId });
          const now = formatDateTime(new Date().toISOString());
          els.crDeliveredAt.textContent = now;
          els.crDeliveredAtRow.style.display = '';
          fixCrInfoGrid();
          els.btnCrMarkDelivered.style.display = 'none';
        } catch (e) {
          alert(e.message || 'فشل تحديث حالة التسليم');
          els.btnCrMarkDelivered.disabled = false;
        }
      });
    }
    if (els.btnCrPrint) {
      els.btnCrPrint.addEventListener('click', () => {
        printReceipt();
      });
    }
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
