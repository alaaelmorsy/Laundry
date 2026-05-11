// Payment Screen Logic
(function() {
  'use strict';

  // State
  const state = {
    invoice: null,
    payments: [],
    selectedMethod: null,
    isProcessing: false,
    orderId: null
  };

  // DOM Elements
  const elements = {
    // States
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    mainContent: document.getElementById('mainContent'),
    errorMessage: document.getElementById('errorMessage'),
    
    // Invoice Summary
    invoiceNumber: document.getElementById('invoiceNumber'),
    customerName: document.getElementById('customerName'),
    customerPhone: document.getElementById('customerPhone'),
    invoiceStatus: document.getElementById('invoiceStatus'),
    totalAmount: document.getElementById('totalAmount'),
    paidAmount: document.getElementById('paidAmount'),
    remainingAmount: document.getElementById('remainingAmount'),
    
    // Payment Input
    paymentInputCard: document.getElementById('paymentInputCard'),
    paymentAmount: document.getElementById('paymentAmount'),
    btnPayFull: document.getElementById('btnPayFull'),
    amountError: document.getElementById('amountError'),
    methodError: document.getElementById('methodError'),
    remainingAfterPayment: document.getElementById('remainingAfterPayment'),
    btnConfirmPayment: document.getElementById('btnConfirmPayment'),
    
    // Fully Paid Message
    fullyPaidMessage: document.getElementById('fullyPaidMessage'),
    
    // Payment History
    emptyHistory: document.getElementById('emptyHistory'),
    historyTable: document.getElementById('historyTable'),
    paymentsTableBody: document.getElementById('paymentsTableBody'),
    
    // Buttons
    btnBack: document.getElementById('btnBack'),
    btnRetry: document.getElementById('btnRetry'),
    
    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  // Initialize
  async function init() {
    // Get order ID from URL
    const params = new URLSearchParams(window.location.search);
    state.orderId = params.get('id');
    
    if (!state.orderId) {
      showError('معرّف الفاتورة غير صالح');
      return;
    }

    // Setup event listeners
    setupEventListeners();
    
    // Load invoice data
    await loadInvoiceData();
  }

  // Setup Event Listeners
  function setupEventListeners() {
    elements.btnBack.addEventListener('click', () => {
      window.location.href = '../invoices/invoices.html';
    });

    elements.btnRetry.addEventListener('click', () => {
      loadInvoiceData();
    });

    elements.btnPayFull.addEventListener('click', () => {
      if (state.invoice && state.invoice.remaining_amount > 0) {
        elements.paymentAmount.value = state.invoice.remaining_amount.toFixed(2);
        validateAmount();
      }
    });

    elements.paymentAmount.addEventListener('input', () => {
      validateAmount();
      updateRemainingAfterPayment();
      if (state.selectedMethod === 'mixed') updateMixedFields();
    });

    // Payment method buttons
    const methodButtons = document.querySelectorAll('.payment-method-btn');
    methodButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        selectPaymentMethod(btn.dataset.method);
      });
    });

    const mixedCashEl = document.getElementById('mixedCashAmount');
    if (mixedCashEl) {
      mixedCashEl.addEventListener('input', (e) => {
        const v = e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*/, '$1');
        if (v !== e.target.value) e.target.value = v;
        updateMixedFields();
      });
    }

    elements.btnConfirmPayment.addEventListener('click', () => {
      confirmPayment();
    });
  }

  // Load Invoice Data
  async function loadInvoiceData() {
    showLoading();
    
    try {
      const response = await window.api.getInvoiceWithPayments({ orderId: Number(state.orderId) });
      
      if (!response || !response.success) {
        throw new Error((response && response.message) || 'فشل تحميل بيانات الفاتورة');
      }

      state.invoice = response.invoice;
      // Normalize numeric fields (DECIMAL may come as string)
      if (state.invoice) {
        state.invoice.total_amount     = Number(state.invoice.total_amount || 0);
        state.invoice.paid_amount      = Number(state.invoice.paid_amount || 0);
        state.invoice.remaining_amount = Number(state.invoice.remaining_amount || 0);
      }
      state.payments = response.payments || [];
      
      renderInvoiceData();
      renderPaymentHistory();
      showMainContent();
      
    } catch (error) {
      console.error('Error loading invoice:', error);
      showError(error.message || 'حدث خطأ في تحميل البيانات');
    }
  }

  // Render Invoice Data
  function renderInvoiceData() {
    const inv = state.invoice;
    
    // Invoice info
    elements.invoiceNumber.textContent = inv.invoice_seq || inv.order_number;
    elements.customerName.textContent = inv.customer_name || 'غير محدد';
    elements.customerPhone.textContent = inv.phone || '-';
    
    // Status
    const statusText = getStatusText(inv.payment_status);
    const statusClass = getStatusClass(inv.payment_status);
    elements.invoiceStatus.textContent = statusText;
    elements.invoiceStatus.className = `info-value status-badge ${statusClass}`;
    
    // Amounts
    elements.totalAmount.textContent = formatCurrency(inv.total_amount);
    elements.paidAmount.textContent = formatCurrency(inv.paid_amount);
    elements.remainingAmount.textContent = formatCurrency(inv.remaining_amount);
    
    // Initialize remaining after payment
    updateRemainingAfterPayment();
    
    // Show/hide payment input based on status
    if (inv.payment_status === 'paid' && inv.remaining_amount === 0) {
      elements.paymentInputCard.style.display = 'none';
      elements.fullyPaidMessage.style.display = 'block';
    } else {
      elements.paymentInputCard.style.display = 'block';
      elements.fullyPaidMessage.style.display = 'none';
    }
  }

  // Render Payment History
  function renderPaymentHistory() {
    if (state.payments.length === 0) {
      elements.emptyHistory.style.display = 'flex';
      elements.historyTable.style.display = 'none';
      return;
    }

    elements.emptyHistory.style.display = 'none';
    elements.historyTable.style.display = 'block';
    
    elements.paymentsTableBody.innerHTML = state.payments.map(payment => `
      <tr>
        <td>${formatDateTime(payment.payment_date)}</td>
        <td><span class="payment-amount">${formatCurrency(payment.payment_amount)}</span></td>
        <td><span class="payment-method-badge">${getPaymentMethodText(payment.payment_method)}</span></td>
        <td>${payment.created_by || '-'}</td>
        <td>${payment.notes || '-'}</td>
      </tr>
    `).join('');
  }

  // Select Payment Method
  function selectPaymentMethod(method) {
    state.selectedMethod = method;
    
    // Update UI
    const methodButtons = document.querySelectorAll('.payment-method-btn');
    methodButtons.forEach(btn => {
      if (btn.dataset.method === method) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });

    const section = document.getElementById('mixedPaymentSection');
    if (section) section.style.display = method === 'mixed' ? '' : 'none';
    if (method === 'mixed') updateMixedFields();
  }

  function updateMixedFields() {
    const payAmt = parseFloat(elements.paymentAmount.value) || 0;
    const cashEl = document.getElementById('mixedCashAmount');
    const cardEl = document.getElementById('mixedCardAmount');
    if (!cashEl || !cardEl) return;
    const rawCash = parseFloat(cashEl.value) || 0;
    const cash = Math.max(0, Math.min(rawCash, payAmt));
    const card = Math.max(0, Math.round((payAmt - cash) * 100) / 100);
    cardEl.value = card.toFixed(2);
  }

  // Update Remaining After Payment
  function updateRemainingAfterPayment() {
    const paymentAmount = parseFloat(elements.paymentAmount.value) || 0;
    const currentRemaining = state.invoice ? state.invoice.remaining_amount : 0;
    const remainingAfter = Math.max(0, currentRemaining - paymentAmount);
    
    elements.remainingAfterPayment.textContent = formatCurrency(remainingAfter);
  }

  // Validate Amount
  function validateAmount() {
    const amount = parseFloat(elements.paymentAmount.value);
    const remaining = state.invoice ? state.invoice.remaining_amount : 0;
    
    if (!amount || amount <= 0) {
      showToast('error', 'يجب أن يكون المبلغ أكبر من صفر');
      return false;
    }
    
    if (amount > remaining) {
      showToast('error', `المبلغ المدخل يتجاوز المبلغ المتبقي (${formatCurrency(remaining)})`);
      return false;
    }
    
    return true;
  }

  // Confirm Payment
  async function confirmPayment() {
    if (state.isProcessing) return;
    
    // Validate
    const amount = parseFloat(elements.paymentAmount.value);
    if (!validateAmount()) {
      return;
    }
    
    if (!state.selectedMethod) {
      showToast('error', 'يرجى اختيار طريقة الدفع');
      return;
    }
    
    // Confirm with user
    const confirmMsg = `هل أنت متأكد من تسجيل دفعة بمبلغ ${formatCurrency(amount)}؟`;
    if (!confirm(confirmMsg)) {
      return;
    }
    
    state.isProcessing = true;
    elements.btnConfirmPayment.disabled = true;
    elements.btnConfirmPayment.innerHTML = `
      <div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
      <span>جارٍ التسجيل...</span>
    `;
    
    try {
      const isMixed = state.selectedMethod === 'mixed';
      const cashAmt = isMixed ? (parseFloat((document.getElementById('mixedCashAmount') || {}).value) || 0) : 0;
      const cardAmt = isMixed ? (parseFloat((document.getElementById('mixedCardAmount') || {}).value) || 0) : 0;
      const response = await window.api.recordInvoicePayment({
        orderId: Number(state.orderId),
        paymentAmount: amount,
        paymentMethod: state.selectedMethod,
        cashAmount: cashAmt,
        cardAmount: cardAmt,
        notes: null
      });
      
      if (!response || !response.success) {
        throw new Error((response && response.message) || 'فشل تسجيل الدفعة');
      }
      
      // Show success message
      showToast('success', 'تم تسجيل الدفعة بنجاح');
      
      // Reload data
      await loadInvoiceData();
      
      // Reset form
      resetForm();
      
    } catch (error) {
      console.error('Error recording payment:', error);
      showToast('error', error.message || 'حدث خطأ في تسجيل الدفعة');
    } finally {
      state.isProcessing = false;
      elements.btnConfirmPayment.disabled = false;
      elements.btnConfirmPayment.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>تأكيد الدفعة</span>
      `;
    }
  }

  // Reset Form
  function resetForm() {
    elements.paymentAmount.value = '';
    state.selectedMethod = null;
    
    const methodButtons = document.querySelectorAll('.payment-method-btn');
    methodButtons.forEach(btn => btn.classList.remove('selected'));
    
    elements.amountError.style.display = 'none';
    elements.methodError.style.display = 'none';
    
    updateRemainingAfterPayment();
  }

  // UI State Functions
  function showLoading() {
    elements.loadingState.style.display = 'flex';
    elements.errorState.style.display = 'none';
    elements.mainContent.style.display = 'none';
  }

  function showError(message) {
    elements.errorMessage.textContent = message;
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'flex';
    elements.mainContent.style.display = 'none';
  }

  function showMainContent() {
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.mainContent.style.display = 'block';
  }

  // Utility Functions
  function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return `${num.toFixed(2)} ر.س`;
  }

  function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getStatusText(status) {
    const statusMap = {
      'pending': 'آجلة',
      'partial': 'آجلة جزئياً',
      'paid': 'مدفوعة كاملة'
    };
    return statusMap[status] || status;
  }

  function getStatusClass(status) {
    return status || 'pending';
  }

  function getPaymentMethodText(method) {
    const methodMap = {
      'cash': 'نقداً',
      'card': 'شبكة',
      'bank': 'تحويل بنكي',
      'subscription': 'اشتراك',
      'other': 'أخرى'
    };
    return methodMap[method] || method;
  }

  function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' 
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    
    toast.innerHTML = `
      ${icon}
      <span class="toast-message">${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
