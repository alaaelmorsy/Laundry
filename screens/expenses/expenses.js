window.addEventListener('DOMContentLoaded', () => {
  console.log('Expenses page loaded');

  try {
  const btnBack             = document.getElementById('btnBack');
  const btnAddExpense       = document.getElementById('btnAddExpense');
  const searchInput         = document.getElementById('searchInput');
  const filterDateFrom      = document.getElementById('filterDateFrom');
  const filterDateTo        = document.getElementById('filterDateTo');
  const btnClearDates       = document.getElementById('btnClearDates');
  const btnExportExcel      = document.getElementById('btnExportExcel');
  const btnExportPdf        = document.getElementById('btnExportPdf');
  const expensesTableBody   = document.getElementById('expensesTableBody');
  const emptyState          = document.getElementById('emptyState');
  const toastContainer      = document.getElementById('toastContainer');
  const confirmOverlay      = document.getElementById('confirmOverlay');
  const confirmMsg          = document.getElementById('confirmMsg');
  const btnConfirmOk        = document.getElementById('btnConfirmOk');
  const btnConfirmCancel    = document.getElementById('btnConfirmCancel');
  const paginationBar       = document.getElementById('paginationBar');
  const paginationInfo      = document.getElementById('paginationInfo');
  const pageNumbers         = document.getElementById('pageNumbers');
  const btnFirstPage        = document.getElementById('btnFirstPage');
  const btnPrevPage         = document.getElementById('btnPrevPage');
  const btnNextPage         = document.getElementById('btnNextPage');
  const btnLastPage         = document.getElementById('btnLastPage');
  const pageSizeSelect      = document.getElementById('pageSizeSelect');

  const modalOverlay        = document.getElementById('modalOverlay');
  const modalTitle          = document.getElementById('modalTitle');
  const modalError          = document.getElementById('modalError');
  const editExpenseId       = document.getElementById('editExpenseId');
  const inputTitle          = document.getElementById('inputTitle');
  const inputCategory       = document.getElementById('inputCategory');
  const inputAmount         = document.getElementById('inputAmount');
  const inputDate           = document.getElementById('inputDate');
  const inputIsTaxable      = document.getElementById('inputIsTaxable');
  const inputNotes          = document.getElementById('inputNotes');
  const taxPreviewBox       = document.getElementById('taxPreviewBox');
  const taxPreviewValue     = document.getElementById('taxPreviewValue');
  const totalPreviewValue   = document.getElementById('totalPreviewValue');
  const btnModalClose       = document.getElementById('btnModalClose');
  const btnModalCancel      = document.getElementById('btnModalCancel');
  const btnModalSave        = document.getElementById('btnModalSave');

  const summaryTotalBefore  = document.getElementById('summaryTotalBefore');
  const summaryTax          = document.getElementById('summaryTax');
  const summaryGrandTotal   = document.getElementById('summaryGrandTotal');

  let currentExpenses = [];
  let currentPage     = 1;
  let currentPageSize = 50;
  let totalPages      = 1;
  let totalRecords    = 0;
  let currentFilters  = {};
  let filterTimer     = null;

  I18N.apply();

  btnBack.addEventListener('click', () => window.api.navigateBack());

  inputIsTaxable.addEventListener('change', calculateTax);
  inputAmount.addEventListener('input', calculateTax);

  btnAddExpense.addEventListener('click', () => openModal(null));
  btnModalClose.addEventListener('click', closeModal);
  btnModalCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  btnModalSave.addEventListener('click', saveExpense);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  searchInput.addEventListener('input', applyFilters);
  filterDateFrom.addEventListener('change', applyFilters);
  filterDateTo.addEventListener('change', applyFilters);

  // Ensure date picker shows when clicking on date filter inputs
  filterDateFrom.addEventListener('click', () => {
    filterDateFrom.showPicker ? filterDateFrom.showPicker() : filterDateFrom.focus();
  });
  filterDateTo.addEventListener('click', () => {
    filterDateTo.showPicker ? filterDateTo.showPicker() : filterDateTo.focus();
  });

  btnClearDates.addEventListener('click', () => {
    filterDateFrom.value = '';
    filterDateTo.value   = '';
    applyFilters();
  });

  btnExportExcel.addEventListener('click', () => exportExpenses('excel'));
  btnExportPdf.addEventListener('click',   () => exportExpenses('pdf'));

  btnFirstPage.addEventListener('click', () => goToPage(1));
  btnPrevPage.addEventListener('click',  () => goToPage(currentPage - 1));
  btnNextPage.addEventListener('click',  () => goToPage(currentPage + 1));
  btnLastPage.addEventListener('click',  () => goToPage(totalPages));

  pageSizeSelect.addEventListener('change', () => {
    currentPageSize = Number(pageSizeSelect.value);
    currentPage = 1;
    loadExpenses();
  });

  function applyFilters() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      currentPage = 1;
      currentFilters = {};
      if (searchInput.value.trim())   currentFilters.search   = searchInput.value.trim();
      if (filterDateFrom.value)        currentFilters.dateFrom = filterDateFrom.value;
      if (filterDateTo.value)          currentFilters.dateTo   = filterDateTo.value;
      loadExpenses();
    }, 300);
  }

  async function loadExpenses() {
    expensesTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="loading-cell">
          <div class="spinner"></div>
          <span>${I18N.t('expenses-loading')}</span>
        </td>
      </tr>`;
    emptyState.style.display  = 'none';
    paginationBar.style.display = 'none';

    try {
      const result = await window.api.getExpenses({
        page:     currentPage,
        pageSize: currentPageSize,
        ...currentFilters
      });

      if (result.success) {
        currentExpenses = result.expenses;
        totalRecords    = result.total;
        totalPages      = result.totalPages || 1;
        renderTable(currentExpenses);
        renderPagination();
        loadSummary();
      } else {
        showToast(I18N.t('expenses-err-load'), 'error');
        expensesTableBody.innerHTML = '';
      }
    } catch (err) {
      showToast(I18N.t('expenses-err-db'), 'error');
      console.error('Error loading expenses:', err);
      expensesTableBody.innerHTML = '';
    }
  }

  async function loadSummary() {
    try {
      const result = await window.api.getExpensesSummary(currentFilters);
      if (result.success) {
        const s = result.summary;
        summaryTotalBefore.innerHTML = `${formatNumber(s.total_before_tax)} <span class="currency"><span class="sar">&#xE900;</span></span>`;
        summaryTax.innerHTML         = `${formatNumber(s.total_tax)} <span class="currency"><span class="sar">&#xE900;</span></span>`;
        summaryGrandTotal.innerHTML  = `${formatNumber(s.grand_total)} <span class="currency"><span class="sar">&#xE900;</span></span>`;
      }
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  }

  function renderTable(expenses) {
    if (expenses.length === 0) {
      expensesTableBody.innerHTML = '';
      emptyState.style.display = 'flex';
      paginationBar.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';

    const indexStart = (currentPage - 1) * currentPageSize;

    const formatDate = (dateStr) => {
      if (!dateStr) return '—';
      try {
        const s = String(dateStr);
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
          return `${m[3]}/${m[2]}/${m[1]}`;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return s;
        const y = date.getFullYear();
        const mo = String(date.getMonth() + 1).padStart(2, '0');
        const da = String(date.getDate()).padStart(2, '0');
        return `${da}/${mo}/${y}`;
      } catch {
        return String(dateStr);
      }
    };

    expensesTableBody.innerHTML = expenses.map((e, i) => `
      <tr>
        <td class="index-cell">${indexStart + i + 1}</td>
        <td>${escHtml(e.title || '—')}</td>
        <td>${escHtml(e.category || '—')}</td>
        <td>${formatDate(e.expense_date)}</td>
        <td class="amount-cell">${formatNumber(e.amount)} <span class="sar">&#xE900;</span></td>
        <td>
          <span class="badge-taxable ${e.is_taxable ? '' : 'badge-no-tax'}">
            ${e.is_taxable ? I18N.t('expenses-taxable-yes') : I18N.t('expenses-taxable-no')}
          </span>
        </td>
        <td class="tax-cell">${formatNumber(e.tax_amount)} <span class="sar">&#xE900;</span></td>
        <td class="total-cell">${formatNumber(e.total_amount)} <span class="sar">&#xE900;</span></td>
        <td>
          <div class="actions-cell">
            <button class="action-btn btn-edit" title="${I18N.t('expenses-btn-edit-title')}" data-action="edit" data-id="${e.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="action-btn btn-delete" title="${I18N.t('expenses-btn-delete-title')}" data-action="delete" data-id="${e.id}" data-name="${escHtml(e.title || '')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    expensesTableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const expense = currentExpenses.find(e => e.id == btn.dataset.id);
        if (expense) openModal(expense);
      });
    });

    expensesTableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteExpense(Number(btn.dataset.id), btn.dataset.name));
    });
  }

  function renderPagination() {
    if (totalRecords === 0) {
      paginationBar.style.display = 'none';
      return;
    }

    paginationBar.style.display = 'flex';

    const start = (currentPage - 1) * currentPageSize + 1;
    const end   = Math.min(currentPage * currentPageSize, totalRecords);
    paginationInfo.textContent = `عرض ${start.toLocaleString()} - ${end.toLocaleString()} من ${totalRecords.toLocaleString()} سجل`;

    btnFirstPage.disabled = currentPage === 1;
    btnPrevPage.disabled  = currentPage === 1;
    btnNextPage.disabled  = currentPage === totalPages;
    btnLastPage.disabled  = currentPage === totalPages;

    const range = getPageRange(currentPage, totalPages);
    pageNumbers.innerHTML = range.map(p =>
      p === '...'
        ? `<span class="page-ellipsis">…</span>`
        : `<button class="page-num ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('');

    pageNumbers.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => goToPage(Number(btn.dataset.page)));
    });
  }

  function getPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    currentPage = page;
    loadExpenses();
  }

  async function exportExpenses(type) {
    btnExportExcel.disabled = true;
    btnExportPdf.disabled   = true;
    showToast(I18N.t('expenses-exporting'), 'info');

    try {
      const result = await window.api.exportExpenses({ type, filters: currentFilters });
      if (result.success) {
        showToast(I18N.t('expenses-export-success'), 'success');
      } else {
        showToast(result.message || I18N.t('expenses-export-error'), 'error');
      }
    } catch (err) {
      showToast(I18N.t('expenses-export-error'), 'error');
      console.error('Export error:', err);
    }

    btnExportExcel.disabled = false;
    btnExportPdf.disabled   = false;
  }

  function openModal(expense) {
    editExpenseId.value    = expense ? expense.id : '';
    inputTitle.value       = expense ? (expense.title || '') : '';
    inputCategory.value    = expense ? (expense.category || '') : '';
    inputAmount.value      = expense ? expense.total_amount : '';
    inputDate.value        = expense ? formatDateForInput(expense.expense_date) : getTodayDate();
    inputNotes.value       = expense ? (expense.notes || '') : '';
    inputIsTaxable.checked = expense ? Boolean(expense.is_taxable) : false;

    calculateTax();

    modalTitle.textContent = expense
      ? I18N.t('expenses-modal-edit-title')
      : I18N.t('expenses-modal-add-title');
    hideModalError();
    modalOverlay.style.display = 'flex';
    setTimeout(() => inputTitle.focus(), 100);
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    hideModalError();
  }

  function calculateTax() {
    const totalAmount = parseFloat(inputAmount.value) || 0;
    const isTaxable   = inputIsTaxable.checked;

    if (isTaxable && totalAmount > 0) {
      const preTaxAmount = totalAmount / 1.15;
      const taxAmount    = totalAmount - preTaxAmount;
      taxPreviewValue.innerHTML   = `${formatNumber(preTaxAmount)} <span class="sar">&#xE900;</span>`;
      totalPreviewValue.innerHTML = `${formatNumber(taxAmount)} <span class="sar">&#xE900;</span>`;
      taxPreviewBox.style.display   = 'block';
    } else {
      taxPreviewBox.style.display = 'none';
    }
  }

  function getTodayDate() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  function formatDateForInput(dateStr) {
    if (!dateStr) return getTodayDate();
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[1]}-${m[2]}-${m[3]}` : getTodayDate();
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch { return getTodayDate(); }
  }

  async function saveExpense() {
    const id          = editExpenseId.value;
    const title       = inputTitle.value.trim();
    const category    = inputCategory.value.trim();
    const amount      = parseFloat(inputAmount.value);
    const expenseDate = inputDate.value;
    const isTaxable   = inputIsTaxable.checked;
    const notes       = inputNotes.value.trim();

    if (!title)                       { showModalError(I18N.t('expenses-err-title'));    return; }
    if (!category)                    { showModalError(I18N.t('expenses-err-category')); return; }
    if (isNaN(amount) || amount <= 0) { showModalError(I18N.t('expenses-err-amount'));   return; }
    if (!expenseDate)                 { showModalError(I18N.t('expenses-err-date'));      return; }

    const taxRate      = 15.00;
    const totalAmount  = amount;
    const preTaxAmount = isTaxable ? amount / 1.15 : amount;
    const taxAmount    = isTaxable ? amount - preTaxAmount : 0;

    btnModalSave.disabled = true;
    hideModalError();

    const data = { title, category, amount: preTaxAmount, isTaxable, taxRate, taxAmount, totalAmount, expenseDate, notes };

    try {
      const result = id
        ? await window.api.updateExpense({ id: Number(id), ...data })
        : await window.api.createExpense(data);

      if (result.success) {
        closeModal();
        showToast(id ? I18N.t('expenses-success-update') : I18N.t('expenses-success-add'), 'success');
        await loadExpenses();
      } else {
        showModalError(result.message || I18N.t('expenses-err-generic'));
      }
    } catch (err) {
      showModalError(I18N.t('expenses-err-db'));
    }

    btnModalSave.disabled = false;
  }

  async function deleteExpense(id, name) {
    confirmMsg.textContent         = I18N.t('expenses-confirm-delete').replace('{name}', name);
    confirmOverlay.style.display   = 'flex';

    return new Promise((resolve) => {
      function onOk()     { cleanup(); confirmOverlay.style.display = 'none'; resolve(true);  }
      function onCancel() { cleanup(); confirmOverlay.style.display = 'none'; resolve(false); }
      function cleanup()  {
        btnConfirmOk.removeEventListener('click', onOk);
        btnConfirmCancel.removeEventListener('click', onCancel);
      }
      btnConfirmOk.addEventListener('click', onOk);
      btnConfirmCancel.addEventListener('click', onCancel);
    }).then(async (confirmed) => {
      if (!confirmed) return;
      try {
        const result = await window.api.deleteExpense({ id });
        if (result.success) {
          showToast(I18N.t('expenses-success-delete'), 'success');
          if (currentExpenses.length === 1 && currentPage > 1) currentPage--;
          await loadExpenses();
        } else {
          showToast(result.message || I18N.t('expenses-err-delete'), 'error');
        }
      } catch (err) {
        showToast(I18N.t('expenses-err-db'), 'error');
      }
    });
  }

  function formatNumber(num) {
    if (num === null || num === undefined) return '0.00';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function showToast(msg, type) {
    const isSuccess = type === 'success';
    const isInfo    = type === 'info';
    const toast = document.createElement('div');
    toast.className = `toast ${isSuccess ? 'toast-success' : isInfo ? 'toast-info' : 'toast-error'}`;
    toast.innerHTML = `
      <div class="toast-icon">
        ${isSuccess
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
          : isInfo
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
        }
      </div>
      <span class="toast-text">${msg}</span>
      <button class="toast-close">✕</button>
      <span class="toast-progress"></span>
    `;
    toastContainer.appendChild(toast);
    const closeBtn = toast.querySelector('.toast-close');
    function dismiss() {
      toast.classList.add('toast-hide');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }
    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, isInfo ? 5000 : 3500);
  }

  function showModalError(msg) {
    modalError.textContent    = msg;
    modalError.style.display  = '';
  }

  function hideModalError() {
    modalError.style.display  = 'none';
    modalError.textContent    = '';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  loadExpenses();

  } catch (error) {
    console.error('Fatal error in expenses.js:', error);
    document.body.innerHTML = `<div style="color:red;padding:40px;text-align:center;">
      <h2>Error Loading Expenses Screen</h2>
      <p>${error.message}</p>
      <pre>${error.stack}</pre>
    </div>`;
  }
});
