window.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const btnAddOffer = document.getElementById('btnAddOffer');
  const offerModal = document.getElementById('offerModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancel = document.getElementById('btnCancel');
  const btnSaveOffer = document.getElementById('btnSaveOffer');
  const btnSaveLabel = document.getElementById('btnSaveLabel');
  const modalTitle = document.getElementById('modalTitle');
  const offersBody = document.getElementById('offersBody');
  const emptyState = document.getElementById('emptyState');
  const offersTable = document.getElementById('offersTable');
  const searchInput = document.getElementById('searchInput');
  const filterStatus = document.getElementById('filterStatus');
  const toastContainer = document.getElementById('toastContainer');
  const discountTypeToggle = document.getElementById('discountTypeToggle');
  const valSuffix = document.getElementById('valSuffix');
  const confirmModal = document.getElementById('confirmModal');
  const btnConfirmCancel = document.getElementById('btnConfirmCancel');
  const btnConfirmDelete = document.getElementById('btnConfirmDelete');
  const confirmMsg = document.getElementById('confirmMsg');

  // Form fields
  const fld = {
    id: document.getElementById('offerId'),
    name: document.getElementById('offerName'),
    discountValue: document.getElementById('discountValue'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    description: document.getElementById('offerDescription')
  };

  let offers = [];
  let discountType = 'percentage';
  let searchTimer = null;

  const t = k => (window.I18N && I18N.t(k)) || k;

  // ═══ Toast ═══
  function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : 'toast-error'}`;
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  // ═══ Discount Type Toggle ═══
  discountTypeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.dt-btn');
    if (!btn) return;
    discountType = btn.dataset.type;
    discountTypeToggle.querySelectorAll('.dt-btn').forEach(b => b.classList.toggle('active', b === btn));
    valSuffix.textContent = discountType === 'percentage' ? t('offers-pct-suffix') : t('offers-currency');
  });

  // ═══ Status helpers ═══
  function getOfferStatus(offer) {
    if (offer.is_active === 0) return 'disabled';
    const now = new Date();
    const start = new Date(offer.start_date);
    const end = new Date(offer.end_date);
    if (now < start) return 'scheduled';
    if (now > end) return 'expired';
    return 'active';
  }

  function statusLabel(status) {
    const map = {
      active: t('offers-status-active'),
      scheduled: t('offers-status-scheduled'),
      expired: t('offers-status-expired'),
      disabled: t('offers-status-disabled')
    };
    return map[status] || status;
  }

  function statusBadgeClass(status) {
    const map = {
      active: 'badge-active',
      scheduled: 'badge-scheduled',
      expired: 'badge-expired',
      disabled: 'badge-disabled'
    };
    return map[status] || 'badge-disabled';
  }

  // ═══ Format date — English Gregorian numbers with time ═══
  function fmtDateTime(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return '—';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const h = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  // Format for datetime-local input value
  function fmtDateTimeLocal(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const h = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  }


  // ═══ Render table ═══
  function renderOffers() {
    const search = (searchInput.value || '').trim().toLowerCase();
    const statusFilter = filterStatus.value;

    const filtered = offers.filter(o => {
      const s = getOfferStatus(o);
      if (statusFilter !== 'all' && s !== statusFilter) return false;
      if (search) {
        const name = (o.name || '').toLowerCase();
        const desc = (o.description || '').toLowerCase();
        if (!name.includes(search) && !desc.includes(search)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      offersTable.style.display = 'none';
      emptyState.style.display = '';
    } else {
      offersTable.style.display = '';
      emptyState.style.display = 'none';
    }

    offersBody.innerHTML = filtered.map(o => {
      const status = getOfferStatus(o);
      const isPct = o.discount_type === 'percentage';
      const valText = isPct ? `${o.discount_value}${t('offers-pct-suffix')}` : `${o.discount_value} ${t('offers-currency')}`;
      const typeBadge = isPct ? 'badge-pct' : 'badge-fixed';
      const typeLabel = isPct ? t('offers-type-pct') : t('offers-type-fixed');
      const toggleLabel = o.is_active === 1 ? t('offers-btn-disable') : t('offers-btn-enable');
      const toggleClass = o.is_active === 1 ? 'act-btn-disable' : 'act-btn-enable';

      return `<tr data-id="${o.id}">
        <td>
          <div class="offer-name">${escHtml(o.name)}</div>
          ${o.description ? `<div class="offer-desc">${escHtml(o.description)}</div>` : ''}
        </td>
        <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
        <td><span class="discount-val">${valText}</span></td>
        <td><span class="date-cell" dir="ltr">${fmtDateTime(o.start_date)}</span></td>
        <td><span class="date-cell" dir="ltr">${fmtDateTime(o.end_date)}</span></td>
        <td><span class="badge ${statusBadgeClass(status)}">${statusLabel(status)}</span></td>
        <td>
          <div class="act-group">
            <button type="button" class="act-btn act-edit" data-action="edit" data-id="${o.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              ${t('offers-btn-edit')}
            </button>
            <button type="button" class="act-btn ${toggleClass}" data-action="toggle" data-id="${o.id}">
              ${o.is_active === 1
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64A9 9 0 0 1 12 21 9 9 0 0 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'}
              ${toggleLabel}
            </button>
            <button type="button" class="act-btn act-delete" data-action="delete" data-id="${o.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              ${t('offers-btn-delete')}
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ═══ Load offers ═══
  async function loadOffers() {
    try {
      const res = await window.api.getOffers();
      if (!res || !res.success) {
        showToast(t('offers-err-load'), 'error');
        return;
      }
      offers = res.offers || [];
      renderOffers();
    } catch (err) {
      showToast(err.message || t('offers-err-connect'), 'error');
    }
  }

  // ═══ Modal ═══
  function openModal(offer) {
    if (offer) {
      modalTitle.textContent = t('offers-modal-edit');
      btnSaveLabel.textContent = t('offers-btn-update');
      fld.id.value = offer.id;
      fld.name.value = offer.name || '';
      fld.discountValue.value = offer.discount_value || '';
      fld.startDate.value = fmtDateTimeLocal(offer.start_date);
      fld.endDate.value = fmtDateTimeLocal(offer.end_date);
      fld.description.value = offer.description || '';
      discountType = offer.discount_type || 'percentage';
    } else {
      modalTitle.textContent = t('offers-modal-create');
      btnSaveLabel.textContent = t('offers-btn-save');
      fld.id.value = '';
      fld.name.value = '';
      fld.discountValue.value = '';
      fld.startDate.value = '';
      fld.endDate.value = '';
      fld.description.value = '';
      discountType = 'percentage';
    }

    // Update toggle UI
    discountTypeToggle.querySelectorAll('.dt-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === discountType);
    });
    valSuffix.textContent = discountType === 'percentage' ? t('offers-pct-suffix') : t('offers-currency');

    offerModal.style.display = 'flex';
    setTimeout(() => fld.name.focus(), 100);
  }

  function closeModal() {
    offerModal.style.display = 'none';
  }

  // ═══ Save offer ═══
  async function saveOffer() {
    const name = fld.name.value.trim();
    const value = parseFloat(fld.discountValue.value);
    const startDate = fld.startDate.value;
    const endDate = fld.endDate.value;

    if (!name) { showToast(t('offers-err-name-required'), 'error'); fld.name.focus(); return; }
    if (isNaN(value) || value <= 0) { showToast(t('offers-err-value-invalid'), 'error'); fld.discountValue.focus(); return; }
    if (discountType === 'percentage' && value > 100) { showToast(t('offers-err-pct-max'), 'error'); return; }
    if (!startDate) { showToast(t('offers-err-start-required'), 'error'); return; }
    if (!endDate) { showToast(t('offers-err-end-required'), 'error'); return; }
    if (startDate > endDate) { showToast(t('offers-err-date-order'), 'error'); return; }

    btnSaveOffer.disabled = true;

    try {
      const payload = {
        name,
        discountType,
        discountValue: value,
        startDate,
        endDate,
        description: fld.description.value.trim()
      };

      const id = fld.id.value;
      let res;
      if (id) {
        res = await window.api.updateOffer({ id: Number(id), ...payload });
      } else {
        res = await window.api.createOffer(payload);
      }

      if (!res || !res.success) {
        showToast(res?.message || t('offers-err-save'), 'error');
        return;
      }

      showToast(id ? t('offers-success-update') : t('offers-success-create'), 'success');
      closeModal();
      await loadOffers();
    } catch (err) {
      showToast(err.message || t('offers-err-unexpected'), 'error');
    } finally {
      btnSaveOffer.disabled = false;
    }
  }

  // ═══ Toggle / Delete ═══
  async function toggleOffer(id) {
    try {
      const res = await window.api.toggleOffer({ id });
      if (!res || !res.success) { showToast(res?.message || t('offers-err-toggle'), 'error'); return; }
      showToast(t('offers-success-toggle'), 'success');
      await loadOffers();
    } catch (err) {
      showToast(err.message || t('offers-err-generic'), 'error');
    }
  }

  let confirmResolve = null;
  let confirmId = null;

  function openConfirmModal(msg) {
    confirmMsg.textContent = msg;
    confirmModal.style.display = 'flex';
  }

  function closeConfirmModal() {
    confirmModal.style.display = 'none';
    confirmId = null;
    confirmResolve = null;
  }

  async function deleteOffer(id) {
    return new Promise((resolve) => {
      confirmId = id;
      confirmResolve = resolve;
      openConfirmModal(t('offers-confirm-delete'));
    });
  }

  async function doDeleteOffer(id) {
    try {
      const res = await window.api.deleteOffer({ id });
      if (!res || !res.success) { showToast(res?.message || t('offers-err-delete'), 'error'); return; }
      showToast(t('offers-success-delete'), 'success');
      await loadOffers();
    } catch (err) {
      showToast(err.message || t('offers-err-generic'), 'error');
    }
  }

  // ═══ Table actions ═══
  offersBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);
    if (action === 'edit') {
      const offer = offers.find(o => o.id === id);
      if (offer) openModal(offer);
    } else if (action === 'toggle') {
      toggleOffer(id);
    } else if (action === 'delete') {
      deleteOffer(id);
    }
  });

  // ═══ Events ═══
  btnBack.addEventListener('click', () => window.api.navigateBack());
  btnAddOffer.addEventListener('click', () => openModal(null));
  btnCloseModal.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  btnSaveOffer.addEventListener('click', saveOffer);

  btnConfirmCancel.addEventListener('click', closeConfirmModal);
  btnConfirmDelete.addEventListener('click', () => {
    if (confirmId !== null) {
      doDeleteOffer(confirmId);
    }
    closeConfirmModal();
  });
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirmModal();
  });

  offerModal.addEventListener('click', (e) => {
    if (e.target === offerModal) closeModal();
  });

  searchInput.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(renderOffers, 150);
  });

  filterStatus.addEventListener('change', renderOffers);

  // Keyboard shortcut: Escape closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (offerModal.style.display !== 'none') closeModal();
      if (confirmModal.style.display !== 'none') closeConfirmModal();
    }
  });

  I18N.apply();
  loadOffers();
});
