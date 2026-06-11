const zlib = require('zlib');
const db = require('../../database/db');

async function loadAppBrandingForReceipts() {
  try {
    const s = await db.getAppSettings();
    let logoDataUrl = '';
    if (s.logoGzipBuffer && s.logoGzipBuffer.length) {
      try {
        const raw = zlib.gunzipSync(s.logoGzipBuffer);
        logoDataUrl = `data:${s.logoMime || 'image/png'};base64,${raw.toString('base64')}`;
      } catch (_) {
        logoDataUrl = '';
      }
    }
    const customFields = Array.isArray(s.customFields) ? s.customFields : [];
    return {
      laundryNameAr: s.laundryNameAr || '',
      laundryNameEn: s.laundryNameEn || '',
      logoDataUrl,
      vatNumber: s.vatNumber || '',
      commercialRegister: s.commercialRegister || '',
      buildingNumber: s.buildingNumber || '',
      streetNameAr: s.streetNameAr || '',
      districtAr: s.districtAr || '',
      cityAr: s.cityAr || '',
      postalCode: s.postalCode || '',
      additionalNumber: s.additionalNumber || '',
      phone: s.phone || '',
      email: s.email || '',
      locationAr: s.locationAr || '',
      locationEn: s.locationEn || '',
      customFields
    };
  } catch (_) {
    return {
      laundryNameAr: '',
      laundryNameEn: '',
      logoDataUrl: '',
      vatNumber: '',
      commercialRegister: '',
      buildingNumber: '',
      streetNameAr: '',
      districtAr: '',
      cityAr: '',
      postalCode: '',
      additionalNumber: '',
      phone: '',
      email: '',
      locationAr: '',
      locationEn: '',
      customFields: []
    };
  }
}

module.exports = { loadAppBrandingForReceipts };
