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
    const filtered = offers;

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
      const valText = isPct ? `${o.discount_value}${t('offers-pct-suffix')}` : `<span class="sar" style="margin-right:4px;">\uE900</span>${o.discount_value}`;
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

  // Keyboard shortcut: Escape closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (offerModal.style.display !== 'none') closeModal();
      if (confirmModal.style.display !== 'none') closeConfirmModal();
    }
  });

  // ═══ Tabs ═══
  const tabGeneral = document.getElementById('tabGeneral');
  const tabProduct = document.getElementById('tabProduct');
  const generalOffersTab = document.getElementById('generalOffersTab');
  const productOffersTab = document.getElementById('productOffersTab');
  const btnAddLabel = document.getElementById('btnAddLabel');
  let activeTab = 'general';

  function switchTab(tab) {
    activeTab = tab;
    tabGeneral.classList.toggle('active', tab === 'general');
    tabProduct.classList.toggle('active', tab === 'product');
    generalOffersTab.style.display = tab === 'general' ? '' : 'none';
    productOffersTab.style.display = tab === 'product' ? '' : 'none';
    btnAddLabel.textContent = tab === 'general' ? 'إنشاء عرض جديد' : 'إضافة عرض أصناف';
    if (tab === 'product' && !productOffersLoaded) loadProductOffers();
  }

  tabGeneral.addEventListener('click', () => switchTab('general'));
  tabProduct.addEventListener('click', () => switchTab('product'));

  btnAddOffer.addEventListener('click', () => {
    if (activeTab === 'product') {
      openProductOfferModal(null);
    } else {
      if (offers && offers.length >= 1) {
        showToast('لا يمكن إضافة أكثر من عرض عام واحد', 'error');
        return;
      }
      openModal(null);
    }
  });

  // ═══════════════════════════════════════
  // PRODUCT OFFERS
  // ═══════════════════════════════════════
  const productOffersBody = document.getElementById('productOffersBody');
  const productOffersTable = document.getElementById('productOffersTable');
  const productEmptyState = document.getElementById('productEmptyState');
  const productOfferModal = document.getElementById('productOfferModal');
  const btnClosePoModal = document.getElementById('btnClosePoModal');
  const btnCancelPoModal = document.getElementById('btnCancelPoModal');
  const btnSaveProductOffer = document.getElementById('btnSaveProductOffer');
  const poModalTitle = document.getElementById('poModalTitle');
  const poSaveLabel = document.getElementById('poSaveLabel');
  const poProductsList = document.getElementById('poProductsList');
  const poSelectedCount = document.getElementById('poSelectedCount');
  const poDiscountTypeToggle = document.getElementById('poDiscountTypeToggle');
  const poValSuffix = document.getElementById('poValSuffix');

  const poFld = {
    id: document.getElementById('poOfferId'),
    name: document.getElementById('poName'),
    discountValue: document.getElementById('poDiscountValue'),
    startDate: document.getElementById('poStartDate'),
    endDate: document.getElementById('poEndDate')
  };

  let productOffers = [];
  let productOffersLoaded = false;
  let poDiscountType = 'percentage';
  let productsCache = null;

  poDiscountTypeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.dt-btn');
    if (!btn) return;
    poDiscountType = btn.dataset.type;
    poDiscountTypeToggle.querySelectorAll('.dt-btn').forEach(b => b.classList.toggle('active', b === btn));
    poValSuffix.textContent = poDiscountType === 'percentage' ? '%' : 'ر.س';
  });

  function renderProductOffers() {
    if (productOffers.length === 0) {
      productOffersTable.style.display = 'none';
      productEmptyState.style.display = '';
      return;
    }
    productOffersTable.style.display = '';
    productEmptyState.style.display = 'none';
    productOffersBody.innerHTML = productOffers.map(o => {
      const status = getProductOfferStatus(o);
      const isPct = o.discount_type === 'percentage';
      const valText = isPct ? `${o.discount_value}%` : `<span class="sar" style="margin-right:4px;">\uE900</span>${o.discount_value}`;
      const toggleLabel = o.is_active === 1 ? 'تعطيل' : 'تفعيل';
      const toggleClass = o.is_active === 1 ? 'act-btn-disable' : 'act-btn-enable';
      return `<tr>
        <td><div class="offer-name">${escHtml(o.name)}</div></td>
        <td><span class="badge ${isPct ? 'badge-pct' : 'badge-fixed'}">${isPct ? 'نسبة %' : 'مبلغ ثابت'}</span></td>
        <td><span class="discount-val">${valText}</span></td>
        <td><span class="badge badge-scheduled">${o.lines_count} صنف/عملية</span></td>
        <td><span class="date-cell" dir="ltr">${fmtDateTime(o.start_date)}</span></td>
        <td><span class="date-cell" dir="ltr">${fmtDateTime(o.end_date)}</span></td>
        <td><span class="badge ${statusBadgeClass(status)}">${statusLabel(status)}</span></td>
        <td>
          <div class="act-group">
            <button type="button" class="act-btn act-edit" data-po-action="edit" data-id="${o.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              تعديل
            </button>
            <button type="button" class="act-btn ${toggleClass}" data-po-action="toggle" data-id="${o.id}">
              ${o.is_active === 1
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64A9 9 0 0 1 12 21 9 9 0 0 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'}
              ${toggleLabel}
            </button>
            <button type="button" class="act-btn act-delete" data-po-action="delete" data-id="${o.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              حذف
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function getProductOfferStatus(offer) {
    if (offer.is_active === 0) return 'disabled';
    const now = new Date();
    if (offer.start_date && now < new Date(offer.start_date)) return 'scheduled';
    if (offer.end_date && now > new Date(offer.end_date)) return 'expired';
    return 'active';
  }

  async function loadProductOffers() {
    try {
      const res = await window.api.getProductOffers();
      if (!res || !res.success) { showToast(res?.message || 'خطأ في تحميل العروض', 'error'); return; }
      productOffers = res.offers || [];
      productOffersLoaded = true;
      renderProductOffers();
    } catch (err) {
      showToast(err.message || 'خطأ في الاتصال', 'error');
    }
  }

  const poSearchProducts = document.getElementById('poSearchProducts');
  let selectedProductLines = new Set();
  let poSearchTimer = null;

  poSearchProducts.addEventListener('input', () => {
    if (poSearchTimer) clearTimeout(poSearchTimer);
    poSearchTimer = setTimeout(() => {
      const q = poSearchProducts.value.trim().toLowerCase();
      const filtered = q ? productsCache.filter(p => p.product_name.toLowerCase().includes(q)) : productsCache;
      _renderProductGroups(filtered);
    }, 200);
  });

  function updateSelectedCount() {
    poSelectedCount.textContent = selectedProductLines.size > 0 ? `${selectedProductLines.size} عملية محددة` : '0 عملية محددة';
  }

  function _renderProductGroups(products) {
    if (!products || products.length === 0) {
      poProductsList.innerHTML = '<div class="po-loading">لا توجد أصناف مطابقة</div>';
      return;
    }
    poProductsList.innerHTML = products.map(p => {
      const linesHtml = p.lines.map(l => {
        const isChecked = selectedProductLines.has(Number(l.price_line_id)) ? 'checked' : '';
        return `<label class="po-line-item">
          <input type="checkbox" class="po-line-cb" value="${l.price_line_id}" ${isChecked} />
          <span class="po-service-name">${escHtml(l.service_name)}</span>
          <span class="po-price"><span class="sar" style="margin-right:4px;">\uE900</span>${parseFloat(l.price).toFixed(2)}</span>
        </label>`;
      }).join('');
      
      const allChecked = (p.lines.length > 0 && p.lines.every(l => selectedProductLines.has(Number(l.price_line_id)))) ? 'checked' : '';

      return `<div class="po-product-group">
        <div class="po-product-header">
          <label class="po-product-name">
            <input type="checkbox" class="po-product-all" ${allChecked} />
            <span>${escHtml(p.product_name)}</span>
          </label>
        </div>
        <div class="po-product-lines">${linesHtml}</div>
      </div>`;
    }).join('');

    poProductsList.querySelectorAll('.po-product-all').forEach(allCb => {
      allCb.addEventListener('change', () => {
        allCb.closest('.po-product-group').querySelectorAll('.po-line-cb').forEach(c => { 
          c.checked = allCb.checked; 
          const val = Number(c.value);
          if (c.checked) selectedProductLines.add(val);
          else selectedProductLines.delete(val);
        });
        updateSelectedCount();
      });
    });
    poProductsList.querySelectorAll('.po-line-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const val = Number(cb.value);
        if (cb.checked) selectedProductLines.add(val);
        else selectedProductLines.delete(val);

        const group = cb.closest('.po-product-group');
        const all = group.querySelectorAll('.po-line-cb');
        group.querySelector('.po-product-all').checked = Array.from(all).every(c => c.checked);
        updateSelectedCount();
      });
    });
  }

  function getSelectedPriceLineIds() {
    return Array.from(selectedProductLines);
  }

  function renderProductsList(products, selectedIds) {
    if (selectedIds) {
      selectedProductLines = new Set(selectedIds.map(Number));
    } else {
      selectedProductLines.clear();
    }
    _renderProductGroups(products);
    updateSelectedCount();
  }

  async function openProductOfferModal(offerId) {
    poFld.id.value = offerId || '';
    poFld.name.value = '';
    poFld.discountValue.value = '';
    poFld.startDate.value = '';
    poFld.endDate.value = '';
    poDiscountType = 'percentage';
    poDiscountTypeToggle.querySelectorAll('.dt-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'percentage'));
    poValSuffix.textContent = '%';
    poModalTitle.textContent = offerId ? 'تعديل عرض الأصناف' : 'إنشاء عرض أصناف جديد';
    poSaveLabel.textContent = offerId ? 'حفظ التعديلات' : 'حفظ العرض';
    productOfferModal.style.display = 'flex';

    if (!productsCache) {
      poProductsList.innerHTML = '<div class="po-loading">جاري التحميل...</div>';
      try {
        const res = await window.api.getProductsForOffers();
        if (!res || !res.success) throw new Error(res?.message || 'خطأ في تحميل الأصناف');
        productsCache = res.products;
      } catch (err) {
        poProductsList.innerHTML = `<div class="po-loading" style="color:var(--red)">${escHtml(err.message)}</div>`;
        return;
      }
    }

    let selectedIds = [];
    if (offerId) {
      try {
        const res = await window.api.getProductOfferById({ id: offerId });
        if (!res || !res.success) throw new Error(res?.message || 'خطأ');
        poFld.name.value = res.offer.name || '';
        poFld.discountValue.value = res.offer.discount_value || '';
        poFld.startDate.value = fmtDateTimeLocal(res.offer.start_date);
        poFld.endDate.value = fmtDateTimeLocal(res.offer.end_date);
        poDiscountType = res.offer.discount_type || 'percentage';
        poDiscountTypeToggle.querySelectorAll('.dt-btn').forEach(b => b.classList.toggle('active', b.dataset.type === poDiscountType));
        poValSuffix.textContent = poDiscountType === 'percentage' ? '%' : 'ر.س';
        selectedIds = res.price_line_ids || [];
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    poSearchProducts.value = '';
    poSuggestions.style.display = 'none';
    renderProductsList(productsCache, selectedIds);
    setTimeout(() => poFld.name.focus(), 100);
  }

  function closeProductOfferModal() {
    productOfferModal.style.display = 'none';
  }

  async function saveProductOffer() {
    const name = poFld.name.value.trim();
    const value = parseFloat(poFld.discountValue.value);
    const startDate = poFld.startDate.value || null;
    const endDate = poFld.endDate.value || null;

    if (!name) { showToast('اسم العرض مطلوب', 'error'); poFld.name.focus(); return; }
    if (isNaN(value) || value <= 0) { showToast('قيمة الخصم غير صالحة', 'error'); poFld.discountValue.focus(); return; }
    if (poDiscountType === 'percentage' && value > 100) { showToast('النسبة لا يمكن أن تتجاوز 100%', 'error'); return; }
    if (startDate && endDate && startDate > endDate) { showToast('تاريخ البداية يجب أن يكون قبل النهاية', 'error'); return; }

    const priceLineIds = getSelectedPriceLineIds();
    if (priceLineIds.length === 0) { showToast('يجب اختيار صنف واحد على الأقل', 'error'); return; }

    btnSaveProductOffer.disabled = true;
    try {
      const payload = { name, discountType: poDiscountType, discountValue: value, startDate, endDate, priceLineIds };
      const id = poFld.id.value;
      const res = id
        ? await window.api.updateProductOffer({ id: Number(id), ...payload })
        : await window.api.createProductOffer(payload);
      if (!res || !res.success) { showToast(res?.message || 'خطأ في الحفظ', 'error'); return; }
      showToast(id ? 'تم تحديث العرض بنجاح' : 'تم إنشاء العرض بنجاح', 'success');
      closeProductOfferModal();
      await loadProductOffers();
    } catch (err) {
      showToast(err.message || 'خطأ غير متوقع', 'error');
    } finally {
      btnSaveProductOffer.disabled = false;
    }
  }

  async function toggleProductOffer(id) {
    try {
      const res = await window.api.toggleProductOfferStatus({ id });
      if (!res || !res.success) { showToast(res?.message || 'خطأ', 'error'); return; }
      showToast('تم تغيير حالة العرض', 'success');
      await loadProductOffers();
    } catch (err) {
      showToast(err.message || 'خطأ', 'error');
    }
  }

  async function doDeleteProductOffer(id) {
    try {
      const res = await window.api.deleteProductOffer({ id });
      if (!res || !res.success) { showToast(res?.message || 'خطأ في الحذف', 'error'); return; }
      showToast('تم حذف العرض بنجاح', 'success');
      await loadProductOffers();
    } catch (err) {
      showToast(err.message || 'خطأ', 'error');
    }
  }

  productOffersBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-po-action]');
    if (!btn) return;
    const action = btn.dataset.poAction;
    const id = Number(btn.dataset.id);
    if (action === 'edit') openProductOfferModal(id);
    else if (action === 'toggle') toggleProductOffer(id);
    else if (action === 'delete') {
      confirmId = id;
      confirmResolve = null;
      openConfirmModal('هل تريد حذف هذا العرض نهائياً؟');
      btnConfirmDelete.onclick = () => { doDeleteProductOffer(id); closeConfirmModal(); };
    }
  });

  btnClosePoModal.addEventListener('click', closeProductOfferModal);
  btnCancelPoModal.addEventListener('click', closeProductOfferModal);
  btnSaveProductOffer.addEventListener('click', saveProductOffer);
  productOfferModal.addEventListener('click', (e) => { if (e.target === productOfferModal) closeProductOfferModal(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && productOfferModal.style.display !== 'none') closeProductOfferModal();
  });

  I18N.apply();
  loadOffers();
});
