(function () {
  'use strict';

  const state = {
    hangers: [],
    search: '',
    searchInvoice: '',
    statusFilter: 'all',
    deletingId: null,
    editingId: null,
    viewingOrderId: null,
    lastInvoiceData: null,
  };

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  const els = {
    btnBack: document.getElementById('btnBack'),
    btnAddHanger: document.getElementById('btnAddHanger'),
    btnBatchCreate: document.getElementById('btnBatchCreate'),
    searchInput: document.getElementById('searchInput'),
    searchInvoiceInput: document.getElementById('searchInvoiceInput'),
    statusFilter: document.getElementById('statusFilter'),
    hangersGrid: document.getElementById('hangersGrid'),
    loadingState: document.getElementById('loadingState'),
    emptyState: document.getElementById('emptyState'),
    hangerModal: document.getElementById('hangerModal'),
    modalTitle: document.getElementById('modalTitle'),
    hangerId: document.getElementById('hangerId'),
    hangerNumber: document.getElementById('hangerNumber'),
    hangerLabel: document.getElementById('hangerLabel'),
    hangerStatus: document.getElementById('hangerStatus'),
    hangerNotes: document.getElementById('hangerNotes'),
    statusGroup: document.getElementById('statusGroup'),
    modalError: document.getElementById('modalError'),
    btnModalClose: document.getElementById('btnModalClose'),
    btnModalCancel: document.getElementById('btnModalCancel'),
    btnModalSave: document.getElementById('btnModalSave'),
    batchModal: document.getElementById('batchModal'),
    batchFrom: document.getElementById('batchFrom'),
    batchTo: document.getElementById('batchTo'),
    batchPreview: document.getElementById('batchPreview'),
    batchError: document.getElementById('batchError'),
    btnBatchClose: document.getElementById('btnBatchClose'),
    btnBatchCancel: document.getElementById('btnBatchCancel'),
    btnBatchSave: document.getElementById('btnBatchSave'),
    deleteModal: document.getElementById('deleteModal'),
    btnDeleteCancel: document.getElementById('btnDeleteCancel'),
    btnDeleteConfirm: document.getElementById('btnDeleteConfirm'),
  };

  function showToast(msg, type) {
    const existing = document.querySelectorAll('.toast');
    existing.forEach((el) => el.remove());
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  async function loadHangers() {
    showLoading(true);
    try {
      const res = await window.api.getHangers({ search: state.search, searchInvoice: state.searchInvoice, status: state.statusFilter });
      if (res && res.success) {
        state.hangers = res.hangers || [];
        renderHangers();
      } else {
        showToast(res?.message || t('hangers-err-load'), 'error');
        els.hangersGrid.innerHTML = '';
        els.emptyState.style.display = 'flex';
      }
    } catch (err) {
      console.error('[UI] loadHangers error:', err);
      showToast(t('hangers-err-server'), 'error');
      els.hangersGrid.innerHTML = '';
      els.emptyState.style.display = 'flex';
    } finally {
      showLoading(false);
    }
  }

  function showLoading(show) {
    if (show) {
      els.emptyState.style.display = 'none';
      els.hangersGrid.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <span>${t('hangers-loading')}</span>
        </div>
      `;
    } else {
      const loading = els.hangersGrid.querySelector('.loading-state');
      if (loading) loading.remove();
    }
  }

  function renderHangers() {
    if (state.hangers.length === 0) {
      els.hangersGrid.innerHTML = '';
      els.emptyState.style.display = 'flex';
      return;
    }
    els.emptyState.style.display = 'none';
    const tr = (k) => window.I18N ? window.I18N.t(k) : k;
    try {
      els.hangersGrid.innerHTML = state.hangers.map(h => {
        const statusClass = h.status || 'free';
        const statusLabel = {
          free: tr('hangers-status-free'),
          occupied: tr('hangers-status-occupied'),
          maintenance: tr('hangers-status-maintenance')
        }[statusClass] || statusClass;
        const orderInfo = h.order_id
          ? `<div class="hanger-order">${tr('hangers-order-invoice')} <a href="../invoices/invoices.html?id=${h.order_id}" target="_blank">#${h.invoice_seq || h.order_number || h.order_id}</a>${h.customer_name ? ' — ' + h.customer_name : ''}</div>`
          : '';
        const actions = [];
        if (h.order_id) {
          actions.push(`<button class="action-btn action-btn--view" onclick="viewOrder(${h.order_id})" title="${tr('invoices-btn-view')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>`);
        }
        actions.push(`<button class="action-btn action-btn--edit" onclick="editHanger(${h.id})" title="${tr('users-btn-edit-title')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`);
        actions.push(`<button class="action-btn action-btn--delete" onclick="confirmDelete(${h.id})" title="${tr('users-btn-delete')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`);

        return `
          <div class="hanger-card ${statusClass}">
            <div class="hanger-header">
              <span class="hanger-num">${h.hanger_number}</span>
              <span class="hanger-status ${statusClass}">
                <span class="status-dot ${statusClass}"></span>
                ${statusLabel}
              </span>
            </div>
            <div class="hanger-body">
              ${h.label ? `<div class="hanger-label">${escapeHtml(h.label)}</div>` : ''}
              ${orderInfo}
              ${h.notes ? `<div class="hanger-label" style="margin-top:4px;font-size:12px">${escapeHtml(h.notes)}</div>` : ''}
            </div>
            <div class="hanger-actions">${actions.join('')}</div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('renderHangers error:', err);
      els.hangersGrid.innerHTML = '';
      els.emptyState.style.display = 'flex';
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.viewOrder = async function(orderId) {
    try {
      // جلب بيانات الفاتورة من الخادم
      const res = await window.api.getOrderById({ id: orderId });
      if (!res || !res.success || !res.order) {
        showToast(t('hangers-err-load-invoice'), 'error');
        return;
      }

      const order = res.order;
      const items = res.items || [];
      const subscription = res.subscription || null;

      // جلب إعدادات التطبيق
      const settingsRes = await window.api.getAppSettings();
      const s = (settingsRes && settingsRes.success && settingsRes.settings) || {};

      // عرض modal الفاتورة
      showInvoiceModal(order, items, subscription, s);
    } catch (err) {
      console.error('viewOrder error:', err);
      showToast(t('hangers-err-server'), 'error');
    }
  };

  function showInvoiceModal(order, items, subscription, s) {
    const invoiceData = buildInvoiceDisplayData(order, items, subscription, s);
    const paperType = (s && s.invoicePaperType) || 'thermal';
    
    document.body.classList.toggle('invtype-a4', paperType === 'a4');
    
    if (paperType === 'a4') {
      fillA4InvoiceModal(invoiceData);
    } else {
      fillThermalInvoiceModal(invoiceData);
    }
    
    state.lastInvoiceData = invoiceData;
    state.viewingOrderId = order.id;
    
    document.getElementById('invoiceModal').style.display = 'flex';
    const dialogBody = document.querySelector('.inv-dialog-body');
    if (dialogBody) dialogBody.scrollTop = 0;
  }

  function buildInvoiceDisplayData(order, items, subscription, s) {
    const subtotal  = parseFloat(order.subtotal || 0);
    const discount  = parseFloat(order.discount_amount || 0);
    const extra     = parseFloat(order.extra_amount || 0);
    const vatRate   = parseFloat(order.vat_rate || 0);
    const vatAmount = parseFloat(order.vat_amount || 0);
    const total     = parseFloat(order.total_amount || 0);
    const isInclusive = order.price_display_mode === 'inclusive';
    const isMixed = String(order.payment_method || '') === 'mixed';
    const pc = parseFloat(order.paid_cash || 0);
    const pd = parseFloat(order.paid_card || 0);
    const paidAmount = parseFloat(order.paid_amount || 0);
    const remainingAmount = parseFloat(order.remaining_amount || 0);

    function formatInvoiceDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }

    function paymentLabel(method) {
      const labels = {
        cash: 'نقدي / Cash',
        card: 'شبكة / Card',
        mixed: 'مختلط / Mixed',
        subscription: 'اشتراك / Subscription',
        deferred: 'آجل / Deferred'
      };
      return labels[method] || method || '—';
    }

    function isoTimestamp(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr).toISOString();
    }

    function fmtLtr(n) {
      return Number(n || 0).toFixed(2);
    }

    const addressParts = [];
    if (s.cityAr) addressParts.push(s.cityAr);
    if (s.districtAr) addressParts.push(s.districtAr);
    if (s.streetAr) addressParts.push(s.streetAr);

    const shopName = s.laundryNameAr || '';
    const displaySeq = order.invoice_seq || order.order_number;
    const subtotalA4 = (isInclusive && vatRate > 0) ? (subtotal * 100 / (100 + vatRate)) : subtotal;

    return {
      shopNameAr:         s.laundryNameAr || '',
      shopNameEn:         s.laundryNameEn || '',
      shopAddressAr:      addressParts.length ? addressParts.join('، ') : (s.locationAr || ''),
      shopAddressEn:      s.locationEn || '',
      shopPhone:          s.phone || '',
      shopEmail:          s.email || '',
      vatNumber:          s.vatNumber || '',
      commercialRegister: s.commercialRegister || '',
      invoiceNotes:       s.invoiceNotes || '',
      logoDataUrl:        s.logoDataUrl || '',
      orderNum:           displaySeq ? String(displaySeq) : (order.order_number || '—'),
      date:               formatInvoiceDate(order.created_at),
      payment:            paymentLabel(order.payment_method),
      custName:           order.customer_name || '',
      custPhone:          order.phone || '',
      subPackageName:     subscription && subscription.package_name ? subscription.package_name : '',
      subBalance:         subscription && subscription.credit_remaining != null ? parseFloat(subscription.credit_remaining) : null,
      cleanedAt:          order.cleaning_date ? formatInvoiceDate(order.cleaning_date) : '',
      deliveredAt:        order.delivery_date ? formatInvoiceDate(order.delivery_date) : '',
      paidAt:             order.paid_at       ? formatInvoiceDate(order.paid_at)       : '',
      starch:             order.starch || '',
      bluing:             order.bluing || '',
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
      priceDisplayMode: isInclusive ? 'inclusive' : 'exclusive',
      paidAmount:       paidAmount,
      remainingAmount:  remainingAmount,
      createdBy:        order.created_by || '',
      paymentMethod:    order.payment_method || '',
      paymentStatus:    order.payment_status || '',
      qrPayload: vatRate > 0 ? {
        sellerName:  shopName,
        vatNumber:   s.vatNumber || '',
        timestamp:   isoTimestamp(order.created_at),
        totalAmount: fmtLtr(total),
        vatAmount:   fmtLtr(vatAmount)
      } : null
    };
  }

  window.editHanger = function(id) {
    const h = state.hangers.find(x => x.id === id);
    if (!h) return;
    state.editingId = id;
    els.modalTitle.textContent = t('hangers-modal-edit-title');
    els.hangerId.value = h.id;
    els.hangerNumber.value = h.hanger_number || '';
    els.hangerLabel.value = h.label || '';
    els.hangerStatus.value = h.status || 'free';
    els.hangerNotes.value = h.notes || '';
    els.statusGroup.style.display = '';
    els.modalError.style.display = 'none';
    els.hangerModal.style.display = 'flex';
  };

  window.confirmDelete = function(id) {
    state.deletingId = id;
    els.deleteModal.style.display = 'flex';
  };

  function openAddModal() {
    state.editingId = null;
    els.modalTitle.textContent = t('hangers-modal-add-title');
    els.hangerId.value = '';
    els.hangerNumber.value = '';
    els.hangerLabel.value = '';
    els.hangerStatus.value = 'free';
    els.hangerNotes.value = '';
    els.statusGroup.style.display = 'none';
    els.modalError.style.display = 'none';
    els.hangerModal.style.display = 'flex';
    setTimeout(() => els.hangerNumber.focus(), 50);
  }

  function closeAddModal() {
    els.hangerModal.style.display = 'none';
  }

  async function saveHanger() {
    const num = String(els.hangerNumber.value).trim();
    if (!num) {
      els.modalError.textContent = t('hangers-err-number-required');
      els.modalError.style.display = '';
      return;
    }
    els.btnModalSave.disabled = true;
    try {
      let res;
      if (state.editingId) {
        res = await window.api.updateHanger({
          id: state.editingId,
          hangerNumber: num,
          label: els.hangerLabel.value.trim(),
          status: els.hangerStatus.value,
          notes: els.hangerNotes.value.trim()
        });
      } else {
        res = await window.api.createHanger({
          hangerNumber: num,
          label: els.hangerLabel.value.trim(),
          notes: els.hangerNotes.value.trim()
        });
      }
      if (res && res.success) {
        showToast(state.editingId ? t('hangers-success-update') : t('hangers-success-add'), 'success');
        closeAddModal();
        await loadHangers();
      } else {
        els.modalError.textContent = res?.message || t('hangers-err-save');
        els.modalError.style.display = '';
      }
    } catch (err) {
      els.modalError.textContent = t('hangers-err-save');
      els.modalError.style.display = '';
    } finally {
      els.btnModalSave.disabled = false;
    }
  }

  function openBatchModal() {
    els.batchFrom.value = '';
    els.batchTo.value = '';
    els.batchPreview.textContent = t('hangers-batch-preview').replace('{count}', '0');
    els.batchError.style.display = 'none';
    els.batchModal.style.display = 'flex';
  }

  function closeBatchModal() {
    els.batchModal.style.display = 'none';
  }

  function updateBatchPreview() {
    const f = Math.max(1, Math.floor(Number(els.batchFrom.value) || 0));
    const tVal = Math.max(f, Math.floor(Number(els.batchTo.value) || 0));
    const count = Math.max(0, tVal - f + 1);
    els.batchPreview.textContent = t('hangers-batch-preview').replace('{count}', String(count));
  }

  async function saveBatch() {
    const f = Math.floor(Number(els.batchFrom.value));
    const tVal = Math.floor(Number(els.batchTo.value));
    if (!f || !tVal || f < 1 || tVal < 1 || tVal < f) {
      els.batchError.textContent = t('hangers-err-batch-invalid');
      els.batchError.style.display = '';
      return;
    }
    els.btnBatchSave.disabled = true;
    try {
      const res = await window.api.batchCreateHangers({ from: f, to: tVal });
      if (res && res.success) {
        const count = res.insertedCount ?? (res.to - res.from + 1);
        showToast(t('hangers-success-batch').replace('{count}', String(count)), 'success');
        closeBatchModal();
        await loadHangers();
      } else {
        els.batchError.textContent = res?.message || t('hangers-err-save');
        els.batchError.style.display = '';
      }
    } catch (err) {
      els.batchError.textContent = t('hangers-err-server');
      els.batchError.style.display = '';
    } finally {
      els.btnBatchSave.disabled = false;
    }
  }

  function closeDeleteModal() {
    els.deleteModal.style.display = 'none';
    state.deletingId = null;
  }

  async function doDelete() {
    if (!state.deletingId) return;
    els.btnDeleteConfirm.disabled = true;
    try {
      const res = await window.api.deleteHanger({ id: state.deletingId });
      if (res && res.success) {
        showToast(t('hangers-success-delete'), 'success');
        closeDeleteModal();
        await loadHangers();
      } else {
        showToast(res?.message || t('hangers-err-delete'), 'error');
      }
    } catch (err) {
      showToast(t('hangers-err-server'), 'error');
    } finally {
      els.btnDeleteConfirm.disabled = false;
    }
  }

  function fillThermalInvoiceModal(data) {
    function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val || ''; }
    function setHtml(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val || ''; }
    function showRow(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; }
    
    const sarSpan = '<span class="sar">&#xE900;</span>';
    const sarFmt = n => sarSpan + ' ' + Number(n || 0).toFixed(2);

    setText('invShopName', data.shopNameAr);
    setText('invShopAddress', data.shopAddressAr);
    setText('invShopPhone', data.shopPhone ? 'هاتف: ' + data.shopPhone : '');
    setText('invVatNumber', data.vatNumber ? 'الرقم الضريبي: ' + data.vatNumber : '');
    setText('invShopEmail', data.shopEmail);

    const logoEl = document.getElementById('invLogo');
    const logoWrap = document.getElementById('invLogoWrap');
    if (logoEl && logoWrap) {
      if (data.logoDataUrl) { logoEl.src = data.logoDataUrl; logoWrap.style.display = ''; }
      else { logoWrap.style.display = 'none'; }
    }

    setText('invOrderNum', data.orderNum);
    setText('invDate', data.date);
    
    const pmLabels = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك', deferred: 'آجل' };
    setText('invPayment', pmLabels[data.paymentMethod] || data.payment);
    
    showRow('invPaidAtRow', !!data.paidAt);
    if (data.paidAt) setText('invPaidAt', data.paidAt);
    showRow('invCleanedAtRow', !!data.cleanedAt);
    if (data.cleanedAt) setText('invCleanedAt', data.cleanedAt);
    showRow('invDeliveredAtRow', !!data.deliveredAt);
    if (data.deliveredAt) setText('invDeliveredAt', data.deliveredAt);
    
    if (data.commercialRegister) {
      setText('invCR', data.commercialRegister);
      showRow('invCRRow', true);
    } else {
      showRow('invCRRow', false);
    }

    if (data.createdBy) {
      setText('invCreatedBy', data.createdBy);
      showRow('invCreatedByRow', true);
    } else {
      showRow('invCreatedByRow', false);
    }

    const custSection = document.getElementById('invCustomerSection');
    if (custSection) {
      if (data.custName || data.custPhone) {
        custSection.style.display = '';
        showRow('invCustNameRow', !!data.custName);
        if (data.custName) setText('invCustName', data.custName);
        showRow('invCustPhoneRow', !!data.custPhone);
        if (data.custPhone) setText('invCustPhone', data.custPhone);
        
        if (data.subBalance != null && !isNaN(data.subBalance)) {
          setHtml('invSubBalance', sarFmt(data.subBalance));
          showRow('invSubBalRow', true);
        } else {
          showRow('invSubBalRow', false);
        }
      } else {
        custSection.style.display = 'none';
      }
    }

    const tbody = document.getElementById('invItemsTbody');
    if (tbody && data.items) {
      tbody.innerHTML = data.items.map(item => {
        const nameAr = escapeHtml(item.productAr || '');
        const nameEn = escapeHtml(item.productEn || '');
        const svcAr  = escapeHtml(item.serviceAr || '');
        const svcEn  = escapeHtml(item.serviceEn || '');

        const productCell = nameAr + (nameEn && nameEn !== nameAr ? '<br><span class="inv-td-en">' + nameEn + '</span>' : '');
        const serviceCell = svcAr + (svcEn && svcEn !== svcAr ? '<br><span class="inv-td-en">' + svcEn + '</span>' : '');

        return `<tr>
          <td class="inv-td-name">${productCell}</td>
          <td class="inv-td-num">${item.qty}</td>
          <td class="inv-td-amt">${Number(item.lineTotal || 0).toFixed(2)}</td>
          <td class="inv-td-name">${svcAr ? serviceCell : '—'}</td>
        </tr>`;
      }).join('');
    }

    setHtml('invSubtotal', sarFmt(data.subtotal));
    
    if (data.discount && data.discount > 0) {
      setHtml('invDiscount', sarFmt(data.discount));
      showRow('invDiscRow', true);
      if (data.discountLabel) {
        var discLblEl = document.querySelector('#invDiscRow .inv-total-label');
        if (discLblEl) discLblEl.textContent = data.discountLabel;
      }
      var afterDiscH = Number(data.subtotal || 0) - Number(data.discount || 0);
      setHtml('invAfterDiscount', sarFmt(afterDiscH));
      showRow('invAfterDiscRow', true);
    } else {
      showRow('invDiscRow', false);
      showRow('invAfterDiscRow', false);
    }
    
    if (data.extra && data.extra > 0) {
      setHtml('invExtra', sarFmt(data.extra));
      showRow('invExtraRow', true);
    } else {
      showRow('invExtraRow', false);
    }

    if (data.vatRate > 0) {
      setText('invVatLabel', `ضريبة القيمة المضافة (${data.vatRate}%)`);
      setHtml('invVat', sarFmt(data.vatAmount));
      showRow('invVatRow', true);
      setText('invSubtotalLabel', 'المجموع قبل الضريبة');
      setText('invTotalLabel', 'الإجمالي شامل الضريبة');
    } else {
      showRow('invVatRow', false);
      setText('invSubtotalLabel', 'المجموع');
      setText('invTotalLabel', 'الإجمالي');
    }

    setHtml('invTotal', sarFmt(data.total));

    if ((data.paidCash > 0) || (data.paidCard > 0)) {
      setHtml('invMixedCash', sarFmt(data.paidCash));
      showRow('invMixedCashRow', true);
      setHtml('invMixedCard', sarFmt(data.paidCard));
      showRow('invMixedCardRow', true);
    } else {
      showRow('invMixedCashRow', false);
      showRow('invMixedCardRow', false);
    }

    const isDeferred = data.paymentMethod === 'deferred' || data.remainingAmount > 0;
    if (isDeferred) {
      setHtml('invPaidAmount', sarFmt(data.paidAmount));
      showRow('invPaidRow', true);
      setHtml('invRemainingAmount', sarFmt(data.remainingAmount));
      showRow('invRemainingRow', true);
    } else {
      showRow('invPaidRow', false);
      showRow('invRemainingRow', false);
    }

    const invExtraOpts = document.getElementById('invExtraOpts');
    if (invExtraOpts) {
      const hasExtraOpts = data.starch || data.bluing;
      invExtraOpts.style.display = hasExtraOpts ? '' : 'none';
      
      if (data.starch) {
        setText('invStarch', data.starch);
        showRow('invStarchRow', true);
      } else {
        showRow('invStarchRow', false);
      }
      
      if (data.bluing) {
        setText('invBluing', data.bluing);
        showRow('invBluingRow', true);
      } else {
        showRow('invBluingRow', false);
      }
    }

    const invFooterNotes = document.getElementById('invFooterNotes');
    if (invFooterNotes) {
      if (data.invoiceNotes) {
        const invNotesContent = document.getElementById('invNotesContent');
        if (invNotesContent) invNotesContent.textContent = data.invoiceNotes;
        invFooterNotes.style.display = '';
      } else {
        invFooterNotes.style.display = 'none';
      }
    }

    if (data.qrPayload) {
      renderQR(data.qrPayload);
    } else {
      const qrEl = document.getElementById('invQR');
      if (qrEl) qrEl.innerHTML = '';
    }
  }

  function fillA4InvoiceModal(data) {
    function a4mText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val || ''; }
    function a4mHtml(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val || ''; }
    function a4mShow(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; }
    
    const sarSpan = '<span style="font-family:SaudiRiyal;">&#xE900;</span>';
    const sarFmt = n => sarSpan + Number(n || 0).toFixed(2);

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

    const logoEl = document.getElementById('a4mLogo');
    if (logoEl) {
      if (data.logoDataUrl) { logoEl.src = data.logoDataUrl; logoEl.style.display = ''; }
      else { logoEl.style.display = 'none'; }
    }

    a4mText('a4mOrderNum', data.orderNum);
    a4mText('a4mDate',     data.date);
    
    // طريقة الدفع بنفس التسميات من POS
    const pmLabels = { cash: 'نقداً', card: 'شبكة', credit: 'آجل', mixed: 'مختلط', bank: 'تحويل بنكي', subscription: 'اشتراك', deferred: 'آجل' };
    const paymentMethod = data.payment.toLowerCase().split(' ')[0]; // أخذ أول كلمة
    a4mText('a4mPayment', pmLabels[paymentMethod] || data.payment);
    
    a4mText('a4mCustName',  data.custName || '—');
    a4mText('a4mCustPhone', data.custPhone || '—');

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
    
    a4mShow('a4mRowStarch', !!data.starch);
    if (data.starch) a4mText('a4mStarch', data.starch);
    a4mShow('a4mRowBluing', !!data.bluing);
    if (data.bluing) a4mText('a4mBluing', data.bluing);

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

        const nameCell = escapeHtml(it.productAr || '') + (it.productEn && it.productEn !== it.productAr ? `<span class="a4m-td-en">${escapeHtml(it.productEn)}</span>` : '');
        const svcCell  = escapeHtml(it.serviceAr || '—') + (it.serviceEn && it.serviceEn !== it.serviceAr ? `<span class="a4m-td-en">${escapeHtml(it.serviceEn)}</span>` : '');

        return `<tr>
          <td class="a4m-td-num">${i + 1}</td>
          <td class="a4m-td-name">${nameCell}</td>
          <td class="a4m-td-name">${svcCell}</td>
          <td class="a4m-td-num">${it.qty || 1}</td>
          <td class="a4m-td-num">${sarSpan}${Number(it.unitPrice || 0).toFixed(2)}</td>
          <td class="a4m-td-num">${sarSpan}${net.toFixed(2)}</td>
          <td class="a4m-td-num">${sarSpan}${itemVat.toFixed(2)}</td>
          <td class="a4m-td-num">${sarSpan}${gross.toFixed(2)}</td>
        </tr>`;
      }).join('');
    }

    a4mHtml('a4mSubtotal', sarFmt(data.subtotal));
    
    if (data.discount && data.discount > 0) {
      a4mHtml('a4mDiscount', sarFmt(data.discount));
      a4mShow('a4mDiscRow', true);
      if (data.discountLabel) {
        var a4mDiscLbl = document.querySelector('#a4mDiscRow span');
        if (a4mDiscLbl) a4mDiscLbl.textContent = data.discountLabel + ' / Discount';
      }
      var afterDiscH4 = Number(data.subtotal || 0) - Number(data.discount || 0);
      a4mHtml('a4mAfterDiscount', sarFmt(afterDiscH4));
      a4mShow('a4mAfterDiscRow', true);
    } else {
      a4mShow('a4mDiscRow', false);
      a4mShow('a4mAfterDiscRow', false);
    }
    
    if (data.extra && data.extra > 0) {
      a4mHtml('a4mExtra', sarFmt(data.extra));
      a4mShow('a4mExtraRow', true);
    } else {
      a4mShow('a4mExtraRow', false);
    }

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

    if ((data.paidCash > 0) || (data.paidCard > 0)) {
      a4mHtml('a4mMixedCash', sarFmt(data.paidCash));
      a4mShow('a4mMixedCashRow', true);
      a4mHtml('a4mMixedCard', sarFmt(data.paidCard));
      a4mShow('a4mMixedCardRow', true);
    } else {
      a4mShow('a4mMixedCashRow', false);
      a4mShow('a4mMixedCardRow', false);
    }

    const isDeferred4 = data.paymentMethod === 'deferred' || data.remainingAmount > 0;
    if (isDeferred4) {
      a4mHtml('a4mPaidAmount', sarFmt(data.paidAmount));
      a4mShow('a4mPaidRow', true);
      a4mHtml('a4mRemainingAmount', sarFmt(data.remainingAmount));
      a4mShow('a4mRemainingRow', true);
    } else {
      a4mShow('a4mPaidRow', false);
      a4mShow('a4mRemainingRow', false);
    }

    const a4mFooterNotes = document.getElementById('a4mFooterNotes');
    if (a4mFooterNotes) {
      if (data.invoiceNotes) {
        const a4mNotesContent = document.getElementById('a4mNotesContent');
        if (a4mNotesContent) a4mNotesContent.textContent = data.invoiceNotes;
        a4mFooterNotes.style.display = '';
      } else {
        a4mFooterNotes.style.display = 'none';
      }
    }

    if (data.qrPayload) {
      renderQRA4(data.qrPayload);
    } else {
      const qrEl = document.getElementById('a4mQR');
      if (qrEl) qrEl.innerHTML = '';
    }
  }

  function renderQR(payload) {
    const qrEl = document.getElementById('invQR');
    if (!qrEl || !payload) return;
    qrEl.innerHTML = '';
    window.api.generateZatcaQR(payload)
      .then(res => {
        if (res && res.success && res.svg) {
          qrEl.innerHTML = res.svg;
        }
      })
      .catch(() => {});
  }

  function renderQRA4(payload) {
    const qrEl = document.getElementById('a4mQR');
    if (!qrEl || !payload) return;
    qrEl.innerHTML = '';
    window.api.generateZatcaQR(payload)
      .then(res => {
        if (res && res.success && res.svg) {
          qrEl.innerHTML = res.svg;
        }
      })
      .catch(() => {});
  }

  function closeInvoiceModal() {
    document.getElementById('invoiceModal').style.display = 'none';
    document.body.classList.remove('invtype-a4');
  }

  function bindEvents() {
    els.btnBack.addEventListener('click', () => window.api.navigateBack());
    els.btnAddHanger.addEventListener('click', openAddModal);
    els.btnBatchCreate.addEventListener('click', openBatchModal);
    els.btnModalClose.addEventListener('click', closeAddModal);
    els.btnModalCancel.addEventListener('click', closeAddModal);
    els.btnModalSave.addEventListener('click', saveHanger);
    els.btnBatchClose.addEventListener('click', closeBatchModal);
    els.btnBatchCancel.addEventListener('click', closeBatchModal);
    els.btnBatchSave.addEventListener('click', saveBatch);
    els.btnDeleteCancel.addEventListener('click', closeDeleteModal);
    els.btnDeleteConfirm.addEventListener('click', doDelete);

    // Invoice modal buttons
    const btnInvClose = document.getElementById('btnInvClose');
    const btnInvPrint = document.getElementById('btnInvPrint');
    const btnInvExportPdf = document.getElementById('btnInvExportPdf');
    const btnPrintHangerTicket = document.getElementById('btnPrintHangerTicket');
    const invoiceModal = document.getElementById('invoiceModal');
    
    if (btnInvClose) btnInvClose.addEventListener('click', closeInvoiceModal);
    if (btnInvPrint) btnInvPrint.addEventListener('click', () => window.print());
    if (btnInvExportPdf) {
      btnInvExportPdf.addEventListener('click', async () => {
        if (!state.lastInvoiceData) return;
        try {
          btnInvExportPdf.disabled = true;
          const paperType = (state.lastInvoiceData && state.lastInvoiceData.invoicePaperType) || 'thermal';
          const paperEl = document.getElementById(paperType === 'a4' ? 'invoicePaperA4m' : 'invoicePaper');
          if (!paperEl) return;
          const invoiceHTML = paperEl.outerHTML;
          const orderNum = state.lastInvoiceData.orderNum || '';
          const result = await window.api.exportInvoicePdfFromHtml({ html: invoiceHTML, paperType, orderNum });
          if (result && result.success) {
            showToast('تم تصدير PDF بنجاح', 'success');
          }
        } catch (err) {
          console.error('PDF export error:', err);
          showToast('فشل تصدير PDF', 'error');
        } finally {
          btnInvExportPdf.disabled = false;
        }
      });
    }
    if (btnPrintHangerTicket) {
      btnPrintHangerTicket.addEventListener('click', async () => {
        if (!state.viewingOrderId) {
          showToast('معرف الفاتورة غير موجود', 'error');
          return;
        }
        try {
          btnPrintHangerTicket.disabled = true;
          const result = await window.api.printHangerTicketThermal({ orderId: state.viewingOrderId });
          if (result.success) {
            showToast('تم طباعة التيكت بنجاح', 'success');
          } else {
            showToast(result.message || 'فشل طباعة التيكت', 'error');
          }
        } catch (err) {
          console.error('Ticket print error:', err);
          showToast('حدث خطأ أثناء طباعة التيكت', 'error');
        } finally {
          btnPrintHangerTicket.disabled = false;
        }
      });
    }
    if (invoiceModal) {
      invoiceModal.addEventListener('click', (e) => {
        if (e.target === invoiceModal) closeInvoiceModal();
      });
    }

    els.searchInput.addEventListener('input', () => {
      state.search = els.searchInput.value.trim();
      loadHangers();
    });

    if (els.searchInvoiceInput) {
      els.searchInvoiceInput.addEventListener('input', () => {
        state.searchInvoice = els.searchInvoiceInput.value.trim();
        loadHangers();
      });
    }

    els.statusFilter.addEventListener('change', () => {
      state.statusFilter = els.statusFilter.value;
      loadHangers();
    });

    els.batchFrom.addEventListener('input', updateBatchPreview);
    els.batchTo.addEventListener('input', updateBatchPreview);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const invoiceModal = document.getElementById('invoiceModal');
        if (invoiceModal && invoiceModal.style.display !== 'none') {
          closeInvoiceModal();
          return;
        }
        closeAddModal();
        closeBatchModal();
        closeDeleteModal();
      }
    });

    [els.hangerModal, els.batchModal, els.deleteModal].forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.style.display = 'none';
      });
    });
  }

  if (window.I18N) window.I18N.apply();
  bindEvents();
  loadHangers();
})();
