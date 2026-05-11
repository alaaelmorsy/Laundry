window.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const tabPackages = document.getElementById('tabPackages');
  const tabSubscriptions = document.getElementById('tabSubscriptions');
  const panelPackages = document.getElementById('panelPackages');
  const panelSubscriptions = document.getElementById('panelSubscriptions');
  const packagesTableBody = document.getElementById('packagesTableBody');
  const subscriptionsTableBody = document.getElementById('subscriptionsTableBody');
  const emptyPackages = document.getElementById('emptyPackages');
  const emptySubscriptions = document.getElementById('emptySubscriptions');
  const subscriptionsPaginationBar = document.getElementById('subscriptionsPaginationBar');
  const subscriptionsPaginationInfo = document.getElementById('subscriptionsPaginationInfo');
  const subscriptionsPageNumbers = document.getElementById('subscriptionsPageNumbers');
  const subsBtnFirstPage = document.getElementById('subsBtnFirstPage');
  const subsBtnPrevPage = document.getElementById('subsBtnPrevPage');
  const subsBtnNextPage = document.getElementById('subsBtnNextPage');
  const subsBtnLastPage = document.getElementById('subsBtnLastPage');
  const subscriptionsPageSizeSelect = document.getElementById('subscriptionsPageSizeSelect');
  const btnAddPackage = document.getElementById('btnAddPackage');
  const btnNewSubscription = document.getElementById('btnNewSubscription');
  const searchSubscriptions = document.getElementById('searchSubscriptions');
  const filterStatus = document.getElementById('filterStatus');
  const filterDateFrom = document.getElementById('filterDateFrom');
  const filterDateTo = document.getElementById('filterDateTo');
  const btnExportSubsExcel = document.getElementById('btnExportSubsExcel');
  const btnExportSubsPdf = document.getElementById('btnExportSubsPdf');
  const customerExportWrap = document.getElementById('customerExportWrap');
  const btnExportCustomerExcel = document.getElementById('btnExportCustomerExcel');
  const btnExportCustomerPdf = document.getElementById('btnExportCustomerPdf');
  const toastContainer = document.getElementById('toastContainer');

  const modalPackage = document.getElementById('modalPackage');
  const modalNewSub = document.getElementById('modalNewSub');
  const modalRenew = document.getElementById('modalRenew');
  const modalEditSub = document.getElementById('modalEditSub');
  const modalDetail = document.getElementById('modalDetail');
  const modalConfirm = document.getElementById('modalConfirm');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalMessage = document.getElementById('confirmModalMessage');
  const btnConfirmOk = document.getElementById('btnConfirmOk');
  const btnConfirmCancel = document.getElementById('btnConfirmCancel');
  const btnCloseConfirm = document.getElementById('btnCloseConfirm');

  let filterCustomerId = null;
  let detailPrintPeriodId = null;
  let detailSubscriptionId = null;
  let detailCustomerId = null;
  let detailInvLoaded = false;
  let searchTimer = null;
  let packagesCache = [];
  let subsPage = 1;
  let subsPageSize = 50;
  let subsTotal = 0;
  let subsTotalPages = 1;

  const pendingFilter = sessionStorage.getItem('subscriptionsFilterCustomerId');
  if (pendingFilter) {
    filterCustomerId = Number(pendingFilter) || null;
    sessionStorage.removeItem('subscriptionsFilterCustomerId');
  }

  I18N.apply();
  document.title = I18N.t('page-title-subscriptions');

  // فرض استخدام الأرقام الإنجليزية في حقول التاريخ والوقت
  function forceEnglishNumbers() {
    const dateInputs = document.querySelectorAll('input[type="date"], input[type="datetime-local"]');
    dateInputs.forEach(input => {
      if (input.dataset.engFixed) return;
      input.dataset.engFixed = '1';
      // فرض الخط الذي يعرض الأرقام اللاتينية فقط
      input.style.fontFamily = "'Segoe UI', Arial, Tahoma, sans-serif";
      input.style.direction = 'ltr';
      input.style.textAlign = 'right';
      // تحويل الأرقام العربية إلى إنجليزية عند أي تغيير
      const toEn = (val) => val.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
      input.addEventListener('change', function() { this.value = toEn(this.value); });
      input.addEventListener('input', function() { this.value = toEn(this.value); });
    });
  }

  // الضغط على أي مكان في filter-field يفتح منتقي التاريخ
  document.querySelectorAll('.filter-field input[type="datetime-local"]').forEach(input => {
    input.addEventListener('mousedown', function(e) {
      if (typeof this.showPicker === 'function') {
        e.preventDefault();
        this.showPicker();
      }
    });
  });
  
  // تطبيق عند التحميل
  forceEnglishNumbers();
  
  // إعادة التطبيق عند فتح النوافذ المنبثقة
  const observer = new MutationObserver(() => {
    forceEnglishNumbers();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  btnBack.addEventListener('click', () => window.api.navigateBack());

  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** يحوّل SUB-000003 إلى 3، أو يُعيد الرقم كما هو إذا لم يطابق النمط */
  function fmtSubRef(ref) {
    if (!ref) return '—';
    const m = String(ref).match(/^SUB-0*(\d+)$/i);
    return m ? m[1] : String(ref);
  }

  function showToast(msg, type) {
    const el = document.createElement('div');
    el.className = `toast toast-${type === 'error' ? 'error' : 'success'}`;
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3500);
  }

  let confirmResolver = null;

  function finishConfirm(value) {
    if (modalConfirm._onKey) {
      document.removeEventListener('keydown', modalConfirm._onKey);
      modalConfirm._onKey = null;
    }
    modalConfirm.style.display = 'none';
    if (confirmResolver) {
      const r = confirmResolver;
      confirmResolver = null;
      r(value);
    }
  }

  /** نافذة تأكيد بنمط التطبيق (بديل عن window.confirm) */
  function showConfirmModal(messageText, confirmOptions) {
    return new Promise((resolve) => {
      const opts = confirmOptions || {};
      confirmResolver = resolve;
      confirmModalTitle.textContent = opts.title || I18N.t('subscriptions-modal-confirm-title');
      confirmModalMessage.textContent = messageText;
      btnConfirmOk.textContent = opts.okText || I18N.t('subscriptions-btn-confirm-delete');
      btnConfirmCancel.textContent = I18N.t('products-btn-cancel');
      const onKey = (e) => {
        if (e.key === 'Escape') finishConfirm(false);
      };
      modalConfirm._onKey = onKey;
      document.addEventListener('keydown', onKey);
      modalConfirm.style.display = 'flex';
      requestAnimationFrame(() => btnConfirmCancel.focus());
    });
  }

  btnConfirmOk.addEventListener('click', () => finishConfirm(true));
  btnConfirmCancel.addEventListener('click', () => finishConfirm(false));
  btnCloseConfirm.addEventListener('click', () => finishConfirm(false));
  modalConfirm.addEventListener('click', (e) => {
    if (e.target === modalConfirm) finishConfirm(false);
  });

  function statusBadgeClass(st) {
    if (st === 'active') return 'badge-act';
    if (st === 'expired') return 'badge-exp';
    if (st === 'closed') return 'badge-closed';
    return 'badge-none';
  }

  function statusLabel(st) {
    const k = {
      active: 'subscriptions-status-active',
      expired: 'subscriptions-status-expired',
      closed: 'subscriptions-status-closed',
      none: 'subscriptions-status-none'
    }[st];
    return k ? I18N.t(k) : st;
  }

  function ledgerLabel(t) {
    const k = {
      purchase: 'شراء / تفعيل',
      renewal: 'تجديد',
      consumption: 'استهلاك',
      adjustment: 'تعديل',
      refund: 'استرجاع'
    };
    return k[t] || t;
  }

  /** تاريخ ميلادي بأرقام إنجليزية DD/MM/YYYY */
  /** تاريخ لحقل type=date (YYYY-MM-DD) */
  function toDateInputValue(val) {
    if (!val) return '';
    const s = String(val).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  function formatDateNumeric(d) {
    if (!d) return '—';
    const s = String(d).trim();
    const hasTime = s.length > 10;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      let result = `${m[3]}/${m[2]}/${m[1]}`;
      if (hasTime) {
        const timePart = s.includes('T') ? s.split('T')[1] : s.split(' ')[1];
        if (timePart) {
          const [hh, mm] = timePart.split(':');
          if (hh && mm) result += ` ${hh}:${mm}`;
        }
      }
      return result;
    }
    try {
      const dt = new Date(s);
      if (Number.isNaN(dt.getTime())) return s;
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const year = dt.getFullYear();
      let result = `${day}/${month}/${year}`;
      if (hasTime) {
        const pad2 = (x) => String(x).padStart(2, '0');
        result += ` ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
      }
      return result;
    } catch {
      return s;
    }
  }

  function formatDateTimeNumeric(d) {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return formatDateNumeric(d);
      const pad = (x) => String(x).padStart(2, '0');
      const day = pad(dt.getDate()), mo = pad(dt.getMonth() + 1), yr = dt.getFullYear();
      const h = dt.getHours() % 12 || 12, mi = pad(dt.getMinutes());
      const ampm = dt.getHours() < 12 ? 'am' : 'pm';
      return `${day}/${mo}/${yr}, ${pad(h)}:${mi} ${ampm}`;
    } catch { return formatDateNumeric(d); }
  }

  function riyalHtml(amountStr) {
    return `<span class="amt-sar"><span class="sar">&#xE900;</span><span>${amountStr}</span></span>`;
  }

  function packageOptionLabelHtml(p) {
    const prepaid = Number(p.prepaid_price).toFixed(0);
    const credit = Number(p.service_credit_value).toFixed(0);
    return `${escHtml(p.name_ar)} <span class="package-dd-amounts">(${riyalHtml(prepaid)} <span aria-hidden="true">←</span> ${riyalHtml(credit)})</span>`;
  }

  let newSubEligibleCustomers = [];
  let newSubCustomerSearchTimer = null;
  let newSubCustomerInputSilent = false;
  let newSubCustomerActiveIndex = -1;

  function digitsOnlyPhoneSubs(s) {
    return String(s || '').replace(/\D/g, '');
  }

  function closeNewSubCustomerList() {
    const listEl = document.getElementById('newSubCustomerList');
    const searchEl = document.getElementById('newSubCustomerSearch');
    if (listEl) {
      listEl.hidden = true;
      listEl.innerHTML = '';
    }
    if (searchEl) searchEl.setAttribute('aria-expanded', 'false');
    newSubCustomerActiveIndex = -1;
  }

  /** درجة أعلى = تطابق أوضح (يُستخدم للترتيب) */
  function newSubCustomerMatchScore(c, qTrimmed) {
    const q = String(qTrimmed || '').trim();
    if (!q) return 0;
    const qLower = q.toLowerCase();
    const qDigits = digitsOnlyPhoneSubs(q);
    let maxScore = 0;

    const phoneDigits = digitsOnlyPhoneSubs(c.phone);
    if (qDigits.length > 0 && phoneDigits) {
      if (phoneDigits === qDigits) maxScore = Math.max(maxScore, 100000);
      else if (phoneDigits.startsWith(qDigits)) {
        maxScore = Math.max(maxScore, 90000 + Math.min(qDigits.length * 20, 500));
      } else if (phoneDigits.includes(qDigits)) {
        const idx = phoneDigits.indexOf(qDigits);
        maxScore = Math.max(maxScore, 52000 + qDigits.length * 10 - idx * 4);
      }
    }

    const subLower = String(c.subscription_number || '').toLowerCase();
    if (qLower && subLower) {
      if (subLower === qLower) maxScore = Math.max(maxScore, 95000);
      else if (subLower.startsWith(qLower)) {
        maxScore = Math.max(maxScore, 82000 + Math.min(qLower.length * 8, 400));
      } else if (subLower.includes(qLower)) {
        const idx = subLower.indexOf(qLower);
        maxScore = Math.max(maxScore, 45000 - idx * 3);
      }
    }

    const nameLower = String(c.customer_name || '').toLowerCase();
    if (qLower && nameLower) {
      if (nameLower === qLower) maxScore = Math.max(maxScore, 92000);
      else if (nameLower.startsWith(qLower)) {
        maxScore = Math.max(maxScore, 80000 + Math.min(qLower.length * 10, 500));
      } else if (nameLower.includes(qLower)) {
        const idx = nameLower.indexOf(qLower);
        maxScore = Math.max(maxScore, 40000 - idx * 2);
      }
    }

    return maxScore;
  }

  function rankNewSubCustomersForQuery(qTrimmed) {
    const q = String(qTrimmed || '').trim();
    if (!q) return [];
    const scored = newSubEligibleCustomers
      .map((c) => ({ c, score: newSubCustomerMatchScore(c, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const na = String(a.c.customer_name || '');
        const nb = String(b.c.customer_name || '');
        const cmp = na.localeCompare(nb, undefined, { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return String(a.c.id).localeCompare(String(b.c.id), undefined, { numeric: true });
      });
    return scored.map((x) => x.c);
  }

  function renderNewSubCustomerSuggestions(queryRaw) {
    const listEl = document.getElementById('newSubCustomerList');
    const searchEl = document.getElementById('newSubCustomerSearch');
    if (!listEl || !searchEl) return;
    const q = String(queryRaw || '').trim();
    if (!q) {
      closeNewSubCustomerList();
      return;
    }
    if (!newSubEligibleCustomers.length) {
      closeNewSubCustomerList();
      return;
    }
    const items = rankNewSubCustomersForQuery(q);
    listEl.innerHTML = '';
    newSubCustomerActiveIndex = -1;

    if (items.length === 0) {
      const hint = document.createElement('li');
      hint.className = 'customer-search-hint';
      hint.setAttribute('role', 'presentation');
      hint.textContent = I18N.t('subscriptions-customer-picker-filtered').replace('{n}', String(items.length));
      listEl.appendChild(hint);
      const empty = document.createElement('li');
      empty.className = 'customer-search-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = I18N.t('subscriptions-customer-no-results');
      listEl.appendChild(empty);
    } else {
      const toolbar = document.createElement('li');
      toolbar.className = 'customer-search-toolbar';
      toolbar.setAttribute('role', 'presentation');
      const countText = I18N.t('subscriptions-customer-picker-filtered').replace('{n}', String(items.length));
      const hName = I18N.t('subscriptions-customer-col-name');
      const hPhone = I18N.t('subscriptions-customer-col-phone');
      const hSub = I18N.t('subscriptions-customer-col-subscription');
      toolbar.innerHTML = `
        <div class="customer-search-count">${escHtml(countText)}</div>
        <div class="customer-search-grid customer-search-grid--head">
          <span class="customer-search-hcell customer-search-hcell--name">${escHtml(hName)}</span>
          <span class="customer-search-hcell customer-search-hcell--phone">${escHtml(hPhone)}</span>
          <span class="customer-search-hcell customer-search-hcell--sub">${escHtml(hSub)}</span>
        </div>`;
      listEl.appendChild(toolbar);
      for (const c of items) {
        const li = document.createElement('li');
        li.className = 'customer-search-item';
        li.setAttribute('role', 'option');
        li.dataset.customerId = String(c.id);
        const name = c.customer_name || '—';
        const phone = c.phone || '—';
        const ref = c.subscription_number || '—';
        li.innerHTML = `
          <div class="customer-search-grid customer-search-item-inner">
            <span class="customer-search-name">${escHtml(name)}</span>
            <span class="customer-search-phone">${escHtml(phone)}</span>
            <span class="customer-search-ref">${escHtml(ref)}</span>
          </div>`;
        li.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          selectNewSubCustomer(c);
        });
        listEl.appendChild(li);
      }
    }
    listEl.hidden = false;
    searchEl.setAttribute('aria-expanded', 'true');
  }

  function selectNewSubCustomer(c) {
    const idEl = document.getElementById('newSubCustomerId');
    const searchEl = document.getElementById('newSubCustomerSearch');
    if (!idEl || !searchEl || !c) return;
    idEl.value = String(c.id);
    newSubCustomerInputSilent = true;
    const phone = c.phone || '';
    const name = c.customer_name || '—';
    searchEl.value = `${phone} · ${name}`;
    newSubCustomerInputSilent = false;
    closeNewSubCustomerList();
  }

  function resetNewSubCustomerPicker() {
    const idEl = document.getElementById('newSubCustomerId');
    const searchEl = document.getElementById('newSubCustomerSearch');
    if (idEl) idEl.value = '';
    if (searchEl) {
      newSubCustomerInputSilent = true;
      searchEl.value = '';
      newSubCustomerInputSilent = false;
    }
    closeNewSubCustomerList();
  }

  function initNewSubCustomerCombobox() {
    const searchEl = document.getElementById('newSubCustomerSearch');
    const listEl = document.getElementById('newSubCustomerList');
    if (!searchEl || !listEl) return;
    searchEl.addEventListener('input', () => {
      if (newSubCustomerInputSilent) return;
      const hid = document.getElementById('newSubCustomerId');
      if (hid) hid.value = '';
      clearTimeout(newSubCustomerSearchTimer);
      newSubCustomerSearchTimer = setTimeout(() => {
        renderNewSubCustomerSuggestions(searchEl.value);
      }, 100);
    });
    searchEl.addEventListener('focus', () => {
      if (!newSubEligibleCustomers.length) return;
      if (String(searchEl.value || '').trim()) renderNewSubCustomerSuggestions(searchEl.value);
    });
    searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!listEl.hidden) {
          e.stopPropagation();
          closeNewSubCustomerList();
        }
        return;
      }
      if (listEl.hidden) return;
      const opts = listEl.querySelectorAll('.customer-search-item');
      if (!opts.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        newSubCustomerActiveIndex = Math.min(newSubCustomerActiveIndex + 1, opts.length - 1);
        opts.forEach((el, i) => el.classList.toggle('is-active', i === newSubCustomerActiveIndex));
        opts[newSubCustomerActiveIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        newSubCustomerActiveIndex = Math.max(newSubCustomerActiveIndex - 1, 0);
        opts.forEach((el, i) => el.classList.toggle('is-active', i === newSubCustomerActiveIndex));
        opts[newSubCustomerActiveIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (newSubCustomerActiveIndex >= 0 && opts[newSubCustomerActiveIndex]) {
          e.preventDefault();
          const id = opts[newSubCustomerActiveIndex].dataset.customerId;
          const c = newSubEligibleCustomers.find((x) => String(x.id) === String(id));
          if (c) selectNewSubCustomer(c);
        }
      }
    });
  }

  let packageDdListenersBound = false;
  function closePackageDd(prefix) {
    const listEl = document.getElementById(`${prefix}PackageList`);
    const triggerEl = document.getElementById(`${prefix}PackageTrigger`);
    if (!listEl || !triggerEl) return;
    listEl.hidden = true;
    triggerEl.setAttribute('aria-expanded', 'false');
  }
  function openPackageDd(prefix) {
    const other = prefix === 'newSub' ? 'renew' : 'newSub';
    closePackageDd(other);
    const listEl = document.getElementById(`${prefix}PackageList`);
    const triggerEl = document.getElementById(`${prefix}PackageTrigger`);
    if (!listEl || !triggerEl || !listEl.children.length) return;
    listEl.hidden = false;
    triggerEl.setAttribute('aria-expanded', 'true');
  }
  function initPackageDropdown(prefix) {
    const triggerEl = document.getElementById(`${prefix}PackageTrigger`);
    const listEl = document.getElementById(`${prefix}PackageList`);
    const valueInput = document.getElementById(`${prefix}Package`);
    const labelEl = document.getElementById(`${prefix}PackageLabel`);
    if (!triggerEl || !listEl || !valueInput || !labelEl) return;
    if (!packageDdListenersBound) {
      packageDdListenersBound = true;
      document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.package-dd')) {
          closePackageDd('newSub');
          closePackageDd('renew');
        }
        if (!e.target.closest('.customer-search-dd')) {
          closeNewSubCustomerList();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closePackageDd('newSub');
          closePackageDd('renew');
          closeNewSubCustomerList();
        }
      });
    }
    triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!listEl.hidden) closePackageDd(prefix);
      else openPackageDd(prefix);
    });
    listEl.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li || !listEl.contains(li)) return;
      const v = li.dataset.value;
      if (v == null || v === '') return;
      valueInput.value = v;
      labelEl.classList.remove('is-placeholder');
      labelEl.innerHTML = li.innerHTML;
      closePackageDd(prefix);
    });
  }

  const subActionSvg = {
    detail:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    renew:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    print:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
    pdf:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>',
    del:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    stop:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    resume:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="8 5 19 12 8 19 8 5"/></svg>'
  };

  tabPackages.addEventListener('click', () => {
    tabPackages.classList.add('active');
    tabSubscriptions.classList.remove('active');
    panelPackages.classList.add('active');
    panelSubscriptions.classList.remove('active');
    loadPackages();
  });

  tabSubscriptions.addEventListener('click', () => {
    tabSubscriptions.classList.add('active');
    tabPackages.classList.remove('active');
    panelSubscriptions.classList.add('active');
    panelPackages.classList.remove('active');
    loadSubscriptions();
  });

  async function loadPackages() {
    packagesTableBody.innerHTML = `<tr><td colspan="6" class="loading-cell"><span class="spinner"></span> ${I18N.t('subscriptions-loading')}</td></tr>`;
    try {
      const res = await window.api.getPrepaidPackages({});
      if (!res.success) throw new Error(res.message);
      packagesCache = res.packages || [];
      renderPackages(packagesCache);
    } catch (e) {
      showToast(I18N.t('subscriptions-err-load'), 'error');
      packagesTableBody.innerHTML = '';
    }
  }

  function renderPackages(pkgs) {
    if (!pkgs.length) {
      packagesTableBody.innerHTML = '';
      emptyPackages.style.display = 'block';
      return;
    }
    emptyPackages.style.display = 'none';
    packagesTableBody.innerHTML = pkgs.map((p) => `
      <tr>
        <td>${escHtml(p.name_ar)}</td>
        <td>${riyalHtml(Number(p.prepaid_price).toFixed(2))}</td>
        <td>${riyalHtml(Number(p.service_credit_value).toFixed(2))}</td>
        <td><span class="badge ${p.is_active ? 'badge-act' : 'badge-exp'}">${p.is_active ? I18N.t('products-status-active') : I18N.t('products-status-inactive')}</span></td>
        <td class="actions-cell">
          <button type="button" class="action-btn btn-edit" data-pkg-edit="${p.id}" title="${I18N.t('products-btn-edit-title')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="action-btn ${p.is_active ? 'btn-print' : 'btn-edit'}" data-pkg-toggle="${p.id}" data-active="${p.is_active}" title="${p.is_active ? I18N.t('products-btn-stop-title') : I18N.t('products-btn-resume-title')}">
            ${p.is_active ? '⏸' : '▶'}
          </button>
          <button type="button" class="action-btn btn-del" data-pkg-delete="${p.id}" title="${I18N.t('subscriptions-btn-delete-package-title')}">✕</button>
        </td>
      </tr>
    `).join('');

    packagesTableBody.querySelectorAll('[data-pkg-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.pkgEdit);
        const p = packagesCache.find((x) => x.id === id);
        if (p) openPackageModal(p);
      });
    });
    packagesTableBody.querySelectorAll('[data-pkg-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.pkgToggle);
        const active = Number(btn.dataset.active) === 1;
        const r = await window.api.togglePrepaidPackage({ id, isActive: !active });
        if (r.success) loadPackages();
        else showToast(r.message || I18N.t('subscriptions-err-generic'), 'error');
      });
    });
    packagesTableBody.querySelectorAll('[data-pkg-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.pkgDelete);
        const pkgRow = packagesCache.find((x) => x.id === id);
        const pkgName = pkgRow ? String(pkgRow.name_ar || '') : '';
        if (!id) return;
        const msg = I18N.t('subscriptions-package-delete-confirm').replace('{name}', pkgName);
        if (!(await showConfirmModal(msg))) return;
        const r = await window.api.deletePrepaidPackage({ id });
        if (r.success) {
          showToast(I18N.t('subscriptions-package-delete-success'), 'success');
          loadPackages();
        } else showToast(r.message || I18N.t('subscriptions-err-generic'), 'error');
      });
    });
  }

  function openPackageModal(p) {
    document.getElementById('editPackageId').value = p ? p.id : '';
    document.getElementById('pkgName').value = p ? p.name_ar : '';
    document.getElementById('pkgPrepaid').value = p ? p.prepaid_price : '';
    document.getElementById('pkgCredit').value = p ? p.service_credit_value : '';
    document.getElementById('pkgNotes').value = p ? (p.notes || '') : '';
    document.getElementById('pkgActive').checked = p ? !!p.is_active : true;
    document.getElementById('modalPackageTitle').textContent = p
      ? I18N.t('subscriptions-modal-package-edit')
      : I18N.t('subscriptions-modal-package-add');
    document.getElementById('errPackage').style.display = 'none';
    modalPackage.style.display = 'flex';
  }

  btnAddPackage.addEventListener('click', () => openPackageModal(null));
  document.getElementById('btnClosePackage').addEventListener('click', () => { modalPackage.style.display = 'none'; });
  document.getElementById('btnCancelPackage').addEventListener('click', () => { modalPackage.style.display = 'none'; });
  document.getElementById('btnSavePackage').addEventListener('click', async () => {
    const id = document.getElementById('editPackageId').value;
    const nameAr = document.getElementById('pkgName').value.trim();
    const prepaidPrice = document.getElementById('pkgPrepaid').value;
    const serviceCreditValue = document.getElementById('pkgCredit').value;
    const notes = document.getElementById('pkgNotes').value.trim();
    const isActive = document.getElementById('pkgActive').checked;
    if (!nameAr || prepaidPrice === '' || serviceCreditValue === '') {
      document.getElementById('errPackage').textContent = I18N.t('subscriptions-err-package-fields');
      document.getElementById('errPackage').style.display = 'block';
      return;
    }
    const data = {
      id: id ? Number(id) : undefined,
      nameAr,
      prepaidPrice,
      serviceCreditValue,
      notes,
      isActive
    };
    const r = await window.api.savePrepaidPackage(data);
    if (r.success) {
      showToast(I18N.t('subscriptions-success-package'), 'success');
      modalPackage.style.display = 'none';
      loadPackages();
    } else {
      document.getElementById('errPackage').textContent = r.message || I18N.t('subscriptions-err-generic');
      document.getElementById('errPackage').style.display = 'block';
    }
  });

  async function fillPackageSelect(prefix, activeOnly) {
    const valueInput = document.getElementById(`${prefix}Package`);
    const listEl = document.getElementById(`${prefix}PackageList`);
    const labelEl = document.getElementById(`${prefix}PackageLabel`);
    const triggerEl = document.getElementById(`${prefix}PackageTrigger`);
    if (!valueInput || !listEl || !labelEl || !triggerEl) return;
    closePackageDd(prefix);
    const res = await window.api.getPrepaidPackages({ activeOnly: !!activeOnly });
    valueInput.value = '';
    labelEl.classList.add('is-placeholder');
    labelEl.textContent = I18N.t('subscriptions-select-package');
    listEl.innerHTML = '';
    listEl.hidden = true;
    triggerEl.setAttribute('aria-expanded', 'false');
    if (!res.success || !res.packages) return;
    for (const p of res.packages) {
      if (activeOnly && !p.is_active) continue;
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.value = String(p.id);
      li.innerHTML = packageOptionLabelHtml(p);
      listEl.appendChild(li);
    }
  }

  function buildListFilters() {
    const f = {
      search: searchSubscriptions.value.trim() || undefined,
      statusFilter: filterStatus.value !== 'all' ? filterStatus.value : undefined,
      dateFrom: filterDateFrom.value || undefined,
      dateTo: filterDateTo.value || undefined
    };
    if (filterCustomerId) f.customerId = filterCustomerId;
    return f;
  }

  function getSubsPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  function renderSubscriptionsPagination() {
    if (!subscriptionsPaginationBar) return;
    if (subsTotal === 0) {
      subscriptionsPaginationBar.style.display = 'none';
      return;
    }
    subscriptionsPaginationBar.style.display = 'flex';
    const start = (subsPage - 1) * subsPageSize + 1;
    const end = Math.min(subsPage * subsPageSize, subsTotal);
    const info = I18N.t('subscriptions-pagination-info')
      .replace('{start}', start.toLocaleString(I18N.t('time-locale')))
      .replace('{end}', end.toLocaleString(I18N.t('time-locale')))
      .replace('{total}', subsTotal.toLocaleString(I18N.t('time-locale')));
    subscriptionsPaginationInfo.textContent = info;

    subsBtnFirstPage.disabled = subsPage === 1;
    subsBtnPrevPage.disabled = subsPage === 1;
    subsBtnNextPage.disabled = subsPage === subsTotalPages;
    subsBtnLastPage.disabled = subsPage === subsTotalPages;

    const range = getSubsPageRange(subsPage, subsTotalPages);
    subscriptionsPageNumbers.innerHTML = range.map((p) =>
      p === '...'
        ? '<span class="page-ellipsis">…</span>'
        : `<button type="button" class="page-num ${p === subsPage ? 'active' : ''}" data-subs-page="${p}">${p}</button>`
    ).join('');

    subscriptionsPageNumbers.querySelectorAll('[data-subs-page]').forEach((btn) => {
      btn.addEventListener('click', () => goSubsPage(Number(btn.dataset.subsPage)));
    });
  }

  function goSubsPage(page) {
    if (page < 1 || page > subsTotalPages || page === subsPage) return;
    subsPage = page;
    loadSubscriptions();
  }

  function bindSubscriptionRowActions() {
    subscriptionsTableBody.querySelectorAll('[data-sub-detail]').forEach((btn) => {
      btn.addEventListener('click', () => openDetailModal(Number(btn.dataset.subDetail)));
    });
    subscriptionsTableBody.querySelectorAll('[data-sub-renew]').forEach((btn) => {
      btn.addEventListener('click', () => openRenewModal(Number(btn.dataset.subRenew)));
    });
    subscriptionsTableBody.querySelectorAll('[data-sub-print]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.subPrint;
        if (!pid) return;
        const r = await window.api.printSubscriptionReceipt({ periodId: Number(pid) });
        if (r.success) showToast(I18N.t('subscriptions-print-success'), 'success');
        else showToast(r.message || I18N.t('subscriptions-err-generic'), 'error');
      });
    });
    subscriptionsTableBody.querySelectorAll('[data-sub-pdf]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.subPdf;
        if (!pid) return;
        const r = await window.api.exportSubscriptionReceiptPdf({ periodId: Number(pid) });
        if (r.success) showToast(I18N.t('subscriptions-pdf-receipt-success'), 'success');
        else showToast(r.message || I18N.t('subscriptions-export-error'), 'error');
      });
    });
    subscriptionsTableBody.querySelectorAll('[data-sub-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sid = Number(btn.dataset.subDelete);
        const ref = btn.getAttribute('data-sub-ref') || '';
        if (!sid) return;
        const msg = I18N.t('subscriptions-delete-confirm').replace('{ref}', ref);
        if (!(await showConfirmModal(msg))) return;
        const r = await window.api.deleteSubscription({ subscriptionId: sid });
        if (r.success) {
          showToast(I18N.t('subscriptions-delete-success'), 'success');
          await loadSubscriptions();
        } else showToast(r.message || I18N.t('subscriptions-err-generic'), 'error');
      });
    });
    subscriptionsTableBody.querySelectorAll('[data-sub-power-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const kind = btn.getAttribute('data-sub-power-toggle');
        if (kind !== 'stop' && kind !== 'resume') return;
        const sid = Number(btn.dataset.subToggle);
        const ref = btn.getAttribute('data-sub-ref') || '';
        if (!sid) return;
        if (kind === 'stop') {
          const msg = I18N.t('subscriptions-stop-confirm').replace('{ref}', ref);
          const ok = await showConfirmModal(msg, {
            title: I18N.t('subscriptions-modal-confirm-stop-title'),
            okText: I18N.t('subscriptions-btn-confirm-stop')
          });
          if (!ok) return;
          const r = await window.api.stopSubscription({ subscriptionId: sid });
          if (r.success) {
            showToast(I18N.t('subscriptions-stop-success'), 'success');
            await loadSubscriptions();
          } else showToast(r.message || I18N.t('subscriptions-err-generic'), 'error');
        } else {
          const msg = I18N.t('subscriptions-resume-confirm').replace('{ref}', ref);
          const ok = await showConfirmModal(msg, {
            title: I18N.t('subscriptions-modal-confirm-resume-title'),
            okText: I18N.t('subscriptions-btn-confirm-resume')
          });
          if (!ok) return;
          const r = await window.api.resumeSubscription({ subscriptionId: sid });
          if (r.success) {
            showToast(I18N.t('subscriptions-resume-success'), 'success');
            await loadSubscriptions();
          } else showToast(r.message || I18N.t('subscriptions-err-generic'), 'error');
        }
      });
    });
    subscriptionsTableBody.querySelectorAll('[data-sub-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = Number(btn.dataset.subEdit);
        if (!sid) return;
        const row = btn.closest('tr');
        if (!row) return;
        const refEl = row.querySelector('.sub-ref');
        const ref = refEl ? refEl.textContent.trim() : '';
        const name = row.cells[2] ? row.cells[2].textContent.trim() : '';
        openEditSubscriptionModal({
          id: sid,
          subscription_ref: ref,
          customer_name: name,
          period_from: btn.dataset.periodFrom || '',
          period_to: btn.dataset.periodTo || '',
          credit_remaining: btn.dataset.creditRemaining != null ? btn.dataset.creditRemaining : ''
        });
      });
    });
  }

  async function loadSubscriptions() {
    subscriptionsTableBody.innerHTML = `<tr><td colspan="8" class="loading-cell"><span class="spinner"></span> ${I18N.t('subscriptions-loading')}</td></tr>`;
    emptySubscriptions.style.display = 'none';
    if (subscriptionsPaginationBar) subscriptionsPaginationBar.style.display = 'none';
    customerExportWrap.style.display = filterCustomerId ? 'inline-flex' : 'none';

    try {
      const res = await window.api.getCustomerSubscriptionsList({
        ...buildListFilters(),
        page: subsPage,
        pageSize: subsPageSize
      });
      if (!res.success) throw new Error(res.message);
      const list = res.subscriptions || [];

      if (res.total != null) {
        subsTotal = res.total;
        subsTotalPages = Math.max(1, res.totalPages || 1);
        if (res.page != null) subsPage = res.page;
        if (subsPage > subsTotalPages) {
          subsPage = subsTotalPages;
          await loadSubscriptions();
          return;
        }
      } else {
        subsTotal = list.length;
        subsTotalPages = 1;
        subsPage = 1;
      }

      if (!list.length) {
        subscriptionsTableBody.innerHTML = '';
        emptySubscriptions.style.display = 'block';
        renderSubscriptionsPagination();
        return;
      }
      emptySubscriptions.style.display = 'none';
      subscriptionsTableBody.innerHTML = list.map((s, idx) => {
        const rowNum = (subsPage - 1) * subsPageSize + idx + 1;
        const periodTxt = s.period_from && s.period_to
          ? `${formatDateNumeric(s.period_from)} — ${formatDateNumeric(s.period_to)}`
          : s.period_from && !s.period_to
          ? `${formatDateNumeric(s.period_from)} — ∞`
          : '—';
        const bal = s.credit_remaining != null ? riyalHtml(Number(s.credit_remaining).toFixed(2)) : '—';
        const hasPeriod = !!s.current_period_id;
        const disPrint = !hasPeriod ? 'disabled' : '';
        const canManageActive = s.display_status === 'active' && hasPeriod;
        const disManage = canManageActive ? '' : 'disabled';
        const canResumeClosed = s.display_status === 'closed' && hasPeriod;
        let powerToggleKind = 'off';
        let powerToggleClass = 'action-btn-label--amber';
        let powerToggleSvg = subActionSvg.stop;
        let powerToggleTitle = I18N.t('subscriptions-btn-power-toggle-idle-title');
        let powerToggleLabel = I18N.t('subscriptions-btn-stop-sub');
        if (canManageActive) {
          powerToggleKind = 'stop';
          powerToggleClass = 'action-btn-label--amber';
          powerToggleSvg = subActionSvg.stop;
          powerToggleTitle = I18N.t('subscriptions-btn-stop-sub');
          powerToggleLabel = I18N.t('subscriptions-btn-stop-sub');
        } else if (canResumeClosed) {
          powerToggleKind = 'resume';
          powerToggleClass = 'action-btn-label--green';
          powerToggleSvg = subActionSvg.resume;
          powerToggleTitle = I18N.t('subscriptions-btn-resume-sub');
          powerToggleLabel = I18N.t('subscriptions-btn-resume-sub');
        }
        const disPowerToggle = powerToggleKind === 'off' ? 'disabled' : '';
        const pFromAttr = escHtml(toDateInputValue(s.period_from));
        const pToAttr = escHtml(toDateInputValue(s.period_to));
        const crn = Number(s.credit_remaining);
        const credAttr = Number.isFinite(crn) ? escHtml(String(crn)) : '';
        return `
        <tr>
          <td><span class="sub-ref">${escHtml(s.customer_file_ref || '—')}</span></td>
          <td>${escHtml(s.customer_name)}</td>
          <td class="cell-ltr">${escHtml(s.phone)}</td>
          <td>${escHtml(s.package_name || '—')}</td>
          <td style="font-size:12px">${periodTxt}</td>
          <td>${bal}</td>
          <td><span class="badge ${statusBadgeClass(s.display_status)}">${statusLabel(s.display_status)}</span></td>
          <td class="actions-cell subs-actions">
            <div class="subs-action-row">
              <button type="button" class="action-btn-label action-btn-label--teal" data-sub-detail="${s.id}" title="${I18N.t('subscriptions-btn-detail')}">${subActionSvg.detail}<span>${I18N.t('subscriptions-btn-detail')}</span></button>
              <button type="button" class="action-btn-label action-btn-label--teal" data-sub-renew="${s.id}" title="${I18N.t('subscriptions-btn-renew')}">${subActionSvg.renew}<span>${I18N.t('subscriptions-btn-renew')}</span></button>
            </div>
            <div class="subs-action-row">
              <button type="button" class="action-btn-label action-btn-label--violet" data-sub-edit="${s.id}" data-period-from="${pFromAttr}" data-period-to="${pToAttr}" data-credit-remaining="${credAttr}" title="${I18N.t('subscriptions-btn-edit-sub')}" ${disManage}>${subActionSvg.edit}<span>${I18N.t('subscriptions-btn-edit-sub')}</span></button>
              <button type="button" class="action-btn-label ${powerToggleClass}" data-sub-toggle="${s.id}" data-sub-power-toggle="${powerToggleKind}" data-sub-ref="${String(s.subscription_ref || '').replace(/"/g, '')}" title="${powerToggleTitle}" ${disPowerToggle}>${powerToggleSvg}<span>${powerToggleLabel}</span></button>
              <button type="button" class="action-btn-label action-btn-label--red-del" data-sub-delete="${s.id}" data-sub-ref="${String(s.subscription_ref || '').replace(/"/g, '')}" title="${I18N.t('subscriptions-btn-delete')}">${subActionSvg.del}<span>${I18N.t('subscriptions-row-action-delete')}</span></button>
            </div>
          </td>
        </tr>`;
      }).join('');

      bindSubscriptionRowActions();
      renderSubscriptionsPagination();
    } catch (e) {
      showToast(I18N.t('subscriptions-err-load'), 'error');
      subscriptionsTableBody.innerHTML = '';
      if (subscriptionsPaginationBar) subscriptionsPaginationBar.style.display = 'none';
    }
  }

  searchSubscriptions.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      subsPage = 1;
      loadSubscriptions();
    }, 350);
  });
  filterStatus.addEventListener('change', () => {
    subsPage = 1;
    loadSubscriptions();
  });
  filterDateFrom.addEventListener('change', () => {
    subsPage = 1;
    loadSubscriptions();
  });
  filterDateTo.addEventListener('change', () => {
    subsPage = 1;
    loadSubscriptions();
  });

  subsBtnFirstPage.addEventListener('click', () => goSubsPage(1));
  subsBtnPrevPage.addEventListener('click', () => goSubsPage(subsPage - 1));
  subsBtnNextPage.addEventListener('click', () => goSubsPage(subsPage + 1));
  subsBtnLastPage.addEventListener('click', () => goSubsPage(subsTotalPages));

  subscriptionsPageSizeSelect.addEventListener('change', () => {
    subsPageSize = Number(subscriptionsPageSizeSelect.value) || 50;
    subsPage = 1;
    loadSubscriptions();
  });

  btnNewSubscription.addEventListener('click', async () => {
    document.getElementById('errNewSub').style.display = 'none';
    const res = await window.api.getCustomers({ withoutSubscription: true });
    if (!res.success || !res.customers || res.customers.length === 0) {
      showToast(I18N.t('subscriptions-err-no-eligible-customer'), 'error');
      return;
    }
    newSubEligibleCustomers = res.customers;
    resetNewSubCustomerPicker();
    await fillPackageSelect('newSub', true);
    document.getElementById('newSubStart').value = '';
    document.getElementById('newSubEnd').value = '';
    modalNewSub.style.display = 'flex';
    if (filterCustomerId) {
      const pre = newSubEligibleCustomers.find((c) => Number(c.id) === Number(filterCustomerId));
      if (pre) selectNewSubCustomer(pre);
    }
    requestAnimationFrame(() => document.getElementById('newSubCustomerSearch')?.focus());
  });

  document.getElementById('btnCloseNewSub').addEventListener('click', () => { modalNewSub.style.display = 'none'; });
  document.getElementById('btnCancelNewSub').addEventListener('click', () => { modalNewSub.style.display = 'none'; });
  document.getElementById('btnSaveNewSub').addEventListener('click', async () => {
    const customerId = document.getElementById('newSubCustomerId').value;
    const packageId = document.getElementById('newSubPackage').value;
    const periodFrom = document.getElementById('newSubStart').value || undefined;
    const endDate = document.getElementById('newSubEnd').value || undefined;
    if (!customerId || !packageId) {
      document.getElementById('errNewSub').textContent = I18N.t('subscriptions-err-pick-customer-package');
      document.getElementById('errNewSub').style.display = 'block';
      return;
    }
    const r = await window.api.createSubscription({
      customerId: Number(customerId),
      packageId: Number(packageId),
      periodFrom,
      endDate
    });
    if (r.success) {
      showToast(I18N.t('subscriptions-success-create'), 'success');
      modalNewSub.style.display = 'none';
      await loadSubscriptions();
      if (r.periodId) {
        const pr = await window.api.printSubscriptionReceipt({ periodId: r.periodId });
        if (pr.success) showToast(I18N.t('subscriptions-print-success'), 'success');
      }
    } else {
      document.getElementById('errNewSub').textContent = r.message || I18N.t('subscriptions-err-generic');
      document.getElementById('errNewSub').style.display = 'block';
    }
  });

  async function openRenewModal(subId) {
    document.getElementById('renewSubId').value = String(subId);
    document.getElementById('errRenew').style.display = 'none';
    document.getElementById('renewStart').value = '';
    document.getElementById('renewCarry').checked = true;
    await fillPackageSelect('renew', true);
    modalRenew.style.display = 'flex';
  }

  function openEditSubscriptionModal(s) {
    document.getElementById('editSubId').value = String(s.id);
    document.getElementById('editSubPeriodFrom').value = toDateInputValue(s.period_from);
    document.getElementById('editSubEndDate').value = toDateInputValue(s.end_date || '');
    const cr = s.credit_remaining;
    document.getElementById('editSubCredit').value =
      cr != null && cr !== '' && !Number.isNaN(Number(cr)) ? String(Number(cr)) : '';
    const hint = document.getElementById('editSubRefHint');
    const ref = s.customer_file_ref || s.subscription_ref || '';
    const name = s.customer_name || '';
    hint.textContent = ref ? `${ref}${name ? ` — ${name}` : ''}` : '';
    document.getElementById('errEditSub').style.display = 'none';
    modalEditSub.style.display = 'flex';
  }

  document.getElementById('btnCloseEditSub').addEventListener('click', () => { modalEditSub.style.display = 'none'; });
  document.getElementById('btnCancelEditSub').addEventListener('click', () => { modalEditSub.style.display = 'none'; });
  document.getElementById('btnSaveEditSub').addEventListener('click', async () => {
    const subscriptionId = Number(document.getElementById('editSubId').value);
    const periodFrom = document.getElementById('editSubPeriodFrom').value;
    const endDate = document.getElementById('editSubEndDate').value || undefined;
    const creditRemaining = document.getElementById('editSubCredit').value;
    if (!subscriptionId) return;
    if (!periodFrom) {
      document.getElementById('errEditSub').textContent = I18N.t('subscriptions-err-edit-dates');
      document.getElementById('errEditSub').style.display = 'block';
      return;
    }
    const r = await window.api.updateActiveSubscriptionPeriod({
      subscriptionId,
      periodFrom,
      endDate,
      creditRemaining: creditRemaining === '' ? undefined : Number(creditRemaining)
    });
    if (r.success) {
      showToast(I18N.t('subscriptions-edit-success'), 'success');
      modalEditSub.style.display = 'none';
      await loadSubscriptions();
    } else {
      document.getElementById('errEditSub').textContent = r.message || I18N.t('subscriptions-err-generic');
      document.getElementById('errEditSub').style.display = 'block';
    }
  });

  document.getElementById('btnCloseRenew').addEventListener('click', () => { modalRenew.style.display = 'none'; });
  document.getElementById('btnCancelRenew').addEventListener('click', () => { modalRenew.style.display = 'none'; });
  document.getElementById('btnSaveRenew').addEventListener('click', async () => {
    const subscriptionId = Number(document.getElementById('renewSubId').value);
    const packageId = document.getElementById('renewPackage').value;
    const periodFrom = document.getElementById('renewStart').value || undefined;
    const carryOverRemaining = document.getElementById('renewCarry').checked;
    if (!packageId) {
      document.getElementById('errRenew').textContent = I18N.t('subscriptions-err-pick-customer-package');
      document.getElementById('errRenew').style.display = 'block';
      return;
    }
    const r = await window.api.renewSubscription({
      subscriptionId,
      packageId: Number(packageId),
      periodFrom,
      carryOverRemaining
    });
    if (r.success) {
      showToast(I18N.t('subscriptions-success-renew'), 'success');
      modalRenew.style.display = 'none';
      await loadSubscriptions();
      if (r.periodId) {
        const pr = await window.api.printSubscriptionReceipt({ periodId: r.periodId });
        if (pr.success) showToast(I18N.t('subscriptions-print-success'), 'success');
      }
    } else {
      document.getElementById('errRenew').textContent = r.message || I18N.t('subscriptions-err-generic');
      document.getElementById('errRenew').style.display = 'block';
    }
  });

  async function openDetailModal(subId) {
    const [dRes, pRes, lRes] = await Promise.all([
      window.api.getSubscriptionDetail({ id: subId }),
      window.api.getSubscriptionPeriods({ subscriptionId: subId }),
      window.api.getSubscriptionLedger({ subscriptionId: subId })
    ]);
    if (!dRes.success || !dRes.subscription) {
      showToast(I18N.t('subscriptions-err-load'), 'error');
      return;
    }
    const s = dRes.subscription;
    const periods = pRes.success ? pRes.periods || [] : [];
    const ledger = lRes.success ? lRes.ledger || [] : [];
    const lastPeriod = periods.length ? periods[periods.length - 1] : null;
    detailPrintPeriodId = lastPeriod ? lastPeriod.id : null;

    detailSubscriptionId = subId;
    detailCustomerId = s.customer_id != null ? Number(s.customer_id) : null;

    const Lk = (key) => escHtml(I18N.t(key));
    const lpFrom = Lk('subscriptions-detail-period-from');
    const lpTo = Lk('subscriptions-detail-period-to');
    const lpPkg = Lk('subscriptions-col-package');
    const lpPaid = Lk('subscriptions-detail-period-paid');
    const lpGrant = Lk('subscriptions-detail-period-granted');
    const lpRem = Lk('subscriptions-detail-period-remaining');
    const lpSt = Lk('subscriptions-col-status');
    const llType = Lk('subscriptions-ledger-type');
    const llAmt = Lk('subscriptions-ledger-amount');
    const llBal = Lk('subscriptions-ledger-balance');
    const llNotes = Lk('subscriptions-ledger-notes');
    const llDate = Lk('subscriptions-ledger-date');

    const periodsHtml = (pageList) => pageList
      .map(
        (p) => `
      <tr>
        <td data-label="${lpFrom}"><span class="detail-td-val">${escHtml(formatDateNumeric(p.period_from))}</span></td>
        <td data-label="${lpTo}"><span class="detail-td-val">${p.period_to ? escHtml(formatDateNumeric(p.period_to)) : '∞'}</span></td>
        <td data-label="${lpPkg}"><span class="detail-td-val">${escHtml(p.package_name)}</span></td>
        <td data-label="${lpPaid}"><span class="detail-td-val">${riyalHtml(Number(p.prepaid_price_paid).toFixed(2))}</span></td>
        <td data-label="${lpGrant}"><span class="detail-td-val">${riyalHtml(Number(p.credit_value_granted).toFixed(2))}</span></td>
        <td data-label="${lpRem}"><span class="detail-td-val">${riyalHtml(Number(p.credit_remaining).toFixed(2))}</span></td>
        <td data-label="${lpSt}"><span class="detail-td-val">${escHtml(p.status)}</span></td>
      </tr>`
      )
      .join('');

    const ledgerHtml = (pageList) => pageList
      .map(
        (l) => `
      <tr>
        <td data-label="${llType}"><span class="detail-td-val">${escHtml(ledgerLabel(l.entry_type))}</span></td>
        <td data-label="${llAmt}"><span class="detail-td-val">${riyalHtml(Number(l.amount).toFixed(2))}</span></td>
        <td data-label="${llBal}"><span class="detail-td-val">${riyalHtml(Number(l.balance_after).toFixed(2))}</span></td>
        <td data-label="${llNotes}"><span class="detail-td-val">${escHtml(l.notes || '')}</span></td>
        <td data-label="${llDate}"><span class="detail-td-val">${escHtml(formatDateTimeNumeric(l.created_at))}</span></td>
      </tr>`
      )
      .join('');

    const periodsCardsHtml = (pageList) => pageList.map(p => {
      const stClass = p.status === 'active' ? 'badge-act' : p.status === 'expired' ? 'badge-exp' : 'badge-closed';
      return `
      <div class="detail-card">
        <div class="detail-card-row1">
          <span class="detail-card-pkg">${escHtml(p.package_name)}</span>
          <span class="badge ${stClass}">${escHtml(p.status)}</span>
        </div>
        <div class="detail-card-dates">${escHtml(formatDateNumeric(p.period_from))} — ${p.period_to ? escHtml(formatDateNumeric(p.period_to)) : '∞'}</div>
        <div class="detail-card-row2">
          <div class="detail-card-field">
            <span class="detail-card-label">${lpPaid}</span>
            <span class="detail-card-val">${riyalHtml(Number(p.prepaid_price_paid).toFixed(2))}</span>
          </div>
          <div class="detail-card-field">
            <span class="detail-card-label">${lpGrant}</span>
            <span class="detail-card-val">${riyalHtml(Number(p.credit_value_granted).toFixed(2))}</span>
          </div>
          <div class="detail-card-field">
            <span class="detail-card-label">${lpRem}</span>
            <span class="detail-card-val" style="color:#0d9488">${riyalHtml(Number(p.credit_remaining).toFixed(2))}</span>
          </div>
        </div>
      </div>`;
    }).join('') || `<div class="detail-card-empty">—</div>`;

    const ledgerCardsHtml = (pageList) => pageList.map(l => {
      const isConsumption = l.entry_type === 'consumption';
      const amtColor = isConsumption ? 'color:#dc2626' : 'color:#16a34a';
      const amtSign  = isConsumption ? '−' : '+';
      return `
      <div class="detail-card">
        <div class="detail-card-row1">
          <span class="detail-card-type">${escHtml(ledgerLabel(l.entry_type))}</span>
          <span class="detail-card-date">${escHtml(formatDateTimeNumeric(l.created_at))}</span>
        </div>
        <div class="detail-card-row2">
          <div class="detail-card-field">
            <span class="detail-card-label">${llAmt}</span>
            <span class="detail-card-val" style="${amtColor}">${amtSign} ${riyalHtml(Number(l.amount).toFixed(2))}</span>
          </div>
          <div class="detail-card-field">
            <span class="detail-card-label">${llBal}</span>
            <span class="detail-card-val">${riyalHtml(Number(l.balance_after).toFixed(2))}</span>
          </div>
        </div>
        ${l.notes ? `<div class="detail-card-notes">${escHtml(l.notes)}</div>` : ''}
      </div>`;
    }).join('') || `<div class="detail-card-empty">—</div>`;

    // دالة مساعدة لبناء pagination bar
    function buildPagBar(id, page, total, pageSize) {
      if (total <= pageSize) return '';
      const totalPages = Math.ceil(total / pageSize);
      const s = (page - 1) * pageSize + 1, e = Math.min(page * pageSize, total);
      const range = getSubsPageRange(page, totalPages);
      const nums = range.map(p =>
        p === '...'
          ? '<span class="page-ellipsis">…</span>'
          : `<button type="button" class="page-num ${p === page ? 'active' : ''}" data-pag-id="${id}" data-pag-p="${p}">${p}</button>`
      ).join('');
      return `
        <div class="detail-inv-pag" id="pag-${id}">
          <div class="detail-inv-pag-info">${s}–${e} من ${total}</div>
          <div class="detail-inv-pag-controls">
            <button type="button" class="page-btn" data-pag-id="${id}" data-pag-p="first" ${page===1?'disabled':''}>«</button>
            <button type="button" class="page-btn" data-pag-id="${id}" data-pag-p="prev"  ${page===1?'disabled':''}>‹</button>
            <div class="page-numbers">${nums}</div>
            <button type="button" class="page-btn" data-pag-id="${id}" data-pag-p="next"  ${page===totalPages?'disabled':''}>›</button>
            <button type="button" class="page-btn" data-pag-id="${id}" data-pag-p="last"  ${page===totalPages?'disabled':''}>»</button>
          </div>
        </div>`;
    }

    // حالة pagination الفترات والحركات
    const PAG_SIZE = 10;
    let periodsPage = 1;
    let ledgerPage  = 1;

    function renderPeriodsSection() {
      const total = periods.length;
      const totalPages = Math.max(1, Math.ceil(total / PAG_SIZE));
      if (periodsPage > totalPages) periodsPage = totalPages;
      const slice = periods.slice((periodsPage - 1) * PAG_SIZE, periodsPage * PAG_SIZE);
      const tbody = document.getElementById('detailPeriodsTbody');
      const cards = document.getElementById('detailPeriodsCards');
      if (tbody) tbody.innerHTML = slice.length
        ? periodsHtml(slice)
        : `<tr class="sub-table-empty"><td colspan="7"><span class="detail-td-val">—</span></td></tr>`;
      if (cards) cards.innerHTML = periodsCardsHtml(slice);
      const pag = document.getElementById('pag-periods');
      if (pag) pag.outerHTML = buildPagBar('periods', periodsPage, total, PAG_SIZE) || '';
      bindPagClicks();
    }

    function renderLedgerSection() {
      const total = ledger.length;
      const totalPages = Math.max(1, Math.ceil(total / PAG_SIZE));
      if (ledgerPage > totalPages) ledgerPage = totalPages;
      const slice = ledger.slice((ledgerPage - 1) * PAG_SIZE, ledgerPage * PAG_SIZE);
      const tbody = document.getElementById('detailLedgerTbody');
      const cards = document.getElementById('detailLedgerCards');
      if (tbody) tbody.innerHTML = slice.length
        ? ledgerHtml(slice)
        : `<tr class="sub-table-empty"><td colspan="5"><span class="detail-td-val">—</span></td></tr>`;
      if (cards) cards.innerHTML = ledgerCardsHtml(slice);
      const pag = document.getElementById('pag-ledger');
      if (pag) pag.outerHTML = buildPagBar('ledger', ledgerPage, total, PAG_SIZE) || '';
      bindPagClicks();
    }

    function bindPagClicks() {
      document.querySelectorAll('[data-pag-id]').forEach(btn => {
        btn.onclick = null;
        btn.addEventListener('click', () => {
          const id = btn.dataset.pagId;
          const p  = btn.dataset.pagP;
          if (id === 'periods') {
            const tot = Math.ceil(periods.length / PAG_SIZE);
            if (p === 'first') periodsPage = 1;
            else if (p === 'prev')  periodsPage = Math.max(1, periodsPage - 1);
            else if (p === 'next')  periodsPage = Math.min(tot, periodsPage + 1);
            else if (p === 'last')  periodsPage = tot;
            else periodsPage = Number(p);
            renderPeriodsSection();
          } else {
            const tot = Math.ceil(ledger.length / PAG_SIZE);
            if (p === 'first') ledgerPage = 1;
            else if (p === 'prev')  ledgerPage = Math.max(1, ledgerPage - 1);
            else if (p === 'next')  ledgerPage = Math.min(tot, ledgerPage + 1);
            else if (p === 'last')  ledgerPage = tot;
            else ledgerPage = Number(p);
            renderLedgerSection();
          }
        });
      });
    }

    // الصفحة الأولى
    const initPeriodsSlice = periods.slice(0, PAG_SIZE);
    const initLedgerSlice  = ledger.slice(0, PAG_SIZE);

    document.getElementById('detailBody').innerHTML = `
      <div class="detail-body-inner">
        <section class="detail-summary" aria-label="${Lk('subscriptions-modal-detail-title')}">
          <div class="detail-summary-grid">
            <div class="detail-field">
              <span class="detail-field-label">${Lk('subscriptions-col-ref')}</span>
              <span class="detail-field-value">${escHtml(s.customer_file_ref || s.subscription_ref || '—')}</span>
            </div>
            <div class="detail-field">
              <span class="detail-field-label">${Lk('subscriptions-col-customer')}</span>
              <span class="detail-field-value">${escHtml(s.customer_name)}</span>
            </div>
            <div class="detail-field detail-field--phone">
              <span class="detail-field-label">${Lk('subscriptions-col-phone')}</span>
              <span class="detail-field-value">${escHtml(s.phone)}</span>
            </div>
          </div>
        </section>
        <section class="detail-section" aria-labelledby="detailPeriodsTitle">
          <h3 class="detail-section-title" id="detailPeriodsTitle">${Lk('subscriptions-section-periods')}</h3>
          <div class="detail-table-scroll detail-desktop-only" role="region" tabindex="0" aria-labelledby="detailPeriodsTitle">
            <table class="sub-table detail-periods">
              <thead><tr>
                <th>${lpFrom}</th><th>${lpTo}</th><th>${lpPkg}</th><th>${lpPaid}</th><th>${lpGrant}</th><th>${lpRem}</th><th>${lpSt}</th>
              </tr></thead>
              <tbody id="detailPeriodsTbody">${
                periodsHtml(initPeriodsSlice) ||
                `<tr class="sub-table-empty"><td colspan="7"><span class="detail-td-val">—</span></td></tr>`
              }</tbody>
            </table>
          </div>
          <div class="detail-mobile-only" id="detailPeriodsCards">${periodsCardsHtml(initPeriodsSlice)}</div>
          ${buildPagBar('periods', 1, periods.length, PAG_SIZE)}
        </section>
        <section class="detail-section" aria-labelledby="detailLedgerTitle">
          <h3 class="detail-section-title" id="detailLedgerTitle">${Lk('subscriptions-section-ledger')}</h3>
          <div class="detail-table-scroll detail-desktop-only" role="region" tabindex="0" aria-labelledby="detailLedgerTitle">
            <table class="sub-table detail-ledger">
              <thead><tr>
                <th>${llType}</th><th>${llAmt}</th><th>${llBal}</th><th>${llNotes}</th><th>${llDate}</th>
              </tr></thead>
              <tbody id="detailLedgerTbody">${
                ledgerHtml(initLedgerSlice) ||
                `<tr class="sub-table-empty"><td colspan="5"><span class="detail-td-val">—</span></td></tr>`
              }</tbody>
            </table>
          </div>
          <div class="detail-mobile-only" id="detailLedgerCards">${ledgerCardsHtml(initLedgerSlice)}</div>
          ${buildPagBar('ledger', 1, ledger.length, PAG_SIZE)}
        </section>
      </div>
    `;

    // ربط أحداث pagination الفترات والحركات
    bindPagClicks();

    // ── Mobile tabs: rebuild detailBody as tabbed layout on small screens ──
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    if (isMobile) {
      const detailBodyEl = document.getElementById('detailBody');
      detailBodyEl.classList.add('has-tabs');

      // Remove old tabs nav if any
      const oldNav = detailBodyEl.previousElementSibling;
      if (oldNav && oldNav.classList.contains('detail-tabs-nav')) oldNav.remove();

      // Build tabs nav
      const tabsNav = document.createElement('nav');
      tabsNav.className = 'detail-tabs-nav';
      tabsNav.setAttribute('role', 'tablist');
      const tabDefs = [
        { id: 'dtab-info',     label: I18N.t('subscriptions-detail-tab-info')    || 'المعلومات' },
        { id: 'dtab-periods',  label: I18N.t('subscriptions-detail-tab-periods') || 'الفترات' },
        { id: 'dtab-ledger',   label: I18N.t('subscriptions-detail-tab-ledger')  || 'الحركات' }
      ];
      tabDefs.forEach((td, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'detail-tab-btn' + (i === 0 ? ' active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        btn.setAttribute('aria-controls', td.id);
        btn.textContent = td.label;
        tabsNav.appendChild(btn);
      });

      // Insert nav before detailBody
      detailBodyEl.parentNode.insertBefore(tabsNav, detailBodyEl);

      // Build tab panels content
      detailBodyEl.innerHTML = `
        <div id="dtab-info" class="detail-tab-panel active" role="tabpanel">
          <div class="detail-tab-panel-inner">
            <div class="detail-summary-grid">
              <div class="detail-field">
                <span class="detail-field-label">${Lk('subscriptions-col-ref')}</span>
                <span class="detail-field-value">${escHtml(s.customer_file_ref || s.subscription_ref || '—')}</span>
              </div>
              <div class="detail-field">
                <span class="detail-field-label">${Lk('subscriptions-col-customer')}</span>
                <span class="detail-field-value">${escHtml(s.customer_name)}</span>
              </div>
              <div class="detail-field detail-field--phone">
                <span class="detail-field-label">${Lk('subscriptions-col-phone')}</span>
                <span class="detail-field-value">${escHtml(s.phone)}</span>
              </div>
            </div>
          </div>
        </div>
        <div id="dtab-periods" class="detail-tab-panel" role="tabpanel">
          <div class="detail-tab-panel-inner">
            <div class="detail-table-scroll detail-desktop-only" role="region" tabindex="0">
              <table class="sub-table detail-periods">
                <thead><tr>
                  <th>${lpFrom}</th><th>${lpTo}</th><th>${lpPkg}</th><th>${lpPaid}</th><th>${lpGrant}</th><th>${lpRem}</th><th>${lpSt}</th>
                </tr></thead>
                <tbody id="detailPeriodsTbody">${periodsHtml(initPeriodsSlice) || `<tr class="sub-table-empty"><td colspan="7"><span class="detail-td-val">—</span></td></tr>`}</tbody>
              </table>
            </div>
            <div class="detail-mobile-only" id="detailPeriodsCards">${periodsCardsHtml(initPeriodsSlice)}</div>
            ${buildPagBar('periods', 1, periods.length, PAG_SIZE)}
          </div>
        </div>
        <div id="dtab-ledger" class="detail-tab-panel" role="tabpanel">
          <div class="detail-tab-panel-inner">
            <div class="detail-table-scroll detail-desktop-only" role="region" tabindex="0">
              <table class="sub-table detail-ledger">
                <thead><tr>
                  <th>${llType}</th><th>${llAmt}</th><th>${llBal}</th><th>${llNotes}</th><th>${llDate}</th>
                </tr></thead>
                <tbody id="detailLedgerTbody">${ledgerHtml(initLedgerSlice) || `<tr class="sub-table-empty"><td colspan="5"><span class="detail-td-val">—</span></td></tr>`}</tbody>
              </table>
            </div>
            <div class="detail-mobile-only" id="detailLedgerCards">${ledgerCardsHtml(initLedgerSlice)}</div>
            ${buildPagBar('ledger', 1, ledger.length, PAG_SIZE)}
          </div>
        </div>
      `;

      // Tab switching logic
      const tabBtns = tabsNav.querySelectorAll('.detail-tab-btn');
      tabBtns.forEach((btn, i) => {
        btn.addEventListener('click', () => {
          tabBtns.forEach((b, j) => {
            b.classList.toggle('active', j === i);
            b.setAttribute('aria-selected', j === i ? 'true' : 'false');
          });
          detailBodyEl.querySelectorAll('.detail-tab-panel').forEach((panel, j) => {
            panel.classList.toggle('active', j === i);
          });
        });
      });
      // ربط pagination بعد بناء الـ mobile tabs
      bindPagClicks();
    }
    const noPeriod = !detailPrintPeriodId;
    document.getElementById('btnDetailPrint').disabled = noPeriod;
    document.getElementById('btnDetailReceiptPdf').disabled = noPeriod;
    // إعادة التاب لـ "التفاصيل" عند كل فتح
    detailInvLoaded = false;
    switchDetailTab('info');
    modalDetail.style.display = 'flex';

    // على الجوال: بعد الفتح نحسب الارتفاع المتبقي ونعيّنه صراحةً للـ body
    if (isMobile) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const detailBodyEl = document.getElementById('detailBody');
          const box = detailBodyEl ? detailBodyEl.closest('.modal-detail') : null;
          if (!box || !detailBodyEl) return;
          const boxH = box.getBoundingClientRect().height;
          const header = box.querySelector('.modal-header');
          const nav = box.querySelector('.detail-tabs-nav');
          const footer = box.querySelector('.modal-footer');
          const headerH = header ? header.getBoundingClientRect().height : 0;
          const navH = nav ? nav.getBoundingClientRect().height : 0;
          const footerH = footer ? footer.getBoundingClientRect().height : 0;
          const bodyH = boxH - headerH - navH - footerH;
          if (bodyH > 0) {
            detailBodyEl.style.maxHeight = bodyH + 'px';
            detailBodyEl.style.height = bodyH + 'px';
          }

          // تمرير touch events العمودية من العناصر الداخلية للـ detailBody
          let touchStartY = 0;
          detailBodyEl.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
          }, { passive: true });
          detailBodyEl.addEventListener('touchmove', (e) => {
            const dy = touchStartY - e.touches[0].clientY;
            detailBodyEl.scrollTop += dy;
            touchStartY = e.touches[0].clientY;
          }, { passive: true });
        });
      });
    }
  }

  document.getElementById('btnCloseDetail').addEventListener('click', () => { modalDetail.style.display = 'none'; });
  document.getElementById('btnCloseDetail2').addEventListener('click', () => { modalDetail.style.display = 'none'; });

  // ── تابات modal التفاصيل ──
  const detailTabInfo     = document.getElementById('detailTabInfo');
  const detailTabInvoices = document.getElementById('detailTabInvoices');
  const detailBodyEl2     = document.getElementById('detailBody');
  const detailInvBody     = document.getElementById('detailInvoicesBody');
  const detailInvTbody    = document.getElementById('detailInvoicesTbody');
  const detailInvEmpty    = document.getElementById('detailInvoicesEmpty');
  const detailInvSearch   = document.getElementById('detailInvSearch');
  const detailFooterInfo  = document.getElementById('detailFooterInfo');
  const detailInvCards    = document.getElementById('detailInvoicesCards');
  const detailInvPagBar   = document.getElementById('detailInvPagBar');
  const detailInvPagInfo  = document.getElementById('detailInvPagInfo');
  const detailInvPageNums = document.getElementById('detailInvPageNums');
  const detailInvBtnFirst = document.getElementById('detailInvBtnFirst');
  const detailInvBtnPrev  = document.getElementById('detailInvBtnPrev');
  const detailInvBtnNext  = document.getElementById('detailInvBtnNext');
  const detailInvBtnLast  = document.getElementById('detailInvBtnLast');

  let detailInvSearchTimer = null;
  let detailInvAllList = [];
  let detailInvPage = 1;
  const detailInvPageSize = 10;

  function switchDetailTab(tab) {
    if (tab === 'info') {
      detailTabInfo.classList.add('active');
      detailTabInvoices.classList.remove('active');
      detailBodyEl2.style.display = '';
      detailInvBody.style.display = 'none';
      detailFooterInfo.style.display = '';
    } else {
      detailTabInvoices.classList.add('active');
      detailTabInfo.classList.remove('active');
      detailInvBody.style.display = '';
      detailBodyEl2.style.display = 'none';
      detailFooterInfo.style.display = 'none';
      if (!detailInvLoaded) loadDetailInvoices();
    }
  }

  function renderDetailInvoices(filteredList) {
    const pmLabel = (m) => ({ cash:'نقداً', card:'شبكة', credit:'آجل', mixed:'مختلط', bank:'تحويل بنكي', other:'أخرى' }[m] || m || '—');

    if (!filteredList.length) {
      detailInvTbody.innerHTML = '';
      if (detailInvCards) detailInvCards.innerHTML = '';
      if (detailInvPagBar) detailInvPagBar.style.display = 'none';
      detailInvEmpty.style.display = 'flex';
      return;
    }
    detailInvEmpty.style.display = 'none';

    // pagination
    const total = filteredList.length;
    const totalPages = Math.max(1, Math.ceil(total / detailInvPageSize));
    if (detailInvPage > totalPages) detailInvPage = totalPages;
    const start = (detailInvPage - 1) * detailInvPageSize;
    const pageList = filteredList.slice(start, start + detailInvPageSize);

    // جدول الديسكتوب
    detailInvTbody.innerHTML = pageList.map(inv => `
      <tr>
        <td>${escHtml(String(inv.invoice_seq || inv.order_number || '—'))}</td>
        <td>${escHtml(formatDateTimeNumeric(inv.created_at))}</td>
        <td>${riyalHtml(Number(inv.total_amount).toFixed(2))}</td>
        <td>${riyalHtml(Number(inv.deducted_amount).toFixed(2))}</td>
        <td>${escHtml(pmLabel(inv.payment_method))}</td>
      </tr>`).join('');

    // بطاقات الجوال
    if (detailInvCards) {
      detailInvCards.innerHTML = pageList.map(inv => `
        <div class="inv-card">
          <div class="inv-card-row1">
            <span class="inv-card-num">فاتورة #${escHtml(String(inv.invoice_seq || inv.order_number || '—'))}</span>
            <span class="inv-card-date">${escHtml(formatDateTimeNumeric(inv.created_at))}</span>
          </div>
          <div class="inv-card-row2">
            <div class="inv-card-field">
              <span class="inv-card-label">المبلغ الإجمالي</span>
              <span class="inv-card-val">${riyalHtml(Number(inv.total_amount).toFixed(2))}</span>
            </div>
            <div class="inv-card-field">
              <span class="inv-card-label">المخصوم</span>
              <span class="inv-card-val">${riyalHtml(Number(inv.deducted_amount).toFixed(2))}</span>
            </div>
            <span class="inv-card-pay">${escHtml(pmLabel(inv.payment_method))}</span>
          </div>
        </div>`).join('');
    }

    // pagination bar
    if (detailInvPagBar) {
      if (total <= detailInvPageSize) {
        detailInvPagBar.style.display = 'none';
      } else {
        detailInvPagBar.style.display = 'flex';
        const s = start + 1, e = Math.min(start + detailInvPageSize, total);
        detailInvPagInfo.textContent = `${s}–${e} من ${total}`;
        detailInvBtnFirst.disabled = detailInvPage === 1;
        detailInvBtnPrev.disabled  = detailInvPage === 1;
        detailInvBtnNext.disabled  = detailInvPage === totalPages;
        detailInvBtnLast.disabled  = detailInvPage === totalPages;
        // أرقام الصفحات
        const range = getSubsPageRange(detailInvPage, totalPages);
        detailInvPageNums.innerHTML = range.map(p =>
          p === '...'
            ? '<span class="page-ellipsis">…</span>'
            : `<button type="button" class="page-num ${p === detailInvPage ? 'active' : ''}" data-dinv-page="${p}">${p}</button>`
        ).join('');
        detailInvPageNums.querySelectorAll('[data-dinv-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            detailInvPage = Number(btn.dataset.dinvPage);
            renderDetailInvoices(filteredList);
          });
        });
      }
    }
  }

  // ربط أزرار pagination
  if (detailInvBtnFirst) detailInvBtnFirst.addEventListener('click', () => { detailInvPage = 1; renderDetailInvoices(detailInvAllList.filter(inv => { const q = detailInvSearch && detailInvSearch.value.trim().toLowerCase(); return !q || String(inv.invoice_seq||'').includes(q) || String(inv.order_number||'').toLowerCase().includes(q); })); });
  if (detailInvBtnPrev)  detailInvBtnPrev.addEventListener('click',  () => { detailInvPage--; renderDetailInvoices(detailInvAllList.filter(inv => { const q = detailInvSearch && detailInvSearch.value.trim().toLowerCase(); return !q || String(inv.invoice_seq||'').includes(q) || String(inv.order_number||'').toLowerCase().includes(q); })); });
  if (detailInvBtnNext)  detailInvBtnNext.addEventListener('click',  () => { detailInvPage++; renderDetailInvoices(detailInvAllList.filter(inv => { const q = detailInvSearch && detailInvSearch.value.trim().toLowerCase(); return !q || String(inv.invoice_seq||'').includes(q) || String(inv.order_number||'').toLowerCase().includes(q); })); });
  if (detailInvBtnLast)  detailInvBtnLast.addEventListener('click',  () => { const total=detailInvAllList.length; detailInvPage=Math.ceil(total/detailInvPageSize); renderDetailInvoices(detailInvAllList.filter(inv => { const q = detailInvSearch && detailInvSearch.value.trim().toLowerCase(); return !q || String(inv.invoice_seq||'').includes(q) || String(inv.order_number||'').toLowerCase().includes(q); })); });

  async function loadDetailInvoices() {
    detailInvLoaded = true;
    detailInvPage = 1;
    detailInvTbody.innerHTML = `<tr><td colspan="5" class="loading-cell"><span class="spinner"></span></td></tr>`;
    if (detailInvCards) detailInvCards.innerHTML = '';
    if (detailInvPagBar) detailInvPagBar.style.display = 'none';
    detailInvEmpty.style.display = 'none';
    try {
      const res = await window.api.getOrdersBySubscription({ subscriptionId: detailSubscriptionId });
      detailInvAllList = res && res.success ? (res.orders || []) : [];
      renderDetailInvoices(detailInvAllList);
    } catch (e) {
      detailInvTbody.innerHTML = `<tr><td colspan="5" class="loading-cell" style="color:#b91c1c">حدث خطأ</td></tr>`;
    }
  }

  detailTabInfo.addEventListener('click', () => switchDetailTab('info'));
  detailTabInvoices.addEventListener('click', () => switchDetailTab('invoices'));

  if (detailInvSearch) {
    detailInvSearch.addEventListener('input', () => {
      clearTimeout(detailInvSearchTimer);
      detailInvSearchTimer = setTimeout(() => {
        const q = detailInvSearch.value.trim().toLowerCase();
        const list = q
          ? detailInvAllList.filter(inv =>
              String(inv.invoice_seq || '').includes(q) ||
              String(inv.order_number || '').toLowerCase().includes(q))
          : detailInvAllList;
        detailInvPage = 1;
        renderDetailInvoices(list);
      }, 200);
    });
  }

  document.getElementById('btnDetailPrint').addEventListener('click', async () => {
    if (!detailPrintPeriodId) return;
    const r = await window.api.printSubscriptionReceipt({ periodId: detailPrintPeriodId });
    if (r.success) showToast(I18N.t('subscriptions-print-success'), 'success');
    else showToast(r.message || I18N.t('subscriptions-err-generic'), 'error');
  });

  document.getElementById('btnDetailReceiptPdf').addEventListener('click', async () => {
    if (!detailPrintPeriodId) return;
    const r = await window.api.exportSubscriptionReceiptPdf({ periodId: detailPrintPeriodId });
    if (r.success) showToast(I18N.t('subscriptions-pdf-receipt-success'), 'success');
    else showToast(r.message || I18N.t('subscriptions-export-error'), 'error');
  });

  document.getElementById('btnDetailReportPdf').addEventListener('click', async () => {
    if (!detailCustomerId || !detailSubscriptionId) return;
    const r = await window.api.exportSubscriptionCustomerReport({
      type: 'pdf',
      customerId: detailCustomerId,
      subscriptionId: detailSubscriptionId
    });
    if (r.success) showToast(I18N.t('subscriptions-export-success'), 'success');
    else showToast(r.message || I18N.t('subscriptions-export-error'), 'error');
  });

  btnExportSubsExcel.addEventListener('click', async () => {
    const r = await window.api.exportSubscriptions({ type: 'excel', filters: buildListFilters() });
    if (r.success) showToast(I18N.t('subscriptions-export-success'), 'success');
    else showToast(r.message || I18N.t('subscriptions-export-error'), 'error');
  });
  btnExportSubsPdf.addEventListener('click', async () => {
    const r = await window.api.exportSubscriptions({ type: 'pdf', filters: buildListFilters() });
    if (r.success) showToast(I18N.t('subscriptions-export-success'), 'success');
    else showToast(r.message || I18N.t('subscriptions-export-error'), 'error');
  });

  btnExportCustomerExcel.addEventListener('click', async () => {
    if (!filterCustomerId) return;
    const r = await window.api.exportSubscriptionCustomerReport({
      type: 'excel',
      customerId: filterCustomerId
    });
    if (r.success) showToast(I18N.t('subscriptions-export-success'), 'success');
    else showToast(r.message || I18N.t('subscriptions-export-error'), 'error');
  });

  btnExportCustomerPdf.addEventListener('click', async () => {
    if (!filterCustomerId) return;
    const r = await window.api.exportSubscriptionCustomerReport({
      type: 'pdf',
      customerId: filterCustomerId
    });
    if (r.success) showToast(I18N.t('subscriptions-export-success'), 'success');
    else showToast(r.message || I18N.t('subscriptions-export-error'), 'error');
  });

  initNewSubCustomerCombobox();
  initPackageDropdown('newSub');
  initPackageDropdown('renew');
  const pkgPh = I18N.t('subscriptions-select-package');
  const nLab = document.getElementById('newSubPackageLabel');
  const rLab = document.getElementById('renewPackageLabel');
  if (nLab) nLab.textContent = pkgPh;
  if (rLab) rLab.textContent = pkgPh;

  if (filterCustomerId) {
    tabSubscriptions.click();
  } else {
    loadSubscriptions();
  }
});
