(function () {
  'use strict';

  /* ========== STATE ========== */
  const state = {
    orders: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    search: '',
    dateFrom: '',
    dateTo: '',
    searchTimer: null,
    appSettings: null,
    lastA4Data: null,
    viewingOrderId: null,
  };

  /* ========== DOM REFS ========== */
  const els = {
    btnBack: document.getElementById('btnBack'),
    searchInput: document.getElementById('searchInput'),
    tableBody: document.getElementById('invoicesTableBody'),
    emptyState: document.getElementById('emptyState'),
    paginationBar: document.getElementById('paginationBar'),
    paginationInfo: document.getElementById('paginationInfo'),
    pageNumbers: document.getElementById('pageNumbers'),
    btnFirstPage: document.getElementById('btnFirstPage'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    btnLastPage: document.getElementById('btnLastPage'),
    pageSizeSelect: document.getElementById('pageSizeSelect'),
    summaryCount: null,
    summarySubtotal: null,
    summaryTotal: null,
    // Invoice modal
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
    invSubRefRow: document.getElementById('invSubRefRow'),
    invSubRef: document.getElementById('invSubRef'),
    invSubBalRow: document.getElementById('invSubBalRow'),
    invSubBalance: document.getElementById('invSubBalance'),
    invItemsTbody: document.getElementById('invItemsTbody'),
    invSubtotalLabel: document.getElementById('invSubtotalLabel'),
    invSubtotal: document.getElementById('invSubtotal'),
    invDiscRow: document.getElementById('invDiscRow'),
    invAfterDiscRow: document.getElementById('invAfterDiscRow'),
    invAfterDiscount: document.getElementById('invAfterDiscount'),
    invDiscount: document.getElementById('invDiscount'),
    invExtraRow: document.getElementById('invExtraRow'),
    invExtra: document.getElementById('invExtra'),
    invVatRow: document.getElementById('invVatAmountRow'),
    invVatLabel: document.getElementById('invVatLabel'),
    invVat: document.getElementById('invVat'),
    invTypeLabelRow: document.getElementById('invTypeLabelRow'),
    invTypeLabel: document.getElementById('invTypeLabel'),
    a4mTypeLabelRow: document.getElementById('a4mTypeLabelRow'),
    a4mTitleAr: document.getElementById('a4mTitleAr'),
    a4mTitleEn: document.getElementById('a4mTitleEn'),
    a4mTitleSep: document.getElementById('a4mTitleSep'),
    invTotalLabel: document.getElementById('invTotalLabel'),
    invTotal: document.getElementById('invTotal'),
    invMixedCashRow: document.getElementById('invMixedCashRow'),
    invMixedCardRow: document.getElementById('invMixedCardRow'),
    invMixedCash: document.getElementById('invMixedCash'),
    invMixedCard: document.getElementById('invMixedCard'),
    invPaidRow:       document.getElementById('invPaidRow'),
    invRemainingRow:  document.getElementById('invRemainingRow'),
    invPaidAmount:    document.getElementById('invPaidAmount'),
    invRemainingAmount: document.getElementById('invRemainingAmount'),
    invPayment: document.getElementById('invPayment'),
    invPaidAtRow:      document.getElementById('invPaidAtRow'),
    invPaidAt:         document.getElementById('invPaidAt'),
    invCleanedAtRow:   document.getElementById('invCleanedAtRow'),
    invCleanedAt:      document.getElementById('invCleanedAt'),
    invDeliveredAtRow: document.getElementById('invDeliveredAtRow'),
    invDeliveredAt:    document.getElementById('invDeliveredAt'),
    invQR: document.getElementById('invQR'),
    invBarcode: document.getElementById('invBarcode'),
    invFooterEmail: document.getElementById('invFooterEmail'),
    // Refund modal
    refundModal: document.getElementById('refundModal'),
    refundOriginalNo: document.getElementById('refundOriginalNo'),
    refundCustomer: document.getElementById('refundCustomer'),
    refundAmount: document.getElementById('refundAmount'),
    refundReason: document.getElementById('refundReason'),
    btnRefundConfirm: document.getElementById('btnRefundConfirm'),
    btnRefundCancel: document.getElementById('btnRefundCancel'),
    btnRefundClose: document.getElementById('btnRefundClose'),
  };
  let refundTargetOrderId = null;

  /* ========== UTILS ========== */
  function fmtLtr(n) {
    return Number(n || 0).toFixed(2);
  }

  function sarHtml(amountStr) {
    return `<span class="sar">&#xE900;</span> ${amountStr}`;
  }

  function sarFmt(n) {
    return sarHtml(fmtLtr(n));
  }

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

  function formatInvoiceDate(dateStr) {
    if (!dateStr) {
      const now = new Date();
      return now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
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
    const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
    return safeDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function paymentLabel(method) {
    const map = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك', other: 'أخرى' };
    return map[method] || method || '—';
  }

  function paymentClass(method) {
    const map = { cash: 'pay-cash', card: 'pay-card', credit: 'pay-credit', mixed: 'pay-mixed', bank: 'pay-bank', subscription: 'pay-subscription' };
    return map[method] || 'pay-other';
  }

  function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-text">${escHtml(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /* ========== A4 INVOICE WINDOW (fallback standalone) ========== */
  function openA4Invoice(data) {
    localStorage.setItem('a4InvoiceData', JSON.stringify(data));
    window.open('/screens/invoice-a4/invoice-a4.html', '_blank', 'width=960,height=1120,scrollbars=yes');
  }

  /* ========== A4 MODAL HELPERS ========== */
  function applyInvoiceTypeClass() {
    const type = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    document.body.classList.toggle('invtype-a4', type === 'a4');
  }

  function fillA4InvoiceModal(data) {
    function a4mText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val || ''; }
    function a4mHtml(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val || ''; }
    function a4mShow(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; }
    const sarSpan = '<span style="font-family:SaudiRiyal;">\uE900</span>';
    const sarFmt = n => sarSpan + Number(n || 0).toFixed(2);

    /* Title row — hide when no VAT */
    a4mShow('a4mTypeLabelRow', !!data.titleAr);
    a4mText('a4mTitleAr', data.titleAr || '');
    a4mText('a4mTitleEn', data.titleEn || '');
    a4mShow('a4mTitleSep', !!(data.titleAr && data.titleEn));

    a4mText('a4mShopNameAr',    data.shopNameAr);
    a4mText('a4mShopAddressAr', data.shopAddressAr);
    a4mText('a4mShopPhoneAr',   data.shopPhone ? 'جوال: ' + data.shopPhone : '');
    a4mText('a4mVatAr',         data.vatNumber ? 'الرقم الضريبي: ' + data.vatNumber : '');
    a4mText('a4mCrAr',          data.commercialRegister ? 'س.ت: ' + data.commercialRegister : '');
    a4mText('a4mShopNameEn',    data.shopNameEn);
    a4mText('a4mShopAddressEn', data.shopAddressEn);
    a4mText('a4mShopEmail',     data.shopEmail);
    a4mText('a4mVatEn',         data.vatNumber ? 'VAT No: ' + data.vatNumber : '');
    a4mText('a4mCrEn',          data.commercialRegister ? 'CR No: ' + data.commercialRegister : '');

    /* Custom fields (A4) */
    const a4mCFElAr = document.getElementById('a4mCustomFieldsAr');
    const a4mCFElEn = document.getElementById('a4mCustomFieldsEn');
    const cfsA4m = Array.isArray(data.customFields) ? data.customFields : [];
    if (a4mCFElAr) {
      if (cfsA4m.length) {
        let cfHtmlAr = '';
        cfsA4m.forEach(cf => {
          if (cf.labelAr) cfHtmlAr += '<div class="a4m-brand-sub">' + escHtml(cf.labelAr) + '</div>';
        });
        a4mCFElAr.innerHTML = cfHtmlAr;
      } else { a4mCFElAr.innerHTML = ''; }
    }
    if (a4mCFElEn) {
      if (cfsA4m.length) {
        let cfHtmlEn = '';
        cfsA4m.forEach(cf => {
          if (cf.labelEn) cfHtmlEn += '<div class="a4m-brand-sub">' + escHtml(cf.labelEn) + '</div>';
        });
        a4mCFElEn.innerHTML = cfHtmlEn;
      } else { a4mCFElEn.innerHTML = ''; }
    }

    const logoEl = document.getElementById('a4mLogo');
    if (logoEl) {
      if (data.logoDataUrl) { logoEl.src = data.logoDataUrl; logoEl.style.display = ''; }
      else { logoEl.style.display = 'none'; }
    }

    a4mText('a4mOrderNum', data.orderNum);
    a4mText('a4mDate',     data.date);
    a4mText('a4mPayment',  data.payment);
    a4mText('a4mCustName',  data.custName || '—');
    a4mText('a4mCustPhone', data.custPhone || '—');
    var invA4mCustVatRow = document.getElementById('a4mCustVatRow');
    if (data.custVat && invA4mCustVatRow) {
      a4mText('a4mCustVat', data.custVat);
      invA4mCustVatRow.style.display = '';
    } else if (invA4mCustVatRow) {
      invA4mCustVatRow.style.display = 'none';
    }

    if (data.subRef) {
      a4mText('a4mSubRef', data.subRef);
      a4mShow('a4mRowSubRef', true);
    } else { a4mShow('a4mRowSubRef', false); }
    if (data.subPackageName) {
      a4mText('a4mSubPackage', data.subPackageName);
      a4mShow('a4mRowSubPackage', true);
    } else { a4mShow('a4mRowSubPackage', false); }
    if (data.subBalance != null && !isNaN(data.subBalance)) {
      a4mHtml('a4mSubBalance', sarFmt(data.subBalance));
      a4mShow('a4mRowSubBalance', true);
    } else { a4mShow('a4mRowSubBalance', false); }

    a4mShow('a4mRowCleanedAt',   !!data.cleanedAt);
    if (data.cleanedAt)   a4mText('a4mCleanedAt',   data.cleanedAt);
    a4mShow('a4mRowDeliveredAt', !!data.deliveredAt);
    if (data.deliveredAt) a4mText('a4mDeliveredAt', data.deliveredAt);
    a4mShow('a4mRowPaidAt',      !!data.paidAt);
    if (data.paidAt)      a4mText('a4mPaidAt',      data.paidAt);

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
            net = lineTotal;
            itemVat = lineTotal * vatRate / 100;
            gross = lineTotal + itemVat;
          }
        } else { net = lineTotal; itemVat = 0; gross = lineTotal; }

        const nameCell = escHtml(it.productAr || '') + (it.productEn && it.productEn !== it.productAr ? `<span class="a4m-td-en">${escHtml(it.productEn)}</span>` : '');
        const svcCell  = escHtml(it.serviceAr || '—') + (it.serviceEn && it.serviceEn !== it.serviceAr ? `<span class="a4m-td-en">${escHtml(it.serviceEn)}</span>` : '');

        return `<tr>
          <td class="a4m-td-num">${i + 1}</td>
          <td class="a4m-td-name">${nameCell}</td>
          <td class="a4m-td-name">${svcCell}</td>
          <td class="a4m-td-num">${it.qty || 1}</td>
          <td class="a4m-td-num">${Number(it.unitPrice || 0).toFixed(2)}</td>
          <td class="a4m-td-num">${net.toFixed(2)}</td>
          <td class="a4m-td-num">${itemVat.toFixed(2)}</td>
          <td class="a4m-td-num">${gross.toFixed(2)}</td>
        </tr>`;
      }).join('');
    }

    a4mHtml('a4mSubtotal', sarFmt(data.subtotal));
    if (data.discount && data.discount > 0) {
      a4mHtml('a4mDiscount', sarFmt(data.discount));
      a4mShow('a4mDiscRow', true);
      if (data.discountLabel) {
        var a4mDiscLabel = document.querySelector('#a4mDiscRow span');
        if (a4mDiscLabel) a4mDiscLabel.textContent = data.discountLabel + ' / Discount';
      }
      var afterDiscInv = Number(data.subtotal || 0) - Number(data.discount || 0);
      a4mHtml('a4mAfterDiscount', sarFmt(afterDiscInv));
      a4mShow('a4mAfterDiscRow', true);
    } else { a4mShow('a4mDiscRow', false); a4mShow('a4mAfterDiscRow', false); }
    if (data.extra && data.extra > 0) {
      a4mHtml('a4mExtra', sarFmt(data.extra));
      a4mShow('a4mExtraRow', true);
    } else { a4mShow('a4mExtraRow', false); }
    if (vatRate > 0) {
      a4mText('a4mVatLabel', `ضريبة القيمة المضافة (${vatRate}%) / VAT`);
      a4mHtml('a4mVat', sarFmt(data.vatAmount));
      a4mShow('a4mVatRow', true);
      a4mText('a4mSubtotalLabel', 'المجموع قبل الضريبة / Subtotal');
      a4mText('a4mTotalLabel', 'الإجمالي شامل الضريبة / Grand Total');
    } else {
      a4mShow('a4mVatRow', false);
      a4mText('a4mSubtotalLabel', 'المجموع / Subtotal');
      a4mText('a4mTotalLabel', 'الإجمالي / Total');
    }
    a4mHtml('a4mTotal', sarFmt(data.total));

    /* Mixed payment */
    const paidCash = Number(data.paidCash || 0);
    const paidCard = Number(data.paidCard || 0);
    if (paidCash > 0 || paidCard > 0) {
      a4mHtml('a4mMixedCash', sarFmt(paidCash));
      a4mShow('a4mMixedCashRow', true);
      a4mHtml('a4mMixedCard', sarFmt(paidCard));
      a4mShow('a4mMixedCardRow', true);
    } else {
      a4mShow('a4mMixedCashRow', false);
      a4mShow('a4mMixedCardRow', false);
    }

    /* Deferred partial payment */
    const paidAmt = Number(data.paidAmount || 0);
    const remainAmt = Number(data.remainingAmount || 0);
    const isDeferred4 = remainAmt > 0;
    if (isDeferred4) {
      a4mHtml('a4mPaidAmount', sarFmt(paidAmt));
      a4mShow('a4mPaidRow', true);
      a4mHtml('a4mRemainingAmount', sarFmt(remainAmt));
      a4mShow('a4mRemainingRow', true);
    } else {
      a4mShow('a4mPaidRow', false);
      a4mShow('a4mRemainingRow', false);
    }

    const a4mNotesEl = document.getElementById('a4mFooterNotes');
    if (a4mNotesEl) {
      if (data.invoiceNotes) {
        const a4mNotesContent = document.getElementById('a4mNotesContent');
        if (a4mNotesContent) a4mNotesContent.textContent = data.invoiceNotes;
        a4mNotesEl.style.display = '';
      } else {
        a4mNotesEl.style.display = 'none';
      }
    }

    a4mShow('a4mRowStarch', !!data.starch);
    if (data.starch) a4mText('a4mStarch', data.starch);
    a4mShow('a4mRowBluing', !!data.bluing);
    if (data.bluing) a4mText('a4mBluing', data.bluing);
    a4mShow('a4mRowCashier', !!data.cashierName);
    if (data.cashierName) a4mText('a4mCashierName', data.cashierName);
    (function() {
      const section = document.querySelector('#invoicePaperA4m .a4m-bill-to');
      if (!section) return;
      const rightCard = section.querySelector('.a4m-card:last-child');
      if (!rightCard) return;
      const hasVisible = Array.from(rightCard.children).some(el => el.style.display !== 'none');
      rightCard.style.display = hasVisible ? '' : 'none';
      section.style.gridTemplateColumns = hasVisible ? '' : '1fr';
    })();

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

  /* ========== INIT ========== */
  async function init() {
    bindEvents();
    I18N.apply();

    const settingsRes = await window.api.getAppSettings().catch(() => null);
    if (settingsRes && settingsRes.success && settingsRes.settings) {
      state.appSettings = settingsRes.settings;
    }

    // ── فتح فاتورة تلقائياً إذا جاء من شاشة الاشتراكات ──
    const pendingViewId = localStorage.getItem('subscriptionViewOrderId');
    const isInIframe = window.self !== window.top;

    if (pendingViewId) {
      localStorage.removeItem('subscriptionViewOrderId');
      const orderId = Number(pendingViewId);
      if (orderId) {
        // في وضع iframe: نحتاج تحميل الإعدادات فقط ثم فتح الفاتورة
        if (isInIframe) {
          await loadOrders();
          openInvoice(orderId);
          return; // لا نكمل تحميل باقي الواجهة
        }
        openInvoice(orderId);
      }
    }

    await loadOrders();
  }

  /* ========== LOAD DATA ========== */
  async function loadOrders() {
    showLoading(true);
    try {
      const res = await window.api.getOrders({
        page: state.page,
        pageSize: state.pageSize,
        search: state.search,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
      });

      if (!res || !res.success) {
        showToast('حدث خطأ أثناء تحميل الفواتير', 'error');
        showLoading(false);
        return;
      }

      state.orders = res.orders || [];
      state.total = res.total || 0;
      state.totalPages = Math.ceil(state.total / state.pageSize) || 1;

      renderTable();
      renderPagination();
      updateSummary();
    } catch (err) {
      showToast(I18N.t('invoices-err-load'), 'error');
    } finally {
      showLoading(false);
    }
  }

  function showLoading(show) {
    const loadingRow = document.getElementById('loadingRow');
    if (loadingRow) loadingRow.style.display = show ? '' : 'none';
  }

  function getZatcaBadgeInfo(order) {
    const status = String(order.zatca_status || '').toLowerCase().trim();
    if (!state.appSettings || !state.appSettings.zatcaEnabled) {
      return { label: 'غير مفعل', cls: 'zatca-disabled' };
    }
    if (status === 'submitted' || status === 'accepted') {
      return { label: 'تم الإرسال', cls: 'zatca-submitted' };
    }
    if (status === 'rejected') {
      return { label: 'فشل', cls: 'zatca-rejected' };
    }
    if (order.zatca_submitted) {
      return { label: 'تمت المحاولة', cls: 'zatca-pending' };
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

  async function submitOrderToZatca(orderId, btnEl) {
    if (!state.appSettings || !state.appSettings.zatcaEnabled) {
      showToast('الربط الإلكتروني غير مفعل من الإعدادات', 'error');
      return;
    }
    if (btnEl) btnEl.disabled = true;
    try {
      const res = await window.api.zatcaSubmitOrder({ orderId });
      if (res && res.success) {
        showToast('تم إرسال الفاتورة بنجاح', 'success');
      } else {
        showToast(res?.message || 'فشل إرسال الفاتورة', 'error');
      }
      await loadOrders();
    } catch (e) {
      showToast(e.message || 'فشل إرسال الفاتورة', 'error');
    } finally {
      if (btnEl) btnEl.disabled = false;
    }
  }

  /* ========== RENDER TABLE ========== */
  function renderTable() {
    // Remove existing rows (except loading row)
    const rows = els.tableBody.querySelectorAll('tr:not(#loadingRow)');
    rows.forEach(r => r.remove());

    if (state.orders.length === 0) {
      els.emptyState.style.display = 'flex';
      els.paginationBar.style.display = 'none';
      return;
    }

    els.emptyState.style.display = 'none';

    const offset = (state.page - 1) * state.pageSize;
    const fragment = document.createDocumentFragment();

    state.orders.forEach((order, idx) => {
      const seqNum = order.is_refund ? order.order_number : (order.invoice_seq || (offset + idx + 1));
      const tr = document.createElement('tr');

      const subtotal = parseFloat(order.subtotal || 0);
      const vatAmount = parseFloat(order.vat_amount || 0);
      const total = parseFloat(order.total_amount || 0);
      const discount = parseFloat(order.discount_amount || 0);

      const z = getZatcaBadgeInfo(order);
      const hasResp = Boolean(order.zatca_response) || Boolean(order.zatca_rejection_reason);
      const canSubmit = state.appSettings && state.appSettings.zatcaEnabled
        && !['submitted', 'accepted'].includes(String(order.zatca_status || '').toLowerCase())
        && Number(order.is_consumption_only) !== 1;

      const isSub = order.order_type && order.order_type !== 'sale';
      const typeLabel = order.is_refund
        ? 'مرتجع'
        : isSub
          ? (order.order_type === 'subscription_renewal' ? 'تجديد اشتراك' : 'اشتراك جديد')
          : 'فاتورة بيع';
      const refundBadge = order.is_refund
        ? `<span class="refund-badge" data-i18n="refund-badge">مرتجع</span>`
        : '';
      const refundedBadge = order.refunded_at && !order.is_refund
        ? `<span class="refund-badge" style="background:#fff7ed;color:#c2410c;border-color:#fed7aa">تم إرجاعه</span>`
        : '';
      const typeBadge = isSub
        ? `<span class="payment-badge" style="background:#dbeafe;color:#1e40af">${escHtml(typeLabel)}</span>${order.notes ? `<br><span style="font-size:11px;color:#64748b">${escHtml(order.notes)}</span>` : ''}`
        : `<span class="payment-badge" style="background:#f1f5f9;color:#475569">${escHtml(typeLabel)}</span>`;

      let docType = I18N.t('doc-type-tax-invoice');
      if (order.is_refund) {
        docType = I18N.t('refund-badge') || 'مرتجع';
      } else if (Number(order.consumption_amount) > 0 && order.consumption_receipt_id && order.invoice_seq) {
        docType = I18N.t('doc-type-mixed');
      }
      const docTypeBadge = `<span class="payment-badge" style="background:#ccfbf1;color:#0f766e">${escHtml(docType)}</span>`;

      tr.innerHTML = `
        <td class="inv-num-cell">${seqNum}</td>
        <td style="direction:ltr;text-align:right">${escHtml(formatDate(order.created_at))}</td>
        <td>${order.customer_name ? escHtml(order.customer_name) + (order.phone ? `<br><span style="font-size:12px;color:#94a3b8">${escHtml(order.phone)}</span>` : '') : '<span style="color:#94a3b8">—</span>'}</td>
        <td><span class="payment-badge ${paymentClass(order.payment_method)}">${escHtml(paymentLabel(order.payment_method))}</span></td>
        <td class="total-cell">${fmtLtr(total)} <span class="sar">&#xE900;</span></td>
        <td>
          <span class="zatca-badge ${z.cls}">${z.label}</span>
        </td>
        <td class="actions-cell">
          <button class="action-btn btn-view" data-id="${order.id}" title="${I18N.t('invoices-btn-view')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>${I18N.t('invoices-btn-view')}</span>
          </button>
          ${canSubmit ? `
          <button class="action-btn btn-zatca" data-id="${order.id}" title="إرسال للهيئة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13"/>
              <path d="M22 2l-7 20-4-9-9-4z"/>
            </svg>
            <span>إرسال</span>
          </button>` : ''}
          ${hasResp ? `
          <button class="action-btn btn-view-zatca" data-id="${order.id}" title="عرض رد الهيئة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
            </svg>
            <span>الرد</span>
          </button>` : ''}
        </td>
      `;

      tr.querySelector('.btn-view').addEventListener('click', () => openInvoice(order.id, order.invoice_seq || seqNum));

      const btnSubmit = tr.querySelector('.btn-zatca');
      if (btnSubmit) btnSubmit.addEventListener('click', () => submitOrderToZatca(order.id, btnSubmit));

      const btnResp = tr.querySelector('.btn-view-zatca');
      if (btnResp) {
        btnResp.addEventListener('click', () => {
          const txt = order.zatca_response
            ? String(order.zatca_response)
            : (order.zatca_rejection_reason ? String(order.zatca_rejection_reason) : '');
          openZatcaRespModal(txt);
        });
      }

      fragment.appendChild(tr);
    });

    els.tableBody.appendChild(fragment);
  }

  /* ========== SUMMARY ========== */
  function updateSummary() {
    // البطاقات محذوفة
  }

  /* ========== PAGINATION ========== */
  function renderPagination() {
    if (state.totalPages <= 1) {
      els.paginationBar.style.display = 'none';
      return;
    }
    els.paginationBar.style.display = 'flex';

    const start = (state.page - 1) * state.pageSize + 1;
    const end = Math.min(state.page * state.pageSize, state.total);
    els.paginationInfo.textContent = I18N.t('invoices-pagination-info')
      .replace('{start}', start)
      .replace('{end}', end)
      .replace('{total}', state.total);

    els.btnFirstPage.disabled = state.page === 1;
    els.btnPrevPage.disabled = state.page === 1;
    els.btnNextPage.disabled = state.page === state.totalPages;
    els.btnLastPage.disabled = state.page === state.totalPages;

    // Page numbers
    els.pageNumbers.innerHTML = '';
    const pages = buildPageRange(state.page, state.totalPages);
    pages.forEach(p => {
      if (p === '...') {
        const span = document.createElement('span');
        span.className = 'page-ellipsis';
        span.textContent = '…';
        els.pageNumbers.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.className = 'page-num' + (p === state.page ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => { state.page = p; loadOrders(); });
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

  /* ========== OPEN INVOICE ========== */
  async function openInvoice(orderId, seqNum) {
    try {
      state.viewingOrderId = orderId;
      const res = await window.api.getOrderById({ id: orderId });
      if (!res || !res.success) {
        showToast(I18N.t('invoices-err-load-invoice'), 'error');
        return;
      }
      renderInvoiceModal(res.order, res.items, seqNum, res.subscription || null);
      const order = res.order;
    } catch (err) {
      showToast(I18N.t('invoices-err-generic'), 'error');
    }
  }

  async function openRefundModal(orderId) {
    refundTargetOrderId = orderId;
    const res = await window.api.getOrderForRefund(orderId);
    if (!res.success) {
      showToast(res.error || I18N.t('refund-err-not-found'), 'error');
      return;
    }
    const order = res.order;
    els.refundOriginalNo.textContent = order.order_number || '—';
    els.refundCustomer.textContent = order.customer_name || '—';
    els.refundAmount.textContent = sarFmt(order.total_amount);
    els.refundReason.value = '';
    els.refundModal.style.display = '';
  }

  async function confirmRefund() {
    if (!refundTargetOrderId) return;
    const btn = els.btnRefundConfirm;
    btn.disabled = true;
    try {
      const reason = els.refundReason.value.trim();
      const res = await window.api.createRefund({ originalOrderId: refundTargetOrderId, reason });
      if (!res.success) throw new Error(res.error);
      showToast(I18N.t('refund-success'), 'success');
      els.refundModal.style.display = 'none';

      if (res.orderNumber) {
        var refundData = {
          orderNum: res.orderNumber,
          isRefund: true,
          originalOrderNumber: res.originalOrderNumber,
          amount: res.amount,
          autoPrint: true
        };
        // Try to populate with full invoice data from the original invoice modal
        var s = state.appSettings || {};
        refundData.shopNameAr = s.laundryNameAr || '';
        refundData.shopNameEn = s.laundryNameEn || '';
        refundData.shopAddressAr = s.locationAr || '';
        refundData.shopAddressEn = s.locationEn || '';
        refundData.shopPhone = s.phone || '';
        refundData.shopEmail = s.email || '';
        refundData.vatNumber = s.vatNumber || '';
        refundData.commercialRegister = s.commercialRegister || '';
        refundData.logoDataUrl = s.logoDataUrl || '';
        refundData.customFields = s.customFields || [];
        refundData.date = formatInvoiceDate(new Date().toISOString());
        refundData.payment = 'مرتجع';
        refundData.custName = els.invCustName.textContent || '—';
        refundData.custPhone = els.invCustPhone.textContent || '—';
        refundData.total = Number(res.amount || 0);
        // Copy items from last A4 data if available
        if (state.lastA4Data && state.lastA4Data.items) {
          refundData.items = state.lastA4Data.items.map(function (item) {
            return { ...item };
          });
          refundData.subtotal = state.lastA4Data.subtotal || 0;
          refundData.discount = state.lastA4Data.discount || 0;
          refundData.discountLabel = state.lastA4Data.discountLabel || '';
          refundData.extra = state.lastA4Data.extra || 0;
          refundData.vatRate = state.lastA4Data.vatRate || 0;
          refundData.priceDisplayMode = state.lastA4Data.priceDisplayMode || 'exclusive';
        }
        refundData.vatAmount = -(state.lastA4Data && state.lastA4Data.vatAmount ? Math.abs(state.lastA4Data.vatAmount) : 0);
        localStorage.setItem('a4InvoiceData', JSON.stringify(refundData));
        window.open('/screens/invoice-a4/invoice-a4.html', '_blank', 'width=960,height=1120,scrollbars=yes');
      }
      await loadOrders();
    } catch (err) {
      showToast(err.message || 'فشل', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function fixCrInfoGridLastCell() {
    const grid = document.querySelector('#invoicePaper .cr-info-grid');
    if (!grid) return;
    const cells = Array.from(grid.querySelectorAll('.cr-info-cell'));
    cells.forEach(c => { c.style.gridColumn = ''; });
  }

  function renderInvoiceModal(order, items, seqNum, subscription) {
    const s = state.appSettings || {};
    const displaySeq = order.is_refund ? order.order_number : (order.invoice_seq || seqNum);

    /* Shop info */
    const shopName = s.laundryNameAr || s.laundryNameEn || '';
    els.invShopName.textContent = shopName;

    const addressParts = [];
    if (s.buildingNumber) addressParts.push(s.buildingNumber);
    if (s.streetNameAr)   addressParts.push(s.streetNameAr);
    if (s.districtAr)     addressParts.push(s.districtAr);
    if (s.cityAr)         addressParts.push(s.cityAr);
    if (s.postalCode)     addressParts.push(s.postalCode);
    els.invShopAddress.textContent = addressParts.length ? addressParts.join('، ') : (s.locationAr || '');
    els.invShopPhone.textContent = s.phone ? 'هاتف: ' + s.phone : '';
    els.invShopEmail.textContent = s.email || '';
    els.invVatNumber.textContent = s.vatNumber ? 'الرقم الضريبي: ' + s.vatNumber : '';

    if (s.commercialRegister) {
      els.invCR.textContent = 'السجل التجاري: ' + s.commercialRegister;
      els.invCRRow.style.display = '';
    } else {
      els.invCRRow.style.display = 'none';
    }

    if (s.logoDataUrl) {
      els.invLogo.src = s.logoDataUrl;
      els.invLogoWrap.style.display = '';
    } else {
      els.invLogoWrap.style.display = 'none';
    }

    /* Custom fields */
    var invCFInv = document.getElementById('invCustomFields');
    if (invCFInv) {
      var cfsInv = Array.isArray(s.customFields) ? s.customFields : [];
      if (cfsInv.length > 0) {
        var cfHtmlInv = '';
        cfsInv.forEach(function(cf) {
          var label = cf.labelAr || cf.labelEn;
          if (label) cfHtmlInv += '<div class="inv-shop-sub">' + escHtml(label) + '</div>';
        });
        invCFInv.innerHTML = cfHtmlInv;
        invCFInv.style.display = cfHtmlInv ? '' : 'none';
      } else {
        invCFInv.innerHTML = '';
        invCFInv.style.display = 'none';
      }
    }

    /* Invoice meta */
    const _vatRateForTitle = parseFloat(order.vat_rate || 0);
    if (_vatRateForTitle === 0) {
      if (els.invTypeLabelRow) els.invTypeLabelRow.style.display = 'none';
    } else {
      if (els.invTypeLabel) els.invTypeLabel.textContent = order.customer_vat ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة';
      if (els.invTypeLabelRow) els.invTypeLabelRow.style.display = '';
    }
    els.invOrderNum.textContent = displaySeq ? String(displaySeq) : (order.order_number || '—');
    els.invDate.textContent = formatInvoiceDate(order.created_at);
    els.invPayment.textContent = paymentLabel(order.payment_method);

    if (order.paid_at) {
      els.invPaidAt.textContent = formatInvoiceDate(order.paid_at);
      els.invPaidAtRow.style.display = '';
    } else {
      els.invPaidAtRow.style.display = 'none';
    }
    if (order.cleaning_date) {
      els.invCleanedAt.textContent = formatInvoiceDate(order.cleaning_date);
      els.invCleanedAtRow.style.display = '';
    } else {
      els.invCleanedAtRow.style.display = 'none';
    }
    if (order.delivery_date) {
      els.invDeliveredAt.textContent = formatInvoiceDate(order.delivery_date);
      els.invDeliveredAtRow.style.display = '';
    } else {
      els.invDeliveredAtRow.style.display = 'none';
    }

    const _invCashier = order.cashier_name || order.created_by || '';
    if (_invCashier) {
      els.invCreatedBy.textContent = _invCashier;
      els.invCreatedByRow.style.display = '';
    } else {
      els.invCreatedByRow.style.display = 'none';
    }

    /* Customer */
    if (order.customer_name || order.phone) {
      els.invCustomerSection.style.display = '';
      if (order.customer_name) {
        els.invCustName.textContent = order.customer_name;
        els.invCustNameRow.style.display = '';
      } else {
        els.invCustNameRow.style.display = 'none';
      }
      if (order.phone) {
        els.invCustPhone.textContent = order.phone;
        els.invCustPhoneRow.style.display = '';
      } else {
        els.invCustPhoneRow.style.display = 'none';
      }
    } else {
      els.invCustomerSection.style.display = 'none';
    }

    /* Subscription info */
    if (subscription && (subscription.package_name || subscription.subscription_number)) {
      if (subscription.subscription_number && els.invSubRefRow) {
        els.invSubRef.textContent = subscription.subscription_number;
        els.invSubRefRow.style.display = '';
        els.invCustomerSection.style.display = '';
      } else if (els.invSubRefRow) {
        els.invSubRefRow.style.display = 'none';
      }
      if (subscription.package_name && els.invSubBalRow) {
        const bal = parseFloat(subscription.credit_remaining);
        if (!isNaN(bal)) {
          els.invSubBalance.innerHTML = '<span class="sar">&#xE900;</span> ' + fmtLtr(bal);
          els.invSubBalRow.style.display = '';
          els.invCustomerSection.style.display = '';
        } else {
          els.invSubBalRow.style.display = 'none';
        }
      } else if (els.invSubBalRow) {
        els.invSubBalRow.style.display = 'none';
      }
    } else {
      if (els.invSubRefRow) els.invSubRefRow.style.display = 'none';
      if (els.invSubBalRow) els.invSubBalRow.style.display = 'none';
    }

    fixCrInfoGridLastCell();

    /* Items — نفس منطق شاشة البيع */
    const sarSpan = '<span class="sar">&#xE900;</span>';
    els.invItemsTbody.innerHTML = (items || []).map(item => {
      const nameAr = escHtml(item.product_name_ar || '');
      const nameEn = escHtml(item.product_name_en || '');
      const svcAr  = escHtml(item.service_name_ar || '');
      const svcEn  = escHtml(item.service_name_en || '');

      const productCell = nameAr + (nameEn && nameEn !== nameAr ? `<span class="inv-td-en">${nameEn}</span>` : '');
      const serviceCell = svcAr + (svcEn && svcEn !== svcAr ? `<span class="inv-td-en">${svcEn}</span>` : '');

      return `<tr>
        <td class="inv-td-name">${productCell}</td>
        <td class="inv-td-num">${item.quantity}</td>
        <td class="inv-td-amt">${fmtLtr(item.line_total)}</td>
        <td class="inv-td-name">${serviceCell || '—'}</td>
      </tr>`;
    }).join('');

    /* Totals */
    const subtotal  = parseFloat(order.subtotal || 0);
    const discount  = parseFloat(order.discount_amount || 0);
    const extra     = parseFloat(order.extra_amount || 0);
    const vatRate   = parseFloat(order.vat_rate || 0);
    const vatAmount = parseFloat(order.vat_amount || 0);
    const total     = parseFloat(order.total_amount || 0);
    const isInclusive = order.price_display_mode === 'inclusive';
    const discountLabel = order.discount_label || 'الخصم';

    if (isInclusive && vatRate > 0) {
      const netBeforeTax = subtotal * 100 / (100 + vatRate);
      els.invSubtotal.innerHTML = sarFmt(netBeforeTax);
      if (discount > 0) {
        els.invDiscount.innerHTML = sarFmt(discount);
        els.invDiscRow.style.display = '';
        var discLabelEl = els.invDiscRow.querySelector('.inv-total-label');
        if (discLabelEl) discLabelEl.textContent = discountLabel;
        els.invAfterDiscount.innerHTML = sarFmt(netBeforeTax - discount);
        els.invAfterDiscRow.style.display = '';
      } else {
        els.invDiscRow.style.display = 'none';
        els.invAfterDiscRow.style.display = 'none';
      }
      if (extra > 0) {
        els.invExtra.innerHTML = sarFmt(extra);
        els.invExtraRow.style.display = '';
      } else {
        els.invExtraRow.style.display = 'none';
      }
      if (vatAmount > 0) {
        els.invVatLabel.textContent = `ضريبة القيمة المضافة (${vatRate}%)`;
        els.invVat.innerHTML = sarFmt(vatAmount);
        els.invVatRow.style.display = '';
        if (els.invSubtotalLabel) els.invSubtotalLabel.textContent = 'المجموع قبل الضريبة';
        if (els.invTotalLabel) els.invTotalLabel.textContent = 'الإجمالي شامل الضريبة';
      } else {
        els.invVatRow.style.display = 'none';
        if (els.invSubtotalLabel) els.invSubtotalLabel.textContent = 'المجموع';
        if (els.invTotalLabel) els.invTotalLabel.textContent = 'الإجمالي';
      }
    } else {
      els.invSubtotal.innerHTML = sarFmt(subtotal);
      if (discount > 0) {
        els.invDiscount.innerHTML = sarFmt(discount);
        els.invDiscRow.style.display = '';
        var discLabelEl2 = els.invDiscRow.querySelector('.inv-total-label');
        if (discLabelEl2) discLabelEl2.textContent = discountLabel;
        els.invAfterDiscount.innerHTML = sarFmt(subtotal - discount);
        els.invAfterDiscRow.style.display = '';
      } else {
        els.invDiscRow.style.display = 'none';
        els.invAfterDiscRow.style.display = 'none';
      }
      if (extra > 0) {
        els.invExtra.innerHTML = sarFmt(extra);
        els.invExtraRow.style.display = '';
      } else {
        els.invExtraRow.style.display = 'none';
      }
      if (vatRate > 0 && vatAmount > 0) {
        els.invVatLabel.textContent = `ضريبة القيمة المضافة (${vatRate}%)`;
        els.invVat.innerHTML = sarFmt(vatAmount);
        els.invVatRow.style.display = '';
        // Update labels when tax exists
        if (els.invSubtotalLabel) els.invSubtotalLabel.textContent = 'المجموع قبل الضريبة';
        if (els.invTotalLabel) els.invTotalLabel.textContent = 'الإجمالي شامل الضريبة';
      } else {
        els.invVatRow.style.display = 'none';
        // Update labels when no tax
        if (els.invSubtotalLabel) els.invSubtotalLabel.textContent = 'المجموع';
        if (els.invTotalLabel) els.invTotalLabel.textContent = 'الإجمالي';
      }
    }

    els.invTotal.innerHTML = sarFmt(total);

    /* Mixed payment breakdown */
    const isMixed = String(order.payment_method || '') === 'mixed';
    const pc = parseFloat(order.paid_cash || 0);
    const pd = parseFloat(order.paid_card || 0);
    if (els.invMixedCashRow && els.invMixedCardRow) {
      if (isMixed && (pc > 0 || pd > 0)) {
        if (els.invMixedCash) els.invMixedCash.innerHTML = sarFmt(pc);
        if (els.invMixedCard) els.invMixedCard.innerHTML = sarFmt(pd);
        els.invMixedCashRow.style.display = '';
        els.invMixedCardRow.style.display = '';
      } else {
        els.invMixedCashRow.style.display = 'none';
        els.invMixedCardRow.style.display = 'none';
      }
    }

    /* Partial / deferred payment */
    const paidAmount = parseFloat(order.paid_amount || 0);
    const remainingAmount = parseFloat(order.remaining_amount || 0);
    const isDeferred = String(order.payment_method || '') === 'deferred' || remainingAmount > 0;
    if (els.invPaidRow && els.invRemainingRow) {
      if (isDeferred) {
        if (els.invPaidAmount) els.invPaidAmount.innerHTML = sarFmt(paidAmount);
        if (els.invRemainingAmount) els.invRemainingAmount.innerHTML = sarFmt(remainingAmount);
        els.invPaidRow.style.display = '';
        els.invRemainingRow.style.display = '';
      } else {
        els.invPaidRow.style.display = 'none';
        els.invRemainingRow.style.display = 'none';
      }
    }

    /* Extra options (starch / bluing) */
    const hasStarch = order.starch && String(order.starch).trim();
    const hasBluing = order.bluing && String(order.bluing).trim();
    const invExtraOpts = document.getElementById('invExtraOpts');
    if (invExtraOpts) invExtraOpts.style.display = (hasStarch || hasBluing) ? '' : 'none';
    const invStarchRow = document.getElementById('invStarchRow');
    const invStarch = document.getElementById('invStarch');
    if (invStarchRow && invStarch) {
      if (hasStarch) { invStarch.textContent = order.starch; invStarchRow.style.display = ''; }
      else { invStarchRow.style.display = 'none'; }
    }
    const invBluingRow = document.getElementById('invBluingRow');
    const invBluing = document.getElementById('invBluing');
    if (invBluingRow && invBluing) {
      if (hasBluing) { invBluing.textContent = order.bluing; invBluingRow.style.display = ''; }
      else { invBluingRow.style.display = 'none'; }
    }

    /* Footer notes */
    const invFooterNotes = document.getElementById('invFooterNotes');
    if (invFooterNotes) {
      if (s.invoiceNotes) {
        const invNotesContent = document.getElementById('invNotesContent');
        if (invNotesContent) invNotesContent.textContent = s.invoiceNotes;
        invFooterNotes.style.display = '';
      } else {
        invFooterNotes.style.display = 'none';
      }
    }

    /* Barcode */
    if (s.showBarcodeInInvoice !== false) {
      renderInvoiceBarcode(displaySeq);
      if (els.invBarcode && els.invBarcode.closest('.inv-barcode-wrap')) {
        els.invBarcode.closest('.inv-barcode-wrap').style.display = '';
      }
    } else {
      if (els.invBarcode) els.invBarcode.innerHTML = '';
      if (els.invBarcode && els.invBarcode.closest('.inv-barcode-wrap')) {
        els.invBarcode.closest('.inv-barcode-wrap').style.display = 'none';
      }
    }

    /* QR Code — use stored zatca_qr from DB when available */
    if (vatRate > 0) {
      renderQR(shopName, s.vatNumber, isoTimestamp(order.created_at), fmtLtr(total), fmtLtr(vatAmount), order.zatca_qr || null);
    } else {
      els.invQR.innerHTML = '';
    }

    /* Build A4 data snapshot */
    const isInclusiveA4 = order.price_display_mode === 'inclusive';
    const subtotalA4 = (isInclusiveA4 && vatRate > 0) ? (subtotal * 100 / (100 + vatRate)) : subtotal;

    state.lastA4Data = {
      shopNameAr:         s.laundryNameAr || '',
      shopNameEn:         s.laundryNameEn || '',
      shopAddressAr:      addressParts.length ? addressParts.join('، ') : (s.locationAr || ''),
      shopAddressEn:      s.locationEn || '',
      shopPhone:          s.phone || '',
      shopEmail:          s.email || '',
      invoiceNotes:       s.invoiceNotes || '',
      logoDataUrl:        s.logoDataUrl || '',
      orderNum:           displaySeq ? String(displaySeq) : (order.order_number || '—'),
      date:               formatInvoiceDate(order.created_at),
      payment:            paymentLabel(order.payment_method),
      titleAr:            vatRate === 0 ? '' : (order.customer_vat ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة'),
      titleEn:            vatRate === 0 ? '' : (order.customer_vat ? 'Tax Invoice' : 'Simplified Tax Invoice'),
      custName:           order.customer_name || '',
      custPhone:          order.phone || '',
      custVat:            order.customer_vat || '',
      subRef:             subscription && subscription.subscription_number ? subscription.subscription_number : '',
      subPackageName:     subscription && subscription.package_name ? subscription.package_name : '',
      subBalance:         subscription && subscription.credit_remaining != null ? parseFloat(subscription.credit_remaining) : null,
      cleanedAt:          order.cleaning_date ? formatInvoiceDate(order.cleaning_date) : '',
      deliveredAt:        order.delivery_date ? formatInvoiceDate(order.delivery_date) : '',
      paidAt:             order.paid_at       ? formatInvoiceDate(order.paid_at)       : '',
      items: (items || []).map(item => ({
        productAr:  item.product_name_ar || '',
        productEn:  item.product_name_en || '',
        serviceAr:  item.service_name_ar || '',
        serviceEn:  item.service_name_en || '',
        qty:        item.quantity,
        unitPrice:  parseFloat(item.unit_price || 0),
        lineTotal:  parseFloat(item.line_total || 0)
      })),
      subtotal:         subtotalA4,
      discount:         discount,
      discountLabel:    order.discount_label || '',
      extra:            extra,
      vatRate:          vatRate,
      vatAmount:        vatAmount,
      total:            total,
      paidCash:         isMixed ? pc : 0,
      paidCard:         isMixed ? pd : 0,
      paidAmount:       parseFloat(order.paid_amount || 0),
      remainingAmount:  parseFloat(order.remaining_amount || 0),
      starch:           order.starch || '',
      bluing:           order.bluing || '',
      cashierName:      order.cashier_name || order.created_by || '',
      priceDisplayMode: isInclusiveA4 ? 'inclusive' : 'exclusive',
      customFields: Array.isArray(s.customFields) ? s.customFields : [],
      qrPayload: vatRate > 0 ? {
        sellerName:  shopName,
        vatNumber:   s.vatNumber || '',
        timestamp:   isoTimestamp(order.created_at),
        totalAmount: fmtLtr(total),
        vatAmount:   fmtLtr(vatAmount),
        tlvBase64:   order.zatca_qr || null
      } : null,
      autoPrint: false,
      isRefund: !!order.is_refund,
    };

    /* ── Show modal (thermal or A4) ── */
    applyInvoiceTypeClass();
    const paperTypeA4 = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    if (paperTypeA4 === 'a4') {
      fillA4InvoiceModal(state.lastA4Data);
    }
    els.invoiceViewModal.style.display = 'flex';
    document.querySelector('.inv-dialog-body').scrollTop = 0;
  }

  /* ========== BARCODE ========== */
  function renderInvoiceBarcode(invoiceSeq) {
    if (!els.invBarcode) return;
    if (invoiceSeq) {
      try {
        JsBarcode(els.invBarcode, String(invoiceSeq), {
          format: 'CODE128',
          width: 3,
          height: 50,
          displayValue: true,
          fontSize: 14,
          margin: 0,
          background: 'transparent'
        });
      } catch (e) {
        els.invBarcode.innerHTML = '';
      }
    } else {
      els.invBarcode.innerHTML = '';
    }
  }

  /* ========== QR CODE ========== */
  function renderQR(sellerName, vatNumber, timestamp, totalAmount, vatAmount, tlvBase64) {
    const qrEl = els.invQR;
    qrEl.innerHTML = '';
    const payload = tlvBase64
      ? { tlvBase64 }
      : { sellerName, vatNumber, timestamp, totalAmount, vatAmount };
    window.api.generateZatcaQR(payload)
      .then(res => {
        if (res && res.success && res.svg) {
          qrEl.innerHTML = res.svg;
        }
      })
      .catch(() => {});
  }

  function getPrintCopies() {
    const copies = Number(state.appSettings && state.appSettings.printCopies);
    if (!Number.isFinite(copies)) return 1;
    const intCopies = Math.floor(copies);
    if (intCopies < 0) return 1;
    if (intCopies > 20) return 20;
    return intCopies;
  }

  function printInvoiceByCopies() {
    const paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    const copies = getPrintCopies();
    if (copies === 0) return;
    let styleEl = null;

    styleEl = document.createElement('style');
    styleEl.id = 'printPageStyle';
    if (paperType === 'a4') {
      styleEl.textContent = '@page { size: A4 portrait; margin: 0; }';
    } else {
      const mLeft = parseFloat((state.appSettings && state.appSettings.thermalMarginLeft) || 0) || 0;
      const mRight = parseFloat((state.appSettings && state.appSettings.thermalMarginRight) || 0) || 0;
      const shift = mLeft - mRight;
      styleEl.textContent = `@page { size: 80mm auto; margin: 0; } @media print { .inv-paper { width: 76mm !important; max-width: 76mm !important; margin: 0 auto !important;${shift !== 0 ? ` transform: translateX(${shift}mm) !important;` : ''} } }`;
    }
    document.head.appendChild(styleEl);

    let currentCopy = 0;
    let cleaned = false;

    function cleanupPrintArtifacts() {
      if (cleaned) return;
      cleaned = true;
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    }

    function printNextCopy() {
      if (currentCopy >= copies) {
        cleanupPrintArtifacts();
        return;
      }

      currentCopy += 1;
      let handled = false;
      function handleAfterPrint() {
        if (handled) return;
        handled = true;
        window.removeEventListener('afterprint', handleAfterPrint);
        if (currentCopy < copies) {
          setTimeout(printNextCopy, 120);
        } else {
          cleanupPrintArtifacts();
        }
      }

      window.addEventListener('afterprint', handleAfterPrint);
      window.print();
      setTimeout(handleAfterPrint, 2500);
    }

    printNextCopy();
  }

  /* ========== EVENTS ========== */
  function bindEvents() {
    els.btnBack.addEventListener('click', () => window.api.navigateTo('dashboard'));

    els.searchInput.addEventListener('input', () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => {
        state.search = els.searchInput.value.trim();
        state.page = 1;
        loadOrders();
      }, 400);
    });

    els.btnFirstPage.addEventListener('click', () => { state.page = 1; loadOrders(); });
    els.btnPrevPage.addEventListener('click', () => { if (state.page > 1) { state.page--; loadOrders(); } });
    els.btnNextPage.addEventListener('click', () => { if (state.page < state.totalPages) { state.page++; loadOrders(); } });
    els.btnLastPage.addEventListener('click', () => { state.page = state.totalPages; loadOrders(); });

    els.pageSizeSelect.addEventListener('change', () => {
      state.pageSize = parseInt(els.pageSizeSelect.value, 10);
      state.page = 1;
      loadOrders();
    });

    /* Invoice modal */
    els.btnInvClose.addEventListener('click', closeInvoiceModal);
    els.invoiceViewModal.addEventListener('click', (e) => {
      if (e.target === els.invoiceViewModal) closeInvoiceModal();
    });
    els.btnInvPrint.addEventListener('click', () => {
      printInvoiceByCopies();
    });
    
    els.btnInvExportPdf.addEventListener('click', async () => {
      console.log('PDF Export button clicked, viewingOrderId:', state.viewingOrderId);
      if (!state.viewingOrderId) {
        showToast('معرف الفاتورة غير موجود', 'error');
        console.error('viewingOrderId is null or undefined');
        return;
      }
      try {
        els.btnInvExportPdf.disabled = true;
        els.btnInvExportPdf.innerHTML = '<span>جارٍ التصدير...</span>';
        
        // التقاط HTML الفاتورة الظاهرة حالياً (نفس تصميم الطباعة)
        const paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
        const paperEl = paperType === 'a4'
          ? document.getElementById('invoicePaperA4m')
          : document.getElementById('invoicePaper');
        
        if (!paperEl) {
          showToast('لم يتم العثور على محتوى الفاتورة', 'error');
          els.btnInvExportPdf.disabled = false;
          els.btnInvExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>تصدير PDF</span>';
          return;
        }
        
        const invoiceHTML = paperEl.outerHTML;
        const orderNum = document.getElementById('invOrderNum') ? document.getElementById('invOrderNum').textContent : '';
        
        console.log('Sending invoice HTML to server for PDF conversion, paperType:', paperType);
        const result = await window.api.exportInvoicePdfFromHtml({ html: invoiceHTML, paperType, orderNum });
        console.log('Export result:', result);
        
        if (result.success) {
          showToast('تم تنزيل ملف PDF بنجاح', 'success');
        } else {
          showToast(result.message || 'فشل تصدير PDF', 'error');
        }
        
        els.btnInvExportPdf.disabled = false;
        els.btnInvExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>تصدير PDF</span>';
      } catch (err) {
        console.error('خطأ في تصدير PDF:', err);
        showToast('حدث خطأ أثناء التصدير', 'error');
        els.btnInvExportPdf.disabled = false;
        els.btnInvExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>تصدير PDF</span>';
      }
    });

    els.btnRefundConfirm.addEventListener('click', confirmRefund);
    function closeRefundModal() {
      els.refundModal.style.display = 'none';
      refundTargetOrderId = null;
    }
    els.btnRefundCancel.addEventListener('click', closeRefundModal);
    els.btnRefundClose.addEventListener('click', closeRefundModal);
    els.refundModal.addEventListener('click', (e) => {
      if (e.target === els.refundModal) closeRefundModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.invoiceViewModal.style.display !== 'none') {
        closeInvoiceModal();
      }
    });
  }

  function closeInvoiceModal() {
    els.invoiceViewModal.style.display = 'none';
    document.body.classList.remove('invtype-a4');
    if (window.self !== window.top) {
      window.parent.postMessage('doc-viewer-close', '*');
    }
  }

  /* ========== START ========== */
  window.addEventListener('DOMContentLoaded', init);

  // ── معالجة وضع iframe: إخفاء عناصر الواجهة والاستجابة لـ postMessage ──
  window.addEventListener('DOMContentLoaded', () => {
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      // إخفاء header و toolbar و table — إبقاء المودال فقط
      const hideSelectors = ['.header-bar', '.toolbar', '.table-container', '.table-scroll-hint'];
      hideSelectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
      });
      // إبقاء زر إغلاق مرئياً — يُغلق الـ iframe ويعود للتقرير عبر postMessage
    }

    // الاستجابة لأوامر من المودال الأب (طباعة / تصدير PDF)
    window.addEventListener('message', (e) => {
      if (!e.data || !e.data.action) return;
      if (e.data.action === 'printInvoice') {
        printInvoiceByCopies();
      } else if (e.data.action === 'exportPdf') {
        const btn = document.getElementById('btnInvExportPdf');
        if (btn) btn.click();
      }
    });
  });

})();
