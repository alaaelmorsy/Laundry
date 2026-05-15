/**
 * واجهة `window.api` للمتصفح — تتوافق مع خادم Express و`/api/invoke`.
 */
(function () {
  if (window.api) return;

  const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function parseFilenameFromCD(cd) {
    if (!cd) return 'download';
    const star = /filename\*\s*=\s*UTF-8''([^;\n]+)/i.exec(cd);
    if (star) {
      try {
        return decodeURIComponent(star[1]);
      } catch {
        return star[1];
      }
    }
    const plain = /filename\s*=\s*"?([^";\n]+)"?/i.exec(cd);
    return plain ? plain[1].replace(/"/g, '') : 'download';
  }

  async function jsonFetch(url, options = {}) {
    const r = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    return r;
  }

  async function exportBinary(path, body) {
    try {
      const r = await jsonFetch(path, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      if (r.status === 401) {
        location.href = '/screens/login/login.html';
        return { success: false, message: 'غير مصرح' };
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        return { success: false, message: j.message || r.statusText };
      }
      const blob = await r.blob();
      const name = parseFilenameFromCD(r.headers.get('Content-Disposition'));
      downloadBlob(blob, name);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message || 'فشل الاتصال بالخادم' };
    }
  }

  async function invoke(method, payload) {
    const r = await jsonFetch('/api/invoke', {
      method: 'POST',
      body: JSON.stringify({ method, payload: payload === undefined ? {} : payload })
    });
    if (r.status === 401) {
      location.href = '/screens/login/login.html';
      return { success: false, message: 'غير مصرح' };
    }
    return r.json();
  }

  window.api = {
    login: async (credentials) => {
      const r = await jsonFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials || {})
      });
      return r.json();
    },

    openMain: () => {
      location.href = '/screens/dashboard/dashboard.html';
    },

    logout: async () => {
      try {
        await jsonFetch('/api/auth/logout', { method: 'POST', body: '{}' });
      } catch (_) {}
      location.href = '/screens/login/login.html';
    },

    minimizeWindow: () => {},
    maximizeWindow: () => {},
    closeWindow: () => {
      window.close();
    },
    isMaximized: async () => false,
    onMaximizeChange: () => {},

    navigateTo: (screen) => {
      location.href = `/screens/${screen}/${screen}.html`;
    },

    navigateBack: () => {
      location.href = '/screens/dashboard/dashboard.html';
    },

    pathToFileUrl: (absPath) => absPath || '',

    getAppSettings: () => invoke('getAppSettings'),
    saveAppSettings: (data) => invoke('saveAppSettings', data),
    getZatcaSettings: () => invoke('getZatcaSettings'),
    saveZatcaSettings: (data) => invoke('saveZatcaSettings', data),
    sendTestDailyReportEmail: () => invoke('sendTestDailyReportEmail'),
    getUsers: () => invoke('getUsers'),
    createUser: (data) => invoke('createUser', data),
    updateUser: (data) => invoke('updateUser', data),
    toggleUserStatus: (data) => invoke('toggleUserStatus', data),
    deleteUser: (data) => invoke('deleteUser', data),
    getCustomers: (filters) => invoke('getCustomers', filters),
    createCustomer: (data) => invoke('createCustomer', data),
    updateCustomer: (data) => invoke('updateCustomer', data),
    toggleCustomerStatus: (data) => invoke('toggleCustomerStatus', data),
    deleteCustomer: (data) => invoke('deleteCustomer', data),
    getExpenses: (filters) => invoke('getExpenses', filters),
    getExpensesSummary: (filters) => invoke('getExpensesSummary', filters),
    createExpense: (data) => invoke('createExpense', data),
    updateExpense: (data) => invoke('updateExpense', data),
    deleteExpense: (data) => invoke('deleteExpense', data),
    exportExpenses: (data) => exportBinary('/api/export/expenses', data),
    exportCustomers: (data) => exportBinary('/api/export/customers', data),
    getLaundryServices: (filters) => invoke('getLaundryServices', filters),
    createLaundryService: (data) => invoke('createLaundryService', data),
    updateLaundryService: (data) => invoke('updateLaundryService', data),
    deleteLaundryService: (data) => invoke('deleteLaundryService', data),
    toggleLaundryServiceStatus: (data) => invoke('toggleLaundryServiceStatus', data),
    reorderLaundryService: (data) => invoke('reorderLaundryService', data),

    pickProductImage: () =>
      new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.svg';
        input.onchange = () => {
          const f = input.files && input.files[0];
          if (!f) {
            resolve({ success: false, canceled: true });
            return;
          }
          if (f.size > MAX_IMAGE_BYTES) {
            resolve({ success: false, message: 'حجم الملف كبير جداً (الحد 15 ميجابايت)' });
            return;
          }
          const fr = new FileReader();
          fr.onload = () => {
            const dataUrl = String(fr.result || '');
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve({
              success: true,
              base64,
              mime: f.type || 'application/octet-stream'
            });
          };
          fr.onerror = () => resolve({ success: false, message: 'تعذر قراءة الملف' });
          fr.readAsDataURL(f);
        };
        input.click();
      }),

    getProducts: (filters) => invoke('getProducts', filters),
    getProduct: (data) => invoke('getProduct', data),
    saveProduct: (data) => invoke('saveProduct', data),
    deleteProduct: (data) => invoke('deleteProduct', data),
    toggleProductStatus: (data) => invoke('toggleProductStatus', data),
    reorderProduct: (data) => invoke('reorderProduct', data),
    exportProducts: (data) => exportBinary('/api/export/products', data),
    getPrepaidPackages: (filters) => invoke('getPrepaidPackages', filters),
    savePrepaidPackage: (data) => invoke('savePrepaidPackage', data),
    togglePrepaidPackage: (data) => invoke('togglePrepaidPackage', data),
    deletePrepaidPackage: (data) => invoke('deletePrepaidPackage', data),
    getCustomerActiveSubscription: (data) => invoke('getCustomerActiveSubscription', data),
    getCustomerSubscriptionsList: (filters) => invoke('getCustomerSubscriptionsList', filters),
    getSubscriptionDetail: (data) => invoke('getSubscriptionDetail', data),
    getSubscriptionPeriods: (data) => invoke('getSubscriptionPeriods', data),
    getSubscriptionLedger: (data) => invoke('getSubscriptionLedger', data),
    createSubscription: (data) => invoke('createSubscription', data),
    renewSubscription: (data) => invoke('renewSubscription', data),
    stopSubscription: (data) => invoke('stopSubscription', data),
    resumeSubscription: (data) => invoke('resumeSubscription', data),
    updateActiveSubscriptionPeriod: (data) => invoke('updateActiveSubscriptionPeriod', data),
    deleteSubscription: (data) => invoke('deleteSubscription', data),

    printSubscriptionReceipt: async (data) => {
      const r = await jsonFetch('/api/subscriptions/receipt-print-html', {
        method: 'POST',
        body: JSON.stringify({ periodId: data.periodId })
      });
      if (r.status === 401) {
        location.href = '/screens/login/login.html';
        return { success: false, message: 'غير مصرح' };
      }
      const j = await r.json();
      if (!j.success) return j;
      // طباعة مباشرة بدون فتح نافذة مستقلة
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none';
      document.body.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(j.html);
      iframe.contentDocument.close();
      iframe.contentWindow.focus();
      setTimeout(() => {
        try {
          iframe.contentWindow.print();
        } catch (_) {}
        setTimeout(() => iframe.remove(), 2000);
      }, 400);
      return { success: true };
    },

    exportSubscriptionReceiptPdf: (data) =>
      exportBinary('/api/export/subscription-receipt-pdf', { periodId: data.periodId }),
    exportInvoicePdf: (data) =>
      exportBinary('/api/export/invoice-pdf', { orderId: data.orderId, paperType: data.paperType }),
    exportInvoicePdfFromHtml: (data) =>
      exportBinary('/api/export/invoice-pdf-from-html', { html: data.html, paperType: data.paperType, orderNum: data.orderNum }),
    exportHangerTicket: (data) =>
      exportBinary('/api/export/hanger-ticket', { orderId: data.orderId }),

    printHangerTicketThermal: async (data) => {
      const r = await fetch('/api/print/hanger-ticket-thermal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.orderId })
      });
      if (r.status === 401) {
        location.href = '/screens/login/login.html';
        return { success: false, message: 'غير مصرح' };
      }
      const j = await r.json();
      if (!j.success) return j;
      // طباعة مباشرة بدون فتح نافذة مستقلة
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none';
      document.body.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(j.html);
      iframe.contentDocument.close();
      iframe.contentWindow.focus();
      setTimeout(() => {
        try {
          iframe.contentWindow.print();
        } catch (_) {}
        setTimeout(() => iframe.remove(), 2000);
      }, 400);
      return { success: true };
    },

    exportSubscriptions: (data) => exportBinary('/api/export/subscriptions', data),
    exportSubscriptionCustomerReport: (data) =>
      exportBinary('/api/export/subscription-customer-report', data),

    getPosProducts: () => invoke('getPosProducts'),
    getPosProductImage: (productId) => invoke('getPosProductImage', { productId }),
    getPosProductImages: (productIds) => invoke('getPosProductImages', { productIds }),
    getPosServices: () => invoke('getPosServices'),
    createOrder: (data) => invoke('createOrder', data),
    getOrders: (filters) => invoke('getOrders', filters),
    getOrdersBySubscription: (data) => invoke('getOrdersBySubscription', data),
    getSubscriptionInvoices: (filters) => invoke('getSubscriptionInvoices', filters),
    getOrderById: (data) => invoke('getOrderById', data),
    getDeferredOrders:  (data) => invoke('getDeferredOrders',  data),
    payDeferredOrder:   (data) => invoke('payDeferredOrder',   data),
    getInvoiceWithPayments: (data) => invoke('getInvoiceWithPayments', data),
    recordInvoicePayment:   (data) => invoke('recordInvoicePayment',   data),
    getPaymentHistory:      (data) => invoke('getPaymentHistory',      data),
    getInvoiceBySeq:        (data) => invoke('getInvoiceBySeq',        data),
    createCreditNote:       (data) => invoke('createCreditNote',       data),
    getCreditNotes:         (filters) => invoke('getCreditNotes',      filters),
    getCreditNoteById:      (data) => invoke('getCreditNoteById',      data),
    exportCreditNotes:      (data) => exportBinary('/api/export/credit-notes', data),
    markOrderCleaned:   (data) => invoke('markOrderCleaned',   data),
    markOrderDelivered: (data) => invoke('markOrderDelivered', data),
    generateZatcaQR:    (data) => invoke('generateZatcaQR',    data),
    zatcaSubmitOrder:            (data) => invoke('zatcaSubmitOrder', data),
    zatcaSubmitCreditNote:       (data) => invoke('zatcaSubmitCreditNote', data),
    zatcaGetUnsentOrders:        () => invoke('zatcaGetUnsentOrders'),
    zatcaRetryUnsent:            () => invoke('zatcaRetryUnsent'),

    getHangers: (filters) => invoke('getHangers', filters),
    getAvailableHangers: () => invoke('getAvailableHangers'),
    createHanger: (data) => invoke('createHanger', data),
    batchCreateHangers: (data) => invoke('batchCreateHangers', data),
    updateHanger: (data) => invoke('updateHanger', data),
    deleteHanger: (data) => invoke('deleteHanger', data),
    toggleHangerStatus: (data) => invoke('toggleHangerStatus', data),

    // Offer functions
    getOffers: () => invoke('getOffers'),
    getActiveOffers: () => invoke('getActiveOffers'),
    createOffer: (data) => invoke('createOffer', data),
    updateOffer: (data) => invoke('updateOffer', data),
    toggleOffer: (data) => invoke('toggleOffer', data),
    deleteOffer: (data) => invoke('deleteOffer', data),

    getReportData: (filters) => invoke('getReportData', filters),
    getAllInvoicesReport: (filters) => invoke('getAllInvoicesReport', filters),
    getSubscriptionsReport: (filters) => invoke('getSubscriptionsReport', filters),
    getTypesReport: (filters) => invoke('getTypesReport', filters),
    exportTypesReport: (data) => exportBinary('/api/export/types-report', data),
    exportReport: (data) => exportBinary('/api/export/report', data),
    exportAllInvoicesReport: (data) => exportBinary('/api/export/all-invoices-report', data),
    exportSubscriptionsReport: (data) => exportBinary('/api/export/subscriptions-report', data),

    translateText: async (text, target = 'en', source = 'ar') => {
      const r = await jsonFetch('/api/translate', {
        method: 'POST',
        body: JSON.stringify({ text, target, source })
      });
      if (r.status === 401) {
        location.href = '/screens/login/login.html';
        return { success: false, message: 'غير مصرح' };
      }
      return r.json();
    },
  };
})();
