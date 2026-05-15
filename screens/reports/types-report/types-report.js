window.addEventListener('DOMContentLoaded', async () => {
  const btnBack        = document.getElementById('btnBack');
  const btnExcelExport = document.getElementById('btnExcelExport');
  const btnPdfExport   = document.getElementById('btnPdfExport');
  const btnApply       = document.getElementById('btnApplyFilter');
  const filterDateFrom = document.getElementById('filterDateFrom');
  const filterDateTo   = document.getElementById('filterDateTo');
  const filterProduct  = document.getElementById('filterProduct');
  const filterService  = document.getElementById('filterService');
  const emptyPrompt    = document.getElementById('emptyPrompt');
  const loadingState   = document.getElementById('loadingState');
  const reportContent  = document.getElementById('reportContent');
  const periodInfoBar  = document.getElementById('periodInfoBar');
  const typesTableBody = document.getElementById('typesTableBody');
  const rowCountBadge  = document.getElementById('rowCountBadge');
  const totalQtyEl     = document.getElementById('totalQty');
  const totalGrossEl   = document.getElementById('totalGross');

  const T = (key) => (typeof I18N !== 'undefined' ? I18N.t(key) : key);

  const today = new Date();
  const pad = x => String(x).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  filterDateFrom.value = `${todayStr}T00:00`;
  filterDateTo.value   = `${todayStr}T23:59`;

  document.querySelectorAll('input[type="datetime-local"]').forEach(input => {
    input.addEventListener('mousedown', function(e) {
      if (typeof this.showPicker === 'function') {
        e.preventDefault();
        this.showPicker();
      }
    });
  });

  try {
    const resProducts = await window.api.getProducts({});
    if (resProducts.success && Array.isArray(resProducts.products)) {
      resProducts.products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name_ar || p.name_en || `#${p.id}`;
        filterProduct.appendChild(opt);
      });
    }
  } catch(e) { console.warn('getProducts failed', e); }

  try {
    const resServices = await window.api.getLaundryServices({});
    if (resServices.success && Array.isArray(resServices.services)) {
      resServices.services.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name_ar || s.name_en || `#${s.id}`;
        filterService.appendChild(opt);
      });
    }
  } catch(e) { console.warn('getLaundryServices failed', e); }

  const fmtNum  = n => Number(n || 0).toLocaleString('en-US');
  const fmtMoney = n => `<span class="sar">&#xE900;</span> ${Number(n || 0).toFixed(2)}`;

  function formatDateLabel(dtStr) {
    if (!dtStr) return '';
    try {
      const d = new Date(dtStr.replace('T', ' '));
      return d.toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch(_) { return dtStr; }
  }

  function showState(state) {
    emptyPrompt.style.display   = state === 'empty'   ? ''     : 'none';
    loadingState.style.display  = state === 'loading' ? ''     : 'none';
    reportContent.style.display = state === 'report'  ? ''     : 'none';
  }

  function renderTable(rows, totals) {
    rowCountBadge.textContent = rows.length;
    if (!rows.length) {
      typesTableBody.innerHTML = `
        <tr class="no-data-row">
          <td colspan="5">${T('types-report-no-data')}</td>
        </tr>`;
    } else {
      typesTableBody.innerHTML = rows.map((r, i) => {
        const isZero = Number(r.total_qty || 0) === 0;
        return `
          <tr class="${isZero ? 'row-zero' : ''}">
            <td class="td-seq">${i + 1}</td>
            <td class="td-product">${escHtml(r.product_name_ar || r.product_name_en || '—')}</td>
            <td class="td-service">${escHtml(r.service_name_ar || r.service_name_en || '—')}</td>
            <td class="td-num">${fmtNum(r.total_qty)}</td>
            <td class="td-money">${fmtMoney(r.total_gross)}</td>
          </tr>`;
      }).join('');
    }
    totalQtyEl.textContent   = fmtNum(totals.total_qty);
    totalGrossEl.innerHTML   = fmtMoney(totals.total_gross);
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadReport() {
    const dateFrom  = filterDateFrom.value;
    const dateTo    = filterDateTo.value;
    const productId = filterProduct.value  ? Number(filterProduct.value)  : null;
    const serviceId = filterService.value  ? Number(filterService.value)  : null;

    if (!dateFrom || !dateTo) {
      alert(T('types-report-err-period'));
      return;
    }

    showState('loading');
    try {
      const res = await window.api.getTypesReport({ dateFrom, dateTo, productId, serviceId });
      if (!res.success) {
        alert(res.message || T('types-report-err-fetch'));
        showState('empty');
        return;
      }

      const periodFrom = T('types-report-period-from');
      const periodTo = T('types-report-period-to');
      let infoText = `${periodFrom} ${formatDateLabel(dateFrom)} ${periodTo} ${formatDateLabel(dateTo)}`;
      const filterProductLabel = T('types-report-filter-product');
      const filterServiceLabel = T('types-report-filter-service');
      const selProd = filterProduct.options[filterProduct.selectedIndex];
      const selSvc  = filterService.options[filterService.selectedIndex];
      if (filterProduct.value) infoText += ` | ${filterProductLabel} ${selProd.textContent}`;
      if (filterService.value) infoText += ` | ${filterServiceLabel} ${selSvc.textContent}`;
      periodInfoBar.textContent = infoText;

      renderTable(res.rows, res.totals);
      showState('report');
    } catch(err) {
      console.error('loadReport error', err);
      alert(T('types-report-err-server'));
      showState('empty');
    }
  }

  async function exportExcel() {
    const dateFrom  = filterDateFrom.value;
    const dateTo    = filterDateTo.value;
    const productId = filterProduct.value ? Number(filterProduct.value) : null;
    const serviceId = filterService.value ? Number(filterService.value) : null;

    if (!dateFrom || !dateTo) {
      alert(T('types-report-export-first'));
      return;
    }

    try {
      const res = await window.api.getTypesReport({ dateFrom, dateTo, productId, serviceId });
      if (!res.success || !res.rows) return;

      const headers = ['#', T('types-report-col-product'), T('types-report-col-service'), T('types-report-col-qty'), T('types-report-col-gross')];
      const csvRows = [
        headers.join(','),
        ...res.rows.map((r, i) => [
          i + 1,
          `"${(r.product_name_ar || r.product_name_en || '').replace(/"/g,'""')}"`,
          `"${(r.service_name_ar  || r.service_name_en  || '').replace(/"/g,'""')}"`,
          r.total_qty,
          Number(r.total_gross).toFixed(2)
        ].join(',')),
        ['', '', T('types-report-total-row'),
          res.totals.total_qty,
          Number(res.totals.total_gross).toFixed(2)
        ].join(',')
      ];

      const bom = '\uFEFF';
      const csvContent = bom + csvRows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const fromLabel = dateFrom.slice(0,10);
      const toLabel   = dateTo.slice(0,10);
      a.href     = url;
      a.download = `تقرير-الأنواع-${fromLabel}-${toLabel}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) {
      console.error('exportExcel error', err);
      alert(T('types-report-err-export'));
    }
  }

  btnBack.addEventListener('click', () => {
    location.href = '/screens/reports/reports.html';
  });

  btnExcelExport.addEventListener('click', exportExcel);
  btnPdfExport.addEventListener('click', async () => {
    const dateFrom  = filterDateFrom.value;
    const dateTo    = filterDateTo.value;
    const productId = filterProduct.value ? Number(filterProduct.value) : null;
    const serviceId = filterService.value ? Number(filterService.value) : null;

    if (!dateFrom || !dateTo) {
      alert(T('types-report-export-first'));
      return;
    }

    btnPdfExport.disabled = true;
    try {
      const r = await window.api.exportTypesReport({ type: 'pdf', filters: { dateFrom, dateTo, productId, serviceId } });
      if (!r.success) alert(r.message || T('types-report-err-export'));
    } catch(err) {
      console.error('exportPDF error', err);
      alert(T('types-report-err-export'));
    }
    btnPdfExport.disabled = false;
  });
  btnApply.addEventListener('click', loadReport);

  document.querySelectorAll('.filter-field input, .filter-field select').forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') loadReport();
    });
  });

  if (typeof I18N !== 'undefined') I18N.apply();
});
