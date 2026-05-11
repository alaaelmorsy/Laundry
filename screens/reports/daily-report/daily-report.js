window.addEventListener('DOMContentLoaded', async () => {
  const btnBack        = document.getElementById('btnBack');
  const btnPrint       = document.getElementById('btnPrint');
  const btnExcelExport = document.getElementById('btnExcelExport');
  const btnPdfExport   = document.getElementById('btnPdfExport');
  const loadingState   = document.getElementById('loadingState');
  const reportContent  = document.getElementById('reportContent');
  const periodBadge    = document.getElementById('periodBadge');

  if (window.I18N && typeof window.I18N.enableArabicPrint === 'function') {
    window.I18N.enableArabicPrint();
  }

  btnBack.addEventListener('click', () => {
    location.href = '/screens/reports/reports.html';
  });

  const today = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const todayDisplay = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
  const nowH = pad(today.getHours() % 12 || 12), nowM = pad(today.getMinutes());
  const nowAMPM = today.getHours() < 12 ? 'am' : 'pm';
  const nowTime = `${nowH}:${nowM} ${nowAMPM}`;

  const filters = { dateFrom: todayStr, dateTo: todayStr };

  periodBadge.textContent = `${I18N.t('period-report-period')}: ${todayDisplay} — ${todayDisplay} | ${nowTime}`;

  let reportData = null;
  let _reportAppSettings = null;

  function fmtLtr(n) { return Number(n || 0).toFixed(2); }
  function sarHtml(amountStr) { return `<span class="sar">&#xE900;</span> ${amountStr}`; }
  function sarFmtA(n) { return sarHtml(fmtLtr(n)); }
  function escHtml(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function formatInvoiceDate(dateStr) {
    if (!dateStr) {
      const now = new Date();
      return now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const date = d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return date + ' ' + time;
    } catch (_) { return dateStr; }
  }
  function paymentLabel(method) {
    const map = { cash: I18N.t('payment-cash'), card: I18N.t('payment-card'), credit: I18N.t('payment-credit'), mixed: I18N.t('payment-mixed'), bank: I18N.t('payment-bank'), subscription: I18N.t('payment-subscription') };
    return map[method] || method || '—';
  }
  function isoTimestamp(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
    return safeDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  function applyInvoiceTypeClass() {
    const type = (_reportAppSettings && _reportAppSettings.invoicePaperType) || 'thermal';
    document.body.classList.toggle('invtype-a4', type === 'a4');
  }
  function fillA4InvoiceModal(data) {
    function a4mText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val || ''; }
    function a4mHtml(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val || ''; }
    function a4mShow(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; }
    const sarSpan = '<span style="font-family:SaudiRiyal;">\uE900</span>';
    const sarFmt = n => sarSpan + Number(n || 0).toFixed(2);

    a4mText('a4mShopNameAr',    data.shopNameAr);
    a4mText('a4mShopAddressAr', data.shopAddressAr);
    a4mText('a4mShopPhoneAr',   data.shopPhone ? I18N.t('all-invoices-phone') + ': ' + data.shopPhone : '');
    a4mText('a4mVatAr',         data.vatNumber ? I18N.t('all-invoices-vat') + ': ' + data.vatNumber : '');
    a4mText('a4mCrAr',          data.commercialRegister ? I18N.t('all-invoices-cr') + ': ' + data.commercialRegister : '');
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
    a4mText('a4mPayment',  data.payment);
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

        const nameCell = escHtml(it.productAr || '') + (it.productEn && it.productEn !== it.productAr ? `<span class="a4m-td-en">${escHtml(it.productEn)}</span>` : '');
        const svcCell  = escHtml(it.serviceAr || '—') + (it.serviceEn && it.serviceEn !== it.serviceAr ? `<span class="a4m-td-en">${escHtml(it.serviceEn)}</span>` : '');

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
        var a4mDiscLabel = document.querySelector('#a4mDiscRow span');
        if (a4mDiscLabel) a4mDiscLabel.textContent = data.discountLabel + ' / Discount';
      }
      var afterDiscInv = Number(data.subtotal || 0) - Number(data.discount || 0);
      a4mHtml('a4mAfterDiscount', sarFmt(afterDiscInv));
      a4mShow('a4mAfterDiscRow', true);
    } else { a4mShow('a4mDiscRow', false); a4mShow('a4mAfterDiscRow', false); }
    if (data.extra && data.extra > 0) {
      a4mHtml('a4mExtra', sarFmt(data.extra));
      a4mShow('a4mExtraRow', true);
    } else { a4mShow('a4mExtraRow', false); }
    if (vatRate > 0) {
      a4mText('a4mVatLabel', `${I18N.t('invoice-vat-label')} (${vatRate}%)`);
      a4mHtml('a4mVat', sarFmt(data.vatAmount));
      a4mShow('a4mVatRow', true);
      a4mText('a4mSubtotalLabel', I18N.t('invoice-subtotal-before-tax'));
      a4mText('a4mTotalLabel', I18N.t('invoice-grand-total-tax'));
    } else {
      a4mShow('a4mVatRow', false);
      a4mText('a4mSubtotalLabel', I18N.t('invoice-subtotal'));
      a4mText('a4mTotalLabel', I18N.t('invoice-total'));
    }
    a4mHtml('a4mTotal', sarFmt(data.total));

    const paidCash = Number(data.paidCash || 0);
    const paidCard = Number(data.paidCard || 0);
    if (paidCash > 0 || paidCard > 0) {
      a4mHtml('a4mMixedCash', sarFmt(paidCash));
      a4mShow('a4mMixedCashRow', true);
      a4mHtml('a4mMixedCard', sarFmt(paidCard));
      a4mShow('a4mMixedCardRow', true);
    } else {
      a4mShow('a4mMixedCashRow', false);
      a4mShow('a4mMixedCardRow', false);
    }

    const a4mNotesEl = document.getElementById('a4mFooterNotes');
    if (a4mNotesEl) {
      if (data.invoiceNotes) {
        const a4mNotesContent = document.getElementById('a4mNotesContent');
        if (a4mNotesContent) a4mNotesContent.textContent = data.invoiceNotes;
        a4mNotesEl.style.display = '';
      } else {
        a4mNotesEl.style.display = 'none';
      }
    }

    a4mShow('a4mRowStarch', !!data.starch);
    if (data.starch) a4mText('a4mStarch', data.starch);
    a4mShow('a4mRowBluing', !!data.bluing);
    if (data.bluing) a4mText('a4mBluing', data.bluing);

    if (data.qrPayload) {
      const qrEl = document.getElementById('a4mQR');
      if (qrEl) {
        qrEl.innerHTML = '';
        window.api.generateZatcaQR(data.qrPayload)
          .then(res => { if (res && res.success && res.svg) qrEl.innerHTML = res.svg; })
          .catch(() => {});
      }
    }
  }

  function fmt(n) { return Number(n || 0).toFixed(2); }
  function fmtDT(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      const dPad = (x) => String(x).padStart(2, '0');
      const dy = dPad(d.getDate()), mo = dPad(d.getMonth() + 1), yr = d.getFullYear();
      const h = d.getHours() % 12 || 12, mi = dPad(d.getMinutes());
      const ampm = d.getHours() < 12 ? 'am' : 'pm';
      return `${dy}/${mo}/${yr}, ${dPad(h)}:${mi} ${ampm}`;
    } catch { return String(dateStr); }
  }
  function payLabel(pm) {
    if (pm === 'card') return I18N.t('payment-card');
    if (pm === 'transfer') return I18N.t('payment-bank');
    if (pm === 'subscription') return I18N.t('payment-subscription');
    if (pm === 'mixed') return I18N.t('payment-mixed');
    return I18N.t('payment-cash');
  }
  function SAR(n, showSymbol = true) { return `${fmt(n)}${showSymbol ? ' <span class="sar">&#xE900;</span>' : ''}`; }

  function showToast(msg, type = 'success') {
    const tc = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<div class="toast-text">${msg}</div>`;
    tc.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 350); }, 3000);
  }

  function buildSummaryTable(summary) {
    const rows = [
      { label: I18N.t('summary-sales'),            d: summary.sales,          cls: '' },
      { label: I18N.t('summary-discounts'),             d: summary.discounts,       cls: '' },
      { label: I18N.t('summary-sales-after-disc'),   d: summary.salesAfterDisc, cls: '' },
      { label: I18N.t('summary-credit-notes-short'), d: summary.creditNotes, cls: '' },
      { label: I18N.t('summary-total-net'), d: summary.totalNet, cls: 'row-total' },
      { label: I18N.t('summary-subscriptions'),      d: summary.subscriptions,   cls: '' },
      { label: I18N.t('summary-expenses'),            d: summary.expenses,        cls: '' },
      { label: I18N.t('summary-net-short'),              d: summary.net,             cls: 'row-net' },
    ];
    return rows.map(({ label, d, cls }) => `
      <tr class="${cls}">
        <td>${label}</td>
        <td class="num-cell">${fmt(d.beforeTax)}</td>
        <td class="tax-cell">${fmt(d.tax)}</td>
        <td class="num-cell">${fmt(d.afterTax)}</td>
      </tr>`).join('');
  }

  const PAY_META = {
    cash:         { label: I18N.t('payment-cash'),      icon: '💵', cls: 'pay-cash' },
    card:         { label: I18N.t('payment-card'),      icon: '💳', cls: 'pay-card' },
    bank:         { label: I18N.t('payment-bank'),      icon: '🏦', cls: 'pay-bank' },
    transfer:     { label: I18N.t('payment-bank'),     icon: '🏦', cls: 'pay-transfer' },
    subscription: { label: I18N.t('payment-subscription'),    icon: '🔄', cls: 'pay-subscription' },
    mixed:        { label: I18N.t('payment-mixed'),     icon: '🔀', cls: 'pay-mixed' },
    credit:       { label: I18N.t('payment-credit'),     icon: '📋', cls: 'pay-credit' },
  };

  function buildPaymentMethods(methods) {
    const el = document.getElementById('payMethodsGrid');
    if (!methods || !methods.length) {
      el.innerHTML = `<div class="pay-empty">${I18N.t('daily-report-no-sales')}</div>`;
      return;
    }
    el.innerHTML = methods.map((m) => {
      const meta = PAY_META[m.method] || { label: m.method, icon: '💰', cls: 'pay-cash' };
      return `
        <div class="pay-card-item ${meta.cls}">
          <div class="pay-card-icon">${meta.icon}</div>
          <div class="pay-card-info">
            <div class="pay-card-label">${meta.label}</div>
            <div class="pay-card-count">${m.count} ${I18N.t('all-invoices-item')}</div>
          </div>
          <div class="pay-card-amounts">
            <div class="pay-card-main">${SAR(m.totalAfterTax)}</div>
          </div>
          ${m.method === 'subscription' ? '<div class="pay-card-note">(لا يدخل في الحساب)</div>' : ''}
        </div>`;
    }).join('');
  }

  function buildExpensesTable(expenses) {
    if (!expenses.length) return `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">${I18N.t('daily-report-no-expenses')}</td></tr>`;
    return expenses.map((e) => {
      const dt = fmtDT(e.created_at);
      const dtParts = dt.split(', ');
      const dateStr = dtParts[0] || dt;
      const timeStr = dtParts[1] || '';
      return `
      <tr>
        <td>${e.title || '—'}</td>
        <td>${dateStr}${timeStr ? '<br>' + timeStr : ''}</td>
        <td class="num-cell">${SAR(e.total_amount, false)}</td>
        <td>${e.notes || '—'}</td>
      </tr>`;
    }).join('');
  }

  function buildInvoicesTable(invoices) {
    if (!invoices.length) return `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">${I18N.t('daily-report-no-invoices')}</td></tr>`;
    return invoices.map((inv) => {
      const dt = fmtDT(inv.created_at);
      const dtParts = dt.split(', ');
      const dateStr = dtParts[0] || dt;
      const timeStr = dtParts[1] || '';
      return `
      <tr>
        <td class="num-cell">${inv.invoice_seq || inv.order_number || inv.id}</td>
        <td>${inv.phone || inv.customer_name || '—'}</td>
        <td>${dateStr}${timeStr ? '<br>' + timeStr : ''}</td>
        <td>${payLabel(inv.payment_method)}</td>
        <td class="num-cell">${SAR(inv.total_amount, false)}</td>
        <td class="no-print"><button class="view-btn" onclick="showInvoiceModal(${inv.id})">${I18N.t('all-invoices-view')}</button></td>
      </tr>`;
    }).join('');
  }

  function payBadge(pm) {
    const map = { cash: [I18N.t('payment-cash'),''], card: [I18N.t('payment-card'),'card'], transfer: [I18N.t('payment-bank'),'transfer'], subscription: [I18N.t('payment-subscription'),'subscription'], mixed: [I18N.t('payment-mixed'),'mixed'], credit: [I18N.t('payment-credit'),'credit'] };
    const [label, cls] = map[pm] || [I18N.t('payment-cash'), ''];
    return `<span class="inv-pay-badge ${cls}">${label}</span>`;
  }

  function renderInvoiceModal(order, items, subscription) {
    const s = _reportAppSettings || {};
    const displaySeq = order.invoice_seq || order.order_number || order.id;

    const invShopName = document.getElementById('invShopName');
    const invShopAddress = document.getElementById('invShopAddress');
    const invShopPhone = document.getElementById('invShopPhone');
    const invShopEmail = document.getElementById('invShopEmail');
    const invVatNumber = document.getElementById('invVatNumber');
    const invCRRow = document.getElementById('invCRRow');
    const invCR = document.getElementById('invCR');
    const invLogoWrap = document.getElementById('invLogoWrap');
    const invLogo = document.getElementById('invLogo');
    const invOrderNum = document.getElementById('invOrderNum');
    const invDate = document.getElementById('invDate');
    const invPayment = document.getElementById('invPayment');
    const invPaidAtRow = document.getElementById('invPaidAtRow');
    const invPaidAt = document.getElementById('invPaidAt');
    const invCleanedAtRow = document.getElementById('invCleanedAtRow');
    const invCleanedAt = document.getElementById('invCleanedAt');
    const invDeliveredAtRow = document.getElementById('invDeliveredAtRow');
    const invDeliveredAt = document.getElementById('invDeliveredAt');
    const invCreatedByRow = document.getElementById('invCreatedByRow');
    const invCreatedBy = document.getElementById('invCreatedBy');
    const invCustomerSection = document.getElementById('invCustomerSection');
    const invCustNameRow = document.getElementById('invCustNameRow');
    const invCustName = document.getElementById('invCustName');
    const invCustPhoneRow = document.getElementById('invCustPhoneRow');
    const invCustPhone = document.getElementById('invCustPhone');
    const invSubBalRow = document.getElementById('invSubBalRow');
    const invSubBalance = document.getElementById('invSubBalance');
    const invItemsTbody = document.getElementById('invItemsTbody');
    const invSubtotalLabel = document.getElementById('invSubtotalLabel');
    const invSubtotal = document.getElementById('invSubtotal');
    const invDiscRow = document.getElementById('invDiscRow');
    const invDiscount = document.getElementById('invDiscount');
    const invAfterDiscRow = document.getElementById('invAfterDiscRow');
    const invAfterDiscount = document.getElementById('invAfterDiscount');
    const invExtraRow = document.getElementById('invExtraRow');
    const invExtra = document.getElementById('invExtra');
    const invVatRow = document.getElementById('invVatRow');
    const invVatLabel = document.getElementById('invVatLabel');
    const invVat = document.getElementById('invVat');
    const invTotalLabel = document.getElementById('invTotalLabel');
    const invTotal = document.getElementById('invTotal');
    const invMixedCashRow = document.getElementById('invMixedCashRow');
    const invMixedCardRow = document.getElementById('invMixedCardRow');
    const invMixedCash = document.getElementById('invMixedCash');
    const invMixedCard = document.getElementById('invMixedCard');
    const invPaidRow = document.getElementById('invPaidRow');
    const invRemainingRow = document.getElementById('invRemainingRow');
    const invPaidAmount = document.getElementById('invPaidAmount');
    const invRemainingAmount = document.getElementById('invRemainingAmount');
    const invQR = document.getElementById('invQR');

    const shopName = s.laundryNameAr || s.laundryNameEn || '';
    if (invShopName) invShopName.textContent = shopName;

    const addressParts = [];
    if (s.buildingNumber) addressParts.push(s.buildingNumber);
    if (s.streetNameAr)   addressParts.push(s.streetNameAr);
    if (s.districtAr)     addressParts.push(s.districtAr);
    if (s.cityAr)         addressParts.push(s.cityAr);
    if (s.postalCode)     addressParts.push(s.postalCode);
    if (invShopAddress) invShopAddress.textContent = addressParts.length ? addressParts.join('، ') : (s.locationAr || '');
    if (invShopPhone) invShopPhone.textContent = s.phone ? I18N.t('all-invoices-phone') + ': ' + s.phone : '';
    if (invShopEmail) invShopEmail.textContent = s.email || '';
    if (invVatNumber) invVatNumber.textContent = s.vatNumber ? I18N.t('all-invoices-vat') + ': ' + s.vatNumber : '';

    if (s.commercialRegister && invCRRow && invCR) {
      invCR.textContent = s.commercialRegister;
      invCRRow.style.display = '';
    } else if (invCRRow) {
      invCRRow.style.display = 'none';
    }

    if (s.logoDataUrl && invLogoWrap && invLogo) {
      invLogo.src = s.logoDataUrl;
      invLogoWrap.style.display = '';
    } else if (invLogoWrap) {
      invLogoWrap.style.display = 'none';
    }

    if (invOrderNum) invOrderNum.textContent = displaySeq ? String(displaySeq) : (order.order_number || '—');
    if (invDate) invDate.textContent = formatInvoiceDate(order.created_at);
    if (invPayment) invPayment.textContent = paymentLabel(order.payment_method);

    if (order.paid_at && invPaidAtRow && invPaidAt) {
      invPaidAt.textContent = formatInvoiceDate(order.paid_at);
      invPaidAtRow.style.display = '';
    } else if (invPaidAtRow) {
      invPaidAtRow.style.display = 'none';
    }
    if (order.cleaning_date && invCleanedAtRow && invCleanedAt) {
      invCleanedAt.textContent = formatInvoiceDate(order.cleaning_date);
      invCleanedAtRow.style.display = '';
    } else if (invCleanedAtRow) {
      invCleanedAtRow.style.display = 'none';
    }
    if (order.delivery_date && invDeliveredAtRow && invDeliveredAt) {
      invDeliveredAt.textContent = formatInvoiceDate(order.delivery_date);
      invDeliveredAtRow.style.display = '';
    } else if (invDeliveredAtRow) {
      invDeliveredAtRow.style.display = 'none';
    }
    if (order.created_by && invCreatedByRow && invCreatedBy) {
      invCreatedBy.textContent = order.created_by;
      invCreatedByRow.style.display = '';
    } else if (invCreatedByRow) {
      invCreatedByRow.style.display = 'none';
    }

    if (order.customer_name || order.phone) {
      if (invCustomerSection) invCustomerSection.style.display = '';
      if (order.customer_name && invCustNameRow && invCustName) {
        invCustName.textContent = order.customer_name;
        invCustNameRow.style.display = '';
      } else if (invCustNameRow) {
        invCustNameRow.style.display = 'none';
      }
      if (order.phone && invCustPhoneRow && invCustPhone) {
        invCustPhone.textContent = order.phone;
        invCustPhoneRow.style.display = '';
      } else if (invCustPhoneRow) {
        invCustPhoneRow.style.display = 'none';
      }
    } else {
      if (invCustomerSection) invCustomerSection.style.display = 'none';
    }

    if (subscription && subscription.package_name && invSubBalRow && invSubBalance) {
      const bal = parseFloat(subscription.credit_remaining);
      if (!isNaN(bal)) {
        invSubBalance.innerHTML = '<span class="sar">&#xE900;</span> ' + fmtLtr(bal);
        invSubBalRow.style.display = '';
        if (invCustomerSection) invCustomerSection.style.display = '';
      } else {
        invSubBalRow.style.display = 'none';
      }
    } else if (invSubBalRow) {
      invSubBalRow.style.display = 'none';
    }

    const sarSpan = '<span class="sar">&#xE900;</span>';
    if (invItemsTbody) {
      invItemsTbody.innerHTML = (items || []).map(item => {
        const nameAr = escHtml(item.product_name_ar || '');
        const nameEn = escHtml(item.product_name_en || '');
        const svcAr  = escHtml(item.service_name_ar || '');
        const svcEn  = escHtml(item.service_name_en || '');

        const productCell = nameAr + (nameEn && nameEn !== nameAr ? `<span class="inv-td-en">${nameEn}</span>` : '');
        const serviceCell = svcAr + (svcEn && svcEn !== svcAr ? `<span class="inv-td-en">${svcEn}</span>` : '');

        return `<tr>
          <td class="inv-td-name">${productCell}</td>
          <td class="inv-td-num">${item.quantity}</td>
          <td class="inv-td-amt">${fmtLtr(item.line_total)}</td>
          <td class="inv-td-name">${serviceCell || '—'}</td>
        </tr>`;
      }).join('');
    }

    const subtotal  = parseFloat(order.subtotal || 0);
    const discount  = parseFloat(order.discount_amount || 0);
    const extra     = parseFloat(order.extra_amount || 0);
    const vatRate   = parseFloat(order.vat_rate || 0);
    const vatAmount = parseFloat(order.vat_amount || 0);
    const total     = parseFloat(order.total_amount || 0);
    const isInclusive = order.price_display_mode === 'inclusive';
    const discountLabel = order.discount_label || I18N.t('discount-label');

    if (isInclusive && vatRate > 0) {
      if (invSubtotal) invSubtotal.innerHTML = sarFmtA(subtotal * 100 / (100 + vatRate));
      if (discount > 0) {
        if (invDiscount) invDiscount.innerHTML = sarFmtA(discount);
        if (invDiscRow) invDiscRow.style.display = '';
        var discLabelEl = invDiscRow ? invDiscRow.querySelector('.inv-total-label') : null;
        if (discLabelEl) discLabelEl.textContent = discountLabel;
        if (invAfterDiscount) invAfterDiscount.innerHTML = sarFmtA((subtotal * 100 / (100 + vatRate)) - discount);
        if (invAfterDiscRow) invAfterDiscRow.style.display = '';
      } else {
        if (invDiscRow) invDiscRow.style.display = 'none';
        if (invAfterDiscRow) invAfterDiscRow.style.display = 'none';
      }
      if (extra > 0) {
        if (invExtra) invExtra.innerHTML = sarFmtA(extra);
        if (invExtraRow) invExtraRow.style.display = '';
      } else {
        if (invExtraRow) invExtraRow.style.display = 'none';
      }
      if (invVatLabel) invVatLabel.textContent = `${I18N.t('invoice-vat-label-short')} (${vatRate}%)`;
      if (invVat) invVat.innerHTML = sarFmtA(vatAmount);
      if (invVatRow) invVatRow.style.display = '';
      if (invSubtotalLabel) invSubtotalLabel.textContent = I18N.t('invoice-subtotal-before-tax');
      if (invTotalLabel) invTotalLabel.textContent = I18N.t('invoice-grand-total-tax');
    } else {
      if (invSubtotal) invSubtotal.innerHTML = sarFmtA(subtotal);
      if (discount > 0) {
        if (invDiscount) invDiscount.innerHTML = sarFmtA(discount);
        if (invDiscRow) invDiscRow.style.display = '';
        var discLabelEl2 = invDiscRow ? invDiscRow.querySelector('.inv-total-label') : null;
        if (discLabelEl2) discLabelEl2.textContent = discountLabel;
        if (invAfterDiscount) invAfterDiscount.innerHTML = sarFmtA(subtotal - discount);
        if (invAfterDiscRow) invAfterDiscRow.style.display = '';
      } else {
        if (invDiscRow) invDiscRow.style.display = 'none';
        if (invAfterDiscRow) invAfterDiscRow.style.display = 'none';
      }
      if (extra > 0) {
        if (invExtra) invExtra.innerHTML = sarFmtA(extra);
        if (invExtraRow) invExtraRow.style.display = '';
      } else {
        if (invExtraRow) invExtraRow.style.display = 'none';
      }
      if (vatRate > 0 && vatAmount > 0) {
        if (invVatLabel) invVatLabel.textContent = `${I18N.t('invoice-vat-label-short')} (${vatRate}%)`;
        if (invVat) invVat.innerHTML = sarFmtA(vatAmount);
        if (invVatRow) invVatRow.style.display = '';
        if (invSubtotalLabel) invSubtotalLabel.textContent = I18N.t('invoice-subtotal-before-tax');
        if (invTotalLabel) invTotalLabel.textContent = I18N.t('invoice-grand-total-tax');
      } else {
        if (invVatRow) invVatRow.style.display = 'none';
        if (invSubtotalLabel) invSubtotalLabel.textContent = I18N.t('invoice-subtotal');
        if (invTotalLabel) invTotalLabel.textContent = I18N.t('invoice-total');
      }
    }

    if (invTotal) invTotal.innerHTML = sarFmtA(total);

    const isMixed = String(order.payment_method || '') === 'mixed';
    const pc = parseFloat(order.paid_cash || 0);
    const pd = parseFloat(order.paid_card || 0);
    if (invMixedCashRow && invMixedCardRow) {
      if (isMixed && (pc > 0 || pd > 0)) {
        if (invMixedCash) invMixedCash.innerHTML = sarFmtA(pc);
        if (invMixedCard) invMixedCard.innerHTML = sarFmtA(pd);
        invMixedCashRow.style.display = '';
        invMixedCardRow.style.display = '';
      } else {
        invMixedCashRow.style.display = 'none';
        invMixedCardRow.style.display = 'none';
      }
    }

    const paidAmount = parseFloat(order.paid_amount || 0);
    const remainingAmount = parseFloat(order.remaining_amount || 0);
    const isDeferred = String(order.payment_method || '') === 'deferred' || remainingAmount > 0;
    if (invPaidRow && invRemainingRow) {
      if (isDeferred) {
        if (invPaidAmount) invPaidAmount.innerHTML = sarFmtA(paidAmount);
        if (invRemainingAmount) invRemainingAmount.innerHTML = sarFmtA(remainingAmount);
        invPaidRow.style.display = '';
        invRemainingRow.style.display = '';
      } else {
        invPaidRow.style.display = 'none';
        invRemainingRow.style.display = 'none';
      }
    }

    const hasStarch = order.starch && String(order.starch).trim();
    const hasBluing = order.bluing && String(order.bluing).trim();
    const invExtraOpts = document.getElementById('invExtraOpts');
    if (invExtraOpts) invExtraOpts.style.display = (hasStarch || hasBluing) ? '' : 'none';
    const invStarchRow = document.getElementById('invStarchRow');
    const invStarch = document.getElementById('invStarch');
    if (invStarchRow && invStarch) {
      if (hasStarch) { invStarch.textContent = order.starch; invStarchRow.style.display = ''; }
      else { invStarchRow.style.display = 'none'; }
    }
    const invBluingRow = document.getElementById('invBluingRow');
    const invBluing = document.getElementById('invBluing');
    if (invBluingRow && invBluing) {
      if (hasBluing) { invBluing.textContent = order.bluing; invBluingRow.style.display = ''; }
      else { invBluingRow.style.display = 'none'; }
    }

    const invFooterNotes = document.getElementById('invFooterNotes');
    if (invFooterNotes) {
      if (s.invoiceNotes) {
        const invNotesContent = document.getElementById('invNotesContent');
        if (invNotesContent) invNotesContent.textContent = s.invoiceNotes;
        invFooterNotes.style.display = '';
      } else {
        invFooterNotes.style.display = 'none';
      }
    }

    if (vatRate > 0 && invQR) {
      invQR.innerHTML = '';
      window.api.generateZatcaQR({ sellerName: shopName, vatNumber: s.vatNumber, timestamp: isoTimestamp(order.created_at), totalAmount: fmtLtr(total), vatAmount: fmtLtr(vatAmount) })
        .then(res => { if (res && res.success && res.svg) invQR.innerHTML = res.svg; })
        .catch(() => {});
    } else if (invQR) {
      invQR.innerHTML = '';
    }

    // Barcode
    var invBarcodeEl = document.getElementById('invBarcode');
    if (invBarcodeEl && order.invoice_seq) {
      try { JsBarcode(invBarcodeEl, String(order.invoice_seq), { format: 'CODE128', width: 3, height: 50, displayValue: true, fontSize: 14, margin: 0, background: 'transparent' }); } catch(e) { invBarcodeEl.innerHTML = ''; }
    } else if (invBarcodeEl) {
      invBarcodeEl.innerHTML = '';
    }

    const isInclusiveA4 = order.price_display_mode === 'inclusive';
    const subtotalA4 = (isInclusiveA4 && vatRate > 0) ? (subtotal * 100 / (100 + vatRate)) : subtotal;

    const a4Data = {
      shopNameAr:         s.laundryNameAr || '',
      shopNameEn:         s.laundryNameEn || '',
      shopAddressAr:      addressParts.length ? addressParts.join('، ') : (s.locationAr || ''),
      shopAddressEn:      s.locationEn || '',
      shopPhone:          s.phone || '',
      shopEmail:          s.email || '',
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
      starch:           order.starch || '',
      bluing:           order.bluing || '',
      priceDisplayMode: isInclusiveA4 ? 'inclusive' : 'exclusive',
      qrPayload: vatRate > 0 ? {
        sellerName:  shopName,
        vatNumber:   s.vatNumber || '',
        timestamp:   isoTimestamp(order.created_at),
        totalAmount: fmtLtr(total),
        vatAmount:   fmtLtr(vatAmount)
      } : null,
      autoPrint: false
    };

    applyInvoiceTypeClass();
    const paperTypeA4 = (_reportAppSettings && _reportAppSettings.invoicePaperType) || 'thermal';
    if (paperTypeA4 === 'a4') {
      fillA4InvoiceModal(a4Data);
    }
    document.getElementById('invoiceViewModal').style.display = 'flex';
    const dialogBody = document.querySelector('.inv-dialog-body');
    if (dialogBody) dialogBody.scrollTop = 0;
  }

  window.showInvoiceModal = async function(id) {
    if (!_reportAppSettings) {
      const sres = await window.api.getAppSettings().catch(() => null);
      _reportAppSettings = (sres && sres.success && sres.settings) ? sres.settings : {};
    }
    try {
      const res = await window.api.getOrderById({ id });
      if (!res || !res.success || !res.order) {
        showToast(I18N.t('all-invoices-err-load-invoice'), 'error');
        return;
      }
      renderInvoiceModal(res.order, res.items, res.subscription || null);
    } catch(e) {
      showToast(I18N.t('all-invoices-err-load-invoice'), 'error');
    }
  };

  window.closeInvoiceModal = function() {
    document.getElementById('invoiceViewModal').style.display = 'none';
    document.body.classList.remove('invtype-a4');
  };

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInvoiceModal(); });

  function buildCreditNotesTable(creditNotes) {
    if (!creditNotes.length) return `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">${I18N.t('daily-report-no-credit-notes')}</td></tr>`;
    return creditNotes.map((cn) => {
      const dt = fmtDT(cn.created_at);
      const dtParts = dt.split(', ');
      const dateStr = dtParts[0] || dt;
      const timeStr = dtParts[1] || '';
      return `
      <tr>
        <td class="num-cell">${cn.credit_note_seq || cn.credit_note_number}</td>
        <td>${cn.phone || '—'}</td>
        <td>${dateStr}${timeStr ? '<br>' + timeStr : ''}</td>
        <td class="neg-cell">-${SAR(cn.total_amount, false)}</td>
        <td class="no-print"><button class="view-btn" onclick="location.href='/screens/credit-invoices/credit-invoices.html'">${I18N.t('all-invoices-view')}</button></td>
      </tr>`;
    }).join('');
  }

  function buildSubscriptionsTable(subscriptions) {
    if (!subscriptions.length) return `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">${I18N.t('daily-report-no-subscriptions')}</td></tr>`;
    return subscriptions.map((sub) => {
      const dt = fmtDT(sub.created_at);
      const dtParts = dt.split(', ');
      const dateStr = dtParts[0] || dt;
      const timeStr = dtParts[1] || '';
      const typeLabel = sub.entry_type === 'renewal' ? I18N.t('subscription-renewal') : I18N.t('subscription-new');
      return `
      <tr>
        <td>${sub.phone || '—'}</td>
        <td>${sub.subscription_number || sub.subscription_ref || '—'}</td>
        <td>${dateStr}${timeStr ? '<br>' + timeStr : ''}</td>
        <td class="num-cell">${SAR(sub.amount, false)}</td>
        <td>${typeLabel}</td>
      </tr>`;
    }).join('');
  }

  function setupCollapsible(toggleId, bodyId) {
    const toggle = document.getElementById(toggleId);
    const body = document.getElementById(bodyId);
    const arrow = toggle.querySelector('.toggle-arrow');
    let open = true;
    body.classList.add('open');
    toggle.addEventListener('click', () => {
      open = !open;
      body.classList.toggle('open', open);
      arrow.style.transform = open ? '' : 'rotate(-90deg)';
    });
  }

  async function loadReport() {
    loadingState.style.display = 'flex';
    reportContent.style.display = 'none';
    try {
      const res = await window.api.getReportData(filters);
      if (!res.success) { showToast(res.message || I18N.t('all-invoices-err-load'), 'error'); loadingState.style.display = 'none'; return; }
      reportData = res;

      document.getElementById('printMeta').textContent = `${I18N.t('period-report-period')}: ${todayDisplay}`;

      document.getElementById('summaryTableBody').innerHTML = buildSummaryTable(res.summary);
      buildPaymentMethods(res.paymentMethods);

      document.getElementById('badgeExpenses').textContent = res.expenses.length;
      document.getElementById('expensesTableBody').innerHTML = buildExpensesTable(res.expenses);
      const expTotal = res.expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0);
      document.getElementById('expensesFooter').innerHTML = `${I18N.t('all-invoices-total-after-tax')}: ${res.expenses.length} &nbsp;|&nbsp; ${SAR(expTotal)}`;

      document.getElementById('badgeInvoices').textContent = res.invoices.length;
      document.getElementById('invoicesTableBody').innerHTML = buildInvoicesTable(res.invoices);
      const invTotal = res.invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
      document.getElementById('invoicesFooter').innerHTML = `${I18N.t('all-invoices-total-after-tax')}: ${res.invoices.length} &nbsp;|&nbsp; ${SAR(invTotal)}`;

      document.getElementById('badgeCreditNotes').textContent = res.creditNotes.length;
      document.getElementById('creditNotesTableBody').innerHTML = buildCreditNotesTable(res.creditNotes);
      const cnTotal = res.creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0);
      if (res.creditNotes.length) {
        document.getElementById('creditNotesFooter').innerHTML = `${I18N.t('all-invoices-total-after-tax')}: ${res.creditNotes.length} &nbsp;|&nbsp; -${SAR(cnTotal)}`;
      }

      document.getElementById('badgeSubscriptions').textContent = res.subscriptions.length;
      document.getElementById('subscriptionsTableBody').innerHTML = buildSubscriptionsTable(res.subscriptions);
      const subTotal = res.subscriptions.reduce((s, sub) => s + Number(sub.amount || 0), 0);
      if (res.subscriptions.length) {
        document.getElementById('subscriptionsFooter').innerHTML = `${I18N.t('all-invoices-total-after-tax')}: ${res.subscriptions.length} &nbsp;|&nbsp; ${SAR(subTotal)}`;
      }

      setupCollapsible('toggleExpenses', 'bodyExpenses');
      setupCollapsible('toggleInvoices', 'bodyInvoices');
      setupCollapsible('toggleCreditNotes', 'bodyCreditNotes');
      setupCollapsible('toggleSubscriptions', 'bodySubscriptions');

      loadingState.style.display = 'none';
      reportContent.style.display = 'flex';
      reportContent.style.flexDirection = 'column';
      reportContent.style.gap = '16px';
    } catch (err) {
      showToast(I18N.t('all-invoices-err-load'), 'error');
      loadingState.style.display = 'none';
    }
  }

  function rebuildReportContent() {
    if (!reportData) return;
    periodBadge.textContent = `${I18N.t('period-report-period')}: ${todayDisplay} — ${todayDisplay} | ${nowTime}`;
    const printMeta = document.getElementById('printMeta');
    if (printMeta) printMeta.textContent = `${I18N.t('period-report-period')}: ${todayDisplay}`;
    document.getElementById('summaryTableBody').innerHTML = buildSummaryTable(reportData.summary);
    buildPaymentMethods(reportData.paymentMethods);
    document.getElementById('expensesTableBody').innerHTML = buildExpensesTable(reportData.expenses);
    document.getElementById('invoicesTableBody').innerHTML = buildInvoicesTable(reportData.invoices);
    const cnBody = document.getElementById('creditNotesTableBody');
    if (cnBody) cnBody.innerHTML = buildCreditNotesTable(reportData.creditNotes);
    const subBody = document.getElementById('subscriptionsTableBody');
    if (subBody) subBody.innerHTML = buildSubscriptionsTable(reportData.subscriptions);
    const expTotal = reportData.expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0);
    document.getElementById('expensesFooter').innerHTML = `${I18N.t('all-invoices-total-after-tax')}: ${reportData.expenses.length} &nbsp;|&nbsp; ${SAR(expTotal)}`;
    const invTotal = reportData.invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    document.getElementById('invoicesFooter').innerHTML = `${I18N.t('all-invoices-total-after-tax')}: ${reportData.invoices.length} &nbsp;|&nbsp; ${SAR(invTotal)}`;
    const cnTotal = reportData.creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0);
    if (reportData.creditNotes.length) {
      document.getElementById('creditNotesFooter').innerHTML = `${I18N.t('all-invoices-total-after-tax')}: ${reportData.creditNotes.length} &nbsp;|&nbsp; -${SAR(cnTotal)}`;
    }
    const subTotal = reportData.subscriptions.reduce((s, sub) => s + Number(sub.amount || 0), 0);
    if (reportData.subscriptions.length) {
      document.getElementById('subscriptionsFooter').innerHTML = `${I18N.t('all-invoices-total-after-tax')}: ${reportData.subscriptions.length} &nbsp;|&nbsp; ${SAR(subTotal)}`;
    }
  }

  btnPrint.addEventListener('click', () => {
    if (window.I18N) {
      const prevLang = window.I18N.getLang();
      window.I18N.applyTemp('ar');
      rebuildReportContent();
      window.print();
      setTimeout(() => {
        window.I18N.applyTemp(prevLang);
        rebuildReportContent();
      }, 500);
    } else {
      window.print();
    }
  });
  btnExcelExport.addEventListener('click', async () => {
    if (!reportData) { showToast(I18N.t('daily-report-err-export'), 'error'); return; }
    const r = await window.api.exportReport({ type: 'excel', filters });
    btnExcelExport.disabled = false;
    if (!r.success) showToast(r.message || I18N.t('all-invoices-err-export'), 'error');
  });
  btnPdfExport.addEventListener('click', async () => {
    if (!reportData) { showToast(I18N.t('daily-report-err-export'), 'error'); return; }
    const r = await window.api.exportReport({ type: 'pdf', filters });
    btnPdfExport.disabled = false;
    if (!r.success) showToast(r.message || I18N.t('all-invoices-err-export'), 'error');
  });

  /* Invoice modal bindings */
  const btnInvClose = document.getElementById('btnInvClose');
  const btnInvPrint = document.getElementById('btnInvPrint');
  const invoiceViewModal = document.getElementById('invoiceViewModal');
  if (btnInvClose) btnInvClose.addEventListener('click', closeInvoiceModal);
  if (invoiceViewModal) invoiceViewModal.addEventListener('click', (e) => { if (e.target === invoiceViewModal) closeInvoiceModal(); });
  if (btnInvPrint) btnInvPrint.addEventListener('click', () => {
    const paperType = (_reportAppSettings && _reportAppSettings.invoicePaperType) || 'thermal';
    const copies = Number(_reportAppSettings && _reportAppSettings.printCopies);
    const intCopies = (!Number.isFinite(copies) || copies < 1) ? 1 : (copies > 20 ? 20 : Math.floor(copies));
    if (intCopies === 0) return;
    let styleEl = null;
    if (paperType === 'a4') {
      styleEl = document.createElement('style');
      styleEl.id = 'a4PageStyle';
      styleEl.textContent = '@page { size: A4 portrait; margin: 0; }';
      document.head.appendChild(styleEl);
    }
    let currentCopy = 0;
    let cleaned = false;
    function cleanupPrintArtifacts() {
      if (cleaned) return;
      cleaned = true;
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    }
    function printNextCopy() {
      if (currentCopy >= intCopies) { cleanupPrintArtifacts(); return; }
      currentCopy += 1;
      let handled = false;
      function handleAfterPrint() {
        if (handled) return;
        handled = true;
        window.removeEventListener('afterprint', handleAfterPrint);
        if (currentCopy < intCopies) { setTimeout(printNextCopy, 120); } else { cleanupPrintArtifacts(); }
      }
      window.addEventListener('afterprint', handleAfterPrint);
      window.print();
      setTimeout(handleAfterPrint, 2500);
    }
    printNextCopy();
  });

  /* ── Print translation: rebuild dynamic content in Arabic ── */
  window.addEventListener('print-translate', () => rebuildReportContent());
  window.addEventListener('print-restore', () => rebuildReportContent());

  if (typeof I18N !== 'undefined') I18N.apply();
  await loadReport();
});
