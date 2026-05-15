window.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const tabLaundry = document.getElementById('tabLaundry');
  const tabTax = document.getElementById('tabTax');
  const tabPrinter = document.getElementById('tabPrinter');
  const tabReportEmail = document.getElementById('tabReportEmail');
  const panelLaundry = document.getElementById('panelLaundry');
  const panelTax = document.getElementById('panelTax');
  const panelPrinter = document.getElementById('panelPrinter');
  const panelReportEmail = document.getElementById('panelReportEmail');
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
    requireHanger: document.getElementById('requireHanger'),
    requireCustomerPhone: document.getElementById('requireCustomerPhone'),
    allowSubscriptionDebt: document.getElementById('allowSubscriptionDebt'),
    barcodeAutoAction: document.getElementById('barcodeAutoAction'),
    barcodeAutoPay: document.getElementById('barcodeAutoPay'),
    barcodeAutoClean: document.getElementById('barcodeAutoClean'),
    barcodeAutoDeliver: document.getElementById('barcodeAutoDeliver'),
    showBarcodeInInvoice: document.getElementById('showBarcodeInInvoice'),
    zatcaEnabled
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
    [tabLaundry, tabTax, tabPrinter, tabReportEmail].forEach((t) => {
      if (!t) return;
      t.classList.toggle('active', t.dataset.panel === name);
    });
    panelLaundry.classList.toggle('active', name === 'laundry');
    panelTax.classList.toggle('active', name === 'tax');
    panelPrinter.classList.toggle('active', name === 'printer');
    if (panelReportEmail) panelReportEmail.classList.toggle('active', name === 'reportEmail');
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
    if (reportEmailModal) reportEmailModal.style.display = 'flex';
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
    if (fields.requireHanger) fields.requireHanger.checked = s.requireHanger === true;
    if (fields.requireCustomerPhone) fields.requireCustomerPhone.checked = s.requireCustomerPhone === true;
    if (fields.allowSubscriptionDebt) fields.allowSubscriptionDebt.checked = s.allowSubscriptionDebt === true;
    if (fields.showBarcodeInInvoice) fields.showBarcodeInInvoice.checked = s.showBarcodeInInvoice !== false;
    if (fields.zatcaEnabled) fields.zatcaEnabled.checked = s.zatcaEnabled === true;
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
      <div class="fld">
        <label class="flbl" data-i18n="settings-custom-value"></label>
        <div class="fwrap"><input type="text" class="finp cf-value" /></div>
      </div>
      <div>
        <button type="button" class="btn-danger btn-remove-cf" data-i18n="settings-custom-remove"></button>
      </div>
    `;
    row.querySelector('.cf-label-ar').value = cf.labelAr || '';
    row.querySelector('.cf-label-en').value = cf.labelEn || '';
    row.querySelector('.cf-value').value = cf.value || '';
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
        labelEn: row.querySelector('.cf-label-en')?.value?.trim() || '',
        value: row.querySelector('.cf-value')?.value?.trim() || ''
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
      requireHanger: fields.requireHanger ? fields.requireHanger.checked : false,
      requireCustomerPhone: fields.requireCustomerPhone ? fields.requireCustomerPhone.checked : false,
      allowSubscriptionDebt: fields.allowSubscriptionDebt ? fields.allowSubscriptionDebt.checked : false,
      showBarcodeInInvoice: fields.showBarcodeInInvoice ? fields.showBarcodeInInvoice.checked : true,
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
      zatcaEnabled: fields.zatcaEnabled ? fields.zatcaEnabled.checked : false
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

  // إغلاق القائمة عند الضغط خارجها
  document.addEventListener('click', (e) => {
    if (!paymentTrigger.contains(e.target) && !paymentMenu.contains(e.target)) {
      closePaymentMenu();
    }
  });

  I18N.apply();
  loadSettings();
});
