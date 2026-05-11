window.addEventListener('DOMContentLoaded', () => {
  try {
    const btnBack = document.getElementById('btnBack');
    const btnAddProduct = document.getElementById('btnAddProduct');
    const btnExportExcel = document.getElementById('btnExportExcel');
    const btnExportPdf = document.getElementById('btnExportPdf');
    const searchInput = document.getElementById('searchInput');
    const productsTableBody = document.getElementById('productsTableBody');
    const emptyState = document.getElementById('emptyState');
    const toastContainer = document.getElementById('toastContainer');
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmMsg = document.getElementById('confirmMsg');
    const btnConfirmOk = document.getElementById('btnConfirmOk');
    const btnConfirmCancel = document.getElementById('btnConfirmCancel');
    const paginationBar = document.getElementById('paginationBar');
    const paginationInfo = document.getElementById('paginationInfo');
    const pageNumbers = document.getElementById('pageNumbers');
    const btnFirstPage = document.getElementById('btnFirstPage');
    const btnPrevPage = document.getElementById('btnPrevPage');
    const btnNextPage = document.getElementById('btnNextPage');
    const btnLastPage = document.getElementById('btnLastPage');
    const pageSizeSelect = document.getElementById('pageSizeSelect');

    const modalOverlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalError = document.getElementById('modalError');
    const editProductId = document.getElementById('editProductId');
    const inputNameAr = document.getElementById('inputNameAr');
    const inputNameEn = document.getElementById('inputNameEn');
    const inputIsActive = document.getElementById('inputIsActive');
    const imagePreview = document.getElementById('imagePreview');
    const imagePlaceholder = document.getElementById('imagePlaceholder');
    const btnPickImage = document.getElementById('btnPickImage');
    const btnRemoveImage = document.getElementById('btnRemoveImage');
    const btnAddPriceLine = document.getElementById('btnAddPriceLine');
    const priceLinesBody = document.getElementById('priceLinesBody');
    const btnModalClose = document.getElementById('btnModalClose');
    const btnModalCancel = document.getElementById('btnModalCancel');
    const btnModalSave = document.getElementById('btnModalSave');
    const btnTranslate = document.getElementById('btnTranslate');

    let currentProducts = [];
    let currentPage = 1;
    let currentPageSize = 50;
    let totalPages = 1;
    let totalRecords = 0;
    let currentFilters = {};
    let filterTimer = null;

    let servicesCache = [];

    let initialImageDataUrl = null;
    let initialHadImage = false;
    let stagedImage = null;
    let imageRemoved = false;

    const LS_PRODUCT_SORT = 'productsTableSort';
    const PRODUCT_SORT_KEYS = new Set(['id', 'name_ar', 'name_en', 'is_active', 'created_at', 'lines', 'sort_order']);
    let sortBy = 'sort_order';
    let sortDir = 'asc';
    try {
      const raw = localStorage.getItem(LS_PRODUCT_SORT);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.sortBy && PRODUCT_SORT_KEYS.has(o.sortBy)) sortBy = o.sortBy;
        if (o.sortDir === 'asc' || o.sortDir === 'desc') sortDir = o.sortDir;
      }
    } catch (_) {}

    I18N.apply();

    document.querySelectorAll('#productsTableHead .th-sort-btn').forEach((btn) => {
      btn.addEventListener('click', () => onProductSortClick(btn.dataset.sort));
    });
    updateProductSortHeaderUI();

    btnBack.addEventListener('click', () => window.api.navigateBack());
    btnAddProduct.addEventListener('click', () => openModal(null));
    btnExportExcel.addEventListener('click', () => exportProducts('excel'));
    btnExportPdf.addEventListener('click', () => exportProducts('pdf'));
    btnModalClose.addEventListener('click', closeModal);
    btnModalCancel.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    btnModalSave.addEventListener('click', saveProduct);
    btnTranslate.addEventListener('click', autoTranslate);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    searchInput.addEventListener('input', applyFilters);

    btnFirstPage.addEventListener('click', () => goToPage(1));
    btnPrevPage.addEventListener('click', () => goToPage(currentPage - 1));
    btnNextPage.addEventListener('click', () => goToPage(currentPage + 1));
    btnLastPage.addEventListener('click', () => goToPage(totalPages));

    pageSizeSelect.addEventListener('change', () => {
      currentPageSize = Number(pageSizeSelect.value);
      currentPage = 1;
      loadProducts();
    });

    btnPickImage.addEventListener('click', async () => {
      const r = await window.api.pickProductImage();
      if (r.canceled) return;
      if (!r.success) {
        showToast(r.message || I18N.t('products-err-generic'), 'error');
        return;
      }
      stagedImage = { base64: r.base64, mime: r.mime || 'application/octet-stream' };
      imageRemoved = false;
      updateImagePreview();
    });

    btnRemoveImage.addEventListener('click', () => {
      stagedImage = null;
      imageRemoved = true;
      updateImagePreview();
    });

    btnAddPriceLine.addEventListener('click', () => addPriceLineRow());

    function applyFiltersImmediate() {
      currentPage = 1;
      buildFilters();
      loadProducts();
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

    function updateProductSortHeaderUI() {
      document.querySelectorAll('#productsTableHead .th-sortable').forEach((th) => {
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

    function onProductSortClick(sortKey) {
      if (!sortKey || !PRODUCT_SORT_KEYS.has(sortKey)) return;
      if (sortKey === sortBy) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortBy = sortKey;
        sortDir = 'asc';
      }
      try {
        localStorage.setItem(LS_PRODUCT_SORT, JSON.stringify({ sortBy, sortDir }));
      } catch (_) {}
      currentPage = 1;
      updateProductSortHeaderUI();
      loadProducts();
    }

    /** Gregorian date/time, Western digits only (for display regardless of UI language). */
    function formatProductDate(val) {
      if (val == null || val === '') return '—';
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString('en-GB', {
        calendar: 'gregory',
        numberingSystem: 'latn',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    function formatWesternInteger(n) {
      return Number(n).toLocaleString('en-US', { numberingSystem: 'latn', maximumFractionDigits: 0 });
    }

    /** Map Eastern Arabic / Persian digits so pasted or legacy values still parse. */
    function normalizeWesternDecimalString(str) {
      if (str == null) return '';
      let s = String(str).trim();
      const map = {
        '\u0660': '0',
        '\u0661': '1',
        '\u0662': '2',
        '\u0663': '3',
        '\u0664': '4',
        '\u0665': '5',
        '\u0666': '6',
        '\u0667': '7',
        '\u0668': '8',
        '\u0669': '9',
        '\u06f0': '0',
        '\u06f1': '1',
        '\u06f2': '2',
        '\u06f3': '3',
        '\u06f4': '4',
        '\u06f5': '5',
        '\u06f6': '6',
        '\u06f7': '7',
        '\u06f8': '8',
        '\u06f9': '9'
      };
      s = s.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (ch) => map[ch] || ch);
      return s.replace(/,/g, '.');
    }

    function formatWesternPriceInputDisplay(n) {
      const x = Number(n);
      if (!Number.isFinite(x) || x < 0) return '';
      return x.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
        numberingSystem: 'latn'
      });
    }

    function bindPriceFieldWesternDisplay(inputEl) {
      inputEl.addEventListener('blur', () => {
        const normalized = normalizeWesternDecimalString(inputEl.value);
        if (normalized === '') return;
        const n = parseFloat(normalized);
        if (Number.isFinite(n) && n >= 0) inputEl.value = formatWesternPriceInputDisplay(n);
      });
    }

    async function applyProductManualSortAndReload() {
      sortBy = 'sort_order';
      sortDir = 'asc';
      try {
        localStorage.setItem(LS_PRODUCT_SORT, JSON.stringify({ sortBy, sortDir }));
      } catch (_) {}
      updateProductSortHeaderUI();
      await loadProducts();
    }

    function bindProductsRowDnD() {
      productsTableBody.querySelectorAll('tr[data-row-id]').forEach((tr) => {
        const handle = tr.querySelector('.drag-handle');
        if (!handle) return;
        handle.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(tr.dataset.rowId));
          e.dataTransfer.effectAllowed = 'move';
          tr.classList.add('row-dragging');
        });
        handle.addEventListener('dragend', () => {
          tr.classList.remove('row-dragging');
          productsTableBody.querySelectorAll('tr.row-drag-over').forEach((row) => row.classList.remove('row-drag-over'));
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
            const r = await window.api.reorderProduct({ id: draggedId, beforeId: targetId });
            if (r.success) {
              showToast(I18N.t('products-reorder-success'), 'success');
              await applyProductManualSortAndReload();
            } else {
              showToast(r.message || I18N.t('products-err-generic'), 'error');
            }
          } catch (err) {
            showToast(I18N.t('products-err-db'), 'error');
          }
        });
      });
    }

    async function loadLookupData() {
      const sRes = await window.api.getLaundryServices({});
      servicesCache = sRes.success ? (sRes.services || []) : [];
    }

    function isServiceActive(s) {
      const v = s.is_active;
      if (v === undefined || v === null) return true;
      return Number(v) === 1;
    }

    function serviceOptionLabel(s) {
      const base = s.name_ar || '—';
      return isServiceActive(s) ? base : `${base} (${I18N.t('products-service-stopped')})`;
    }

    function serviceOptionsHtml(selectedId) {
      let h = `<option value="">${I18N.t('products-select-operation')}</option>`;
      servicesCache.forEach((s) => {
        const sel = String(s.id) === String(selectedId) ? ' selected' : '';
        h += `<option value="${s.id}"${sel}>${escHtml(serviceOptionLabel(s))}</option>`;
      });
      return h;
    }

    function addPriceLineRow(preset = {}) {
      const uid = `l${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const tr = document.createElement('tr');
      tr.dataset.lineUid = uid;
      const sid = preset.laundryServiceId != null ? preset.laundryServiceId : '';
      let priceVal = '';
      if (preset.price != null && preset.price !== '') {
        const pn = Number(preset.price);
        if (Number.isFinite(pn) && pn >= 0) priceVal = formatWesternPriceInputDisplay(pn);
      }
      tr.innerHTML = `
        <td>
          <select class="field-select-cell js-service">${serviceOptionsHtml(sid)}</select>
        </td>
        <td>
          <input type="text" class="price-input js-price" inputmode="decimal" lang="en" dir="ltr" autocomplete="off" placeholder="0.00" value="${escAttr(priceVal)}" />
        </td>
        <td>
          <button type="button" class="btn-remove-line js-remove-line">${I18N.t('products-line-remove')}</button>
        </td>`;
      tr.querySelector('.js-remove-line').addEventListener('click', () => tr.remove());
      bindPriceFieldWesternDisplay(tr.querySelector('.js-price'));
      priceLinesBody.appendChild(tr);
    }

    function clearPriceLines() {
      priceLinesBody.innerHTML = '';
    }

    function updateImagePreview() {
      if (imageRemoved && !stagedImage) {
        imagePreview.style.display = 'none';
        imagePreview.removeAttribute('src');
        imagePlaceholder.style.display = 'flex';
        imagePlaceholder.textContent = I18N.t('products-image-none');
        imagePlaceholder.classList.remove('has-image-stored');
        btnRemoveImage.style.display = 'none';
        return;
      }
      if (stagedImage) {
        imagePreview.src = `data:${stagedImage.mime};base64,${stagedImage.base64}`;
        imagePreview.style.display = 'block';
        imagePlaceholder.style.display = 'none';
        btnRemoveImage.style.display = 'inline-flex';
        return;
      }
      if (!imageRemoved && initialImageDataUrl) {
        imagePreview.src = initialImageDataUrl;
        imagePreview.style.display = 'block';
        imagePlaceholder.style.display = 'none';
        btnRemoveImage.style.display = 'inline-flex';
        return;
      }
      imagePreview.style.display = 'none';
      imagePreview.removeAttribute('src');
      imagePlaceholder.style.display = 'flex';
      imagePlaceholder.textContent = I18N.t('products-image-none');
      imagePlaceholder.classList.remove('has-image-stored');
      btnRemoveImage.style.display = 'none';
    }

    async function loadProducts() {
      buildFilters();
      productsTableBody.innerHTML = `
        <tr>
          <td colspan="10" class="loading-cell">
            <div class="spinner"></div>
            <span>${I18N.t('products-loading')}</span>
          </td>
        </tr>`;
      emptyState.style.display = 'none';
      paginationBar.style.display = 'none';

      try {
        const result = await window.api.getProducts({
          page: currentPage,
          pageSize: currentPageSize,
          ...currentFilters
        });

        if (result.success) {
          currentProducts = result.products;
          totalRecords = result.total;
          totalPages = result.totalPages || 1;
          renderTable(currentProducts);
          updateProductSortHeaderUI();
          renderPagination();
        } else {
          showToast(I18N.t('products-err-load'), 'error');
          productsTableBody.innerHTML = '';
        }
      } catch (err) {
        showToast(I18N.t('products-err-db'), 'error');
        console.error(err);
        productsTableBody.innerHTML = '';
      }
    }

    function isProductActive(p) {
      const v = p.is_active;
      if (v === undefined || v === null) return true;
      return Number(v) === 1;
    }

    function renderTable(products) {
      if (products.length === 0) {
        productsTableBody.innerHTML = '';
        emptyState.style.display = 'flex';
        paginationBar.style.display = 'none';
        return;
      }

      emptyState.style.display = 'none';
      const indexStart = (currentPage - 1) * currentPageSize;

      productsTableBody.innerHTML = products.map((p, i) => {
        const active = isProductActive(p);
        const activeNum = active ? 1 : 0;
        const hasImg = Number(p.has_image) === 1 || p.has_image === true;
        const thumb = hasImg && p.imageDataUrl
          ? `<img class="product-thumb product-list-thumb" src="${escAttr(p.imageDataUrl)}" alt="" loading="lazy" />`
          : `<div class="product-thumb-placeholder">${I18N.t('products-thumb-empty')}</div>`;
        const linesCount = Number(p.price_line_count) || 0;
        const dragTitle = escHtml(I18N.t('products-drag-handle-title'));
        return `
        <tr class="${active ? '' : 'row-inactive'}" data-row-id="${p.id}">
          <td class="col-reorder">
            <span class="drag-handle" draggable="true" title="${dragTitle}">⋮⋮</span>
          </td>
          <td class="index-cell">${indexStart + i + 1}</td>
          <td class="col-order-num">${p.sort_order != null && p.sort_order !== '' ? escHtml(String(p.sort_order)) : '—'}</td>
          <td class="col-thumb">${thumb}</td>
          <td>${escHtml(p.name_ar || '—')}</td>
          <td dir="ltr" style="text-align:right">${escHtml(p.name_en || '—')}</td>
          <td class="count-cell" dir="ltr">${formatWesternInteger(linesCount)}</td>
          <td>
            <span class="badge-status ${active ? 'badge-active' : 'badge-inactive'}">
              <span class="status-dot"></span>
              ${active ? I18N.t('products-status-active') : I18N.t('products-status-inactive')}
            </span>
          </td>
          <td class="col-date" dir="ltr">${escHtml(formatProductDate(p.created_at))}</td>
          <td>
            <div class="actions-cell">
              <button type="button" class="action-btn btn-edit" title="${I18N.t('products-btn-edit-title')}" data-action="edit" data-id="${p.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button type="button" class="action-btn ${active ? 'btn-deactivate' : 'btn-activate'}"
                title="${active ? I18N.t('products-btn-stop-title') : I18N.t('products-btn-resume-title')}"
                data-action="toggle" data-id="${p.id}" data-active="${activeNum}">
                ${active
                  ? `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <rect x="6" y="6" width="12" height="12" rx="1"/>
                     </svg>`
                  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="8 5 19 12 8 19 8 5"/>
                     </svg>`
                }
              </button>
              <button type="button" class="action-btn btn-delete" title="${I18N.t('products-btn-delete-title')}" data-action="delete" data-id="${p.id}">
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

      productsTableBody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const row = currentProducts.find((x) => x.id == btn.dataset.id);
          if (row) openModal(row);
        });
      });
      productsTableBody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const row = currentProducts.find((x) => x.id == btn.dataset.id);
          deleteProduct(Number(btn.dataset.id), row ? (row.name_ar || '') : '');
        });
      });
      productsTableBody.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          toggleProductStatus(Number(btn.dataset.id), Number(btn.dataset.active));
        });
      });
      bindProductsRowDnD();
    }

    async function toggleProductStatus(id, currentActive) {
      const newActive = currentActive ? 0 : 1;
      try {
        const result = await window.api.toggleProductStatus({ id, isActive: newActive });
        if (result.success) {
          showToast(newActive ? I18N.t('products-success-resume') : I18N.t('products-success-stop'), 'success');
          await loadProducts();
        } else {
          showToast(result.message || I18N.t('products-err-generic'), 'error');
        }
      } catch (err) {
        showToast(I18N.t('products-err-db'), 'error');
      }
    }

    function renderPagination() {
      if (totalRecords === 0) {
        paginationBar.style.display = 'none';
        return;
      }
      paginationBar.style.display = 'flex';
      const start = (currentPage - 1) * currentPageSize + 1;
      const end = Math.min(currentPage * currentPageSize, totalRecords);
      paginationInfo.textContent = I18N.t('products-pagination-info')
        .replace('{start}', formatWesternInteger(start))
        .replace('{end}', formatWesternInteger(end))
        .replace('{total}', formatWesternInteger(totalRecords));

      btnFirstPage.disabled = currentPage === 1;
      btnPrevPage.disabled = currentPage === 1;
      btnNextPage.disabled = currentPage === totalPages;
      btnLastPage.disabled = currentPage === totalPages;

      const range = getPageRange(currentPage, totalPages);
      pageNumbers.innerHTML = range.map((p) =>
        p === '...'
          ? '<span class="page-ellipsis">…</span>'
          : `<button type="button" class="page-num ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
      ).join('');

      pageNumbers.querySelectorAll('[data-page]').forEach((btn) => {
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
      loadProducts();
    }

    async function openModal(product) {
      await loadLookupData();
      hideModalError();
      editProductId.value = product ? product.id : '';
      inputNameAr.value = product ? (product.name_ar || '') : '';
      inputNameEn.value = product ? (product.name_en || '') : '';
      inputIsActive.checked = product ? isProductActive(product) : true;

      initialImageDataUrl = null;
      initialHadImage = false;
      stagedImage = null;
      imageRemoved = false;

      clearPriceLines();
      modalTitle.textContent = product
        ? I18N.t('products-modal-edit-title')
        : I18N.t('products-modal-add-title');

      if (product) {
        try {
          const res = await window.api.getProduct({ id: product.id });
          if (res.success) {
            if (res.imageDataUrl) {
              initialImageDataUrl = res.imageDataUrl;
              initialHadImage = true;
            }
            if (res.priceLines) {
              res.priceLines.forEach((line) => {
                addPriceLineRow({
                  laundryServiceId: line.laundry_service_id,
                  price: line.price
                });
              });
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (!priceLinesBody.querySelector('tr')) addPriceLineRow();

      updateImagePreview();
      modalOverlay.style.display = 'flex';
      setTimeout(() => inputNameAr.focus(), 100);
    }

    function closeModal() {
      modalOverlay.style.display = 'none';
      hideModalError();
    }

    async function autoTranslate() {
      const text = inputNameAr.value.trim();
      if (!text) {
        showModalError(I18N.t('products-err-name-ar'));
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

    function collectPriceLinesFromDom() {
      const lines = [];
      const seen = new Set();
      priceLinesBody.querySelectorAll('tr[data-line-uid]').forEach((tr) => {
        const laundryServiceId = tr.querySelector('.js-service')?.value;
        const priceRaw = tr.querySelector('.js-price')?.value;
        const price = parseFloat(normalizeWesternDecimalString(priceRaw));
        if (!laundryServiceId) return;
        if (!(price > 0)) return;
        const key = String(laundryServiceId);
        if (seen.has(key)) return;
        seen.add(key);
        lines.push({
          laundryServiceId: Number(laundryServiceId),
          price
        });
      });
      return lines;
    }

    async function saveProduct() {
      const nameAr = inputNameAr.value.trim();
      const nameEn = inputNameEn.value.trim();
      if (!nameAr) {
        showModalError(I18N.t('products-err-name-ar'));
        return;
      }

      const priceLines = collectPriceLinesFromDom();
      if (priceLines.length === 0) {
        showModalError(I18N.t('products-err-lines'));
        return;
      }

      const keys = new Set();
      for (const line of priceLines) {
        const k = String(line.laundryServiceId);
        if (keys.has(k)) {
          showModalError(I18N.t('products-err-duplicate-line'));
          return;
        }
        keys.add(k);
      }

      const id = editProductId.value;
      const payload = {
        nameAr,
        nameEn: nameEn || null,
        isActive: inputIsActive.checked,
        priceLines
      };
      if (id) payload.id = Number(id);

      if (imageRemoved && initialHadImage) {
        payload.removeImage = true;
      } else if (stagedImage) {
        payload.imageBase64 = stagedImage.base64;
        payload.imageMime = stagedImage.mime;
      }

      btnModalSave.disabled = true;
      hideModalError();

      try {
        const result = await window.api.saveProduct(payload);
        if (result.success) {
          closeModal();
          showToast(id ? I18N.t('products-success-update') : I18N.t('products-success-add'), 'success');
          await loadProducts();
        } else {
          showModalError(result.message || I18N.t('products-err-generic'));
        }
      } catch (err) {
        showModalError(I18N.t('products-err-db'));
      }
      btnModalSave.disabled = false;
    }

    async function deleteProduct(id, nameAr) {
      confirmMsg.textContent = I18N.t('products-confirm-delete').replace('{name}', nameAr);
      confirmOverlay.style.display = 'flex';

      await new Promise((resolve) => {
        function onOk() {
          cleanup();
          confirmOverlay.style.display = 'none';
          resolve(true);
        }
        function onCancel() {
          cleanup();
          confirmOverlay.style.display = 'none';
          resolve(false);
        }
        function cleanup() {
          btnConfirmOk.removeEventListener('click', onOk);
          btnConfirmCancel.removeEventListener('click', onCancel);
        }
        btnConfirmOk.addEventListener('click', onOk);
        btnConfirmCancel.addEventListener('click', onCancel);
      }).then(async (confirmed) => {
        if (!confirmed) return;
        try {
          const result = await window.api.deleteProduct({ id });
          if (result.success) {
            showToast(I18N.t('products-success-delete'), 'success');
            if (currentProducts.length === 1 && currentPage > 1) currentPage--;
            await loadProducts();
          } else {
            showToast(result.message || I18N.t('products-err-delete'), 'error');
          }
        } catch (err) {
          showToast(I18N.t('products-err-db'), 'error');
        }
      });
    }

    async function exportProducts(type) {
      buildFilters();
      btnExportExcel.disabled = true;
      btnExportPdf.disabled = true;
      try {
        const result = await window.api.exportProducts({ type, filters: { ...currentFilters } });
        if (result.success) {
          showToast(I18N.t('products-export-success'), 'success');
        } else {
          showToast(result.message || I18N.t('products-err-generic'), 'error');
        }
      } catch (err) {
        showToast(I18N.t('products-err-db'), 'error');
      }
      btnExportExcel.disabled = false;
      btnExportPdf.disabled = false;
    }

    function showToast(msg, type) {
      const isSuccess = type === 'success';
      const toast = document.createElement('div');
      toast.className = `toast ${isSuccess ? 'toast-success' : 'toast-error'}`;
      toast.innerHTML = `
      <div class="toast-icon">
        ${isSuccess
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        }
      </div>
      <span class="toast-text">${escHtml(msg)}</span>
      <button type="button" class="toast-close">✕</button>
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
      modalError.textContent = msg;
      modalError.style.display = '';
    }

    function hideModalError() {
      modalError.style.display = 'none';
      modalError.textContent = '';
    }

    function escHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function escAttr(str) {
      return escHtml(str).replace(/'/g, '&#39;');
    }

    loadProducts();
  } catch (error) {
    console.error('Fatal error in products.js:', error);
    document.body.innerHTML = `<div style="color:red;padding:40px;text-align:center;">
      <h2>Error</h2>
      <p>${error.message}</p>
    </div>`;
  }
});
