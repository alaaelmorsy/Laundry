(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────────
  const state = {
    selectedCustomer: null,
    products: [],
    selectedProductId: null,
    customPrices: {},    // { "pid:sid": customPrice (number) }
    originalPrices: {},  // { "pid:sid": customPrice } — from DB
    isDirty: false
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────────
  let elBtnSave, elBtnBack, elSearchInput;
  let elSummaryBar, elSumTotal, elSumCustom, elSumAvg;
  let elStateNoCustomer, elSplitLayout;
  let elProductList, elStateNoProduct, elServicesPanel, elDetailProductName, elServicesTbody;
  // Autocomplete
  let elCustSearchInput, elCustSuggestions, elCustClearBtn;
  let allCustomers = [];
  let custSugActiveIdx = -1;

  function tr(key, fallback) {
    return window.I18N && typeof window.I18N.t === 'function' ? window.I18N.t(key) : (fallback || key);
  }

  function formatMessage(key, vars, fallback) {
    return Object.keys(vars || {}).reduce(function (msg, name) {
      return msg.replace(new RegExp('\\{' + name + '\\}', 'g'), vars[name]);
    }, tr(key, fallback));
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    elBtnSave          = document.getElementById('btnSave');
    elBtnBack          = document.getElementById('btnBack');
    elSearchInput      = document.getElementById('searchInput');
    elSummaryBar       = document.getElementById('summaryBar');
    elSumTotal         = document.getElementById('sumTotal');
    elSumCustom        = document.getElementById('sumCustom');
    elSumAvg           = document.getElementById('sumAvg');
    elStateNoCustomer  = document.getElementById('stateNoCustomer');
    elSplitLayout      = document.getElementById('splitLayout');
    elProductList      = document.getElementById('productList');
    elStateNoProduct   = document.getElementById('stateNoProduct');
    elServicesPanel    = document.getElementById('servicesPanel');
    elDetailProductName= document.getElementById('detailProductName');
    elServicesTbody    = document.getElementById('servicesTbody');
    elCustSearchInput  = document.getElementById('customerSearchInput');
    elCustSuggestions  = document.getElementById('customerSuggestions');
    elCustClearBtn     = document.getElementById('customerClearBtn');

    if (window.I18N && typeof window.I18N.apply === 'function') {
      window.I18N.apply();
    }

    elBtnBack.addEventListener('click', function () { history.back(); });
    elBtnSave.addEventListener('click', handleSave);

    // ── Customer autocomplete events
    elCustSearchInput.addEventListener('input', function () {
      custSugActiveIdx = -1;
      const q = elCustSearchInput.value.trim();
      if (q.length === 0) { closeSuggestions(); return; }
      showCustomerSuggestions(q);
    });
    elCustSearchInput.addEventListener('keydown', function (e) {
      const items = elCustSuggestions.querySelectorAll('.customer-sug-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        custSugActiveIdx = Math.min(custSugActiveIdx + 1, items.length - 1);
        updateActiveSug(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        custSugActiveIdx = Math.max(custSugActiveIdx - 1, 0);
        updateActiveSug(items);
      } else if (e.key === 'Enter') {
        if (custSugActiveIdx >= 0 && items[custSugActiveIdx]) {
          items[custSugActiveIdx].click();
        }
      } else if (e.key === 'Escape') {
        closeSuggestions();
      }
    });
    elCustSearchInput.addEventListener('focus', function () {
      const q = elCustSearchInput.value.trim();
      if (q.length > 0) showCustomerSuggestions(q);
    });
    elCustClearBtn.addEventListener('click', function () {
      elCustSearchInput.value = '';
      elCustClearBtn.style.display = 'none';
      closeSuggestions();
      state.selectedCustomer = null;
      state.products = [];
      state.selectedProductId = null;
      state.customPrices = {};
      state.originalPrices = {};
      state.isDirty = false;
      showNoCustomer();
    });
    // Close suggestions on outside click
    document.addEventListener('click', function (e) {
      if (!document.getElementById('customerAutoWrap').contains(e.target)) {
        closeSuggestions();
      }
    });

    // Product search
    let searchTimer;
    elSearchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { renderProductList(elSearchInput.value.trim()); }, 300);
    });

    elBtnSave.disabled = true;
    window.addEventListener('app-language-changed', rerenderTranslatedContent);
    loadCustomers();
  }

  function rerenderTranslatedContent() {
    if (state.selectedCustomer) {
      renderProductList(elSearchInput.value.trim());
      const selected = state.products.find(function (p) { return p.id === state.selectedProductId; });
      if (selected) renderServicesTable(selected);
    }
  }

  // ── Load Customers ────────────────────────────────────────────────────────────
  async function loadCustomers() {
    try {
      const res = await window.api.getCustomers({ page: 1, pageSize: 500 });
      if (!res || !res.customers) return;
      allCustomers = res.customers;

      // Handle query param ?customer_id=N
      const preId = parseInt(new URLSearchParams(location.search).get('customer_id'));
      if (preId) {
        const found = allCustomers.find(function (c) { return c.id === preId; });
        if (found) {
          elCustSearchInput.value = found.customer_name + (found.phone ? ' - ' + found.phone : '');
          elCustClearBtn.style.display = 'flex';
          selectCustomer(preId);
        }
      }
    } catch (e) {
      console.error('[CCP] loadCustomers error', e);
    }
  }

  // ── Autocomplete helpers ──────────────────────────────────────────────────────
  function showCustomerSuggestions(query) {
    const filtered = allCustomers.filter(function (c) {
          const q = query.toLowerCase();
          return (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
                 (c.phone && c.phone.includes(q));
        }).slice(0, 30);

    if (filtered.length === 0) {
      elCustSuggestions.innerHTML = '<li class="customer-sug-empty">' + tr('ccp-no-results', 'لا توجد نتائج') + '</li>';
    } else {
      elCustSuggestions.innerHTML = filtered.map(function (c) {
        return '<li class="customer-sug-item" data-id="' + c.id + '">' +
          '<span class="customer-sug-name">' + escHtml(c.customer_name) + '</span>' +
          (c.phone ? '<span class="customer-sug-phone">' + escHtml(c.phone) + '</span>' : '') +
          '</li>';
      }).join('');
      elCustSuggestions.querySelectorAll('.customer-sug-item').forEach(function (li) {
        li.addEventListener('click', function () {
          const id = parseInt(li.getAttribute('data-id'));
          const cust = allCustomers.find(function (c) { return c.id === id; });
          if (cust) {
            elCustSearchInput.value = cust.customer_name + (cust.phone ? ' - ' + cust.phone : '');
            elCustClearBtn.style.display = 'flex';
          }
          closeSuggestions();
          selectCustomer(id);
        });
      });
    }
    elCustSuggestions.style.display = 'block';
  }

  function updateActiveSug(items) {
    items.forEach(function (el, i) {
      el.classList.toggle('active', i === custSugActiveIdx);
    });
  }

  function closeSuggestions() {
    elCustSuggestions.style.display = 'none';
    custSugActiveIdx = -1;
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Select Customer ───────────────────────────────────────────────────────────
  async function selectCustomer(customerId) {
    try {
      elBtnSave.disabled = true;
      elSplitLayout.style.display = 'none';
      elStateNoCustomer.style.display = 'flex';
      elSummaryBar.style.display = 'none';

      const res = await window.api.getCustomPricesScreenData({ customerId: customerId });
      if (!res || !res.success) {
        showToast(res && res.message ? res.message : tr('ccp-load-error', 'فشل تحميل البيانات'), 'error');
        return;
      }

      state.selectedCustomer = res.customer;
      state.products = res.products;
      state.selectedProductId = null;
      state.isDirty = false;

      // Build customPrices & originalPrices maps
      state.customPrices = {};
      state.originalPrices = {};
      res.products.forEach(function (p) {
        p.services.forEach(function (s) {
          if (s.customPrice !== null && s.customPrice !== undefined) {
            const key = p.id + ':' + s.laundryServiceId;
            state.customPrices[key] = parseFloat(s.customPrice);
            state.originalPrices[key] = parseFloat(s.customPrice);
          }
        });
      });

      elStateNoCustomer.style.display = 'none';
      elSplitLayout.style.display = 'flex';
      elSummaryBar.style.display = 'flex';

      renderProductList('');
      renderSummaryCards();
      showNoProductSelected();

      // Auto-select first product
      if (state.products.length > 0) selectProduct(state.products[0].id);

    } catch (e) {
      console.error('[CCP] selectCustomer error', e);
      showToast(tr('ccp-load-customer-error', 'فشل تحميل بيانات العميل'), 'error');
    }
  }

  function showNoCustomer() {
    elStateNoCustomer.style.display = 'flex';
    elSplitLayout.style.display = 'none';
    elSummaryBar.style.display = 'none';
    elBtnSave.disabled = true;
  }

  // ── Product List ──────────────────────────────────────────────────────────────
  function renderProductList(filter) {
    const q = (filter || '').toLowerCase();
    const filtered = state.products.filter(function (p) {
      return !q || p.name_ar.toLowerCase().indexOf(q) !== -1 || (p.name_en || '').toLowerCase().indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
      elProductList.innerHTML = '<div class="empty-state small"><p>' + tr('ccp-no-products', 'لا توجد أصناف') + '</p></div>';
      return;
    }

    elProductList.innerHTML = filtered.map(function (p) {
      const customCount = countCustomForProduct(p.id);
      const hasCustom = customCount > 0;
      const isActive = state.selectedProductId === p.id;
      return '<div class="product-item' + (isActive ? ' active' : '') + '" data-pid="' + p.id + '">' +
        '<div class="dot-indicator' + (hasCustom ? ' has-custom' : '') + '"></div>' +
        '<div class="product-item-info">' +
          '<div class="product-item-name">' + escHtml(p.name_ar) + '</div>' +
          '<div class="product-item-badge' + (hasCustom ? ' has-custom' : '') + '">' +
            getCustomBadgeText(customCount) +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    elProductList.querySelectorAll('.product-item').forEach(function (el) {
      el.addEventListener('click', function () {
        selectProduct(parseInt(el.dataset.pid));
      });
    });
  }

  function countCustomForProduct(productId) {
    const product = state.products.find(function (p) { return p.id === productId; });
    if (!product) return 0;
    return product.services.filter(function (s) {
      const key = productId + ':' + s.laundryServiceId;
      return key in state.customPrices;
    }).length;
  }

  // ── Select Product & Services Table ───────────────────────────────────────────
  function selectProduct(productId) {
    state.selectedProductId = productId;
    const product = state.products.find(function (p) { return p.id === productId; });
    if (!product) { showNoProductSelected(); return; }

    // Update active state in list
    elProductList.querySelectorAll('.product-item').forEach(function (el) {
      el.classList.toggle('active', parseInt(el.dataset.pid) === productId);
    });

    elDetailProductName.textContent = product.name_ar;
    elStateNoProduct.style.display = 'none';
    elServicesPanel.style.display = 'block';

    renderServicesTable(product);
  }

  function showNoProductSelected() {
    elStateNoProduct.style.display = 'flex';
    elServicesPanel.style.display = 'none';
  }

  function renderServicesTable(product) {
    elServicesTbody.innerHTML = product.services.map(function (s) {
      const key = product.id + ':' + s.laundryServiceId;
      const customVal = key in state.customPrices ? state.customPrices[key] : '';
      const hasCustom = key in state.customPrices;
      const generalPrice = parseFloat(s.generalPrice);
      const inputClass = hasCustom ? getPriceInputClass(parseFloat(customVal), generalPrice) : '';
      const generalClass = hasCustom ? 'crossed' : '';
      const diffHtml = hasCustom ? buildDiffBadge(parseFloat(customVal), generalPrice) : '';

      return '<tr data-pid="' + product.id + '" data-sid="' + s.laundryServiceId + '">' +
        '<td class="service-name">' + escHtml(s.serviceName_ar) + '</td>' +
        '<td><span class="general-price ' + generalClass + '">' + fmtPrice(generalPrice) + '</span> <span class="sar">&#xE900;</span></td>' +
        '<td>' +
          '<div class="price-input-wrap">' +
            '<input type="number" min="0" step="0.01" class="price-input ' + inputClass + '" ' +
              'value="' + (hasCustom ? customVal : '') + '" ' +
              'placeholder="' + fmtPrice(generalPrice) + '" ' +
              'data-pid="' + product.id + '" data-sid="' + s.laundryServiceId + '" ' +
              'data-general="' + generalPrice + '" />' +
          '</div>' +
        '</td>' +
        '<td class="diff-cell">' + diffHtml + '</td>' +
        '<td>' +
          '<button class="clear-btn" data-pid="' + product.id + '" data-sid="' + s.laundryServiceId + '"' +
            (hasCustom ? '' : ' disabled') + ' title="' + tr('ccp-delete-custom-price', 'حذف السعر الخاص') + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
          '</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    // Bind price input events
    elServicesTbody.querySelectorAll('.price-input').forEach(function (input) {
      input.addEventListener('input', function () {
        onPriceInput(input);
      });
    });

    // Bind clear buttons
    elServicesTbody.querySelectorAll('.clear-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        clearPrice(parseInt(btn.dataset.pid), parseInt(btn.dataset.sid));
      });
    });
  }

  // ── Price Input Handling ───────────────────────────────────────────────────────
  function onPriceInput(input) {
    const pid = parseInt(input.dataset.pid);
    const sid = parseInt(input.dataset.sid);
    const key = pid + ':' + sid;
    const generalPrice = parseFloat(input.dataset.general);
    const raw = input.value.trim();

    if (raw === '' || raw === null) {
      // Clear custom price
      delete state.customPrices[key];
      input.className = 'price-input';
    } else {
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 0) {
        state.customPrices[key] = val;
        input.className = 'price-input dirty ' + getPriceInputClass(val, generalPrice);
      }
    }

    state.isDirty = true;
    updateSaveButton();

    // Update diff badge and general price style for this row
    const row = input.closest('tr');
    if (row) {
      const hasCustom = key in state.customPrices;
      const customVal = state.customPrices[key];
      row.querySelector('.general-price').className = 'general-price' + (hasCustom ? ' crossed' : '');
      const diffCell = row.querySelector('.diff-cell');
      diffCell.innerHTML = hasCustom ? buildDiffBadge(customVal, generalPrice) : '';
      const clearBtn = row.querySelector('.clear-btn');
      if (clearBtn) clearBtn.disabled = !hasCustom;
    }

    renderSummaryCards();
    updateProductListIndicators();
  }

  function clearPrice(pid, sid) {
    const key = pid + ':' + sid;
    delete state.customPrices[key];

    // Update the row
    const input = elServicesTbody.querySelector('input[data-pid="' + pid + '"][data-sid="' + sid + '"]');
    if (input) {
      input.value = '';
      input.className = 'price-input';
      const row = input.closest('tr');
      if (row) {
        row.querySelector('.general-price').className = 'general-price';
        row.querySelector('.diff-cell').innerHTML = '';
        const clearBtn = row.querySelector('.clear-btn');
        if (clearBtn) clearBtn.disabled = true;
      }
    }

    state.isDirty = true;
    updateSaveButton();
    renderSummaryCards();
    updateProductListIndicators();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function getPriceInputClass(customVal, generalPrice) {
    if (customVal === 0) return 'zero';
    if (customVal > generalPrice) return 'higher';
    return 'saving';
  }

  function buildDiffBadge(customVal, generalPrice) {
    if (customVal === 0) {
      return '<span class="diff-badge zero">' + tr('ccp-free', 'مجاني') + '</span>';
    }
    if (generalPrice <= 0) return '';
    const diff = generalPrice - customVal;
    const pct = (diff / generalPrice * 100).toFixed(1);
    if (customVal > generalPrice) {
      return '<span class="diff-badge higher">' + formatMessage('ccp-higher-by', { pct: Math.abs(pct) }, 'أعلى بـ {pct}%') + '</span>';
    }
    return '<span class="diff-badge saving">' + formatMessage('ccp-save-percent', { pct: pct }, 'وفر {pct}%') + '</span>';
  }

  function fmtPrice(v) {
    if (v === null || v === undefined) return '';
    return parseFloat(v).toFixed(2);
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Summary Cards ─────────────────────────────────────────────────────────────
  function renderSummaryCards() {
    let totalServices = 0;
    let customServices = 0;
    let totalDiffPct = 0;
    let diffCount = 0;

    state.products.forEach(function (p) {
      p.services.forEach(function (s) {
        totalServices++;
        const key = p.id + ':' + s.laundryServiceId;
        if (key in state.customPrices) {
          customServices++;
          const generalPrice = parseFloat(s.generalPrice);
          const customVal = state.customPrices[key];
          if (generalPrice > 0 && customVal < generalPrice) {
            totalDiffPct += (generalPrice - customVal) / generalPrice * 100;
            diffCount++;
          }
        }
      });
    });

    elSumTotal.textContent = totalServices;
    elSumCustom.textContent = customServices;
    elSumAvg.textContent = diffCount > 0 ? (totalDiffPct / diffCount).toFixed(1) + '%' : '-';
  }

  function getCustomBadgeText(customCount) {
    if (customCount > 0) {
      return formatMessage('ccp-custom-count', { count: customCount }, '{count} خدمة مخصصة');
    }
    return tr('ccp-no-custom-prices', 'لا توجد أسعار خاصة');
  }

  // ── Product List Indicators (without full re-render) ─────────────────────────
  function updateProductListIndicators() {
    elProductList.querySelectorAll('.product-item').forEach(function (el) {
      const pid = parseInt(el.dataset.pid);
      const customCount = countCustomForProduct(pid);
      const hasCustom = customCount > 0;
      const dot = el.querySelector('.dot-indicator');
      const badge = el.querySelector('.product-item-badge');
      if (dot) { dot.className = 'dot-indicator' + (hasCustom ? ' has-custom' : ''); }
      if (badge) {
        badge.className = 'product-item-badge' + (hasCustom ? ' has-custom' : '');
        badge.textContent = getCustomBadgeText(customCount);
      }
    });
  }

  // ── Save Button State ─────────────────────────────────────────────────────────
  function updateSaveButton() {
    elBtnSave.disabled = !state.selectedCustomer || !state.isDirty;
  }

  // ── Save Logic ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!state.selectedCustomer) return;

    // Check for zero prices
    const zeroKeys = Object.keys(state.customPrices).filter(function (k) { return state.customPrices[k] === 0; });
    if (zeroKeys.length > 0) {
      const confirmed = confirm(formatMessage('ccp-confirm-zero-count', { count: zeroKeys.length }, 'يوجد {count} سعر بقيمة صفر، هل تريد المتابعة؟'));
      if (!confirmed) return;
    }

    // Compute changes (new or updated)
    const changes = [];
    Object.keys(state.customPrices).forEach(function (key) {
      const parts = key.split(':');
      const pid = parseInt(parts[0]);
      const sid = parseInt(parts[1]);
      const newPrice = state.customPrices[key];
      const oldPrice = state.originalPrices[key];
      if (oldPrice === undefined || oldPrice !== newPrice) {
        changes.push({ productId: pid, laundryServiceId: sid, customPrice: newPrice });
      }
    });

    // Compute deletes (keys in original but not in current)
    const deletes = [];
    Object.keys(state.originalPrices).forEach(function (key) {
      if (!(key in state.customPrices)) {
        const parts = key.split(':');
        deletes.push({ productId: parseInt(parts[0]), laundryServiceId: parseInt(parts[1]) });
      }
    });

    if (changes.length === 0 && deletes.length === 0) {
      showToast(tr('ccp-no-changes', 'لا توجد تغييرات للحفظ'), 'error');
      return;
    }

    elBtnSave.disabled = true;
    try {
      const res = await window.api.saveCustomerCustomPrices({
        customerId: state.selectedCustomer.id,
        changes: changes,
        deletes: deletes
      });
      if (res && res.success) {
        state.originalPrices = Object.assign({}, state.customPrices);
        state.isDirty = false;
        // Clear dirty styling
        elServicesTbody.querySelectorAll('.price-input.dirty').forEach(function (inp) {
          inp.classList.remove('dirty');
        });
        renderProductList(elSearchInput.value.trim());
        showToast(formatMessage('ccp-saved-counts', { saved: res.saved || 0, deleted: res.deleted || 0 }, 'تم حفظ الأسعار بنجاح ({saved} محفوظة، {deleted} محذوفة)'), 'success');
      } else {
        showToast(res && res.message ? res.message : tr('ccp-save-error', 'فشل في حفظ الأسعار'), 'error');
        elBtnSave.disabled = false;
      }
    } catch (e) {
      console.error('[CCP] save error', e);
      showToast(tr('ccp-save-error', 'فشل في حفظ الأسعار'), 'error');
      elBtnSave.disabled = false;
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────
  function showToast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
