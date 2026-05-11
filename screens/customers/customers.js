window.addEventListener('DOMContentLoaded', () => {
  console.log('Customers page loaded');

  try {
  const btnBack             = document.getElementById('btnBack');
  const btnAddCustomer      = document.getElementById('btnAddCustomer');
  const searchInput         = document.getElementById('searchInput');
  const customersTableBody  = document.getElementById('customersTableBody');
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
  const btnExportExcel      = document.getElementById('btnExportExcel');
  const btnExportPdf        = document.getElementById('btnExportPdf');

  const modalOverlay        = document.getElementById('modalOverlay');
  const modalTitle          = document.getElementById('modalTitle');
  const modalError          = document.getElementById('modalError');
  const editCustomerId      = document.getElementById('editCustomerId');
  const inputSubNumber      = document.getElementById('inputSubNumber');
  const inputCustomerName   = document.getElementById('inputCustomerName');
  const inputPhone          = document.getElementById('inputPhone');
  const inputCity           = document.getElementById('inputCity');
  const inputAddress        = document.getElementById('inputAddress');
  const inputCustomerType   = document.getElementById('inputCustomerType');
  const inputNationalId     = document.getElementById('inputNationalId');
  const inputTaxNumber      = document.getElementById('inputTaxNumber');
  const inputEmail          = document.getElementById('inputEmail');
  const inputIsActive       = document.getElementById('inputIsActive');
  const statusLabel         = document.getElementById('statusLabel');
  const inputNotes          = document.getElementById('inputNotes');
  const btnModalClose       = document.getElementById('btnModalClose');
  const btnModalCancel      = document.getElementById('btnModalCancel');
  const btnModalSave        = document.getElementById('btnModalSave');

  let currentCustomers = [];
  let currentPage      = 1;
  let currentPageSize  = 50;
  let totalPages       = 1;
  let totalRecords     = 0;
  let currentSearch    = '';
  let filterTimer      = null;

  const CUSTOMER_PHONE_MAX_LEN = 32;

  function toAsciiDigits(str) {
    let s = String(str || '');
    const east = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
    const per = '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9';
    for (let i = 0; i < 10; i++) {
      s = s.split(east[i]).join(String(i));
      s = s.split(per[i]).join(String(i));
    }
    return s;
  }

  function digitsOnlyPhone(str) {
    return toAsciiDigits(str).replace(/\D/g, '');
  }

  I18N.apply();

  btnBack.addEventListener('click', () => window.api.navigateBack());

  inputIsActive.addEventListener('change', () => {
    statusLabel.textContent = inputIsActive.checked
      ? I18N.t('customers-status-active')
      : I18N.t('customers-status-inactive');
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      currentSearch = searchInput.value.trim();
      currentPage   = 1;
      loadCustomers();
    }, 300);
  });

  btnAddCustomer.addEventListener('click', () => openModal(null));
  btnModalClose.addEventListener('click', closeModal);
  btnModalCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  btnModalSave.addEventListener('click', saveCustomer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  btnFirstPage.addEventListener('click', () => goToPage(1));
  btnPrevPage.addEventListener('click',  () => goToPage(currentPage - 1));
  btnNextPage.addEventListener('click',  () => goToPage(currentPage + 1));
  btnLastPage.addEventListener('click',  () => goToPage(totalPages));

  pageSizeSelect.addEventListener('change', () => {
    currentPageSize = Number(pageSizeSelect.value);
    currentPage = 1;
    loadCustomers();
  });

  btnExportExcel.addEventListener('click', () => exportCustomers('excel'));
  btnExportPdf.addEventListener('click', () => exportCustomers('pdf'));

  inputPhone.addEventListener('input', () => {
    const cleaned = digitsOnlyPhone(inputPhone.value);
    if (cleaned !== inputPhone.value) inputPhone.value = cleaned;
    if (cleaned.length > CUSTOMER_PHONE_MAX_LEN) inputPhone.value = cleaned.slice(0, CUSTOMER_PHONE_MAX_LEN);
  });

  async function loadCustomers() {
    customersTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="loading-cell">
          <div class="spinner"></div>
          <span>${I18N.t('customers-loading')}</span>
        </td>
      </tr>`;
    emptyState.style.display    = 'none';
    paginationBar.style.display = 'none';

    try {
      const filters = { page: currentPage, pageSize: currentPageSize };
      if (currentSearch) filters.search = currentSearch;

      const result = await window.api.getCustomers(filters);

      if (result.success) {
        currentCustomers = result.customers;
        totalRecords     = result.total;
        totalPages       = result.totalPages || 1;
        renderTable(currentCustomers);
        renderPagination();
      } else {
        showToast(I18N.t('customers-err-load'), 'error');
        customersTableBody.innerHTML = '';
      }
    } catch (err) {
      showToast(I18N.t('customers-err-db'), 'error');
      console.error('Error loading customers:', err);
      customersTableBody.innerHTML = '';
    }
  }

  function renderTable(customers) {
    if (customers.length === 0) {
      customersTableBody.innerHTML = '';
      emptyState.style.display = 'flex';
      paginationBar.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';

    const indexStart = (currentPage - 1) * currentPageSize;

    const typeLabel = (type) => type === 'corporate'
      ? I18N.t('customers-type-corporate')
      : I18N.t('customers-type-individual');

    const typeClass = (type) => type === 'corporate' ? 'badge-corporate' : 'badge-individual';

    const formatDate = (dateStr) => {
      if (!dateStr) return '—';
      try { return new Date(dateStr).toLocaleDateString(I18N.t('time-locale')); }
      catch { return dateStr; }
    };

    customersTableBody.innerHTML = customers.map((c, i) => `
      <tr>
        <td class="index-cell">${indexStart + i + 1}</td>
        <td><span class="sub-number">${escHtml(c.subscription_number || '—')}</span></td>
        <td>${escHtml(c.customer_name || '—')}</td>
        <td dir="ltr" style="text-align:right">${escHtml(c.phone || '—')}</td>
        <td>
          <span class="badge-type ${typeClass(c.customer_type)}">
            ${typeLabel(c.customer_type)}
          </span>
        </td>
        <td>${escHtml(c.city || '—')}</td>
        <td>
          <span class="badge-status ${c.is_active ? 'badge-active' : 'badge-inactive'}">
            <span class="status-dot"></span>
            ${c.is_active ? I18N.t('customers-status-active') : I18N.t('customers-status-inactive')}
          </span>
        </td>
        <td>
          <div class="actions-cell subs-actions">
            <div class="subs-action-row">
              <button type="button" class="action-btn-label action-btn-label--teal" title="${I18N.t('customers-btn-edit-title')}" data-action="edit" data-id="${c.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span>${I18N.t('customers-btn-edit-title')}</span>
              </button>
              <button type="button" class="action-btn-label ${c.is_active ? 'action-btn-label--red-soft' : 'action-btn-label--teal'}"
                title="${c.is_active ? I18N.t('customers-btn-deactivate-title') : I18N.t('customers-btn-activate-title')}"
                data-action="toggle" data-id="${c.id}" data-active="${c.is_active}">
                ${c.is_active
                  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                     </svg>`
                  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                     </svg>`
                }
                <span>${c.is_active ? I18N.t('customers-btn-deactivate-title') : I18N.t('customers-btn-activate-title')}</span>
              </button>
              <button type="button" class="action-btn-label action-btn-label--red-del" title="${I18N.t('customers-btn-delete')}" data-action="delete" data-id="${c.id}" data-name="${escHtml(c.customer_name || '')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                <span>${I18N.t('customers-btn-delete')}</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    customersTableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const customer = currentCustomers.find(c => c.id == btn.dataset.id);
        if (customer) openModal(customer);
      });
    });

    customersTableBody.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener('click', () => toggleStatus(Number(btn.dataset.id), Number(btn.dataset.active)));
    });

    customersTableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteCustomer(Number(btn.dataset.id), btn.dataset.name));
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
    paginationInfo.textContent = `عرض ${start.toLocaleString()} - ${end.toLocaleString()} من ${totalRecords.toLocaleString()} عميل`;

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
    loadCustomers();
  }

  function openModal(customer) {
    editCustomerId.value           = customer ? customer.id : '';
    inputSubNumber.value           = customer ? (customer.subscription_number || '') : '';
    inputCustomerName.value        = customer ? (customer.customer_name || '') : '';
    inputPhone.value               = customer ? digitsOnlyPhone(customer.phone) : '';
    inputCity.value                = customer ? (customer.city || '') : '';
    inputAddress.value             = customer ? (customer.address || '') : '';
    inputCustomerType.value        = customer ? (customer.customer_type || 'individual') : 'individual';
    inputNationalId.value          = customer ? (customer.national_id || '') : '';
    inputTaxNumber.value           = customer ? (customer.tax_number || '') : '';
    inputEmail.value               = customer ? (customer.email || '') : '';
    inputNotes.value               = customer ? (customer.notes || '') : '';
    inputIsActive.checked          = customer ? Boolean(customer.is_active) : true;
    statusLabel.textContent        = inputIsActive.checked
      ? I18N.t('customers-status-active')
      : I18N.t('customers-status-inactive');
    modalTitle.textContent         = customer
      ? I18N.t('customers-modal-edit-title')
      : I18N.t('customers-modal-add-title');
    hideModalError();
    modalOverlay.style.display = 'flex';
    setTimeout(() => inputPhone.focus(), 100);
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    hideModalError();
  }

  async function saveCustomer() {
    const id           = editCustomerId.value;
    const customerName = inputCustomerName.value.trim();
    const phone        = digitsOnlyPhone(inputPhone.value);
    const city         = inputCity.value.trim();
    const address      = inputAddress.value.trim();
    const customerType = inputCustomerType.value;
    const nationalId   = inputNationalId.value.trim();
    const taxNumber    = inputTaxNumber.value.trim();
    const email        = inputEmail.value.trim();
    const notes        = inputNotes.value.trim();
    const isActive     = inputIsActive.checked ? 1 : 0;

    if (!customerName) { showModalError(I18N.t('customers-err-name')); return; }
    if (!phone) { showModalError(I18N.t('customers-err-phone')); return; }
    if (phone.length > CUSTOMER_PHONE_MAX_LEN) {
      showModalError(I18N.t('customers-err-phone-too-long'));
      return;
    }

    btnModalSave.disabled = true;
    hideModalError();

    const data = { customerName, phone, taxNumber, nationalId, address, city, email, customerType, notes, isActive };

    try {
      const result = id
        ? await window.api.updateCustomer({ id: Number(id), ...data })
        : await window.api.createCustomer(data);

      if (result.success) {
        closeModal();
        showToast(id ? I18N.t('customers-success-update') : I18N.t('customers-success-add'), 'success');
        await loadCustomers();
      } else {
        if (result.code === 'NAME_DUPLICATE') {
          showToast(I18N.t('customers-err-name-duplicate'), 'error');
        } else {
          const codeMsg =
            result.code === 'PHONE_DUPLICATE'
              ? I18N.t('customers-err-phone-duplicate')
              : result.code === 'PHONE_INVALID'
                ? I18N.t('customers-err-phone')
                : result.code === 'PHONE_TOO_LONG'
                  ? I18N.t('customers-err-phone-too-long')
                  : null;
          showModalError(codeMsg || result.message || I18N.t('customers-err-unexpected'));
        }
      }
    } catch (err) {
      showModalError(I18N.t('customers-err-db'));
    }

    btnModalSave.disabled = false;
  }

  async function deleteCustomer(id, name) {
    confirmMsg.textContent       = I18N.t('customers-confirm-msg').replace('{name}', name);
    confirmOverlay.style.display = 'flex';

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
        const result = await window.api.deleteCustomer({ id });
        if (result.success) {
          showToast(I18N.t('customers-success-delete'), 'success');
          if (currentCustomers.length === 1 && currentPage > 1) currentPage--;
          await loadCustomers();
        } else {
          showToast(result.message || I18N.t('customers-err-delete'), 'error');
        }
      } catch (err) {
        showToast(I18N.t('customers-err-db'), 'error');
      }
    });
  }

  async function toggleStatus(id, currentActive) {
    const newActive = currentActive ? 0 : 1;
    try {
      const result = await window.api.toggleCustomerStatus({ id, isActive: newActive });
      if (result.success) {
        showToast(newActive ? I18N.t('customers-success-activate') : I18N.t('customers-success-deactivate'), 'success');
        await loadCustomers();
      } else {
        showToast(result.message || I18N.t('customers-err-generic'), 'error');
      }
    } catch (err) {
      showToast(I18N.t('customers-err-db'), 'error');
    }
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
    modalError.textContent   = msg;
    modalError.style.display = '';
  }

  function hideModalError() {
    modalError.style.display = 'none';
    modalError.textContent   = '';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function exportCustomers(type) {
    btnExportExcel.disabled = true;
    btnExportPdf.disabled   = true;
    showToast(I18N.t('customers-exporting'), 'info');

    try {
      const result = await window.api.exportCustomers({ type, filters: { search: currentSearch } });
      if (result.success) {
        showToast(I18N.t('customers-export-success'), 'success');
      } else {
        showToast(result.message || I18N.t('customers-export-error'), 'error');
      }
    } catch (err) {
      showToast(I18N.t('customers-export-error'), 'error');
      console.error('Export error:', err);
    }

    btnExportExcel.disabled = false;
    btnExportPdf.disabled   = false;
  }

  loadCustomers();

  } catch (error) {
    console.error('Fatal error in customers.js:', error);
    document.body.innerHTML = `<div style="color:red;padding:40px;text-align:center;">
      <h2>Error Loading Customers Screen</h2>
      <p>${error.message}</p>
      <pre>${error.stack}</pre>
    </div>`;
  }
});
