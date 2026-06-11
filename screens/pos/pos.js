(function () {
  'use strict';

  /* ========== STATE ========== */
  var _lastKnownWaStatus = null;

  const state = {
    products: [],
    services: [],
    cart: [],
    selectedCustomer: null,
    searchTerm: '',
    paymentMethod: 'cash',
    discountType: 'flat',
    vatRate: 15,
    priceDisplayMode: 'exclusive',
    discount: 0,
    extra: 0,
    customerSearchTimer: null,
    subSearchTimer: null,
    subMode: 'new',
    isMobileProductsView: true,
    appSettings: null,
    activeTab: 'sale',
    deferredInvoices: [],
    deferredPage: 1,
    deferredPageSize: 20,
    deferredSearchTimer: null,
    deferredSubSearchTimer: null,
    deferredStatusFilter: 'unpaid',
    deferredInvoiceSearchMode: false,
    deferredSubSearch: '',
    deferredFilteredInvoices: [],
    deferredPayingOrder: null,
    viewingDeferredInvoice: null,
    cameraScanner: null,
    viewingOrderId: null,
    lastA4Data: null,
    mixedCash: 0,
    mixedCard: 0,
    starch: '',
    bluing: '',
    selectedHanger: null,
    invoiceNotes: '',
    invoiceProcessMode: false,
    processingInvoice: null,
    _creditNoteModalMode: false,
    activeOffer: null,
    lastZatcaQr: null,
    refundSearchTarget: null,
    shouldClearCartAfterConsumptionPrint: true,
    loyaltySettings: null,
    loyaltyDiscount: 0,
    loyaltyPointsToRedeem: 0,
    customerLoyaltyBalance: 0,
  };

  /* ========== DOM REFS ========== */
  const els = {
    productSearch: document.getElementById('productSearch'),
    productsGrid: document.getElementById('productsGrid'),
    productsLoading: document.getElementById('productsLoading'),
    cartItemsList: document.getElementById('cartItemsList'),
    cartEmptyState: document.getElementById('cartEmptyState'),
    cartBadge: document.getElementById('cartBadge'),
    customerSearch: document.getElementById('customerSearch'),
    btnClearCustomer: document.getElementById('btnClearCustomer'),
    customerDropdown: document.getElementById('customerDropdown'),
    selectedCustomerChip: document.getElementById('selectedCustomerChip'),
    chipName: document.getElementById('chipName'),
    chipSubNumber: document.getElementById('chipSubNumber'),
    chipPhone: document.getElementById('chipPhone'),
    chipSubscription: document.getElementById('chipSubscription'),
    chipSubLabel: document.getElementById('chipSubLabel'),
    chipSubBalance: document.getElementById('chipSubBalance'),
    chipLoyaltyBadge: document.getElementById('chipLoyaltyBadge'),
    chipLoyaltyPoints: document.getElementById('chipLoyaltyPoints'),
    loyaltyRow: document.getElementById('loyaltyRow'),
    btnLoyaltyToggle: document.getElementById('btnLoyaltyToggle'),
    loyaltyBtnLabel: document.getElementById('loyaltyBtnLabel'),
    loyaltyAppliedBadge: document.getElementById('loyaltyAppliedBadge'),
    loyaltyPopup: document.getElementById('loyaltyPopup'),
    loyaltyPointsInput: document.getElementById('loyaltyPointsInput'),
    btnApplyLoyalty: document.getElementById('btnApplyLoyalty'),
    btnClearLoyalty: document.getElementById('btnClearLoyalty'),
    summaryLoyaltyDiscount: document.getElementById('summaryLoyaltyDiscount'),
    loyaltyAvailableHint: document.getElementById('loyaltyAvailableHint'),
    loyaltyModal: document.getElementById('loyaltyModal'),
    btnLoyaltyModalClose: document.getElementById('btnLoyaltyModalClose'),
    loyaltySheetInput: document.getElementById('loyaltySheetInput'),
    loyaltySheetHint: document.getElementById('loyaltySheetHint'),
    btnApplyLoyaltySheet: document.getElementById('btnApplyLoyaltySheet'),
    btnClearLoyaltySheet: document.getElementById('btnClearLoyaltySheet'),
    btnRemoveCustomer: document.getElementById('btnRemoveCustomer'),
    btnAddCustomer: document.getElementById('btnAddCustomer'),
    btnAddSubscription: document.getElementById('btnAddSubscription'),
    addSubscriptionModal: document.getElementById('addSubscriptionModal'),
    btnAddSubClose: document.getElementById('btnAddSubClose'),
    btnAddSubCancel: document.getElementById('btnAddSubCancel'),
    btnAddSubSave: document.getElementById('btnAddSubSave'),
    subSaveBtnLabel: document.getElementById('subSaveBtnLabel'),
    subModalTitle: document.getElementById('subModalTitle'),
    subTabNew: document.getElementById('subTabNew'),
    subTabRenew: document.getElementById('subTabRenew'),
    subCustomerSearch: document.getElementById('subCustomerSearch'),
    subCustomerInputInner: document.getElementById('subCustomerInputInner'),
    subCustomerId: document.getElementById('subCustomerId'),
    subCustomerDropdown: document.getElementById('subCustomerDropdown'),
    subCustomerChip: document.getElementById('subCustomerChip'),
    subCustomerChipName: document.getElementById('subCustomerChipName'),
    subCustomerChipPhone: document.getElementById('subCustomerChipPhone'),
    subCustomerSubscription: document.getElementById('subCustomerSubscription'),
    subChipSubLabel: document.getElementById('subChipSubLabel'),
    subChipSubBalance: document.getElementById('subChipSubBalance'),
    btnClearSubCustomer: document.getElementById('btnClearSubCustomer'),
    subPackageSelect: document.getElementById('subPackageSelect'),
    subStartDate: document.getElementById('subStartDate'),
    subEndDate: document.getElementById('subEndDate'),
    subRenewSubGroup: document.getElementById('subRenewSubGroup'),
    subRenewSubSelect: document.getElementById('subRenewSubSelect'),
    subCarryOver: document.getElementById('subCarryOver'),
    addSubError: document.getElementById('addSubError'),
    summarySubtotal: document.getElementById('summarySubtotal'),
    summaryDiscount: document.getElementById('summaryDiscount'),
    summaryVat: document.getElementById('summaryVat'),
    summaryTotal: document.getElementById('summaryTotal'),
    vatLabel: document.getElementById('vatLabel'),
    vatRow: document.getElementById('vatRow'),
    discountInput: document.getElementById('discountInput'),
    extraInput: document.getElementById('extraInput'),
    summaryExtra: document.getElementById('summaryExtra'),
    btnDiscFlat: document.getElementById('btnDiscFlat'),
    btnDiscPct: document.getElementById('btnDiscPct'),
    starchSelect: document.getElementById('starchSelect'),
    bluingSelect: document.getElementById('bluingSelect'),
    paymentSelect: document.getElementById('paymentSelect'),
    mixedPaySection:  document.getElementById('mixedPaySection'),
    mixedCashInline:  document.getElementById('mixedCashInline'),
    mixedCashInput:   document.getElementById('mixedCashInput'),
    mixedPayError:    document.getElementById('mixedPayError'),
    invoiceNotesInput: document.getElementById('invoiceNotesInput'),
    btnClearCart: document.getElementById('btnClearCart'),
    btnPay: document.getElementById('btnPay'),
    btnBack: document.getElementById('btnBack'),
    btnShowProducts: document.getElementById('btnShowProducts'),
    btnShowCart: document.getElementById('btnShowCart'),
    productsPanel: document.getElementById('productsPanel'),
    cartPanel: document.getElementById('cartPanel'),
    addCustomerModal: document.getElementById('addCustomerModal'),
    btnAddCustomerClose: document.getElementById('btnAddCustomerClose'),
    btnAddCustomerCancel: document.getElementById('btnAddCustomerCancel'),
    btnAddCustomerSave: document.getElementById('btnAddCustomerSave'),
    newCustomerName: document.getElementById('newCustomerName'),
    newCustomerPhone: document.getElementById('newCustomerPhone'),
    newCustomerCity: document.getElementById('newCustomerCity'),
    newCustomerEmail: document.getElementById('newCustomerEmail'),
    newCustomerNationalId: document.getElementById('newCustomerNationalId'),
    newCustomerTaxNumber: document.getElementById('newCustomerTaxNumber'),
    newCustomerType: document.getElementById('newCustomerType'),
    newCustomerIsActive: document.getElementById('newCustomerIsActive'),
    newCustomerStatusLabel: document.getElementById('newCustomerStatusLabel'),
    newCustomerAddress: document.getElementById('newCustomerAddress'),
    newCustomerNotes: document.getElementById('newCustomerNotes'),
    addCustomerError: document.getElementById('addCustomerError'),
    successModal: document.getElementById('successModal'),
    successOrderNum: document.getElementById('successOrderNum'),
    successTotal: document.getElementById('successTotal'),
    btnNewSale: document.getElementById('btnNewSale'),
    btnCloseSuccess: document.getElementById('btnCloseSuccess'),
    consumptionReceiptModal: document.getElementById('consumptionReceiptModal'),
    btnCrModalClose: document.getElementById('btnCrModalClose'),
    btnCrModalWhatsapp: document.getElementById('btnCrModalWhatsapp'),
    btnCrModalExportPdf: document.getElementById('btnCrModalExportPdf'),
    btnCrModalPrint: document.getElementById('btnCrModalPrint'),
    invoiceModal: document.getElementById('invoiceModal'),
    invoicePaper: document.getElementById('invoicePaper'),
    invLogoWrap: document.getElementById('invLogoWrap'),
    invLogo: document.getElementById('invLogo'),
    invShopName: document.getElementById('invShopName'),
    invShopAddress: document.getElementById('invShopAddress'),
    invShopPhone: document.getElementById('invShopPhone'),
    invShopEmail: document.getElementById('invShopEmail'),
    invOrderNum: document.getElementById('invOrderNum'),
    invDate: document.getElementById('invDate'),
    invVatNumber: document.getElementById('invVatNumber'),
    invCRRow: document.getElementById('invCRRow'),
    invCR: document.getElementById('invCR'),
    invCustomerSection: document.getElementById('invCustomerSection'),
    invCustNameRow: document.getElementById('invCustNameRow'),
    invCustName: document.getElementById('invCustName'),
    invCustPhoneRow: document.getElementById('invCustPhoneRow'),
    invCustPhone: document.getElementById('invCustPhone'),
    invCustVatRow: document.getElementById('invCustVatRow'),
    invCustVat: document.getElementById('invCustVat'),
    invSubSection: document.getElementById('invSubSection'),
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
    invVatRow: document.getElementById('invVatRow'),
    invVatLabel: document.getElementById('invVatLabel'),
    invVat: document.getElementById('invVat'),
    invTotalLabel: document.getElementById('invTotalLabel'),
    invTotal: document.getElementById('invTotal'),
    invMixedCashRow:  document.getElementById('invMixedCashRow'),
    invMixedCardRow:  document.getElementById('invMixedCardRow'),
    invMixedCash:     document.getElementById('invMixedCash'),
    invMixedCard:     document.getElementById('invMixedCard'),
    invPaidRow: document.getElementById('invPaidRow'),
    invPaidAmount: document.getElementById('invPaidAmount'),
    invRemainingRow: document.getElementById('invRemainingRow'),
    invRemainingAmount: document.getElementById('invRemainingAmount'),
    invPayment: document.getElementById('invPayment'),
    invPaidAtRow:     document.getElementById('invPaidAtRow'),
    invPaidAt:        document.getElementById('invPaidAt'),
    invCleanedAtRow:  document.getElementById('invCleanedAtRow'),
    invCleanedAt:     document.getElementById('invCleanedAt'),
    invDeliveredAtRow: document.getElementById('invDeliveredAtRow'),
    invDeliveredAt:   document.getElementById('invDeliveredAt'),
    invQR: document.getElementById('invQR'),
    invBarcode: document.getElementById('invBarcode'),
    invFooterEmail: document.getElementById('invFooterEmail'),
    btnInvPrint: document.getElementById('btnInvPrint'),
    btnInvExportPdf: document.getElementById('btnInvExportPdf'),
    btnInvWhatsapp: document.getElementById('btnInvWhatsapp'),
    btnInvNewSale: null,
    btnInvClose: document.getElementById('btnInvClose'),
    tabSale:               document.getElementById('tabSale'),
    tabDeferred:           document.getElementById('tabDeferred'),
    tabDeferredBadge:      document.getElementById('tabDeferredBadge'),
    tabSaleDesktop:        document.getElementById('tabSaleDesktop'),
    tabDeferredDesktop:    document.getElementById('tabDeferredDesktop'),
    tabDeferredBadgeDesktop: document.getElementById('tabDeferredBadgeDesktop'),
    saleView:              document.getElementById('saleView'),
    deferredView:          document.getElementById('deferredView'),
    deferredSearch:        document.getElementById('deferredSearch'),
    deferredSubSearch:     document.getElementById('deferredSubSearch'),
    deferredStatusFilter:  document.getElementById('deferredStatusFilter'),
    deferredStatusFilterMobile: document.getElementById('deferredStatusFilterMobile'),
    btnDeferredSearch:     document.getElementById('btnDeferredSearch'),
    deferredEmptyState:    document.getElementById('deferredEmptyState'),
    deferredList:          document.getElementById('deferredList'),
    defTableWrap:          document.getElementById('defTableWrap'),
    defPaginationBar:      document.getElementById('defPaginationBar'),
    defPaginationInfo:     document.getElementById('defPaginationInfo'),
    defPageNumbers:        document.getElementById('defPageNumbers'),
    defBtnFirst:           document.getElementById('defBtnFirst'),
    defBtnPrev:            document.getElementById('defBtnPrev'),
    defBtnNext:            document.getElementById('defBtnNext'),
    defBtnLast:            document.getElementById('defBtnLast'),
    defHeaderStats:        document.getElementById('defHeaderStats'),
    defStatCount:          document.getElementById('defStatCount'),
    defStatTotal:          document.getElementById('defStatTotal'),
    defSummaryCards:       document.getElementById('defSummaryCards'),
    defSummaryCount:       document.getElementById('defSummaryCount'),
    defSummaryTotal:       document.getElementById('defSummaryTotal'),
    deferredBarcodeInput: document.getElementById('deferredBarcodeInput'),
    btnCameraScan:         document.getElementById('btnCameraScan'),
    cameraScannerModal:    document.getElementById('cameraScannerModal'),
    cameraScannerView:     document.getElementById('cameraScannerView'),
    cameraScannerStatus:   document.getElementById('cameraScannerStatus'),
    cameraScannerResult:   document.getElementById('cameraScannerResult'),
    btnCloseCameraScanner: document.getElementById('btnCloseCameraScanner'),
    payDeferredModal:      document.getElementById('payDeferredModal'),
    payDeferredOrderId:    document.getElementById('payDeferredOrderId'),
    payDeferredError:      document.getElementById('payDeferredError'),
    payModalInvNum:        document.getElementById('payModalInvNum'),
    payModalCustName:      document.getElementById('payModalCustName'),
    payModalCustPhone:     document.getElementById('payModalCustPhone'),
    payModalTotalVal:      document.getElementById('payModalTotalVal'),
    payModalPaidVal:       document.getElementById('payModalPaidVal'),
    payModalRemainingVal:  document.getElementById('payModalRemainingVal'),
    payInputSection:       document.getElementById('payInputSection'),
    payAmountInput:        document.getElementById('payAmountInput'),
    payMethodSelect:       document.getElementById('payMethodSelect'),
    payMixedSection:       document.getElementById('payMixedSection'),
    payMixedCashInput:     document.getElementById('payMixedCashInput'),
    payAfterInfo:          document.getElementById('payAfterInfo'),
    payAfterVal:           document.getElementById('payAfterVal'),
    payFullyPaidBanner:    document.getElementById('payFullyPaidBanner'),
    payHistoryEmpty:       document.getElementById('payHistoryEmpty'),
    payHistoryList:        document.getElementById('payHistoryList'),
    payHistoryCount:       document.getElementById('payHistoryCount'),
    btnPayDeferredClose:   document.getElementById('btnPayDeferredClose'),
    btnPayDeferredCancel:  document.getElementById('btnPayDeferredCancel'),
    btnPayDeferredConfirm: document.getElementById('btnPayDeferredConfirm'),
    hangerSelect:          document.getElementById('hangerSelect'),
    btnPrintHangerTicket:  document.getElementById('btnPrintHangerTicket'),
    invHangerRow:          document.getElementById('invHangerRow'),
    invHangerNum:          document.getElementById('invHangerNum'),
    invoiceSeqInput:       document.getElementById('invoiceSeqInput'),
    btnProcessInvoice:     document.getElementById('btnProcessInvoice'),
    invProcIdle:           document.getElementById('invProcIdle'),
    invProcBanner:         document.getElementById('invProcBanner'),
    invProcOrigNum:        document.getElementById('invProcOrigNum'),
    invProcCust:           document.getElementById('invProcCust'),
    invProcCustSep:        document.getElementById('invProcCustSep'),
    btnCancelProcess:      document.getElementById('btnCancelProcess'),
    invProcError:          document.getElementById('invProcError'),
    creditNoteActions:     document.getElementById('creditNoteActions'),
    btnCreateCreditNote:   document.getElementById('btnCreateCreditNote'),
    creditNoteSuccessModal: document.getElementById('creditNoteSuccessModal'),
    cnSuccessNum:          document.getElementById('cnSuccessNum'),
    cnSuccessOrigNum:      document.getElementById('cnSuccessOrigNum'),
    cnSuccessTotalNum:     document.getElementById('cnSuccessTotalNum'),
    btnCnClose:            document.getElementById('btnCnClose'),
    invoiceProcessRow:     document.getElementById('invoiceProcessRow'),
    invTypeLabel:          document.getElementById('invTypeLabel'),
    invCNRefRow:           document.getElementById('invCNRefRow'),
    invCNRefText:          document.getElementById('invCNRefText'),
    invCNRefundRow:        document.getElementById('invCNRefundRow'),
    invCNRefundText:       document.getElementById('invCNRefundText'),
    invOrderNumRow:        document.getElementById('invOrderNumRow'),
    btnRefundConsumptionReceipt: document.getElementById('btnRefundConsumptionReceipt'),

    refundReceiptSearchModal: document.getElementById('refundReceiptSearchModal'),
    refundReceiptSearchInput: document.getElementById('refundReceiptSearchInput'),
    btnRefundSearch:           document.getElementById('btnRefundSearch'),
    btnRefundSearchClose:     document.getElementById('btnRefundSearchClose'),
    refundSearchResult:       document.getElementById('refundSearchResult'),
    refundSearchConfirmArea:  document.getElementById('refundSearchConfirmArea'),
    refundReceiptReasonInput: document.getElementById('refundReceiptReasonInput'),
    btnRefundConfirmReceipt:   document.getElementById('btnRefundConfirmReceipt'),

    // Consumption receipt modal - refund mode UI fields
    crModalAmountLabel:        document.getElementById('crModalAmountLabel'),
    crModalBalBeforeLabel:     document.getElementById('crModalBalBeforeLabel'),
    crModalBalAfterLabel:      document.getElementById('crModalBalAfterLabel'),
    crModalRefundNumRow:      document.getElementById('crModalRefundNumRow'),
    crModalRefundNum:         document.getElementById('crModalRefundNum'),
    crModalRefundReasonRow:   document.getElementById('crModalRefundReasonRow'),
    crModalRefundReason:      document.getElementById('crModalRefundReason'),
  };

  /* ========== UTILS ========== */
  function fmtLtr(n) {
    return Number(n || 0).toFixed(2);
  }

  function riyalHtml(amountStr) {
    return `<span class="amt-sar"><span class="sar">&#xE900;</span><span>${amountStr}</span></span>`;
  }

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  function getLang() {
    return window.I18N ? window.I18N.getLang() : 'ar';
  }

  function showToast(msg, type = 'info', duration = 2800) {
    const existing = document.querySelectorAll('.toast');
    existing.forEach((el) => el.remove());
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function showTopToast(msg, type = 'success', duration = 3000) {
    const existing = document.querySelectorAll('.toast-top');
    existing.forEach((el) => el.remove());
    const toast = document.createElement('div');
    toast.className = `toast-top toast-top-${type}`;

    const icon = type === 'success'
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    toast.innerHTML = `<span class="toast-top-icon">${icon}</span><span class="toast-top-msg">${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-top-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ========== PAYMENT METHODS ========== */
  const PAYMENT_METHOD_LABELS = {
    cash:   { ar: '💵  نقداً',         en: '💵  Cash' },
    card:   { ar: '💳  شبكة',          en: '💳  Card' },
    credit: { ar: '📋  آجل',           en: '📋  Credit' },
    mixed:  { ar: '🔀  مختلط',         en: '🔀  Mixed' },
    bank:   { ar: '🏦  تحويل بنكي',    en: '🏦  Bank Transfer' },
    subscription: { ar: '🔄  اشتراك',  en: '🔄  Subscription' },
  };

  function buildPaymentOptions(enabledMethods, defaultMethod) {
    const lang = getLang();
    const methods = Array.isArray(enabledMethods) && enabledMethods.length > 0
      ? enabledMethods
      : ['cash', 'card', 'credit', 'mixed', 'bank'];

    els.paymentSelect.innerHTML = methods.map(m => {
      const labels = PAYMENT_METHOD_LABELS[m];
      const label = labels ? (lang === 'ar' ? labels.ar : labels.en) : m;
      return `<option value="${m}">${label}</option>`;
    }).join('');

    // تطبيق طريقة الدفع الافتراضية من الإعدادات
    if (defaultMethod && methods.includes(defaultMethod)) {
      state.paymentMethod = defaultMethod;
    } else if (!methods.includes(state.paymentMethod)) {
      state.paymentMethod = methods[0] || 'cash';
    }
    els.paymentSelect.value = state.paymentMethod;
  }

  /* ========== INIT ========== */
  async function init() {
    bindEvents();
    if (window.matchMedia('(max-width: 767px)').matches) {
      showMobileProducts();
    }
    I18N.apply();

    const [settingsRes, offersRes, loyaltyRes] = await Promise.all([
      window.api.getAppSettings(),
      window.api.getActiveOffers(),
      window.api.getLoyaltySettings().catch(() => null)
    ]);

    if (loyaltyRes && loyaltyRes.success) {
      state.loyaltySettings = loyaltyRes.settings;
    }

    if (settingsRes && settingsRes.success && settingsRes.settings) {
      state.appSettings = settingsRes.settings;
      const vr = parseFloat(settingsRes.settings.vatRate);
      if (!isNaN(vr) && vr >= 0) {
        state.vatRate = vr;
      }
      state.priceDisplayMode = settingsRes.settings.priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive';
      buildPaymentOptions(settingsRes.settings.enabledPaymentMethods, settingsRes.settings.defaultPaymentMethod);
    } else {
      buildPaymentOptions(null);
    }

    // Load best active offer (highest discount value first)
    if (offersRes && offersRes.success && offersRes.offers && offersRes.offers.length > 0) {
      state.activeOffer = offersRes.offers[0];
    } else {
      state.activeOffer = null;
    }

    updateVatLabel();
    await Promise.all([loadServices(), loadProducts(), loadHangers()]);

    if (window.__currentUser) {
      applyPosPermissions();
    } else {
      window.addEventListener('userReady', applyPosPermissions, { once: true });
    }

    // مراقبة حالة اتصال الواتساب
    setInterval(async function() {
      try {
        const res = await window.api.whatsappGetStatus();
        const newStatus = res && res.status ? res.status : 'disconnected';
        if (_lastKnownWaStatus !== null) {
          if (newStatus === 'disconnected' && _lastKnownWaStatus === 'connected') {
            showTopToast('🔴 واتساب | انقطع الاتصال', 'error', 5000);
          } else if (newStatus === 'connected' && _lastKnownWaStatus !== 'connected') {
            showTopToast('🟢 واتساب | تم استعادة الاتصال', 'success', 4000);
          }
        }
        _lastKnownWaStatus = newStatus;
      } catch (_) {}
    }, 15000);
  }

  function applyPosPermissions() {
    const u = window.__currentUser;
    if (!u || u.role === 'admin') return;

    // Discount column
    if (!window.hasPermission('pos_discount')) {
      const discCol = els.discountInput && els.discountInput.closest('.de-col');
      if (discCol) discCol.style.display = 'none';
    }
    // Extra column
    if (!window.hasPermission('pos_extra')) {
      const extraCol = els.extraInput && els.extraInput.closest('.de-col');
      if (extraCol) extraCol.style.display = 'none';
    }
    // Process invoice button + search row
    if (!window.hasPermission('pos_process_invoice')) {
      if (els.btnProcessInvoice) els.btnProcessInvoice.style.display = 'none';
      if (els.invoiceProcessRow) els.invoiceProcessRow.style.display = 'none';
    }
    // Refund receipt button
    if (!window.hasPermission('pos_refund_receipt')) {
      if (els.btnRefundConsumptionReceipt) els.btnRefundConsumptionReceipt.style.display = 'none';
    }
    // Add customer button
    if (!window.hasPermission('customers')) {
      if (els.btnAddCustomer) els.btnAddCustomer.style.display = 'none';
    }
    // Add/renew subscription button
    if (!window.hasPermission('subscriptions')) {
      if (els.btnAddSubscription) els.btnAddSubscription.style.display = 'none';
    }
    // Hanger select
    if (!window.hasPermission('hangers')) {
      if (els.hangerSelect) els.hangerSelect.style.display = 'none';
    }
    // Deferred invoices tab
    if (!window.hasPermission('payment')) {
      const tabD  = document.getElementById('tabDeferred');
      const tabDD = document.getElementById('tabDeferredDesktop');
      if (tabD)  tabD.style.display  = 'none';
      if (tabDD) tabDD.style.display = 'none';
    }
  }

  function updateVatLabel() {
    if (state.vatRate > 0) {
      els.vatLabel.textContent = `${t('pos-vat')} (${state.vatRate}%)`;
      els.vatRow.style.display = '';
    } else {
      els.vatRow.style.display = 'none';
    }
  }

  /* ========== LOAD DATA ========== */
  async function loadServices() {
    const res = await window.api.getPosServices();
    if (!res || !res.success) return;
    state.services = res.services || [];
  }

  async function loadProducts() {
    showProductsLoading(true);

    try {
      const res = await window.api.getProductsForPosNoImages();

      if (!res || !res.success) {
        const fallback = await window.api.getPosProducts();
        state.products = (fallback && fallback.products) ? fallback.products : [];
      } else {
        state.products = res.products || [];
      }

    } catch (e) {
      try {
        const fallback = await window.api.getPosProducts();
        state.products = (fallback && fallback.products) ? fallback.products : [];
      } catch (_) {
        state.products = [];
      }
    }

    showProductsLoading(false);
    renderProducts();

    _loadImagesBackground(state.products.slice());
  }

  async function _loadImagesBackground(products) {
    if (!products || !products.length) return;

    const BATCH = 4;

    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH);

      await Promise.all(batch.map(async (product) => {
        try {
          const imgRes = await window.api.getProductImageById(product.id);

          if (imgRes && imgRes.success && imgRes.imageDataUrl) {
            const idx = state.products.findIndex(p => p.id === product.id);
            if (idx !== -1) {
              state.products[idx].imageDataUrl = imgRes.imageDataUrl;
            }

            const wrap = document.querySelector(`.product-img-wrap-lazy[data-product-id="${product.id}"]`);
            if (wrap && imgRes.imageDataUrl) {
              wrap.innerHTML = `<img data-product-id="${product.id}" src="${imgRes.imageDataUrl}" alt="${escHtml(product.name_ar || product.name_en || '')}" loading="lazy" decoding="async" style="opacity:1" />`;
            }
          }
        } catch (_err) {
          // ignore individual image errors
        }
      }));

      if (i + BATCH < products.length) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }

  function showProductsLoading(show) {
    els.productsLoading.style.display = show ? '' : 'none';
  }

  async function loadHangers() {
    try {
      const res = await window.api.getAvailableHangers();
      if (!res || !res.success) return;
      const hangers = res.hangers || [];
      const savedId = state.selectedHanger ? state.selectedHanger.id : null;
      els.hangerSelect.innerHTML = `<option value="">${t('pos-hanger-placeholder')}</option>` +
        hangers.map(h => `<option value="${h.id}">${t('hangers-title')} ${h.hanger_number}</option>`).join('');
      if (savedId) {
        const opt = els.hangerSelect.querySelector(`option[value="${savedId}"]`);
        if (opt) els.hangerSelect.value = savedId;
        else state.selectedHanger = null;
      }
    } catch (_) {}
  }

  function selectHanger(hangerId, hangerNumber) {
    if (!hangerId) return;
    state.selectedHanger = { id: hangerId, number: hangerNumber };
    els.hangerSelect.value = String(hangerId);
  }

  function clearHanger() {
    state.selectedHanger = null;
    els.hangerSelect.value = '';
  }

  /* ========== PRODUCTS GRID ========== */
  function getFilteredProducts() {
    let list = state.products;

    const term = state.searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((p) => {
        const nameAr = (p.name_ar || '').toLowerCase();
        const nameEn = (p.name_en || '').toLowerCase();
        return nameAr.includes(term) || nameEn.includes(term);
      });
    }

    return list;
  }

  function getPriceForDisplay(product) {
    if (!product.priceLines || !product.priceLines.length) return null;
    if (product.priceLines.length === 1) {
      return parseFloat(product.priceLines[0].price);
    }
    return null;
  }

  function renderProducts() {
    const lang = getLang();
    const list = getFilteredProducts();

    const existingCards = els.productsGrid.querySelectorAll('.product-card');
    existingCards.forEach((el) => el.remove());
    const existingState = els.productsGrid.querySelectorAll('.products-state:not(#productsLoading)');
    existingState.forEach((el) => el.remove());

    if (list.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'products-state';
      emptyDiv.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>${escHtml(t('pos-no-products'))}</p>
      `;
      els.productsGrid.appendChild(emptyDiv);
      return;
    }

    const fragment = document.createDocumentFragment();
    list.forEach((product) => {
      const card = createProductCard(product, lang);
      fragment.appendChild(card);
    });
    els.productsGrid.appendChild(fragment);
  }

  function renderProductsEmpty(msg) {
    const existingState = els.productsGrid.querySelectorAll('.products-state:not(#productsLoading)');
    existingState.forEach((el) => el.remove());
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'products-state';
    emptyDiv.innerHTML = `<p>${escHtml(msg)}</p>`;
    els.productsGrid.appendChild(emptyDiv);
  }

  function createProductCard(product, lang) {
    const nameAr = product.name_ar || product.name_en || '';
    const nameEn = product.name_en || product.name_ar || '';
    const displayPrice = getPriceForDisplay(product);
    const hasNoPrice = !product.priceLines || product.priceLines.length === 0;
    const hasImage = Number(product.has_image) === 1;

    const card = document.createElement('div');
    card.className = 'product-card' + (hasNoPrice ? ' no-price' : '');
    card.dataset.productId = product.id;

    let imgHtml;
    if (hasImage) {
      // استخدام Lazy Loading للصور
      imgHtml = `
        <div class="product-img-wrap-lazy" data-product-id="${product.id}">
          <div class="product-img-placeholder loading">
            <div class="img-spinner"></div>
          </div>
        </div>
      `;
    } else {
      imgHtml = `
        <div class="product-img-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>
      `;
    }

    let priceHtml;
    if (hasNoPrice) {
      priceHtml = `<span class="product-price" style="color:#94a3b8">${t('pos-no-price')}</span>`;
    } else if (displayPrice !== null) {
      priceHtml = `<span class="product-price">${riyalHtml(fmtLtr(displayPrice))}</span>`;
    } else {
      const minPrice = Math.min(...product.priceLines.map((pl) => parseFloat(pl.price)));
      priceHtml = `<span class="product-price">${riyalHtml(fmtLtr(minPrice))}</span>`;
    }

    const nameHtml = nameEn && nameEn !== nameAr
      ? `${escHtml(nameAr)}<span class="product-name-en">${escHtml(nameEn)}</span>`
      : escHtml(nameAr);

    card.innerHTML = `
      <div class="product-img-wrap">${imgHtml}</div>
      <div class="product-name">${nameHtml}</div>
    `;

    if (!hasNoPrice) {
      card.addEventListener('click', () => onProductClick(product));
    }

    // تفعيل Lazy Loading للصورة
    if (hasImage) {
      setupLazyLoadImage(card, product.id, nameAr);
    }

    return card;
  }

  /* ========== LAZY LOAD IMAGE (batched + persistent cache) ========== */
  const imageCache = new Map(); // productId -> dataUrl|null
  const pendingWraps = new Map(); // productId -> [wrapEl, ...]
  let batchQueue = new Set();
  let batchTimer = null;
  const BATCH_SIZE = 24;
  const BATCH_DELAY_MS = 20;
  const SESSION_CACHE_KEY = 'pos_img_cache_v1';

  // hydrate from sessionStorage once — only positive (non-null) entries,
  // so that products still get re-fetched if a previous session cached null by mistake.
  (function hydrateCache() {
    try {
      const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach((k) => {
          const id = parseInt(k, 10);
          const val = obj[k];
          if (id && typeof val === 'string' && val.startsWith('data:')) {
            imageCache.set(id, val);
          }
        });
      }
    } catch (_) {}
  })();

  function persistCacheDebounced() {
    if (persistCacheDebounced._t) return;
    persistCacheDebounced._t = setTimeout(() => {
      persistCacheDebounced._t = null;
      try {
        const obj = {};
        imageCache.forEach((v, k) => {
          // only persist positive results (actual data URLs)
          if (typeof v === 'string' && v.startsWith('data:')) obj[k] = v;
        });
        sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(obj));
      } catch (_) {
        // Quota exceeded: drop cache
        try { sessionStorage.removeItem(SESSION_CACHE_KEY); } catch (__) {}
      }
    }, 600);
  }

  const PLACEHOLDER_SVG = `
    <div class="product-img-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    </div>
  `;

  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const wrap = entry.target;
        const productId = parseInt(wrap.dataset.productId, 10);
        if (productId) {
          imageObserver.unobserve(wrap);
          enqueueImage(productId, wrap);
        }
      }
    });
  }, {
    rootMargin: '300px 0px',
    threshold: 0.01
  });

  function setupLazyLoadImage(card, productId, altText) {
    const wrap = card.querySelector('.product-img-wrap-lazy');
    if (!wrap) return;
    wrap.dataset.alt = altText || '';

    // إذا كانت الصورة محملة مسبقاً في الكاش
    if (imageCache.has(productId)) {
      applyImageToWrap(wrap, productId, imageCache.get(productId));
      return;
    }

    // مراقبة العنصر لتحميل الصورة عند ظهوره
    imageObserver.observe(wrap);
  }

  function applyImageToWrap(wrap, productId, dataUrl) {
    if (dataUrl) {
      const altText = wrap.dataset.alt || '';
      wrap.innerHTML = `<img data-product-id="${productId}" src="${dataUrl}" alt="${escHtml(altText)}" loading="lazy" decoding="async" />`;
    } else {
      wrap.innerHTML = PLACEHOLDER_SVG;
    }
  }

  function enqueueImage(productId, wrap) {
    if (imageCache.has(productId)) {
      applyImageToWrap(wrap, productId, imageCache.get(productId));
      return;
    }
    if (!pendingWraps.has(productId)) pendingWraps.set(productId, []);
    pendingWraps.get(productId).push(wrap);
    batchQueue.add(productId);

    if (batchQueue.size >= BATCH_SIZE) {
      flushBatch();
    } else if (!batchTimer) {
      batchTimer = setTimeout(flushBatch, BATCH_DELAY_MS);
    }
  }

  async function flushBatch() {
    if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
    if (!batchQueue.size) return;
    const ids = Array.from(batchQueue);
    batchQueue = new Set();

    try {
      const res = await window.api.getPosProductImages(ids);
      const images = (res && res.success && res.images) ? res.images : {};
      ids.forEach((id) => {
        const url = (id in images) ? images[id] : null;
        imageCache.set(id, url);
        const wraps = pendingWraps.get(id) || [];
        wraps.forEach((w) => applyImageToWrap(w, id, url));
        pendingWraps.delete(id);
      });
      persistCacheDebounced();
    } catch (_) {
      ids.forEach((id) => {
        imageCache.set(id, null);
        const wraps = pendingWraps.get(id) || [];
        wraps.forEach((w) => applyImageToWrap(w, id, null));
        pendingWraps.delete(id);
      });
    }
  }

  // Idle-time background prefetch of remaining product images
  function schedulePrefetch() {
    const ric = window.requestIdleCallback || function (cb) { return setTimeout(() => cb({ timeRemaining: () => 10 }), 200); };
    ric(() => {
      const remaining = [];
      for (const p of state.products) {
        if (Number(p.has_image) === 1 && !imageCache.has(p.id)) {
          remaining.push(p.id);
          if (remaining.length >= 48) break;
        }
      }
      if (!remaining.length) return;
      window.api.getPosProductImages(remaining).then((res) => {
        const images = (res && res.success && res.images) ? res.images : {};
        remaining.forEach((id) => {
          const url = (id in images) ? images[id] : null;
          imageCache.set(id, url);
          // update any DOM wraps still waiting
          const wraps = document.querySelectorAll(`.product-img-wrap-lazy[data-product-id="${id}"]`);
          wraps.forEach((w) => { if (!w.querySelector('img')) applyImageToWrap(w, id, url); });
        });
        persistCacheDebounced();
        // continue prefetching next chunk if any
        if (remaining.length === 48) schedulePrefetch();
      }).catch(() => {});
    }, { timeout: 2000 });
  }

  /* ========== PRODUCT CLICK → CART ========== */
  function onProductClick(product) {
    if (state.invoiceProcessMode) return;
    if (!product.priceLines || !product.priceLines.length) return;
    addToCart(product, product.priceLines[0]);
  }

  /* ========== CART OPERATIONS ========== */
  function addToCart(product, priceLine) {
    const lang = getLang();
    const key = `${product.id}_${priceLine.laundry_service_id}`;
    const existing = state.cart.find((item) => item.key === key);

    if (existing) {
      existing.qty += 1;
      existing.lineTotal = existing.qty * existing.unitPrice;
    } else {
      const unitPrice = parseFloat(priceLine.price);
      const productNameAr = product.name_ar || product.name_en || '';
      const productNameEn = product.name_en || product.name_ar || '';
      const serviceNameAr = priceLine.service_name_ar || priceLine.service_name_en || '';
      const serviceNameEn = priceLine.service_name_en || priceLine.service_name_ar || '';
      const serviceName = lang === 'ar' ? (serviceNameAr || serviceNameEn) : (serviceNameEn || serviceNameAr);
      state.cart.push({
        key,
        productId: product.id,
        serviceId: priceLine.laundry_service_id,
        productNameAr,
        productNameEn,
        serviceNameAr,
        serviceNameEn,
        serviceName,
        unitPrice,
        qty: 1,
        lineTotal: unitPrice
      });
    }

    renderCart();
    updateMobileCartBadge();

    if (window.matchMedia('(max-width: 767px)').matches && state.isMobileProductsView) {
      const productName = getLang() === 'ar'
        ? (product.name_ar || product.name_en || '')
        : (product.name_en || product.name_ar || '');
      showTopToast(`${escHtml(productName)} — ${t('pos-cart-added')}`, 'success', 1800);
    }
  }

  function removeFromCart(key) {
    state.cart = state.cart.filter((item) => item.key !== key);
    renderCart();
    updateMobileCartBadge();
  }

  function changeQty(key, delta) {
    const item = state.cart.find((i) => i.key === key);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    item.lineTotal = item.qty * item.unitPrice;
    renderCart();
    updateMobileCartBadge();
  }

  function setQty(key, qty) {
    const item = state.cart.find((i) => i.key === key);
    if (!item) return;
    item.qty = Math.max(1, qty);
    item.lineTotal = item.qty * item.unitPrice;
    renderCart();
    updateMobileCartBadge();
  }

  function clearCart() {
    state.cart = [];
    state.discount = 0;
    state.extra = 0;
    els.discountInput.value = '';
    if (els.extraInput) els.extraInput.value = '';
    clearCustomer();
    renderCart();
    updateMobileCartBadge();
  }

  /* ========== RENDER CART ========== */
  function renderCart() {
    const isEmpty = state.cart.length === 0;
    els.cartEmptyState.style.display = isEmpty ? '' : 'none';
    els.cartItemsList.innerHTML = '';

    const isProcessMode = state.invoiceProcessMode;

    if (!isEmpty) {
      const lang = getLang();
      const fragment = document.createDocumentFragment();
      state.cart.forEach((item) => {
        const product = state.products.find((p) => p.id === item.productId);
        const priceLines = (product && product.priceLines) || [];

        let serviceHtml;
        if (!isProcessMode && priceLines.length > 1) {
          const options = priceLines.map((pl) => {
            const svcAr = pl.service_name_ar || pl.service_name_en || '';
            const svcEn = pl.service_name_en || pl.service_name_ar || '';
            const label = svcAr && svcEn && svcAr !== svcEn ? `${svcAr} / ${svcEn}` : (svcAr || svcEn);
            const sel = pl.laundry_service_id === item.serviceId ? ' selected' : '';
            return `<option value="${pl.laundry_service_id}"${sel}>${escHtml(label)}</option>`;
          }).join('');
          serviceHtml = `<select class="cart-item-service-select" data-key="${escHtml(item.key)}">${options}</select>`;
        } else {
          const svcAr = item.serviceNameAr || '';
          const svcEn = item.serviceNameEn || '';
          const hasBoth = svcAr && svcEn && svcAr !== svcEn;
          serviceHtml = hasBoth
            ? `<span class="ci-service-tag"><span class="ci-svc-ar">${escHtml(svcAr)}</span><span class="ci-svc-sep">/</span><span class="ci-svc-en">${escHtml(svcEn)}</span></span>`
            : `<span class="ci-service-tag">${escHtml(svcAr || svcEn)}</span>`;
        }

        const row = document.createElement('div');
        row.className = 'cart-item' + (isProcessMode ? ' cart-item-readonly' : '');
        
        const nameHtml = item.productNameEn && item.productNameEn !== item.productNameAr
          ? `<span class="ci-name-ar">${escHtml(item.productNameAr)}</span><span class="ci-name-en">${escHtml(item.productNameEn)}</span>`
          : `<span class="ci-name-ar">${escHtml(item.productNameAr)}</span>`;
        
        if (isProcessMode) {
          row.innerHTML = `
            <div class="ci-row1">
              <span class="ci-name" title="${escHtml(item.productNameAr)}">${nameHtml}</span>
            </div>
            <div class="ci-row2">
              <div class="ci-service-wrap">${serviceHtml}</div>
              <div class="ci-qty-readonly">× ${item.qty}</div>
              <span class="ci-line-total">${riyalHtml(fmtLtr(item.lineTotal))}</span>
            </div>
          `;
        } else {
          row.innerHTML = `
            <div class="ci-row1">
              <span class="ci-name" title="${escHtml(item.productNameAr)}">${nameHtml}</span>
            </div>
            <div class="ci-row2">
              <div class="ci-service-wrap">${serviceHtml}</div>
              <div class="ci-qty-group">
                <button class="qty-btn plus" data-key="${escHtml(item.key)}" type="button">+</button>
                <input class="qty-display" type="text" inputmode="numeric" pattern="[0-9]*" value="${item.qty}" lang="en" dir="ltr" autocomplete="off" />
                <button class="qty-btn minus" data-key="${escHtml(item.key)}" type="button">−</button>
              </div>
              <span class="ci-line-total">${riyalHtml(fmtLtr(item.lineTotal))}</span>
              <button class="ci-remove" data-key="${escHtml(item.key)}" type="button">حذف</button>
            </div>
          `;

          row.querySelector('.minus').addEventListener('click', () => changeQty(item.key, -1));
          row.querySelector('.plus').addEventListener('click', () => changeQty(item.key, 1));
          row.querySelector('.ci-remove').addEventListener('click', () => removeFromCart(item.key));

          const qtyInput = row.querySelector('.qty-display');
          qtyInput.addEventListener('focus', () => qtyInput.select());
          qtyInput.addEventListener('blur', () => {
            const raw = qtyInput.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
            const v = parseInt(raw, 10);
            if (!isNaN(v) && v >= 1) setQty(item.key, v);
            else qtyInput.value = item.qty;
          });
          qtyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') qtyInput.blur();
            if (!/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)) e.preventDefault();
          });

          const sel = row.querySelector('.cart-item-service-select');
          if (sel) {
            sel.addEventListener('change', () => changeItemService(item.key, parseInt(sel.value, 10)));
          }
        }

        fragment.appendChild(row);
      });
      els.cartItemsList.appendChild(fragment);
    }

    if (!isProcessMode) {
      els.btnClearCart.disabled = isEmpty;
      els.btnPay.disabled = isEmpty;
    }
    updateSummary();
  }

  /* ========== CHANGE SERVICE IN CART ========== */
  function changeItemService(oldKey, newServiceId) {
    const lang = getLang();
    const itemIdx = state.cart.findIndex((i) => i.key === oldKey);
    if (itemIdx === -1) return;

    const item = state.cart[itemIdx];
    const product = state.products.find((p) => p.id === item.productId);
    if (!product) return;

    const newLine = product.priceLines.find((pl) => pl.laundry_service_id === newServiceId);
    if (!newLine) return;

    const newKey = `${item.productId}_${newServiceId}`;
    const newUnitPrice = parseFloat(newLine.price);
    const newServiceNameAr = newLine.service_name_ar || newLine.service_name_en || '';
    const newServiceNameEn = newLine.service_name_en || newLine.service_name_ar || '';
    const newServiceName = lang === 'ar' ? (newServiceNameAr || newServiceNameEn) : (newServiceNameEn || newServiceNameAr);

    const existingIdx = state.cart.findIndex((i) => i.key === newKey);
    if (existingIdx !== -1 && existingIdx !== itemIdx) {
      state.cart[existingIdx].qty += item.qty;
      state.cart[existingIdx].lineTotal = state.cart[existingIdx].qty * state.cart[existingIdx].unitPrice;
      state.cart.splice(itemIdx, 1);
    } else {
      item.key = newKey;
      item.serviceId = newServiceId;
      item.serviceNameAr = newServiceNameAr;
      item.serviceNameEn = newServiceNameEn;
      item.serviceName = newServiceName;
      item.unitPrice = newUnitPrice;
      item.lineTotal = item.qty * newUnitPrice;
    }

    renderCart();
    updateMobileCartBadge();
  }
  /* ========== SUMMARY CALCULATIONS ========== */

  /**
   * استخراج المبلغ قبل الضريبة من المبلغ الشامل
   * ZATCA: الخصم يجب أن يطبق دائماً على المبلغ قبل الضريبة
   */
  function getPreTaxBase(amount) {
    if (state.priceDisplayMode === 'inclusive' && state.vatRate > 0) {
      return amount * 100 / (100 + state.vatRate);
    }
    return amount;
  }

  function calcDiscount(subtotal) {
    // استخراج القاعدة الضريبية (قبل الضريبة) للخصم — متوافق مع هيئة الزكاة
    const base = getPreTaxBase(subtotal);

    // Manual discount (on pre-tax base)
    let manualDisc = 0;
    if (state.discountType === 'pct') {
      manualDisc = Math.min(Math.max(0, state.discount) / 100 * base, base);
    } else {
      manualDisc = Math.min(Math.max(0, state.discount), base);
    }

    // Offer discount (on pre-tax base)
    let offerDisc = 0;
    if (state.activeOffer && base > 0) {
      const offer = state.activeOffer;
      if (offer.discount_type === 'percentage') {
        offerDisc = Math.min(parseFloat(offer.discount_value) / 100 * base, base);
      } else {
        offerDisc = Math.min(parseFloat(offer.discount_value), base);
      }
    }

    // Loyalty discount (capped: total all discounts ≤ 90% of base)
    const loyaltyDisc = Math.max(0, state.loyaltyDiscount || 0);
    const combinedBeforeLoyalty = manualDisc + offerDisc;
    const maxTotal = base * 0.90;
    const loyaltyCapped = Math.min(loyaltyDisc, Math.max(0, maxTotal - combinedBeforeLoyalty));

    // Total discount (capped at 90% of pre-tax base)
    return Math.min(combinedBeforeLoyalty + loyaltyCapped, maxTotal);
  }

  function getOfferDiscountAmount(subtotal) {
    if (!state.activeOffer || subtotal <= 0) return 0;
    const base = getPreTaxBase(subtotal);
    const offer = state.activeOffer;
    if (offer.discount_type === 'percentage') {
      return Math.min(parseFloat(offer.discount_value) / 100 * base, base);
    }
    return Math.min(parseFloat(offer.discount_value), base);
  }

  /**
   * حساب الضريبة والإجمالي — متوافق مع هيئة الزكاة ZATCA
   * الخصم دائماً يطبق على المبلغ قبل الضريبة ثم تعاد حساب الضريبة
   */
  function calcTotalsFromSubtotal(subtotal, discount, extra) {
    // استخراج المبلغ قبل الضريبة
    const preTax = getPreTaxBase(subtotal);

    // تطبيق الخصم والإضافي على المبلغ قبل الضريبة
    const afterDiscount = Math.max(0, preTax - discount);
    const afterExtra = afterDiscount + (extra || 0);

    // حساب الضريبة على المبلغ بعد الخصم (دائماً نفس الطريقة)
    const vatAmount = state.vatRate > 0 ? afterExtra * state.vatRate / 100 : 0;
    const total = afterExtra + vatAmount;

    return { vatAmount, total };
  }

  function updateSummary() {
    const subtotal = state.cart.reduce((s, item) => s + item.lineTotal, 0);
    const discount = calcDiscount(subtotal);
    const extra = Math.max(0, state.extra || 0);
    const { vatAmount, total } = calcTotalsFromSubtotal(subtotal, discount, extra);

    // في وضع inclusive: المجموع المعروض = المبلغ الأصلي قبل الضريبة (قبل الخصم)
    const displaySubtotal = (state.priceDisplayMode === 'inclusive' && state.vatRate > 0)
      ? getPreTaxBase(subtotal)
      : subtotal;

    els.summarySubtotal.innerHTML = riyalHtml(fmtLtr(displaySubtotal));
    // عرض الخصم اليدوي فقط (بدون خصم النقاط — يظهر في زر النقاط)
    const manualDiscOnly = discount - Math.max(0, state.loyaltyDiscount || 0);
    const displayDisc = Math.max(0, manualDiscOnly);
    if (displayDisc > 0) {
      els.summaryDiscount.innerHTML = `<span class="amt-sar disc-neg"><span>−</span><span class="sar">&#xE900;</span><span>${fmtLtr(displayDisc)}</span></span>`;
      els.summaryDiscount.className = 'summary-amount discount-val has-discount';
      els.summaryDiscount.style.visibility = 'visible';
    } else {
      els.summaryDiscount.textContent = '';
      els.summaryDiscount.className = 'summary-amount discount-val';
      els.summaryDiscount.style.visibility = 'hidden';
    }
    if (extra > 0) {
      els.summaryExtra.innerHTML = riyalHtml(fmtLtr(extra));
      els.summaryExtra.className = 'summary-amount extra-val has-extra';
      els.summaryExtra.style.visibility = 'visible';
    } else {
      els.summaryExtra.textContent = '';
      els.summaryExtra.className = 'summary-amount extra-val';
      els.summaryExtra.style.visibility = 'hidden';
    }
    els.summaryVat.innerHTML = riyalHtml(fmtLtr(vatAmount));
    els.summaryTotal.innerHTML = riyalHtml(fmtLtr(total));

    // صف نقاط الولاء — القيمة مدمجة في الزر، لا حاجة لعرضها منفصلة

    if (state.paymentMethod === 'mixed') {
      updateMixedPayFields();
    }
  }

  function getOrderTotals() {
    const subtotal = state.cart.reduce((s, item) => s + item.lineTotal, 0);
    const discount = calcDiscount(subtotal);
    const extra = Math.max(0, state.extra || 0);
    const { vatAmount, total } = calcTotalsFromSubtotal(subtotal, discount, extra);
    return { subtotal, discount, extra, vatAmount, total };
  }

  function clampToTwo(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function updateMixedPayFields() {
    if (!els.mixedCashInput) return;
    const { total } = getOrderTotals();
    const rawCash = parseFloat(els.mixedCashInput.value) || 0;
    const cashClamped = Math.max(0, Math.min(rawCash, total));

    if (rawCash > total && total > 0) {
      els.mixedCashInput.value = total.toFixed(2);
      state.mixedCash = clampToTwo(total);
    } else {
      state.mixedCash = clampToTwo(cashClamped);
    }

    // الباقي تلقائياً يكون شبكة
    state.mixedCard = Math.max(0, clampToTwo(total - state.mixedCash));
    if (els.mixedPayError) els.mixedPayError.style.display = 'none';
  }

  function updatePayMixedFields() {
    if (!els.payMixedCashInput) return;
    const payAmt = num(els.payAmountInput && els.payAmountInput.value);
    const rawCash = parseFloat(els.payMixedCashInput.value) || 0;
    const cash = Math.max(0, Math.min(rawCash, payAmt));
    // الباقي تلقائياً يكون شبكة - لا حاجة لعرضه
  }

  /* ========== MOBILE CART BADGE ========== */
  function updateMobileCartBadge() {
    const count = state.cart.reduce((s, item) => s + item.qty, 0);
    if (count > 0) {
      els.cartBadge.textContent = count;
      els.cartBadge.style.display = 'inline-flex';
    } else {
      els.cartBadge.style.display = 'none';
    }
  }

  /* ========== CUSTOMER SEARCH ========== */
  async function searchCustomers(term) {
    if (!term || term.length < 1) {
      els.customerDropdown.style.display = 'none';
      return;
    }
    try {
      const res = await window.api.getCustomers({ search: term, page: 1, pageSize: 8 });
      if (!res || !res.success) return;
      const customers = res.customers || [];
      renderCustomerDropdown(customers);
    } catch (_) {}
  }

  function renderCustomerDropdown(customers) {
    if (!customers.length) {
      els.customerDropdown.style.display = 'none';
      return;
    }
    els.customerDropdown.innerHTML = customers.map((c) => {
      const status = c.sub_display_status;
      const remaining = parseFloat(c.sub_credit_remaining) || 0;
      let subBadge = '';
      if (status === 'active') {
        subBadge = `<span class="copt-sub copt-sub-active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
          ${escHtml(c.sub_package_name || 'اشتراك')} · متبقي: ${remaining.toFixed(2)} <span class="sar">&#xE900;</span>
        </span>`;
      } else if (status === 'expired') {
        subBadge = `<span class="copt-sub copt-sub-expired">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
          ${escHtml(c.sub_package_name || 'اشتراك')} · منتهي
        </span>`;
      }
      return `
        <div class="customer-option" data-id="${c.id}"
          data-name="${escHtml(c.customer_name || '')}"
          data-phone="${escHtml(c.phone || '')}"
          data-sub="${escHtml(c.subscription_number || '')}"
          data-tax="${escHtml(c.tax_number || '')}">
          <div class="customer-option-row">
            <div class="customer-option-name">${escHtml(c.customer_name || c.subscription_number)}</div>
            ${c.subscription_number ? `<span class="copt-sub-num">${escHtml(c.subscription_number)}</span>` : ''}
            ${subBadge}
          </div>
          <div class="customer-option-phone">${escHtml(c.phone || '')}</div>
        </div>
      `;
    }).join('');

    els.customerDropdown.querySelectorAll('.customer-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        selectCustomer({
          id: parseInt(opt.dataset.id, 10),
          name: opt.dataset.name,
          phone: opt.dataset.phone,
          subscription_number: opt.dataset.sub,
          taxNumber: opt.dataset.tax || ''
        });
      });
    });

    els.customerDropdown.style.display = '';
  }

  async function selectCustomer(customer) {
    state.selectedCustomer = customer;
    state.customerLoyaltyBalance = 0;
    els.customerDropdown.style.display = 'none';
    els.customerSearch.value = '';
    els.btnClearCustomer.style.display = 'none';

    els.chipName.textContent = customer.name || customer.phone;
    els.chipPhone.textContent = customer.phone || '';
    
    // عرض رقم الاشتراك إذا كان موجوداً
    if (customer.subscription_number && String(customer.subscription_number).trim()) {
      els.chipSubNumber.textContent = `اشتراك: ${customer.subscription_number}`;
      els.chipSubNumber.style.display = '';
    } else {
      els.chipSubNumber.style.display = 'none';
    }
    
    els.chipSubscription.style.display = 'none';
    els.selectedCustomerChip.style.display = 'flex';

    if (customer.id) {
      // جلب رصيد النقاط إذا كان النظام مفعلاً
      if (state.loyaltySettings && state.loyaltySettings.loyaltyEnabled) {
        try {
          const lr = await window.api.getCustomerLoyaltyBalance({ customerId: customer.id });
          if (lr && lr.success) {
            state.customerLoyaltyBalance = Number(lr.balance) || 0;
            const pts = state.customerLoyaltyBalance;
            const val = (pts * (state.loyaltySettings.loyaltySarPerPoint || 0.05)).toFixed(2);
            if (els.chipLoyaltyPoints) els.chipLoyaltyPoints.textContent = pts.toLocaleString();
            if (els.chipLoyaltyBadge) {
              els.chipLoyaltyBadge.title = `= ${val} ر.س`;
              els.chipLoyaltyBadge.style.display = pts > 0 ? '' : 'none';
            }
            if (els.loyaltyRow) els.loyaltyRow.style.display = 'flex';
            const hintText = `متاح: ${pts.toLocaleString()} نقطة = ${val} ر.س`;
            if (els.loyaltyAvailableHint) els.loyaltyAvailableHint.textContent = `(${hintText})`;
            if (els.loyaltySheetHint) els.loyaltySheetHint.textContent = hintText;
            if (els.loyaltyPointsInput) els.loyaltyPointsInput.max = pts;
            if (els.loyaltySheetInput) els.loyaltySheetInput.max = pts;
          }
        } catch (_) {}
      }

      try {
        const res = await window.api.getCustomerActiveSubscription({ customerId: customer.id });
        if (res && res.success && res.subscription) {
          const sub = res.subscription;
          const status = sub.display_status;
          const remaining = parseFloat(sub.credit_remaining) || 0;
          if (status === 'active') {
            els.chipSubLabel.textContent = sub.package_name || 'اشتراك نشط';
            els.chipSubBalance.innerHTML = `متبقي: <span>${remaining.toFixed(2)}</span> <span class="sar">&#xE900;</span>`;
            els.chipSubscription.className = 'chip-subscription chip-sub-active';
          } else if (status === 'expired') {
            els.chipSubLabel.textContent = sub.package_name || 'اشتراك منتهي';
            els.chipSubBalance.innerHTML = `متبقي: <span>${remaining.toFixed(2)}</span> <span class="sar">&#xE900;</span>`;
            els.chipSubscription.className = 'chip-subscription chip-sub-expired';
          } else {
            els.chipSubscription.style.display = 'none';
            return;
          }
          els.chipSubscription.style.display = 'flex';
        }
      } catch (_) {}
    }
  }

  function clearCustomer() {
    state.selectedCustomer = null;
    state.customerLoyaltyBalance = 0;
    els.customerSearch.value = '';
    els.btnClearCustomer.style.display = 'none';
    els.selectedCustomerChip.style.display = 'none';
    els.chipSubscription.style.display = 'none';
    els.customerDropdown.style.display = 'none';
    if (els.chipLoyaltyBadge) els.chipLoyaltyBadge.style.display = 'none';
    clearLoyaltyDiscount(true);
  }

  function clearLoyaltyDiscount(hideRow = false) {
    state.loyaltyDiscount = 0;
    state.loyaltyPointsToRedeem = 0;
    if (els.loyaltyRow) els.loyaltyRow.style.display = hideRow ? 'none' : 'flex';
    if (els.loyaltyPointsInput) els.loyaltyPointsInput.value = '';
    if (els.loyaltySheetInput) els.loyaltySheetInput.value = '';
    if (els.btnClearLoyalty) els.btnClearLoyalty.style.display = 'none';
    if (els.btnClearLoyaltySheet) els.btnClearLoyaltySheet.style.display = 'none';
    if (els.loyaltyPopup) els.loyaltyPopup.style.display = 'none';
    if (els.loyaltyModal) els.loyaltyModal.style.display = 'none';
    if (els.btnLoyaltyToggle) els.btnLoyaltyToggle.classList.remove('loyalty-active');
    if (els.loyaltyBtnLabel) els.loyaltyBtnLabel.textContent = 'النقاط';
    updateSummary();
  }

  function isMobile() { return window.innerWidth < 480; }

  function openLoyaltyUI() {
    const pts = state.customerLoyaltyBalance;
    const val = (pts * ((state.loyaltySettings && state.loyaltySettings.loyaltySarPerPoint) || 0.05)).toFixed(2);
    if (els.loyaltySheetHint) els.loyaltySheetHint.textContent = `متاح: ${pts.toLocaleString()} نقطة = ${val} ر.س`;
    if (els.loyaltySheetInput) {
      els.loyaltySheetInput.max = pts;
      els.loyaltySheetInput.value = state.loyaltyPointsToRedeem || '';
    }
    if (els.btnClearLoyaltySheet) {
      els.btnClearLoyaltySheet.style.display = state.loyaltyPointsToRedeem > 0 ? '' : 'none';
    }
    if (els.loyaltyModal) {
      els.loyaltyModal.style.display = 'flex';
      setTimeout(() => els.loyaltySheetInput && els.loyaltySheetInput.focus(), 100);
    }
  }

  function closeLoyaltyPopup() {
    if (els.loyaltyPopup) els.loyaltyPopup.style.display = 'none';
    if (els.loyaltyModal) els.loyaltyModal.style.display = 'none';
  }

  function applyLoyaltyPoints(pts) {
    if (!state.loyaltySettings || !state.loyaltySettings.loyaltyEnabled) return;
    const maxPts = state.customerLoyaltyBalance;
    const actualPts = Math.min(Math.max(0, Math.floor(pts)), maxPts);
    if (actualPts <= 0) { clearLoyaltyDiscount(); return; }
    const spp = state.loyaltySettings.loyaltySarPerPoint || 0.05;
    const subtotal = state.cart.reduce((s, item) => s + item.lineTotal, 0);
    const base = (state.priceDisplayMode === 'inclusive' && state.vatRate > 0)
      ? subtotal * 100 / (100 + state.vatRate) : subtotal;
    const maxDiscount = base * 0.90;
    const existingDisc = (() => {
      let md = 0;
      if (state.discountType === 'pct') md = Math.min(Math.max(0, state.discount) / 100 * base, base);
      else md = Math.min(Math.max(0, state.discount), base);
      return md;
    })();
    const available = Math.max(0, maxDiscount - existingDisc);
    const loyaltyDiscAmt = Math.min(actualPts * spp, available);
    const finalPts = Math.ceil(loyaltyDiscAmt / spp);
    state.loyaltyDiscount = Math.round(loyaltyDiscAmt * 100) / 100;
    state.loyaltyPointsToRedeem = finalPts;
    if (els.loyaltyPointsInput) els.loyaltyPointsInput.value = finalPts;
    if (els.btnClearLoyalty) els.btnClearLoyalty.style.display = '';
    if (els.btnLoyaltyToggle) els.btnLoyaltyToggle.classList.add('loyalty-active');
    if (els.loyaltyBtnLabel) els.loyaltyBtnLabel.textContent = '- ' + state.loyaltyDiscount.toFixed(2);
    closeLoyaltyPopup();
    updateSummary();
  }

  /* ========== ADD CUSTOMER MODAL ========== */
  function openAddCustomerModal() {
    els.newCustomerName.value = '';
    els.newCustomerPhone.value = '';
    els.newCustomerCity.value = '';
    els.newCustomerEmail.value = '';
    els.newCustomerNationalId.value = '';
    els.newCustomerTaxNumber.value = '';
    els.newCustomerType.value = 'individual';
    els.newCustomerIsActive.checked = true;
    els.newCustomerStatusLabel.textContent = I18N.t('pos-add-customer-status-active');
    els.newCustomerAddress.value = '';
    els.newCustomerNotes.value = '';
    els.addCustomerError.style.display = 'none';
    els.addCustomerModal.style.display = 'flex';
    setTimeout(() => els.newCustomerName.focus(), 80);
  }

  function closeAddCustomerModal() {
    els.addCustomerModal.style.display = 'none';
  }

  function showFormError(msg) {
    els.addCustomerError.textContent = msg;
    els.addCustomerError.style.display = '';
  }

  async function handleAddCustomer() {
    const name = els.newCustomerName.value.trim();
    const phone = els.newCustomerPhone.value.trim();

    if (!name) {
      showFormError('يرجى إدخال اسم العميل');
      els.newCustomerName.focus();
      return;
    }
    if (!phone) {
      showFormError('يرجى إدخال رقم الهاتف');
      els.newCustomerPhone.focus();
      return;
    }

    els.btnAddCustomerSave.disabled = true;
    els.addCustomerError.style.display = 'none';

    try {
      const res = await window.api.createCustomer({
        customerName: name,
        phone,
        city: els.newCustomerCity.value.trim() || null,
        email: els.newCustomerEmail.value.trim() || null,
        nationalId: els.newCustomerNationalId.value.trim() || null,
        taxNumber: els.newCustomerTaxNumber.value.trim() || null,
        customerType: els.newCustomerType.value || 'individual',
        address: els.newCustomerAddress.value.trim() || null,
        notes: els.newCustomerNotes.value.trim() || null,
        isActive: els.newCustomerIsActive.checked ? 1 : 0
      });

      if (!res || !res.success) {
        let msg = 'حدث خطأ أثناء الحفظ';
        if (res && res.code === 'NAME_DUPLICATE')  msg = 'اسم العميل مسجل مسبقاً، يرجى اختيار اسم آخر';
        if (res && res.code === 'PHONE_DUPLICATE') msg = 'رقم الهاتف مسجل مسبقاً لدى عميل آخر';
        if (res && res.code === 'PHONE_INVALID')   msg = 'رقم الهاتف غير صحيح';
        if (res && res.code === 'PHONE_TOO_LONG')  msg = 'رقم الهاتف طويل جداً';
        if (res && res.message && msg === 'حدث خطأ أثناء الحفظ') msg = res.message;
        showFormError(msg);
        return;
      }

      selectCustomer({ id: res.id, name, phone });
      closeAddCustomerModal();
      showToast('تم إضافة العميل بنجاح', 'success');
    } catch (_) {
      showFormError('حدث خطأ غير متوقع، يرجى المحاولة مجدداً');
    } finally {
      els.btnAddCustomerSave.disabled = false;
    }
  }

  /* ========== ADD SUBSCRIPTION MODAL ========== */
  function subSetMode(mode) {
    state.subMode = mode;
    const isRenew = mode === 'renew';
    els.subTabNew.classList.toggle('active', !isRenew);
    els.subTabRenew.classList.toggle('active', isRenew);
    els.subModalTitle.textContent = isRenew ? 'تجديد اشتراك' : 'اشتراك جديد';
    els.subSaveBtnLabel.textContent = isRenew ? 'تجديد الاشتراك' : 'حفظ الاشتراك';
    els.subRenewSubGroup.style.display = isRenew ? '' : 'none';
  }

  async function openAddSubscriptionModal(mode) {
    mode = mode || 'new';
    els.addSubError.style.display = 'none';
    els.subCustomerId.value = '';
    els.subCustomerSearch.value = '';
    els.subCustomerChip.style.display = 'none';
    els.subCustomerInputInner.style.display = '';
    els.subCustomerDropdown.style.display = 'none';
    // تعيين تاريخ اليوم افتراضياً
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    els.subStartDate.value = `${yyyy}-${mm}-${dd}`;
    els.subEndDate.value = ''; // تاريخ الانتهاء فارغ (باقة مفتوحة)
    els.subRenewSubSelect.innerHTML = '<option value="">— اختر اشتراك —</option>';
    subSetMode(mode);

    els.subPackageSelect.innerHTML = '<option value="">— جارٍ التحميل... —</option>';
    els.addSubscriptionModal.style.display = 'flex';

    try {
      const res = await window.api.getPrepaidPackages({ activeOnly: true });
      const packages = (res && res.success && res.packages) ? res.packages.filter((p) => p.is_active) : [];
      els.subPackageSelect.innerHTML = '<option value="">— اختر الباقة —</option>' +
        packages.map((pkg) => `<option value="${pkg.id}">${escHtml(pkg.name_ar || pkg.name_en || '')} — ${fmtLtr(pkg.prepaid_price || 0)} ريال</option>`).join('');
    } catch (_) {
      els.subPackageSelect.innerHTML = '<option value="">— فشل تحميل الباقات —</option>';
    }

    if (state.selectedCustomer) {
      els.subCustomerId.value = state.selectedCustomer.id;
      els.subCustomerChipName.textContent = state.selectedCustomer.name || state.selectedCustomer.phone;
      els.subCustomerChipPhone.textContent = state.selectedCustomer.phone || '';
      els.subCustomerSubscription.style.display = 'none';
      els.subCustomerChip.style.display = 'flex';
      els.subCustomerInputInner.style.display = 'none';
      
      // جلب معلومات الاشتراك النشط
      if (state.selectedCustomer.id) {
        try {
          const res = await window.api.getCustomerActiveSubscription({ customerId: state.selectedCustomer.id });
          if (res && res.success && res.subscription) {
            const sub = res.subscription;
            const status = sub.display_status;
            const remaining = parseFloat(sub.credit_remaining) || 0;
            if (status === 'active') {
              els.subChipSubLabel.textContent = sub.package_name || 'اشتراك نشط';
              els.subChipSubBalance.innerHTML = `متبقي: ${remaining.toFixed(2)} <span class="sar">&#xE900;</span>`;
              els.subCustomerSubscription.className = 'sub-chip-subscription sub-chip-sub-active';
              els.subCustomerSubscription.style.display = 'flex';
            } else if (status === 'expired') {
              els.subChipSubLabel.textContent = sub.package_name || 'اشتراك منتهي';
              els.subChipSubBalance.innerHTML = `متبقي: ${remaining.toFixed(2)} <span class="sar">&#xE900;</span>`;
              els.subCustomerSubscription.className = 'sub-chip-subscription sub-chip-sub-expired';
              els.subCustomerSubscription.style.display = 'flex';
            }
          }
        } catch (_) {}
      }
      
      if (mode === 'renew') loadCustomerSubscriptions(state.selectedCustomer.id);
    } else {
      setTimeout(() => els.subCustomerSearch.focus(), 80);
    }
  }

  async function loadCustomerSubscriptions(customerId) {
    els.subRenewSubSelect.innerHTML = '<option value="">— جارٍ التحميل... —</option>';
    try {
      const res = await window.api.getCustomerSubscriptionsList({ customerId, page: 1, pageSize: 20 });
      const subs = (res && res.success) ? (res.subscriptions || []) : [];
      if (!subs.length) {
        els.subRenewSubSelect.innerHTML = '<option value="">— لا يوجد اشتراك —</option>';
        return;
      }
      els.subRenewSubSelect.innerHTML = '<option value="">— اختر اشتراك —</option>' +
        subs.map((s) => `<option value="${s.id}">${escHtml(s.package_name || s.subscription_ref || '')} — ${escHtml(s.display_status || '')}</option>`).join('');
      if (subs.length === 1) els.subRenewSubSelect.value = String(subs[0].id);
    } catch (_) {
      els.subRenewSubSelect.innerHTML = '<option value="">— فشل التحميل —</option>';
    }
  }

  function closeAddSubscriptionModal() {
    els.addSubscriptionModal.style.display = 'none';
  }

  async function searchSubCustomers(term) {
    if (!term || term.length < 1) {
      els.subCustomerDropdown.style.display = 'none';
      return;
    }
    try {
      const res = await window.api.getCustomers({ search: term, page: 1, pageSize: 8 });
      if (!res || !res.success) return;
      renderSubCustomerDropdown(res.customers || []);
    } catch (_) {}
  }

  function renderSubCustomerDropdown(customers) {
    if (!customers.length) {
      els.subCustomerDropdown.style.display = 'none';
      return;
    }
    els.subCustomerDropdown.innerHTML = customers.map((c) => `
      <div class="customer-option" data-id="${c.id}"
        data-name="${escHtml(c.customer_name || '')}"
        data-phone="${escHtml(c.phone || '')}">
        <div class="customer-option-name">${escHtml(c.customer_name || '')}</div>
        <div class="customer-option-phone">${escHtml(c.phone || '')}</div>
      </div>
    `).join('');
    els.subCustomerDropdown.querySelectorAll('.customer-option').forEach((opt) => {
      opt.addEventListener('click', async () => {
        const customerId = opt.dataset.id;
        const customerName = opt.dataset.name || opt.dataset.phone;
        const customerPhone = opt.dataset.phone;
        
        els.subCustomerId.value = customerId;
        els.subCustomerChipName.textContent = customerName;
        els.subCustomerChipPhone.textContent = customerPhone || '';
        els.subCustomerSubscription.style.display = 'none';
        els.subCustomerChip.style.display = 'flex';
        els.subCustomerInputInner.style.display = 'none';
        els.subCustomerDropdown.style.display = 'none';
        els.subCustomerSearch.value = '';
        
        // جلب معلومات الاشتراك النشط
        if (customerId) {
          try {
            const res = await window.api.getCustomerActiveSubscription({ customerId: Number(customerId) });
            if (res && res.success && res.subscription) {
              const sub = res.subscription;
              const status = sub.display_status;
              const remaining = parseFloat(sub.credit_remaining) || 0;
              if (status === 'active') {
                els.subChipSubLabel.textContent = sub.package_name || 'اشتراك نشط';
                els.subChipSubBalance.innerHTML = `متبقي: ${remaining.toFixed(2)} <span class="sar">&#xE900;</span>`;
                els.subCustomerSubscription.className = 'sub-chip-subscription sub-chip-sub-active';
                els.subCustomerSubscription.style.display = 'flex';
              } else if (status === 'expired') {
                els.subChipSubLabel.textContent = sub.package_name || 'اشتراك منتهي';
                els.subChipSubBalance.innerHTML = `متبقي: ${remaining.toFixed(2)} <span class="sar">&#xE900;</span>`;
                els.subCustomerSubscription.className = 'sub-chip-subscription sub-chip-sub-expired';
                els.subCustomerSubscription.style.display = 'flex';
              }
            }
          } catch (_) {}
        }
        
        if (state.subMode === 'renew') loadCustomerSubscriptions(customerId);
      });
    });
    els.subCustomerDropdown.style.display = '';
  }

  async function handleSaveSubscription() {
    const customerId = els.subCustomerId.value;
    const packageId = els.subPackageSelect.value;
    const periodFrom = els.subStartDate.value || undefined;
    const periodTo = els.subEndDate.value || undefined; // تاريخ الانتهاء (اختياري)
    const isRenew = state.subMode === 'renew';

    els.addSubError.style.display = 'none';

    if (!customerId) {
      els.addSubError.textContent = 'يرجى اختيار العميل';
      els.addSubError.style.display = '';
      return;
    }
    if (isRenew && !els.subRenewSubSelect.value) {
      els.addSubError.textContent = 'يرجى اختيار الاشتراك المراد تجديده';
      els.addSubError.style.display = '';
      return;
    }
    if (!packageId) {
      els.addSubError.textContent = 'يرجى اختيار الباقة';
      els.addSubError.style.display = '';
      return;
    }
    
    // التحقق من صحة التواريخ
    if (periodFrom && periodTo) {
      const startDate = new Date(periodFrom);
      const endDate = new Date(periodTo);
      if (endDate <= startDate) {
        els.addSubError.textContent = 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية';
        els.addSubError.style.display = '';
        return;
      }
    }

    els.btnAddSubSave.disabled = true;
    try {
      let r;
      if (isRenew) {
        r = await window.api.renewSubscription({
          subscriptionId: Number(els.subRenewSubSelect.value),
          packageId: Number(packageId),
          periodFrom,
          periodTo,
          carryOverRemaining: true  // دائماً يتم ترحيل الرصيد المتبقي
        });
      } else {
        r = await window.api.createSubscription({
          customerId: Number(customerId),
          packageId: Number(packageId),
          periodFrom,
          periodTo
        });
      }

      const subOk = r && r.success !== false && (r.orderId || r.subscriptionId);
      if (subOk) {
        closeAddSubscriptionModal();
        showToast(isRenew ? 'تم تجديد الاشتراك بنجاح' : 'تم إضافة الاشتراك بنجاح', 'success');
        const invoiceOrderId = r.orderId || r.invoiceId;
        if (invoiceOrderId) {
          await showSubscriptionInvoiceModal(invoiceOrderId);
        }
      } else {
        els.addSubError.textContent = (r && r.message) || 'حدث خطأ أثناء الحفظ';
        els.addSubError.style.display = '';
      }
    } catch (_) {
      els.addSubError.textContent = 'حدث خطأ غير متوقع، يرجى المحاولة مجدداً';
      els.addSubError.style.display = '';
    } finally {
      els.btnAddSubSave.disabled = false;
    }
  }

  /* ========== ZATCA TLV QR ========== */
  function buildZatcaTlv(sellerName, vatNumber, timestamp, totalAmount, vatAmount) {
    function encodeTag(tag, value) {
      var enc = new TextEncoder();
      var bytes = enc.encode(value);
      var out = new Uint8Array(2 + bytes.length);
      out[0] = tag;
      out[1] = bytes.length;
      out.set(bytes, 2);
      return out;
    }
    var parts = [
      encodeTag(1, sellerName || ''),
      encodeTag(2, vatNumber || ''),
      encodeTag(3, timestamp || ''),
      encodeTag(4, totalAmount || '0.00'),
      encodeTag(5, vatAmount || '0.00'),
    ];
    var total = parts.reduce(function(s, p) { return s + p.length; }, 0);
    var combined = new Uint8Array(total);
    var offset = 0;
    parts.forEach(function(p) { combined.set(p, offset); offset += p.length; });
    var binary = '';
    combined.forEach(function(b) { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function renderInvoiceQR(sellerName, vatNumber, timestamp, totalStr, vatStr, tlvBase64) {
    els.invQR.innerHTML = '';
    var payload = tlvBase64
      ? { tlvBase64: tlvBase64 }
      : { sellerName: sellerName, vatNumber: vatNumber, timestamp: timestamp, totalAmount: totalStr, vatAmount: vatStr };
    window.api.generateZatcaQR(payload)
      .then(function(res) {
        if (res && res.success && res.svg) {
          els.invQR.innerHTML = res.svg;
        } else {
          els.invQR.innerHTML = '<div style="font-size:9px;color:#999;padding:8px">QR غير متاح</div>';
        }
      })
      .catch(function() {
        els.invQR.innerHTML = '<div style="font-size:9px;color:#999;padding:8px">QR غير متاح</div>';
      });
  }

  function renderConsumptionBarcode(receiptSeq) {
    const wrap = document.getElementById('crModalBarcodeWrap');
    const svg  = document.getElementById('crModalBarcode');
    if (!svg) return;
    if (receiptSeq) {
      try {
        svg.innerHTML = '';
        JsBarcode(svg, 'C-' + receiptSeq, {
          format: 'CODE128', displayValue: true, fontSize: 11,
          height: 40, margin: 4, background: 'transparent'
        });
        if (wrap) wrap.style.display = '';
      } catch (e) {
        console.error('renderConsumptionBarcode error:', e);
        if (wrap) wrap.style.display = 'none';
        svg.innerHTML = '';
      }
    } else {
      if (wrap) wrap.style.display = 'none';
      svg.innerHTML = '';
    }
  }

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

  /* ========== A4 INVOICE WINDOW (fallback standalone) ========== */
  function paymentLabel(method) {
    const map = { cash: 'نقدي', card: 'شبكة', credit: 'آجل', mixed: 'نقدي + شبكة' };
    return map[method] || method || 'نقدي';
  }
  function openA4Invoice(data) {
    localStorage.setItem('a4InvoiceData', JSON.stringify(data));
    window.open('/screens/invoice-a4/invoice-a4.html', '_blank', 'width=960,height=1120,scrollbars=yes');
  }

  /** اطبع فاتورة الاشتراك بنفس تصميم شاشة الاشتراكات عبر A4 */
  async function printSubscriptionA4(orderId) {
    try {
      const res = await window.api.getOrderById({ id: orderId });
      if (!res || !res.success || !res.order) return;
      const order = res.order;
      const items = res.items || [];
      const subscription = res.subscription || null;
      const settingsRes = await window.api.getAppSettings().catch(() => null);
      const s = (settingsRes && settingsRes.settings) || settingsRes || {};

      const vatRate = parseFloat(order.vat_rate || s.vatRate || 0);
      const subtotal = parseFloat(order.subtotal || 0);
      const vatAmount = parseFloat(order.vat_amount || 0);
      const total = parseFloat(order.total_amount || 0);

      const data = {
        shopNameAr: s.laundryNameAr,
        shopNameEn: s.laundryNameEn,
        shopAddressAr: s.locationAr,
        shopAddressEn: s.locationEn,
        shopPhone: s.phone,
        shopEmail: s.email,
        vatNumber: s.vatNumber,
        commercialRegister: s.commercialRegister,
        logoDataUrl: s.logoDataUrl,
        titleAr: order.customer_vat ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة',
        titleEn: order.customer_vat ? 'Tax Invoice' : 'Simplified Tax Invoice',
        orderNum: order.invoice_seq || order.order_number || '',
        date: formatInvoiceDate(order.created_at),
        payment: paymentLabel(order.payment_method),
        custName: order.customer_name,
        custPhone: order.phone,
        custVat: order.customer_vat || '',
        subRef: subscription ? subscription.subscription_number : null,
        subPackageName: subscription ? subscription.package_name : null,
        subBalance: subscription ? subscription.credit_remaining : null,
        items: items.map(it => ({
          productAr: it.product_name_ar || it.product_name || '',
          productEn: it.product_name_en || '',
          serviceAr: it.service_name_ar || '',
          serviceEn: it.service_name_en || '',
          qty: it.quantity || 1,
          unitPrice: it.unit_price || it.unitPrice || 0,
          lineTotal: it.line_total || it.lineTotal || 0
        })),
        subtotal: subtotal,
        discount: order.discount_amount || 0,
        extra: order.extra_amount || 0,
        vatRate: vatRate,
        vatAmount: vatAmount,
        total: total,
        priceDisplayMode: order.price_display_mode || 'inclusive',
        paidCash: order.paid_cash || order.paidCash || 0,
        paidCard: order.paid_card || order.paidCard || 0,
        paid: order.paid || 0,
        remaining: order.remaining || 0,
        invoiceNotes: order.notes || '',
        settingsNotes: s.invoiceNotes,
        qrPayload: order.zatca_qr ? { tlvBase64: order.zatca_qr } : (vatRate > 0 && s.vatNumber ? { sellerName: s.laundryNameAr || '', vatNumber: s.vatNumber, timestamp: (order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString()), totalAmount: (total || 0).toFixed(2), vatAmount: (vatAmount || 0).toFixed(2) } : null)
      };

      openA4Invoice(data);
      if ((state.appSettings || {}).whatsappSendOnSubscription) {
        sendInvoiceWhatsApp(orderId, order.phone || '', 'subscription');
      }
    } catch (e) {
      console.error('printSubscriptionA4 error:', e);
    }
  }

  /* ========== A4 MODAL HELPERS ========== */
  function applyInvoiceTypeClass() {
    var type = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    document.body.classList.toggle('invtype-a4', type === 'a4');
  }

  function fillA4InvoiceModal(data) {
    function a4mText(id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val || '';
    }
    function a4mHtml(id, val) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = val || '';
    }
    function a4mShow(id, show) {
      var el = document.getElementById(id);
      if (el) el.style.display = show ? '' : 'none';
    }
    var sarSpan = '<span style="font-family:SaudiRiyal;">\uE900</span>';
    function sarFmt(n) { return sarSpan + Number(n || 0).toFixed(2); }

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

    /* ── Custom fields (A4) ── */
    var a4mCFElAr = document.getElementById('a4mCustomFieldsAr');
    var a4mCFElEn = document.getElementById('a4mCustomFieldsEn');
    var cfsA4 = Array.isArray(data.customFields) ? data.customFields : [];
    if (a4mCFElAr) {
      if (cfsA4.length) {
        var cfHtmlAr = '';
        cfsA4.forEach(function(cf) {
          if (cf.labelAr) cfHtmlAr += '<div class="a4m-brand-sub">' + escHtml(cf.labelAr) + '</div>';
        });
        a4mCFElAr.innerHTML = cfHtmlAr;
      } else { a4mCFElAr.innerHTML = ''; }
    }
    if (a4mCFElEn) {
      if (cfsA4.length) {
        var cfHtmlEn = '';
        cfsA4.forEach(function(cf) {
          if (cf.labelEn) cfHtmlEn += '<div class="a4m-brand-sub">' + escHtml(cf.labelEn) + '</div>';
        });
        a4mCFElEn.innerHTML = cfHtmlEn;
      } else { a4mCFElEn.innerHTML = ''; }
    }

    var logoEl = document.getElementById('a4mLogo');
    if (logoEl) {
      if (data.logoDataUrl) { logoEl.src = data.logoDataUrl; logoEl.style.display = ''; }
      else { logoEl.style.display = 'none'; }
    }

    var titleAr = document.getElementById('a4mTitleAr');
    var titleEn = document.getElementById('a4mTitleEn');
    if (titleAr) titleAr.textContent = data.titleAr || 'فاتورة ضريبية مبسطة';
    if (titleEn) titleEn.textContent = data.titleEn || 'Simplified Tax Invoice';

    var cnInfo = document.getElementById('a4mCNInfo');
    var cnInfoText = document.getElementById('a4mCNInfoText');
    if (cnInfo && cnInfoText) {
      if (data.cnInfo) { cnInfoText.textContent = data.cnInfo; cnInfo.style.display = ''; }
      else { cnInfo.style.display = 'none'; }
    }

    var orderNumLabel = document.getElementById('a4mOrderNumLabel');
    if (orderNumLabel) orderNumLabel.textContent = data.orderNumLabel || 'رقم الفاتورة / Invoice #';

    a4mText('a4mOrderNum', data.orderNum);
    a4mText('a4mDate',     data.date);
    a4mText('a4mPayment',  data.payment);
    a4mText('a4mCustName',  data.custName || '—');
    a4mText('a4mCustPhone', data.custPhone || '—');
    var a4mCustVatRow = document.getElementById('a4mCustVatRow');
    if (data.custVat && a4mCustVatRow) {
      a4mText('a4mCustVat', data.custVat);
      a4mCustVatRow.style.display = '';
    } else if (a4mCustVatRow) {
      a4mCustVatRow.style.display = 'none';
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

    a4mShow('a4mRowStarch',      !!data.starch);
    if (data.starch)      a4mText('a4mStarch',      data.starch);
    a4mShow('a4mRowBluing',      !!data.bluing);
    if (data.bluing)      a4mText('a4mBluing',      data.bluing);
    a4mShow('a4mRowCashier',     !!data.cashierName);
    if (data.cashierName) a4mText('a4mCashierName', data.cashierName);
    (function() {
      var section = document.querySelector('#invoicePaperA4m .a4m-bill-to');
      if (!section) return;
      var rightCard = section.querySelector('.a4m-card:last-child');
      if (!rightCard) return;
      var hasVisible = Array.from(rightCard.children).some(function(el) { return el.style.display !== 'none'; });
      rightCard.style.display = hasVisible ? '' : 'none';
      section.style.gridTemplateColumns = hasVisible ? '' : '1fr';
    })();

    var vatRate  = data.vatRate || 0;
    var priceMode = data.priceDisplayMode || 'exclusive';
    var tbody = document.getElementById('a4mItemsTbody');
    if (tbody && data.items) {
      tbody.innerHTML = data.items.map(function(it, i) {
        var lineTotal = Number(it.lineTotal || 0);
        var net, itemVat, gross;
        if (vatRate > 0) {
          if (priceMode === 'inclusive') {
            net     = lineTotal / (1 + vatRate / 100);
            itemVat = lineTotal - net;
            gross   = lineTotal;
          } else {
            net     = lineTotal;
            itemVat = lineTotal * vatRate / 100;
            gross   = lineTotal + itemVat;
          }
        } else { net = lineTotal; itemVat = 0; gross = lineTotal; }

        var nameCell = escHtml(it.productAr || '');
        if (it.productEn && it.productEn !== it.productAr) nameCell += '<span class="a4m-td-en">' + escHtml(it.productEn) + '</span>';
        var svcCell = escHtml(it.serviceAr || '—');
        if (it.serviceEn && it.serviceEn !== it.serviceAr) svcCell += '<span class="a4m-td-en">' + escHtml(it.serviceEn) + '</span>';

        return '<tr>'
          + '<td class="a4m-td-num">' + (i + 1) + '</td>'
          + '<td class="a4m-td-name">' + nameCell + '</td>'
          + '<td class="a4m-td-name">' + svcCell  + '</td>'
          + '<td class="a4m-td-num">'  + (it.qty || 1) + '</td>'
          + '<td class="a4m-td-num">'  + Number(it.unitPrice || 0).toFixed(2) + '</td>'
          + '<td class="a4m-td-num">'  + net.toFixed(2) + '</td>'
          + '<td class="a4m-td-num">'  + itemVat.toFixed(2) + '</td>'
          + '<td class="a4m-td-num">'  + gross.toFixed(2) + '</td>'
          + '</tr>';
      }).join('');
    }

    // subtotalA4 is already the correct pre-tax base (computed when building A4 data)
    var a4mSubtotalVal = data.subtotal;
    a4mHtml('a4mSubtotal', sarFmt(a4mSubtotalVal));
    if (data.discount && data.discount > 0) {
      a4mHtml('a4mDiscount', sarFmt(data.discount));
      a4mShow('a4mDiscRow', true);
      // Update A4 discount label with offer name
      var a4mDiscLabel = document.querySelector('#a4mDiscRow span');
      if (a4mDiscLabel && state.activeOffer) {
        var ofName = state.activeOffer.name || '';
        var ofVal = state.activeOffer.discount_type === 'percentage'
          ? parseFloat(state.activeOffer.discount_value) + '%'
          : parseFloat(state.activeOffer.discount_value) + ' ر.س';
        a4mDiscLabel.textContent = 'خصم عرض (' + ofName + ' ' + ofVal + ') / Discount';
      }
    } else { a4mShow('a4mDiscRow', false); a4mShow('a4mAfterDiscRow', false); }
    // المجموع بعد الخصم — A4
    if (data.discount && data.discount > 0) {
      var a4mAfterDiscVal = a4mSubtotalVal - data.discount;
      a4mHtml('a4mAfterDiscount', sarFmt(a4mAfterDiscVal));
      a4mShow('a4mAfterDiscRow', true);
    }
    if (data.extra && data.extra > 0) {
      a4mHtml('a4mExtra', sarFmt(data.extra));
      a4mShow('a4mExtraRow', true);
    } else { a4mShow('a4mExtraRow', false); }
    if (vatRate > 0) {
      a4mText('a4mVatLabel', 'ضريبة القيمة المضافة (' + vatRate + '%) / VAT');
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
    var paidCashA4m = Number(data.paidCash || 0);
    var paidCardA4m = Number(data.paidCard || 0);
    if (paidCashA4m > 0 || paidCardA4m > 0) {
      a4mHtml('a4mMixedCash', sarFmt(paidCashA4m));
      a4mShow('a4mMixedCashRow', true);
      a4mHtml('a4mMixedCard', sarFmt(paidCardA4m));
      a4mShow('a4mMixedCardRow', true);
    } else {
      a4mShow('a4mMixedCashRow', false);
      a4mShow('a4mMixedCardRow', false);
    }

    /* Paid and Remaining for partial payments */
    if (data.paid != null && data.paid > 0 && data.remaining != null && data.remaining > 0) {
      a4mHtml('a4mPaidAmount', sarFmt(data.paid));
      a4mShow('a4mPaidRow', true);
      a4mHtml('a4mRemainingAmount', sarFmt(data.remaining));
      a4mShow('a4mRemainingRow', true);
    } else {
      a4mShow('a4mPaidRow', false);
      a4mShow('a4mRemainingRow', false);
    }
    
    var a4mInvoiceNotesEl = document.getElementById('a4mInvoiceNotes');
    if (a4mInvoiceNotesEl) {
      if (data.invoiceNotes) {
        var a4mInvoiceNotesContent = document.getElementById('a4mInvoiceNotesContent');
        if (a4mInvoiceNotesContent) a4mInvoiceNotesContent.textContent = data.invoiceNotes;
        a4mInvoiceNotesEl.style.display = '';
      } else {
        a4mInvoiceNotesEl.style.display = 'none';
      }
    }

    var a4mNotesEl = document.getElementById('a4mFooterNotes');
    if (a4mNotesEl) {
      if (data.settingsNotes) {
        var a4mNotesContent = document.getElementById('a4mNotesContent');
        if (a4mNotesContent) a4mNotesContent.textContent = data.settingsNotes;
        a4mNotesEl.style.display = '';
      } else {
        a4mNotesEl.style.display = 'none';
      }
    }

    /* Loyalty points */
    var a4mLoyaltyRow = document.getElementById('a4mLoyaltyRow');
    var a4mLoyaltyPoints = document.getElementById('a4mLoyaltyPoints');
    var a4mLoyaltyLabel = document.getElementById('a4mLoyaltyLabel');
    if (a4mLoyaltyRow && a4mLoyaltyPoints) {
      var loyEarned   = Number(data.loyaltyEarned   || 0);
      var loyRedeemed = Number(data.loyaltyRedeemed || 0);
      var loyEnabled  = state.loyaltySettings && state.loyaltySettings.loyaltyEnabled;
      var isCredit    = state.paymentMethod === 'credit';
      var loyBal = Number(data.loyaltyBalance != null ? data.loyaltyBalance : (state.customerLoyaltyBalance - loyRedeemed + loyEarned));
      var loyRev = data.loyaltyReversal;
      if (loyEnabled && loyRev && (loyRev.earned > 0 || loyRev.redeemed > 0)) {
        // إشعار دائن: عرض استرجاع النقاط
        a4mLoyaltyPoints.textContent = loyRev.newBalance.toLocaleString();
        if (a4mLoyaltyLabel) {
          var revTxt = loyRev.netReverse > 0
            ? 'استُرجع ' + loyRev.netReverse + ' نقطة — رصيدك / Points Restored'
            : 'خُصم ' + Math.abs(loyRev.netReverse) + ' نقطة — رصيدك / Points Deducted';
          a4mLoyaltyLabel.textContent = revTxt;
        }
        a4mLoyaltyRow.style.display = '';
      } else if (loyEnabled && (loyEarned > 0 || loyRedeemed > 0)) {
        a4mLoyaltyPoints.textContent = loyBal.toLocaleString();
        if (a4mLoyaltyLabel) a4mLoyaltyLabel.textContent = 'رصيدك من النقاط / Loyalty Points';
        a4mLoyaltyRow.style.display = '';
      } else if (loyEnabled && loyBal > 0) {
        a4mLoyaltyPoints.textContent = loyBal.toLocaleString();
        if (a4mLoyaltyLabel) a4mLoyaltyLabel.textContent = 'رصيد نقاطك / Loyalty Balance';
        a4mLoyaltyRow.style.display = '';
      } else {
        a4mLoyaltyRow.style.display = 'none';
      }
    }

    if (data.qrPayload) {
      var qrEl = document.getElementById('a4mQR');
      if (qrEl) {
        qrEl.innerHTML = '';
        window.api.generateZatcaQR(data.qrPayload)
          .then(function(res) { if (res && res.success && res.svg) qrEl.innerHTML = res.svg; })
          .catch(function() {});
      }
    }
  }

  function fillCrModalShopExtra(s) {
    var vatEl    = document.getElementById('crModalVatNumber');
    var vatRow   = document.getElementById('crModalVatRow');
    var crEl     = document.getElementById('crModalCR');
    var crRow    = document.getElementById('crModalCRRow');
    var emailEl  = document.getElementById('crModalShopEmail');
    var emailRow = document.getElementById('crModalEmailRow');
    if (vatEl)    vatEl.textContent  = s.vatNumber          ? 'الرقم الضريبي: ' + s.vatNumber          : '';
    if (vatRow)   vatRow.style.display  = s.vatNumber          ? '' : 'none';
    if (crEl)     crEl.textContent   = s.commercialRegister ? 'السجل التجاري: ' + s.commercialRegister : '';
    if (crRow)    crRow.style.display   = s.commercialRegister ? '' : 'none';
    if (emailEl)  emailEl.textContent = s.email             ? s.email                                   : '';
    if (emailRow) emailRow.style.display = s.email          ? '' : 'none';
  }

  /* ========== FILL & SHOW INVOICE MODAL ========== */
  function formatInvoiceDate(dateStr) {
    var d = dateStr ? new Date(dateStr) : new Date();
    var pad = function(n) { return String(n).padStart(2, '0'); };
    var hours = d.getHours();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + '  ' + pad(hours) + ':' + pad(d.getMinutes()) + ' ' + ampm;
  }

  function isoTimestamp(dateStr) {
    var d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function formatConsumptionReceiptNum(seq) {
    return 'C-' + (Number(seq) || 1);
  }

  function formatSubscriptionDisplayNum(val) {
    if (val == null || String(val).trim() === '') return '—';
    var s = String(val).trim();
    var m = s.match(/(\d+)\s*$/);
    if (m) return String(Number(m[1]));
    var n = Number(s.replace(/\D/g, ''));
    return isNaN(n) ? s : String(n);
  }

  function buildConsumptionItemsHtml(items) {
    var list = items || [];
    return list.map(function (item) {
      var nameAr = escHtml(item.productNameAr || item.name || '');
      var nameEn = escHtml(item.productNameEn || '');
      var svcAr = escHtml(item.serviceNameAr || item.serviceName || '');
      var svcEn = escHtml(item.serviceNameEn || '');
      var productCell = nameAr
        + (nameEn && nameEn !== nameAr ? '<br><span class="inv-td-en">' + nameEn + '</span>' : '');
      var serviceCell = svcAr
        + (svcEn && svcEn !== svcAr ? '<br><span class="inv-td-en">' + svcEn + '</span>' : '');
      var qty = item.qty != null ? item.qty : (item.quantity != null ? item.quantity : 1);
      var line = item.lineTotal != null ? item.lineTotal : 0;
      return '<tr>'
        + '<td class="inv-td-name">' + (productCell || '—') + '</td>'
        + '<td class="inv-td-num">' + qty + '</td>'
        + '<td class="inv-td-amt">' + fmtLtr(line) + '</td>'
        + '<td class="inv-td-name">' + (svcAr ? serviceCell : '—') + '</td>'
        + '</tr>';
    }).join('');
  }

  function printConsumptionReceipt() {
    var copies = getPrintCopies();
    if (copies === 0) return;

    // نسخ محتوى الإيصال لـ print zone (خارج المودال) للتوافق مع متصفحات الجوال
    var crPaperEl = document.getElementById('crModalPaper');
    var printZone = document.getElementById('consumptionPrintZone');
    if (crPaperEl && printZone) {
      printZone.innerHTML = crPaperEl.outerHTML;
    }

    document.body.classList.add('print-consumption-receipt');
    var currentCopy = 0;
    function printNext() {
      if (currentCopy >= copies) {
        document.body.classList.remove('print-consumption-receipt');
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
          document.body.classList.remove('print-consumption-receipt');
          if (printZone) printZone.innerHTML = '';
          // نحفظ بيانات الواتساب قبل مسح السلة
          const _crWaSettings = state.appSettings || {};
          const _crWaPhone = (state.selectedCustomer && state.selectedCustomer.phone) || '';
          const _crPaperEl = document.getElementById('crModalPaper');
          const _crHtml = _crPaperEl ? _crPaperEl.outerHTML : null;
          const _crOrderNum = state.viewingConsumptionReceiptNum || '';
          const _crTotal = state.viewingConsumptionReceiptAmount || 0;
          // After a successful save + print request, empty the cart automatically.
          if (!state._creditNoteModalMode && !state.viewingDeferredInvoice && state.shouldClearCartAfterConsumptionPrint !== false) {
            clearCart();
          }
          // إرسال إيصال الاستهلاك عبر الواتساب عند الطباعة
          if (_crWaSettings.whatsappSendOnPrint && _crHtml && _crWaPhone) {
            sendInvoiceWhatsAppFromHtml(_crHtml, 'thermal', _crWaPhone, _crOrderNum, null, 'consumption', _crTotal);
          }
          // Keep the receipt modal visible after printing so the user can
          // export PDF or review details. The user closes it manually.
        }
      }
      window.addEventListener('afterprint', afterPrint);
      window.print();
      setTimeout(afterPrint, 2500);
    }
    printNext();
  }

  function showConsumptionReceiptModal(result, subscription, autoOpenPrint) {
    var s = state.appSettings || {};
    var lang = getLang();
    var shopName = (lang === 'ar' ? s.laundryNameAr : s.laundryNameEn) || s.laundryNameAr || '';
    var crShop = document.getElementById('crModalShopName');
    var crAddr = document.getElementById('crModalShopAddress');
    var crPhone = document.getElementById('crModalShopPhone');
    if (crShop) crShop.textContent = shopName;
    if (crAddr) crAddr.textContent = s.locationAr || s.locationEn || '';
    if (crPhone) crPhone.textContent = s.phone ? 'هاتف: ' + s.phone : '';
    var crLogoWrap = document.getElementById('crModalLogoWrap');
    var crLogo = document.getElementById('crModalLogo');
    if (s.logoDataUrl && crLogo) {
      crLogo.src = s.logoDataUrl;
      if (crLogoWrap) crLogoWrap.style.display = '';
    } else if (crLogoWrap) crLogoWrap.style.display = 'none';
    fillCrModalShopExtra(s);

    // Ensure modal is in "consumption" mode (hide refund-only UI).
    if (els.crModalRefundNumRow) els.crModalRefundNumRow.style.display = 'none';
    if (els.crModalRefundReasonRow) els.crModalRefundReasonRow.style.display = 'none';
    if (els.crModalAmountLabel) els.crModalAmountLabel.textContent = 'المبلغ المستهلك';
    if (els.crModalBalBeforeLabel) els.crModalBalBeforeLabel.textContent = 'الرصيد قبل';
    if (els.crModalBalAfterLabel) els.crModalBalAfterLabel.textContent = 'الرصيد بعد';
    var titleEl = document.querySelector('#consumptionReceiptModal .cr-receipt-title');
    if (titleEl) titleEl.textContent = 'إيصال استهلاك';

    var consumed = Number(result.consumptionAmount || 0);
    var balAfter = subscription && subscription.credit_remaining != null
      ? Number(subscription.credit_remaining)
      : null;
    var balBefore = balAfter != null ? balAfter + consumed : null;

    state.viewingConsumptionReceiptNum    = formatConsumptionReceiptNum(result.consumptionReceiptSeq);
    state.viewingConsumptionReceiptAmount = consumed;

    document.getElementById('crModalReceiptNum').textContent = state.viewingConsumptionReceiptNum;
    document.getElementById('crModalDate').textContent = formatInvoiceDate(new Date());
    var cust = state.selectedCustomer;
    document.getElementById('crModalCustomer').textContent = (cust && cust.name) || '—';
    document.getElementById('crModalPhone').textContent = (cust && cust.phone) || '—';
    var subNum = (subscription && subscription.subscription_number)
      || (cust && cust.subscription_number) || '';
    var subRefEl = document.getElementById('crModalSubRef');
    if (subRefEl) subRefEl.textContent = formatSubscriptionDisplayNum(subNum);
    document.getElementById('crModalPackage').textContent =
      (subscription && subscription.package_name) || '—';
    var sarHtml = '<span class="sar">&#xE900;</span> ';
    document.getElementById('crModalConsumed').innerHTML = sarHtml + fmtLtr(consumed);
    document.getElementById('crModalBalBefore').innerHTML =
      balBefore != null ? sarHtml + fmtLtr(balBefore) : '—';
    document.getElementById('crModalBalAfter').innerHTML =
      balAfter != null ? sarHtml + fmtLtr(balAfter) : '—';

    var tbody = document.getElementById('crModalItemsBody');
    if (tbody) {
      var itemsForHtml = Array.isArray(result && result.items) ? result.items : state.cart;
      tbody.innerHTML = buildConsumptionItemsHtml(itemsForHtml);
    }

    renderConsumptionBarcode(result.consumptionReceiptSeq || null);

    if (els.consumptionReceiptModal) {
      els.consumptionReceiptModal.style.display = 'flex';
      if (autoOpenPrint) {
        setTimeout(printConsumptionReceipt, 500);
      }
    }
  }

  /* ========== REFUND (SUBSCRIPTION RECEIPT) FLOW ========== */
  function openRefundSearchModal() {
    state.refundSearchTarget = null;
    if (els.refundReceiptSearchModal) els.refundReceiptSearchModal.style.display = 'flex';
    if (els.refundSearchResult) els.refundSearchResult.innerHTML = '';
    if (els.refundSearchConfirmArea) els.refundSearchConfirmArea.style.display = 'none';
    if (els.refundReceiptReasonInput) els.refundReceiptReasonInput.value = '';
    if (els.refundReceiptSearchInput) {
      els.refundReceiptSearchInput.value = '';
      setTimeout(() => els.refundReceiptSearchInput.focus(), 0);
    }
  }

  function hideRefundSearchModal() {
    if (els.refundReceiptSearchModal) els.refundReceiptSearchModal.style.display = 'none';
  }

  function buildRefundSearchItemsPreview(items) {
    // Reuse POS items renderer for a compact preview.
    if (!Array.isArray(items) || items.length === 0) return '—';
    return `
      <table class="inv-table" style="width:100%;margin-top:10px">
        <thead>
          <tr>
            <th class="inv-th-name">النوع</th>
            <th class="inv-th-num">عدد</th>
            <th class="inv-th-num">الإجمالي</th>
            <th class="inv-th-name">العملية</th>
          </tr>
        </thead>
        <tbody>
          ${buildConsumptionItemsHtml(items)}
        </tbody>
      </table>
    `;
  }

  async function handleRefundSearch() {
    if (!els.refundReceiptSearchInput) return;
    const q = els.refundReceiptSearchInput.value.trim();
    if (!q) {
      showTopToast('أدخل رقم الإيصال أو رقم الاشتراك للبحث', 'error');
      return;
    }

    if (els.refundSearchResult) els.refundSearchResult.innerHTML = 'جارٍ البحث...';
    if (els.refundSearchConfirmArea) els.refundSearchConfirmArea.style.display = 'none';
    if (els.btnRefundConfirmReceipt) els.btnRefundConfirmReceipt.disabled = false;

    try {
      const res = await window.api.searchConsumptionReceiptForRefund({ q });
      if (!res || !res.success || !res.receipt) {
        const msg = (res && res.message) ? res.message : 'فشل البحث';
        showTopToast(msg, 'error');
        if (els.refundSearchResult) els.refundSearchResult.innerHTML = msg;
        return;
      }

      const receipt = res.receipt;
      const already = res.alreadyRefunded;
      state.refundSearchTarget = { receipt, alreadyRefunded: already };

      const alreadyHtml = already
        ? `<div style="margin-top:8px;color:#b91c1c;font-weight:800">
            تم إرجاع هذا الإيصال مسبقًا بتاريخ ${String(already.refundedAt || '').slice(0, 10) || '—'}
          </div>`
        : '';

      if (els.refundSearchConfirmArea) {
        els.refundSearchConfirmArea.style.display = already ? 'none' : '';
      }

      if (els.refundSearchResult) {
        els.refundSearchResult.innerHTML = `
          <div style="font-size:13px; color: #000; font-weight: 700;">
            <div class="inv-meta-row">
              <span class="inv-meta-label">الإيصال:</span>
              <span class="inv-meta-val" dir="ltr">${escHtml(receipt.receiptSeqLabel || ('C-' + receipt.receiptSeq))}</span>
            </div>
            <div class="inv-meta-row">
              <span class="inv-meta-label">العميل:</span>
              <span class="inv-meta-val">${escHtml(receipt.customer?.name || '—')}</span>
            </div>
            <div class="inv-meta-row">
              <span class="inv-meta-label">الباقة:</span>
              <span class="inv-meta-val">${escHtml(receipt.packageName || '—')}</span>
            </div>
            <div class="inv-divider-thick inv-sep"></div>
            <div class="inv-meta-row">
              <span class="inv-meta-label">المبلغ المستهلك:</span>
              <span class="inv-meta-val" dir="ltr">${riyalHtml(fmtLtr(receipt.amountConsumed || 0))}</span>
            </div>
            <div class="inv-meta-row">
              <span class="inv-meta-label">الرصيد قبل:</span>
              <span class="inv-meta-val" dir="ltr">${riyalHtml(fmtLtr(receipt.balanceBefore || 0))}</span>
            </div>
            <div class="inv-meta-row">
              <span class="inv-meta-label">الرصيد بعد:</span>
              <span class="inv-meta-val" dir="ltr">${riyalHtml(fmtLtr(receipt.balanceAfter || 0))}</span>
            </div>
            <div class="inv-divider-thick inv-sep"></div>
            ${buildRefundSearchItemsPreview(receipt.items)}
          </div>
          ${alreadyHtml}
        `;
      }
    } catch (err) {
      showTopToast(err.message || 'حدث خطأ أثناء البحث', 'error');
      if (els.refundSearchResult) els.refundSearchResult.innerHTML = err.message || 'حدث خطأ أثناء البحث';
    }
  }

  async function handleRefundConfirm() {
    if (!state.refundSearchTarget || !state.refundSearchTarget.receipt) return;
    const target = state.refundSearchTarget;
    if (target.alreadyRefunded) {
      showTopToast('هذا الإيصال تم إرجاعه مسبقًا', 'error');
      return;
    }

    if (els.btnRefundConfirmReceipt) {
      els.btnRefundConfirmReceipt.disabled = true;
      els.btnRefundConfirmReceipt.innerHTML = '<span>جارٍ تنفيذ المرتجع...</span>';
    }

    try {
      const reason = els.refundReceiptReasonInput ? els.refundReceiptReasonInput.value.trim() : '';
      const res = await window.api.refundConsumptionReceipt({
        receiptSeq: target.receipt.receiptSeq,
        reason
      });
      if (!res || !res.success) {
        throw new Error(res && res.message ? res.message : 'فشل تنفيذ المرتجع');
      }

      hideRefundSearchModal();
      // Open and print the refund receipt.
      showRefundReceiptModal(res, true);
    } catch (err) {
      showTopToast(err.message || 'فشل تنفيذ المرتجع', 'error');
    } finally {
      if (els.btnRefundConfirmReceipt) {
        els.btnRefundConfirmReceipt.disabled = false;
        els.btnRefundConfirmReceipt.innerHTML = '<span>تأكيد المرتجع</span>';
      }
    }
  }

  function showRefundReceiptModal(refundRes, autoOpenPrint) {
    if (!refundRes || !refundRes.receipt || !refundRes.refund) return;
    const receipt = refundRes.receipt;
    const refund = refundRes.refund;

    state.shouldClearCartAfterConsumptionPrint = false;

    // Shop / branding (same layout as consumption receipt)
    var s = state.appSettings || {};
    var lang = getLang();
    var shopName = (lang === 'ar' ? s.laundryNameAr : s.laundryNameEn) || s.laundryNameAr || '';
    var crShop = document.getElementById('crModalShopName');
    var crAddr = document.getElementById('crModalShopAddress');
    var crPhone = document.getElementById('crModalShopPhone');
    if (crShop) crShop.textContent = shopName;
    if (crAddr) crAddr.textContent = s.locationAr || s.locationEn || '';
    if (crPhone) crPhone.textContent = s.phone ? 'هاتف: ' + s.phone : '';

    var crLogoWrap = document.getElementById('crModalLogoWrap');
    var crLogo = document.getElementById('crModalLogo');
    if (s.logoDataUrl && crLogo) {
      crLogo.src = s.logoDataUrl;
      if (crLogoWrap) crLogoWrap.style.display = '';
    } else if (crLogoWrap) {
      crLogoWrap.style.display = 'none';
    }
    fillCrModalShopExtra(s);

    // Title
    const titleEl = document.querySelector('#consumptionReceiptModal .cr-receipt-title');
    if (titleEl) titleEl.textContent = 'مرتجع / REFUND';

    // Ensure refund-only UI is visible
    if (els.crModalRefundNumRow) els.crModalRefundNumRow.style.display = '';
    if (els.crModalRefundReasonRow) els.crModalRefundReasonRow.style.display = refund.reason ? '' : 'none';

    if (els.crModalRefundNum) els.crModalRefundNum.textContent = refund.receiptSeqLabel || receipt.receiptSeqLabel || ('C-' + receipt.receiptSeq);
    if (els.crModalRefundReason) els.crModalRefundReason.textContent = refund.reason || '';

    // Receipt numbers (spec: show original receipt + refund number)
    var receiptNumEl = document.getElementById('crModalReceiptNum');
    if (receiptNumEl) receiptNumEl.textContent = receipt.receiptSeqLabel || ('C-' + receipt.receiptSeq);

    // Meta
    if (document.getElementById('crModalDate')) {
      const createdAt = receipt.createdAt ? new Date(receipt.createdAt) : new Date();
      document.getElementById('crModalDate').textContent = formatInvoiceDate(createdAt.toISOString());
    }

    document.getElementById('crModalCustomer').textContent = receipt.customer?.name || '—';
    document.getElementById('crModalPhone').textContent = receipt.customer?.phone || '—';

    var subNum = receipt.customer?.subscriptionNumber || receipt.subscriptionNumber || '';
    var subRefEl = document.getElementById('crModalSubRef');
    if (subRefEl) subRefEl.textContent = formatSubscriptionDisplayNum(subNum);

    document.getElementById('crModalPackage').textContent = receipt.packageName || '—';

    // Amounts & balances
    if (els.crModalAmountLabel) els.crModalAmountLabel.textContent = 'المبلغ المسترجع';
    if (els.crModalBalBeforeLabel) els.crModalBalBeforeLabel.textContent = 'الرصيد قبل الإرجاع';
    if (els.crModalBalAfterLabel) els.crModalBalAfterLabel.textContent = 'الرصيد بعد الإرجاع';

    var sarHtml = '<span class="sar">&#xE900;</span> ';
    document.getElementById('crModalConsumed').innerHTML = sarHtml + fmtLtr(refund.refundAmount || receipt.amountConsumed || 0);
    document.getElementById('crModalBalBefore').innerHTML = sarHtml + fmtLtr(refund.oldBalance || 0);
    document.getElementById('crModalBalAfter').innerHTML = sarHtml + fmtLtr(refund.newBalance || 0);

    // Items
    var tbody = document.getElementById('crModalItemsBody');
    if (tbody) tbody.innerHTML = buildConsumptionItemsHtml(receipt.items);

    // Used for PDF export file naming.
    state.viewingConsumptionReceiptNum = refund.receiptSeqLabel || receipt.receiptSeqLabel || ('C-' + receipt.receiptSeq);

    if (els.consumptionReceiptModal) {
      els.consumptionReceiptModal.style.display = 'flex';
      if (autoOpenPrint) setTimeout(printConsumptionReceipt, 500);
    }
  }

  function showInvoiceModal(orderNumber, orderDate, totals, subscription, invoiceSeq, deferredDates, autoOpenPrint, orderId, invoiceNotes) {
    var s = state.appSettings || {};
    var lang = getLang();

    // حفظ orderId في state للاستخدام في تصدير PDF
    state.viewingOrderId = orderId || null;

    /* ── Shop info ── */
    var shopName = (lang === 'ar' ? s.laundryNameAr : s.laundryNameEn) || s.laundryNameAr || s.laundryNameEn || '';
    els.invShopName.textContent = shopName;

    var addressParts = [];
    if (s.buildingNumber) addressParts.push(s.buildingNumber);
    if (s.streetNameAr)   addressParts.push(s.streetNameAr);
    if (s.districtAr)     addressParts.push(s.districtAr);
    if (s.cityAr)         addressParts.push(s.cityAr);
    if (s.postalCode)     addressParts.push(s.postalCode);
    var locationFallback = lang === 'ar' ? s.locationAr : s.locationEn;
    els.invShopAddress.textContent = addressParts.length ? addressParts.join('، ') : (locationFallback || '');
    els.invShopPhone.textContent = s.phone ? 'هاتف: ' + s.phone : '';
    els.invShopEmail.textContent = s.email || '';

    /* ── Custom fields ── */
    var invCF = document.getElementById('invCustomFields');
    if (invCF) {
      var cfs = Array.isArray(s.customFields) ? s.customFields : [];
      if (cfs.length > 0) {
        var cfHtml = '';
        cfs.forEach(function(cf) {
          var label = cf.labelAr || cf.labelEn;
          if (label) {
            cfHtml += '<div class="inv-shop-sub">' + escHtml(label) + '</div>';
          }
        });
        invCF.innerHTML = cfHtml;
        invCF.style.display = cfHtml ? '' : 'none';
      } else {
        invCF.innerHTML = '';
        invCF.style.display = 'none';
      }
    }

    if (s.logoDataUrl) {
      els.invLogo.src = s.logoDataUrl;
      els.invLogoWrap.style.display = '';
    } else {
      els.invLogoWrap.style.display = 'none';
    }

    /* ── Reset CN mode elements ── */
    state._creditNoteModalMode = false;
    if (els.invTypeLabel) {
      const _cust = state.selectedCustomer;
      els.invTypeLabel.textContent = (_cust && _cust.taxNumber) ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة';
    }
    if (els.invCNRefRow)    els.invCNRefRow.style.display = 'none';
    if (els.invCNRefundRow) els.invCNRefundRow.style.display = 'none';
    if (els.invOrderNumRow) els.invOrderNumRow.style.display = '';

    /* ── Invoice meta ── */
    els.invOrderNum.textContent = invoiceSeq ? String(invoiceSeq) : (orderNumber || '—');
    els.invDate.textContent = formatInvoiceDate(orderDate);
    els.invVatNumber.textContent = s.vatNumber ? 'الرقم الضريبي: ' + s.vatNumber : '';

    if (s.commercialRegister) {
      els.invCR.textContent = 'السجل التجاري: ' + s.commercialRegister;
      els.invCRRow.style.display = '';
    } else {
      els.invCRRow.style.display = 'none';
    }

    /* ── Customer ── */
    var cust = state.selectedCustomer;
    if (cust && (cust.name || cust.phone)) {
      els.invCustomerSection.style.display = '';
      if (cust.name) {
        els.invCustName.textContent = cust.name;
        els.invCustNameRow.style.display = '';
      } else {
        els.invCustNameRow.style.display = 'none';
      }
      if (cust.phone) {
        els.invCustPhone.textContent = cust.phone;
        els.invCustPhoneRow.style.display = '';
      } else {
        els.invCustPhoneRow.style.display = 'none';
      }
      if (cust.taxNumber && els.invCustVat) {
        els.invCustVat.textContent = cust.taxNumber;
        els.invCustVatRow.style.display = '';
      } else if (els.invCustVatRow) {
        els.invCustVatRow.style.display = 'none';
      }
    } else {
      els.invCustomerSection.style.display = 'none';
      if (els.invCustVatRow) els.invCustVatRow.style.display = 'none';
    }

    /* ── Subscription ── */
    if (subscription && (subscription.package_name || subscription.subscription_number)) {
      els.invSubSection.style.display = '';
      if (subscription.subscription_number) {
        els.invSubRef.textContent = subscription.subscription_number;
        els.invSubRefRow.style.display = '';
      } else {
        els.invSubRefRow.style.display = 'none';
      }
      if (subscription.package_name) {
        var bal = parseFloat(subscription.credit_remaining);
        if (!isNaN(bal)) {
          els.invSubBalance.innerHTML = '<span class="sar">&#xE900;</span> ' + fmtLtr(bal);
          els.invSubBalRow.style.display = '';
        } else {
          els.invSubBalRow.style.display = 'none';
        }
      } else {
        els.invSubBalRow.style.display = 'none';
      }
    } else {
      els.invSubSection.style.display = 'none';
      els.invSubRefRow.style.display = 'none';
      els.invSubBalRow.style.display = 'none';
    }

    /* ── Items ── */
    var sarHtml = '<span class="sar">&#xE900;</span>';
    function sarFmt(n) { return sarHtml + ' ' + fmtLtr(n); }

    els.invItemsTbody.innerHTML = state.cart.map(function(item) {
      var nameAr = escHtml(item.productNameAr || '');
      var nameEn = escHtml(item.productNameEn || '');
      var svcAr  = escHtml(item.serviceNameAr  || item.serviceName || '');
      var svcEn  = escHtml(item.serviceNameEn  || '');

      var productCell = nameAr
        + (nameEn && nameEn !== nameAr ? '<br><span class="inv-td-en">' + nameEn + '</span>' : '');

      var serviceCell = svcAr
        + (svcEn && svcEn !== svcAr ? '<br><span class="inv-td-en">' + svcEn + '</span>' : '');

      return '<tr>'
        + '<td class="inv-td-name">' + productCell + '</td>'
        + '<td class="inv-td-num">' + item.qty + '</td>'
        + '<td class="inv-td-amt">' + fmtLtr(item.lineTotal) + '</td>'
        + '<td class="inv-td-name">' + (svcAr ? serviceCell : '—') + '</td>'
        + '</tr>';
    }).join('');

    /* ── Build discount label with offer name ── */
    var discountLabel = 'الخصم';
    var loyaltyRedeemAmt = Number(totals.loyaltyDiscount || 0);
    var loyaltyRedeemedPts = Number(totals.loyaltyRedeemed || 0);
    if (loyaltyRedeemedPts > 0 && loyaltyRedeemAmt > 0) {
      discountLabel = 'خصم نقاط الولاء';
    } else if (state.activeOffer && totals.discount > 0) {
      var offerName = state.activeOffer.name || '';
      var offerValTxt = state.activeOffer.discount_type === 'percentage'
        ? parseFloat(state.activeOffer.discount_value) + '%'
        : parseFloat(state.activeOffer.discount_value) + ' ر.س';
      discountLabel = 'خصم عرض (' + offerName + ' ' + offerValTxt + ')';
    }

    /* ── Totals ── */
    var displayMode = (state.viewingDeferredInvoice !== null)
      ? (state.appSettings && state.appSettings.priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive')
      : state.priceDisplayMode;
    if (displayMode === 'inclusive' && state.vatRate > 0) {
      var netBeforeTax = getPreTaxBase(totals.subtotal);
      els.invSubtotal.innerHTML = sarFmt(netBeforeTax);
      if (totals.discount > 0) {
        els.invDiscount.innerHTML = sarFmt(totals.discount);
        els.invDiscRow.style.display = '';
        var discLabelEl = els.invDiscRow.querySelector('.inv-total-label');
        if (discLabelEl) discLabelEl.textContent = discountLabel;
        // المجموع بعد الخصم
        var afterDiscAmt = netBeforeTax - totals.discount;
        els.invAfterDiscount.innerHTML = sarFmt(afterDiscAmt);
        els.invAfterDiscRow.style.display = '';
      } else {
        els.invDiscRow.style.display = 'none';
        els.invAfterDiscRow.style.display = 'none';
      }
      if (totals.extra > 0) {
        els.invExtra.innerHTML = sarFmt(totals.extra);
        els.invExtraRow.style.display = '';
      } else {
        els.invExtraRow.style.display = 'none';
      }
      els.invVatLabel.textContent = 'ضريبة القيمة المضافة (' + state.vatRate + '%)';
      els.invVat.innerHTML = sarFmt(totals.vatAmount);
      els.invVatRow.style.display = '';
      // Update labels when tax exists
      if (els.invSubtotalLabel) els.invSubtotalLabel.textContent = 'المجموع قبل الضريبة';
      if (els.invTotalLabel) els.invTotalLabel.textContent = 'الإجمالي شامل الضريبة';
    } else {
      els.invSubtotal.innerHTML = sarFmt(totals.subtotal);
      if (totals.discount > 0) {
        els.invDiscount.innerHTML = sarFmt(totals.discount);
        els.invDiscRow.style.display = '';
        var discLabelEl2 = els.invDiscRow.querySelector('.inv-total-label');
        if (discLabelEl2) discLabelEl2.textContent = discountLabel;
        // المجموع بعد الخصم
        var afterDiscAmt2 = totals.subtotal - totals.discount;
        els.invAfterDiscount.innerHTML = sarFmt(afterDiscAmt2);
        els.invAfterDiscRow.style.display = '';
      } else {
        els.invDiscRow.style.display = 'none';
        els.invAfterDiscRow.style.display = 'none';
      }
      if (totals.extra > 0) {
        els.invExtra.innerHTML = sarFmt(totals.extra);
        els.invExtraRow.style.display = '';
      } else {
        els.invExtraRow.style.display = 'none';
      }
      if (state.vatRate > 0) {
        els.invVatLabel.textContent = 'ضريبة القيمة المضافة (' + state.vatRate + '%)';
        els.invVat.innerHTML = sarFmt(totals.vatAmount);
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
    els.invTotal.innerHTML = sarFmt(totals.total);

    /* ── Mixed payment breakdown ── */
    const pc = Number(totals.paidCash || 0);
    const pd = Number(totals.paidCard || 0);
    const isMixed = (pc > 0 && pd > 0) || state.paymentMethod === 'mixed';
    
    if (isMixed && (pc > 0 || pd > 0) && els.invMixedCashRow && els.invMixedCardRow) {
      if (els.invMixedCash) els.invMixedCash.innerHTML = sarFmt(pc);
      if (els.invMixedCard) els.invMixedCard.innerHTML = sarFmt(pd);
      els.invMixedCashRow.style.display = '';
      els.invMixedCardRow.style.display = '';
    } else {
      if (els.invMixedCashRow) els.invMixedCashRow.style.display = 'none';
      if (els.invMixedCardRow) els.invMixedCardRow.style.display = 'none';
    }

    /* ── Extra options (starch / bluing) ── */
    var invExtraOpts = document.getElementById('invExtraOpts');
    var invStarchRow = document.getElementById('invStarchRow');
    var invStarch = document.getElementById('invStarch');
    var invBluingRow = document.getElementById('invBluingRow');
    var invBluing = document.getElementById('invBluing');
    var hasExtraOpts = state.starch || state.bluing;
    if (invExtraOpts) invExtraOpts.style.display = hasExtraOpts ? '' : 'none';
    if (state.starch && invStarchRow && invStarch) {
      invStarch.textContent = state.starch;
      invStarchRow.style.display = '';
    } else if (invStarchRow) {
      invStarchRow.style.display = 'none';
    }
    if (state.bluing && invBluingRow && invBluing) {
      invBluing.textContent = state.bluing;
      invBluingRow.style.display = '';
    } else if (invBluingRow) {
      invBluingRow.style.display = 'none';
    }

    /* ── Paid and Remaining (for partial payments) ── */
    // Show if we have valid paid/remaining data and it's a partial payment
    var hasPaid = totals.paid != null && !isNaN(totals.paid) && totals.paid > 0;
    var hasRemaining = totals.remaining != null && !isNaN(totals.remaining) && totals.remaining > 0;
    
    if (hasPaid && hasRemaining) {
      els.invPaidAmount.innerHTML = sarFmt(totals.paid);
      els.invPaidRow.style.display = '';
      els.invRemainingAmount.innerHTML = sarFmt(totals.remaining);
      els.invRemainingRow.style.display = '';
    } else {
      els.invPaidRow.style.display = 'none';
      els.invRemainingRow.style.display = 'none';
    }

    /* ── Payment method ── */
    var pmLabels = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك' };
    els.invPayment.textContent = pmLabels[state.paymentMethod] || state.paymentMethod;

    /* ── Hanger ── */
    if (state.selectedHanger && state.selectedHanger.number) {
      els.invHangerNum.textContent = state.selectedHanger.number;
      els.invHangerRow.style.display = '';
      if (els.btnPrintHangerTicket) els.btnPrintHangerTicket.style.display = '';
    } else {
      els.invHangerRow.style.display = 'none';
      if (els.btnPrintHangerTicket) els.btnPrintHangerTicket.style.display = 'none';
    }

    /* ── Cashier ── */
    var invCashierRow  = document.getElementById('invCashierRow');
    var invCashierName = document.getElementById('invCashierName');
    if (invCashierRow && invCashierName) {
      var cashier = (window.__currentUser && (window.__currentUser.full_name || window.__currentUser.username)) || '';
      if (cashier) {
        invCashierName.textContent = cashier;
        invCashierRow.style.display = '';
      } else {
        invCashierRow.style.display = 'none';
      }
    }

    /* ── Deferred dates (paid / cleaned / delivered) ── */
    var dd = deferredDates || {};
    if (dd.paidAt) {
      els.invPaidAt.textContent = formatInvoiceDate(dd.paidAt);
      els.invPaidAtRow.style.display = '';
    } else {
      els.invPaidAtRow.style.display = 'none';
    }
    if (dd.cleaningDate) {
      els.invCleanedAt.textContent = formatInvoiceDate(dd.cleaningDate);
      els.invCleanedAtRow.style.display = '';
    } else {
      els.invCleanedAtRow.style.display = 'none';
    }
    if (dd.deliveryDate) {
      els.invDeliveredAt.textContent = formatInvoiceDate(dd.deliveryDate);
      els.invDeliveredAtRow.style.display = '';
    } else {
      els.invDeliveredAtRow.style.display = 'none';
    }

    /* ── Invoice notes (per-order) ── */
    var invInvoiceNotes = document.getElementById('invInvoiceNotes');
    if (invInvoiceNotes) invInvoiceNotes.style.display = 'none';
    var invNotesGridRow = document.getElementById('invNotesGridRow');
    var invNotesGridContent = document.getElementById('invNotesGridContent');
    if (invNotesGridRow) {
      if (invoiceNotes) {
        if (invNotesGridContent) invNotesGridContent.textContent = invoiceNotes;
        invNotesGridRow.style.display = '';
      } else {
        invNotesGridRow.style.display = 'none';
      }
    }

    /* ── Footer notes (from settings) ── */
    var invFooterNotes = document.getElementById('invFooterNotes');
    if (invFooterNotes) {
      if (s.invoiceNotes) {
        var invNotesContent = document.getElementById('invNotesContent');
        if (invNotesContent) invNotesContent.textContent = s.invoiceNotes;
        invFooterNotes.style.display = '';
      } else {
        invFooterNotes.style.display = 'none';
      }
    }

    /* ── Loyalty Points — سطر في بيانات العميل ── */
    var invLoyaltyRow    = document.getElementById('invLoyaltyRow');
    var invLoyaltyPoints = document.getElementById('invLoyaltyPoints');
    var invLoyaltyLabel  = invLoyaltyRow ? invLoyaltyRow.querySelector('.inv-meta-label') : null;
    if (invLoyaltyRow && invLoyaltyPoints) {
      var loyaltyEarned   = Number(totals.loyaltyEarned   || 0);
      var loyaltyRedeemed = Number(totals.loyaltyRedeemed || 0);
      var isCredit        = state.paymentMethod === 'credit';
      var loyEnabled      = state.loyaltySettings && state.loyaltySettings.loyaltyEnabled;
      if (isCredit && loyEnabled && state.customerLoyaltyBalance > 0) {
        // فاتورة آجلة: نعرض الرصيد الحالي قبل الدفع
        invLoyaltyPoints.textContent = state.customerLoyaltyBalance.toLocaleString();
        if (invLoyaltyLabel) invLoyaltyLabel.textContent = 'رصيد نقاطك';
        invLoyaltyRow.style.display = '';
      } else if (loyaltyEarned > 0 || loyaltyRedeemed > 0) {
        // فاتورة مدفوعة: نعرض الرصيد الجديد بعد العملية
        var newLoyaltyBal = state.customerLoyaltyBalance - loyaltyRedeemed + loyaltyEarned;
        invLoyaltyPoints.textContent = newLoyaltyBal.toLocaleString();
        if (invLoyaltyLabel) invLoyaltyLabel.textContent = 'رصيدك من النقاط';
        invLoyaltyRow.style.display = '';
      } else {
        invLoyaltyRow.style.display = 'none';
      }
    }

    /* ── إخفاء الـ footer القديم للنقاط ── */
    var invLoyaltyFooter = document.getElementById('invLoyaltyFooter');
    if (invLoyaltyFooter) invLoyaltyFooter.style.display = 'none';

    (function fixInvCrInfoGrid() {
      var grid = document.querySelector('#invoicePaper .cr-info-grid');
      if (!grid) return;
      var cells = Array.from(grid.querySelectorAll('.cr-info-cell'));
      cells.forEach(function(c) { c.style.gridColumn = ''; });
    })();

    /* ── ZATCA QR — use stored zatcaQr from createOrder result when available ── */
    var ts = isoTimestamp(orderDate);
    if (state.vatRate > 0) {
      renderInvoiceQR(shopName, s.vatNumber, ts, fmtLtr(totals.total), fmtLtr(totals.vatAmount), state.lastZatcaQr || null);
    } else {
      els.invQR.innerHTML = '';
    }

    /* ── Barcode ── */
    if (s.showBarcodeInInvoice !== false) {
      renderInvoiceBarcode(invoiceSeq);
      if (els.invBarcode && els.invBarcode.closest('.inv-barcode-wrap')) {
        els.invBarcode.closest('.inv-barcode-wrap').style.display = '';
      }
    } else {
      if (els.invBarcode) els.invBarcode.innerHTML = '';
      if (els.invBarcode && els.invBarcode.closest('.inv-barcode-wrap')) {
        els.invBarcode.closest('.inv-barcode-wrap').style.display = 'none';
      }
    }

    /* ── Build A4 data snapshot ── */
    var addressPartsA4 = [];
    if (s.buildingNumber) addressPartsA4.push(s.buildingNumber);
    if (s.streetNameAr)   addressPartsA4.push(s.streetNameAr);
    if (s.districtAr)     addressPartsA4.push(s.districtAr);
    if (s.cityAr)         addressPartsA4.push(s.cityAr);
    if (s.postalCode)     addressPartsA4.push(s.postalCode);

    var pmLabelsA4 = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك' };

    var displayModeA4 = (state.viewingDeferredInvoice !== null)
      ? (state.appSettings && state.appSettings.priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive')
      : state.priceDisplayMode;
    var subtotalA4, vatAmountA4;
    if (displayModeA4 === 'inclusive' && state.vatRate > 0) {
      subtotalA4  = getPreTaxBase(totals.subtotal);
      vatAmountA4 = totals.vatAmount;
    } else {
      subtotalA4  = totals.subtotal;
      vatAmountA4 = totals.vatAmount;
    }

    var dd = deferredDates || {};
    state.lastA4Data = {
      shopNameAr:         s.laundryNameAr || '',
      shopNameEn:         s.laundryNameEn || '',
      shopAddressAr:      addressPartsA4.length ? addressPartsA4.join('، ') : (s.locationAr || ''),
      shopAddressEn:      s.locationEn || '',
      shopPhone:          s.phone || '',
      shopEmail:          s.email || '',
      invoiceNotes:       invoiceNotes || '',
      settingsNotes:      s.invoiceNotes || '',
      vatNumber:          s.vatNumber || '',
      commercialRegister: s.commercialRegister || '',
      logoDataUrl:        s.logoDataUrl || '',
      orderNum:           invoiceSeq ? String(invoiceSeq) : (orderNumber || '—'),
      date:               formatInvoiceDate(orderDate),
      payment:            pmLabelsA4[state.paymentMethod] || state.paymentMethod,
      titleAr:            (state.selectedCustomer && state.selectedCustomer.taxNumber) ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة',
      titleEn:            (state.selectedCustomer && state.selectedCustomer.taxNumber) ? 'Tax Invoice' : 'Simplified Tax Invoice',
      custName:           state.selectedCustomer ? state.selectedCustomer.name : '',
      custPhone:          state.selectedCustomer ? state.selectedCustomer.phone : '',
      custVat:            (state.selectedCustomer && state.selectedCustomer.taxNumber) ? state.selectedCustomer.taxNumber : '',
      subRef:             subscription && subscription.subscription_number ? subscription.subscription_number : '',
      subPackageName:     subscription && subscription.package_name ? subscription.package_name : '',
      subBalance:         subscription && subscription.credit_remaining != null ? parseFloat(subscription.credit_remaining) : null,
      cleanedAt:          dd.cleaningDate ? formatInvoiceDate(dd.cleaningDate) : '',
      deliveredAt:        dd.deliveryDate ? formatInvoiceDate(dd.deliveryDate) : '',
      paidAt:             dd.paidAt       ? formatInvoiceDate(dd.paidAt)       : '',
      items: state.cart.map(function (item) {
        return {
          productAr:  item.productNameAr || '',
          productEn:  item.productNameEn || '',
          serviceAr:  item.serviceNameAr || item.serviceName || '',
          serviceEn:  item.serviceNameEn || '',
          qty:        item.qty,
          unitPrice:  item.unitPrice,
          lineTotal:  item.lineTotal
        };
      }),
      subtotal:         subtotalA4,
      discount:         totals.discount,
      extra:            totals.extra || 0,
      vatRate:          state.vatRate,
      vatAmount:        vatAmountA4,
      total:            totals.total,
      paid:             totals.paid || null,
      remaining:        totals.remaining || null,
      paidCash:         totals.paidCash || 0,
      paidCard:         totals.paidCard || 0,
      starch:           state.starch || '',
      bluing:           state.bluing || '',
      priceDisplayMode: displayModeA4,
      invoiceNotes: invoiceNotes || '',
      settingsNotes: s.invoiceNotes || '',
      customFields: Array.isArray(s.customFields) ? s.customFields : [],
      qrPayload: state.vatRate > 0 ? {
        sellerName:  shopName,
        vatNumber:   s.vatNumber || '',
        timestamp:   ts,
        totalAmount: fmtLtr(totals.total),
        vatAmount:   fmtLtr(totals.vatAmount),
        tlvBase64:   state.lastZatcaQr || null
      } : null,
      loyaltyEarned:    totals.loyaltyEarned   || 0,
      loyaltyRedeemed:  totals.loyaltyRedeemed || 0,
      loyaltyDiscount:  totals.loyaltyDiscount || 0,
      loyaltyBalance:   state.customerLoyaltyBalance - (totals.loyaltyRedeemed || 0) + (totals.loyaltyEarned || 0),
      cashierName:      (window.__currentUser && (window.__currentUser.full_name || window.__currentUser.username)) || '',
      autoPrint: false
    };

    /* ── Show modal (thermal or A4) ── */
    applyInvoiceTypeClass();
    var paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    if (paperType === 'a4') {
      fillA4InvoiceModal(state.lastA4Data);
    }
    els.invoiceModal.style.display = 'flex';
    els.invoicePaper.scrollTop = 0;

    if (autoOpenPrint === true) {
      setTimeout(function() {
        printInvoiceByCopies();
      }, 80);
    }
  }

  /**
   * عرض وطباعة فاتورة الاشتراك بنفس مودال فاتورة البيع (حراري / A4 حسب الإعدادات)
   * @param {number} orderId - معرف الفاتورة في جدول orders
   */
  async function showSubscriptionInvoiceModal(orderId) {
    try {
      const res = await window.api.getOrderById({ id: Number(orderId) });
      if (!res || !res.success || !res.order) {
        showTopToast('تعذّر تحميل بيانات الفاتورة', 'error');
        return;
      }
      const { order, items } = res;

      state.cart = (items || []).map(function(item) {
        return {
          productNameAr: item.product_name_ar || '',
          productNameEn: item.product_name_en || '',
          serviceNameAr: item.service_name_ar || '',
          serviceNameEn: item.service_name_en || '',
          serviceName:   item.service_name_ar || '',
          qty:           item.quantity,
          unitPrice:     parseFloat(item.unit_price || 0),
          lineTotal:     parseFloat(item.line_total || 0),
        };
      });
      state.selectedCustomer = order.customer_name
        ? { name: order.customer_name, phone: order.phone || '', taxNumber: order.customer_vat || '' }
        : state.selectedCustomer;
      if (order.customer_loyalty_points != null) {
        state.customerLoyaltyBalance = Number(order.customer_loyalty_points);
      }
      state.paymentMethod    = order.payment_method || 'cash';
      state.vatRate          = Number(order.vat_rate != null ? order.vat_rate : (state.vatRate || 15));
      state.priceDisplayMode = order.price_display_mode === 'inclusive' ? 'inclusive' : 'exclusive';
      state.lastZatcaQr      = order.zatca_qr || null;
      state.viewingOrderId   = order.id;

      const subscription = res.subscription || null;

      let totalCash = parseFloat(order.paid_cash || 0);
      let totalCard = parseFloat(order.paid_card || 0);
      try {
        const paymentsRes = await window.api.getInvoiceWithPayments({ orderId: Number(orderId) });
        if (paymentsRes && paymentsRes.success && Array.isArray(paymentsRes.payments) && paymentsRes.payments.length) {
          totalCash = 0;
          totalCard = 0;
          paymentsRes.payments.forEach(function(p) {
            const method = p.payment_method;
            if (method === 'cash') {
              totalCash += Number(p.payment_amount || 0);
            } else if (method === 'card') {
              totalCard += Number(p.payment_amount || 0);
            } else if (method === 'mixed') {
              totalCash += Number(p.cash_amount || 0);
              totalCard += Number(p.card_amount || 0);
            }
          });
        }
      } catch (_) {}

      if (totalCash > 0 && totalCard > 0) {
        state.paymentMethod = 'mixed';
      }

      showInvoiceModal(
        order.order_number,
        order.created_at,
        {
          subtotal:  Number(order.subtotal || 0),
          discount:  Number(order.discount_amount || 0),
          extra:     Number(order.extra_amount || 0),
          vatAmount: Number(order.vat_amount || 0),
          total:     Number(order.total_amount || 0),
          paid:      Number(order.paid_amount || 0),
          remaining: Number(order.remaining_amount || 0),
          paidCash:  totalCash,
          paidCard:  totalCard,
        },
        subscription,
        order.invoice_seq,
        null,
        true,
        order.id,
        order.notes || ''
      );
      state._printingSubscription = true;
    } catch (e) {
      console.error('showSubscriptionInvoiceModal error:', e);
      showTopToast('خطأ في عرض الفاتورة', 'error');
    }
  }

  function closeInvoiceModal() {
    els.invoiceModal.style.display = 'none';
    document.body.classList.remove('invtype-a4');

    if (state._creditNoteModalMode) {
      state._creditNoteModalMode = false;
      if (els.invTypeLabel)   els.invTypeLabel.textContent = 'فاتورة ضريبية مبسطة';
      if (els.invCNRefRow)    els.invCNRefRow.style.display = 'none';
      if (els.invOrderNumRow) els.invOrderNumRow.style.display = '';
      if (els.invCustVatRow)  els.invCustVatRow.style.display = 'none';
      clearCart();
      clearCustomer();
      return;
    }

    if (state.viewingDeferredInvoice) {
      const saved = state.viewingDeferredInvoice;
      state.cart             = saved.cart;
      state.selectedCustomer = saved.customer;
      state.paymentMethod    = saved.pm;
      state.vatRate          = saved.vat;
      state.priceDisplayMode = saved.priceDisplayMode || 'exclusive';
      state.viewingDeferredInvoice = null;
    } else {
      resetForNewSale();
    }
  }

  /* ========== CHECKOUT ========== */
  async function handlePay() {
    if (state.cart.length === 0) {
      showToast(t('pos-err-empty-cart'), 'error');
      return;
    }

    if (state.appSettings && state.appSettings.requireHanger && !state.selectedHanger) {
      showTopToast('الشماعة إلزامية — يرجى اختيار شماعة متاحة', 'error');
      if (els.hangerSelect) els.hangerSelect.focus();
      return;
    }

    if (state.appSettings && state.appSettings.requireCustomerPhone) {
      if (!state.selectedCustomer || !state.selectedCustomer.phone || !state.selectedCustomer.phone.trim()) {
        showTopToast('رقم جوال العميل إلزامي — يرجى اختيار عميل يحتوي على رقم جوال', 'error');
        if (els.customerSearch) els.customerSearch.focus();
        return;
      }
    }

    const { subtotal, discount, extra, vatAmount, total } = getOrderTotals();

    if (state.paymentMethod === 'mixed') {
      if (total > 0 && state.mixedCash <= 0 && state.mixedCard <= 0) {
        if (els.mixedPayError) {
          els.mixedPayError.textContent = 'أدخل المبلغ النقدي للدفع المختلط';
          els.mixedPayError.style.display = '';
        }
        if (els.mixedCashInput) els.mixedCashInput.focus();
        return;
      }
      const sum = clampToTwo(state.mixedCash + state.mixedCard);
      const roundedTotal = clampToTwo(total);
      if (Math.abs(sum - roundedTotal) > 0.01) {
        if (els.mixedPayError) {
          els.mixedPayError.textContent = 'مجموع نقداً + شبكة لا يساوي الإجمالي';
          els.mixedPayError.style.display = '';
        }
        return;
      }
      if (els.mixedPayError) els.mixedPayError.style.display = 'none';
    }

    els.btnPay.disabled = true;
    els.btnPay.classList.add('loading');

    try {
      const items = state.cart.map((item) => ({
        productId: item.productId,
        serviceId: item.serviceId,
        quantity: item.qty,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        productNameAr: item.productNameAr || null,
        productNameEn: item.productNameEn || null,
        serviceNameAr: item.serviceNameAr || null,
        serviceNameEn: item.serviceNameEn || null
      }));

      const res = await window.api.createOrder({
        customerId: state.selectedCustomer ? state.selectedCustomer.id : null,
        items,
        subtotal: parseFloat(subtotal.toFixed(2)),
        discountAmount: parseFloat(discount.toFixed(2)),
        discountLabel: (() => {
          const parts = [];
          if (state.activeOffer) {
            parts.push('خصم عرض (' + (state.activeOffer.name || '') + ' ' + (state.activeOffer.discount_type === 'percentage' ? parseFloat(state.activeOffer.discount_value) + '%' : parseFloat(state.activeOffer.discount_value) + ' ر.س') + ')');
          }
          if (state.loyaltyPointsToRedeem > 0) {
            parts.push('خصم نقاط الولاء (' + state.loyaltyPointsToRedeem + ' نقطة)');
          }
          return parts.length ? parts.join(' + ') : null;
        })(),
        loyaltyPointsToRedeem: state.loyaltyPointsToRedeem || 0,
        extraAmount: parseFloat(extra.toFixed(2)),
        vatRate: state.vatRate,
        vatAmount: parseFloat(vatAmount.toFixed(2)),
        totalAmount: parseFloat(total.toFixed(2)),
        paymentMethod: state.paymentMethod,
        paidCash: state.paymentMethod === 'mixed' ? state.mixedCash : 0,
        paidCard: state.paymentMethod === 'mixed' ? state.mixedCard : 0,
        starch: state.starch || '',
        bluing: state.bluing || '',
        priceDisplayMode: state.priceDisplayMode,
        hangerId: state.selectedHanger ? state.selectedHanger.id : null,
        notes: state.invoiceNotes || null
      });

      if (!res || !res.success) {
        showTopToast(res && res.message ? res.message : t('pos-err-save'), 'error');
        return;
      }

      var subscription = null;
      if (res.id) {
        try {
          var orderRes = await window.api.getOrderById({ id: res.id });
          if (orderRes && orderRes.success && orderRes.subscription) {
            subscription = orderRes.subscription;
          }
        } catch (_) {}
      }
      if (!subscription && state.selectedCustomer && state.selectedCustomer.id) {
        try {
          var subRes = await window.api.getCustomerActiveSubscription({ customerId: state.selectedCustomer.id });
          if (subRes && subRes.success && subRes.subscription) {
            subscription = subRes.subscription;
          }
        } catch (_) {}
      }

      state.paymentMethod = res.paymentMethod || state.paymentMethod;
      state.lastZatcaQr = res.zatcaQr || null;

      var consumed = Number(res.consumptionAmount || 0);
      var invoicePart = Number(res.invoiceAmount != null ? res.invoiceAmount : total);
      var ratio = total > 0 && consumed > 0 && invoicePart > 0 ? invoicePart / total : 1;

      if (consumed > 0) {
        state.shouldClearCartAfterConsumptionPrint = !!res.isConsumptionOnly;
        showConsumptionReceiptModal(res, subscription, true);
      }

      if (!res.isConsumptionOnly) {
        var invTotals = consumed > 0 && invoicePart > 0 ? {
          subtotal: parseFloat((subtotal * ratio).toFixed(2)),
          discount: parseFloat((discount * ratio).toFixed(2)),
          extra: parseFloat((extra * ratio).toFixed(2)),
          vatAmount: parseFloat((vatAmount * ratio).toFixed(2)),
          total: invoicePart,
          paidCash: state.paymentMethod === 'mixed' ? parseFloat((state.mixedCash * ratio).toFixed(2)) : 0,
          paidCard: state.paymentMethod === 'mixed' ? parseFloat((state.mixedCard * ratio).toFixed(2)) : 0
        } : {
          subtotal, discount, extra, vatAmount, total,
          paidCash: state.paymentMethod === 'mixed' ? state.mixedCash : 0,
          paidCard: state.paymentMethod === 'mixed' ? state.mixedCard : 0
        };
        invTotals.loyaltyEarned   = Number(res.loyaltyEarned   || 0);
        invTotals.loyaltyRedeemed = Number(res.loyaltyRedeemed || 0);
        invTotals.loyaltyDiscount = state.loyaltyDiscount || 0;
        setTimeout(function () {
          showInvoiceModal(res.orderNumber, res.createdAt || null,
            invTotals, subscription, res.invoiceSeq, null, consumed <= 0, res.id, state.invoiceNotes);
        }, consumed > 0 ? 800 : 0);
      }

    } catch (err) {
      showToast(t('pos-err-save'), 'error');
    } finally {
      els.btnPay.disabled = state.cart.length === 0;
      els.btnPay.classList.remove('loading');
    }
  }

  function resetForNewSale() {
    if (state.invoiceProcessMode) exitInvoiceProcessMode();
    clearCart();
    clearCustomer();
    clearHanger();
    loadHangers();
    els.discountInput.value = '';
    state.discount = 0;
    state.discountType = 'flat';
    els.btnDiscFlat.classList.add('active');
    els.btnDiscPct.classList.remove('active');
    els.discountInput.removeAttribute('max');
    state.paymentMethod = (state.appSettings && state.appSettings.defaultPaymentMethod &&
      els.paymentSelect.querySelector(`option[value="${state.appSettings.defaultPaymentMethod}"]`)
      ? state.appSettings.defaultPaymentMethod
      : els.paymentSelect.options[0]?.value) || 'cash';
    els.paymentSelect.value = state.paymentMethod;
    state.mixedCash = 0;
    state.mixedCard = 0;
    state.starch = '';
    state.bluing = '';
    state.extra = 0;
    state.lastZatcaQr = null;
    if (els.starchSelect) els.starchSelect.value = '';
    if (els.bluingSelect) els.bluingSelect.value = '';
    if (els.mixedCashInput) els.mixedCashInput.value = '';
    if (els.extraInput) els.extraInput.value = '';
    state.invoiceNotes = '';
    if (els.invoiceNotesInput) els.invoiceNotesInput.value = '';
    if (els.mixedCashInline) els.mixedCashInline.style.display = state.paymentMethod === 'mixed' ? '' : 'none';
    if (els.mixedPaySection) els.mixedPaySection.style.display = state.paymentMethod === 'mixed' ? '' : 'none';
    if (els.mixedPayError) els.mixedPayError.style.display = 'none';
    updateSummary();
  }

  /* ========== MOBILE PANEL TOGGLE ========== */
  function showMobileProducts() {
    state.isMobileProductsView = true;
    els.productsPanel.removeAttribute('data-hidden');
    els.cartPanel.setAttribute('data-hidden', 'true');
    els.btnShowProducts.classList.add('active');
    els.btnShowCart.classList.remove('active');
  }

  function showMobileCart() {
    state.isMobileProductsView = false;
    els.cartPanel.removeAttribute('data-hidden');
    els.productsPanel.setAttribute('data-hidden', 'true');
    els.btnShowCart.classList.add('active');
    els.btnShowProducts.classList.remove('active');
  }

  /* ========== ESCAPE HTML ========== */
  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // إرسال من HTML الشاشة (مطابق للطباعة تماماً)
  async function sendInvoiceWhatsAppFromHtml(html, paperType, phone, orderNum, zatcaPayload, stage, totalAmount) {
    if (!html || !phone) return;
    const s = state.appSettings || {};
    const num = orderNum || '';
    const totalLine = totalAmount ? '\n*الإجمالي: ' + Number(totalAmount).toFixed(2) + ' SAR*' : '';
    const _stageMessages = {
      receive:     'تم استلام ملابسكم 👔\nفاتورة رقم: ' + num + totalLine,
      subscription:'تم تفعيل اشتراككم بنجاح 🎉\nفاتورة رقم: ' + num + totalLine,
      pay:         'تم دفع الفاتورة بنجاح ✅\nفاتورة رقم: ' + num + totalLine,
      clean:       'تم تنظيف ملابسكم 🧺\nفاتورة رقم: ' + num + totalLine,
      deliver:     'تم تسليم ملابسكم 🎁\nفاتورة رقم: ' + num + totalLine,
      consumption: 'تم استلام ملابسكم 👔\nإيصال استهلاك رقم: ' + num + totalLine,
    };
    const autoMsg = _stageMessages[stage] || '';
    const optionalMsg = s.whatsappInvoiceMessage
      ? s.whatsappInvoiceMessage.split('\n').map(function(l) { var t = l.trim(); return t ? '*' + t + '*' : ''; }).join('\n')
      : '';
    const caption = autoMsg
      ? (optionalMsg ? autoMsg + '\n\n' + optionalMsg : autoMsg)
      : optionalMsg;
    try {
      const _waRes = await window.api.whatsappSendInvoicePdfFromHtml({
        html, paperType: paperType || 'thermal', phone,
        caption,
        orderNum: num,
        zatcaPayload: zatcaPayload || null
      });
      const _label = stage === 'consumption' ? 'إيصال رقم: ' + num : 'فاتورة رقم: ' + num;
      if (_waRes && _waRes.success) {
        showTopToast('✅ واتساب | ' + _label + ' — تم الإرسال', 'success', 4000);
      } else if (_waRes && (_waRes.message === 'not_on_whatsapp' || _waRes.error === 'not_on_whatsapp')) {
        showTopToast('⚠️ واتساب | ' + _label + ' — الرقم غير مسجّل في واتساب', 'warning', 5000);
      } else {
        showTopToast('❌ واتساب | ' + _label + ' — فشل الإرسال', 'error', 5000);
      }
    } catch (_) {}
  }

  // إرسال من orderId — يحمّل الفاتورة في المودال بصمت ويلتقط HTML مطابق للشاشة
  async function sendInvoiceWhatsApp(orderId, phone, stage) {
    if (!orderId || !phone) return;
    const s = state.appSettings || {};
    try {
      // نحفظ الحالة الحالية
      const _prevCart          = state.cart.slice();
      const _prevCustomer      = state.selectedCustomer;
      const _prevPayment       = state.paymentMethod;
      const _prevVatRate       = state.vatRate;
      const _prevPriceMode     = state.priceDisplayMode;
      const _prevZatcaQr       = state.lastZatcaQr;
      const _prevViewingId     = state.viewingOrderId;
      const _prevModalDisplay  = els.invoiceModal ? els.invoiceModal.style.display : 'none';

      // نخفي المودال أثناء التحميل
      if (els.invoiceModal) els.invoiceModal.style.display = 'none';

      // نحمّل بيانات الفاتورة
      const res = await window.api.getOrderById({ id: Number(orderId) });
      if (!res || !res.success || !res.order) return;
      const { order, items } = res;

      // نجمع الدفعات
      let totalCash = parseFloat(order.paid_cash || 0);
      let totalCard = parseFloat(order.paid_card || 0);
      try {
        const paymentsRes = await window.api.getInvoiceWithPayments({ orderId: Number(orderId) });
        if (paymentsRes && paymentsRes.success && Array.isArray(paymentsRes.payments) && paymentsRes.payments.length) {
          totalCash = 0; totalCard = 0;
          paymentsRes.payments.forEach(function(p) {
            if (p.payment_method === 'cash') totalCash += Number(p.payment_amount || 0);
            else if (p.payment_method === 'card') totalCard += Number(p.payment_amount || 0);
            else if (p.payment_method === 'mixed') { totalCash += Number(p.cash_amount || 0); totalCard += Number(p.card_amount || 0); }
          });
        }
      } catch (_) {}

      // نضبط state مؤقتاً لملء المودال
      state.cart = (items || []).map(function(item) {
        return { productNameAr: item.product_name_ar || '', productNameEn: item.product_name_en || '',
          serviceNameAr: item.service_name_ar || '', serviceNameEn: item.service_name_en || '',
          serviceName: item.service_name_ar || '', qty: item.quantity,
          unitPrice: parseFloat(item.unit_price || 0), lineTotal: parseFloat(item.line_total || 0) };
      });
      state.selectedCustomer = { name: order.customer_name || '', phone: order.phone || '', taxNumber: order.customer_vat || '' };
      state.paymentMethod    = (totalCash > 0 && totalCard > 0) ? 'mixed' : (order.payment_method || 'cash');
      if (totalCash > 0 && totalCard > 0) { state.mixedCash = totalCash; state.mixedCard = totalCard; }
      state.vatRate          = Number(order.vat_rate != null ? order.vat_rate : (state.vatRate || 15));
      state.priceDisplayMode = order.price_display_mode === 'inclusive' ? 'inclusive' : 'exclusive';
      state.lastZatcaQr      = order.zatca_qr || null;
      state.viewingOrderId   = order.id;

      // نملأ المودال بدون طباعة (autoOpenPrint = false) مع تواريخ السداد/التنظيف/التسليم
      showInvoiceModal(order.order_number, order.created_at,
        { subtotal: Number(order.subtotal || 0), discount: Number(order.discount_amount || 0),
          extra: Number(order.extra_amount || 0), vatAmount: Number(order.vat_amount || 0),
          total: Number(order.total_amount || 0), paid: Number(order.paid_amount || 0),
          remaining: Number(order.remaining_amount || 0), paidCash: totalCash, paidCard: totalCard },
        res.subscription || null, order.invoice_seq,
        { paidAt: order.paid_at || null, cleaningDate: order.cleaning_date || null, deliveryDate: order.delivery_date || null },
        false, order.id, order.notes || '');

      // نولّد QR مباشرةً ونحقنه (بدلاً من الانتظار على renderInvoiceQR async)
      const paperType = s.invoicePaperType || 'thermal';
      const _qrEl = paperType === 'a4'
        ? document.getElementById('a4mQR')
        : (els.invQR || document.getElementById('invQR'));
      if (_qrEl && Number(order.vat_rate || 0) > 0) {
        try {
          const _qrPayload = order.zatca_qr
            ? { tlvBase64: order.zatca_qr }
            : { sellerName: s.laundryNameAr || '',
                vatNumber:   s.vatNumber || '',
                timestamp:   order.created_at || new Date().toISOString(),
                totalAmount: String(Number(order.total_amount  || 0).toFixed(2)),
                vatAmount:   String(Number(order.vat_amount    || 0).toFixed(2)) };
          const _qrRes = await window.api.generateZatcaQR(_qrPayload);
          if (_qrRes && _qrRes.success && _qrRes.svg) {
            _qrEl.innerHTML = _qrRes.svg;
          }
        } catch (_) {}
      }

      // نلتقط HTML من المودال
      const paperEl = paperType === 'a4'
        ? document.getElementById('invoicePaperA4m')
        : document.getElementById('invoicePaper');
      const capturedHtml = paperEl ? paperEl.outerHTML : null;
      const orderNumEl = document.getElementById('invOrderNum');
      const orderNum = orderNumEl ? orderNumEl.textContent : String(order.invoice_seq || orderId);

      // نعيد إخفاء المودال فوراً
      if (els.invoiceModal) els.invoiceModal.style.display = 'none';

      // نستعيد الحالة السابقة
      state.cart             = _prevCart;
      state.selectedCustomer = _prevCustomer;
      state.paymentMethod    = _prevPayment;
      state.vatRate          = _prevVatRate;
      state.priceDisplayMode = _prevPriceMode;
      state.lastZatcaQr      = _prevZatcaQr;
      state.viewingOrderId   = _prevViewingId;
      if (els.invoiceModal) els.invoiceModal.style.display = _prevModalDisplay;

      // نرسل HTML كـ PDF مع بيانات QR كاحتياط
      if (capturedHtml) {
        const _zatcaPayload = order.zatca_qr
          ? { tlvBase64: order.zatca_qr }
          : (Number(order.vat_rate || 0) > 0 ? {
              sellerName:  s.laundryNameAr    || '',
              vatNumber:   s.vatNumber        || '',
              timestamp:   order.created_at   || new Date().toISOString(),
              totalAmount: String(Number(order.total_amount || 0).toFixed(2)),
              vatAmount:   String(Number(order.vat_amount   || 0).toFixed(2))
            } : null);
        await sendInvoiceWhatsAppFromHtml(capturedHtml, paperType, phone, orderNum, _zatcaPayload, stage, order.total_amount || 0);
      }
    } catch (_) {}
  }

  function getPrintCopies() {
    var copies = Number(state.appSettings && state.appSettings.printCopies);
    if (!Number.isFinite(copies)) return 1;
    copies = Math.floor(copies);
    if (copies < 0) return 1;
    if (copies > 20) return 20;
    return copies;
  }

  function printInvoiceByCopies() {
    var paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    var copies = getPrintCopies();
    if (copies === 0) return;
    var styleEl = null;

    if (paperType === 'a4') {
      styleEl = document.createElement('style');
      styleEl.id = 'a4PageStyle';
      styleEl.textContent = '@page { size: A4 portrait; margin: 0; }';
      document.head.appendChild(styleEl);
    }

    var currentCopy = 0;
    var cleaned = false;

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
      var handled = false;
      function handleAfterPrint() {
        if (handled) return;
        handled = true;
        window.removeEventListener('afterprint', handleAfterPrint);
        if (currentCopy < copies) {
          setTimeout(printNextCopy, 120);
        } else {
          cleanupPrintArtifacts();
          // نحفظ بيانات الواتساب قبل مسح السلة (clearCart يمسح state.selectedCustomer)
          const _waSettings = state.appSettings || {};
          const _waPhone = (state.selectedCustomer && state.selectedCustomer.phone) || '';
          const _waSub = state._printingSubscription;
          const _waPaperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
          // التقاط HTML الفاتورة — QR مرسوم بالفعل لأن المستخدم أغلق نافذة الطباعة
          const _waPaperEl = _waPaperType === 'a4'
            ? document.getElementById('invoicePaperA4m')
            : document.getElementById('invoicePaper');
          const _waHtml = _waPaperEl ? _waPaperEl.outerHTML : null;
          const _waOrderNumEl = document.getElementById('invOrderNum');
          const _waOrderNum = _waOrderNumEl ? _waOrderNumEl.textContent : '';
          // بيانات QR كاحتياط للسيرفر
          const _waZatca = state.lastZatcaQr
            ? { tlvBase64: state.lastZatcaQr }
            : (state.vatRate > 0 ? {
                sellerName:  (_waSettings.laundryNameAr || ''),
                vatNumber:   (_waSettings.vatNumber     || ''),
                timestamp:   new Date().toISOString(),
                totalAmount: '0.00', vatAmount: '0.00'
              } : null);
          const _waTotal = (state.lastA4Data && state.lastA4Data.total) || 0;
          // After a successful save + print request, empty the cart automatically.
          if (!state._creditNoteModalMode && !state.viewingDeferredInvoice) {
            clearCart();
          }
          // إرسال الفاتورة عبر الواتساب إذا كان الإعداد مفعلاً (من HTML مطابق للطباعة)
          if (_waSub && _waSettings.whatsappSendOnSubscription) {
            state._printingSubscription = false;
            if (_waHtml) sendInvoiceWhatsAppFromHtml(_waHtml, _waPaperType, _waPhone, _waOrderNum, _waZatca, 'subscription', _waTotal);
          } else if (!_waSub && _waSettings.whatsappSendOnPrint) {
            if (_waHtml) sendInvoiceWhatsAppFromHtml(_waHtml, _waPaperType, _waPhone, _waOrderNum, _waZatca, 'receive', _waTotal);
          }
          state._printingSubscription = false;
          // Keep the invoice modal visible after printing so the user can
          // export PDF or review details. The user closes it manually.
        }
      }

      window.addEventListener('afterprint', handleAfterPrint);
      window.print();
      setTimeout(handleAfterPrint, 2500);
    }

    printNextCopy();
  }

  /* ========== INVOICE PROCESS MODE ========== */
  function showInvProcError(msg) {
    if (!msg) return;
    showTopToast(msg, 'error', 4000);
  }

  function enterInvoiceProcessMode(invoice, items) {
    state.invoiceProcessMode = true;
    state.processingInvoice = { invoice, items };

    if (els.invProcIdle) els.invProcIdle.style.display = 'none';
    els.invProcBanner.style.display = 'flex';
    els.invProcOrigNum.textContent = String(invoice.invoice_seq || invoice.order_number || invoice.id);
    const custName = invoice.customer_name || '';
    els.invProcCust.textContent = custName;
    if (els.invProcCustSep) els.invProcCustSep.style.display = custName ? '' : 'none';
    els.invoiceSeqInput.value = '';
    els.invoiceSeqInput.disabled = true;
    els.btnProcessInvoice.disabled = true;

    const isSubInv = invoice.order_type === 'subscription_new' || invoice.order_type === 'subscription_renewal';
    const subPkgName = isSubInv ? (invoice.notes || 'باقة اشتراك') : '';
    const subSvcLabel = isSubInv
      ? (invoice.order_type === 'subscription_renewal' ? 'تجديد اشتراك' : 'اشتراك جديد')
      : '';

    const cartItems = (items && items.length > 0) ? items
      : (isSubInv ? [{ product_id: null, laundry_service_id: null, product_name_ar: null,
          service_name_ar: null, quantity: 1,
          unit_price: parseFloat(invoice.total_amount || 0),
          line_total: parseFloat(invoice.total_amount || 0), id: 0 }] : []);

    state.cart = cartItems.map(item => ({
      productId: item.product_id,
      serviceId: item.laundry_service_id,
      productNameAr: item.product_name_ar || subPkgName,
      productNameEn: item.product_name_en || '',
      serviceNameAr: item.service_name_ar || subSvcLabel,
      serviceNameEn: item.service_name_en || '',
      serviceName: item.service_name_ar || subSvcLabel,
      key: `proc_${item.product_id}_${item.laundry_service_id}_${item.id}`,
      qty: item.quantity,
      unitPrice: parseFloat(item.unit_price || 0),
      lineTotal: parseFloat(item.line_total || 0),
      readOnly: true,
    }));

    if (invoice.customer_name) {
      state.selectedCustomer = {
        id: invoice.customer_id || null,
        name: invoice.customer_name,
        phone: invoice.phone || '',
        taxNumber: invoice.customer_vat || '',
      };
      els.chipName.textContent = invoice.customer_name;
      els.chipPhone.textContent = invoice.phone || '';
      els.chipSubscription.style.display = 'none';
      els.selectedCustomerChip.style.display = 'flex';
      els.chipSubNumber.style.display = 'none';

      if (invoice.customer_id && invoice.payment_method === 'subscription') {
        window.api.getCustomerActiveSubscription({ customerId: invoice.customer_id })
          .then(function (res) {
            if (res && res.success && res.subscription) {
              var sub = res.subscription;
              var status = sub.display_status;
              var remaining = parseFloat(sub.credit_remaining) || 0;
              if (status === 'active' || status === 'expired') {
                els.chipSubLabel.textContent = sub.package_name || 'اشتراك';
                els.chipSubBalance.innerHTML = 'متبقي: <span>' + remaining.toFixed(2) + '</span> <span class="sar">&#xE900;</span>';
                els.chipSubscription.className = 'chip-subscription ' + (status === 'active' ? 'chip-sub-active' : 'chip-sub-expired');
                els.chipSubscription.style.display = 'flex';
              }
              if (invoice.subscription_number) {
                els.chipSubNumber.textContent = 'اشتراك: ' + invoice.subscription_number;
                els.chipSubNumber.style.display = '';
              }
            }
          })
          .catch(function () {});
      }
    }

    state.priceDisplayMode = invoice.price_display_mode === 'inclusive' ? 'inclusive' : 'exclusive';

    const discAmt  = parseFloat(invoice.discount_amount || 0);
    const extraAmt = parseFloat(invoice.extra_amount   || 0);
    state.discount = discAmt;
    state.extra    = extraAmt;
    state.discountType = 'flat';
    if (els.discountInput) els.discountInput.value = discAmt > 0 ? fmtLtr(discAmt) : '';
    if (els.extraInput)    els.extraInput.value    = extraAmt > 0 ? fmtLtr(extraAmt) : '';

    els.btnClearCart.style.display = 'none';
    els.btnPay.style.display = 'none';
    if (els.creditNoteActions) els.creditNoteActions.style.display = '';

    const disableEls = [
      els.discountInput, els.extraInput, els.paymentSelect,
      els.starchSelect, els.bluingSelect, els.hangerSelect,
      els.customerSearch, els.btnAddCustomer, els.btnAddSubscription,
      els.btnDiscFlat, els.btnDiscPct,
    ];
    disableEls.forEach(el => { if (el) el.disabled = true; });

    renderCart();
    updateMobileCartBadge();

    if (window.matchMedia('(max-width: 767px)').matches) {
      showMobileCart();
    }
  }

  function exitInvoiceProcessMode() {
    state.invoiceProcessMode = false;
    state.processingInvoice = null;

    state.priceDisplayMode = state.appSettings && state.appSettings.priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive';

    els.invProcBanner.style.display = 'none';
    if (els.invProcIdle) els.invProcIdle.style.display = '';
    if (els.invoiceSeqInput) { els.invoiceSeqInput.disabled = false; els.invoiceSeqInput.value = ''; }
    if (els.btnProcessInvoice) els.btnProcessInvoice.disabled = false;
    els.btnClearCart.style.display = '';
    els.btnPay.style.display = '';
    if (els.creditNoteActions) els.creditNoteActions.style.display = 'none';

    const enableEls = [
      els.discountInput, els.extraInput, els.paymentSelect,
      els.starchSelect, els.bluingSelect, els.hangerSelect,
      els.customerSearch, els.btnAddCustomer, els.btnAddSubscription,
      els.btnDiscFlat, els.btnDiscPct,
    ];
    enableEls.forEach(el => { if (el) el.disabled = false; });
  }

  async function handleProcessInvoice() {
    const seqVal = els.invoiceSeqInput ? els.invoiceSeqInput.value.trim() : '';
    if (!seqVal || isNaN(Number(seqVal)) || Number(seqVal) <= 0) {
      showInvProcError('يرجى إدخال رقم فاتورة صحيح');
      return;
    }

    showInvProcError('');
    els.btnProcessInvoice.disabled = true;
    els.btnProcessInvoice.innerHTML = `
      <svg class="spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
        <path d="M21 12a9 9 0 1 1-9-9"/>
      </svg>
      <span>جارٍ البحث...</span>`;

    try {
      const res = await window.api.getInvoiceBySeq({ invoiceSeq: Number(seqVal) });
      if (!res || !res.success) {
        showInvProcError(res && res.message ? res.message : 'لم يتم العثور على الفاتورة');
        return;
      }
      enterInvoiceProcessMode(res.order, res.items);
    } catch (err) {
      showInvProcError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      els.btnProcessInvoice.disabled = false;
      els.btnProcessInvoice.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        <span>معالجة الفاتورة</span>`;
    }
  }

  async function handleCreateCreditNote() {
    if (!state.invoiceProcessMode || !state.processingInvoice) return;

    const { invoice, items } = state.processingInvoice;
    const inv = invoice;

    const subtotal    = parseFloat(inv.subtotal         || 0);
    const discAmt     = parseFloat(inv.discount_amount  || 0);
    const extraAmt    = parseFloat(inv.extra_amount     || 0);
    const vatRate     = parseFloat(inv.vat_rate         || 0);
    const vatAmount   = parseFloat(inv.vat_amount       || 0);
    const totalAmount = parseFloat(inv.total_amount     || 0);

    const btn = els.btnCreateCreditNote;
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
        <path d="M21 12a9 9 0 1 1-9-9"/>
      </svg>
      <span>جارٍ المعالجة...</span>`;

    try {
      const res = await window.api.createCreditNote({
        originalOrderId: inv.id,
        customerId: inv.customer_id || null,
        subtotal,
        discountAmount: discAmt,
        extraAmount: extraAmt,
        vatRate,
        vatAmount,
        totalAmount,
        priceDisplayMode: state.priceDisplayMode,
        items: items.map(it => ({
          product_id:        it.product_id,
          laundry_service_id: it.laundry_service_id,
          product_name_ar:   it.product_name_ar,
          product_name_en:   it.product_name_en,
          service_name_ar:   it.service_name_ar,
          service_name_en:   it.service_name_en,
          quantity:          it.quantity,
          unit_price:        it.unit_price,
          line_total:        it.line_total,
        })),
        notes: null,
      });

      if (!res || !res.success) {
        showTopToast(res && res.message ? res.message : 'فشل إنشاء إشعار الدائن', 'error');
        return;
      }

      exitInvoiceProcessMode();
      showCreditNoteInvoiceModal(res, inv, items);

    } catch (err) {
      showTopToast(err.message || 'حدث خطأ غير متوقع', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        <span>معالجة كامل الفاتورة (إشعار دائن)</span>`;
    }
  }

  /* ========== CREDIT NOTE INVOICE MODAL ========== */
  function showCreditNoteInvoiceModal(cnRes, inv, items) {
    var s = state.appSettings || {};
    var lang = getLang();

    state.viewingOrderId = null;

    var shopName = (lang === 'ar' ? s.laundryNameAr : s.laundryNameEn) || s.laundryNameAr || s.laundryNameEn || '';
    els.invShopName.textContent = shopName;

    var addressParts = [];
    if (s.buildingNumber) addressParts.push(s.buildingNumber);
    if (s.streetNameAr)   addressParts.push(s.streetNameAr);
    if (s.districtAr)     addressParts.push(s.districtAr);
    if (s.cityAr)         addressParts.push(s.cityAr);
    if (s.postalCode)     addressParts.push(s.postalCode);
    els.invShopAddress.textContent = addressParts.length ? addressParts.join('، ') : (s.locationAr || s.locationEn || '');
    els.invShopPhone.textContent = s.phone ? 'هاتف: ' + s.phone : '';
    els.invShopEmail.textContent = s.email || '';

    /* ── Custom fields (credit note) ── */
    var invCFCn = document.getElementById('invCustomFields');
    if (invCFCn) {
      var cfsCn = Array.isArray(s.customFields) ? s.customFields : [];
      if (cfsCn.length > 0) {
        var cfHtmlCn = '';
        cfsCn.forEach(function(cf) {
          var label = cf.labelAr || cf.labelEn;
          if (label) {
            cfHtmlCn += '<div class="inv-shop-sub">' + escHtml(label) + '</div>';
          }
        });
        invCFCn.innerHTML = cfHtmlCn;
        invCFCn.style.display = cfHtmlCn ? '' : 'none';
      } else {
        invCFCn.innerHTML = '';
        invCFCn.style.display = 'none';
      }
    }

    if (s.logoDataUrl) {
      els.invLogo.src = s.logoDataUrl;
      els.invLogoWrap.style.display = '';
    } else {
      els.invLogoWrap.style.display = 'none';
    }

    var cnNum  = cnRes.creditNoteNumber || String(cnRes.creditNoteSeq);
    var origNum = String(cnRes.originalInvoiceSeq || inv.invoice_seq || inv.order_number || inv.id);
    if (els.invTypeLabel)   els.invTypeLabel.textContent = 'إشعار دائن للفاتورة الضريبية المبسطة';
    if (els.invCNRefRow)    els.invCNRefRow.style.display = '';
    if (els.invCNRefText)   els.invCNRefText.textContent = 'رقم الإشعار: ' + cnNum + ' — الفاتورة الأصلية: ' + origNum;
    if (els.invOrderNumRow) els.invOrderNumRow.style.display = 'none';
    if (els.invCNRefundRow) els.invCNRefundRow.style.display = 'none';

    var cnSeq = cnRes.creditNoteSeq;
    els.invOrderNum.textContent = cnRes.creditNoteNumber || String(cnSeq);
    els.invDate.textContent = formatInvoiceDate(new Date().toISOString());
    els.invVatNumber.textContent = s.vatNumber ? 'الرقم الضريبي: ' + s.vatNumber : '';

    if (s.commercialRegister) {
      els.invCR.textContent = 'السجل التجاري: ' + s.commercialRegister;
      els.invCRRow.style.display = '';
    } else {
      els.invCRRow.style.display = 'none';
    }

    if (inv.customer_name) {
      els.invCustomerSection.style.display = '';
      els.invCustName.textContent = inv.customer_name;
      els.invCustNameRow.style.display = '';
      if (inv.phone) {
        els.invCustPhone.textContent = inv.phone;
        els.invCustPhoneRow.style.display = '';
      } else {
        els.invCustPhoneRow.style.display = 'none';
      }
    } else {
      els.invCustomerSection.style.display = 'none';
      els.invCustNameRow.style.display = 'none';
      els.invCustPhoneRow.style.display = 'none';
    }

    // إخفاء رقم الاشتراك دائماً في إشعار الدائن
    els.invSubRefRow.style.display = 'none';

    // عرض الرصيد المتبقي بعد الاسترجاع — يظهر فقط إذا تبقى رصيد فعلي
    // (في حالة إلغاء الاشتراك بالكامل يكون newBalance=0 ولا داعي لعرضه)
    var subRefund = cnRes && cnRes.subscriptionRefund;
    if (subRefund && Number(subRefund.amount) > 0 && Number(subRefund.newBalance) > 0) {
      els.invCustomerSection.style.display = '';
      els.invSubBalance.innerHTML = '<span class="sar">&#xE900;</span> ' + fmtLtr(subRefund.newBalance);
      els.invSubBalRow.style.display = '';
    } else {
      els.invSubBalRow.style.display = 'none';
    }
    if (els.invSubSection) els.invSubSection.style.display = 'none';

    (function fixCnCrInfoGrid() {
      var grid = document.querySelector('#invoicePaper .cr-info-grid');
      if (!grid) return;
      var cells = Array.from(grid.querySelectorAll('.cr-info-cell'));
      cells.forEach(function(c) { c.style.gridColumn = ''; });
    })();

    var sarHtml = '<span class="sar">&#xE900;</span>';
    function sarFmt(n) { return sarHtml + ' ' + fmtLtr(n); }

    var subtotal    = parseFloat(inv.subtotal        || 0);
    var discAmt     = parseFloat(inv.discount_amount || 0);
    var extraAmt    = parseFloat(inv.extra_amount    || 0);
    var vatRate     = parseFloat(inv.vat_rate        || 0);
    var vatAmount   = parseFloat(inv.vat_amount      || 0);
    var totalAmount = parseFloat(inv.total_amount    || 0);
    var cnPriceMode = inv.price_display_mode || 'exclusive';

    // في وضع inclusive يكون subtotal المحفوظ شاملاً للضريبة — نستخرج المبلغ قبل الضريبة للعرض
    var cnDisplaySubtotal = (cnPriceMode === 'inclusive' && vatRate > 0)
      ? subtotal * 100 / (100 + vatRate)
      : subtotal;

    var isCNSubInvoice = inv.order_type === 'subscription_new' || inv.order_type === 'subscription_renewal';
    var cnSubPkgName = isCNSubInvoice ? (inv.notes || '') : '';
    var cnSubSvcLabel = isCNSubInvoice ? (inv.order_type === 'subscription_renewal' ? 'تجديد اشتراك' : 'اشتراك جديد') : '';
    var cnDisplayItems = (items && items.length > 0) ? items
      : (isCNSubInvoice ? [{ product_name_ar: '', service_name_ar: '', quantity: 1, line_total: parseFloat(inv.total_amount || 0) }] : []);
    els.invItemsTbody.innerHTML = cnDisplayItems.map(function(it) {
      var nameAr = escHtml(it.product_name_ar || cnSubPkgName);
      var nameEn = escHtml(it.product_name_en || '');
      var svcAr  = escHtml(it.service_name_ar || cnSubSvcLabel);
      var svcEn  = escHtml(it.service_name_en || '');
      var productCell = nameAr + (nameEn && nameEn !== nameAr ? '<br><span class="inv-td-en">' + nameEn + '</span>' : '');
      var serviceCell = svcAr + (svcEn && svcEn !== svcAr ? '<br><span class="inv-td-en">' + svcEn + '</span>' : '');
      return '<tr>'
        + '<td class="inv-td-name">' + productCell + '</td>'
        + '<td class="inv-td-num">' + (it.quantity || 1) + '</td>'
        + '<td class="inv-td-amt">' + fmtLtr(it.line_total || 0) + '</td>'
        + '<td class="inv-td-name">' + (svcAr ? serviceCell : '—') + '</td>'
        + '</tr>';
    }).join('');

    els.invSubtotal.innerHTML = sarFmt(cnDisplaySubtotal);
    if (els.invSubtotalLabel) els.invSubtotalLabel.textContent = vatRate > 0 ? 'المجموع قبل الضريبة' : 'المجموع';
    if (discAmt > 0) {
      els.invDiscount.innerHTML = sarFmt(discAmt);
      els.invDiscRow.style.display = '';
      if (inv.discount_label) {
        var discLblDeferred = els.invDiscRow.querySelector('.inv-total-label');
        if (discLblDeferred) discLblDeferred.textContent = inv.discount_label;
      }
      var afterDiscDeferred = cnDisplaySubtotal - discAmt;
      els.invAfterDiscount.innerHTML = sarFmt(afterDiscDeferred);
      els.invAfterDiscRow.style.display = '';
    } else {
      els.invDiscRow.style.display = 'none';
      els.invAfterDiscRow.style.display = 'none';
    }
    if (extraAmt > 0) {
      els.invExtra.innerHTML = sarFmt(extraAmt);
      els.invExtraRow.style.display = '';
    } else {
      els.invExtraRow.style.display = 'none';
    }
    if (vatRate > 0) {
      els.invVatLabel.textContent = 'ضريبة القيمة المضافة (' + vatRate + '%)';
      els.invVat.innerHTML = sarFmt(vatAmount);
      els.invVatRow.style.display = '';
      if (els.invTotalLabel) els.invTotalLabel.textContent = 'الإجمالي المُرتجع شامل الضريبة';
    } else {
      els.invVatRow.style.display = 'none';
      if (els.invTotalLabel) els.invTotalLabel.textContent = 'الإجمالي المُرتجع';
    }
    els.invTotal.innerHTML = sarFmt(totalAmount);

    if (els.invMixedCashRow) els.invMixedCashRow.style.display = 'none';
    if (els.invMixedCardRow) els.invMixedCardRow.style.display = 'none';
    els.invPaidRow.style.display = 'none';
    els.invRemainingRow.style.display = 'none';

    /* ── Loyalty reversal in credit note ── */
    var invLoyaltyRowCN = document.getElementById('invLoyaltyRow');
    if (invLoyaltyRowCN) {
      var loyRev = cnRes && cnRes.loyaltyReversal;
      var loyEnabled = state.loyaltySettings && state.loyaltySettings.loyaltyEnabled;
      if (loyEnabled && loyRev && (loyRev.earned > 0 || loyRev.redeemed > 0)) {
        var invLoyaltyPointsCN = document.getElementById('invLoyaltyPoints');
        var invLoyaltyLabelCN  = invLoyaltyRowCN.querySelector('.inv-meta-label');
        if (invLoyaltyPointsCN) invLoyaltyPointsCN.textContent = loyRev.newBalance.toLocaleString();
        if (invLoyaltyLabelCN) {
          var reversedTxt = loyRev.netReverse > 0
            ? 'استُرجع ' + loyRev.netReverse + ' نقطة — رصيدك'
            : 'خُصم ' + Math.abs(loyRev.netReverse) + ' نقطة — رصيدك';
          invLoyaltyLabelCN.textContent = reversedTxt;
        }
        invLoyaltyRowCN.style.display = '';
        state.customerLoyaltyBalance = loyRev.newBalance;
      } else {
        invLoyaltyRowCN.style.display = 'none';
      }
    }

    var pmLabels = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك' };
    els.invPayment.textContent = pmLabels[inv.payment_method] || inv.payment_method || 'إرجاع';
    els.invHangerRow.style.display = 'none';
    els.invPaidAtRow.style.display = '';
    els.invPaidAt.textContent = formatInvoiceDate(new Date().toISOString());
    els.invCleanedAtRow.style.display = 'none';
    els.invDeliveredAtRow.style.display = 'none';

    var invExtraOpts = document.getElementById('invExtraOpts');
    if (invExtraOpts) invExtraOpts.style.display = 'none';

    var ts = isoTimestamp(new Date().toISOString());
    if (vatRate > 0) {
      renderInvoiceQR(shopName, s.vatNumber, ts, fmtLtr(totalAmount), fmtLtr(vatAmount));
    } else {
      els.invQR.innerHTML = '';
    }

    /* ── Barcode (credit note uses original invoice seq) ── */
    if (s.showBarcodeInInvoice !== false) {
      renderInvoiceBarcode(cnRes.originalInvoiceSeq || inv.invoice_seq);
      if (els.invBarcode && els.invBarcode.closest('.inv-barcode-wrap')) {
        els.invBarcode.closest('.inv-barcode-wrap').style.display = '';
      }
    } else {
      if (els.invBarcode) els.invBarcode.innerHTML = '';
      if (els.invBarcode && els.invBarcode.closest('.inv-barcode-wrap')) {
        els.invBarcode.closest('.inv-barcode-wrap').style.display = 'none';
      }
    }

    var invInvoiceNotes = document.getElementById('invInvoiceNotes');
    if (invInvoiceNotes) invInvoiceNotes.style.display = 'none';
    var invNotesGridRow = document.getElementById('invNotesGridRow');
    var invNotesGridContent = document.getElementById('invNotesGridContent');
    if (invNotesGridRow) {
      if (inv.notes) {
        if (invNotesGridContent) invNotesGridContent.textContent = inv.notes;
        invNotesGridRow.style.display = '';
      } else {
        invNotesGridRow.style.display = 'none';
      }
    }

    var invFooterNotes = document.getElementById('invFooterNotes');
    if (invFooterNotes) {
      if (s.invoiceNotes) {
        var invNotesContent = document.getElementById('invNotesContent');
        if (invNotesContent) invNotesContent.textContent = s.invoiceNotes;
        invFooterNotes.style.display = '';
      } else {
        invFooterNotes.style.display = 'none';
      }
    }

    state._creditNoteModalMode = true;

    applyInvoiceTypeClass();
    var paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
    if (paperType === 'a4') {
      var origNum = String(cnRes.originalInvoiceSeq || inv.invoice_seq || inv.order_number || inv.id);
      var a4Data = {
        shopNameAr: s.laundryNameAr || '', shopNameEn: s.laundryNameEn || '',
        shopAddressAr: addressParts.length ? addressParts.join('، ') : (s.locationAr || ''),
        shopAddressEn: s.locationEn || '', shopPhone: s.phone || '', shopEmail: s.email || '',
        invoiceNotes: inv.notes || '', settingsNotes: s.invoiceNotes || '', vatNumber: s.vatNumber || '',
        commercialRegister: s.commercialRegister || '', logoDataUrl: s.logoDataUrl || '',
        titleAr: 'إشعار دائن للفاتورة الضريبية المبسطة',
        titleEn: 'Credit Note',
        cnInfo: 'رقم الإشعار: ' + (cnRes.creditNoteNumber || String(cnSeq)) + ' — الفاتورة الأصلية: ' + origNum,
        orderNumLabel: 'رقم الإشعار / CN #',
        orderNum: cnRes.creditNoteNumber || String(cnSeq),
        date: formatInvoiceDate(new Date().toISOString()),
        payment: pmLabels[inv.payment_method] || inv.payment_method || 'إرجاع',
        custName: inv.customer_name || '', custPhone: inv.phone || '',
        subPackageName: '', subBalance: (cnRes.subscriptionRefund && Number(cnRes.subscriptionRefund.amount) > 0) ? Number(cnRes.subscriptionRefund.newBalance) : null,
        cleanedAt: inv.cleaning_date ? formatInvoiceDate(inv.cleaning_date) : '',
        deliveredAt: inv.delivery_date ? formatInvoiceDate(inv.delivery_date) : '',
        paidAt: inv.paid_at ? formatInvoiceDate(inv.paid_at) : formatInvoiceDate(new Date().toISOString()),
        items: items.map(function(it) {
          return { productAr: it.product_name_ar || '', productEn: it.product_name_en || '',
            serviceAr: it.service_name_ar || '', serviceEn: it.service_name_en || '',
            qty: it.quantity || 1, unitPrice: parseFloat(it.unit_price || 0), lineTotal: parseFloat(it.line_total || 0) };
        }),
        subtotal: subtotal, discount: discAmt, extra: extraAmt,
        vatRate: vatRate, vatAmount: vatAmount, total: totalAmount,
        paid: null, remaining: null,
        paidCash: inv.payment_method === 'mixed' ? parseFloat(inv.paid_cash || 0) : 0,
        paidCard: inv.payment_method === 'mixed' ? parseFloat(inv.paid_card || 0) : 0,
        starch: '', bluing: '', priceDisplayMode: 'exclusive',
        customFields: Array.isArray(s.customFields) ? s.customFields : [],
        invoiceNotes: inv.notes || '',
        settingsNotes: s.invoiceNotes || '',
        qrPayload: vatRate > 0 ? { sellerName: shopName, vatNumber: s.vatNumber || '', timestamp: ts,
          totalAmount: fmtLtr(totalAmount), vatAmount: fmtLtr(vatAmount) } : null,
        autoPrint: false,
        creditNoteNumber: cnRes.creditNoteNumber || String(cnSeq),
        originalInvoiceSeq: String(cnRes.originalInvoiceSeq || inv.invoice_seq || inv.order_number || inv.id),
        loyaltyReversal: cnRes.loyaltyReversal || null,
        loyaltyBalance: (cnRes.loyaltyReversal) ? cnRes.loyaltyReversal.newBalance : null,
        loyaltyEarned: 0,
        loyaltyRedeemed: 0,
      };
      state.lastA4Data = a4Data;
      fillA4InvoiceModal(a4Data);
    }

    els.invoiceModal.style.display = 'flex';
    els.invoicePaper.scrollTop = 0;

    setTimeout(function() { printInvoiceByCopies(); }, 80);
  }

  /* ========== EVENT BINDING ========== */
  function bindEvents() {
    els.btnBack.addEventListener('click', () => window.api.navigateBack());

    let searchTimer = null;
    if (els.productSearch) {
      els.productSearch.addEventListener('input', () => {
        state.searchTerm = els.productSearch.value;
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { renderProducts(); }, 80);
      });
    }

    els.discountInput.addEventListener('input', () => {
      const v = parseFloat(els.discountInput.value);
      state.discount = isNaN(v) || v < 0 ? 0 : v;
      updateSummary();
    });

    if (els.extraInput) {
      els.extraInput.addEventListener('input', () => {
        const v = parseFloat(els.extraInput.value);
        state.extra = isNaN(v) || v < 0 ? 0 : v;
        updateSummary();
      });
    }

    if (els.invoiceNotesInput) {
      els.invoiceNotesInput.addEventListener('input', () => {
        state.invoiceNotes = els.invoiceNotesInput.value || '';
      });
    }

    els.btnDiscFlat.addEventListener('click', () => {
      if (state.discountType === 'flat') return;
      state.discountType = 'flat';
      state.discount = 0;
      els.discountInput.value = '';
      els.discountInput.removeAttribute('max');
      els.btnDiscFlat.classList.add('active');
      els.btnDiscPct.classList.remove('active');
      updateSummary();
    });

    els.btnDiscPct.addEventListener('click', () => {
      if (state.discountType === 'pct') return;
      state.discountType = 'pct';
      state.discount = 0;
      els.discountInput.value = '';
      els.discountInput.setAttribute('max', '100');
      els.btnDiscPct.classList.add('active');
      els.btnDiscFlat.classList.remove('active');
      updateSummary();
    });

    if (els.starchSelect) {
      els.starchSelect.addEventListener('change', () => {
        state.starch = els.starchSelect.value;
      });
    }
    if (els.bluingSelect) {
      els.bluingSelect.addEventListener('change', () => {
        state.bluing = els.bluingSelect.value;
      });
    }

    els.paymentSelect.addEventListener('change', () => {
      state.paymentMethod = els.paymentSelect.value;
      const isMixed = state.paymentMethod === 'mixed';
      if (els.mixedCashInline) els.mixedCashInline.style.display = isMixed ? '' : 'none';
      if (els.mixedPaySection) els.mixedPaySection.style.display = isMixed ? '' : 'none';
      if (isMixed) {
        updateMixedPayFields();
        if (els.mixedCashInput) setTimeout(() => els.mixedCashInput.focus(), 50);
      } else {
        state.mixedCash = 0;
        state.mixedCard = 0;
        if (els.mixedCashInput) els.mixedCashInput.value = '';
        if (els.mixedPayError) els.mixedPayError.style.display = 'none';
      }
    });

    if (els.mixedCashInput) {
      els.mixedCashInput.addEventListener('input', (e) => {
        const v = e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*/, '$1');
        if (v !== e.target.value) e.target.value = v;
        updateMixedPayFields();
      });
    }

    els.btnClearCart.addEventListener('click', () => {
      const modal = document.getElementById('clearCartModal');
      if (modal) {
        modal.style.display = 'flex';
        document.getElementById('clearCartConfirmBtn').onclick = () => { modal.style.display = 'none'; clearCart(); };
        document.getElementById('clearCartCancelBtn').onclick = () => { modal.style.display = 'none'; };
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
      } else {
        if (!confirm(t('pos-confirm-clear'))) return;
        clearCart();
      }
    });

    if (els.btnProcessInvoice) {
      els.btnProcessInvoice.addEventListener('click', handleProcessInvoice);
    }

    if (els.btnRefundConsumptionReceipt) {
      els.btnRefundConsumptionReceipt.addEventListener('click', () => {
        openRefundSearchModal();
      });
    }

    if (els.refundReceiptSearchModal) {
      els.refundReceiptSearchModal.addEventListener('click', (e) => {
        if (e.target === els.refundReceiptSearchModal) hideRefundSearchModal();
      });
    }

    if (els.btnRefundSearchClose) {
      els.btnRefundSearchClose.addEventListener('click', () => hideRefundSearchModal());
    }

    if (els.btnRefundSearch) {
      els.btnRefundSearch.addEventListener('click', () => handleRefundSearch());
    }

    if (els.refundReceiptSearchInput) {
      els.refundReceiptSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleRefundSearch();
      });
    }

    if (els.btnRefundConfirmReceipt) {
      els.btnRefundConfirmReceipt.addEventListener('click', () => handleRefundConfirm());
    }
    if (els.invoiceSeqInput) {
      els.invoiceSeqInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleProcessInvoice();
      });
    }
    if (els.btnCancelProcess) {
      els.btnCancelProcess.addEventListener('click', () => {
        exitInvoiceProcessMode();
        clearCart();
        clearCustomer();
      });
    }
    if (els.btnCreateCreditNote) {
      els.btnCreateCreditNote.addEventListener('click', handleCreateCreditNote);
    }
    if (els.btnCnClose) {
      els.btnCnClose.addEventListener('click', () => {
        els.creditNoteSuccessModal.style.display = 'none';
        resetForNewSale();
      });
    }
    if (els.creditNoteSuccessModal) {
      els.creditNoteSuccessModal.addEventListener('click', (e) => {
        if (e.target === els.creditNoteSuccessModal) {
          els.creditNoteSuccessModal.style.display = 'none';
          resetForNewSale();
        }
      });
    }

    els.btnPay.addEventListener('click', handlePay);

    els.btnNewSale.addEventListener('click', () => {
      els.successModal.style.display = 'none';
      resetForNewSale();
    });

    els.btnCloseSuccess.addEventListener('click', () => {
      els.successModal.style.display = 'none';
    });

    els.successModal.addEventListener('click', (e) => {
      if (e.target === els.successModal) els.successModal.style.display = 'none';
    });

    els.btnInvPrint.addEventListener('click', () => {
      if (state.appSettings && state.appSettings.requireCustomerPhone) {
        var cust = state.selectedCustomer;
        if (!cust || !cust.phone || !cust.phone.trim()) {
          showTopToast('لا يمكن طباعة الفاتورة — رقم جوال العميل إلزامي', 'error');
          return;
        }
      }
      printInvoiceByCopies();
    });

    els.btnInvExportPdf.addEventListener('click', async () => {
      if (!state.viewingOrderId && !state._creditNoteModalMode) {
        showToast('معرف الفاتورة غير موجود', 'error');
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
        const orderNumEl = document.getElementById('invOrderNum');
        const orderNum = orderNumEl ? orderNumEl.textContent : '';
        
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

    els.btnInvClose.addEventListener('click', closeInvoiceModal);

    if (els.btnInvWhatsapp) {
      els.btnInvWhatsapp.addEventListener('click', async function () {
        var phone = state.lastA4Data && state.lastA4Data.custPhone;
        if (!phone) {
          showTopToast('⚠️ واتساب | لا يوجد عميل مسجّل في هذه الفاتورة', 'warning', 4000);
          return;
        }
        var paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
        var paperEl = paperType === 'a4'
          ? document.getElementById('invoicePaperA4m')
          : document.getElementById('invoicePaper');
        if (!paperEl) return;
        var html = paperEl.outerHTML;
        var orderNum = (state.lastA4Data && state.lastA4Data.orderNum) || '';
        var total = (state.lastA4Data && state.lastA4Data.total) || 0;
        var zatcaPayload = (state.lastA4Data && state.lastA4Data.zatcaPayload) || null;
        await sendInvoiceWhatsAppFromHtml(html, paperType, phone, orderNum, zatcaPayload, 'receive', total);
      });
    }
    if (els.btnCrModalClose) {
      els.btnCrModalClose.addEventListener('click', function () {
        if (els.consumptionReceiptModal) els.consumptionReceiptModal.style.display = 'none';
      });
    }
    if (els.btnCrModalWhatsapp) {
      els.btnCrModalWhatsapp.addEventListener('click', async function () {
        var phone = (state.selectedCustomer && state.selectedCustomer.phone) || '';
        if (!phone) {
          showTopToast('⚠️ واتساب | لا يوجد عميل مسجّل في هذا الإيصال', 'warning', 4000);
          return;
        }
        var crPaperEl = document.getElementById('crModalPaper');
        if (!crPaperEl) return;
        var html = crPaperEl.outerHTML;
        var orderNum = state.viewingConsumptionReceiptNum || '';
        var total = state.viewingConsumptionReceiptAmount || 0;
        await sendInvoiceWhatsAppFromHtml(html, 'thermal', phone, orderNum, null, 'consumption', total);
      });
    }
    if (els.btnCrModalPrint) {
      els.btnCrModalPrint.addEventListener('click', () => {
        const isRefund = els.crModalRefundNumRow && els.crModalRefundNumRow.style.display !== 'none';
        state.shouldClearCartAfterConsumptionPrint = !isRefund;
        printConsumptionReceipt();
      });
    }
    if (els.btnCrModalExportPdf) {
      els.btnCrModalExportPdf.addEventListener('click', async function () {
        var paperEl = document.getElementById('crModalPaper');
        if (!paperEl) {
          showToast('لم يتم العثور على محتوى الإيصال', 'error');
          return;
        }
        try {
          els.btnCrModalExportPdf.disabled = true;
          els.btnCrModalExportPdf.innerHTML = '<span>جارٍ التصدير...</span>';
          var paperType = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
          var orderNum = state.viewingConsumptionReceiptNum || 'consumption';
          var result = await window.api.exportInvoicePdfFromHtml({
            html: paperEl.outerHTML,
            paperType: paperType,
            orderNum: orderNum
          });
          if (result.success) {
            showToast('تم تنزيل ملف PDF بنجاح', 'success');
          } else {
            showToast(result.message || 'فشل تصدير PDF', 'error');
          }
        } catch (err) {
          showToast('حدث خطأ أثناء التصدير', 'error');
        } finally {
          els.btnCrModalExportPdf.disabled = false;
          els.btnCrModalExportPdf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg><span>تصدير PDF</span>';
        }
      });
    }

    els.invoiceModal.addEventListener('click', (e) => {
      if (e.target === els.invoiceModal) closeInvoiceModal();
    });

    if (els.hangerSelect) {
      els.hangerSelect.addEventListener('change', () => {
        const val = els.hangerSelect.value;
        if (!val) {
          clearHanger();
          return;
        }
        const text = els.hangerSelect.options[els.hangerSelect.selectedIndex].text;
        const numMatch = text.match(/(\d+)/);
        const num = numMatch ? numMatch[0] : text;
        selectHanger(Number(val), num);
      });
    }
    if (els.btnPrintHangerTicket) {
      els.btnPrintHangerTicket.addEventListener('click', async () => {
        if (!state.viewingOrderId) {
          showToast('معرف الفاتورة غير موجود', 'error');
          return;
        }
        try {
          els.btnPrintHangerTicket.disabled = true;
          const result = await window.api.printHangerTicketThermal({ orderId: state.viewingOrderId });
          if (result.success) {
            showToast('تم فتح نافذة الطباعة (اختر الطابعة الحرارية)', 'success');
          } else {
            showToast(result.message || 'فشل طباعة التيكت', 'error');
          }
        } catch (err) {
          showToast('حدث خطأ أثناء طباعة التيكت', 'error');
        } finally {
          els.btnPrintHangerTicket.disabled = false;
        }
      });
    }

    els.customerSearch.addEventListener('input', () => {
      const val = els.customerSearch.value;
      els.btnClearCustomer.style.display = val ? '' : 'none';
      clearTimeout(state.customerSearchTimer);
      state.customerSearchTimer = setTimeout(() => searchCustomers(val), 300);
    });

    els.customerSearch.addEventListener('focus', () => {
      const val = els.customerSearch.value;
      if (val.length >= 1) searchCustomers(val);
    });

    document.addEventListener('click', (e) => {
      if (!els.customerDropdown.contains(e.target) && e.target !== els.customerSearch) {
        els.customerDropdown.style.display = 'none';
      }
    });

    els.btnClearCustomer.addEventListener('click', () => {
      els.customerSearch.value = '';
      els.btnClearCustomer.style.display = 'none';
      els.customerDropdown.style.display = 'none';
    });

    els.btnRemoveCustomer.addEventListener('click', clearCustomer);

    // نقاط الولاء — زر + popup
    // زر فتح النقاط — desktop: popup / mobile: bottom sheet
    if (els.btnLoyaltyToggle) {
      els.btnLoyaltyToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        openLoyaltyUI();
      });
    }
    if (els.loyaltyPopup) {
      els.loyaltyPopup.addEventListener('click', (e) => e.stopPropagation());
    }
    document.addEventListener('click', () => {
      if (els.loyaltyPopup) els.loyaltyPopup.style.display = 'none';
    });

    // Desktop popup apply/clear
    if (els.btnApplyLoyalty) {
      els.btnApplyLoyalty.addEventListener('click', () => {
        const pts = Number(els.loyaltyPointsInput && els.loyaltyPointsInput.value) || 0;
        applyLoyaltyPoints(pts);
      });
    }
    if (els.btnClearLoyalty) {
      els.btnClearLoyalty.addEventListener('click', clearLoyaltyDiscount);
    }
    if (els.loyaltyPointsInput) {
      els.loyaltyPointsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && els.btnApplyLoyalty) els.btnApplyLoyalty.click();
      });
    }

    // Mobile bottom sheet apply/clear/overlay
    if (els.btnApplyLoyaltySheet) {
      els.btnApplyLoyaltySheet.addEventListener('click', () => {
        const pts = Number(els.loyaltySheetInput && els.loyaltySheetInput.value) || 0;
        applyLoyaltyPoints(pts);
      });
    }
    if (els.btnClearLoyaltySheet) {
      els.btnClearLoyaltySheet.addEventListener('click', clearLoyaltyDiscount);
    }
    if (els.loyaltySheetInput) {
      els.loyaltySheetInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && els.btnApplyLoyaltySheet) els.btnApplyLoyaltySheet.click();
      });
    }
    if (els.btnLoyaltyModalClose) {
      els.btnLoyaltyModalClose.addEventListener('click', closeLoyaltyPopup);
    }
    if (els.loyaltyModal) {
      els.loyaltyModal.addEventListener('click', (e) => {
        if (e.target === els.loyaltyModal) closeLoyaltyPopup();
      });
    }

    els.btnAddCustomer.addEventListener('click', openAddCustomerModal);
    els.btnAddCustomerClose.addEventListener('click', closeAddCustomerModal);
    els.btnAddCustomerCancel.addEventListener('click', closeAddCustomerModal);
    els.addCustomerModal.addEventListener('click', (e) => {
      if (e.target === els.addCustomerModal) closeAddCustomerModal();
    });
    els.btnAddCustomerSave.addEventListener('click', handleAddCustomer);

    els.btnAddSubscription.addEventListener('click', () => openAddSubscriptionModal('new'));
    els.subTabNew.addEventListener('click', () => {
      subSetMode('new');
      els.addSubError.style.display = 'none';
    });
    els.subTabRenew.addEventListener('click', () => {
      subSetMode('renew');
      els.addSubError.style.display = 'none';
      if (els.subCustomerId.value) loadCustomerSubscriptions(els.subCustomerId.value);
    });
    els.btnAddSubClose.addEventListener('click', closeAddSubscriptionModal);
    els.btnAddSubCancel.addEventListener('click', closeAddSubscriptionModal);
    els.addSubscriptionModal.addEventListener('click', (e) => {
      if (e.target === els.addSubscriptionModal) closeAddSubscriptionModal();
    });
    els.btnAddSubSave.addEventListener('click', handleSaveSubscription);

    els.subCustomerSearch.addEventListener('input', () => {
      clearTimeout(state.subSearchTimer);
      state.subSearchTimer = setTimeout(() => searchSubCustomers(els.subCustomerSearch.value), 300);
    });

    els.subCustomerSearch.addEventListener('focus', () => {
      if (els.subCustomerSearch.value.length >= 1) searchSubCustomers(els.subCustomerSearch.value);
    });

    document.addEventListener('click', (e) => {
      if (!els.subCustomerDropdown.contains(e.target) && e.target !== els.subCustomerSearch) {
        els.subCustomerDropdown.style.display = 'none';
      }
    });

    els.btnClearSubCustomer.addEventListener('click', () => {
      els.subCustomerId.value = '';
      els.subCustomerChip.style.display = 'none';
      els.subCustomerSubscription.style.display = 'none';
      els.subCustomerInputInner.style.display = '';
      els.subCustomerSearch.value = '';
      setTimeout(() => els.subCustomerSearch.focus(), 50);
    });

    [els.newCustomerName, els.newCustomerPhone, els.newCustomerCity, els.newCustomerEmail,
     els.newCustomerNationalId, els.newCustomerTaxNumber, els.newCustomerAddress].forEach((el) => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddCustomer();
      });
    });

    els.newCustomerIsActive.addEventListener('change', () => {
      els.newCustomerStatusLabel.textContent = els.newCustomerIsActive.checked 
        ? I18N.t('pos-add-customer-status-active') 
        : I18N.t('pos-add-customer-status-inactive');
    });

    els.btnShowProducts.addEventListener('click', showMobileProducts);
    els.btnShowCart.addEventListener('click', showMobileCart);

    els.tabSale.addEventListener('click', () => switchTab('sale'));
    els.tabDeferred.addEventListener('click', () => switchTab('deferred'));
    if (els.tabSaleDesktop) els.tabSaleDesktop.addEventListener('click', () => switchTab('sale'));
    if (els.tabDeferredDesktop) els.tabDeferredDesktop.addEventListener('click', () => switchTab('deferred'));

    if (els.btnDeferredSearch) els.btnDeferredSearch.addEventListener('click', searchDeferredInvoices);
    els.deferredSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchDeferredInvoices();
    });
    els.deferredSearch.addEventListener('input', () => {
      clearTimeout(state.deferredSearchTimer);
      state.deferredSearchTimer = setTimeout(searchDeferredInvoices, 500);
    });
    if (els.deferredSubSearch) {
      els.deferredSubSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchDeferredBySubscription();
      });
      els.deferredSubSearch.addEventListener('input', () => {
        clearTimeout(state.deferredSubSearchTimer);
        state.deferredSubSearchTimer = setTimeout(searchDeferredBySubscription, 500);
      });
    }
    if (els.deferredBarcodeInput) {
      els.deferredBarcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleDeferredBarcodeScan();
      });
    }
    // Camera barcode scanner
    if (els.btnCameraScan) {
      els.btnCameraScan.addEventListener('click', openCameraScanner);
    }
    if (els.btnCloseCameraScanner) {
      els.btnCloseCameraScanner.addEventListener('click', closeCameraScanner);
    }
    if (els.cameraScannerModal) {
      els.cameraScannerModal.addEventListener('click', (e) => {
        if (e.target === els.cameraScannerModal) closeCameraScanner();
      });
    }
    const applyDeferredFilter = (val) => {
      if (els.deferredStatusFilter) els.deferredStatusFilter.value = val;
      if (els.deferredStatusFilterMobile) els.deferredStatusFilterMobile.value = val;
      state.deferredStatusFilter = val || 'unpaid';
      state.deferredPage = 1;
      const currentSearch = els.deferredSearch ? els.deferredSearch.value.trim() : '';
      const currentSubSearch = els.deferredSubSearch ? els.deferredSubSearch.value.trim() : '';
      if (currentSubSearch) {
        searchDeferredBySubscription();
      } else if (currentSearch) {
        searchDeferredInvoices();
      } else {
        renderDeferredInvoices(state.deferredInvoices || []);
      }
    };
    if (els.deferredStatusFilter) {
      els.deferredStatusFilter.addEventListener('change', () => applyDeferredFilter(els.deferredStatusFilter.value));
    }
    if (els.deferredStatusFilterMobile) {
      els.deferredStatusFilterMobile.addEventListener('change', () => applyDeferredFilter(els.deferredStatusFilterMobile.value));
    }

    els.defBtnFirst.addEventListener('click', () => { state.deferredPage = 1; renderDeferredTable(); });
    els.defBtnPrev.addEventListener('click',  () => { if (state.deferredPage > 1) { state.deferredPage--; renderDeferredTable(); } });
    els.defBtnNext.addEventListener('click',  () => { const tp = Math.ceil((state.deferredFilteredInvoices || []).length / state.deferredPageSize); if (state.deferredPage < tp) { state.deferredPage++; renderDeferredTable(); } });
    els.defBtnLast.addEventListener('click',  () => { state.deferredPage = Math.ceil((state.deferredFilteredInvoices || []).length / state.deferredPageSize) || 1; renderDeferredTable(); });

    els.btnPayDeferredClose.addEventListener('click', closePayDeferredModal);
    els.btnPayDeferredCancel.addEventListener('click', closePayDeferredModal);
    els.btnPayDeferredConfirm.addEventListener('click', confirmPayDeferred);
    els.payDeferredModal.addEventListener('click', (e) => {
      if (e.target === els.payDeferredModal) closePayDeferredModal();
    });
    els.payAmountInput.addEventListener('input', (e) => {
      // Allow only digits and a single decimal point
      const v = e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*/, '$1');
      if (v !== e.target.value) e.target.value = v;
      updateAfterInfo();
      if (payModalState.selectedMethod === 'mixed') updatePayMixedFields();
    });
    els.payMethodSelect.addEventListener('change', () => {
      payModalState.selectedMethod = els.payMethodSelect.value || 'cash';
      const isMixed = payModalState.selectedMethod === 'mixed';
      if (els.payMixedSection) els.payMixedSection.style.display = isMixed ? '' : 'none';
      if (isMixed) {
        updatePayMixedFields();
        if (els.payMixedCashInput) setTimeout(() => els.payMixedCashInput.focus(), 50);
      } else {
        if (els.payMixedCashInput) els.payMixedCashInput.value = '';
      }
    });

    if (els.payMixedCashInput) {
      els.payMixedCashInput.addEventListener('input', (e) => {
        const v = e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*/, '$1');
        if (v !== e.target.value) e.target.value = v;
        updatePayMixedFields();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (els.cameraScannerModal && els.cameraScannerModal.style.display !== 'none') { closeCameraScanner(); return; }
        if (els.payDeferredModal.style.display !== 'none') { closePayDeferredModal(); return; }
        if (els.invoiceModal.style.display !== 'none') { closeInvoiceModal(); return; }
        if (els.addCustomerModal.style.display !== 'none') { closeAddCustomerModal(); return; }
        if (els.addSubscriptionModal.style.display !== 'none') { closeAddSubscriptionModal(); return; }
        if (els.successModal.style.display !== 'none') els.successModal.style.display = 'none';
      }
    });
  }

  /* ========== TAB SWITCHING ========== */
  function switchTab(tab) {
    state.activeTab = tab;
    const isSale = tab === 'sale';

    els.saleView.style.display     = isSale ? '' : 'none';
    els.deferredView.style.display = isSale ? 'none' : '';

    els.tabSale.classList.toggle('active', isSale);
    els.tabDeferred.classList.toggle('active', !isSale);
    if (els.tabSaleDesktop) els.tabSaleDesktop.classList.toggle('active', isSale);
    if (els.tabDeferredDesktop) els.tabDeferredDesktop.classList.toggle('active', !isSale);

    if (!isSale) {
      els.deferredList.innerHTML = '';
      els.defTableWrap.style.display = 'none';
      els.defPaginationBar.style.display = 'none';
      els.defSummaryCards.style.display = 'none';
      els.deferredEmptyState.style.display = 'flex';
      const et = document.getElementById('deferredEmptyTitle');
      if (et) et.textContent = t('pos-deferred-start-hint');
      setTimeout(() => els.deferredSearch && els.deferredSearch.focus(), 80);
    }
  }

  function invoiceMatchesDeferredFilter(inv) {
    const filter = state.deferredStatusFilter || 'unpaid';
    const isReceipt = inv.rowType === 'receipt';
    // الايصالات دائماً مدفوعة (اشتراك) — تظهر في كل الفلاتر ما عدا 'unpaid'
    if (isReceipt) {
      if (filter === 'unpaid') return false;
      if (filter === 'cleaned') return !!inv.cleaning_date;
      if (filter === 'delivered') return !!inv.delivery_date;
      return true;
    }

    const isPaid = inv.payment_status === 'paid';
    const hasSettledDate = !!(inv.paid_at || inv.fully_paid_at);
    const hasCleaned = !!inv.cleaning_date;
    const hasDelivered = !!inv.delivery_date;

    switch (filter) {
      case 'paid':
        return isPaid;
      case 'unpaid':
        return !isPaid;
      case 'settled':
        return isPaid || hasSettledDate;
      case 'cleaned':
        return hasCleaned;
      case 'delivered':
        return hasDelivered;
      case 'all':
      default:
        return true;
    }
  }

  function isDeferredInvoiceNumberSearch(raw) {
    const s = String(raw || '').trim();
    if (!s) return false;
    // receipt number pattern: c1, C-2, c-3 ...
    if (/^C-?\d+$/i.test(s)) return true;
    // short numeric = invoice_seq, long numeric = phone
    return /^\d+$/.test(s) && s.length < 7;
  }

  /* ========== DEFERRED SEARCH ========== */
  async function searchDeferredInvoices() {
    const search = els.deferredSearch ? els.deferredSearch.value.trim() : '';
    state.deferredInvoiceSearchMode = isDeferredInvoiceNumberSearch(search);

    // إذا كان حقل البحث فارغاً، أعد الحالة الأولية بدون جلب بيانات
    if (!search) {
      state.deferredInvoices = [];
      state.deferredFilteredInvoices = [];
      state.deferredPage = 1;
      els.deferredList.innerHTML = '';
      els.defTableWrap.style.display = 'none';
      els.defPaginationBar.style.display = 'none';
      els.defSummaryCards.style.display = 'none';
      els.deferredEmptyState.style.display = 'flex';
      const et = document.getElementById('deferredEmptyTitle');
      if (et) et.textContent = t('pos-deferred-start-hint');
      return;
    }

    els.deferredList.innerHTML = '';
    els.defTableWrap.style.display = 'none';
    els.defPaginationBar.style.display = 'none';
    els.defSummaryCards.style.display = 'none';
    els.deferredEmptyState.style.display = 'flex';
    const emptyTitle = document.getElementById('deferredEmptyTitle');
    if (emptyTitle) emptyTitle.textContent = t('pos-deferred-loading');

    const res = await window.api.getDeferredOrders({
      search,
      statusFilter: state.deferredStatusFilter || 'unpaid',
    });

    if (!res || !res.success) {
      showToast(res && res.message ? res.message : t('pos-err-load'), 'error');
      if (emptyTitle) emptyTitle.textContent = t('pos-deferred-no-results');
      return;
    }

    state.deferredInvoices = res.orders || [];
    state.deferredPage = 1;
    renderDeferredInvoices(state.deferredInvoices);
  }

  /* ========== DEFERRED SUBSCRIPTION SEARCH ========== */
  async function searchDeferredBySubscription() {
    const subSearch = els.deferredSubSearch ? els.deferredSubSearch.value.trim() : '';

    if (!subSearch) {
      state.deferredInvoices = [];
      state.deferredFilteredInvoices = [];
      state.deferredPage = 1;
      els.deferredList.innerHTML = '';
      els.defTableWrap.style.display = 'none';
      els.defPaginationBar.style.display = 'none';
      els.defSummaryCards.style.display = 'none';
      els.deferredEmptyState.style.display = 'flex';
      const et = document.getElementById('deferredEmptyTitle');
      if (et) et.textContent = t('pos-deferred-start-hint');
      return;
    }

    els.deferredList.innerHTML = '';
    els.defTableWrap.style.display = 'none';
    els.defPaginationBar.style.display = 'none';
    els.defSummaryCards.style.display = 'none';
    els.deferredEmptyState.style.display = 'flex';
    const emptyTitle = document.getElementById('deferredEmptyTitle');
    if (emptyTitle) emptyTitle.textContent = t('pos-deferred-loading');

    const res = await window.api.getDeferredBySubscription({
      subscriptionSearch: subSearch,
      statusFilter: state.deferredStatusFilter || 'unpaid',
    });

    if (!res || !res.success) {
      showToast(res && res.message ? res.message : t('pos-err-load'), 'error');
      if (emptyTitle) emptyTitle.textContent = t('pos-deferred-no-results');
      return;
    }

    state.deferredInvoiceSearchMode = true;
    state.deferredInvoices = res.orders || [];
    state.deferredPage = 1;
    renderDeferredInvoices(state.deferredInvoices);
  }

  /* ========== RENDER DEFERRED INVOICES ========== */
  function renderDeferredInvoices(invoices) {
    const emptyTitle = document.getElementById('deferredEmptyTitle');
    const filteredInvoices = state.deferredInvoiceSearchMode
      ? (invoices || [])
      : (invoices || []).filter(invoiceMatchesDeferredFilter);
    state.deferredFilteredInvoices = filteredInvoices;

    if (!filteredInvoices.length) {
      els.deferredEmptyState.style.display = 'flex';
      if (emptyTitle) emptyTitle.textContent = t('pos-deferred-no-results');
      els.deferredList.innerHTML = '';
      els.defTableWrap.style.display = 'none';
      els.defPaginationBar.style.display = 'none';
      els.defSummaryCards.style.display = 'none';
      return;
    }

    els.deferredEmptyState.style.display = 'none';

    const totalAmount = filteredInvoices.reduce((s, inv) => s + Number(inv.total_amount || 0), 0);
    if (els.defSummaryCount) els.defSummaryCount.textContent = filteredInvoices.length;
    if (els.defSummaryTotal) els.defSummaryTotal.innerHTML = riyalHtml(fmtLtr(totalAmount));
    els.defSummaryCards.style.display = 'flex';
    els.defTableWrap.style.display = '';

    renderDeferredTable();
  }

  function renderDeferredTable() {
    const invoices = state.deferredFilteredInvoices || [];
    const pageSize = state.deferredPageSize;
    const totalPages = Math.ceil(invoices.length / pageSize) || 1;
    if (state.deferredPage > totalPages) state.deferredPage = totalPages;

    const start = (state.deferredPage - 1) * pageSize;
    const pageItems = invoices.slice(start, start + pageSize);

    const fmtDate = (d) => {
      if (!d) return '—';
      const dt = new Date(d);
      const pad = (n) => String(n).padStart(2, '0');
      const hours = dt.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(h12)}:${pad(dt.getMinutes())} ${ampm}`;
    };

    els.deferredList.innerHTML = pageItems.map((inv) => {
      const isReceipt    = inv.rowType === 'receipt';
      const isRefunded   = !!inv.is_refund || !!inv.refunded_at || !!inv.has_credit_note;
      const hasCleaned   = !!inv.cleaning_date;
      const hasDelivered = !!inv.delivery_date;
      const hasPaid      = !isReceipt && inv.payment_status === 'paid';
      const isPartial    = !isReceipt && inv.payment_status === 'partial';
      const paidAmt      = Number(inv.paid_amount || 0);

      const amountCellHtml = isPartial
        ? `${riyalHtml(fmtLtr(inv.total_amount))}
           <div class="def-partial-info">
             <span class="def-partial-badge">${t('pos-deferred-partial-badge') || 'جزئية'}</span>
             <span class="def-partial-text" dir="ltr">${fmtLtr(paidAmt)} / ${fmtLtr(inv.total_amount)}</span>
           </div>`
        : riyalHtml(fmtLtr(inv.total_amount));

      // رقم المستند: فاتورة = INV-X، ايصال = C-X
      const docNum = isReceipt
        ? `C-${inv.receipt_seq}`
        : `${inv.invoice_seq || inv.order_number || inv.id}`;

      // أزرار الإجراءات
      const viewBtn = isReceipt
        ? `<button class="def-tbl-btn def-tbl-view" onclick="window._posDeferredViewReceipt(${inv.id})" type="button" title="عرض الإيصال">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            عرض
          </button>`
        : `<button class="def-tbl-btn def-tbl-view" onclick="window._posDeferredView(${inv.id})" type="button" title="${t('pos-deferred-btn-view')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ${t('pos-deferred-btn-view')}
          </button>`;

      const payBtn = isReceipt ? '' : `
          <button class="def-tbl-btn def-tbl-pay ${hasPaid ? 'def-tbl-done' : ''}${isPartial ? ' def-tbl-partial' : ''}"
            onclick="window._posPayInvoice(${inv.id})" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            ${hasPaid ? (t('pos-deferred-badge-paid') || '✓ مدفوع') : (isPartial ? (t('pos-deferred-btn-pay-rest') || 'إكمال السداد') : t('pos-deferred-btn-pay'))}
          </button>`;

      const cleanOnclick = isReceipt
        ? `window._posMarkReceiptCleaned(${inv.id})`
        : `window._posMarkCleaned(${inv.id})`;
      const deliverOnclick = isReceipt
        ? `window._posMarkReceiptDelivered(${inv.id})`
        : `window._posMarkDelivered(${inv.id})`;

      return `<tr class="def-table-row${hasPaid ? ' def-row-paid' : ''}${isPartial ? ' def-row-partial' : ''}${isReceipt ? ' def-row-receipt' : ''}" data-id="${inv.id}" data-type="${inv.rowType || 'invoice'}">
        <td class="def-td-num">${docNum}</td>
        <td class="def-td-cust">
          <span class="def-cust-name">${escHtml(inv.customer_name || '—')}</span>
          ${inv.phone ? `<br><span class="def-cust-phone" dir="ltr">${escHtml(inv.phone)}</span>` : ''}
        </td>
        <td class="def-td-date def-td-date-center" dir="ltr">${fmtDate(inv.created_at)}</td>
        <td class="def-td-date def-td-date-center ${hasPaid ? 'def-val-paid' : ''}" dir="ltr">${isReceipt ? '<span style="color:#94a3b8">—</span>' : fmtDate(inv.paid_at)}</td>
        <td class="def-td-date def-td-date-center ${hasCleaned ? 'def-val-done' : ''}" dir="ltr">${fmtDate(inv.cleaning_date)}</td>
        <td class="def-td-date def-td-date-center ${hasDelivered ? 'def-val-done' : ''}" dir="ltr">${fmtDate(inv.delivery_date)}</td>
        <td class="def-td-amount">${amountCellHtml}</td>
        <td class="def-td-actions">
          ${viewBtn}
          ${payBtn}
          <button class="def-tbl-btn def-tbl-clean ${isRefunded ? 'def-tbl-disabled' : (hasCleaned ? 'def-tbl-done' : '')}"
            onclick="${cleanOnclick}" ${hasCleaned || isRefunded ? 'disabled' : ''} type="button" title="${t('pos-deferred-btn-clean')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
            ${isRefunded ? 'مرتجع' : (hasCleaned ? t('pos-deferred-badge-cleaned') : t('pos-deferred-btn-clean'))}
          </button>
          <button class="def-tbl-btn def-tbl-deliver ${isRefunded ? 'def-tbl-disabled' : (hasDelivered ? 'def-tbl-done' : '')}"
            onclick="${deliverOnclick}" ${hasDelivered || isRefunded ? 'disabled' : ''} type="button" title="${t('pos-deferred-btn-deliver')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            ${isRefunded ? 'مرتجع' : (hasDelivered ? t('pos-deferred-badge-delivered') : t('pos-deferred-btn-deliver'))}
          </button>
        </td>
      </tr>`;
    }).join('');

    /* Pagination */
    if (invoices.length <= pageSize) {
      els.defPaginationBar.style.display = 'none';
    } else {
      els.defPaginationBar.style.display = 'flex';
      const s = start + 1;
      const e = Math.min(start + pageSize, invoices.length);
      els.defPaginationInfo.textContent = t('pos-deferred-pagination')
        .replace('{s}', s).replace('{e}', e).replace('{total}', invoices.length);

      els.defBtnFirst.disabled = state.deferredPage === 1;
      els.defBtnPrev.disabled  = state.deferredPage === 1;
      els.defBtnNext.disabled  = state.deferredPage === totalPages;
      els.defBtnLast.disabled  = state.deferredPage === totalPages;

      els.defPageNumbers.innerHTML = '';
      buildDefPageRange(state.deferredPage, totalPages).forEach(p => {
        if (p === '...') {
          const sp = document.createElement('span');
          sp.className = 'def-page-ellipsis';
          sp.textContent = '…';
          els.defPageNumbers.appendChild(sp);
        } else {
          const btn = document.createElement('button');
          btn.className = 'def-page-num' + (p === state.deferredPage ? ' active' : '');
          btn.textContent = p;
          btn.addEventListener('click', () => { state.deferredPage = p; renderDeferredTable(); });
          els.defPageNumbers.appendChild(btn);
        }
      });
    }
  }

  function buildDefPageRange(current, total) {
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

  /* ========== PAY DEFERRED MODAL (Partial Payments) ========== */
  const PAYMENT_METHOD_ICONS = {
    cash:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    card:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    bank:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><line x1="9" y1="21" x2="9" y2="14"/><line x1="15" y1="21" x2="15" y2="14"/></svg>',
    mixed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };

  const payModalState = {
    invoice: null,
    payments: [],
    selectedMethod: 'cash',
    saving: false,
  };

  function num(v) { return Number(v || 0); }
  function fmtMoney(v) { return num(v).toFixed(2); }

  function renderPayMethods(methods) {
    const lang = getLang();
    els.payMethodSelect.innerHTML = methods.map(m => {
      const labels = PAYMENT_METHOD_LABELS[m];
      const label = labels ? (lang === 'ar' ? labels.ar : labels.en) : m;
      const sel = m === payModalState.selectedMethod ? ' selected' : '';
      return `<option value="${m}"${sel}>${label}</option>`;
    }).join('');
    els.payMethodSelect.value = payModalState.selectedMethod;
  }

  function updatePayModalDisplay() {
    const inv = payModalState.invoice;
    if (!inv) return;

    const total = num(inv.total_amount);
    const paid = num(inv.paid_amount);
    const remaining = Math.max(0, num(inv.remaining_amount));

    els.payModalInvNum.textContent = `${inv.invoice_seq || inv.order_number || inv.id}`;
    els.payModalCustName.textContent = inv.customer_name || '—';
    els.payModalCustPhone.textContent = inv.phone || '—';
    els.payModalTotalVal.innerHTML = `<span class="sar">&#xE900;</span><span class="pay-amt-num">${fmtMoney(total)}</span>`;
    els.payModalPaidVal.innerHTML = `<span class="sar">&#xE900;</span><span class="pay-amt-num">${fmtMoney(paid)}</span>`;
    els.payModalRemainingVal.innerHTML = `<span class="sar">&#xE900;</span><span class="pay-amt-num">${fmtMoney(remaining)}</span>`;

    const isFullyPaid = inv.payment_status === 'paid' || remaining <= 0.0001;
    els.payInputSection.style.display = isFullyPaid ? 'none' : '';
    els.payFullyPaidBanner.style.display = isFullyPaid ? 'flex' : 'none';
    els.btnPayDeferredConfirm.style.display = isFullyPaid ? 'none' : '';

    if (!isFullyPaid) {
      els.payAmountInput.max = remaining.toFixed(2);
      if (!els.payAmountInput.value || num(els.payAmountInput.value) > remaining) {
        els.payAmountInput.value = remaining.toFixed(2);
      }
      // Always update after info when display is updated
      updateAfterInfo();
    }
  }

  // عرض معلومات المودال فقط بدون تعيين قيمة حقل المبلغ (للعرض الأولي من البيانات المحلية)
  function updatePayModalDisplayInfo() {
    const inv = payModalState.invoice;
    if (!inv) return;

    const total = num(inv.total_amount);
    const paid = num(inv.paid_amount);
    const remaining = Math.max(0, num(inv.remaining_amount));

    els.payModalInvNum.textContent = `${inv.invoice_seq || inv.order_number || inv.id}`;
    els.payModalCustName.textContent = inv.customer_name || '—';
    els.payModalCustPhone.textContent = inv.phone || '—';
    els.payModalTotalVal.innerHTML = `<span class="sar">&#xE900;</span><span class="pay-amt-num">${fmtMoney(total)}</span>`;
    els.payModalPaidVal.innerHTML = `<span class="sar">&#xE900;</span><span class="pay-amt-num">${fmtMoney(paid)}</span>`;
    els.payModalRemainingVal.innerHTML = `<span class="sar">&#xE900;</span><span class="pay-amt-num">${fmtMoney(remaining)}</span>`;

    const isFullyPaid = inv.payment_status === 'paid' || remaining <= 0.0001;
    els.payInputSection.style.display = isFullyPaid ? 'none' : '';
    els.payFullyPaidBanner.style.display = isFullyPaid ? 'flex' : 'none';
    els.btnPayDeferredConfirm.style.display = isFullyPaid ? 'none' : '';

    if (!isFullyPaid) {
      els.payAmountInput.max = remaining.toFixed(2);
      // لا نعيّن القيمة هنا — ننتظر البيانات الحقيقية من السيرفر
    }
  }

  function updateAfterInfo() {
    const inv = payModalState.invoice;
    if (!inv) return;
    const remaining = num(inv.remaining_amount);
    const amt = num(els.payAmountInput.value);
    const after = Math.max(0, remaining - amt);
    els.payAfterVal.innerHTML = riyalHtml(fmtMoney(after));
    els.payAfterInfo.classList.toggle('pay-after-complete', after <= 0.0001 && amt > 0);
  }

  function renderPayHistory() {
    const payments = payModalState.payments || [];
    els.payHistoryCount.textContent = payments.length;

    if (!payments.length) {
      els.payHistoryEmpty.style.display = '';
      els.payHistoryList.style.display = 'none';
      return;
    }

    els.payHistoryEmpty.style.display = 'none';
    els.payHistoryList.style.display = '';

    const lang = getLang();
    els.payHistoryList.innerHTML = payments.map((p, idx) => {
      const labels = PAYMENT_METHOD_LABELS[p.payment_method];
      const methodLabel = labels ? (lang === 'ar' ? labels.ar : labels.en) : p.payment_method;
      const dt = new Date(p.payment_date);
      let dateStr = '—';
      if (!isNaN(dt)) {
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yyyy = dt.getFullYear();
        let h = dt.getHours();
        const mi = String(dt.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12; if (h === 0) h = 12;
        dateStr = `${dd}/${mm}/${yyyy} ${String(h).padStart(2,'0')}:${mi} ${ampm}`;
      }
      
      // عرض تفاصيل الدفع المختلط
      let paymentDetailsHtml = '';
      if (p.payment_method === 'mixed' && (p.cash_amount > 0 || p.card_amount > 0)) {
        const cashAmt = num(p.cash_amount);
        const cardAmt = num(p.card_amount);
        paymentDetailsHtml = `
          <div class="pay-hist-mixed-details">
            <div class="pay-hist-mixed-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span>نقداً:</span>
              <strong dir="ltr">${riyalHtml(fmtMoney(cashAmt))}</strong>
            </div>
            <div class="pay-hist-mixed-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              <span>شبكة:</span>
              <strong dir="ltr">${riyalHtml(fmtMoney(cardAmt))}</strong>
            </div>
          </div>
        `;
      }
      
      const notesHtml = p.notes ? `<div class="pay-hist-notes">${String(p.notes).replace(/[<>]/g, '')}</div>` : '';
      return `<div class="pay-hist-item">
        <div class="pay-hist-num">${payments.length - idx}</div>
        <div class="pay-hist-main">
          <div class="pay-hist-row1">
            <span class="pay-hist-amount" dir="ltr">${riyalHtml(fmtMoney(p.payment_amount))}</span>
            <span class="pay-hist-method">${methodLabel}</span>
          </div>
          ${paymentDetailsHtml}
          <div class="pay-hist-row2">
            <span class="pay-hist-date" dir="ltr">${dateStr}</span>
            ${p.created_by ? `<span class="pay-hist-user">${p.created_by}</span>` : ''}
          </div>
          ${notesHtml}
        </div>
      </div>`;
    }).join('');
  }

  async function openPayDeferredModal(orderId) {
    const localInv = state.deferredInvoices.find(o => o.id === Number(orderId));
    state.deferredPayingOrder = localInv || null;
    els.payDeferredOrderId.value = orderId;
    els.payDeferredError.style.display = 'none';
    els.payAmountInput.value = '';

    // Build payment methods
    const methods = (state.appSettings && Array.isArray(state.appSettings.enabledPaymentMethods)
      ? state.appSettings.enabledPaymentMethods
      : ['cash', 'card', 'mixed', 'bank']
    ).filter(m => m !== 'credit');
    payModalState.selectedMethod = methods[0] || 'cash';
    renderPayMethods(methods);

    // Initial display with local data (for instant feedback)
    if (localInv) {
      payModalState.invoice = {
        ...localInv,
        paid_amount: num(localInv.paid_amount),
        remaining_amount: localInv.remaining_amount != null
          ? num(localInv.remaining_amount)
          : Math.max(0, num(localInv.total_amount) - num(localInv.paid_amount)),
      };
      payModalState.payments = [];
      updatePayModalDisplayInfo(); // عرض المعلومات فقط بدون تعيين المبلغ
      renderPayHistory();
    } else {
      // If no local invoice, initialize with empty state
      updateAfterInfo();
    }

    els.payDeferredModal.style.display = 'flex';
    setTimeout(() => els.payAmountInput && els.payAmountInput.focus(), 80);

    // Fetch latest data + payment history from server
    await refreshPayModalData(orderId);
  }

  async function refreshPayModalData(orderId) {
    const res = await window.api.getInvoiceWithPayments({ orderId: Number(orderId) });
    if (res && res.success && res.invoice) {
      payModalState.invoice = {
        ...res.invoice,
        total_amount: num(res.invoice.total_amount),
        paid_amount: num(res.invoice.paid_amount),
        remaining_amount: num(res.invoice.remaining_amount),
      };
      payModalState.payments = Array.isArray(res.payments) ? res.payments : [];
      updatePayModalDisplay();
      renderPayHistory();
    }
  }

  function closePayDeferredModal() {
    els.payDeferredModal.style.display = 'none';
    state.deferredPayingOrder = null;
    payModalState.invoice = null;
    payModalState.payments = [];
    if (els.payMixedSection) els.payMixedSection.style.display = 'none';
    if (els.payMixedCashInput) els.payMixedCashInput.value = '';
  }

  async function confirmPayDeferred() {
    if (payModalState.saving) return;
    const inv = payModalState.invoice;
    if (!inv) return;

    const orderId = Number(els.payDeferredOrderId.value);
    const amount = num(els.payAmountInput.value);
    const method = payModalState.selectedMethod || 'cash';
    const notes = null;
    const remaining = num(inv.remaining_amount);

    if (!amount || amount <= 0) {
      showTopToast(t('pos-deferred-err-amount-invalid') || 'أدخل مبلغاً صحيحاً أكبر من صفر', 'error');
      els.payAmountInput.focus();
      return;
    }
    if (amount > remaining + 0.0001) {
      showTopToast(t('pos-deferred-err-amount-exceeds') || 'المبلغ يتجاوز المتبقي', 'error');
      els.payAmountInput.focus();
      return;
    }

    payModalState.saving = true;
    els.btnPayDeferredConfirm.disabled = true;
    els.btnPayDeferredConfirm.classList.add('is-loading');

    const isMixed = method === 'mixed';
    let cashAmt = 0;
    let cardAmt = 0;
    if (isMixed) {
      const rawCash = num(els.payMixedCashInput && els.payMixedCashInput.value);
      cashAmt = Math.max(0, Math.min(rawCash, amount));
      cardAmt = clampToTwo(amount - cashAmt);
    }

    const res = await window.api.recordInvoicePayment({
      orderId,
      paymentAmount: amount,
      paymentMethod: method,
      cashAmount: cashAmt,
      cardAmount: cardAmt,
      notes,
    });

    payModalState.saving = false;
    els.btnPayDeferredConfirm.disabled = false;
    els.btnPayDeferredConfirm.classList.remove('is-loading');

    if (!res || !res.success) {
      els.payDeferredError.textContent = (res && res.message) || t('pos-err-save');
      els.payDeferredError.style.display = 'block';
      return;
    }

    const earnedNow = Number(res.loyaltyEarned || 0);
    if (earnedNow > 0) {
      state.customerLoyaltyBalance = Number(res.newLoyaltyBalance || 0);
      // تحديث عرض النقاط في شريحة العميل بالـ POS
      if (els.chipLoyaltyPoints) els.chipLoyaltyPoints.textContent = state.customerLoyaltyBalance.toLocaleString();
      if (els.chipLoyaltyBadge) {
        const spp = (state.loyaltySettings && state.loyaltySettings.loyaltySarPerPoint) || 0.05;
        els.chipLoyaltyBadge.title = `= ${(state.customerLoyaltyBalance * spp).toFixed(2)} ر.س`;
      }
      showTopToast((t('pos-deferred-payment-saved') || 'تم تسجيل الدفعة بنجاح') + ` • تم إضافة ${earnedNow} نقطة`, 'success');
    } else {
      showTopToast(t('pos-deferred-payment-saved') || 'تم تسجيل الدفعة بنجاح', 'success');
    }

    // إرسال الفاتورة عبر الواتساب عند الدفع
    if ((state.appSettings || {}).whatsappSendOnPay) {
      const _payInv = state.deferredInvoices.find(o => o.id === orderId);
      if (_payInv && _payInv.phone) sendInvoiceWhatsApp(orderId, _payInv.phone, 'pay');
    }

    // Refresh modal content
    els.payAmountInput.value = '';
    if (els.payMixedCashInput) els.payMixedCashInput.value = '';
    await refreshPayModalData(orderId);

    // Update deferred list row
    const localInv = state.deferredInvoices.find(o => o.id === orderId);
    if (localInv && payModalState.invoice) {
      localInv.paid_amount = payModalState.invoice.paid_amount;
      localInv.remaining_amount = payModalState.invoice.remaining_amount;
      localInv.payment_status = payModalState.invoice.payment_status;
      localInv.fully_paid_at = payModalState.invoice.fully_paid_at;
      if (payModalState.invoice.payment_status === 'paid') {
        localInv.paid_at = localInv.paid_at || new Date().toISOString();
        localInv.payment_method = method;
      }
      renderDeferredTable();
    }

    // لا نغلق الـ modal تلقائياً - نترك المستخدم يعرض سجل الدفعات
    // يمكن للمستخدم إغلاق الـ modal يدوياً
  }

  /* ========== MARK CLEANED / DELIVERED ========== */
  function refreshRowInPlace(id, type, field) {
    const now = new Date().toISOString();
    const arr = state.deferredInvoices || [];
    const item = arr.find(r => r.id === id && (r.rowType || 'invoice') === type);
    if (item) item[field] = now;
    const arr2 = state.deferredFilteredInvoices || [];
    const item2 = arr2.find(r => r.id === id && (r.rowType || 'invoice') === type);
    if (item2) item2[field] = now;
    const wrap = els.defTableWrap || document.getElementById('defTableWrap');
    const scrollTop = wrap ? wrap.scrollTop : (window.scrollY || 0);
    renderDeferredTable();
    if (wrap) wrap.scrollTop = scrollTop;
    else window.scrollTo(0, scrollTop);
  }

  async function deferredMarkCleaned(orderId) {
    const res = await window.api.markOrderCleaned({ orderId: Number(orderId) });
    if (!res || !res.success) {
      showToast(res && res.message ? res.message : t('pos-err-save'), 'error');
      return;
    }
    showTopToast(t('pos-deferred-clean-success'), 'success');
    refreshRowInPlace(Number(orderId), 'invoice', 'cleaning_date');
    if ((state.appSettings || {}).whatsappSendOnClean) {
      const inv = (state.deferredInvoices || []).find(r => r.id === Number(orderId) && (r.rowType || 'invoice') === 'invoice');
      if (inv && inv.phone) sendInvoiceWhatsApp(Number(orderId), inv.phone, 'clean');
    }
  }

  async function deferredMarkDelivered(orderId) {
    const res = await window.api.markOrderDelivered({ orderId: Number(orderId) });
    if (!res || !res.success) {
      showToast(res && res.message ? res.message : t('pos-err-save'), 'error');
      return;
    }
    showTopToast(t('pos-deferred-deliver-success'), 'success');
    refreshRowInPlace(Number(orderId), 'invoice', 'delivery_date');
    if ((state.appSettings || {}).whatsappSendOnDeliver) {
      const inv = (state.deferredInvoices || []).find(r => r.id === Number(orderId) && (r.rowType || 'invoice') === 'invoice');
      if (inv && inv.phone) sendInvoiceWhatsApp(Number(orderId), inv.phone, 'deliver');
    }
  }

  async function showDeferredReceiptPreview(receiptId) {
    const res = await window.api.getConsumptionReceiptById({ id: Number(receiptId) });
    if (!res || !res.success || !res.receipt) {
      showToast(t('pos-err-load'), 'error');
      return;
    }
    const r = res.receipt;
    const s = state.appSettings || {};
    const lang = getLang();
    const shopName = (lang === 'ar' ? s.laundryNameAr : s.laundryNameEn) || s.laundryNameAr || '';

    if (document.getElementById('crModalShopName')) document.getElementById('crModalShopName').textContent = shopName;
    if (document.getElementById('crModalShopAddress')) document.getElementById('crModalShopAddress').textContent = s.locationAr || s.locationEn || '';
    if (document.getElementById('crModalShopPhone')) document.getElementById('crModalShopPhone').textContent = s.phone ? 'هاتف: ' + s.phone : '';
    const crLogoWrap = document.getElementById('crModalLogoWrap');
    const crLogo = document.getElementById('crModalLogo');
    if (s.logoDataUrl && crLogo) { crLogo.src = s.logoDataUrl; if (crLogoWrap) crLogoWrap.style.display = ''; }
    else if (crLogoWrap) crLogoWrap.style.display = 'none';
    fillCrModalShopExtra(s);

    const titleEl = document.querySelector('#consumptionReceiptModal .cr-receipt-title');
    if (r.refund_id) {
      if (titleEl) titleEl.textContent = 'مرتجع / REFUND';
      if (els.crModalRefundNumRow) els.crModalRefundNumRow.style.display = '';
      if (els.crModalRefundReasonRow) els.crModalRefundReasonRow.style.display = r.refund_reason ? '' : 'none';
      if (els.crModalRefundReason) els.crModalRefundReason.textContent = r.refund_reason || '';
      if (els.crModalAmountLabel) els.crModalAmountLabel.textContent = 'المبلغ المسترجع';
      if (els.crModalBalBeforeLabel) els.crModalBalBeforeLabel.textContent = 'الرصيد قبل الإرجاع';
      if (els.crModalBalAfterLabel) els.crModalBalAfterLabel.textContent = 'الرصيد بعد الإرجاع';
    } else {
      if (titleEl) titleEl.textContent = 'إيصال استهلاك';
      if (els.crModalRefundNumRow) els.crModalRefundNumRow.style.display = 'none';
      if (els.crModalRefundReasonRow) els.crModalRefundReasonRow.style.display = 'none';
      if (els.crModalAmountLabel) els.crModalAmountLabel.textContent = 'المبلغ المستهلك';
      if (els.crModalBalBeforeLabel) els.crModalBalBeforeLabel.textContent = 'الرصيد قبل';
      if (els.crModalBalAfterLabel) els.crModalBalAfterLabel.textContent = 'الرصيد بعد';
    }

    const fmtDt = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      const pad = n => String(n).padStart(2,'0');
      const h = dt.getHours(), ampm = h >= 12 ? 'PM' : 'AM';
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(h%12||12)}:${pad(dt.getMinutes())} ${ampm}`;
    };

    state.viewingConsumptionReceiptNum = 'C-' + Number(r.receipt_seq);
    document.getElementById('crModalReceiptNum').textContent = state.viewingConsumptionReceiptNum;
    if (els.crModalRefundNum) els.crModalRefundNum.textContent = r.credit_note_seq ? 'R-' + Number(r.credit_note_seq) : state.viewingConsumptionReceiptNum;
    document.getElementById('crModalDate').textContent = fmtDt(r.created_at);
    document.getElementById('crModalCustomer').textContent = r.customer_name || '—';
    document.getElementById('crModalPhone').textContent = r.phone || '—';
    const subRefEl = document.getElementById('crModalSubRef');
    if (subRefEl) subRefEl.textContent = formatSubscriptionDisplayNum(r.subscription_number || '');
    document.getElementById('crModalPackage').textContent = r.package_name || '—';

    // تاريخ التنظيف والتسليم
    const cleanRow = document.getElementById('crModalCleanRow');
    const deliverRow = document.getElementById('crModalDeliverRow');
    const cleanDateEl = document.getElementById('crModalCleanDate');
    const deliverDateEl = document.getElementById('crModalDeliverDate');
    if (cleanRow && cleanDateEl) {
      if (r.cleaning_date) { cleanRow.style.display = ''; cleanDateEl.textContent = fmtDt(r.cleaning_date); }
      else cleanRow.style.display = 'none';
    }
    if (deliverRow && deliverDateEl) {
      if (r.delivery_date) { deliverRow.style.display = ''; deliverDateEl.textContent = fmtDt(r.delivery_date); }
      else deliverRow.style.display = 'none';
    }
    (function fixCrModalGrid() {
      var g = document.querySelector('#crModalPaper .cr-info-grid');
      if (!g) return;
      var cs = Array.from(g.querySelectorAll('.cr-info-cell'));
      cs.forEach(function(c) { c.style.gridColumn = ''; });
    })();

    const sarHtml = '<span class="sar">&#xE900;</span> ';
    if (r.refund_id) {
      document.getElementById('crModalConsumed').innerHTML = sarHtml + fmtLtr(r.refund_amount || r.amount_consumed || 0);
      document.getElementById('crModalBalBefore').innerHTML = sarHtml + fmtLtr(r.refund_old_balance || 0);
      document.getElementById('crModalBalAfter').innerHTML = sarHtml + fmtLtr(r.refund_new_balance || 0);
    } else {
      document.getElementById('crModalConsumed').innerHTML = sarHtml + fmtLtr(r.amount_consumed || 0);
      document.getElementById('crModalBalBefore').innerHTML = sarHtml + fmtLtr(r.balance_before || 0);
      document.getElementById('crModalBalAfter').innerHTML = sarHtml + fmtLtr(r.balance_after || 0);
    }

    const tbody = document.getElementById('crModalItemsBody');
    if (tbody) tbody.innerHTML = buildConsumptionItemsHtml(r.items || []);

    if (els.consumptionReceiptModal) els.consumptionReceiptModal.style.display = 'flex';
    setTimeout(() => renderConsumptionBarcode(r.refund_id ? null : r.receipt_seq), 0);
  }

  window._posDeferredViewReceipt = (id) => showDeferredReceiptPreview(id);

  // تملأ DOM إيصال الاستهلاك بصمت (بدون إظهار المودال) وتُرجع HTML الإيصال
  async function _buildReceiptHtmlSilent(receiptId) {
    const res = await window.api.getConsumptionReceiptById({ id: Number(receiptId) });
    if (!res || !res.success || !res.receipt) return null;
    const r = res.receipt;
    const s = state.appSettings || {};
    const lang = getLang();
    const shopName = (lang === 'ar' ? s.laundryNameAr : s.laundryNameEn) || s.laundryNameAr || '';

    if (document.getElementById('crModalShopName')) document.getElementById('crModalShopName').textContent = shopName;
    if (document.getElementById('crModalShopAddress')) document.getElementById('crModalShopAddress').textContent = s.locationAr || s.locationEn || '';
    if (document.getElementById('crModalShopPhone')) document.getElementById('crModalShopPhone').textContent = s.phone ? 'هاتف: ' + s.phone : '';
    const crLogoWrap = document.getElementById('crModalLogoWrap');
    const crLogo = document.getElementById('crModalLogo');
    if (s.logoDataUrl && crLogo) { crLogo.src = s.logoDataUrl; if (crLogoWrap) crLogoWrap.style.display = ''; }
    else if (crLogoWrap) crLogoWrap.style.display = 'none';
    fillCrModalShopExtra(s);

    const titleEl = document.querySelector('#consumptionReceiptModal .cr-receipt-title');
    if (titleEl) titleEl.textContent = 'إيصال استهلاك';
    if (els.crModalRefundNumRow) els.crModalRefundNumRow.style.display = 'none';
    if (els.crModalRefundReasonRow) els.crModalRefundReasonRow.style.display = 'none';
    if (els.crModalAmountLabel) els.crModalAmountLabel.textContent = 'المبلغ المستهلك';
    if (els.crModalBalBeforeLabel) els.crModalBalBeforeLabel.textContent = 'الرصيد قبل';
    if (els.crModalBalAfterLabel) els.crModalBalAfterLabel.textContent = 'الرصيد بعد';

    const fmtDt = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      const pad = n => String(n).padStart(2,'0');
      const h = dt.getHours(), ampm = h >= 12 ? 'PM' : 'AM';
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(h%12||12)}:${pad(dt.getMinutes())} ${ampm}`;
    };

    const rcptNum = 'C-' + Number(r.receipt_seq);
    state.viewingConsumptionReceiptNum = rcptNum;
    document.getElementById('crModalReceiptNum').textContent = rcptNum;
    document.getElementById('crModalDate').textContent = fmtDt(r.created_at);
    document.getElementById('crModalCustomer').textContent = r.customer_name || '—';
    document.getElementById('crModalPhone').textContent = r.phone || '—';
    const subRefEl = document.getElementById('crModalSubRef');
    if (subRefEl) subRefEl.textContent = formatSubscriptionDisplayNum(r.subscription_number || '');
    document.getElementById('crModalPackage').textContent = r.package_name || '—';

    const cleanRow = document.getElementById('crModalCleanRow');
    const deliverRow = document.getElementById('crModalDeliverRow');
    const cleanDateEl = document.getElementById('crModalCleanDate');
    const deliverDateEl = document.getElementById('crModalDeliverDate');
    if (cleanRow && cleanDateEl) {
      if (r.cleaning_date) { cleanRow.style.display = ''; cleanDateEl.textContent = fmtDt(r.cleaning_date); }
      else cleanRow.style.display = 'none';
    }
    if (deliverRow && deliverDateEl) {
      if (r.delivery_date) { deliverRow.style.display = ''; deliverDateEl.textContent = fmtDt(r.delivery_date); }
      else deliverRow.style.display = 'none';
    }
    (function fixCrModalGrid2() {
      var g = document.querySelector('#crModalPaper .cr-info-grid');
      if (!g) return;
      var cs = Array.from(g.querySelectorAll('.cr-info-cell'));
      cs.forEach(function(c) { c.style.gridColumn = ''; });
    })();

    const sarHtml = '<span class="sar">&#xE900;</span> ';
    document.getElementById('crModalConsumed').innerHTML = sarHtml + fmtLtr(r.amount_consumed || 0);
    document.getElementById('crModalBalBefore').innerHTML = sarHtml + fmtLtr(r.balance_before || 0);
    document.getElementById('crModalBalAfter').innerHTML = sarHtml + fmtLtr(r.balance_after || 0);

    const tbody = document.getElementById('crModalItemsBody');
    if (tbody) tbody.innerHTML = buildConsumptionItemsHtml(r.items || []);

    const paperEl = document.getElementById('crModalPaper');
    return { html: paperEl ? paperEl.outerHTML : null, rcptNum, phone: r.phone || '' };
  }

  async function _sendReceiptWhatsApp(receiptId, stage) {
    const rcpt = (state.deferredInvoices || []).find(r => r.id === Number(receiptId) && r.rowType === 'receipt');
    if (!rcpt || !rcpt.phone) return;
    try {
      const built = await _buildReceiptHtmlSilent(receiptId);
      if (!built || !built.html) return;
      const s = state.appSettings || {};
      const totalAmount = rcpt.total_amount || rcpt.amount_consumed || 0;
      const totalLine = totalAmount ? '\n*الإجمالي: ' + Number(totalAmount).toFixed(2) + ' SAR*' : '';
      const stageAutoMsg = {
        clean:   'تم تنظيف ملابسكم 🧺\nإيصال استهلاك رقم: ' + built.rcptNum + totalLine,
        deliver: 'تم تسليم ملابسكم 🎁\nإيصال استهلاك رقم: ' + built.rcptNum + totalLine,
      };
      const autoMsg = stageAutoMsg[stage] || '';
      const optionalMsg = s.whatsappInvoiceMessage
        ? s.whatsappInvoiceMessage.split('\n').map(function(l) { var t = l.trim(); return t ? '*' + t + '*' : ''; }).join('\n')
        : '';
      const caption = autoMsg ? (optionalMsg ? autoMsg + '\n\n' + optionalMsg : autoMsg) : optionalMsg;
      const _waRes = await window.api.whatsappSendInvoicePdfFromHtml({
        html: built.html, paperType: 'thermal', phone: rcpt.phone,
        caption, orderNum: built.rcptNum, zatcaPayload: null
      });
      const _label = 'إيصال رقم: ' + built.rcptNum;
      if (_waRes && _waRes.success) {
        showTopToast('✅ واتساب | ' + _label + ' — تم الإرسال', 'success', 4000);
      } else if (_waRes && (_waRes.message === 'not_on_whatsapp' || _waRes.error === 'not_on_whatsapp')) {
        showTopToast('⚠️ واتساب | ' + _label + ' — الرقم غير مسجّل في واتساب', 'warning', 5000);
      } else {
        showTopToast('❌ واتساب | ' + _label + ' — فشل الإرسال', 'error', 5000);
      }
    } catch (_) {}
  }

  async function deferredMarkReceiptCleaned(receiptId) {
    const res = await window.api.markReceiptCleaned({ receiptId: Number(receiptId) });
    if (!res || !res.success) {
      showToast(res && res.message ? res.message : t('pos-err-save'), 'error');
      return;
    }
    showTopToast(t('pos-deferred-clean-success'), 'success');
    refreshRowInPlace(Number(receiptId), 'receipt', 'cleaning_date');
    if ((state.appSettings || {}).whatsappSendOnClean) {
      _sendReceiptWhatsApp(Number(receiptId), 'clean');
    }
  }

  async function deferredMarkReceiptDelivered(receiptId) {
    const res = await window.api.markReceiptDelivered({ receiptId: Number(receiptId) });
    if (!res || !res.success) {
      showToast(res && res.message ? res.message : t('pos-err-save'), 'error');
      return;
    }
    showTopToast(t('pos-deferred-deliver-success'), 'success');
    refreshRowInPlace(Number(receiptId), 'receipt', 'delivery_date');
    if ((state.appSettings || {}).whatsappSendOnDeliver) {
      _sendReceiptWhatsApp(Number(receiptId), 'deliver');
    }
  }

  window._posMarkReceiptCleaned   = (id) => deferredMarkReceiptCleaned(id);
  window._posMarkReceiptDelivered = (id) => deferredMarkReceiptDelivered(id);

  /* ========== BARCODE SCAN (Deferred) ========== */
  async function barcodeAutoAction(inv, actionStr) {
    const orderId = inv.id;
    const remaining = num(inv.remaining_amount);
    const actions = actionStr.split(',');

    // 1. Pay remaining amount if pay is enabled
    if (actions.includes('pay')) {
      if (inv.payment_status !== 'paid' && remaining > 0) {
        const payRes = await window.api.recordInvoicePayment({
          orderId,
          paymentAmount: remaining,
          paymentMethod: 'cash',
          cashAmount: remaining,
          cardAmount: 0,
          notes: 'دفع تلقائي بالباركود',
        });
        if (!payRes || !payRes.success) {
          showTopToast('فشل الدفع التلقائي: ' + (payRes && payRes.message ? payRes.message : ''), 'error');
          return;
        }
      }
    }

    // 2. Mark cleaned if clean is enabled
    if (actions.includes('clean')) {
      if (!inv.cleaning_date) {
        const cleanRes = await window.api.markOrderCleaned({ orderId: Number(orderId) });
        if (!cleanRes || !cleanRes.success) {
          showTopToast('فشل تحديث حالة التنظيف', 'error');
          return;
        }
      }
    }

    // 3. Mark delivered if deliver is enabled
    if (actions.includes('deliver')) {
      if (!inv.delivery_date) {
        const delRes = await window.api.markOrderDelivered({ orderId: Number(orderId) });
        if (!delRes || !delRes.success) {
          showTopToast('فشل تحديث حالة التسليم', 'error');
          return;
        }
      }
    }

    // Build success message based on enabled actions
    const labels = [];
    if (actions.includes('pay')) labels.push('الدفع');
    if (actions.includes('clean')) labels.push('التنظيف');
    if (actions.includes('deliver')) labels.push('التسليم');
    showTopToast('تم ' + labels.join(' و ') + ' تلقائياً', 'success');

    // إرسال الواتساب حسب الإعدادات
    const _waBarcode = state.appSettings || {};
    if (inv.phone) {
      if (actions.includes('deliver') && _waBarcode.whatsappSendOnDeliver) {
        sendInvoiceWhatsApp(orderId, inv.phone, 'deliver');
      } else if (actions.includes('clean') && _waBarcode.whatsappSendOnClean) {
        sendInvoiceWhatsApp(orderId, inv.phone, 'clean');
      } else if (actions.includes('pay') && _waBarcode.whatsappSendOnPay) {
        sendInvoiceWhatsApp(orderId, inv.phone, 'pay');
      }
    }

    // Refresh and show just the processed invoice for verification (without touching search box)
    const refreshRes = await window.api.getDeferredOrders({
      search: String(inv.invoice_seq || inv.order_number || inv.id || ''),
      statusFilter: 'unpaid'
    });
    if (refreshRes && refreshRes.success && refreshRes.orders && refreshRes.orders.length > 0) {
      state.deferredInvoiceSearchMode = true; // bypass status filter so the paid invoice is visible
      state.deferredInvoices = refreshRes.orders;
      state.deferredPage = 1;
      renderDeferredInvoices(state.deferredInvoices);
    }

    // Focus barcode input for next scan
    if (els.deferredBarcodeInput) {
      els.deferredBarcodeInput.value = '';
      els.deferredBarcodeInput.focus();
    }
  }

  async function handleDeferredBarcodeScan() {
    const barcodeVal = els.deferredBarcodeInput ? els.deferredBarcodeInput.value.trim() : '';
    if (!barcodeVal) return;

    // Consumption receipt barcode (C-X format)
    if (/^C-\d+$/i.test(barcodeVal)) {
      await handleReceiptBarcodeScan(barcodeVal.toUpperCase());
      return;
    }

    const invoiceSeq = Number(barcodeVal);
    if (isNaN(invoiceSeq) || invoiceSeq <= 0) {
      showTopToast('رقم باركود غير صالح', 'error');
      return;
    }

    // Look up invoice by invoice_seq
    const res = await window.api.getDeferredOrders({ search: String(invoiceSeq), statusFilter: 'unpaid' });
    if (!res || !res.success || !res.orders || res.orders.length === 0) {
      showTopToast('لم يتم العثور على فاتورة آجلة بهذا الرقم', 'error');
      if (els.deferredBarcodeInput) els.deferredBarcodeInput.value = '';
      return;
    }

    const inv = res.orders[0];

    // Check if barcode auto-action is enabled
    const autoAction = state.appSettings && state.appSettings.barcodeAutoAction;

    if (autoAction && autoAction !== 'none') {
      await barcodeAutoAction(inv, autoAction);
    } else {
      // Default: just open the pay modal
      openPayDeferredModal(inv.id);
    }

    if (els.deferredBarcodeInput) {
      els.deferredBarcodeInput.value = '';
      els.deferredBarcodeInput.focus();
    }
  }

  async function handleReceiptBarcodeScan(barcodeVal) {
    const res = await window.api.getDeferredOrders({ search: barcodeVal });
    const receipt = res && res.success && res.orders && res.orders.find(r => r.rowType === 'receipt');
    if (!receipt) {
      showTopToast('لم يتم العثور على إيصال بهذا الرقم', 'error');
      if (els.deferredBarcodeInput) els.deferredBarcodeInput.value = '';
      return;
    }

    const autoAction = state.appSettings && state.appSettings.barcodeAutoAction;
    const actions = (autoAction && autoAction !== 'none') ? autoAction.split(',') : [];

    // If pay is enabled and receipt has a linked order, fetch and pay that order
    if (actions.includes('pay') && receipt.order_id) {
      const orderRes = await window.api.getDeferredOrders({
        search: String(receipt.order_id),
        statusFilter: 'unpaid'
      });
      const inv = orderRes && orderRes.success && orderRes.orders && orderRes.orders[0];
      if (inv && inv.payment_status !== 'paid' && num(inv.remaining_amount) > 0) {
        await barcodeAutoAction(inv, autoAction);
      } else if (inv) {
        // Order exists but no payment needed — still handle clean/deliver on receipt
        await _applyReceiptActions(receipt, actions, barcodeVal);
      } else {
        // No linked deferred order — open pay modal if no auto-action specified
        await _applyReceiptActions(receipt, actions, barcodeVal);
      }
    } else if (actions.length > 0) {
      await _applyReceiptActions(receipt, actions, barcodeVal);
    } else {
      // No auto-action: if receipt has linked order open pay modal, otherwise just show receipt
      if (receipt.order_id) {
        const orderRes = await window.api.getDeferredOrders({
          search: String(receipt.order_id),
          statusFilter: 'unpaid'
        });
        const inv = orderRes && orderRes.success && orderRes.orders && orderRes.orders[0];
        if (inv) {
          openPayDeferredModal(inv.id);
        }
      }
    }

    // Refresh display
    const refreshRes = await window.api.getDeferredOrders({ search: barcodeVal });
    if (refreshRes && refreshRes.success && refreshRes.orders) {
      state.deferredInvoiceSearchMode = true;
      state.deferredInvoices = refreshRes.orders;
      state.deferredPage = 1;
      renderDeferredInvoices(state.deferredInvoices);
    }

    if (els.deferredBarcodeInput) {
      els.deferredBarcodeInput.value = '';
      els.deferredBarcodeInput.focus();
    }
  }

  async function _applyReceiptActions(receipt, actions, barcodeVal) {
    if (receipt.is_refund) {
      showTopToast('لا يمكن تنفيذ إجراءات على إيصال مسترجع', 'error');
      return;
    }
    if (actions.includes('clean') && !receipt.cleaning_date) {
      const cr = await window.api.markReceiptCleaned({ receiptId: Number(receipt.id) });
      if (!cr || !cr.success) { showTopToast('فشل تحديث حالة التنظيف', 'error'); return; }
    }
    if (actions.includes('deliver') && !receipt.delivery_date) {
      const dr = await window.api.markReceiptDelivered({ receiptId: Number(receipt.id) });
      if (!dr || !dr.success) { showTopToast('فشل تحديث حالة التسليم', 'error'); return; }
    }
    const labels = [];
    if (actions.includes('clean')) labels.push('التنظيف');
    if (actions.includes('deliver')) labels.push('التسليم');
    if (labels.length) showTopToast('تم ' + labels.join(' و ') + ' للإيصال ' + barcodeVal, 'success');
  }

  /* ========== CAMERA BARCODE SCANNER ========== */

  /**
   * Open camera scanner — live stream like a real barcode scanner.
   * Works on HTTPS/localhost. Mobile users are auto-redirected to HTTPS by the server.
   */
  async function openCameraScanner() {
    if (typeof Html5Qrcode === 'undefined') {
      showTopToast('مكتبة المسح غير متاحة — تحقق من الاتصال بالإنترنت', 'error');
      return;
    }

    if (!els.cameraScannerModal) return;

    els.cameraScannerModal.style.display = 'flex';
    els.cameraScannerResult.style.display = 'none';
    els.cameraScannerStatus.style.display = 'flex';
    els.cameraScannerStatus.className = 'camera-scanner-status scanning-active';
    els.cameraScannerStatus.querySelector('span').textContent = 'جاري تشغيل الكاميرا...';

    // Cleanup any previous instance
    if (state.cameraScanner) {
      try { await state.cameraScanner.stop(); } catch(e) {}
      state.cameraScanner = null;
      els.cameraScannerView.innerHTML = '';
    }

    try {
      var html5QrCode = new Html5Qrcode('cameraScannerView');
      state.cameraScanner = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 100 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        onCameraScanSuccess,
        function() {} // ignore continuous non-reads
      );

      els.cameraScannerStatus.querySelector('span').textContent = 'وجّه الكاميرا نحو الباركود...';
    } catch (err) {
      console.error('Camera error:', err);
      els.cameraScannerStatus.className = 'camera-scanner-status camera-error';
      var errMsg = 'تعذر فتح الكاميرا';
      if (err && err.name === 'NotAllowedError') {
        errMsg = 'تم رفض صلاحية الكاميرا — فعّلها من إعدادات المتصفح';
      } else if (err && err.name === 'NotFoundError') {
        errMsg = 'لم يتم العثور على كاميرا على هذا الجهاز';
      } else if (!window.isSecureContext) {
        errMsg = 'الكاميرا تتطلب اتصال آمن — افتح التطبيق من الرابط الآمن (HTTPS)';
      }
      els.cameraScannerStatus.querySelector('span').textContent = errMsg;
    }
  }

  async function closeCameraScanner() {
    if (state.cameraScanner) {
      try { await state.cameraScanner.stop(); } catch(e) {}
      state.cameraScanner = null;
    }
    if (els.cameraScannerView) els.cameraScannerView.innerHTML = '';
    if (els.cameraScannerModal) els.cameraScannerModal.style.display = 'none';
  }

  async function onCameraScanSuccess(decodedText) {
    // Stop camera immediately to prevent repeated scans
    if (state.cameraScanner) {
      try { await state.cameraScanner.stop(); } catch(e) {}
      state.cameraScanner = null;
    }

    // Show result
    if (els.cameraScannerStatus) els.cameraScannerStatus.style.display = 'none';
    if (els.cameraScannerResult) {
      els.cameraScannerResult.style.display = 'flex';
      els.cameraScannerResult.className = 'camera-scanner-result scan-success';
      els.cameraScannerResult.textContent = '✓ تم مسح الباركود: ' + decodedText;
    }

    // Parse the barcode value
    var barcodeVal = String(decodedText || '').trim();
    if (barcodeVal.startsWith('INV-')) {
      var parts = barcodeVal.replace('INV-', '').split('|');
      barcodeVal = parts[0] || barcodeVal;
    }

    // Put value in barcode input
    if (els.deferredBarcodeInput) {
      els.deferredBarcodeInput.value = barcodeVal;
    }

    // Close modal and execute barcode scan logic
    setTimeout(async function() {
      await closeCameraScanner();
      handleDeferredBarcodeScan();
    }, 600);
  }

  /* ========== DEFERRED INVOICE PREVIEW ========== */
  async function showDeferredInvoicePreview(orderId) {
    const res = await window.api.getOrderById({ id: Number(orderId) });
    if (!res || !res.success || !res.order) {
      showToast(t('pos-err-load'), 'error');
      return;
    }
    const { order, items } = res;

    const saved = {
      cart:            state.cart,
      customer:        state.selectedCustomer,
      pm:              state.paymentMethod,
      vat:             state.vatRate,
      priceDisplayMode: state.priceDisplayMode,
    };

    state.cart = (items || []).map(item => ({
      productNameAr: item.product_name_ar || '',
      productNameEn: item.product_name_en || '',
      serviceNameAr: item.service_name_ar || '',
      serviceNameEn: item.service_name_en || '',
      serviceName:   item.service_name_ar || '',
      qty:           item.quantity,
      unitPrice:     parseFloat(item.unit_price || 0),
      lineTotal:     parseFloat(item.line_total || 0),
    }));
    state.selectedCustomer = order.customer_name
      ? { name: order.customer_name, phone: order.phone || '', taxNumber: order.customer_vat || '' }
      : null;
    state.paymentMethod    = order.payment_method || 'cash';
    state.vatRate          = Number(order.vat_rate || 15);
    state.priceDisplayMode = order.price_display_mode === 'inclusive' ? 'inclusive' : 'exclusive';
    state.viewingDeferredInvoice = saved;

    /* استخدام بيانات الاشتراك المُرجعة من getOrderById مباشرة */
    const subscription = res.subscription || null;

    // حساب إجمالي المدفوع كاش والشبكة من جميع الدفعات
    const paymentsRes = await window.api.getInvoiceWithPayments({ orderId: Number(orderId) });
    let totalCash = 0;
    let totalCard = 0;
    if (paymentsRes && paymentsRes.success && Array.isArray(paymentsRes.payments)) {
      paymentsRes.payments.forEach(p => {
        const method = p.payment_method;
        if (method === 'cash') {
          totalCash += Number(p.payment_amount || 0);
        } else if (method === 'card') {
          totalCard += Number(p.payment_amount || 0);
        } else if (method === 'mixed') {
          totalCash += Number(p.cash_amount || 0);
          totalCard += Number(p.card_amount || 0);
        }
      });
    }
    
    // إذا كان هناك دفعات نقدية وشبكة معاً، غيّر طريقة الدفع لـ mixed
    if (totalCash > 0 && totalCard > 0) {
      state.paymentMethod = 'mixed';
    }

    // نقاط الولاء المخزنة على الفاتورة
    const loyaltyEarnedOnOrder   = Number(order.loyalty_points_earned   || 0);
    const loyaltyRedeemedOnOrder = Number(order.loyalty_points_redeemed || 0);
    const loyaltyDiscountOnOrder = Number(order.loyalty_discount_amount || 0);
    if (order.customer_id && loyaltyEarnedOnOrder > 0) {
      // نجلب الرصيد الحالي من DB ثم نطرح النقاط المكتسبة لأن صيغة showInvoiceModal ستجمعها
      try {
        const balRes = await window.api.getCustomerLoyaltyBalance({ customerId: order.customer_id });
        if (balRes && balRes.success) {
          const currentBal = Number(balRes.balance) || 0;
          state.customerLoyaltyBalance = currentBal - loyaltyEarnedOnOrder + loyaltyRedeemedOnOrder;
        }
      } catch (_) {}
    }

    showInvoiceModal(
      order.order_number,
      order.created_at,
      {
        subtotal:        Number(order.subtotal         || 0),
        discount:        Number(order.discount_amount  || 0),
        extra:           Number(order.extra_amount     || 0),
        vatAmount:       Number(order.vat_amount       || 0),
        total:           Number(order.total_amount     || 0),
        paid:            Number(order.paid_amount      || 0),
        remaining:       Number(order.remaining_amount || 0),
        paidCash:        totalCash,
        paidCard:        totalCard,
        loyaltyEarned:   loyaltyEarnedOnOrder,
        loyaltyRedeemed: loyaltyRedeemedOnOrder,
        loyaltyDiscount: loyaltyDiscountOnOrder,
      },
      subscription,
      order.invoice_seq,
      {
        paidAt:       order.paid_at       || null,
        cleaningDate: order.cleaning_date || null,
        deliveryDate: order.delivery_date || null,
      },
      false,
      order.id,
      order.notes || ''
    );
  }

  /* expose to onclick in generated HTML */
  window._posPayInvoice    = openPayDeferredModal;
  window._posMarkCleaned   = deferredMarkCleaned;
  window._posMarkDelivered = deferredMarkDelivered;
  window._posDeferredView  = showDeferredInvoicePreview;

  /* ========== START ========== */
  window.addEventListener('DOMContentLoaded', init);
})();
