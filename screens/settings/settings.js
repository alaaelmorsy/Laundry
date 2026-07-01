window.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const tabLaundry = document.getElementById('tabLaundry');
  const tabTax = document.getElementById('tabTax');
  const tabPrinter = document.getElementById('tabPrinter');
  const tabReportEmail = document.getElementById('tabReportEmail');
  const tabLoyalty = document.getElementById('tabLoyalty');
  const tabClosing = document.getElementById('tabClosing');
  const tabSystemRestore = document.getElementById('tabSystemRestore');
  const tabUpdate = document.getElementById('tabUpdate');
  const panelLaundry = document.getElementById('panelLaundry');
  const panelTax = document.getElementById('panelTax');
  const panelPrinter = document.getElementById('panelPrinter');
  const panelReportEmail = document.getElementById('panelReportEmail');
  const panelLoyalty = document.getElementById('panelLoyalty');
  const panelClosing = document.getElementById('panelClosing');
  const panelSystemRestore = document.getElementById('panelSystemRestore');
  const panelUpdate = document.getElementById('panelUpdate');
  const btnSaveLaundry = document.getElementById('btnSaveLaundry');
  const btnSaveTax = document.getElementById('btnSaveTax');
  const btnSavePrinter = document.getElementById('btnSavePrinter');
  const btnPickLogo = document.getElementById('btnPickLogo');
  const btnRemoveLogo = document.getElementById('btnRemoveLogo');
  const logoImg = document.getElementById('logoImg');
  const logoPlaceholder = document.getElementById('logoPlaceholder');
  const btnAddCustom = document.getElementById('btnAddCustom');
  const customFieldsContainer = document.getElementById('customFieldsContainer');
  const toastContainer = document.getElementById('toastContainer');
  const priceInclusive = document.getElementById('priceInclusive');
  const priceExclusive = document.getElementById('priceExclusive');
  const paymentTrigger = document.getElementById('paymentTrigger');
  const paymentMenu = document.getElementById('paymentMenu');
  const paymentSummary = document.getElementById('paymentSummary');
  const paymentCheckboxes = paymentMenu.querySelectorAll('input[type="checkbox"]');
  const defaultPaymentMethod = document.getElementById('defaultPaymentMethod');

  const zatcaEnabled = document.getElementById('zatcaEnabled');
  const btnOpenZatcaSettings = document.getElementById('btnOpenZatcaSettings');

  const reportEmailModal = document.getElementById('reportEmailModal');
  const reportEmailModalBackdrop = document.getElementById('reportEmailModalBackdrop');
  const btnOpenReportEmailModal = document.getElementById('btnOpenReportEmailModal');
  const btnCloseReportEmailModal = document.getElementById('btnCloseReportEmailModal');
  const btnSaveReportEmail = document.getElementById('btnSaveReportEmail');
  const btnTestReportEmail = document.getElementById('btnTestReportEmail');

  const reportEmailEnabled = document.getElementById('reportEmailEnabled');
  const reportEmailSendHour = document.getElementById('reportEmailSendHour');
  const reportEmailSendMinute = document.getElementById('reportEmailSendMinute');
  const reportEmailAM = document.getElementById('reportEmailAM');
  const reportEmailPM = document.getElementById('reportEmailPM');
  const reportEmailFrom = document.getElementById('reportEmailFrom');
  const reportEmailAppPassword = document.getElementById('reportEmailAppPassword');

  const reportEmailStatus = document.getElementById('reportEmailStatus');
  const reportEmailLastSent = document.getElementById('reportEmailLastSent');


  let reportEmailIsPM = false;

  function setAMPMStyle() {
    if (reportEmailAM) {
      reportEmailAM.style.background = reportEmailIsPM ? 'var(--bg)' : 'var(--accent)';
      reportEmailAM.style.color = reportEmailIsPM ? 'var(--tx3)' : '#fff';
    }
    if (reportEmailPM) {
      reportEmailPM.style.background = reportEmailIsPM ? 'var(--accent)' : 'var(--bg)';
      reportEmailPM.style.color = reportEmailIsPM ? '#fff' : 'var(--tx3)';
    }
  }

  function time12to24(h, m, pm) {
    let hr = parseInt(h, 10);
    if (pm) { hr = hr === 12 ? 12 : hr + 12; }
    else { hr = hr === 12 ? 0 : hr; }
    return String(hr).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function time24to12(t24) {
    const parts = String(t24 || '09:00').split(':');
    let hr = parseInt(parts[0], 10) || 0;
    const mn = parts[1] || '00';
    const pm = hr >= 12;
    if (hr === 0) hr = 12;
    else if (hr > 12) hr -= 12;
    return { h: String(hr), m: mn, pm };
  }

  const fields = {
    laundryNameAr: document.getElementById('laundryNameAr'),
    laundryNameEn: document.getElementById('laundryNameEn'),
    locationAr: document.getElementById('locationAr'),
    locationEn: document.getElementById('locationEn'),
    invoiceNotes: document.getElementById('invoiceNotes'),
    phone: document.getElementById('phone'),
    email: document.getElementById('email'),
    vatRate: document.getElementById('vatRate'),
    vatNumber: document.getElementById('vatNumber'),
    commercialRegister: document.getElementById('commercialRegister'),
    buildingNumber: document.getElementById('buildingNumber'),
    streetNameAr: document.getElementById('streetNameAr'),
    districtAr: document.getElementById('districtAr'),
    cityAr: document.getElementById('cityAr'),
    postalCode: document.getElementById('postalCode'),
    additionalNumber: document.getElementById('additionalNumber'),
    invoicePaperType: document.getElementById('invoicePaperType'),
    logoWidth: document.getElementById('logoWidth'),
    logoHeight: document.getElementById('logoHeight'),
    printCopies: document.getElementById('printCopies'),
    thermalMarginLeft: document.getElementById('thermalMarginLeft'),
    thermalMarginRight: document.getElementById('thermalMarginRight'),
    requireHanger: document.getElementById('requireHanger'),
    requireCustomerPhone: document.getElementById('requireCustomerPhone'),
    allowSubscriptionDebt: document.getElementById('allowSubscriptionDebt'),
    allowManualPrice: document.getElementById('allowManualPrice'),
    barcodeAutoAction: document.getElementById('barcodeAutoAction'),
    barcodeAutoPay: document.getElementById('barcodeAutoPay'),
    barcodeAutoClean: document.getElementById('barcodeAutoClean'),
    barcodeAutoDeliver: document.getElementById('barcodeAutoDeliver'),
    showBarcodeInInvoice: document.getElementById('showBarcodeInInvoice'),
    showEmailInInvoice: document.getElementById('showEmailInInvoice'),
    zatcaEnabled,
    whatsappSendOnPrint:        document.getElementById('whatsappSendOnPrint'),
    whatsappSendOnClean:        document.getElementById('whatsappSendOnClean'),
    whatsappSendOnDeliver:      document.getElementById('whatsappSendOnDeliver'),
    whatsappSendOnSubscription: document.getElementById('whatsappSendOnSubscription'),
    whatsappSendOnPay:          document.getElementById('whatsappSendOnPay'),
    whatsappInvoiceMessage:     document.getElementById('whatsappInvoiceMessage'),
  };

  let priceDisplayMode = 'exclusive';
  let logoDirty = 'none';
  let pendingLogo = null;
  let enabledPaymentMethods = ['cash', 'card', 'credit', 'mixed', 'bank']; // افتراضياً كل الطرق مفعلة

  const MAX_CUSTOM = 20;

  // ═══ Payment Methods Functions ═══
  function updatePaymentCheckboxes() {
    paymentCheckboxes.forEach(cb => {
      cb.checked = enabledPaymentMethods.includes(cb.value);
    });
    updatePaymentSummary();
  }

  function updatePaymentSummary() {
    const count = enabledPaymentMethods.length;
    if (count === 0) {
      paymentSummary.textContent = I18N.t('settings-payment-none') || 'لم يتم اختيار أي طريقة';
    } else if (count === paymentCheckboxes.length) {
      paymentSummary.textContent = I18N.t('settings-payment-all') || 'جميع طرق الدفع';
    } else {
      const labels = [];
      paymentCheckboxes.forEach(cb => {
        if (cb.checked) {
          const labelAr = cb.dataset.labelAr || cb.value;
          labels.push(labelAr);
        }
      });
      paymentSummary.textContent = labels.join('، ');
    }
    updateDefaultPaymentOptions();
  }

  function updateDefaultPaymentOptions() {
    const current = defaultPaymentMethod.value;
    Array.from(defaultPaymentMethod.options).forEach(opt => {
      opt.disabled = !enabledPaymentMethods.includes(opt.value);
    });
    // إذا كانت الطريقة الافتراضية الحالية غير مفعلة، اختر أول طريقة مفعلة
    if (!enabledPaymentMethods.includes(defaultPaymentMethod.value)) {
      defaultPaymentMethod.value = enabledPaymentMethods[0] || 'cash';
    }
  }

  function togglePaymentMenu() {
    const isOpen = paymentMenu.classList.contains('open');
    if (isOpen) {
      paymentMenu.classList.remove('open');
      paymentTrigger.classList.remove('open');
    } else {
      paymentMenu.classList.add('open');
      paymentTrigger.classList.add('open');
    }
  }

  function closePaymentMenu() {
    paymentMenu.classList.remove('open');
    paymentTrigger.classList.remove('open');
  }

  function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : 'toast-error'}`;
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  function setPanel(name) {
    [tabLaundry, tabTax, tabPrinter, tabReportEmail, tabLoyalty, tabClosing, tabSystemRestore, tabUpdate].forEach((t) => {
      if (!t) return;
      t.classList.toggle('active', t.dataset.panel === name);
    });
    panelLaundry.classList.toggle('active', name === 'laundry');
    panelTax.classList.toggle('active', name === 'tax');
    panelPrinter.classList.toggle('active', name === 'printer');
    if (panelReportEmail) panelReportEmail.classList.toggle('active', name === 'reportEmail');
    if (panelLoyalty) panelLoyalty.classList.toggle('active', name === 'loyalty');
    if (panelClosing) panelClosing.classList.toggle('active', name === 'closing');
    if (panelSystemRestore) panelSystemRestore.classList.toggle('active', name === 'systemRestore');
    if (panelUpdate) panelUpdate.classList.toggle('active', name === 'update');
  }

  function fmtDateTimeLocal(v) {
    if (!v) return '—';
    try {
      const d = v instanceof Date ? v : new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleString();
    } catch {
      return String(v);
    }
  }

  function openReportEmailModal() {
    if (!reportEmailModal) { alert('DEBUG: modal element not found!'); return; }
    document.body.appendChild(reportEmailModal);
    Object.assign(reportEmailModal.style, {
      display: 'flex', position: 'fixed',
      top: '0', left: '0', right: '0', bottom: '0',
      width: '100%', height: '100%',
      zIndex: '99999',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px', boxSizing: 'border-box',
      background: 'rgba(0,0,0,0.5)',
    });
  }

  function closeReportEmailModal() {
    if (reportEmailModal) reportEmailModal.style.display = 'none';
  }

  function setLogoPreview(dataUrl) {
    if (dataUrl) {
      logoImg.src = dataUrl;
      logoImg.style.display = 'block';
      logoPlaceholder.style.display = 'none';
    } else {
      logoImg.removeAttribute('src');
      logoImg.style.display = 'none';
      logoPlaceholder.style.display = 'block';
    }
  }

  function applySettingsToForm(s) {
    fields.laundryNameAr.value = s.laundryNameAr || '';
    fields.laundryNameEn.value = s.laundryNameEn || '';
    fields.locationAr.value = s.locationAr || '';
    fields.locationEn.value = s.locationEn || '';
    fields.invoiceNotes.value = s.invoiceNotes || '';
    fields.phone.value = s.phone || '';
    fields.email.value = s.email || '';
    fields.vatRate.value = s.vatRate != null ? String(s.vatRate) : '15';
    fields.vatNumber.value = s.vatNumber || '';
    fields.commercialRegister.value = s.commercialRegister || '';
    if (fields.buildingNumber) fields.buildingNumber.value = s.buildingNumber || '';
    if (fields.streetNameAr) fields.streetNameAr.value = s.streetNameAr || '';
    if (fields.districtAr) fields.districtAr.value = s.districtAr || '';
    if (fields.cityAr) fields.cityAr.value = s.cityAr || '';
    if (fields.postalCode) fields.postalCode.value = s.postalCode || '';
    if (fields.additionalNumber) fields.additionalNumber.value = s.additionalNumber || '';
    fields.invoicePaperType.value = s.invoicePaperType === 'a4' ? 'a4' : 'thermal';
    fields.logoWidth.value = s.logoWidth != null ? String(s.logoWidth) : '180';
    fields.logoHeight.value = s.logoHeight != null ? String(s.logoHeight) : '70';
    fields.printCopies.value = s.printCopies != null ? String(s.printCopies) : '1';
    fields.thermalMarginLeft.value = s.thermalMarginLeft != null ? String(s.thermalMarginLeft) : '0';
    fields.thermalMarginRight.value = s.thermalMarginRight != null ? String(s.thermalMarginRight) : '0';
    if (fields.requireHanger) fields.requireHanger.checked = s.requireHanger === true;
    if (fields.requireCustomerPhone) fields.requireCustomerPhone.checked = s.requireCustomerPhone === true;
    if (fields.allowSubscriptionDebt) fields.allowSubscriptionDebt.checked = s.allowSubscriptionDebt === true;
    if (fields.allowManualPrice) fields.allowManualPrice.checked = s.allowManualPrice === true;
    if (fields.showBarcodeInInvoice) fields.showBarcodeInInvoice.checked = s.showBarcodeInInvoice !== false;
    if (fields.showEmailInInvoice) fields.showEmailInInvoice.checked = s.showEmailInInvoice !== false;
    if (fields.zatcaEnabled) fields.zatcaEnabled.checked = s.zatcaEnabled === true;
    if (fields.whatsappSendOnPrint)        fields.whatsappSendOnPrint.checked        = s.whatsappSendOnPrint === true;
    if (fields.whatsappSendOnClean)        fields.whatsappSendOnClean.checked        = s.whatsappSendOnClean === true;
    if (fields.whatsappSendOnDeliver)      fields.whatsappSendOnDeliver.checked      = s.whatsappSendOnDeliver === true;
    if (fields.whatsappSendOnSubscription) fields.whatsappSendOnSubscription.checked = s.whatsappSendOnSubscription === true;
    if (fields.whatsappSendOnPay)          fields.whatsappSendOnPay.checked          = s.whatsappSendOnPay === true;
    if (fields.whatsappInvoiceMessage)     fields.whatsappInvoiceMessage.value       = s.whatsappInvoiceMessage || '';
    // Barcode auto-action toggles
    const barcodeActions = (s.barcodeAutoAction || 'none').split(',');
    if (fields.barcodeAutoPay) fields.barcodeAutoPay.checked = barcodeActions.includes('pay');
    if (fields.barcodeAutoClean) fields.barcodeAutoClean.checked = barcodeActions.includes('clean');
    if (fields.barcodeAutoDeliver) fields.barcodeAutoDeliver.checked = barcodeActions.includes('deliver');

    priceDisplayMode = s.priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive';
    priceInclusive.classList.toggle('active', priceDisplayMode === 'inclusive');
    priceExclusive.classList.toggle('active', priceDisplayMode === 'exclusive');

    // تطبيق طرق الدفع
    enabledPaymentMethods = Array.isArray(s.enabledPaymentMethods) && s.enabledPaymentMethods.length > 0 
      ? s.enabledPaymentMethods 
      : ['cash', 'card', 'credit', 'mixed', 'bank'];
    updatePaymentCheckboxes();
    // تطبيق طريقة الدفع الافتراضية
    defaultPaymentMethod.value = s.defaultPaymentMethod || enabledPaymentMethods[0] || 'cash';
    updateDefaultPaymentOptions();

    customFieldsContainer.innerHTML = '';
    const list = Array.isArray(s.customFields) ? s.customFields : [];
    list.forEach((cf) => addCustomRow(cf));

    setLogoPreview(s.logoDataUrl || '');
    logoDirty = 'none';
    pendingLogo = null;

    if (reportEmailEnabled) reportEmailEnabled.checked = s.reportEmailEnabled === true;
    if (reportEmailFrom) reportEmailFrom.value = s.reportEmailFrom || '';
    if (reportEmailAppPassword) reportEmailAppPassword.value = '';
    // Convert 24h → 12h for picker
    const t12 = time24to12(s.reportEmailSendTime);
    if (reportEmailSendHour) reportEmailSendHour.value = t12.h;
    if (reportEmailSendMinute) reportEmailSendMinute.value = t12.m;
    reportEmailIsPM = t12.pm;
    setAMPMStyle();

    if (reportEmailStatus) {
      const st = s.reportEmailLastStatus || (s.reportEmailEnabled ? 'enabled' : 'disabled');
      const statusMap = {
        'enabled': I18N.t('settings-report-email-status-enabled'),
        'disabled': I18N.t('settings-report-email-status-disabled'),
        'success': I18N.t('settings-report-email-status-success'),
        'failed': I18N.t('settings-report-email-status-failed'),
      };
      reportEmailStatus.textContent = statusMap[st] || st || '—';
    }
    if (reportEmailLastSent) reportEmailLastSent.textContent = fmtDateTimeLocal(s.reportEmailLastSentAt);
  }

  function addCustomRow(cf = {}) {
    if (customFieldsContainer.querySelectorAll('.custom-row').length >= MAX_CUSTOM) {
      showToast(I18N.t('settings-custom-max'), 'error');
      return;
    }
    const id = cf.id || `cf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const row = document.createElement('div');
    row.className = 'custom-row';
    row.dataset.id = id;
    row.innerHTML = `
      <div class="fld">
        <label class="flbl" data-i18n="settings-custom-label-ar"></label>
        <div class="fwrap"><input type="text" class="finp cf-label-ar" /></div>
      </div>
      <div class="fld">
        <label class="flbl" data-i18n="settings-custom-label-en"></label>
        <div class="fwrap"><input type="text" class="finp cf-label-en" dir="ltr" style="text-align:left" /></div>
      </div>
      <div>
        <button type="button" class="btn-danger btn-remove-cf" data-i18n="settings-custom-remove"></button>
      </div>
    `;
    row.querySelector('.cf-label-ar').value = cf.labelAr || '';
    row.querySelector('.cf-label-en').value = cf.labelEn || '';
    row.querySelector('.btn-remove-cf').addEventListener('click', () => row.remove());
    customFieldsContainer.appendChild(row);
    I18N.apply();
  }

  function collectCustomFields() {
    const rows = customFieldsContainer.querySelectorAll('.custom-row');
    const out = [];
    rows.forEach((row) => {
      out.push({
        id: row.dataset.id || `cf_${out.length}`,
        labelAr: row.querySelector('.cf-label-ar')?.value?.trim() || '',
        labelEn: row.querySelector('.cf-label-en')?.value?.trim() || ''
      });
    });
    return out;
  }

  function buildSavePayload() {
    const payload = {
      laundryNameAr: fields.laundryNameAr.value,
      laundryNameEn: fields.laundryNameEn.value,
      locationAr: fields.locationAr.value,
      locationEn: fields.locationEn.value,
      invoiceNotes: fields.invoiceNotes.value,
      phone: fields.phone.value,
      email: fields.email.value,
      customFields: collectCustomFields(),
      vatRate: fields.vatRate.value,
      vatNumber: fields.vatNumber.value,
      commercialRegister: fields.commercialRegister.value,
      buildingNumber: fields.buildingNumber ? fields.buildingNumber.value : '',
      streetNameAr: fields.streetNameAr ? fields.streetNameAr.value : '',
      districtAr: fields.districtAr ? fields.districtAr.value : '',
      cityAr: fields.cityAr ? fields.cityAr.value : '',
      postalCode: fields.postalCode ? fields.postalCode.value : '',
      additionalNumber: fields.additionalNumber ? fields.additionalNumber.value : '',
      priceDisplayMode,
      enabledPaymentMethods,
      defaultPaymentMethod: defaultPaymentMethod.value,
      invoicePaperType: fields.invoicePaperType.value,
      logoWidth: fields.logoWidth.value,
      logoHeight: fields.logoHeight.value,
      printCopies: fields.printCopies.value,
      thermalMarginLeft: fields.thermalMarginLeft.value,
      thermalMarginRight: fields.thermalMarginRight.value,
      requireHanger: fields.requireHanger ? fields.requireHanger.checked : false,
      requireCustomerPhone: fields.requireCustomerPhone ? fields.requireCustomerPhone.checked : false,
      allowSubscriptionDebt: fields.allowSubscriptionDebt ? fields.allowSubscriptionDebt.checked : false,
      allowManualPrice: fields.allowManualPrice ? fields.allowManualPrice.checked : false,
      showBarcodeInInvoice: fields.showBarcodeInInvoice ? fields.showBarcodeInInvoice.checked : true,
      showEmailInInvoice: fields.showEmailInInvoice ? fields.showEmailInInvoice.checked : true,
      barcodeAutoAction: (() => {
        const parts = [];
        if (fields.barcodeAutoPay && fields.barcodeAutoPay.checked) parts.push('pay');
        if (fields.barcodeAutoClean && fields.barcodeAutoClean.checked) parts.push('clean');
        if (fields.barcodeAutoDeliver && fields.barcodeAutoDeliver.checked) parts.push('deliver');
        return parts.length ? parts.join(',') : 'none';
      })(),
      reportEmailEnabled: reportEmailEnabled ? reportEmailEnabled.checked : false,
      reportEmailFrom: reportEmailFrom ? reportEmailFrom.value : '',
      reportEmailSendTime: time12to24(
        reportEmailSendHour ? reportEmailSendHour.value : '9',
        reportEmailSendMinute ? reportEmailSendMinute.value : '00',
        reportEmailIsPM
      ),
      zatcaEnabled: fields.zatcaEnabled ? fields.zatcaEnabled.checked : false,
      whatsappSendOnPrint:        fields.whatsappSendOnPrint        ? fields.whatsappSendOnPrint.checked        : false,
      whatsappSendOnClean:        fields.whatsappSendOnClean        ? fields.whatsappSendOnClean.checked        : false,
      whatsappSendOnDeliver:      fields.whatsappSendOnDeliver      ? fields.whatsappSendOnDeliver.checked      : false,
      whatsappSendOnSubscription: fields.whatsappSendOnSubscription ? fields.whatsappSendOnSubscription.checked : false,
      whatsappSendOnPay:          fields.whatsappSendOnPay          ? fields.whatsappSendOnPay.checked          : false,
      whatsappInvoiceMessage:     fields.whatsappInvoiceMessage     ? fields.whatsappInvoiceMessage.value.trim() : ''
    };

    const appPwd = reportEmailAppPassword ? reportEmailAppPassword.value.trim() : '';
    if (appPwd) {
      payload.reportEmailAppPassword = appPwd;
    }

    if (logoDirty === 'removed') {
      payload.removeLogo = true;
    } else if (logoDirty === 'new' && pendingLogo) {
      payload.imageBase64 = pendingLogo.base64;
      payload.imageMime = pendingLogo.mime;
    }

    return payload;
  }

  async function loadSettings() {
    const res = await window.api.getAppSettings();
    if (!res || !res.success) {
      showToast(I18N.t('settings-err-load'), 'error');
      return;
    }
    applySettingsToForm(res.settings);
  }

  async function saveSettings() {
    btnSaveLaundry.disabled = true;
    btnSaveTax.disabled = true;
    btnSavePrinter.disabled = true;
    try {
      const res = await window.api.saveAppSettings(buildSavePayload());
      if (!res || !res.success) {
        showToast(res?.message || I18N.t('settings-err-save'), 'error');
        return;
      }
      showToast(I18N.t('settings-success-save'), 'success');
      await loadSettings();
    } catch (e) {
      showToast(e.message || I18N.t('settings-err-save'), 'error');
    } finally {
      btnSaveLaundry.disabled = false;
      btnSaveTax.disabled = false;
      btnSavePrinter.disabled = false;
    }
  }

  tabLaundry.addEventListener('click', () => setPanel('laundry'));
  tabTax.addEventListener('click', () => setPanel('tax'));
  tabPrinter.addEventListener('click', () => setPanel('printer'));
  if (tabReportEmail) tabReportEmail.addEventListener('click', () => setPanel('reportEmail'));
  if (tabLoyalty) tabLoyalty.addEventListener('click', () => setPanel('loyalty'));
  if (tabClosing) tabClosing.addEventListener('click', () => setPanel('closing'));
  if (tabSystemRestore) tabSystemRestore.addEventListener('click', () => setPanel('systemRestore'));
  if (tabUpdate) tabUpdate.addEventListener('click', () => { setPanel('update'); initUpdatePanel(); });
  window.addEventListener('userReady', (e) => {
    const user = e.detail;
    if (!user || user.role !== 'superadmin') {
      if (tabSystemRestore) tabSystemRestore.style.display = 'none';
      if (panelSystemRestore) panelSystemRestore.style.display = 'none';
    }
  });

  btnBack.addEventListener('click', () => window.api.navigateBack());

  if (btnOpenZatcaSettings) {
    btnOpenZatcaSettings.addEventListener('click', () => {
      window.api.navigateTo('zatca-settings');
    });
  }

  priceInclusive.addEventListener('click', () => {
    priceDisplayMode = 'inclusive';
    priceInclusive.classList.add('active');
    priceExclusive.classList.remove('active');
  });
  priceExclusive.addEventListener('click', () => {
    priceDisplayMode = 'exclusive';
    priceExclusive.classList.add('active');
    priceInclusive.classList.remove('active');
  });

  // Barcode auto-action toggles → update hidden field on change
  ['barcodeAutoPay', 'barcodeAutoClean', 'barcodeAutoDeliver'].forEach(key => {
    if (fields[key]) fields[key].addEventListener('change', () => {
      const parts = [];
      if (fields.barcodeAutoPay && fields.barcodeAutoPay.checked) parts.push('pay');
      if (fields.barcodeAutoClean && fields.barcodeAutoClean.checked) parts.push('clean');
      if (fields.barcodeAutoDeliver && fields.barcodeAutoDeliver.checked) parts.push('deliver');
      if (fields.barcodeAutoAction) fields.barcodeAutoAction.value = parts.length ? parts.join(',') : 'none';
    });
  });

  btnPickLogo.addEventListener('click', async () => {
    const pick = await window.api.pickProductImage();
    if (!pick || pick.canceled) return;
    if (!pick.success) {
      showToast(pick.message || I18N.t('settings-err-save'), 'error');
      return;
    }
    pendingLogo = { base64: pick.base64, mime: pick.mime || 'image/png' };
    logoDirty = 'new';
    setLogoPreview(`data:${pendingLogo.mime};base64,${pendingLogo.base64}`);
  });

  btnRemoveLogo.addEventListener('click', () => {
    logoDirty = 'removed';
    pendingLogo = null;
    setLogoPreview('');
  });

  btnAddCustom.addEventListener('click', () => addCustomRow({}));

  btnSaveLaundry.addEventListener('click', saveSettings);
  btnSaveTax.addEventListener('click', saveSettings);
  btnSavePrinter.addEventListener('click', saveSettings);

  if (btnOpenReportEmailModal) btnOpenReportEmailModal.addEventListener('click', openReportEmailModal);
  if (btnCloseReportEmailModal) btnCloseReportEmailModal.addEventListener('click', closeReportEmailModal);
  if (reportEmailModalBackdrop) reportEmailModalBackdrop.addEventListener('click', closeReportEmailModal);
  if (reportEmailAM) reportEmailAM.addEventListener('click', () => { reportEmailIsPM = false; setAMPMStyle(); });
  if (reportEmailPM) reportEmailPM.addEventListener('click', () => { reportEmailIsPM = true; setAMPMStyle(); });
  if (btnSaveReportEmail) btnSaveReportEmail.addEventListener('click', async () => {
    await saveSettings();
    closeReportEmailModal();
  });
  if (btnTestReportEmail) btnTestReportEmail.addEventListener('click', async () => {
    if (!window.api || typeof window.api.sendTestDailyReportEmail !== 'function') {
      showToast(I18N.t('settings-report-email-toast-api-not-ready'), 'error');
      return;
    }
    btnTestReportEmail.disabled = true;
    try {
      const res = await window.api.sendTestDailyReportEmail();
      if (!res || !res.success) {
        showToast(res?.message || I18N.t('settings-report-email-toast-send-failed'), 'error');
        return;
      }
      showToast(I18N.t('settings-report-email-toast-sent'), 'success');
      await loadSettings();
    } catch (e) {
      showToast(e.message || I18N.t('settings-report-email-toast-send-failed'), 'error');
    } finally {
      btnTestReportEmail.disabled = false;
    }
  });

  // ═══ Payment Methods Events ═══
  paymentTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePaymentMenu();
  });

  paymentCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!enabledPaymentMethods.includes(cb.value)) {
          enabledPaymentMethods.push(cb.value);
        }
      } else {
        enabledPaymentMethods = enabledPaymentMethods.filter(m => m !== cb.value);
      }
      updatePaymentSummary();
    });
  });

  // ═══ Loyalty Settings ═══
  const loyaltyEnabledCb      = document.getElementById('loyaltyEnabled');
  const loyaltyEnabledLabel   = document.getElementById('loyaltyEnabledLabel');
  const loyaltyRiyalsPerPoint = document.getElementById('loyaltyRiyalsPerPoint');
  const loyaltySarPerPoint    = document.getElementById('loyaltySarPerPoint');
  const loyaltyExpiryDate     = document.getElementById('loyaltyExpiryDate');
  const btnSaveLoyalty        = document.getElementById('btnSaveLoyalty');

  if (loyaltyExpiryDate) {
    loyaltyExpiryDate.addEventListener('click', function() {
      try { this.showPicker(); } catch (_) {}
    });
  }

  function updateLoyaltyLabel() {
    if (!loyaltyEnabledLabel) return;
    loyaltyEnabledLabel.textContent = (loyaltyEnabledCb && loyaltyEnabledCb.checked)
      ? window.I18N.t('settings-loyalty-enabled')
      : window.I18N.t('settings-loyalty-disabled');
  }

  if (loyaltyEnabledCb) {
    loyaltyEnabledCb.addEventListener('change', () => {
      updateLoyaltyLabel();
    });
  }

  async function loadLoyaltySettings() {
    try {
      const res = await window.api.getLoyaltySettings();
      if (!res || !res.success) return;
      const s = res.settings;
      if (loyaltyEnabledCb) loyaltyEnabledCb.checked = s.loyaltyEnabled === true;
      if (loyaltyRiyalsPerPoint) {
        // الواجهة: "كل X ريال = 1 نقطة" = 1 / loyaltyPointsPerSar
        const rpp = s.loyaltyPointsPerSar > 0 ? (1 / s.loyaltyPointsPerSar) : 10;
        loyaltyRiyalsPerPoint.value = parseFloat(rpp.toFixed(4));
      }
      if (loyaltySarPerPoint) loyaltySarPerPoint.value = s.loyaltySarPerPoint || 0.05;
      if (loyaltyExpiryDate) loyaltyExpiryDate.value = s.loyaltyExpiryDate || '';
      updateLoyaltyLabel();
    } catch (e) {
      console.error('loadLoyaltySettings error:', e);
    }
  }

  if (btnSaveLoyalty) {
    btnSaveLoyalty.addEventListener('click', async () => {
      btnSaveLoyalty.disabled = true;
      try {
        const rpp = parseFloat(loyaltyRiyalsPerPoint && loyaltyRiyalsPerPoint.value) || 10;
        const pps = rpp > 0 ? 1 / rpp : 0.1; // تحويل "كل X ريال = 1 نقطة" إلى points_per_sar
        const spp = parseFloat(loyaltySarPerPoint && loyaltySarPerPoint.value) || 0.05;
        const expDate = (loyaltyExpiryDate && loyaltyExpiryDate.value) ? loyaltyExpiryDate.value : null;
        const res = await window.api.saveLoyaltySettings({
          loyaltyEnabled: loyaltyEnabledCb ? loyaltyEnabledCb.checked : false,
          loyaltyPointsPerSar: pps,
          loyaltySarPerPoint: spp,
          loyaltyExpiryDate: expDate
        });
        if (!res || !res.success) {
          showToast(res?.message || window.I18N.t('settings-loyalty-err-save'), 'error');
          return;
        }
        showToast(window.I18N.t('settings-loyalty-success-save'), 'success');
      } catch (e) {
        showToast(e.message || window.I18N.t('settings-loyalty-err-save'), 'error');
      } finally {
        btnSaveLoyalty.disabled = false;
      }
    });
  }

  loadLoyaltySettings();

  // ═══ Closing Time Settings ═══
  const closingTime    = document.getElementById('closingTime');
  const btnClearClosing = document.getElementById('btnClearClosing');
  const closingPreview = document.getElementById('closingPreview');
  const btnSaveClosing = document.getElementById('btnSaveClosing');

  function timeLabel(t) {
    if (!t) return '—';
    const [hh, mm] = t.split(':').map(Number);
    const ampm = hh < 12 ? 'ص' : 'م';
    const h12  = hh % 12 || 12;
    return `${String(h12).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${ampm}`;
  }

  function updateClosingPreview() {
    if (!closingPreview || !closingTime) return;
    const val = closingTime.value; // "HH:MM"
    if (!val) { closingPreview.style.display = 'none'; return; }
    const [rh, rm] = val.split(':').map(Number);
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const resetMins = rh * 60 + rm;
    let periodStart, periodEnd;
    if (nowMins >= resetMins) {
      periodStart = new Date(now); periodStart.setHours(rh, rm, 0, 0);
      periodEnd   = new Date(periodStart); periodEnd.setDate(periodEnd.getDate() + 1);
    } else {
      periodStart = new Date(now); periodStart.setDate(periodStart.getDate() - 1); periodStart.setHours(rh, rm, 0, 0);
      periodEnd   = new Date(now); periodEnd.setHours(rh, rm, 0, 0);
    }
    const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${timeLabel(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)}`;
    closingPreview.style.display = 'block';
    closingPreview.innerHTML = `
      <strong>📅 ${window.I18N.t('settings-closing-preview-title')}</strong><br/>
      ${window.I18N.t('settings-closing-preview-from')}: ${fmt(periodStart)}<br/>
      ${window.I18N.t('settings-closing-preview-to')}: ${fmt(periodEnd)}
    `;
  }

  async function loadClosingSettings() {
    try {
      const res = await window.api.getAppSettings();
      if (!res || !res.success) return;
      const t = res.settings.dayResetTime;
      if (closingTime) {
        closingTime.value = t || '';
        updateClosingPreview();
      }
    } catch (e) { console.error('loadClosingSettings', e); }
  }

  if (closingTime) closingTime.addEventListener('change', updateClosingPreview);
  if (btnClearClosing) btnClearClosing.addEventListener('click', () => {
    if (closingTime) closingTime.value = '';
    if (closingPreview) closingPreview.style.display = 'none';
  });

  if (btnSaveClosing) {
    btnSaveClosing.addEventListener('click', async () => {
      btnSaveClosing.disabled = true;
      try {
        const t = closingTime && closingTime.value ? closingTime.value : null;
        const h = t ? parseInt(t.split(':')[0], 10) : null;
        const res = await window.api.saveAppSettings({ dayResetHour: h, dayResetTime: t });
        if (!res || !res.success) {
          showToast(res?.message || 'خطأ في الحفظ', 'error');
          return;
        }
        showToast(window.I18N.t('settings-closing-success-save'), 'success');
      } catch (e) {
        showToast(e.message || 'خطأ في الحفظ', 'error');
      } finally {
        btnSaveClosing.disabled = false;
      }
    });
  }

  loadClosingSettings();

  // إغلاق القائمة عند الضغط خارجها
  document.addEventListener('click', (e) => {
    if (!paymentTrigger.contains(e.target) && !paymentMenu.contains(e.target)) {
      closePaymentMenu();
    }
  });

  // ═══ System Restore Modal ═══
  const systemRestoreModal       = document.getElementById('systemRestoreModal');
  const systemRestoreModalBackdrop = document.getElementById('systemRestoreModalBackdrop');
  const btnOpenSystemRestoreModal  = document.getElementById('btnOpenSystemRestoreModal');
  const btnCloseSystemRestoreModal = document.getElementById('btnCloseSystemRestoreModal');
  const btnCancelSystemRestore     = document.getElementById('btnCancelSystemRestore');
  const btnConfirmSystemRestore    = document.getElementById('btnConfirmSystemRestore');
  const rcInvoices            = document.getElementById('rcInvoices');
  const rcSubscriptions       = document.getElementById('rcSubscriptions');
  const rcConsumptionReceipts = document.getElementById('rcConsumptionReceipts');
  const rcCustomers           = document.getElementById('rcCustomers');
  const rcCustomersOption     = document.getElementById('rcCustomersOption');
  const rcServices            = document.getElementById('rcServices');
  const rcExpenses            = document.getElementById('rcExpenses');
  const rcGarments            = document.getElementById('rcGarments');
  const rcCheckboxes = [rcInvoices, rcSubscriptions, rcConsumptionReceipts, rcCustomers, rcServices, rcExpenses, rcGarments].filter(Boolean);

  function updateRestoreConfirmBtn() {
    const anyChecked = rcCheckboxes.some(cb => cb.checked);
    btnConfirmSystemRestore.disabled = !anyChecked;
    btnConfirmSystemRestore.style.opacity = anyChecked ? '1' : '.5';
    btnConfirmSystemRestore.style.cursor  = anyChecked ? 'pointer' : 'not-allowed';
  }

  function syncCustomersOption() {
    const subChecked = (rcSubscriptions && rcSubscriptions.checked) && (rcConsumptionReceipts && rcConsumptionReceipts.checked);
    if (rcCustomers) {
      rcCustomers.disabled = !subChecked;
      if (!subChecked) rcCustomers.checked = false;
    }
    if (rcCustomersOption) {
      rcCustomersOption.style.opacity = subChecked ? '1' : '.5';
      rcCustomersOption.style.cursor  = subChecked ? 'pointer' : 'not-allowed';
    }
  }

  function openSystemRestoreModal() {
    rcCheckboxes.forEach(cb => { cb.checked = false; });
    syncCustomersOption();
    updateRestoreConfirmBtn();
    systemRestoreModal.style.display = 'flex';
  }

  function closeSystemRestoreModal() {
    systemRestoreModal.style.display = 'none';
  }

  rcCheckboxes.forEach(cb => cb.addEventListener('change', updateRestoreConfirmBtn));
  if (rcSubscriptions)       rcSubscriptions.addEventListener('change',       () => { syncCustomersOption(); updateRestoreConfirmBtn(); });
  if (rcConsumptionReceipts) rcConsumptionReceipts.addEventListener('change', () => { syncCustomersOption(); updateRestoreConfirmBtn(); });

  if (btnOpenSystemRestoreModal)    btnOpenSystemRestoreModal.addEventListener('click', openSystemRestoreModal);
  if (btnCloseSystemRestoreModal)   btnCloseSystemRestoreModal.addEventListener('click', closeSystemRestoreModal);
  if (btnCancelSystemRestore)       btnCancelSystemRestore.addEventListener('click', closeSystemRestoreModal);
  if (systemRestoreModalBackdrop)   systemRestoreModalBackdrop.addEventListener('click', closeSystemRestoreModal);

  if (btnConfirmSystemRestore) {
    btnConfirmSystemRestore.addEventListener('click', async () => {
      if (btnConfirmSystemRestore.disabled) return;
      btnConfirmSystemRestore.disabled = true;
      btnConfirmSystemRestore.style.opacity = '.5';
      const origText = btnConfirmSystemRestore.innerHTML;
      btnConfirmSystemRestore.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> ${window.I18N.t('settings-restore-running')}`;
      try {
        const res = await window.api.systemRestore({
          invoices:             rcInvoices            ? rcInvoices.checked            : false,
          subscriptions:        rcSubscriptions       ? rcSubscriptions.checked       : false,
          consumptionReceipts:  rcConsumptionReceipts ? rcConsumptionReceipts.checked : false,
          customers:            rcCustomers           ? rcCustomers.checked           : false,
          services:             rcServices            ? rcServices.checked            : false,
          expenses:             rcExpenses            ? rcExpenses.checked            : false,
          garments:             rcGarments            ? rcGarments.checked            : false,
        });
        closeSystemRestoreModal();
        if (!res || !res.success) {
          showToast(res?.message || window.I18N.t('settings-restore-err'), 'error');
        } else {
          showToast(`${window.I18N.t('settings-restore-success')} (${(res.deleted || []).length})`, 'success');
        }
      } catch (e) {
        closeSystemRestoreModal();
        showToast(e.message || window.I18N.t('settings-restore-err'), 'error');
      } finally {
        btnConfirmSystemRestore.innerHTML = origText;
        updateRestoreConfirmBtn();
      }
    });
  }

  // ── UPDATE PANEL LOGIC ────────────────────────────────────────────────────
  let updatePanelReady = false;
  let progressPollTimer = null;

  function initUpdatePanel() {
    if (updatePanelReady) return;
    updatePanelReady = true;

    const storedLang = localStorage.getItem('app_lang');
    if (storedLang && storedLang !== 'ar' && storedLang !== 'en') {
      localStorage.setItem('app_lang', 'ar');
    }

    const elVersion     = document.getElementById('updateCurrentVersion');
    const btnCheck      = document.getElementById('btnCheckUpdate');
    const resultArea    = document.getElementById('updateResultArea');
    const progressPanel = document.getElementById('updateProgressPanel');
    const progressBar   = document.getElementById('updateProgressBar');
    const progressTitle = document.getElementById('updateProgressTitle');
    const downloadSizeEl = document.getElementById('updateDownloadSize');
    const pctEl         = document.getElementById('updateProgressPercent');

    function fmtMB(b) {
      if (!b) return '0.0 MB';
      if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
      if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
      return b + ' B';
    }

    // show current version + support status on load
    try {
      window.api.getUpdateStatus().then(r => {
        if (r && r.currentVersion && elVersion) elVersion.textContent = r.currentVersion;
      }).catch(() => {});
    } catch (_) {}
    try {
      window.api.getSupportStatus().then(r => {
        const el = document.getElementById('updateSupportStatus');
        if (!el || !r) return;
        if (r.valid) {
          const txt = r.daysLeft !== null
            ? `الدعم الفني سارٍ (${r.daysLeft} يوم متبقٍ)`
            : 'الدعم الفني سارٍ';
          el.innerHTML = `<span style="color:#16a34a">✅ ${txt}</span>`;
        } else {
          el.innerHTML = `<span style="color:#dc2626">⚠️ انتهى الدعم الفني — التحديثات معطَّلة</span>`;
        }
      }).catch(() => {});
    } catch (_) {}

    if (btnCheck) btnCheck.addEventListener('click', handleCheckUpdate);

    // ── US1: Check support + GitHub ───────────────────────────────────────────

    async function handleCheckUpdate() {
      if (!btnCheck) return;
      btnCheck.disabled = true;
      const origContent = btnCheck.innerHTML;
      btnCheck.innerHTML = `<span>جارٍ الفحص...</span>`;
      if (resultArea) resultArea.style.display = 'none';
      hideProgressPanel();

      try {
        const res = await window.api.checkForUpdate({ force: true });
        if (!res || !res.success) {
          if (res && res.supportExpired) {
            showSupportExpiredMsg(res.message);
          } else {
            showToast(res?.message || 'حدث خطأ أثناء الفحص', 'error');
          }
          return;
        }
        if (elVersion && res.currentVersion) elVersion.textContent = res.currentVersion;
        renderUpdateResult(res);
      } catch (e) {
        showToast(e.message || 'حدث خطأ أثناء الفحص', 'error');
      } finally {
        btnCheck.disabled = false;
        btnCheck.innerHTML = origContent;
      }
    }

    function showSupportExpiredMsg(msg) {
      if (!resultArea) return;
      resultArea.style.display = 'block';
      resultArea.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:#fffbeb;border:1px solid #f59e0b;border-radius:12px;color:#92400e;font-size:13px;direction:rtl">
        <span style="font-size:20px">⚠️</span>
        <span>${msg || 'انتهت فترة الدعم الفني — يرجى تجديد الدعم للحصول على التحديثات'}</span>
      </div>`;
    }

    function renderUpdateResult(res) {
      if (!resultArea) return;
      if (!res.hasUpdate) {
        resultArea.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--bg);border-radius:10px;border:1px solid var(--bdr)">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" width="20" height="20"><polyline points="20 6 9 17 4 12"/></svg>
            <span style="font-size:14px;color:var(--tx1)">البرنامج محدَّث — لا يوجد تحديث جديد</span>
          </div>`;
        resultArea.style.display = 'block';
        return;
      }
      const notes = (res.releaseNotes || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      const pubDate = res.publishedAt ? new Date(res.publishedAt).toLocaleDateString('ar-SA') : '';
      const sizeLabel = res.assetSize ? `&nbsp;·&nbsp;<strong>الحجم:</strong> ${fmtMB(res.assetSize)}` : '';
      resultArea.innerHTML = `
        <div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;align-items:center;gap:8px">
            <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style="font-size:14px;font-weight:700;color:#1d4ed8">يوجد تحديث جديد</span>
          </div>
          <div style="font-size:13px;color:var(--tx2)">
            <strong>الإصدار:</strong> ${res.latestVersion || ''}
            ${pubDate ? `&nbsp;·&nbsp;<strong>تاريخ الإصدار:</strong> ${pubDate}` : ''}
            ${sizeLabel}
          </div>
          ${notes ? `<div style="font-size:12px;color:var(--tx3);max-height:120px;overflow-y:auto;line-height:1.6;padding:8px;background:rgba(255,255,255,.6);border-radius:8px">${notes}</div>` : ''}
          <button type="button" id="btnDownloadUpdate" style="align-self:flex-start;padding:10px 24px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            تحميل التحديث
          </button>
        </div>`;
      resultArea.style.display = 'block';
      const btnDl = document.getElementById('btnDownloadUpdate');
      if (btnDl) btnDl.addEventListener('click', handleDownload);
    }

    // ── US2: Download with MB progress bar ───────────────────────────────────

    async function handleDownload() {
      const btnDl = document.getElementById('btnDownloadUpdate');
      if (btnDl) btnDl.disabled = true;
      if (btnCheck) btnCheck.disabled = true;

      showProgressPanel('جارٍ التحميل...');

      try {
        const res = await window.api.downloadUpdate();
        if (!res || !res.success) {
          showDownloadError(res?.message || 'فشل بدء التحميل');
          if (btnDl) btnDl.disabled = false;
          if (btnCheck) btnCheck.disabled = false;
          return;
        }
        startDownloadPolling();
      } catch (e) {
        showDownloadError(e.message || 'فشل بدء التحميل');
        if (btnDl) btnDl.disabled = false;
        if (btnCheck) btnCheck.disabled = false;
      }
    }

    function startDownloadPolling() {
      clearInterval(progressPollTimer);
      progressPollTimer = setInterval(async () => {
        try {
          const res = await window.api.getUpdateProgress();
          if (!res || !res.success) return;

          const pct = res.percent || 0;
          if (progressBar) progressBar.style.width = pct + '%';
          if (pctEl) pctEl.textContent = pct + '%';

          if (res.totalBytes > 0 && downloadSizeEl) {
            downloadSizeEl.textContent = `${fmtMB(res.downloadedBytes || 0)} / ${fmtMB(res.totalBytes)}`;
          }

          if (res.downloadDone) {
            clearInterval(progressPollTimer);
            onDownloadComplete();
          }
        } catch (e) {
          clearInterval(progressPollTimer);
          showDownloadError(e.message || 'انقطع الاتصال أثناء التحميل');
          const btnDl = document.getElementById('btnDownloadUpdate');
          if (btnDl) btnDl.disabled = false;
          if (btnCheck) btnCheck.disabled = false;
        }
      }, 1000);
    }

    function showDownloadError(msg) {
      hideProgressPanel();
      if (resultArea) {
        resultArea.style.display = 'block';
        const existing = resultArea.querySelector('[data-dl-error]');
        if (existing) existing.remove();
        const errDiv = document.createElement('div');
        errDiv.setAttribute('data-dl-error', '1');
        errDiv.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;font-size:13px;color:#dc2626;margin-top:10px;direction:rtl';
        errDiv.innerHTML = `<span>❌</span><span>${msg}</span>`;
        resultArea.appendChild(errDiv);
      }
    }

    // ── US3: Install Now ──────────────────────────────────────────────────────

    function onDownloadComplete() {
      if (progressBar) { progressBar.style.transition = 'width .3s ease'; progressBar.style.width = '100%'; }
      if (pctEl) pctEl.textContent = '100%';
      if (progressTitle) progressTitle.textContent = 'اكتمل التحميل ✓';
      if (downloadSizeEl) downloadSizeEl.textContent = '';

      setTimeout(() => {
        hideProgressPanel();
        if (resultArea) {
          resultArea.style.display = 'block';
          resultArea.innerHTML = `
            <div style="border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>
                <span style="font-size:14px;font-weight:700;color:#15803d">اكتمل التحميل — جاهز للتثبيت</span>
              </div>
              <button type="button" id="btnInstallUpdate" style="align-self:flex-start;padding:10px 24px;background:#16a34a;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 2v14"/><path d="M5 15l7 7 7-7"/><path d="M3 21h18"/></svg>
                تثبيت الآن
              </button>
            </div>`;
        }
        const btnInst = document.getElementById('btnInstallUpdate');
        if (btnInst) btnInst.addEventListener('click', handleInstall);
        if (btnCheck) btnCheck.disabled = false;
      }, 800);
    }

    async function handleInstall() {
      const btnInst = document.getElementById('btnInstallUpdate');
      if (btnInst) { btnInst.disabled = true; btnInst.textContent = 'جارٍ التثبيت...'; }
      if (btnCheck) btnCheck.disabled = true;
      try {
        const res = await window.api.installUpdate();
        if (res && res.success) {
          window.location.href = '/screens/installing/installing.html';
        } else {
          const errMsg = res?.message || 'فشل التثبيت';
          if (resultArea) {
            resultArea.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#dc2626;font-size:13px">
              <span>⚠️</span><span>${errMsg}</span>
            </div>`;
          }
          showToast(errMsg, 'error');
          if (btnInst) { btnInst.disabled = false; btnInst.textContent = 'تثبيت الآن'; }
          if (btnCheck) btnCheck.disabled = false;
        }
      } catch (e) {
        showToast(e.message || 'فشل التثبيت', 'error');
        if (btnInst) { btnInst.disabled = false; btnInst.textContent = 'تثبيت الآن'; }
        if (btnCheck) btnCheck.disabled = false;
      }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function showProgressPanel(title) {
      if (progressPanel) progressPanel.style.display = 'block';
      if (resultArea) resultArea.style.display = 'none';
      if (downloadSizeEl) downloadSizeEl.textContent = '';
      if (progressBar) { progressBar.style.transition = 'none'; progressBar.style.width = '0%'; }
      if (pctEl) pctEl.textContent = '0%';
      if (progressTitle) progressTitle.textContent = title || 'جارٍ التحميل...';
      const errEl = document.getElementById('updateErrorMsg');
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
      setTimeout(() => { if (progressBar) progressBar.style.transition = 'width .6s cubic-bezier(.4,0,.2,1)'; }, 50);
    }

    function hideProgressPanel() {
      clearInterval(progressPollTimer);
      if (progressPanel) progressPanel.style.display = 'none';
      if (downloadSizeEl) downloadSizeEl.textContent = '';
    }
  }

  // Check if URL hash requests update tab on load
  if (window.location.hash === '#update' && tabUpdate) {
    setPanel('update');
    initUpdatePanel();
  }


  I18N.apply();
  loadSettings();
});
