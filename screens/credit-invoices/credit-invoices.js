(function () {
  'use strict';

  /* ========== STATE ========== */
  const state = {
    creditNotes: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    search: '',
    dateFrom: '',
    dateTo: '',
    searchTimer: null,
    appSettings: null,
    viewingOrderId: null,
    lastA4Data: null,
    activePrintTarget: null,
  };

  /* ========== DOM REFS ========== */
  const els = {
    btnBack: document.getElementById('btnBack'),
    searchInput: document.getElementById('searchInput'),
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
    btnDateFilter: document.getElementById('btnDateFilter'),
    btnDateClear: document.getElementById('btnDateClear'),
    btnExportExcel: document.getElementById('btnExportExcel'),
    btnExportPdf: document.getElementById('btnExportPdf'),
    tableBody: document.getElementById('cnTableBody'),
    emptyState: document.getElementById('emptyState'),
    paginationBar: document.getElementById('paginationBar'),
    paginationInfo: document.getElementById('paginationInfo'),
    pageNumbers: document.getElementById('pageNumbers'),
    btnFirstPage: document.getElementById('btnFirstPage'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    btnLastPage: document.getElementById('btnLastPage'),
    pageSizeSelect: document.getElementById('pageSizeSelect'),

    /* Original invoice modal */
    invoiceViewModal: document.getElementById('invoiceViewModal'),
    btnInvPrint: document.getElementById('btnInvPrint'),
    btnInvExportPdf: document.getElementById('btnInvExportPdf'),
    btnInvClose: document.getElementById('btnInvClose'),
    invLogoWrap: document.getElementById('invLogoWrap'),
    invLogo: document.getElementById('invLogo'),
    invShopName: document.getElementById('invShopName'),
    invShopAddress: document.getElementById('invShopAddress'),
    invShopPhone: document.getElementById('invShopPhone'),
    invShopEmail: document.getElementById('invShopEmail'),
    invVatNumber: document.getElementById('invVatNumber'),
    invCRRow: document.getElementById('invCRRow'),
    invCR: document.getElementById('invCR'),
    invOrderNum: document.getElementById('invOrderNum'),
    invDate: document.getElementById('invDate'),
    invCreatedByRow: document.getElementById('invCreatedByRow'),
    invCreatedBy: document.getElementById('invCreatedBy'),
    invCustomerSection: document.getElementById('invCustomerSection'),
    invCustNameRow: document.getElementById('invCustNameRow'),
    invCustName: document.getElementById('invCustName'),
    invCustPhoneRow: document.getElementById('invCustPhoneRow'),
    invCustPhone: document.getElementById('invCustPhone'),
    invSubBalRow: document.getElementById('invSubBalRow'),
    invSubBalance: document.getElementById('invSubBalance'),
    invItemsTbody: document.getElementById('invItemsTbody'),
    invSubtotalLabel: document.getElementById('invSubtotalLabel'),
    invSubtotal: document.getElementById('invSubtotal'),
    invDiscRow: document.getElementById('invDiscRow'),
    invDiscount: document.getElementById('invDiscount'),
    invExtraRow: document.getElementById('invExtraRow'),
    invExtra: document.getElementById('invExtra'),
    invVatRow: document.getElementById('invVatRow'),
    invVatLabel: document.getElementById('invVatLabel'),
    invVat: document.getElementById('invVat'),
    invTotalLabel: document.getElementById('invTotalLabel'),
    invTotal: document.getElementById('invTotal'),
    invMixedCashRow: document.getElementById('invMixedCashRow'),
    invMixedCardRow: document.getElementById('invMixedCardRow'),
    invMixedCash: document.getElementById('invMixedCash'),
    invMixedCard: document.getElementById('invMixedCard'),
    invPaidRow: document.getElementById('invPaidRow'),
    invRemainingRow: document.getElementById('invRemainingRow'),
    invPaidAmount: document.getElementById('invPaidAmount'),
    invRemainingAmount: document.getElementById('invRemainingAmount'),
    invPayment: document.getElementById('invPayment'),
    invPaidAtRow: document.getElementById('invPaidAtRow'),
    invPaidAt: document.getElementById('invPaidAt'),
    invCleanedAtRow: document.getElementById('invCleanedAtRow'),
    invCleanedAt: document.getElementById('invCleanedAt'),
    invDeliveredAtRow: document.getElementById('invDeliveredAtRow'),
    invDeliveredAt: document.getElementById('invDeliveredAt'),
    invQR: document.getElementById('invQR'),

    /* Credit note modal */
    cnViewModal: document.getElementById('cnViewModal'),
    btnCnClose: document.getElementById('btnCnClose'),
    btnCnPrint: document.getElementById('btnCnPrint'),
    btnCnExportPdf: document.getElementById('btnCnExportPdf'),
    cnLogoWrap: document.getElementById('cnLogoWrap'),
    cnLogo: document.getElementById('cnLogo'),
    cnShopName: document.getElementById('cnShopName'),
    cnShopAddress: document.getElementById('cnShopAddress'),
    cnShopPhone: document.getElementById('cnShopPhone'),
    cnVatNumber: document.getElementById('cnVatNumber'),
    cnShopEmail: document.getElementById('cnShopEmail'),
    cnNoteNum: document.getElementById('cnNoteNum'),
    cnOrigInv: document.getElementById('cnOrigInv'),
    cnDate: document.getElementById('cnDate'),
    cnPayment: document.getElementById('cnPayment'),
    cnPaidAtRow: document.getElementById('cnPaidAtRow'),
    cnPaidAt: document.getElementById('cnPaidAt'),
    cnCleanedAtRow: document.getElementById('cnCleanedAtRow'),
    cnCleanedAt: document.getElementById('cnCleanedAt'),
    cnDeliveredAtRow: document.getElementById('cnDeliveredAtRow'),
    cnDeliveredAt: document.getElementById('cnDeliveredAt'),
    cnCRRow: document.getElementById('cnCRRow'),
    cnCR: document.getElementById('cnCR'),
    cnCreatedByRow: document.getElementById('cnCreatedByRow'),
    cnCreatedBy: document.getElementById('cnCreatedBy'),
    cnCustomerSection: document.getElementById('cnCustomerSection'),
    cnCustNameRow: document.getElementById('cnCustNameRow'),
    cnCustName: document.getElementById('cnCustName'),
    cnCustPhoneRow: document.getElementById('cnCustPhoneRow'),
    cnCustPhone: document.getElementById('cnCustPhone'),
    cnSubBalRow: document.getElementById('cnSubBalRow'),
    cnSubBalance: document.getElementById('cnSubBalance'),
    cnItemsTbody: document.getElementById('cnItemsTbody'),
    cnSubtotalLabel: document.getElementById('cnSubtotalLabel'),
    cnSubtotal: document.getElementById('cnSubtotal'),
    cnDiscRow: document.getElementById('cnDiscRow'),
    cnDiscount: document.getElementById('cnDiscount'),
    cnExtraRow: document.getElementById('cnExtraRow'),
    cnExtra: document.getElementById('cnExtra'),
    cnVatRow: document.getElementById('cnVatRow'),
    cnVatLabel: document.getElementById('cnVatLabel'),
    cnVat: document.getElementById('cnVat'),
    cnTotalLabel: document.getElementById('cnTotalLabel'),
    cnTotal: document.getElementById('cnTotal'),
    cnMixedCashRow: document.getElementById('cnMixedCashRow'),
    cnMixedCardRow: document.getElementById('cnMixedCardRow'),
    cnMixedCash: document.getElementById('cnMixedCash'),
    cnMixedCard: document.getElementById('cnMixedCard'),
    cnPaidRow: document.getElementById('cnPaidRow'),
    cnRemainingRow: document.getElementById('cnRemainingRow'),
    cnPaidAmount: document.getElementById('cnPaidAmount'),
    cnRemainingAmount: document.getElementById('cnRemainingAmount'),
    cnNotesSection: document.getElementById('cnNotesSection'),
    cnNotes: document.getElementById('cnNotes'),
    cnQR: document.getElementById('cnQR'),
  };

  /* ========== UTILS ========== */
  function fmtLtr(n) { return Number(n || 0).toFixed(2); }

  function sarHtml(amountStr) {
    return `<span class="sar">&#xE900;</span> ${amountStr}`;
  }

  function sarFmt(n) { return sarHtml(fmtLtr(n)); }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const date = d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return date + ' ' + time;
    } catch (_) { return dateStr; }
  }

  function isoTimestamp(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const safe = Number.isNaN(d.getTime()) ? new Date() : d;
    return safe.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function paymentLabel(method) {
    const t = k => (window.I18N && I18N.t(k)) || k;
    const map = {
      cash:    t('credit-pay-cash'),
      card:    t('credit-pay-card'),
      credit:  t('credit-pay-deferred'),
      deferred:t('credit-pay-deferred'),
      mixed:   t('credit-pay-mixed'),
      bank:    t('credit-pay-bank'),
      subscription: 'اشتراك'
    };
    return map[method] || t('credit-pay-other');
  }

  function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-text">${escHtml(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /* ========== A4 INVOICE HELPERS ========== */
  function applyInvoiceTypeClass() {
    const type = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    document.body.classList.toggle('invtype-a4', type === 'a4');
  }

  function fillA4InvoiceModal(data) {
    function a4t(id, val) { const el = document.getElementById(id); if (el) el.textContent = val || ''; }
    function a4h(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val || ''; }
    function a4s(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; }
    const sarSpan = '<span style="font-family:SaudiRiyal;">\uE900</span>';
    const sf = n => sarSpan + Number(n || 0).toFixed(2);

    a4t('a4mShopNameAr',    data.shopNameAr);
    a4t('a4mShopAddressAr', data.shopAddressAr);
    a4t('a4mShopPhoneAr',   data.shopPhone ? 'جوال: ' + data.shopPhone : '');
    a4t('a4mVatAr',         data.vatNumber ? 'الرقم الضريبي: ' + data.vatNumber : '');
    a4t('a4mCrAr',          data.commercialRegister ? 'س.ت: ' + data.commercialRegister : '');
    a4t('a4mShopNameEn',    data.shopNameEn);
    a4t('a4mShopAddressEn', data.shopAddressEn);
    a4t('a4mShopEmail',     data.shopEmail);
    a4t('a4mVatEn',         data.vatNumber ? 'VAT No: ' + data.vatNumber : '');
    a4t('a4mCrEn',          data.commercialRegister ? 'CR No: ' + data.commercialRegister : '');

    const logoEl = document.getElementById('a4mLogo');
    if (logoEl) {
      if (data.logoDataUrl) { logoEl.src = data.logoDataUrl; logoEl.style.display = ''; }
      else logoEl.style.display = 'none';
    }

    a4t('a4mOrderNum', data.orderNum);
    a4t('a4mDate', data.date);
    a4t('a4mPayment', data.payment);
    a4t('a4mCustName', data.custName || '—');
    a4t('a4mCustPhone', data.custPhone || '—');
    a4s('a4mRowSubPackage', !!data.subPackageName);
    if (data.subPackageName) a4t('a4mSubPackage', data.subPackageName);
    a4s('a4mRowSubBalance', data.subBalance != null && !isNaN(data.subBalance));
    if (data.subBalance != null && !isNaN(data.subBalance)) a4h('a4mSubBalance', sf(data.subBalance));
    a4s('a4mRowCleanedAt',   !!data.cleanedAt);   if (data.cleanedAt)   a4t('a4mCleanedAt',   data.cleanedAt);
    a4s('a4mRowDeliveredAt', !!data.deliveredAt); if (data.deliveredAt) a4t('a4mDeliveredAt', data.deliveredAt);
    a4s('a4mRowPaidAt',      !!data.paidAt);      if (data.paidAt)      a4t('a4mPaidAt',      data.paidAt);

    const vatRate   = data.vatRate || 0;
    const priceMode = data.priceDisplayMode || 'exclusive';
    const tbody = document.getElementById('a4mItemsTbody');
    if (tbody && data.items) {
      tbody.innerHTML = data.items.map((it, i) => {
        const lineTotal = Number(it.lineTotal || 0);
        let net, itemVat, gross;
        if (vatRate > 0) {
          if (priceMode === 'inclusive') {
            net = lineTotal / (1 + vatRate / 100);
            itemVat = lineTotal - net;
            gross = lineTotal;
          } else {
            net = lineTotal; itemVat = lineTotal * vatRate / 100; gross = lineTotal + itemVat;
          }
        } else { net = lineTotal; itemVat = 0; gross = lineTotal; }
        const nameCell = escHtml(it.productAr || '') + (it.productEn && it.productEn !== it.productAr ? `<span class="a4m-td-en">${escHtml(it.productEn)}</span>` : '');
        const svcCell  = escHtml(it.serviceAr || '—') + (it.serviceEn && it.serviceEn !== it.serviceAr ? `<span class="a4m-td-en">${escHtml(it.serviceEn)}</span>` : '');
        return `<tr>
          <td class="a4m-td-num">${i + 1}</td>
          <td class="a4m-td-name">${nameCell}</td>
          <td class="a4m-td-name">${svcCell}</td>
          <td class="a4m-td-num">${it.qty || 1}</td>
          <td class="a4m-td-num">${sarSpan}${Number(it.unitPrice || 0).toFixed(2)}</td>
          <td class="a4m-td-num">${sarSpan}${net.toFixed(2)}</td>
          <td class="a4m-td-num">${sarSpan}${itemVat.toFixed(2)}</td>
          <td class="a4m-td-num">${sarSpan}${gross.toFixed(2)}</td>
        </tr>`;
      }).join('');
    }

    a4h('a4mSubtotal', sf(data.subtotal));
    if (data.discount > 0) {
      a4h('a4mDiscount', sf(data.discount)); a4s('a4mDiscRow', true);
      if (data.discountLabel) { var discLblA4Ci = document.querySelector('#a4mDiscRow span'); if (discLblA4Ci) discLblA4Ci.textContent = data.discountLabel + ' / Discount'; }
      var a4mAfterDiscCi = Number(data.subtotal || 0) - Number(data.discount || 0); a4h('a4mAfterDiscount', sf(a4mAfterDiscCi)); a4s('a4mAfterDiscRow', true);
    } else { a4s('a4mDiscRow', false); a4s('a4mAfterDiscRow', false); }
    if (data.extra > 0) { a4h('a4mExtra', sf(data.extra)); a4s('a4mExtraRow', true); } else a4s('a4mExtraRow', false);
    if (vatRate > 0) {
      a4t('a4mVatLabel', `ضريبة القيمة المضافة (${vatRate}%) / VAT`);
      a4h('a4mVat', sf(data.vatAmount)); a4s('a4mVatRow', true);
      a4t('a4mSubtotalLabel', 'المجموع قبل الضريبة / Subtotal');
      a4t('a4mTotalLabel', 'الإجمالي شامل الضريبة / Grand Total');
    } else {
      a4s('a4mVatRow', false);
      a4t('a4mSubtotalLabel', 'المجموع / Subtotal');
      a4t('a4mTotalLabel', 'الإجمالي / Total');
    }
    a4h('a4mTotal', sf(data.total));

    const paidCash = Number(data.paidCash || 0);
    const paidCard = Number(data.paidCard || 0);
    if (paidCash > 0 || paidCard > 0) {
      a4h('a4mMixedCash', sf(paidCash)); a4s('a4mMixedCashRow', true);
      a4h('a4mMixedCard', sf(paidCard)); a4s('a4mMixedCardRow', true);
    } else {
      a4s('a4mMixedCashRow', false); a4s('a4mMixedCardRow', false);
    }

    const notesEl = document.getElementById('a4mFooterNotes');
    if (notesEl) {
      if (data.invoiceNotes) {
        const nc = document.getElementById('a4mNotesContent');
        if (nc) nc.textContent = data.invoiceNotes;
        notesEl.style.display = '';
      } else notesEl.style.display = 'none';
    }

    if (data.qrPayload) {
      const qrEl = document.getElementById('a4mQR');
      if (qrEl) {
        qrEl.innerHTML = '';
        window.api.generateZatcaQR(data.qrPayload)
          .then(res => { if (res && res.success && res.svg) qrEl.innerHTML = res.svg; })
          .catch(() => {});
      }
    }
  }

  function fillA4CreditNoteModal(data) {
    function a4t(id, val) { const el = document.getElementById('cnA4m' + id); if (el) el.textContent = val || ''; }
    function a4h(id, val) { const el = document.getElementById('cnA4m' + id); if (el) el.innerHTML = val || ''; }
    function a4s(id, show) { const el = document.getElementById('cnA4m' + id); if (el) el.style.display = show ? '' : 'none'; }
    const sarSpan = '<span style="font-family:SaudiRiyal;">\uE900</span>';
    const sf = n => sarSpan + Number(n || 0).toFixed(2);

    a4t('ShopNameAr',    data.shopNameAr);
    a4t('ShopAddressAr', data.shopAddressAr);
    a4t('ShopPhoneAr',   data.shopPhone ? 'جوال: ' + data.shopPhone : '');
    a4t('VatAr',         data.vatNumber ? 'الرقم الضريبي: ' + data.vatNumber : '');
    a4t('CrAr',          data.commercialRegister ? 'س.ت: ' + data.commercialRegister : '');
    a4t('ShopNameEn',    data.shopNameEn);
    a4t('ShopAddressEn', data.shopAddressEn);
    a4t('ShopEmail',     data.shopEmail);
    a4t('VatEn',         data.vatNumber ? 'VAT No: ' + data.vatNumber : '');
    a4t('CrEn',          data.commercialRegister ? 'CR No: ' + data.commercialRegister : '');

    const logoEl = document.getElementById('cnA4mLogo');
    if (logoEl) {
      if (data.logoDataUrl) { logoEl.src = data.logoDataUrl; logoEl.style.display = ''; }
      else logoEl.style.display = 'none';
    }

    a4t('NoteNum', data.orderNum);
    a4t('OrigInv', data.originalInvoiceSeq || '');
    a4t('Date', data.date);
    a4t('Payment', data.payment);
    a4t('CreatedBy', data.createdBy || '');
    a4t('CustName', data.custName || '—');
    a4t('CustPhone', data.custPhone || '—');
    a4s('RowSubPackage', !!data.subPackageName);
    if (data.subPackageName) a4t('SubPackage', data.subPackageName);
    a4s('RowSubBalance', data.subBalance != null && !isNaN(data.subBalance));
    if (data.subBalance != null && !isNaN(data.subBalance)) a4h('SubBalance', sf(data.subBalance));
    a4s('RowCleanedAt',   !!data.cleanedAt);   if (data.cleanedAt)   a4t('CleanedAt',   data.cleanedAt);
    a4s('RowDeliveredAt', !!data.deliveredAt); if (data.deliveredAt) a4t('DeliveredAt', data.deliveredAt);
    a4s('RowPaidAt',      !!data.paidAt);      if (data.paidAt)      a4t('PaidAt',      data.paidAt);

    const vatRate   = data.vatRate || 0;
    const priceMode = data.priceDisplayMode || 'exclusive';
    const tbody = document.getElementById('cnA4mItemsTbody');
    if (tbody && data.items) {
      tbody.innerHTML = data.items.map((it, i) => {
        const lineTotal = Number(it.lineTotal || 0);
        let net, itemVat, gross;
        if (vatRate > 0) {
          if (priceMode === 'inclusive') {
            net = lineTotal / (1 + vatRate / 100);
            itemVat = lineTotal - net;
            gross = lineTotal;
          } else {
            net = lineTotal; itemVat = lineTotal * vatRate / 100; gross = lineTotal + itemVat;
          }
        } else { net = lineTotal; itemVat = 0; gross = lineTotal; }
        const nameCell = escHtml(it.productAr || '') + (it.productEn && it.productEn !== it.productAr ? `<span class="a4m-td-en">${escHtml(it.productEn)}</span>` : '');
        const svcCell  = escHtml(it.serviceAr || '—') + (it.serviceEn && it.serviceEn !== it.serviceAr ? `<span class="a4m-td-en">${escHtml(it.serviceEn)}</span>` : '');
        return `<tr>
          <td class="a4m-td-num">${i + 1}</td>
          <td class="a4m-td-name">${nameCell}</td>
          <td class="a4m-td-name">${svcCell}</td>
          <td class="a4m-td-num">${it.qty || 1}</td>
          <td class="a4m-td-num">${sarSpan}${Number(it.unitPrice || 0).toFixed(2)}</td>
          <td class="a4m-td-num">${sarSpan}${net.toFixed(2)}</td>
          <td class="a4m-td-num">${sarSpan}${itemVat.toFixed(2)}</td>
          <td class="a4m-td-num">${sarSpan}${gross.toFixed(2)}</td>
        </tr>`;
      }).join('');
    }

    a4h('Subtotal', sf(data.subtotal));
    if (data.discount > 0) {
      a4h('Discount', sf(data.discount)); a4s('DiscRow', true);
      if (data.discountLabel) { var discLblA4Cn = document.querySelector('#cnA4mDiscRow span'); if (discLblA4Cn) discLblA4Cn.textContent = data.discountLabel + ' / Discount'; }
      var cnA4AfterDisc = Number(data.subtotal || 0) - Number(data.discount || 0);
      a4h('AfterDiscount', sf(cnA4AfterDisc)); a4s('AfterDiscRow', true);
    } else { a4s('DiscRow', false); a4s('AfterDiscRow', false); }
    if (data.extra > 0) { a4h('Extra', sf(data.extra)); a4s('ExtraRow', true); } else a4s('ExtraRow', false);
    if (vatRate > 0) {
      a4t('VatLabel', `ضريبة القيمة المضافة (${vatRate}%) / VAT`);
      a4h('Vat', sf(data.vatAmount)); a4s('VatRow', true);
      a4t('SubtotalLabel', 'المجموع قبل الضريبة / Subtotal');
      a4t('TotalLabel', 'الإجمالي شامل الضريبة / Grand Total');
    } else {
      a4s('VatRow', false);
      a4t('SubtotalLabel', 'المجموع / Subtotal');
      a4t('TotalLabel', 'الإجمالي / Total');
    }
    a4h('Total', sf(data.total));

    const paidCash = Number(data.paidCash || 0);
    const paidCard = Number(data.paidCard || 0);
    if (paidCash > 0 || paidCard > 0) {
      a4h('MixedCash', sf(paidCash)); a4s('MixedCashRow', true);
      a4h('MixedCard', sf(paidCard)); a4s('MixedCardRow', true);
    } else {
      a4s('MixedCashRow', false); a4s('MixedCardRow', false);
    }

    const notesEl = document.getElementById('cnA4mFooterNotes');
    if (notesEl) {
      if (data.invoiceNotes) {
        const nc = document.getElementById('cnA4mNotesContent');
        if (nc) nc.textContent = data.invoiceNotes;
        notesEl.style.display = '';
      } else notesEl.style.display = 'none';
    }

    a4s('RowStarch', !!data.starch);
    if (data.starch) a4t('Starch', data.starch);
    a4s('RowBluing', !!data.bluing);
    if (data.bluing) a4t('Bluing', data.bluing);

    if (data.qrPayload) {
      const qrEl = document.getElementById('cnA4mQR');
      if (qrEl) {
        qrEl.innerHTML = '';
        window.api.generateZatcaQR(data.qrPayload)
          .then(res => { if (res && res.success && res.svg) qrEl.innerHTML = res.svg; })
          .catch(() => {});
      }
    }
  }

  /* ========== INIT ========== */
  async function init() {
    bindEvents();
    if (window.I18N) I18N.apply();

    const settingsRes = await window.api.getAppSettings().catch(() => null);
    if (settingsRes && settingsRes.success && settingsRes.settings) {
      state.appSettings = settingsRes.settings;
    }

    await loadData();
  }

  /* ========== LOAD DATA ========== */
  async function loadData() {
    showLoading(true);
    try {
      const res = await window.api.getCreditNotes({
        page: state.page,
        pageSize: state.pageSize,
        search: state.search,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
      });

      if (!res || !res.success) {
        showToast(I18N.t('credit-err-load'), 'error');
        showLoading(false);
        return;
      }

      state.creditNotes = res.creditNotes || [];
      state.total = res.total || 0;
      state.totalPages = Math.ceil(state.total / state.pageSize) || 1;

      renderTable();
      renderPagination();
    } catch (err) {
      showToast(I18N.t('credit-err-server'), 'error');
    } finally {
      showLoading(false);
    }
  }

  function showLoading(show) {
    const loadingRow = document.getElementById('loadingRow');
    if (loadingRow) loadingRow.style.display = show ? '' : 'none';
  }

  /* ========== ZATCA HELPERS ========== */
  function getZatcaBadgeInfo(cn) {
    const status = String(cn.zatca_status || '').toLowerCase().trim();
    if (!state.appSettings || !state.appSettings.zatcaEnabled) {
      return { label: 'غير مفعل', cls: 'zatca-disabled' };
    }
    if (status === 'submitted' || status === 'accepted') {
      return { label: 'تم الإرسال', cls: 'zatca-submitted' };
    }
    if (status === 'rejected') {
      return { label: 'فشل', cls: 'zatca-rejected' };
    }
    return { label: 'لم يُرسل', cls: 'zatca-pending' };
  }

  function openZatcaRespModal(text) {
    const modal = document.getElementById('zatcaRespModal');
    const pre = document.getElementById('zatcaRespText');
    const btnClose = document.getElementById('btnZatcaRespClose');
    if (!modal || !pre || !btnClose) return;
    pre.textContent = text || '';
    modal.style.display = '';
    const close = () => { modal.style.display = 'none'; };
    btnClose.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
  }

  async function submitCreditNoteToZatca(cnId, btnEl) {
    if (!state.appSettings || !state.appSettings.zatcaEnabled) {
      showToast('الربط الإلكتروني غير مفعل من الإعدادات', 'error');
      return;
    }
    if (btnEl) btnEl.disabled = true;
    try {
      const res = await window.api.zatcaSubmitCreditNote({ cnId });
      if (res && res.success) {
        showToast('تم إرسال الإشعار الدائن بنجاح', 'success');
      } else {
        showToast(res?.message || 'فشل إرسال الإشعار الدائن', 'error');
      }
      await loadData();
    } catch (e) {
      showToast(e.message || 'فشل إرسال الإشعار الدائن', 'error');
    } finally {
      if (btnEl) btnEl.disabled = false;
    }
  }

  /* ========== RENDER TABLE ========== */
  function renderTable() {
    const rows = els.tableBody.querySelectorAll('tr:not(#loadingRow)');
    rows.forEach(r => r.remove());

    if (state.creditNotes.length === 0) {
      els.emptyState.style.display = 'flex';
      els.paginationBar.style.display = 'none';
      return;
    }

    els.emptyState.style.display = 'none';

    const offset = (state.page - 1) * state.pageSize;
    const fragment = document.createDocumentFragment();

    state.creditNotes.forEach((cn, idx) => {
      const seqNum = offset + idx + 1;
      const tr = document.createElement('tr');
      const total = parseFloat(cn.total_amount || 0);

      const z = getZatcaBadgeInfo(cn);
      const hasResp = Boolean(cn.zatca_response) || Boolean(cn.zatca_rejection_reason);
      const canSubmit = state.appSettings && state.appSettings.zatcaEnabled
        && !['submitted', 'accepted'].includes(String(cn.zatca_status || '').toLowerCase());

      tr.innerHTML = `
        <td class="seq-cell" style="text-align:center;color:#94a3b8;font-size:12px">${seqNum}</td>
        <td class="cn-num-cell">${escHtml(cn.credit_note_number || '')}</td>
        <td class="orig-inv-cell">${cn.original_invoice_seq ? escHtml(String(cn.original_invoice_seq)) : escHtml(cn.original_order_number || '—')}</td>
        <td style="direction:ltr;text-align:right">${escHtml(formatDate(cn.created_at))}</td>
        <td>${cn.customer_name ? escHtml(cn.customer_name) + (cn.phone ? `<br><span style="font-size:12px;color:#94a3b8">${escHtml(cn.phone)}</span>` : '') : '<span style="color:#94a3b8">—</span>'}</td>
        <td class="amount-cell">${fmtLtr(total)} <span class="sar">&#xE900;</span></td>
        <td>
          <span class="zatca-badge ${z.cls}">${z.label}</span>
        </td>
        <td class="actions-cell">
          <button class="action-btn btn-view-inv" data-order-id="${cn.original_order_id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>${I18N.t('credit-btn-view-invoice')}</span>
          </button>
          <button class="action-btn btn-view-cn" data-cn-id="${cn.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M9 14l-4-4 4-4"/>
              <path d="M5 10h11a4 4 0 0 1 0 8h-1"/>
            </svg>
            <span>${I18N.t('credit-btn-view-cn')}</span>
          </button>
          ${canSubmit ? `
          <button class="action-btn btn-zatca" data-cn-id="${cn.id}" title="إرسال للهيئة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13"/>
              <path d="M22 2l-7 20-4-9-9-4z"/>
            </svg>
            <span>إرسال</span>
          </button>` : ''}
          ${hasResp ? `
          <button class="action-btn btn-view-zatca" data-cn-id="${cn.id}" title="عرض رد الهيئة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
            </svg>
            <span>الرد</span>
          </button>` : ''}
        </td>
      `;

      tr.querySelector('.btn-view-inv').addEventListener('click', () => openOriginalInvoice(cn.original_order_id));
      tr.querySelector('.btn-view-cn').addEventListener('click', () => openCreditNote(cn.id));

      const btnSubmit = tr.querySelector('.btn-zatca');
      if (btnSubmit) btnSubmit.addEventListener('click', () => submitCreditNoteToZatca(cn.id, btnSubmit));

      const btnResp = tr.querySelector('.btn-view-zatca');
      if (btnResp) {
        btnResp.addEventListener('click', () => {
          const txt = cn.zatca_response
            ? String(cn.zatca_response)
            : (cn.zatca_rejection_reason ? String(cn.zatca_rejection_reason) : '');
          openZatcaRespModal(txt);
        });
      }

      fragment.appendChild(tr);
    });

    els.tableBody.appendChild(fragment);
  }

  /* ========== PAGINATION ========== */
  function renderPagination() {
    if (state.totalPages <= 1 && state.total <= state.pageSize) {
      els.paginationBar.style.display = 'none';
      return;
    }
    els.paginationBar.style.display = 'flex';

    const start = (state.page - 1) * state.pageSize + 1;
    const end = Math.min(state.page * state.pageSize, state.total);
    els.paginationInfo.textContent = I18N.t('credit-pagination-info')
      .replace('{start}', start)
      .replace('{end}', end)
      .replace('{total}', state.total);

    els.btnFirstPage.disabled = state.page === 1;
    els.btnPrevPage.disabled  = state.page === 1;
    els.btnNextPage.disabled  = state.page === state.totalPages;
    els.btnLastPage.disabled  = state.page === state.totalPages;

    els.pageNumbers.innerHTML = '';
    buildPageRange(state.page, state.totalPages).forEach(p => {
      if (p === '...') {
        const span = document.createElement('span');
        span.className = 'page-ellipsis';
        span.textContent = '…';
        els.pageNumbers.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.className = 'page-num' + (p === state.page ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => { state.page = p; loadData(); });
        els.pageNumbers.appendChild(btn);
      }
    });
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

  /* ========== OPEN ORIGINAL INVOICE ========== */
  async function openOriginalInvoice(orderId) {
    if (!orderId) { showToast(I18N.t('credit-err-invoice-id'), 'error'); return; }
    try {
      state.viewingOrderId = orderId;
      const res = await window.api.getOrderById({ id: orderId });
      if (!res || !res.success) { showToast(I18N.t('credit-err-load-invoice'), 'error'); return; }
      renderOriginalInvoiceModal(res.order, res.items, res.order.invoice_seq || orderId, res.subscription || null);
    } catch (err) {
      showToast(I18N.t('credit-err-load-invoice-err'), 'error');
    }
  }

  function renderOriginalInvoiceModal(order, items, seqNum, subscription) {
    const s = state.appSettings || {};
    const displaySeq = order.invoice_seq || seqNum;

    const shopName = s.laundryNameAr || s.laundryNameEn || '';
    els.invShopName.textContent = shopName;

    const addressParts = [];
    if (s.buildingNumber) addressParts.push(s.buildingNumber);
    if (s.streetNameAr)   addressParts.push(s.streetNameAr);
    if (s.districtAr)     addressParts.push(s.districtAr);
    if (s.cityAr)         addressParts.push(s.cityAr);
    if (s.postalCode)     addressParts.push(s.postalCode);
    els.invShopAddress.textContent = addressParts.length ? addressParts.join('، ') : (s.locationAr || '');
    els.invShopPhone.textContent  = s.phone ? 'هاتف: ' + s.phone : '';
    els.invShopEmail.textContent  = s.email || '';
    els.invVatNumber.textContent  = s.vatNumber ? 'الرقم الضريبي: ' + s.vatNumber : '';

    if (s.commercialRegister) { els.invCR.textContent = s.commercialRegister; els.invCRRow.style.display = ''; }
    else els.invCRRow.style.display = 'none';

    if (s.logoDataUrl) { els.invLogo.src = s.logoDataUrl; els.invLogoWrap.style.display = ''; }
    else els.invLogoWrap.style.display = 'none';

    els.invOrderNum.textContent = displaySeq ? String(displaySeq) : (order.order_number || '—');
    els.invDate.textContent     = formatDate(order.created_at);
    els.invPayment.textContent  = paymentLabel(order.payment_method);

    const setRow = (row, val, el) => {
      if (val) { if (el) el.textContent = formatDate(val); if (row) row.style.display = ''; }
      else if (row) row.style.display = 'none';
    };
    setRow(els.invPaidAtRow, order.paid_at, els.invPaidAt);
    setRow(els.invCleanedAtRow, order.cleaning_date, els.invCleanedAt);
    setRow(els.invDeliveredAtRow, order.delivery_date, els.invDeliveredAt);

    if (order.created_by) { els.invCreatedBy.textContent = order.created_by; els.invCreatedByRow.style.display = ''; }
    else els.invCreatedByRow.style.display = 'none';

    if (order.customer_name || order.phone) {
      els.invCustomerSection.style.display = '';
      if (order.customer_name) { els.invCustName.textContent = order.customer_name; els.invCustNameRow.style.display = ''; } else els.invCustNameRow.style.display = 'none';
      if (order.phone) { els.invCustPhone.textContent = order.phone; els.invCustPhoneRow.style.display = ''; } else els.invCustPhoneRow.style.display = 'none';
    } else els.invCustomerSection.style.display = 'none';

    if (els.invSubBalRow) {
      if (subscription && subscription.credit_remaining != null) {
        const bal = parseFloat(subscription.credit_remaining);
        if (!isNaN(bal)) { els.invSubBalance.innerHTML = sarFmt(bal); els.invSubBalRow.style.display = ''; els.invCustomerSection.style.display = ''; }
        else els.invSubBalRow.style.display = 'none';
      } else els.invSubBalRow.style.display = 'none';
    }

    const sarSpan = '<span class="sar">&#xE900;</span>';
    els.invItemsTbody.innerHTML = (items || []).map(item => {
      const nameAr = escHtml(item.product_name_ar || '');
      const nameEn = escHtml(item.product_name_en || '');
      const svcAr  = escHtml(item.service_name_ar || '');
      const svcEn  = escHtml(item.service_name_en || '');
      const productCell = nameAr + (nameEn && nameEn !== nameAr ? `<span class="inv-td-en">${nameEn}</span>` : '');
      const serviceCell = svcAr  + (svcEn  && svcEn !== svcAr   ? `<span class="inv-td-en">${svcEn}</span>`  : '');
      return `<tr>
        <td class="inv-td-name">${productCell}</td>
        <td class="inv-td-num">${item.quantity}</td>
        <td class="inv-td-amt">${fmtLtr(item.line_total)}</td>
        <td class="inv-td-name">${serviceCell || '—'}</td>
      </tr>`;
    }).join('');

    const subtotal  = parseFloat(order.subtotal || 0);
    const discount  = parseFloat(order.discount_amount || 0);
    const extra     = parseFloat(order.extra_amount || 0);
    const vatRate   = parseFloat(order.vat_rate || 0);
    const vatAmount = parseFloat(order.vat_amount || 0);
    const total     = parseFloat(order.total_amount || 0);
    const isInclusive = order.price_display_mode === 'inclusive';

    // المجموع قبل الضريبة = الإجمالي ناقص الضريبة (يعمل لكل الحالات)
    if (vatRate > 0 && vatAmount > 0) {
      els.invSubtotal.innerHTML = sarFmt(subtotal * 100 / (100 + vatRate));
    } else {
      els.invSubtotal.innerHTML = sarFmt(subtotal);
    }

    if (discount > 0) {
      els.invDiscount.innerHTML = sarFmt(discount); els.invDiscRow.style.display = '';
      if (order.discount_label) {
        var discLblCi = els.invDiscRow.querySelector('.inv-total-label');
        if (discLblCi) discLblCi.textContent = order.discount_label;
      }
      var invAfterDiscEl = document.getElementById('invAfterDiscount');
      var invAfterDiscRowEl = document.getElementById('invAfterDiscRow');
      if (invAfterDiscEl && invAfterDiscRowEl) {
        var invSubVal = (vatRate > 0 && vatAmount > 0) ? (subtotal * 100 / (100 + vatRate)) : subtotal;
        invAfterDiscEl.innerHTML = sarFmt(invSubVal - discount);
        invAfterDiscRowEl.style.display = '';
      }
    } else {
      els.invDiscRow.style.display = 'none';
      var invAfterDiscRowEl2 = document.getElementById('invAfterDiscRow');
      if (invAfterDiscRowEl2) invAfterDiscRowEl2.style.display = 'none';
    }
    if (extra > 0)    { els.invExtra.innerHTML = sarFmt(extra);       els.invExtraRow.style.display = ''; } else els.invExtraRow.style.display = 'none';

    if (vatRate > 0 && vatAmount > 0) {
      els.invVatLabel.textContent = `ضريبة القيمة المضافة (${vatRate}%)`;
      els.invVat.innerHTML = sarFmt(vatAmount);
      els.invVatRow.style.display = '';
      if (els.invSubtotalLabel) els.invSubtotalLabel.textContent = 'المجموع قبل الضريبة';
      if (els.invTotalLabel)    els.invTotalLabel.textContent    = 'الإجمالي شامل الضريبة';
    } else {
      els.invVatRow.style.display = 'none';
      if (els.invSubtotalLabel) els.invSubtotalLabel.textContent = 'المجموع';
      if (els.invTotalLabel)    els.invTotalLabel.textContent    = 'الإجمالي';
    }
    els.invTotal.innerHTML = sarFmt(total);

    const isMixed = String(order.payment_method || '') === 'mixed';
    const pc = parseFloat(order.paid_cash || 0);
    const pd = parseFloat(order.paid_card || 0);
    if (els.invMixedCashRow && els.invMixedCardRow) {
      if (isMixed && (pc > 0 || pd > 0)) {
        if (els.invMixedCash) els.invMixedCash.innerHTML = sarFmt(pc);
        if (els.invMixedCard) els.invMixedCard.innerHTML = sarFmt(pd);
        els.invMixedCashRow.style.display = ''; els.invMixedCardRow.style.display = '';
      } else { els.invMixedCashRow.style.display = 'none'; els.invMixedCardRow.style.display = 'none'; }
    }

    const paidAmount = parseFloat(order.paid_amount || 0);
    const remainingAmount = parseFloat(order.remaining_amount || 0);
    const isDeferred = String(order.payment_method || '') === 'deferred' || remainingAmount > 0;
    if (els.invPaidRow && els.invRemainingRow) {
      if (isDeferred) {
        if (els.invPaidAmount) els.invPaidAmount.innerHTML = sarFmt(paidAmount);
        if (els.invRemainingAmount) els.invRemainingAmount.innerHTML = sarFmt(remainingAmount);
        els.invPaidRow.style.display = ''; els.invRemainingRow.style.display = '';
      } else { els.invPaidRow.style.display = 'none'; els.invRemainingRow.style.display = 'none'; }
    }

    const hasStarch = order.starch && String(order.starch).trim();
    const hasBluing = order.bluing && String(order.bluing).trim();
    const invExtraOpts = document.getElementById('invExtraOpts');
    if (invExtraOpts) invExtraOpts.style.display = (hasStarch || hasBluing) ? '' : 'none';
    const invStarchRow = document.getElementById('invStarchRow'); const invStarch = document.getElementById('invStarch');
    if (invStarchRow && invStarch) { if (hasStarch) { invStarch.textContent = order.starch; invStarchRow.style.display = ''; } else invStarchRow.style.display = 'none'; }
    const invBluingRow = document.getElementById('invBluingRow'); const invBluing = document.getElementById('invBluing');
    if (invBluingRow && invBluing) { if (hasBluing) { invBluing.textContent = order.bluing; invBluingRow.style.display = ''; } else invBluingRow.style.display = 'none'; }

    const invFooterNotes = document.getElementById('invFooterNotes');
    if (invFooterNotes) {
      if (s.invoiceNotes) { const nc = document.getElementById('invNotesContent'); if (nc) nc.textContent = s.invoiceNotes; invFooterNotes.style.display = ''; }
      else invFooterNotes.style.display = 'none';
    }

    if (vatRate > 0) {
      renderQR('invQR', shopName, s.vatNumber, isoTimestamp(order.created_at), fmtLtr(total), fmtLtr(vatAmount));
    } else if (els.invQR) els.invQR.innerHTML = '';

    // Barcode
    var invBarcodeEl = document.getElementById('invBarcode');
    if (invBarcodeEl && displaySeq) {
      try { JsBarcode(invBarcodeEl, String(displaySeq), { format: 'CODE128', width: 3, height: 50, displayValue: true, fontSize: 14, margin: 0, background: 'transparent' }); } catch(e) { invBarcodeEl.innerHTML = ''; }
    } else if (invBarcodeEl) { invBarcodeEl.innerHTML = ''; }

    const isInclusiveA4 = order.price_display_mode === 'inclusive';
    const subtotalA4 = (vatRate > 0 && vatAmount > 0) ? (subtotal * 100 / (100 + vatRate)) : subtotal;
    state.lastA4Data = {
      shopNameAr: s.laundryNameAr || '', shopNameEn: s.laundryNameEn || '',
      shopAddressAr: addressParts.length ? addressParts.join('، ') : (s.locationAr || ''),
      shopAddressEn: s.locationEn || '', shopPhone: s.phone || '', shopEmail: s.email || '',
      invoiceNotes: s.invoiceNotes || '', logoDataUrl: s.logoDataUrl || '',
      orderNum: displaySeq ? String(displaySeq) : (order.order_number || '—'),
      date: formatDate(order.created_at), payment: paymentLabel(order.payment_method),
      custName: order.customer_name || '', custPhone: order.phone || '',
      subPackageName: subscription && subscription.package_name ? subscription.package_name : '',
      subBalance: subscription && subscription.credit_remaining != null ? parseFloat(subscription.credit_remaining) : null,
      cleanedAt: order.cleaning_date ? formatDate(order.cleaning_date) : '',
      deliveredAt: order.delivery_date ? formatDate(order.delivery_date) : '',
      paidAt: order.paid_at ? formatDate(order.paid_at) : '',
      items: (items || []).map(item => ({
        productAr: item.product_name_ar || '', productEn: item.product_name_en || '',
        serviceAr: item.service_name_ar || '', serviceEn: item.service_name_en || '',
        qty: item.quantity, unitPrice: parseFloat(item.unit_price || 0), lineTotal: parseFloat(item.line_total || 0)
      })),
      subtotal: subtotalA4, discount, discountLabel: order.discount_label || '', extra, vatRate, vatAmount, total,
      paidCash: isMixed ? pc : 0, paidCard: isMixed ? pd : 0,
      starch: order.starch || '', bluing: order.bluing || '',
      priceDisplayMode: isInclusiveA4 ? 'inclusive' : 'exclusive',
      commercialRegister: s.commercialRegister || '', vatNumber: s.vatNumber || '',
      qrPayload: vatRate > 0 ? {
        sellerName: shopName, vatNumber: s.vatNumber || '', timestamp: isoTimestamp(order.created_at),
        totalAmount: fmtLtr(total), vatAmount: fmtLtr(vatAmount)
      } : null, autoPrint: false
    };

    applyInvoiceTypeClass();
    if ((state.appSettings && state.appSettings.invoicePaperType) === 'a4') fillA4InvoiceModal(state.lastA4Data);

    state.activePrintTarget = 'invoice';
    els.invoiceViewModal.style.display = 'flex';
    const body = els.invoiceViewModal.querySelector('.inv-dialog-body');
    if (body) body.scrollTop = 0;
  }

  /* ========== OPEN CREDIT NOTE ========== */
  async function openCreditNote(cnId) {
    if (!cnId) { showToast(I18N.t('credit-err-cn-id'), 'error'); return; }
    try {
      const res = await window.api.getCreditNoteById({ id: cnId });
      if (!res || !res.success) { showToast(I18N.t('credit-err-load-cn'), 'error'); return; }
      let order = null;
      let subscription = null;
      if (res.creditNote && res.creditNote.original_order_id) {
        try {
          const orderRes = await window.api.getOrderById({ id: res.creditNote.original_order_id });
          if (orderRes && orderRes.success) {
            order = orderRes.order || null;
            subscription = orderRes.subscription || null;
          }
        } catch (_) {}
      }
      renderCreditNoteModal(res.creditNote, res.items, order, subscription);
    } catch (err) {
      showToast(I18N.t('credit-err-load-cn-err'), 'error');
    }
  }

  function renderCreditNoteModal(cn, items, order, subscription) {
    const s = state.appSettings || {};

    const shopName = s.laundryNameAr || s.laundryNameEn || '';
    els.cnShopName.textContent  = shopName;

    const addressParts = [];
    if (s.buildingNumber) addressParts.push(s.buildingNumber);
    if (s.streetNameAr)   addressParts.push(s.streetNameAr);
    if (s.districtAr)     addressParts.push(s.districtAr);
    if (s.cityAr)         addressParts.push(s.cityAr);
    if (s.postalCode)     addressParts.push(s.postalCode);
    els.cnShopAddress.textContent = addressParts.length ? addressParts.join('، ') : (s.locationAr || '');
    els.cnShopPhone.textContent   = s.phone ? 'هاتف: ' + s.phone : '';
    els.cnShopEmail.textContent   = s.email || '';
    els.cnVatNumber.textContent   = s.vatNumber ? 'الرقم الضريبي: ' + s.vatNumber : '';

    if (s.commercialRegister) { els.cnCR.textContent = s.commercialRegister; els.cnCRRow.style.display = ''; }
    else els.cnCRRow.style.display = 'none';

    if (s.logoDataUrl) { els.cnLogo.src = s.logoDataUrl; els.cnLogoWrap.style.display = ''; }
    else els.cnLogoWrap.style.display = 'none';

    els.cnNoteNum.textContent = cn.credit_note_number || '';
    els.cnOrigInv.textContent = cn.original_invoice_seq ? String(cn.original_invoice_seq) : (cn.original_order_number || '—');
    els.cnDate.textContent    = formatDate(cn.created_at);
    els.cnPayment.textContent = order ? paymentLabel(order.payment_method) : '—';

    const setRow = (row, val, el) => {
      if (val) { if (el) el.textContent = formatDate(val); if (row) row.style.display = ''; }
      else if (row) row.style.display = 'none';
    };
    setRow(els.cnPaidAtRow, order && order.paid_at, els.cnPaidAt);
    setRow(els.cnCleanedAtRow, order && order.cleaning_date, els.cnCleanedAt);
    setRow(els.cnDeliveredAtRow, order && order.delivery_date, els.cnDeliveredAt);

    if (cn.created_by) { els.cnCreatedBy.textContent = cn.created_by; els.cnCreatedByRow.style.display = ''; }
    else if (order && order.created_by) { els.cnCreatedBy.textContent = order.created_by; els.cnCreatedByRow.style.display = ''; }
    else els.cnCreatedByRow.style.display = 'none';

    if (cn.customer_name || cn.phone) {
      els.cnCustomerSection.style.display = '';
      if (cn.customer_name) { els.cnCustName.textContent = cn.customer_name; els.cnCustNameRow.style.display = ''; } else els.cnCustNameRow.style.display = 'none';
      if (cn.phone) { els.cnCustPhone.textContent = cn.phone; els.cnCustPhoneRow.style.display = ''; } else els.cnCustPhoneRow.style.display = 'none';
    } else els.cnCustomerSection.style.display = 'none';

    if (els.cnSubBalRow) {
      if (subscription && subscription.credit_remaining != null) {
        const bal = parseFloat(subscription.credit_remaining);
        if (!isNaN(bal)) { els.cnSubBalance.innerHTML = sarFmt(bal); els.cnSubBalRow.style.display = ''; els.cnCustomerSection.style.display = ''; }
        else els.cnSubBalRow.style.display = 'none';
      } else els.cnSubBalRow.style.display = 'none';
    }

    els.cnItemsTbody.innerHTML = (items || []).map(item => {
      const nameAr = escHtml(item.product_name_ar || '');
      const nameEn = escHtml(item.product_name_en || '');
      const svcAr  = escHtml(item.service_name_ar || '');
      const svcEn  = escHtml(item.service_name_en || '');
      const productCell = nameAr + (nameEn && nameEn !== nameAr ? `<span class="inv-td-en">${nameEn}</span>` : '');
      const serviceCell = svcAr  + (svcEn && svcEn !== svcAr   ? `<span class="inv-td-en">${svcEn}</span>`  : '');
      return `<tr>
        <td class="inv-td-name">${productCell}</td>
        <td class="inv-td-num">${item.quantity}</td>
        <td class="inv-td-amt">${fmtLtr(item.line_total)}</td>
        <td class="inv-td-name">${serviceCell || '—'}</td>
      </tr>`;
    }).join('');

    const subtotal  = parseFloat(cn.subtotal || 0);
    const discount  = parseFloat(cn.discount_amount || 0);
    const extra     = parseFloat(cn.extra_amount || 0);
    const vatRate   = parseFloat(cn.vat_rate || 0);
    const vatAmount = parseFloat(cn.vat_amount || 0);
    const total     = parseFloat(cn.total_amount || 0);
    const isInclusive = cn.price_display_mode === 'inclusive';

    // المجموع قبل الضريبة = الإجمالي ناقص الضريبة (يعمل لكل الحالات)
    if (vatRate > 0 && vatAmount > 0) {
      els.cnSubtotal.innerHTML = sarFmt(subtotal * 100 / (100 + vatRate));
    } else {
      els.cnSubtotal.innerHTML = sarFmt(subtotal);
    }

    if (discount > 0) {
      els.cnDiscount.innerHTML = sarFmt(discount); els.cnDiscRow.style.display = '';
      if (cn.discount_label) {
        var cnDiscLbl = els.cnDiscRow.querySelector('.inv-total-label');
        if (cnDiscLbl) cnDiscLbl.textContent = cn.discount_label;
      }
      var cnAfterDiscEl = document.getElementById('cnAfterDiscount');
      var cnAfterDiscRowEl = document.getElementById('cnAfterDiscRow');
      if (cnAfterDiscEl && cnAfterDiscRowEl) {
        var cnSubVal = (vatRate > 0 && vatAmount > 0) ? (subtotal * 100 / (100 + vatRate)) : subtotal;
        cnAfterDiscEl.innerHTML = sarFmt(cnSubVal - discount);
        cnAfterDiscRowEl.style.display = '';
      }
    } else {
      els.cnDiscRow.style.display = 'none';
      var cnAfterDiscRowEl2 = document.getElementById('cnAfterDiscRow');
      if (cnAfterDiscRowEl2) cnAfterDiscRowEl2.style.display = 'none';
    }
    if (extra > 0)    { els.cnExtra.innerHTML    = sarFmt(extra);    els.cnExtraRow.style.display = ''; } else els.cnExtraRow.style.display = 'none';

    if (vatRate > 0 && vatAmount > 0) {
      els.cnVatLabel.textContent = `ضريبة القيمة المضافة (${vatRate}%)`;
      els.cnVat.innerHTML = sarFmt(vatAmount);
      els.cnVatRow.style.display = '';
      if (els.cnSubtotalLabel) els.cnSubtotalLabel.textContent = 'المجموع قبل الضريبة';
      if (els.cnTotalLabel)    els.cnTotalLabel.textContent    = 'الإجمالي شامل الضريبة';
    } else {
      els.cnVatRow.style.display = 'none';
      if (els.cnSubtotalLabel) els.cnSubtotalLabel.textContent = 'المجموع';
      if (els.cnTotalLabel)    els.cnTotalLabel.textContent    = 'الإجمالي';
    }
    els.cnTotal.innerHTML = sarFmt(total);

    const isMixed = order && String(order.payment_method || '') === 'mixed';
    const pc = order ? parseFloat(order.paid_cash || 0) : 0;
    const pd = order ? parseFloat(order.paid_card || 0) : 0;
    if (els.cnMixedCashRow && els.cnMixedCardRow) {
      if (isMixed && (pc > 0 || pd > 0)) {
        if (els.cnMixedCash) els.cnMixedCash.innerHTML = sarFmt(pc);
        if (els.cnMixedCard) els.cnMixedCard.innerHTML = sarFmt(pd);
        els.cnMixedCashRow.style.display = ''; els.cnMixedCardRow.style.display = '';
      } else { els.cnMixedCashRow.style.display = 'none'; els.cnMixedCardRow.style.display = 'none'; }
    }

    const paidAmount = order ? parseFloat(order.paid_amount || 0) : 0;
    const remainingAmount = order ? parseFloat(order.remaining_amount || 0) : 0;
    const isDeferred = order && (String(order.payment_method || '') === 'deferred' || remainingAmount > 0);
    if (els.cnPaidRow && els.cnRemainingRow) {
      if (isDeferred) {
        if (els.cnPaidAmount) els.cnPaidAmount.innerHTML = sarFmt(paidAmount);
        if (els.cnRemainingAmount) els.cnRemainingAmount.innerHTML = sarFmt(remainingAmount);
        els.cnPaidRow.style.display = ''; els.cnRemainingRow.style.display = '';
      } else { els.cnPaidRow.style.display = 'none'; els.cnRemainingRow.style.display = 'none'; }
    }

    const hasStarch = order && order.starch && String(order.starch).trim();
    const hasBluing = order && order.bluing && String(order.bluing).trim();
    const cnExtraOpts = document.getElementById('cnExtraOpts');
    if (cnExtraOpts) cnExtraOpts.style.display = (hasStarch || hasBluing) ? '' : 'none';
    const cnStarchRow = document.getElementById('cnStarchRow'); const cnStarch = document.getElementById('cnStarch');
    if (cnStarchRow && cnStarch) { if (hasStarch) { cnStarch.textContent = order.starch; cnStarchRow.style.display = ''; } else cnStarchRow.style.display = 'none'; }
    const cnBluingRow = document.getElementById('cnBluingRow'); const cnBluing = document.getElementById('cnBluing');
    if (cnBluingRow && cnBluing) { if (hasBluing) { cnBluing.textContent = order.bluing; cnBluingRow.style.display = ''; } else cnBluingRow.style.display = 'none'; }

    if (cn.notes) { if (els.cnNotes) els.cnNotes.textContent = cn.notes; els.cnNotesSection.style.display = ''; }
    else els.cnNotesSection.style.display = 'none';

    const cnFooterNotes = document.getElementById('cnFooterNotes');
    if (cnFooterNotes) {
      if (s.invoiceNotes) { const nc = document.getElementById('cnNotesContent'); if (nc) nc.textContent = s.invoiceNotes; cnFooterNotes.style.display = ''; }
      else cnFooterNotes.style.display = 'none';
    }

    if (vatRate > 0 && vatAmount > 0) {
      renderQR('cnQR', shopName, s.vatNumber, isoTimestamp(cn.created_at), fmtLtr(total), fmtLtr(vatAmount));
    } else if (els.cnQR) els.cnQR.innerHTML = '';

    // Barcode (credit note uses original invoice seq)
    var cnBarcodeEl = document.getElementById('cnBarcode');
    if (cnBarcodeEl && cn.original_invoice_seq) {
      try { JsBarcode(cnBarcodeEl, String(cn.original_invoice_seq), { format: 'CODE128', width: 3, height: 50, displayValue: true, fontSize: 14, margin: 0, background: 'transparent' }); } catch(e) { cnBarcodeEl.innerHTML = ''; }
    } else if (cnBarcodeEl) { cnBarcodeEl.innerHTML = ''; }

    const isInclusiveA4 = cn.price_display_mode === 'inclusive'
      || (vatRate > 0 && vatAmount > 0 && Math.abs(subtotal - (total - vatAmount)) > 0.01);
    const subtotalA4 = (vatRate > 0 && vatAmount > 0) ? (subtotal * 100 / (100 + vatRate)) : subtotal;
    state.lastA4Data = {
      shopNameAr: s.laundryNameAr || '', shopNameEn: s.laundryNameEn || '',
      shopAddressAr: addressParts.length ? addressParts.join('، ') : (s.locationAr || ''),
      shopAddressEn: s.locationEn || '', shopPhone: s.phone || '', shopEmail: s.email || '',
      invoiceNotes: s.invoiceNotes || '', logoDataUrl: s.logoDataUrl || '',
      orderNum: cn.credit_note_number || '',
      originalInvoiceSeq: cn.original_invoice_seq ? String(cn.original_invoice_seq) : (cn.original_order_number || ''),
      createdBy: cn.created_by || (order && order.created_by) || '',
      date: formatDate(cn.created_at), payment: order ? paymentLabel(order.payment_method) : '—',
      custName: cn.customer_name || '', custPhone: cn.phone || '',
      subPackageName: subscription && subscription.package_name ? subscription.package_name : '',
      subBalance: subscription && subscription.credit_remaining != null ? parseFloat(subscription.credit_remaining) : null,
      cleanedAt: order && order.cleaning_date ? formatDate(order.cleaning_date) : '',
      deliveredAt: order && order.delivery_date ? formatDate(order.delivery_date) : '',
      paidAt: order && order.paid_at ? formatDate(order.paid_at) : '',
      items: (items || []).map(item => ({
        productAr: item.product_name_ar || '', productEn: item.product_name_en || '',
        serviceAr: item.service_name_ar || '', serviceEn: item.service_name_en || '',
        qty: item.quantity, unitPrice: parseFloat(item.unit_price || 0), lineTotal: parseFloat(item.line_total || 0)
      })),
      subtotal: subtotalA4, discount, discountLabel: cn.discount_label || '', extra, vatRate, vatAmount, total,
      paidCash: isMixed ? pc : 0, paidCard: isMixed ? pd : 0,
      starch: order ? (order.starch || '') : '', bluing: order ? (order.bluing || '') : '',
      priceDisplayMode: isInclusiveA4 ? 'inclusive' : 'exclusive',
      commercialRegister: s.commercialRegister || '', vatNumber: s.vatNumber || '',
      qrPayload: vatRate > 0 ? {
        sellerName: shopName, vatNumber: s.vatNumber || '', timestamp: isoTimestamp(cn.created_at),
        totalAmount: fmtLtr(total), vatAmount: fmtLtr(vatAmount)
      } : null, autoPrint: false,
      a4Prefix: 'cnA4m'
    };

    applyInvoiceTypeClass();
    const paperTypeA4 = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    if (paperTypeA4 === 'a4') {
      fillA4CreditNoteModal(state.lastA4Data);
    }

    state.activePrintTarget = 'creditNote';
    els.cnViewModal.style.display = 'flex';
    const body = els.cnViewModal.querySelector('.inv-dialog-body');
    if (body) body.scrollTop = 0;
  }

  /* ========== QR CODE ========== */
  function renderQR(elId, sellerName, vatNumber, timestamp, totalAmount, vatAmount) {
    const qrEl = document.getElementById(elId);
    if (!qrEl) return;
    qrEl.innerHTML = '';
    window.api.generateZatcaQR({ sellerName, vatNumber, timestamp, totalAmount, vatAmount })
      .then(res => { if (res && res.success && res.svg) qrEl.innerHTML = res.svg; })
      .catch(() => {});
  }

  /* ========== PRINT ========== */
  function getPrintCopies() {
    const copies = Number(state.appSettings && state.appSettings.printCopies);
    if (!Number.isFinite(copies)) return 1;
    const n = Math.floor(copies);
    if (n < 0) return 1;
    if (n > 20) return 20;
    return n;
  }

  function printByCopies() {
    const copies = getPrintCopies();
    if (copies === 0) return;
    const paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    let styleEl = null;
    if (paperType === 'a4') {
      styleEl = document.createElement('style');
      styleEl.id = 'a4PageStyle';
      styleEl.textContent = '@page { size: A4 portrait; margin: 0; }';
      document.head.appendChild(styleEl);
    }
    let current = 0;
    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    }
    function printNext() {
      if (current >= copies) { cleanup(); return; }
      current++;
      let handled = false;
      function after() {
        if (handled) return; handled = true;
        window.removeEventListener('afterprint', after);
        if (current < copies) setTimeout(printNext, 120); else cleanup();
      }
      window.addEventListener('afterprint', after);
      window.print();
      setTimeout(after, 2500);
    }
    printNext();
  }

  /* ========== EXPORT PDF from HTML ========== */
  async function exportCurrentPdfFromHtml(paperEl, orderNum, btnEl, origLabel) {
    if (!paperEl) { showToast(I18N.t('credit-err-no-content'), 'error'); return; }
    try {
      btnEl.disabled = true;
      btnEl.innerHTML = I18N.t('credit-exporting');
      const paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
      const result = await window.api.exportInvoicePdfFromHtml({ html: paperEl.outerHTML, paperType, orderNum });
      if (result.success) showToast(I18N.t('credit-success-pdf'), 'success');
      else showToast(result.message || I18N.t('credit-err-pdf'), 'error');
    } catch (err) {
      showToast(I18N.t('credit-err-export'), 'error');
    } finally {
      btnEl.disabled = false;
      btnEl.innerHTML = origLabel;
    }
  }

  /* ========== EVENTS ========== */
  function bindEvents() {
    els.btnBack.addEventListener('click', () => window.api.navigateTo('dashboard'));

    els.searchInput.addEventListener('input', () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => {
        state.search = els.searchInput.value.trim();
        state.page = 1;
        loadData();
      }, 400);
    });

    els.btnDateFilter.addEventListener('click', () => {
      state.dateFrom = els.dateFrom.value || '';
      state.dateTo   = els.dateTo.value   || '';
      state.page = 1;
      els.btnDateClear.style.display = (state.dateFrom || state.dateTo) ? '' : 'none';
      loadData();
    });

    els.btnDateClear.addEventListener('click', () => {
      state.dateFrom = state.dateTo = '';
      els.dateFrom.value = '';
      els.dateTo.value   = '';
      els.btnDateClear.style.display = 'none';
      state.page = 1;
      loadData();
    });

    els.btnExportExcel.addEventListener('click', async () => {
      try {
        els.btnExportExcel.disabled = true;
        const result = await window.api.exportCreditNotes({
          type: 'excel',
          filters: { search: state.search, dateFrom: state.dateFrom, dateTo: state.dateTo }
        });
        if (!result.success) showToast(result.message || I18N.t('credit-err-export-fail'), 'error');
        else showToast(I18N.t('credit-success-excel'), 'success');
      } catch (err) {
        showToast(I18N.t('credit-err-export'), 'error');
      } finally {
        els.btnExportExcel.disabled = false;
      }
    });

    els.btnExportPdf.addEventListener('click', async () => {
      try {
        els.btnExportPdf.disabled = true;
        const result = await window.api.exportCreditNotes({
          type: 'pdf',
          filters: { search: state.search, dateFrom: state.dateFrom, dateTo: state.dateTo }
        });
        if (!result.success) showToast(result.message || I18N.t('credit-err-export-fail'), 'error');
        else showToast(I18N.t('credit-success-pdf'), 'success');
      } catch (err) {
        showToast(I18N.t('credit-err-export'), 'error');
      } finally {
        els.btnExportPdf.disabled = false;
      }
    });

    els.btnFirstPage.addEventListener('click', () => { state.page = 1; loadData(); });
    els.btnPrevPage.addEventListener('click',  () => { if (state.page > 1) { state.page--; loadData(); } });
    els.btnNextPage.addEventListener('click',  () => { if (state.page < state.totalPages) { state.page++; loadData(); } });
    els.btnLastPage.addEventListener('click',  () => { state.page = state.totalPages; loadData(); });
    els.pageSizeSelect.addEventListener('change', () => { state.pageSize = parseInt(els.pageSizeSelect.value, 10); state.page = 1; loadData(); });

    /* Original invoice modal events */
    els.btnInvClose.addEventListener('click', () => closeModal('invoice'));
    els.invoiceViewModal.addEventListener('click', e => { if (e.target === els.invoiceViewModal) closeModal('invoice'); });
    els.btnInvPrint.addEventListener('click', () => printByCopies());
    els.btnInvExportPdf.addEventListener('click', () => {
      const paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
      const paperEl = paperType === 'a4' ? document.getElementById('invoicePaperA4m') : document.getElementById('invoicePaper');
      const orderNum = els.invOrderNum ? els.invOrderNum.textContent : '';
      const orig = els.btnInvExportPdf.innerHTML;
      exportCurrentPdfFromHtml(paperEl, orderNum, els.btnInvExportPdf, orig);
    });

    /* Credit note modal events */
    els.btnCnClose.addEventListener('click', () => closeModal('creditNote'));
    els.cnViewModal.addEventListener('click', e => { if (e.target === els.cnViewModal) closeModal('creditNote'); });
    els.btnCnPrint.addEventListener('click', () => printByCopies());
    els.btnCnExportPdf.addEventListener('click', () => {
      const paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
      const paperEl = paperType === 'a4' ? document.getElementById('cnPaperA4m') : document.getElementById('cnPaper');
      const noteNum = els.cnNoteNum ? els.cnNoteNum.textContent : '';
      const orig = els.btnCnExportPdf.innerHTML;
      exportCurrentPdfFromHtml(paperEl, noteNum, els.btnCnExportPdf, orig);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const zatcaModal = document.getElementById('zatcaRespModal');
        if (zatcaModal && zatcaModal.style.display !== 'none') { zatcaModal.style.display = 'none'; return; }
        if (els.cnViewModal.style.display !== 'none') closeModal('creditNote');
        else if (els.invoiceViewModal.style.display !== 'none') closeModal('invoice');
      }
    });
  }

  function closeModal(which) {
    if (which === 'invoice') {
      els.invoiceViewModal.style.display = 'none';
      document.body.classList.remove('invtype-a4');
    } else {
      els.cnViewModal.style.display = 'none';
      document.body.classList.remove('invtype-a4');
    }
  }

  /* ========== START ========== */
  window.addEventListener('DOMContentLoaded', init);

})();
