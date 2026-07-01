(function () {
  'use strict';

  /* ── State ── */
  var state = {
    customers: [],
    customersPage: 1,
    customersTotal: 0,
    customersTotalPages: 1,
    customersSearch: '',
    selectedCustomer: null,
    workOrders: [],
    ordersPage: 1,
    ordersTotal: 0,
    ordersTotalPages: 1,
    ordersSearch: '',
    ordersDateFrom: '',
    ordersDateTo: '',
    currentTab: 'pending',
    selectedOrderIds: new Set(),
    cancelTargetId: null,
    pendingIssuePayload: null,
    appSettings: null,
    searchDebounceTimer: null
  };

  /* ── DOM refs ── */
  var el = {
    btnBack:             document.getElementById('btnBack'),
    btnBackToCustomers:  document.getElementById('btnBackToCustomers'),
    customerSearch:      document.getElementById('customerSearch'),
    customersTableBody:  document.getElementById('customersTableBody'),
    customerPaginationBar: document.getElementById('customerPaginationBar'),
    customerPanel:       document.getElementById('customerPanel'),
    ordersPanel:         document.getElementById('ordersPanel'),
    selectedCustomerName: document.getElementById('selectedCustomerName'),
    selectedCustomerVat: document.getElementById('selectedCustomerVat'),
    ordersSearch:        document.getElementById('ordersSearch'),
    ordersDateFrom:      document.getElementById('ordersDateFrom'),
    ordersDateTo:        document.getElementById('ordersDateTo'),
    ordersTableHead:     document.getElementById('ordersTableHead'),
    ordersTableBody:     document.getElementById('ordersTableBody'),
    ordersPaginationBar: document.getElementById('ordersPaginationBar'),
    pendingActions:      document.getElementById('pendingActions'),
    thCheckbox:          document.getElementById('thCheckbox'),
    selectAllOrders:     null,
    discountValue:       document.getElementById('discountValue'),
    discountType:        document.getElementById('discountType'),
    paymentMethodSelect: document.getElementById('paymentMethodSelect'),
    totalPreview:        document.getElementById('totalPreview'),
    previewSubtotal:     document.getElementById('previewSubtotal'),
    previewDiscountRow:  document.getElementById('previewDiscountRow'),
    previewDiscount:     document.getElementById('previewDiscount'),
    previewTotal:        document.getElementById('previewTotal'),
    btnIssueInvoice:     document.getElementById('btnIssueInvoice'),
    cancelModal:         document.getElementById('cancelModal'),
    cancelOrderNum:      document.getElementById('cancelOrderNum'),
    btnConfirmCancel:    document.getElementById('btnConfirmCancel'),
    btnCancelClose:      document.getElementById('btnCancelClose'),
    vatConfirmModal:     document.getElementById('vatConfirmModal'),
    vatConfirmCustomerName: document.getElementById('vatConfirmCustomerName'),
    btnConfirmNoVat:     document.getElementById('btnConfirmNoVat'),
    btnUpdateVat:        document.getElementById('btnUpdateVat'),
    mixedPaymentModal:   document.getElementById('mixedPaymentModal'),
    mixedTotalAmount:    document.getElementById('mixedTotalAmount'),
    mixedCashAmount:     document.getElementById('mixedCashAmount'),
    mixedCardAmount:     document.getElementById('mixedCardAmount'),
    mixedPaymentError:   document.getElementById('mixedPaymentError'),
    btnConfirmMixedPayment: document.getElementById('btnConfirmMixedPayment'),
    btnCancelMixedPayment: document.getElementById('btnCancelMixedPayment'),
    toastContainer:      document.getElementById('toastContainer'),
    woPrintZone:         document.getElementById('woPrintZone'),
    btnExportSelectedExcel: document.getElementById('btnExportSelectedExcel'),
    btnExportSelectedPdf:   document.getElementById('btnExportSelectedPdf')
  };

  /* ── Toast ── */
  function toast(msg, type, dur) {
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    el.toastContainer.appendChild(t);
    setTimeout(function () { t.remove(); }, dur || 3000);
  }

  /* ── Format ── */
  function fmt(n) { return parseFloat(n || 0).toFixed(2); }
  function fmtDate(dt) {
    if (!dt) return '';
    var d = new Date(dt);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  function fmtDateTimeEn(dt) {
    if (!dt) return '';
    var d = new Date(dt);
    var day = d.getDate(), month = d.getMonth() + 1, year = d.getFullYear();
    var hrs = d.getHours(), mins = d.getMinutes();
    var ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12 || 12;
    return (day < 10 ? '0' + day : day) + '/' + (month < 10 ? '0' + month : month) + '/' + year +
           ' ' + (hrs < 10 ? '0' + hrs : hrs) + ':' + (mins < 10 ? '0' + mins : mins) + ' ' + ampm;
  }
  function paymentLabelAr(pm) {
    var t = window.I18N ? window.I18N.t.bind(window.I18N) : function (k, fb) { return fb || k; };
    var map = {
      cash: t('payment-cash', 'نقدي') + ' / Cash',
      card: t('payment-card', 'شبكة') + ' / Card',
      bank: t('payment-bank', 'تحويل بنكي') + ' / Bank',
      transfer: t('payment-bank', 'تحويل بنكي') + ' / Bank',
      credit: t('payment-credit', 'آجل') + ' / Deferred',
      deferred: t('payment-credit', 'آجل') + ' / Deferred',
      mixed: t('payment-mixed', 'نقدي وشبكة') + ' / Mixed',
      subscription: t('payment-subscription', 'اشتراك') + ' / Subscription'
    };
    return map[pm] || pm || t('payment-cash', 'نقدي') + ' / Cash';
  }
  function normalizePaymentMethod(method) {
    var allowed = ['cash', 'card', 'bank', 'transfer', 'credit', 'deferred', 'mixed', 'subscription'];
    method = String(method || '').trim();
    return allowed.indexOf(method) >= 0 ? method : 'cash';
  }
  function fillPaymentMethodOptions() {
    if (!el.paymentMethodSelect) return;
    var settings = state.appSettings || {};
    var enabled = Array.isArray(settings.enabledPaymentMethods) && settings.enabledPaymentMethods.length
      ? settings.enabledPaymentMethods
      : ['cash', 'card', 'mixed', 'credit'];
    enabled = enabled.map(normalizePaymentMethod).filter(function (m, idx, arr) { return arr.indexOf(m) === idx; });
    if (!enabled.length) enabled = ['cash'];
    var t = window.I18N ? window.I18N.t.bind(window.I18N) : function (k, fb) { return fb || k; };
    var labels = { cash: t('payment-cash', 'نقدي'), card: t('payment-card', 'شبكة'), bank: t('payment-bank', 'تحويل بنكي'), transfer: t('payment-bank', 'تحويل بنكي'), credit: t('payment-credit', 'آجل'), deferred: t('payment-credit', 'آجل'), mixed: t('payment-mixed', 'نقدي وشبكة'), subscription: t('payment-subscription', 'اشتراك') };
    el.paymentMethodSelect.innerHTML = enabled.map(function (m) {
      return '<option value="' + esc(m) + '">' + esc(labels[m] || m) + '</option>';
    }).join('');
    var defaultMethod = normalizePaymentMethod(settings.defaultPaymentMethod || enabled[0]);
    el.paymentMethodSelect.value = enabled.indexOf(defaultMethod) >= 0 ? defaultMethod : enabled[0];
  }
  function badge(status) {
    var t = window.I18N ? window.I18N.t.bind(window.I18N) : function (k, fb) { return fb || k; };
    var map = { pending: 'badge-pending', invoiced: 'badge-invoiced', cancelled: 'badge-cancelled' };
    var lbl = { pending: t('hc-tab-pending', 'في الانتظار'), invoiced: t('hc-tab-invoiced', 'مُفوترة'), cancelled: t('hc-tab-cancelled', 'ملغية') };
    return '<span class="badge ' + (map[status] || '') + '">' + (lbl[status] || status) + '</span>';
  }

  /* ── Settings ── */
  async function loadSettings() {
    try {
      var r = await window.api.getAppSettings();
      if (r && r.success) state.appSettings = r.settings;
    } catch (_) {}
    fillPaymentMethodOptions();
  }

  /* ── Customers list ── */
  async function loadCustomers(page) {
    state.customersPage = page || 1;
    try {
      var r = await window.api.getCorporateCustomers({
        search: state.customersSearch,
        page: state.customersPage,
        pageSize: 15
      });
      if (!r.success) { toast(r.message || I18N.t('hc-err-load-customers', 'خطأ في تحميل العملاء'), 'error'); return; }
      state.customers = r.rows || [];
      state.customersTotal = r.total || 0;
      state.customersTotalPages = r.totalPages || 1;
      renderCustomers();
      renderCustomerPagination();
    } catch (err) {
      toast('خطأ: ' + err.message, 'error');
    }
  }

  function renderCustomers() {
    var rows = state.customers;
    if (rows.length === 0) {
      el.customersTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">' + I18N.t('hc-no-customers', 'لا يوجد عملاء شركات مسجلون') + '</td></tr>';
      return;
    }
    el.customersTableBody.innerHTML = rows.map(function (c) {
      var pendingBadge = c.pending_work_orders > 0
        ? '<span class="badge-pending-count">' + c.pending_work_orders + ' ' + I18N.t('hc-pending-count', 'أمر') + '</span>'
        : '<span style="color:#94a3b8">' + I18N.t('hc-no-pending', 'لا يوجد') + '</span>';
      return '<tr>' +
        '<td><strong>' + esc(c.customer_name) + '</strong></td>' +
        '<td>' + esc(c.phone || '—') + '</td>' +
        '<td>' + esc(c.tax_number || '—') + '</td>' +
        '<td>' + pendingBadge + '</td>' +
        '<td>' + (c.pending_work_orders > 0 ? fmt(c.pending_total) + ' <span class="sar">&#xE900;</span>' : '—') + '</td>' +
        '<td><button class="btn-view-orders" data-id="' + c.id + '" data-name="' + esc(c.customer_name) + '" data-vat="' + esc(c.tax_number || '') + '">' + I18N.t('hc-btn-view-orders', 'عرض الأوامر') + '</button></td>' +
        '</tr>';
    }).join('');

    el.customersTableBody.querySelectorAll('.btn-view-orders').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectCustomer({ id: +btn.dataset.id, customer_name: btn.dataset.name, tax_number: btn.dataset.vat });
      });
    });
  }

  function renderCustomerPagination() {
    if (state.customersTotalPages <= 1) { el.customerPaginationBar.style.display = 'none'; return; }
    el.customerPaginationBar.style.display = 'flex';
    var html = '';
    html += '<button class="page-btn" ' + (state.customersPage <= 1 ? 'disabled' : '') + ' data-page="' + (state.customersPage - 1) + '">' + I18N.t('hc-pagination-prev', 'السابق') + '</button>';
    for (var i = 1; i <= state.customersTotalPages; i++) {
      html += '<button class="page-btn' + (i === state.customersPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" ' + (state.customersPage >= state.customersTotalPages ? 'disabled' : '') + ' data-page="' + (state.customersPage + 1) + '">' + I18N.t('hc-pagination-next', 'التالي') + '</button>';
    el.customerPaginationBar.innerHTML = html;
    el.customerPaginationBar.querySelectorAll('.page-btn:not([disabled])').forEach(function (btn) {
      btn.addEventListener('click', function () { loadCustomers(+btn.dataset.page); });
    });
  }

  /* ── Select customer → show orders panel ── */
  function selectCustomer(cust) {
    state.selectedCustomer = cust;
    state.currentTab = 'pending';
    state.ordersPage = 1;
    state.ordersSearch = '';
    state.ordersDateFrom = '';
    state.ordersDateTo = '';
    state.selectedOrderIds = new Set();

    el.selectedCustomerName.textContent = cust.customer_name;
    el.selectedCustomerVat.textContent = cust.phone ? cust.phone : '';
    el.ordersSearch.value = '';
    el.ordersDateFrom.value = '';
    el.ordersDateTo.value = '';

    el.customerPanel.style.display = 'none';
    el.ordersPanel.style.display = '';

    setActiveTab('pending');
    loadWorkOrders();
  }

  function backToCustomers() {
    state.selectedCustomer = null;
    el.ordersPanel.style.display = 'none';
    el.customerPanel.style.display = '';
    loadCustomers(1);
  }

  /* ── Tabs ── */
  function setActiveTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    var isPending = tab === 'pending';
    renderOrdersHeader();
    el.pendingActions.style.display = isPending ? 'flex' : 'none';
    if (isPending) {
      state.selectedOrderIds = new Set();
      updateIssueBtn();
    }
    state.ordersPage = 1;
    loadWorkOrders();
  }

  /* ── Work Orders ── */
  function renderOrdersHeader() {
    var isPending = state.currentTab === 'pending';
    el.ordersTableHead.innerHTML = '<tr>' +
      (isPending ? '<th id="thCheckbox"><input type="checkbox" id="selectAllOrders2" /></th>' : '') +
      '<th>' + I18N.t('hc-th-order-num', 'رقم الأمر') + '</th>' +
      '<th>' + I18N.t('hc-th-date', 'التاريخ') + '</th>' +
      '<th>' + I18N.t('hc-th-total', 'الإجمالي') + '</th>' +
      (isPending ? '<th>' + I18N.t('hc-th-cleaning-date', 'تاريخ التنظيف') + '</th><th>' + I18N.t('hc-th-delivery-date', 'تاريخ التسليم') + '</th>' : '<th>' + I18N.t('hc-th-status', 'الحالة') + '</th>') +
      '<th>' + I18N.t('hc-th-action', 'الإجراء') + '</th>' +
      '</tr>';
    el.thCheckbox = document.getElementById('thCheckbox');
    el.selectAllOrders = document.getElementById('selectAllOrders2');
    if (el.selectAllOrders) {
      el.selectAllOrders.addEventListener('change', function () {
        var cbs = el.ordersTableBody.querySelectorAll('.wo-check');
        cbs.forEach(function (cb) {
          cb.checked = el.selectAllOrders.checked;
          var id = +cb.dataset.id;
          if (el.selectAllOrders.checked) state.selectedOrderIds.add(id);
          else state.selectedOrderIds.delete(id);
        });
        updateIssueBtn();
        updateTotalPreview();
      });
    }
  }

  async function loadWorkOrders(page) {
    state.ordersPage = page || state.ordersPage || 1;
    if (!state.selectedCustomer) return;
    try {
      var r = await window.api.getWorkOrders({
        status: state.currentTab,
        customerId: state.selectedCustomer.id,
        search: state.ordersSearch,
        dateFrom: state.ordersDateFrom,
        dateTo: state.ordersDateTo,
        page: state.ordersPage,
        pageSize: 20
      });
      if (!r.success) { toast(r.message || I18N.t('hc-err-load-orders', 'خطأ في تحميل الأوامر'), 'error'); return; }
      state.workOrders = r.rows || [];
      state.ordersTotal = r.total || 0;
      state.ordersTotalPages = r.totalPages || 1;
      renderWorkOrders();
      renderOrdersPagination();
    } catch (err) {
      toast('خطأ: ' + err.message, 'error');
    }
  }

  function renderWorkOrders() {
    var rows = state.workOrders;
    var isPending = state.currentTab === 'pending';
    var isInvoiced = state.currentTab === 'invoiced';
    var cols = isPending ? 7 : 5;

    if (rows.length === 0) {
      el.ordersTableBody.innerHTML = '<tr><td colspan="' + cols + '" class="empty-cell">' + I18N.t('hc-orders-empty', 'لا توجد أوامر في هذه الفئة') + '</td></tr>';
      return;
    }

    /* في تاب مفوترة: تجميع الأوامر بحسب الفاتورة المجمعة */
    var displayRows = rows;
    if (isInvoiced) {
      var invoiceMap = {};
      var invoiceOrder = [];
      rows.forEach(function (wo) {
        var key = wo.consolidated_order_id || wo.id;
        if (!invoiceMap[key]) {
          invoiceMap[key] = {
            consolidated_order_id: wo.consolidated_order_id,
            consolidated_invoice_seq: wo.consolidated_invoice_seq,
            created_at: wo.created_at,
            cleaning_date: wo.cleaning_date,
            delivery_date: wo.delivery_date,
            total_amount: Number(wo.consolidated_total_amount || 0),
            payment_method: wo.consolidated_payment_method || 'cash',
            payment_status: wo.consolidated_payment_status || 'paid',
            status: wo.status
          };
          invoiceOrder.push(key);
        }
        /* استخدم أحدث تاريخ */
        if (new Date(wo.created_at) > new Date(invoiceMap[key].created_at)) {
          invoiceMap[key].created_at = wo.created_at;
        }
        if (wo.cleaning_date && (!invoiceMap[key].cleaning_date || new Date(wo.cleaning_date) > new Date(invoiceMap[key].cleaning_date))) {
          invoiceMap[key].cleaning_date = wo.cleaning_date;
        }
        if (wo.delivery_date && (!invoiceMap[key].delivery_date || new Date(wo.delivery_date) > new Date(invoiceMap[key].delivery_date))) {
          invoiceMap[key].delivery_date = wo.delivery_date;
        }
      });
      displayRows = invoiceOrder.map(function (k) { return invoiceMap[k]; });
    }

    el.ordersTableBody.innerHTML = displayRows.map(function (wo) {
      var cbCell = isPending
        ? '<td><input type="checkbox" class="wo-check" data-id="' + wo.id + '" data-subtotal="' + wo.subtotal + '" ' + (state.selectedOrderIds.has(wo.id) ? 'checked' : '') + '/></td>'
        : '';
      var firstCell = isPending
        ? '<strong>' + esc(wo.work_order_number) + '</strong>'
        : isInvoiced
          ? (wo.consolidated_invoice_seq ? '<strong style="color:#6d28d9">' + I18N.t('hc-invoice-label', 'فاتورة #') + wo.consolidated_invoice_seq + '</strong>' : '—')
          : '<strong style="color:#dc2626">' + esc(wo.work_order_number || '—') + '</strong>';
      var actions = '';
      if (isPending) {
        actions = '<button class="btn-action btn-action-green btn-print-wo" data-id="' + wo.id + '">' + I18N.t('hc-btn-print-wo', 'طباعة') + '</button> ' +
                  '<button class="btn-action btn-action-red btn-cancel-wo" data-id="' + wo.id + '" data-num="' + esc(wo.work_order_number) + '">' + I18N.t('hc-btn-cancel-wo', 'إلغاء') + '</button>';
      } else if (isInvoiced) {
        var isDeferred = wo.payment_method === 'deferred' || wo.payment_method === 'credit';
        var isPendingPay = wo.payment_status === 'pending';
        actions = '<button class="btn-action btn-reprint-inv" data-orderid="' + wo.consolidated_order_id + '">' + I18N.t('hc-btn-preview-inv', 'معاينة') + '</button> ' +
                  '<button class="btn-action btn-view-wo-list" data-orderid="' + wo.consolidated_order_id + '" data-invseq="' + (wo.consolidated_invoice_seq || '') + '">' + I18N.t('hc-btn-view-wo-list', 'عرض أوامر التشغيل') + '</button>';
        if (isDeferred && isPendingPay) {
          actions += ' <button class="btn-action btn-action-green btn-settle-deferred" data-orderid="' + wo.consolidated_order_id + '" data-total="' + wo.total_amount + '">' + I18N.t('hc-btn-settle', 'تسوية') + '</button>';
        }
      } else {
        actions = '<button class="btn-action btn-preview-cancelled-wo" data-id="' + wo.id + '">' + I18N.t('hc-btn-view-wo-list', 'معاينة أمر التشغيل') + '</button>';
      }
      return '<tr>' +
        cbCell +
        '<td>' + firstCell + '</td>' +
        '<td dir="ltr" style="text-align:right">' + fmtDateTimeEn(wo.created_at) + '</td>' +
        '<td>' + fmt(wo.total_amount) + ' <span class="sar">&#xE900;</span></td>' +
        (isPending
          ? '<td dir="ltr" style="text-align:right">' + (fmtDateTimeEn(wo.cleaning_date) || '—') + '</td>' +
            '<td dir="ltr" style="text-align:right">' + (fmtDateTimeEn(wo.delivery_date) || '—') + '</td>'
          : '<td>' + (isInvoiced
              ? (wo.payment_status === 'pending'
                  ? '<span class="badge badge-pending">' + I18N.t('hc-status-unpaid', 'غير مدفوعة') + '</span>'
                  : '<span class="badge badge-invoiced">' + I18N.t('hc-status-paid', 'مدفوعة') + '</span>')
              : badge(wo.status)) + '</td>') +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('');

    // Checkboxes
    el.ordersTableBody.querySelectorAll('.wo-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = +cb.dataset.id;
        if (cb.checked) state.selectedOrderIds.add(id);
        else state.selectedOrderIds.delete(id);
        updateSelectAll();
        updateIssueBtn();
        updateTotalPreview();
      });
    });

    // Print work order
    el.ordersTableBody.querySelectorAll('.btn-print-wo').forEach(function (btn) {
      btn.addEventListener('click', function () { printWorkOrderById(+btn.dataset.id); });
    });

    // Cancel
    el.ordersTableBody.querySelectorAll('.btn-cancel-wo').forEach(function (btn) {
      btn.addEventListener('click', function () { openCancelModal(+btn.dataset.id, btn.dataset.num); });
    });

    // Reprint invoice
    el.ordersTableBody.querySelectorAll('.btn-reprint-inv').forEach(function (btn) {
      btn.addEventListener('click', function () { reprintConsolidatedInvoice(+btn.dataset.orderid); });
    });

    // View work orders list for invoiced tab
    el.ordersTableBody.querySelectorAll('.btn-view-wo-list').forEach(function (btn) {
      btn.addEventListener('click', function () { openWoListModal(+btn.dataset.orderid, btn.dataset.invseq); });
    });

    // Settle deferred consolidated invoice
    el.ordersTableBody.querySelectorAll('.btn-settle-deferred').forEach(function (btn) {
      btn.addEventListener('click', function () { openSettleDeferredModal(+btn.dataset.orderid, +btn.dataset.total); });
    });

    // Preview cancelled work order
    el.ordersTableBody.querySelectorAll('.btn-preview-cancelled-wo').forEach(function (btn) {
      btn.addEventListener('click', function () { printWorkOrderById(+btn.dataset.id); });
    });
  }

  function renderOrdersPagination() {
    if (state.ordersTotalPages <= 1) { el.ordersPaginationBar.style.display = 'none'; return; }
    el.ordersPaginationBar.style.display = 'flex';
    var html = '';
    html += '<button class="page-btn" ' + (state.ordersPage <= 1 ? 'disabled' : '') + ' data-page="' + (state.ordersPage - 1) + '">' + I18N.t('hc-pagination-prev', 'السابق') + '</button>';
    for (var i = 1; i <= state.ordersTotalPages; i++) {
      html += '<button class="page-btn' + (i === state.ordersPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" ' + (state.ordersPage >= state.ordersTotalPages ? 'disabled' : '') + ' data-page="' + (state.ordersPage + 1) + '">' + I18N.t('hc-pagination-next', 'التالي') + '</button>';
    el.ordersPaginationBar.innerHTML = html;
    el.ordersPaginationBar.querySelectorAll('.page-btn:not([disabled])').forEach(function (btn) {
      btn.addEventListener('click', function () { loadWorkOrders(+btn.dataset.page); });
    });
  }

  /* ── Select All ── */
  function updateSelectAll() {
    if (!el.selectAllOrders) return;
    var all = el.ordersTableBody.querySelectorAll('.wo-check');
    var checked = el.ordersTableBody.querySelectorAll('.wo-check:checked');
    el.selectAllOrders.checked = all.length > 0 && checked.length === all.length;
    el.selectAllOrders.indeterminate = checked.length > 0 && checked.length < all.length;
  }

  /* ── Issue Invoice button ── */
  function updateIssueBtn() {
    var empty = state.selectedOrderIds.size === 0;
    el.btnIssueInvoice.disabled = empty;
    if (el.btnExportSelectedExcel) el.btnExportSelectedExcel.disabled = empty;
    if (el.btnExportSelectedPdf)   el.btnExportSelectedPdf.disabled   = empty;
    updateTotalPreview();
  }

  function updateTotalPreview() {
    if (state.selectedOrderIds.size === 0) { el.totalPreview.style.display = 'none'; return; }
    var totals = calculateIssueTotals();
    var subtotal = totals.subtotal;
    var disc = totals.discount;
    var total = totals.total;

    el.previewSubtotal.textContent = fmt(subtotal);
    if (disc > 0) {
      el.previewDiscountRow.style.display = '';
      el.previewDiscount.textContent = fmt(disc);
    } else {
      el.previewDiscountRow.style.display = 'none';
    }
    el.previewTotal.textContent = fmt(total);
    el.totalPreview.style.display = 'flex';
  }

  function calculateIssueTotals() {
    var selected = state.workOrders.filter(function (wo) { return state.selectedOrderIds.has(wo.id); });
    var subtotal = selected.reduce(function (s, wo) { return s + Number(wo.subtotal || 0); }, 0);

    var discVal = parseFloat(el.discountValue.value) || 0;
    var discType = el.discountType.value;
    var discount = discType === 'percent' ? subtotal * discVal / 100 : discVal;
    discount = Math.min(discount, subtotal);
    var vatRate = selected.length ? Number(selected[0].vat_rate || 15) : 15;
    var priceMode = selected.length ? (selected[0].price_display_mode || 'exclusive') : 'exclusive';
    var vatAmount = priceMode === 'inclusive'
      ? (subtotal - discount) - ((subtotal - discount) / (1 + vatRate / 100))
      : (subtotal - discount) * vatRate / 100;
    var total = priceMode === 'inclusive' ? (subtotal - discount) : (subtotal - discount + vatAmount);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }

  /* ── Cancel ── */
  function openCancelModal(id, num) {
    state.cancelTargetId = id;
    el.cancelOrderNum.textContent = num;
    el.cancelModal.style.display = 'flex';
  }

  async function doCancel() {
    if (!state.cancelTargetId) return;
    try {
      var r = await window.api.cancelWorkOrder({ workOrderId: state.cancelTargetId });
      if (!r.success) { toast(r.message || I18N.t('hc-err-cancel', 'خطأ في الإلغاء'), 'error'); return; }
      toast(I18N.t('hc-cancel-success', 'تم إلغاء أمر التشغيل بنجاح'), 'success');
      el.cancelModal.style.display = 'none';
      state.cancelTargetId = null;
      loadWorkOrders();
    } catch (err) {
      toast('خطأ: ' + err.message, 'error');
    }
  }

  /* ── Print Work Order by ID ── */
  async function printWorkOrderById(woId) {
    try {
      var r = await window.api.getWorkOrderForPrint({ workOrderId: woId });
      if (!r.success) { toast(r.message || I18N.t('hc-err-load-wo', 'خطأ في تحميل أمر التشغيل'), 'error'); return; }
      showWorkOrderModal(r);
    } catch (err) {
      toast('خطأ: ' + err.message, 'error');
    }
  }

  function showWorkOrderModal(data) {
    var s = state.appSettings || {};
    var sar = '<span class="sar">&#xE900;</span>';

    /* Shop header — same as POS invoice */
    var addressParts = [];
    if (s.buildingNumber) addressParts.push(s.buildingNumber);
    if (s.streetNameAr)   addressParts.push(s.streetNameAr);
    if (s.districtAr)     addressParts.push(s.districtAr);
    if (s.cityAr)         addressParts.push(s.cityAr);
    if (s.postalCode)     addressParts.push(s.postalCode);
    var address = addressParts.length ? addressParts.join('، ') : (s.locationAr || '');
    var shopName = s.laundryNameAr || s.laundryNameEn || '';

    var logoHtml = s.logoDataUrl
      ? '<div class="inv-logo-wrap"><img class="inv-logo" src="' + esc(s.logoDataUrl) + '" style="width:' + (s.logoWidth||180) + 'px;height:' + (s.logoHeight||70) + 'px;max-width:' + (s.logoWidth||180) + 'px;max-height:' + (s.logoHeight||70) + 'px;object-fit:contain" /></div>'
      : '';

    var headerHtml =
      '<div class="inv-header-wrap">' +
        logoHtml +
        '<div class="inv-shop-name">' + esc(shopName) + '</div>' +
        (address ? '<div class="inv-shop-sub">' + esc(address) + '</div>' : '') +
        (s.phone ? '<div class="inv-shop-contact-row"><span class="inv-shop-sub">' + I18N.t('hc-shop-phone-label', 'هاتف:') + ' ' + esc(s.phone) + '</span></div>' : '') +
        (s.vatNumber ? '<div class="inv-shop-contact-row"><span class="inv-shop-sub" dir="ltr">' + I18N.t('hc-shop-vat-label', 'الرقم الضريبي:') + ' ' + esc(s.vatNumber) + '</span></div>' : '') +
        (s.commercialRegister ? '<div class="inv-shop-contact-row"><span class="inv-shop-sub" dir="ltr">' + I18N.t('hc-shop-cr-label', 'السجل التجاري:') + ' ' + esc(s.commercialRegister) + '</span></div>' : '') +
        (s.email && s.showEmailInInvoice !== false ? '<div class="inv-shop-contact-row"><span class="inv-shop-sub">' + esc(s.email) + '</span></div>' : '') +
      '</div>';

    /* Meta info */
    var custName  = data.customer_name  || '';
    var custPhone = data.customer_phone || '';
    var custVat   = data.customer_tax_number || '';
    var d = data.created_at ? new Date(data.created_at) : new Date();
    var dateStr = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    var cleanedStr = fmtDateTimeEn(data.cleaning_date) || '—';
    var deliveredStr = fmtDateTimeEn(data.delivery_date) || '—';

    var infoGrid =
      '<div class="cr-info-grid">' +
        '<div class="cr-info-cell"><span class="cr-info-label">' + I18N.t('hc-wo-label-order-num', 'رقم الأمر') + '</span><span class="cr-info-val" dir="ltr">' + esc(data.work_order_number || '') + '</span></div>' +
        '<div class="cr-info-cell"><span class="cr-info-label">' + I18N.t('hc-wo-label-date', 'التاريخ') + '</span><span class="cr-info-val" dir="ltr">' + dateStr + '</span></div>' +
        '<div class="cr-info-cell"><span class="cr-info-label">' + I18N.t('hc-wo-label-cleaning', 'تاريخ التنظيف') + '</span><span class="cr-info-val" dir="ltr">' + cleanedStr + '</span></div>' +
        '<div class="cr-info-cell"><span class="cr-info-label">' + I18N.t('hc-wo-label-delivery', 'تاريخ التسليم') + '</span><span class="cr-info-val" dir="ltr">' + deliveredStr + '</span></div>' +
        (custName  ? '<div class="cr-info-cell"><span class="cr-info-label">' + I18N.t('hc-wo-label-customer', 'العميل') + '</span><span class="cr-info-val">' + esc(custName) + '</span></div>' : '') +
        (custPhone ? '<div class="cr-info-cell"><span class="cr-info-label">' + I18N.t('hc-wo-label-phone', 'الجوال') + '</span><span class="cr-info-val" dir="ltr">' + esc(custPhone) + '</span></div>' : '') +
        (custVat   ? '<div class="cr-info-cell"><span class="cr-info-label">' + I18N.t('hc-wo-label-vat', 'الرقم الضريبي') + '</span><span class="cr-info-val" dir="ltr">' + esc(custVat) + '</span></div>' : '') +
      '</div>';

    /* Items table — same column order as POS invoice: النوع، عدد، الإجمالي، العملية */
    var itemRows = (data.items || []).map(function (it) {
      var nameAr  = esc(it.product_name || '');
      var svcAr   = esc(it.service_name  || '');
      var merzam  = it.merzam_type_name ? esc(it.merzam_type_name) : '';
      var qty = parseFloat(it.quantity) % 1 === 0 ? parseInt(it.quantity) : parseFloat(it.quantity).toFixed(2);
      var serviceCell = svcAr + (merzam ? '<span class="inv-td-merzam">' + merzam + '</span>' : '');
      return '<tr>' +
        '<td class="inv-td-name">' + nameAr + '</td>' +
        '<td class="inv-td-num">' + qty + '</td>' +
        '<td class="inv-td-amt" dir="ltr">' + fmt(it.line_total) + '</td>' +
        '<td class="inv-td-name">' + (svcAr || merzam ? serviceCell : '—') + '</td>' +
        '</tr>';
    }).join('');

    var tableHtml =
      '<table class="inv-table" style="margin-top:4px">' +
        '<thead><tr>' +
          '<th class="inv-th-name">' + I18N.t('hc-wo-th-type', 'النوع') + '</th>' +
          '<th class="inv-th-num">' + I18N.t('hc-wo-th-qty', 'عدد') + '</th>' +
          '<th class="inv-th-num">' + I18N.t('hc-wo-th-total', 'الإجمالي') + '</th>' +
          '<th class="inv-th-name">' + I18N.t('hc-wo-th-service', 'العملية') + '</th>' +
        '</tr></thead>' +
        '<tbody>' + itemRows + '</tbody>' +
      '</table>';

    /* Totals */
    var vatAmount  = parseFloat(data.vat_amount  || 0);
    var vatRate    = parseFloat(data.vat_rate    || 15);
    var total      = parseFloat(data.total_amount || 0);
    var subtotal   = vatAmount > 0 ? (total - vatAmount) : parseFloat(data.subtotal || total);

    var totalsHtml = '<div class="inv-totals-box">';
    if (vatAmount > 0) {
      totalsHtml += '<div class="inv-total-row"><span class="inv-total-label">' + I18N.t('invoice-subtotal-before-tax', 'المجموع قبل الضريبة') + '</span><span class="inv-total-val" dir="ltr">' + sar + ' ' + subtotal.toFixed(2) + '</span></div>';
      totalsHtml += '<div class="inv-total-row"><span class="inv-total-label">' + I18N.t('invoice-vat-label', 'ضريبة القيمة المضافة') + ' (' + vatRate + '%)</span><span class="inv-total-val" dir="ltr">' + sar + ' ' + vatAmount.toFixed(2) + '</span></div>';
    }
    totalsHtml += '<div class="inv-total-row inv-grand-row"><span class="inv-grand-label">' + I18N.t('invoice-total', 'الإجمالي') + '</span><span class="inv-grand-val" dir="ltr">' + sar + ' ' + total.toFixed(2) + '</span></div>';
    totalsHtml += '</div>';

    /* Footer notes */
    var footerHtml = s.invoiceFooterNotes
      ? '<div class="inv-notes-box"><span class="inv-notes-title">' + I18N.t('hc-footer-terms', 'الشروط والأحكام (Terms):') + '</span><span class="inv-notes-content">' + esc(s.invoiceFooterNotes) + '</span></div>'
      : '';

    var woNumber = data.work_order_number || '';
    var barcodeHtml = woNumber ? '<div class="inv-barcode-wrap"><svg id="woHcBarcode"></svg></div>' : '';

    var html = headerHtml +
      '<div class="inv-divider-thick inv-sep"></div>' +
      '<div class="inv-meta-row" style="justify-content:center"><span class="inv-meta-label" style="color:' + (data.status === 'cancelled' ? '#dc2626' : '#000') + ';font-weight:800">' + (data.status === 'cancelled' ? I18N.t('hc-wo-type-cancelled', 'أمر تشغيل مرتجع') : I18N.t('hc-wo-type', 'أمر تشغيل')) + '</span></div>' +
      infoGrid + tableHtml + totalsHtml + barcodeHtml + footerHtml;

    var paper = document.getElementById('woModalPaper');
    paper.innerHTML = html;

    /* Barcode */
    if (woNumber && typeof JsBarcode !== 'undefined') {
      try {
        JsBarcode(document.getElementById('woHcBarcode'), woNumber, {
          format: 'CODE128', width: 1.5, height: 36,
          displayValue: true, fontSize: 9, margin: 2,
          font: 'Cairo', textAlign: 'center'
        });
      } catch (_) {}
    }

    var modal = document.getElementById('workOrderModal');
    modal.style.display = 'flex';

    document.getElementById('btnWoModalClose').onclick = function () { modal.style.display = 'none'; };
    modal.onclick = function (e) { if (e.target === modal) modal.style.display = 'none'; };

    /* WhatsApp button — check live connection status */
    var btnWoWa = document.getElementById('btnWoModalWhatsapp');
    if (btnWoWa) {
      btnWoWa.style.display = 'none';
      window.api.whatsappGetStatus().then(function (ws) {
        if (ws && (ws.status === 'connected' || ws.status === 'ready' || ws.status === 'open')) {
          btnWoWa.style.display = '';
        }
      }).catch(function () {});
      btnWoWa.onclick = async function () {
        var phone = data.customer_phone || '';
        if (!phone) { toast(I18N.t('hc-no-phone', 'لا يوجد رقم جوال للعميل'), 'error'); return; }
        var paperEl = document.getElementById('woModalPaper');
        if (!paperEl) return;
        try {
          btnWoWa.disabled = true;
          var r = await window.api.whatsappSendInvoicePdfFromHtml({
            html: paperEl.outerHTML,
            paperType: 'thermal',
            phone: phone,
            orderNum: woNumber,
            zatcaPayload: null
          });
          if (r && r.success) toast(I18N.t('hc-wa-wo-success', 'تم إرسال أمر التشغيل عبر الواتساب'), 'success');
          else toast((r && r.message) || I18N.t('hc-wa-fail', 'فشل إرسال الواتساب'), 'error');
        } catch (_) { toast(I18N.t('hc-wa-err', 'خطأ في إرسال الواتساب'), 'error'); }
        btnWoWa.disabled = false;
      };
    }

    /* PDF export button */
    var btnWoPdf = document.getElementById('btnWoModalExportPdf');
    if (btnWoPdf) {
      var pdfIconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg>';
      btnWoPdf.onclick = async function () {
        var paperEl = document.getElementById('woModalPaper');
        if (!paperEl) { toast(I18N.t('hc-content-not-found', 'لم يتم العثور على المحتوى'), 'error'); return; }
        try {
          btnWoPdf.disabled = true;
          btnWoPdf.innerHTML = '<span>' + I18N.t('hc-exporting', 'جارٍ التصدير...') + '</span>';
          var result = await window.api.exportInvoicePdfFromHtml({ html: paperEl.outerHTML, paperType: 'thermal', orderNum: woNumber });
          if (result.success) toast(I18N.t('hc-pdf-success', 'تم تنزيل ملف PDF بنجاح'), 'success');
          else toast(result.message || I18N.t('hc-pdf-fail', 'فشل تصدير PDF'), 'error');
        } catch (_) { toast(I18N.t('hc-pdf-err', 'خطأ في تصدير PDF'), 'error'); }
        btnWoPdf.disabled = false;
        btnWoPdf.innerHTML = pdfIconHtml + '<span>' + I18N.t('hc-btn-export-pdf', 'تصدير PDF') + '</span>';
      };
    }

    document.getElementById('btnWoModalPrint').onclick = function () {
      var mLeft  = parseFloat((s.thermalMarginLeft)  || 0) || 0;
      var mRight = parseFloat((s.thermalMarginRight) || 0) || 0;
      var shift  = mLeft - mRight;
      var styleEl = document.createElement('style');
      styleEl.id = 'woPrintPageStyle';
      styleEl.textContent = '@page { size: 80mm auto; margin: 0; }' +
        (shift !== 0 ? ' @media print { .inv-paper { transform: translateX(' + shift + 'mm) !important; } }' : '');
      document.head.appendChild(styleEl);
      el.woPrintZone.innerHTML = paper.outerHTML;
      document.body.classList.add('printing');
      var handled = false;
      function onAP() {
        if (handled) return;
        handled = true;
        window.removeEventListener('afterprint', onAP);
        el.woPrintZone.innerHTML = '';
        document.body.classList.remove('printing');
        if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      }
      window.addEventListener('afterprint', onAP);
      window.print();
      setTimeout(onAP, 2500);
    };
  }

  /* ── Settle Deferred Consolidated Invoice ── */
  function openSettleDeferredModal(orderId, total) {
    var method = el.paymentMethodSelect ? normalizePaymentMethod(el.paymentMethodSelect.value) : 'cash';
    if (method === 'mixed') {
      el.mixedPaymentModal.dataset.settleOrderId = String(orderId);
      el.mixedPaymentModal.dataset.total = String(total);
      el.mixedPaymentModal.dataset.confirmNoVat = '1';
      el.mixedTotalAmount.textContent = fmt(total);
      el.mixedCashAmount.value = '';
      el.mixedCardAmount.textContent = fmt(total);
      if (el.mixedPaymentError) el.mixedPaymentError.style.display = 'none';
      el.mixedPaymentModal.dataset.mode = 'settle';
      el.mixedPaymentModal.style.display = 'flex';
      setTimeout(function () { if (el.mixedCashAmount) el.mixedCashAmount.focus(); }, 50);
    } else {
      var cash = method === 'cash' ? total : 0;
      var card = method !== 'cash' ? total : 0;
      settleDeferredInvoice(orderId, method, cash, card);
    }
  }

  async function settleDeferredInvoice(orderId, paymentMethod, paidCash, paidCard) {
    try {
      var r = await window.api.settleConsolidatedInvoice({ orderId: orderId, paymentMethod: paymentMethod, paidCash: paidCash, paidCard: paidCard });
      if (!r.success) { toast(r.message || I18N.t('hc-settle-err', 'خطأ في التسوية'), 'error'); return; }
      toast(I18N.t('hc-settle-success', 'تمت تسوية الفاتورة بنجاح'), 'success');
      await loadWorkOrders();
    } catch (err) {
      toast('خطأ: ' + err.message, 'error');
    }
  }

  /* ── Issue Consolidated Invoice ── */
  function updateMixedPaymentPreview() {
    if (!el.mixedCashAmount || !el.mixedCardAmount) return;
    var total = Number((el.mixedPaymentModal && el.mixedPaymentModal.dataset.total) || 0);
    var cash = parseFloat(el.mixedCashAmount.value) || 0;
    if (cash < 0) cash = 0;
    if (cash > total) cash = total;
    el.mixedCardAmount.textContent = fmt(Math.max(0, total - cash));
    if (el.mixedPaymentError) el.mixedPaymentError.style.display = 'none';
  }

  function openMixedPaymentModal(confirmNoVat) {
    var total = Number(calculateIssueTotals().total || 0);
    if (!el.mixedPaymentModal || total <= 0) {
      issueConsolidatedInvoice(confirmNoVat, { paidCash: 0, paidCard: total });
      return;
    }
    el.mixedPaymentModal.dataset.total = String(total);
    el.mixedPaymentModal.dataset.confirmNoVat = confirmNoVat ? '1' : '0';
    el.mixedPaymentModal.dataset.mode = 'issue';
    el.mixedTotalAmount.textContent = fmt(total);
    el.mixedCashAmount.value = '';
    el.mixedCardAmount.textContent = fmt(total);
    if (el.mixedPaymentError) el.mixedPaymentError.style.display = 'none';
    el.mixedPaymentModal.style.display = 'flex';
    setTimeout(function () { if (el.mixedCashAmount) el.mixedCashAmount.focus(); }, 50);
  }

  function confirmMixedPayment() {
    var total = Number((el.mixedPaymentModal && el.mixedPaymentModal.dataset.total) || 0);
    var cash = parseFloat(el.mixedCashAmount && el.mixedCashAmount.value) || 0;
    cash = Math.round(cash * 100) / 100;
    if (cash <= 0 || cash > total) {
      if (el.mixedPaymentError) {
        el.mixedPaymentError.textContent = I18N.t('hc-mixed-cash-err', 'أدخل مبلغ كاش أكبر من صفر ولا يتجاوز الإجمالي');
        el.mixedPaymentError.style.display = '';
      }
      return;
    }
    var card = Math.max(0, Math.round((total - cash) * 100) / 100);
    var mode = el.mixedPaymentModal.dataset.mode || 'issue';
    el.mixedPaymentModal.style.display = 'none';
    if (mode === 'settle') {
      var orderId = +el.mixedPaymentModal.dataset.settleOrderId;
      settleDeferredInvoice(orderId, 'mixed', cash, card);
    } else {
      issueConsolidatedInvoice(el.mixedPaymentModal.dataset.confirmNoVat === '1', { paidCash: cash, paidCard: card });
    }
  }

  async function issueConsolidatedInvoice(confirmNoVat, mixedPayment) {
    var cust = state.selectedCustomer;
    if (!cust || state.selectedOrderIds.size === 0) { toast(I18N.t('hc-issue-no-orders', 'لم يتم تحديد أوامر تشغيل'), 'error'); return; }

    if (!confirmNoVat && cust && !cust.tax_number) {
      el.vatConfirmCustomerName.textContent = cust.customer_name;
      el.vatConfirmModal.style.display = 'flex';
      return;
    }

    var selectedPaymentMethod = normalizePaymentMethod(el.paymentMethodSelect ? el.paymentMethodSelect.value : 'cash');

    if (selectedPaymentMethod === 'mixed' && !mixedPayment) {
      openMixedPaymentModal(confirmNoVat);
      return;
    }

    var discVal = parseFloat(el.discountValue.value) || 0;
    var discType = el.discountType.value;

    var payload = {
      workOrderIds: Array.from(state.selectedOrderIds),
      discountAmount: discType === 'fixed' ? discVal : null,
      discountPercent: discType === 'percent' ? discVal : null,
      paymentMethod: selectedPaymentMethod,
      paidCash: mixedPayment ? mixedPayment.paidCash : 0,
      paidCard: mixedPayment ? mixedPayment.paidCard : 0,
      confirmNoVat: confirmNoVat || false
    };
    state.pendingIssuePayload = payload;

    try {
      el.btnIssueInvoice.disabled = true;
      var r = await window.api.createConsolidatedInvoice(payload);
      if (!r.success) {
        if (r.code === 'NEEDS_VAT_CONFIRM') {
          el.vatConfirmCustomerName.textContent = cust.customer_name;
          el.vatConfirmModal.style.display = 'flex';
          el.btnIssueInvoice.disabled = state.selectedOrderIds.size === 0;
          return;
        }
        toast(r.message || I18N.t('hc-issue-err', 'خطأ في إصدار الفاتورة'), 'error');
        el.btnIssueInvoice.disabled = state.selectedOrderIds.size === 0;
        return;
      }

      toast('تم إصدار الفاتورة المجمعة بنجاح (#' + r.invoiceSeq + ')', 'success');
      el.vatConfirmModal.style.display = 'none';
      state.selectedOrderIds = new Set();
      el.discountValue.value = '';
      fillPaymentMethodOptions();

      // Open consolidated A4 invoice
      await openConsolidatedInvoiceA4(r.orderId);

      setActiveTab('invoiced');
    } catch (err) {
      toast('خطأ: ' + err.message, 'error');
      el.btnIssueInvoice.disabled = state.selectedOrderIds.size === 0;
    }
  }

  /* ── A4 Modal helpers ── */
  function hca4Set(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val || '';
  }
  function hca4Html(id, val) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = val || '';
  }
  function hca4Show(id, show) {
    var el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  }

  function fillHcA4Modal(data) {
    var s = data.settings || {};
    var sar = '<span class="sar" style="font-family:SaudiRiyal"></span>';

    /* بيانات المتجر */
    hca4Set('hca4ShopNameAr',    s.laundryNameAr || '');
    hca4Set('hca4ShopAddressAr', data.addressAr || '');
    hca4Set('hca4ShopPhoneAr',   s.phone ? 'جوال: ' + s.phone : '');
    hca4Set('hca4VatAr',         s.vatNumber ? 'الرقم الضريبي: ' + s.vatNumber : '');
    hca4Set('hca4CrAr',          s.commercialRegister ? 'س.ت: ' + s.commercialRegister : '');
    hca4Set('hca4ShopNameEn',    s.laundryNameEn || '');
    hca4Set('hca4ShopAddressEn', data.addressEn || '');
    hca4Set('hca4ShopEmail',     s.email || '');
    hca4Set('hca4VatEn',         s.vatNumber ? 'VAT No: ' + s.vatNumber : '');
    hca4Set('hca4CrEn',          s.commercialRegister ? 'CR No: ' + s.commercialRegister : '');

    /* لوجو */
    var logoEl = document.getElementById('hca4Logo');
    if (logoEl) {
      if (s.logoDataUrl) {
        logoEl.src = s.logoDataUrl;
        logoEl.style.maxWidth  = (s.logoWidth  || 80) + 'px';
        logoEl.style.maxHeight = (s.logoHeight || 60) + 'px';
        logoEl.style.display   = '';
      } else {
        logoEl.style.display = 'none';
      }
    }

    /* العنوان */
    var hasCustVat = !!(data.custVat);
    hca4Set('hca4TitleAr', hasCustVat ? 'فاتورة ضريبية'        : 'فاتورة ضريبية مبسطة');
    hca4Set('hca4TitleEn', hasCustVat ? 'Tax Invoice'           : 'Simplified Tax Invoice');

    /* ميتا */
    hca4Set('hca4OrderNum',   data.orderNum);
    hca4Set('hca4Date',       data.date);
    hca4Set('hca4Payment',    data.payment || '');
    hca4Set('hca4PaidAt',     data.date);
    hca4Set('hca4CleanedAt',  data.date);
    hca4Set('hca4DeliveredAt', data.date);

    /* بيانات العميل */
    hca4Set('hca4CustName',  data.custName  || '—');
    hca4Set('hca4CustPhone', data.custPhone || '—');
    if (hasCustVat) {
      hca4Set('hca4CustVat', data.custVat);
      hca4Show('hca4CustVatRow', true);
    } else {
      hca4Show('hca4CustVatRow', false);
    }

    /* البنود — تجميع نفس المنتج + نفس العملية في صف واحد */
    var vatRate   = data.vatRate || 0;
    var priceMode = data.priceDisplayMode || 'exclusive';
    var groupedItems = [];
    var groupMap = {};
    (data.items || []).forEach(function (it) {
      var key = (it.productAr || '') + '||' + (it.serviceAr || '') + '||' + (it.merzam || '');
      if (groupMap[key] !== undefined) {
        var g = groupedItems[groupMap[key]];
        g.qty = (Number(g.qty) || 0) + (Number(it.qty) || 1);
        g.lineTotal = (Number(g.lineTotal) || 0) + (Number(it.lineTotal) || 0);
      } else {
        groupMap[key] = groupedItems.length;
        groupedItems.push({
          productAr: it.productAr, productEn: it.productEn,
          serviceAr: it.serviceAr, serviceEn: it.serviceEn,
          merzam: it.merzam,
          qty: Number(it.qty) || 1,
          unitPrice: it.unitPrice,
          lineTotal: Number(it.lineTotal) || 0
        });
      }
    });
    var computedSubtotal = 0;
    var itemsHtml = groupedItems.map(function (it, i) {
      var lineTotal = Number(it.lineTotal || 0);
      var net, itemVat, gross;
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
      computedSubtotal += net;

      var nameCell = esc(it.productAr || '');
      if (it.productEn && it.productEn !== it.productAr) {
        nameCell += '<span class="a4m-td-en">' + esc(it.productEn) + '</span>';
      }
      var svcCell = esc(it.serviceAr || '—');
      if (it.serviceEn && it.serviceEn !== it.serviceAr) {
        svcCell += '<span class="a4m-td-en">' + esc(it.serviceEn) + '</span>';
      }
      if (it.merzam) svcCell += '<span class="a4m-td-merzam">' + esc(it.merzam) + '</span>';
      return '<tr>' +
        '<td class="a4m-td-num">' + (i + 1) + '</td>' +
        '<td class="a4m-td-name">' + nameCell + '</td>' +
        '<td class="a4m-td-name">' + svcCell  + '</td>' +
        '<td class="a4m-td-num">' + (it.qty || 1) + '</td>' +
        '<td class="a4m-td-num">' + Number(it.unitPrice || 0).toFixed(2) + '</td>' +
        '<td class="a4m-td-num">' + net.toFixed(2)   + '</td>' +
        '<td class="a4m-td-num">' + itemVat.toFixed(2) + '</td>' +
        '<td class="a4m-td-num">' + gross.toFixed(2)  + '</td>' +
        '</tr>';
    }).join('');
    hca4Html('hca4ItemsTbody', itemsHtml);

    /* الإجماليات */
    hca4Html('hca4Subtotal', sar + ' ' + computedSubtotal.toFixed(2));
    if (data.discount > 0) {
      var discPct = computedSubtotal > 0 ? (data.discount / computedSubtotal * 100) : 0;
      var discPctStr = discPct > 0 ? (parseFloat(discPct.toFixed(1)) + '%') : '';
      var discLabelEl = document.getElementById('hca4DiscRow');
      if (discLabelEl) {
        var discLabelSpan = discLabelEl.querySelector('span');
        if (discLabelSpan) discLabelSpan.textContent = discPctStr
          ? 'الخصم (' + discPctStr + ') / Discount'
          : 'الخصم / Discount';
      }
      hca4Html('hca4Discount', sar + ' ' + Number(data.discount).toFixed(2));
      hca4Show('hca4DiscRow', true);
    } else {
      hca4Show('hca4DiscRow', false);
    }
    if (vatRate > 0) {
      hca4Set('hca4VatLabel', 'ضريبة القيمة المضافة (' + vatRate + '%) / VAT');
      hca4Html('hca4Vat', sar + ' ' + Number(data.vatAmount || 0).toFixed(2));
      hca4Show('hca4VatRow', true);
      hca4Set('hca4SubtotalLabel', 'المجموع قبل الضريبة / Subtotal');
      hca4Set('hca4TotalLabel',    'الإجمالي شامل الضريبة / Grand Total');
    } else {
      hca4Show('hca4VatRow', false);
      hca4Set('hca4SubtotalLabel', 'المجموع / Subtotal');
      hca4Set('hca4TotalLabel',    'الإجمالي / Total');
    }
    hca4Html('hca4Total', sar + ' ' + Number(data.total || 0).toFixed(2));

    var paidCash = Number(data.paidCash || 0);
    var paidCard = Number(data.paidCard || 0);
    var isDeferred = data.paymentMethod === 'deferred' || data.paymentMethod === 'credit';
    if ((paidCash > 0 || paidCard > 0) && data.paymentMethod === 'mixed') {
      hca4Html('hca4MixedCash', sar + ' ' + paidCash.toFixed(2));
      hca4Html('hca4MixedCard', sar + ' ' + paidCard.toFixed(2));
      hca4Show('hca4MixedCashRow', true);
      hca4Show('hca4MixedCardRow', true);
      hca4Show('hca4DeferredPaidRow', false);
      hca4Show('hca4DeferredRemainingRow', false);
    } else if (isDeferred) {
      hca4Html('hca4DeferredPaid', sar + ' 0.00');
      hca4Html('hca4DeferredRemaining', sar + ' ' + Number(data.total || 0).toFixed(2));
      hca4Show('hca4DeferredPaidRow', true);
      hca4Show('hca4DeferredRemainingRow', true);
      hca4Show('hca4MixedCashRow', false);
      hca4Show('hca4MixedCardRow', false);
    } else {
      hca4Show('hca4MixedCashRow', false);
      hca4Show('hca4MixedCardRow', false);
      hca4Show('hca4DeferredPaidRow', false);
      hca4Show('hca4DeferredRemainingRow', false);
    }

    /* ملاحظات التذييل */
    if (s.invoiceFooterNotes) {
      hca4Set('hca4NotesContent', s.invoiceFooterNotes);
      hca4Show('hca4FooterNotes', true);
    } else {
      hca4Show('hca4FooterNotes', false);
    }

    /* QR */
    var qrEl = document.getElementById('hca4QR');
    if (qrEl) qrEl.innerHTML = '';
    if (data.qrPayload && qrEl && window.api) {
      window.api.generateZatcaQR(data.qrPayload)
        .then(function (res) { if (res && res.success && res.svg) qrEl.innerHTML = res.svg; })
        .catch(function () {});
    }
  }

  async function openConsolidatedInvoiceA4(orderId) {
    try {
      var r = await window.api.getConsolidatedInvoiceForPrint({ orderId: orderId });
      if (!r.success) { toast(r.message || I18N.t('hc-invoice-load-err', 'خطأ في تحميل بيانات الفاتورة'), 'error'); return; }
      var inv = r.invoice;
      var s   = state.appSettings || {};

      var woLines = (inv.workOrders || []).map(function (wo) {
        return { num: wo.work_order_number, date: fmtDate(wo.created_at), total: fmt(wo.total_amount) };
      });

      /* عنوان المتجر */
      var arParts = [];
      if (s.buildingNumber) arParts.push(s.buildingNumber);
      if (s.streetNameAr)   arParts.push(s.streetNameAr);
      if (s.districtAr)     arParts.push(s.districtAr);
      if (s.cityAr)         arParts.push(s.cityAr);
      if (s.postalCode)     arParts.push(s.postalCode);
      var addressAr = arParts.length ? arParts.join('، ') : (s.locationAr || '');

      var enParts = [];
      if (s.buildingNumber) enParts.push(s.buildingNumber);
      if (s.streetNameEn)   enParts.push(s.streetNameEn);
      if (s.districtEn)     enParts.push(s.districtEn);
      if (s.cityEn)         enParts.push(s.cityEn);
      if (s.postalCode)     enParts.push(s.postalCode);
      var addressEn = enParts.length ? enParts.join(', ') : (s.locationEn || '');

      /* QR payload */
      var vatRate = parseFloat(inv.vat_rate || 15);
      var qrPayload = null;
      if (vatRate > 0) {
        if (inv.zatca_qr) {
          qrPayload = { tlvBase64: inv.zatca_qr };
        } else if (s.vatNumber) {
          var ts = inv.created_at ? new Date(inv.created_at).toISOString() : new Date().toISOString();
          qrPayload = {
            sellerName:  s.laundryNameAr || '',
            vatNumber:   s.vatNumber     || '',
            timestamp:   ts,
            totalAmount: parseFloat(inv.total_amount || 0).toFixed(2),
            vatAmount:   parseFloat(inv.vat_amount   || 0).toFixed(2)
          };
        }
      }

      var modalData = {
        settings:        s,
        addressAr:       addressAr,
        addressEn:       addressEn,
        orderNum:        inv.invoice_seq ? String(inv.invoice_seq) : inv.order_number,
        date:            fmtDateTimeEn(inv.created_at),
        payment:         paymentLabelAr(inv.payment_method),
        paymentMethod:   inv.payment_method || 'cash',
        paidCash:        parseFloat(inv.paid_cash || 0),
        paidCard:        parseFloat(inv.paid_card || 0),
        custName:        inv.customer_name       || '',
        custVat:         inv.customer_tax_number || '',
        custPhone:       inv.customer_phone      || '',
        discount:        parseFloat(inv.discount_amount || 0),
        vatRate:         vatRate,
        vatAmount:       parseFloat(inv.vat_amount      || 0),
        total:           parseFloat(inv.total_amount    || 0),
        priceDisplayMode: inv.price_display_mode || 'exclusive',
        qrPayload:       qrPayload,
        items: (inv.orderItems || []).map(function (oi) {
          return {
            productAr: oi.product_name    || '',
            productEn: oi.product_name_en || oi.product_name || '',
            serviceAr: oi.service_name    || '—',
            serviceEn: oi.service_name_en || oi.service_name || '',
            merzam:    oi.merzam_type_name || '',
            qty:       oi.quantity,
            unitPrice: parseFloat(oi.unit_price || 0),
            lineTotal: parseFloat(oi.line_total || 0)
          };
        })
      };

      fillHcA4Modal(modalData);
      showHcA4Modal(modalData);
    } catch (err) {
      toast(I18N.t('hc-open-invoice-err', 'خطأ في فتح الفاتورة:') + ' ' + err.message, 'error');
    }
  }

  function showHcA4Modal(modalData) {
    var modal = document.getElementById('hcA4Modal');
    if (!modal) return;
    modal.style.display = 'flex';

    /* إغلاق */
    document.getElementById('hcA4BtnClose').onclick = function () { modal.style.display = 'none'; };
    modal.onclick = function (e) { if (e.target === modal) modal.style.display = 'none'; };

    /* طباعة A4 */
    document.getElementById('hcA4BtnPrint').onclick = function () {
      var printZone = document.getElementById('hcA4PrintZone');
      var paper = document.getElementById('hcA4Paper');
      if (!printZone || !paper) return;
      printZone.innerHTML = paper.outerHTML;
      printZone.style.display = 'block';
      document.body.classList.add('hc-print-a4');
      var handled = false;
      function onAP() {
        if (handled) return; handled = true;
        window.removeEventListener('afterprint', onAP);
        printZone.innerHTML = '';
        printZone.style.display = 'none';
        document.body.classList.remove('hc-print-a4');
      }
      window.addEventListener('afterprint', onAP);
      window.print();
      setTimeout(onAP, 3000);
    };

    /* تصدير PDF */
    var btnPdf = document.getElementById('hcA4BtnPdf');
    var pdfIcon = btnPdf ? btnPdf.innerHTML : '';
    if (btnPdf) {
      btnPdf.onclick = async function () {
        var paper = document.getElementById('hcA4Paper');
        if (!paper) return;
        try {
          btnPdf.disabled = true;
          btnPdf.textContent = I18N.t('hc-exporting', 'جارٍ التصدير...');
          var res = await window.api.exportInvoicePdfFromHtml({
            html: paper.outerHTML,
            paperType: 'a4',
            orderNum: modalData.orderNum
          });
          if (res && res.success) toast(I18N.t('hc-pdf-success', 'تم تنزيل ملف PDF بنجاح'), 'success');
          else toast((res && res.message) || I18N.t('hc-pdf-fail', 'فشل تصدير PDF'), 'error');
        } catch (_) { toast(I18N.t('hc-pdf-err', 'خطأ في تصدير PDF'), 'error'); }
        btnPdf.disabled = false;
        btnPdf.innerHTML = pdfIcon;
      };
    }

    /* واتساب */
    var btnWa = document.getElementById('hcA4BtnWhatsapp');
    if (btnWa) {
      btnWa.style.display = 'none';
      window.api.whatsappGetStatus().then(function (ws) {
        if (ws && (ws.status === 'connected' || ws.status === 'ready' || ws.status === 'open')) {
          btnWa.style.display = '';
        }
      }).catch(function () {});
      btnWa.onclick = async function () {
        var phone = modalData.custPhone || '';
        if (!phone) { toast(I18N.t('hc-no-phone', 'لا يوجد رقم جوال للعميل'), 'error'); return; }
        var paper = document.getElementById('hcA4Paper');
        if (!paper) return;
        try {
          btnWa.disabled = true;
          var res = await window.api.whatsappSendInvoicePdfFromHtml({
            html: paper.outerHTML, paperType: 'a4',
            phone: phone, orderNum: modalData.orderNum, zatcaPayload: modalData.qrPayload || null
          });
          if (res && res.success) toast(I18N.t('hc-wa-inv-success', 'تم إرسال الفاتورة عبر الواتساب'), 'success');
          else toast((res && res.message) || I18N.t('hc-wa-fail', 'فشل إرسال الواتساب'), 'error');
        } catch (_) { toast(I18N.t('hc-wa-err', 'خطأ في إرسال الواتساب'), 'error'); }
        btnWa.disabled = false;
      };
    }
  }

  /* ── Work Orders List Modal ── */
  async function openWoListModal(orderId, invSeq) {
    if (!orderId) return;
    try {
      var r = await window.api.getConsolidatedInvoiceForPrint({ orderId: orderId });
      if (!r.success) { toast(r.message || I18N.t('hc-invoice-load-err', 'خطأ في تحميل بيانات الفاتورة'), 'error'); return; }

      var workOrders = r.invoice.workOrders || [];
      var invNum = invSeq || (r.invoice.invoice_seq || r.invoice.order_number || '');

      document.getElementById('woListInvoiceNum').textContent = '#' + invNum;

      var tbody = document.getElementById('woListTableBody');
      if (workOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">' + I18N.t('hc-wo-list-empty', 'لا توجد أوامر تشغيل') + '</td></tr>';
      } else {
        tbody.innerHTML = workOrders.map(function (wo) {
          return '<tr>' +
            '<td><strong>' + esc(wo.work_order_number) + '</strong></td>' +
            '<td dir="ltr" style="text-align:right">' + fmtDateTimeEn(wo.created_at) + '</td>' +
            '<td>' + fmt(wo.total_amount) + ' <span class="sar">&#xE900;</span></td>' +
            '<td><button class="btn-action btn-action-green btn-wo-list-print" data-id="' + wo.id + '">' + I18N.t('hc-btn-view', 'عرض') + '</button></td>' +
            '</tr>';
        }).join('');

        tbody.querySelectorAll('.btn-wo-list-print').forEach(function (btn) {
          btn.addEventListener('click', function () { printWorkOrderById(+btn.dataset.id); });
        });
      }

      var modal = document.getElementById('woListModal');
      modal.style.display = 'flex';

      document.getElementById('btnWoListClose').onclick = function () { modal.style.display = 'none'; };
      modal.onclick = function (e) { if (e.target === modal) modal.style.display = 'none'; };

      /* بناء payload التصدير */
      var s = state.appSettings || {};
      var arParts = [];
      if (s.buildingNumber) arParts.push(s.buildingNumber);
      if (s.streetNameAr)   arParts.push(s.streetNameAr);
      if (s.districtAr)     arParts.push(s.districtAr);
      if (s.cityAr)         arParts.push(s.cityAr);
      if (s.postalCode)     arParts.push(s.postalCode);
      var exportPayload = {
        invoiceNum:  invNum,
        custName:    r.invoice.customer_name       || '',
        custPhone:   r.invoice.customer_phone      || '',
        custVat:     r.invoice.customer_tax_number || '',
        shopNameAr:  s.laundryNameAr  || '',
        shopNameEn:  s.laundryNameEn  || '',
        shopPhone:   s.phone          || '',
        vatNumber:   s.vatNumber      || '',
        addressAr:   arParts.join('، '),
        logoB64:     s.logoDataUrl    || '',
        vatRate:     parseFloat(r.invoice.vat_rate || 15),
        priceMode:   r.invoice.price_display_mode || 'exclusive',
        workOrders:  workOrders.map(function (wo) {
          return {
            work_order_number: wo.work_order_number,
            created_at:        wo.created_at,
            total_amount:      wo.total_amount,
            items: (wo.items || []).map(function (it) {
              return {
                product_name:    it.product_name    || '',
                service_name:    it.service_name    || '',
                merzam_type_name: it.merzam_type_name || '',
                quantity:        it.quantity,
                unit_price:      it.unit_price,
                line_total:      it.line_total
              };
            })
          };
        })
      };

      var btnExcel = document.getElementById('btnWoListExcel');
      var btnPdf   = document.getElementById('btnWoListPdf');

      btnExcel.onclick = async function () {
        try {
          btnExcel.disabled = true; btnExcel.textContent = I18N.t('hc-exporting', 'جارٍ التصدير...');
          await window.api.exportConsolidatedWorkOrdersList({ type: 'excel', payload: exportPayload });
          toast(I18N.t('hc-excel-success', 'تم تنزيل ملف Excel بنجاح'), 'success');
        } catch (_) { toast(I18N.t('hc-excel-err', 'خطأ في تصدير Excel'), 'error'); }
        btnExcel.disabled = false; btnExcel.textContent = I18N.t('hc-btn-export-excel', 'تصدير Excel');
      };

      btnPdf.onclick = async function () {
        try {
          btnPdf.disabled = true; btnPdf.textContent = I18N.t('hc-exporting', 'جارٍ التصدير...');
          await window.api.exportConsolidatedWorkOrdersList({ type: 'pdf', payload: exportPayload });
          toast(I18N.t('hc-pdf-success', 'تم تنزيل ملف PDF بنجاح'), 'success');
        } catch (_) { toast(I18N.t('hc-pdf-err', 'خطأ في تصدير PDF'), 'error'); }
        btnPdf.disabled = false; btnPdf.textContent = I18N.t('hc-btn-export-pdf', 'تصدير PDF');
      };
    } catch (err) {
      toast('خطأ: ' + err.message, 'error');
    }
  }

  async function reprintConsolidatedInvoice(orderId) {
    if (!orderId) { toast(I18N.t('hc-no-invoice-num', 'لا يوجد رقم فاتورة'), 'error'); return; }
    await openConsolidatedInvoiceA4(orderId);
  }

  /* ── Export Selected Work Orders (PDF / Excel) ── */
  async function exportSelectedWorkOrders(type) {
    var cust = state.selectedCustomer;
    if (!cust || state.selectedOrderIds.size === 0) { toast(I18N.t('hc-issue-no-orders', 'لم يتم تحديد أوامر تشغيل'), 'error'); return; }

    var btn = type === 'excel' ? el.btnExportSelectedExcel : el.btnExportSelectedPdf;
    var origText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = I18N.t('hc-exporting', 'جارٍ التصدير...'); }

    try {
      /* جلب تفاصيل كل أمر تشغيل محدد */
      var selectedIds = Array.from(state.selectedOrderIds);
      var fetchedOrders = [];
      for (var i = 0; i < selectedIds.length; i++) {
        var r = await window.api.getWorkOrderForPrint({ workOrderId: selectedIds[i] });
        if (r && r.success) fetchedOrders.push(r);
      }

      if (fetchedOrders.length === 0) { toast(I18N.t('hc-selected-load-err', 'تعذّر تحميل بيانات الأوامر المحددة'), 'error'); return; }

      var s = state.appSettings || {};
      var arParts = [];
      if (s.buildingNumber) arParts.push(s.buildingNumber);
      if (s.streetNameAr)   arParts.push(s.streetNameAr);
      if (s.districtAr)     arParts.push(s.districtAr);
      if (s.cityAr)         arParts.push(s.cityAr);
      if (s.postalCode)     arParts.push(s.postalCode);

      var firstWo = fetchedOrders[0];
      var exportPayload = {
        invoiceNum:  I18N.t('hc-draft', 'مسودة'),
        custName:    cust.customer_name       || '',
        custPhone:   firstWo.customer_phone   || '',
        custVat:     cust.tax_number          || '',
        shopNameAr:  s.laundryNameAr  || '',
        shopNameEn:  s.laundryNameEn  || '',
        shopPhone:   s.phone          || '',
        vatNumber:   s.vatNumber      || '',
        addressAr:   arParts.join('، '),
        logoB64:     s.logoDataUrl    || '',
        vatRate:     parseFloat(firstWo.vat_rate || 15),
        priceMode:   firstWo.price_display_mode || 'exclusive',
        workOrders:  fetchedOrders.map(function (wo) {
          return {
            work_order_number: wo.work_order_number,
            created_at:        wo.created_at,
            total_amount:      wo.total_amount,
            items: (wo.items || []).map(function (it) {
              return {
                product_name:     it.product_name     || '',
                service_name:     it.service_name     || '',
                merzam_type_name: it.merzam_type_name || '',
                quantity:         it.quantity,
                unit_price:       it.unit_price,
                line_total:       it.line_total
              };
            })
          };
        })
      };

      await window.api.exportConsolidatedWorkOrdersList({ type: type, payload: exportPayload });
      toast(type === 'excel' ? I18N.t('hc-excel-success', 'تم تنزيل ملف Excel بنجاح') : I18N.t('hc-pdf-success', 'تم تنزيل ملف PDF بنجاح'), 'success');
    } catch (_) {
      toast(type === 'excel' ? I18N.t('hc-excel-err', 'خطأ في تصدير Excel') : I18N.t('hc-pdf-err', 'خطأ في تصدير PDF'), 'error');
    }

    if (btn) { btn.disabled = state.selectedOrderIds.size === 0; btn.textContent = origText; }
  }

  /* ── Escape HTML ── */
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Debounce ── */
  function debounce(fn, ms) {
    return function () {
      clearTimeout(state.searchDebounceTimer);
      state.searchDebounceTimer = setTimeout(fn, ms || 350);
    };
  }

  /* ── Event Listeners ── */
  el.btnBack.addEventListener('click', function () {
    window.api.navigateTo('dashboard');
  });

  el.btnBackToCustomers.addEventListener('click', backToCustomers);

  el.customerSearch.addEventListener('input', debounce(function () {
    state.customersSearch = el.customerSearch.value.trim();
    loadCustomers(1);
  }));

  el.ordersSearch.addEventListener('input', debounce(function () {
    state.ordersSearch = el.ordersSearch.value.trim();
    state.ordersPage = 1;
    loadWorkOrders();
  }));

  el.ordersDateFrom.addEventListener('change', function () {
    state.ordersDateFrom = el.ordersDateFrom.value;
    state.ordersPage = 1;
    loadWorkOrders();
  });

  el.ordersDateTo.addEventListener('change', function () {
    state.ordersDateTo = el.ordersDateTo.value;
    state.ordersPage = 1;
    loadWorkOrders();
  });

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { setActiveTab(btn.dataset.tab); });
  });

  el.discountValue.addEventListener('input', updateTotalPreview);
  el.discountType.addEventListener('change', updateTotalPreview);

  el.btnIssueInvoice.addEventListener('click', function () { issueConsolidatedInvoice(false); });

  if (el.btnExportSelectedExcel) el.btnExportSelectedExcel.addEventListener('click', function () { exportSelectedWorkOrders('excel'); });
  if (el.btnExportSelectedPdf)   el.btnExportSelectedPdf.addEventListener('click',   function () { exportSelectedWorkOrders('pdf');   });

  el.btnConfirmCancel.addEventListener('click', doCancel);
  el.btnCancelClose.addEventListener('click', function () { el.cancelModal.style.display = 'none'; });
  el.cancelModal.addEventListener('click', function (e) { if (e.target === el.cancelModal) el.cancelModal.style.display = 'none'; });

  el.mixedCashAmount.addEventListener('input', updateMixedPaymentPreview);
  el.btnConfirmMixedPayment.addEventListener('click', confirmMixedPayment);
  el.btnCancelMixedPayment.addEventListener('click', function () { el.mixedPaymentModal.style.display = 'none'; });

  el.btnConfirmNoVat.addEventListener('click', function () { issueConsolidatedInvoice(true); });
  el.btnUpdateVat.addEventListener('click', function () {
    el.vatConfirmModal.style.display = 'none';
    if (window.api && window.api.navigateTo) window.api.navigateTo('customers');
  });
  el.vatConfirmModal.addEventListener('click', function (e) { if (e.target === el.vatConfirmModal) el.vatConfirmModal.style.display = 'none'; });

  /* ── Init ── */
  (async function () {
    if (typeof I18N !== 'undefined') I18N.apply();
    await loadSettings();
    await loadCustomers(1);
  })();
})();
