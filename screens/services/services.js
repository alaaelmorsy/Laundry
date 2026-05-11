window.addEventListener('DOMContentLoaded', () => {
  try {
    const btnBack           = document.getElementById('btnBack');
    const btnAddService     = document.getElementById('btnAddService');
    const searchInput       = document.getElementById('searchInput');
    const servicesTableBody = document.getElementById('servicesTableBody');
    const emptyState        = document.getElementById('emptyState');
    const toastContainer    = document.getElementById('toastContainer');
    const confirmOverlay    = document.getElementById('confirmOverlay');
    const confirmMsg        = document.getElementById('confirmMsg');
    const btnConfirmOk      = document.getElementById('btnConfirmOk');
    const btnConfirmCancel  = document.getElementById('btnConfirmCancel');
    const paginationBar     = document.getElementById('paginationBar');
    const paginationInfo    = document.getElementById('paginationInfo');
    const pageNumbers       = document.getElementById('pageNumbers');
    const btnFirstPage      = document.getElementById('btnFirstPage');
    const btnPrevPage       = document.getElementById('btnPrevPage');
    const btnNextPage       = document.getElementById('btnNextPage');
    const btnLastPage       = document.getElementById('btnLastPage');
    const pageSizeSelect    = document.getElementById('pageSizeSelect');

    const modalOverlay      = document.getElementById('modalOverlay');
    const modalTitle        = document.getElementById('modalTitle');
    const modalError        = document.getElementById('modalError');
    const editServiceId     = document.getElementById('editServiceId');
    const inputNameAr       = document.getElementById('inputNameAr');
    const inputNameEn       = document.getElementById('inputNameEn');
    const btnModalClose     = document.getElementById('btnModalClose');
    const btnModalCancel    = document.getElementById('btnModalCancel');
    const btnModalSave      = document.getElementById('btnModalSave');
    const btnTranslate      = document.getElementById('btnTranslate');

    let currentServices = [];
    let currentPage     = 1;
    let currentPageSize = 50;
    let totalPages      = 1;
    let totalRecords    = 0;
    let currentFilters  = {};
    let filterTimer     = null;

    const LS_SERVICE_SORT   = 'laundryServicesSort';
    const SERVICE_SORT_KEYS = new Set(['id', 'name_ar', 'name_en', 'is_active', 'created_at', 'sort_order']);
    let sortBy = 'sort_order';
    let sortDir = 'asc';
    try {
      const raw = localStorage.getItem(LS_SERVICE_SORT);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.sortBy && SERVICE_SORT_KEYS.has(o.sortBy)) sortBy = o.sortBy;
        if (o.sortDir === 'asc' || o.sortDir === 'desc') sortDir = o.sortDir;
      }
    } catch (_) {}

    I18N.apply();

    btnBack.addEventListener('click', () => window.api.navigateBack());

    document.querySelectorAll('#servicesTableHead .th-sort-btn').forEach((btn) => {
      btn.addEventListener('click', () => onServiceSortClick(btn.dataset.sort));
    });
    updateServiceSortHeaderUI();

    btnAddService.addEventListener('click', () => openModal(null));
    btnModalClose.addEventListener('click', closeModal);
    btnModalCancel.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    btnModalSave.addEventListener('click', saveService);
    btnTranslate.addEventListener('click', autoTranslate);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    searchInput.addEventListener('input', applyFilters);

    btnFirstPage.addEventListener('click', () => goToPage(1));
    btnPrevPage.addEventListener('click',  () => goToPage(currentPage - 1));
    btnNextPage.addEventListener('click',  () => goToPage(currentPage + 1));
    btnLastPage.addEventListener('click',  () => goToPage(totalPages));

    pageSizeSelect.addEventListener('change', () => {
      currentPageSize = Number(pageSizeSelect.value);
      currentPage = 1;
      loadServices();
    });

    function applyFiltersImmediate() {
      currentPage = 1;
      buildFilters();
      loadServices();
    }

    function applyFilters() {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(applyFiltersImmediate, 300);
    }

    function buildFilters() {
      currentFilters = {};
      if (searchInput.value.trim()) currentFilters.search = searchInput.value.trim();
      currentFilters.sortBy = sortBy;
      currentFilters.sortDir = sortDir;
    }

    function updateServiceSortHeaderUI() {
      document.querySelectorAll('#servicesTableHead .th-sortable').forEach((th) => {
        const btn = th.querySelector('.th-sort-btn');
        const key = btn && btn.dataset.sort;
        th.classList.remove('sorted-active', 'sorted-asc', 'sorted-desc');
        th.removeAttribute('aria-sort');
        if (!btn || !key) return;
        if (key === sortBy) {
          th.classList.add('sorted-active', sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
          th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
          btn.title = sortDir === 'asc' ? I18N.t('table-sort-next-desc') : I18N.t('table-sort-next-asc');
        } else {
          btn.title = I18N.t('table-sort-activate');
        }
      });
    }

    function onServiceSortClick(sortKey) {
      if (!sortKey || !SERVICE_SORT_KEYS.has(sortKey)) return;
      if (sortKey === sortBy) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortBy = sortKey;
        sortDir = 'asc';
      }
      try {
        localStorage.setItem(LS_SERVICE_SORT, JSON.stringify({ sortBy, sortDir }));
      } catch (_) {}
      currentPage = 1;
      updateServiceSortHeaderUI();
      loadServices();
    }

    function formatServiceDate(val) {
      if (val == null || val === '') return '—';
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString(I18N.t('time-locale'), { dateStyle: 'short', timeStyle: 'short' });
    }

    async function applyServiceManualSortAndReload() {
      sortBy = 'sort_order';
      sortDir = 'asc';
      try {
        localStorage.setItem(LS_SERVICE_SORT, JSON.stringify({ sortBy, sortDir }));
      } catch (_) {}
      updateServiceSortHeaderUI();
      await loadServices();
    }

    function bindServicesRowDnD() {
      servicesTableBody.querySelectorAll('tr[data-row-id]').forEach((tr) => {
        const handle = tr.querySelector('.drag-handle');
        if (!handle) return;
        handle.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(tr.dataset.rowId));
          e.dataTransfer.effectAllowed = 'move';
          tr.classList.add('row-dragging');
        });
        handle.addEventListener('dragend', () => {
          tr.classList.remove('row-dragging');
          servicesTableBody.querySelectorAll('tr.row-drag-over').forEach((row) => row.classList.remove('row-drag-over'));
        });
        tr.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          tr.classList.add('row-drag-over');
        });
        tr.addEventListener('dragleave', (e) => {
          if (!tr.contains(e.relatedTarget)) tr.classList.remove('row-drag-over');
        });
        tr.addEventListener('drop', async (e) => {
          e.preventDefault();
          tr.classList.remove('row-drag-over');
          const draggedId = Number(e.dataTransfer.getData('text/plain'));
          const targetId = Number(tr.dataset.rowId);
          if (!draggedId || draggedId === targetId) return;
          try {
            const r = await window.api.reorderLaundryService({ id: draggedId, beforeId: targetId });
            if (r.success) {
              showToast(I18N.t('services-reorder-success'), 'success');
              await applyServiceManualSortAndReload();
            } else {
              showToast(r.message || I18N.t('services-err-generic'), 'error');
            }
          } catch (err) {
            showToast(I18N.t('services-err-db'), 'error');
          }
        });
      });
    }

    function isServiceActive(s) {
      const v = s.is_active;
      if (v === undefined || v === null) return true;
      return Number(v) === 1;
    }

    async function loadServices() {
      buildFilters();
      servicesTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="loading-cell">
            <div class="spinner"></div>
            <span>${I18N.t('services-loading')}</span>
          </td>
        </tr>`;
      emptyState.style.display    = 'none';
      paginationBar.style.display = 'none';

      try {
        const result = await window.api.getLaundryServices({
          page:     currentPage,
          pageSize: currentPageSize,
          ...currentFilters
        });

        if (result.success) {
          currentServices = result.services;
          totalRecords    = result.total;
          totalPages      = result.totalPages || 1;
          renderTable(currentServices);
          updateServiceSortHeaderUI();
          renderPagination();
        } else {
          showToast(I18N.t('services-err-load'), 'error');
          servicesTableBody.innerHTML = '';
        }
      } catch (err) {
        showToast(I18N.t('services-err-db'), 'error');
        console.error(err);
        servicesTableBody.innerHTML = '';
      }
    }

    function renderTable(services) {
      if (services.length === 0) {
        servicesTableBody.innerHTML = '';
        emptyState.style.display = 'flex';
        paginationBar.style.display = 'none';
        return;
      }

      emptyState.style.display = 'none';
      const indexStart = (currentPage - 1) * currentPageSize;

      servicesTableBody.innerHTML = services.map((s, i) => {
        const active = isServiceActive(s);
        const activeNum = active ? 1 : 0;
        const dragTitle = escHtml(I18N.t('services-drag-handle-title'));
        return `
      <tr class="${active ? '' : 'row-inactive'}" data-row-id="${s.id}">
        <td class="col-reorder">
          <span class="drag-handle" draggable="true" title="${dragTitle}">⋮⋮</span>
        </td>
        <td class="index-cell">${indexStart + i + 1}</td>
        <td class="col-order-num">${s.sort_order != null && s.sort_order !== '' ? escHtml(String(s.sort_order)) : '—'}</td>
        <td>${escHtml(s.name_ar || '—')}</td>
        <td dir="ltr" style="text-align:right">${escHtml(s.name_en || '—')}</td>
        <td>
          <span class="badge-status ${active ? 'badge-active' : 'badge-inactive'}">
            <span class="status-dot"></span>
            ${active ? I18N.t('services-status-active') : I18N.t('services-status-stopped')}
          </span>
        </td>
        <td>
          <div class="actions-cell">
            <button class="action-btn btn-edit" title="${I18N.t('services-btn-edit-title')}" data-action="edit" data-id="${s.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="action-btn ${active ? 'btn-deactivate' : 'btn-activate'}"
              title="${active ? I18N.t('services-btn-stop-title') : I18N.t('services-btn-resume-title')}"
              data-action="toggle" data-id="${s.id}" data-active="${activeNum}">
              ${active
                ? `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <rect x="6" y="6" width="12" height="12" rx="1"/>
                   </svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="8 5 19 12 8 19 8 5"/>
                   </svg>`
              }
            </button>
            <button class="action-btn btn-delete" title="${I18N.t('services-btn-delete-title')}" data-action="delete" data-id="${s.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
      }).join('');

      servicesTableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = currentServices.find(x => x.id == btn.dataset.id);
          if (row) openModal(row);
        });
      });
      servicesTableBody.querySelectorAll('[data-action="toggle"]').forEach(btn => {
        btn.addEventListener('click', () => toggleServiceStatus(Number(btn.dataset.id), Number(btn.dataset.active)));
      });
      servicesTableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = currentServices.find(x => x.id == btn.dataset.id);
          deleteService(Number(btn.dataset.id), row ? (row.name_ar || '') : '');
        });
      });
      bindServicesRowDnD();
    }

    async function toggleServiceStatus(id, currentActive) {
      const newActive = currentActive ? 0 : 1;
      try {
        const result = await window.api.toggleLaundryServiceStatus({ id, isActive: newActive });
        if (result.success) {
          showToast(newActive ? I18N.t('services-success-resume') : I18N.t('services-success-stop'), 'success');
          await loadServices();
        } else {
          showToast(result.message || I18N.t('services-err-generic'), 'error');
        }
      } catch (err) {
        showToast(I18N.t('services-err-db'), 'error');
      }
    }

    function renderPagination() {
      if (totalRecords === 0) {
        paginationBar.style.display = 'none';
        return;
      }
      paginationBar.style.display = 'flex';
      const start = (currentPage - 1) * currentPageSize + 1;
      const end   = Math.min(currentPage * currentPageSize, totalRecords);
      const loc   = I18N.t('time-locale');
      paginationInfo.textContent = I18N.t('services-pagination-info')
        .replace('{start}', start.toLocaleString(loc))
        .replace('{end}', end.toLocaleString(loc))
        .replace('{total}', totalRecords.toLocaleString(loc));

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
      loadServices();
    }

    function openModal(svc) {
      editServiceId.value   = svc ? svc.id : '';
      inputNameAr.value     = svc ? (svc.name_ar || '') : '';
      inputNameEn.value     = svc ? (svc.name_en || '') : '';

      modalTitle.textContent = svc
        ? I18N.t('services-modal-edit-title')
        : I18N.t('services-modal-add-title');
      hideModalError();
      modalOverlay.style.display = 'flex';
      setTimeout(() => inputNameAr.focus(), 100);
    }

    async function autoTranslate() {
      const text = inputNameAr.value.trim();
      if (!text) {
        showModalError(I18N.t('services-err-name-ar'));
        return;
      }
      btnTranslate.disabled = true;
      btnTranslate.classList.add('btn-translate-loading');
      hideModalError();
      try {
        const result = await window.api.translateText(text, 'en', 'ar');
        if (result.success) {
          inputNameEn.value = result.text;
        } else {
          showModalError(result.message || 'فشلت الترجمة');
        }
      } catch (err) {
        showModalError('خطأ في الاتصال بخدمة الترجمة');
      }
      btnTranslate.disabled = false;
      btnTranslate.classList.remove('btn-translate-loading');
    }

    function closeModal() {
      modalOverlay.style.display = 'none';
      hideModalError();
    }

    async function saveService() {
      const nameAr = inputNameAr.value.trim();
      const nameEn = inputNameEn.value.trim();

      if (!nameAr) { showModalError(I18N.t('services-err-name-ar')); return; }
      if (!nameEn) { showModalError(I18N.t('services-err-name-en')); return; }

      const id = editServiceId.value;
      const data = { nameAr, nameEn };

      btnModalSave.disabled = true;
      hideModalError();

      try {
        const result = id
          ? await window.api.updateLaundryService({ id: Number(id), ...data })
          : await window.api.createLaundryService(data);

        if (result.success) {
          closeModal();
          showToast(id ? I18N.t('services-success-update') : I18N.t('services-success-add'), 'success');
          await loadServices();
        } else {
          showModalError(result.message || I18N.t('services-err-generic'));
        }
      } catch (err) {
        showModalError(I18N.t('services-err-db'));
      }
      btnModalSave.disabled = false;
    }

    async function deleteService(id, nameAr) {
      confirmMsg.textContent       = I18N.t('services-confirm-delete').replace('{name}', nameAr);
      confirmOverlay.style.display = 'flex';

      await new Promise((resolve) => {
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
          const result = await window.api.deleteLaundryService({ id });
          if (result.success) {
            showToast(I18N.t('services-success-delete'), 'success');
            if (currentServices.length === 1 && currentPage > 1) currentPage--;
            await loadServices();
          } else {
            showToast(result.message || I18N.t('services-err-delete'), 'error');
          }
        } catch (err) {
          showToast(I18N.t('services-err-db'), 'error');
        }
      });
    }

    function showToast(msg, type) {
      const isSuccess = type === 'success';
      const toast = document.createElement('div');
      toast.className = `toast ${isSuccess ? 'toast-success' : 'toast-error'}`;
      toast.innerHTML = `
      <div class="toast-icon">
        ${isSuccess
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
        }
      </div>
      <span class="toast-text">${escHtml(msg)}</span>
      <button class="toast-close">✕</button>
      <span class="toast-progress"></span>`;
      toastContainer.appendChild(toast);
      const closeBtn = toast.querySelector('.toast-close');
      function dismiss() {
        toast.classList.add('toast-hide');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
      }
      closeBtn.addEventListener('click', dismiss);
      setTimeout(dismiss, 3500);
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

    loadServices();
  } catch (error) {
    console.error('Fatal error in services.js:', error);
    document.body.innerHTML = `<div style="color:red;padding:40px;text-align:center;">
      <h2>Error Loading Services</h2>
      <p>${error.message}</p>
    </div>`;
  }
});
