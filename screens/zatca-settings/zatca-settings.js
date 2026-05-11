window.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const btnSave = document.getElementById('btnSave');
  const status = document.getElementById('statusToast');

  const els = {
    companyName: document.getElementById('companyName'),
    vatNumber: document.getElementById('vatNumber'),
    commercialRegistration: document.getElementById('commercialRegistration'),
    businessCategory: document.getElementById('businessCategory'),
    branchName: document.getElementById('branchName'),
    email: document.getElementById('email'),
    street: document.getElementById('street'),
    building: document.getElementById('building'),
    city: document.getElementById('city'),
    postalCode: document.getElementById('postalCode'),
    district: document.getElementById('district'),
    localApiEndpoint: document.getElementById('localApiEndpoint'),
    localApiParamName: document.getElementById('localApiParamName'),
    localApiParamAliases: document.getElementById('localApiParamAliases'),
    localApiPreferredMode: document.getElementById('localApiPreferredMode'),
    localApiEnableTextPlain: document.getElementById('localApiEnableTextPlain'),
  };

  let _statusTimer = null;

  function setStatus(msg, isError) {
    clearTimeout(_statusTimer);
    if (!msg) { status.classList.remove('show'); return; }
    status.textContent = msg;
    status.className = 'status-toast show ' + (isError ? 'toast-error' : 'toast-success');
    _statusTimer = setTimeout(() => { status.classList.remove('show'); }, 3000);
  }

  function applyForm(s) {
    els.companyName.value = s.companyName || '';
    els.vatNumber.value = s.vatNumber || '';
    els.commercialRegistration.value = s.commercialRegistration || '';
    els.businessCategory.value = s.businessCategory || 'Supply activities';
    els.branchName.value = s.branchName || '';
    els.email.value = s.email || '';

    const addr = s.address && typeof s.address === 'object' ? s.address : {};
    els.street.value = addr.street || '';
    els.building.value = addr.building || '';
    els.city.value = addr.city || 'الرياض';
    els.postalCode.value = addr.postalCode || '';
    els.district.value = addr.district || '';

    const localApi = s.localApi && typeof s.localApi === 'object' ? s.localApi : {};
    els.localApiEndpoint.value = localApi.endpoint || 'http://localhost:8080/zatca_2/api/customerInvoice/submitInvoice';
    els.localApiParamName.value = localApi.paramName || 'invoiceJO';
    els.localApiPreferredMode.value = localApi.preferredMode || 'form';
    els.localApiEnableTextPlain.checked = localApi.enableTextPlain === true;
    const aliases = Array.isArray(localApi.paramAliases) ? localApi.paramAliases : [];
    els.localApiParamAliases.value = aliases.length
      ? aliases.join(',')
      : 'invoiceJO,invoiceIO,invoiceIo,invoiceJson,invoice,data,payload';
  }

  function buildPayload() {
    const aliases = (els.localApiParamAliases.value || '')
      .split(',')
      .map(x => String(x || '').trim())
      .filter(Boolean);
    return {
      companyName: els.companyName.value,
      vatNumber: els.vatNumber.value,
      commercialRegistration: els.commercialRegistration.value,
      businessCategory: els.businessCategory.value,
      branchName: els.branchName.value,
      email: els.email.value,
      address: {
        street: els.street.value,
        building: els.building.value,
        city: els.city.value,
        postalCode: els.postalCode.value,
        district: els.district.value,
      },
      localApi: {
        endpoint: (els.localApiEndpoint.value || '').trim() || 'http://localhost:8080/zatca_2/api/customerInvoice/submitInvoice',
        paramName: els.localApiParamName.value,
        paramAliases: aliases,
        preferredMode: els.localApiPreferredMode.value,
        enableTextPlain: els.localApiEnableTextPlain.checked,
      },
    };
  }

  async function load() {
    const res = await window.api.getZatcaSettings();
    if (!res || !res.success) {
      setStatus(res?.message || I18N.t('zatca-settings-err-load'), true);
      return;
    }
    applyForm(res.settings || {});
  }

  async function save() {
    btnSave.disabled = true;
    try {
      const res = await window.api.saveZatcaSettings(buildPayload());
      if (!res || !res.success) {
        setStatus(res?.message || I18N.t('zatca-settings-err-save'), true);
        return;
      }
      setStatus(I18N.t('zatca-settings-success-save'), false);
      await load();
    } catch (e) {
      setStatus(e.message || I18N.t('zatca-settings-err-save'), true);
    } finally {
      btnSave.disabled = false;
    }
  }

  btnBack.addEventListener('click', () => window.api.navigateBack());
  btnSave.addEventListener('click', save);

  I18N.apply();
  load();
});
