# Feature 12 — Application Settings (Branding, VAT, Print, ZATCA)

## Goal
ضبط بيانات المغسلة التي تظهر على الفواتير (شعار، اسم، عنوان، VAT، طباعة، ZATCA) وحقول مخصصة إضافية.

## Entry points
- UI: `screens/settings/settings.html|js`
- API: `getAppSettings`, `saveAppSettings`.

## Inputs
- `saveAppSettings` payload يدعم كل الحقول التالية:
  - `laundryNameAr`, `laundryNameEn`, `locationAr`, `locationEn`, `phone`, `email`, `invoiceNotes`.
  - ZATCA: `vatRate`, `vatNumber`, `commercialRegister`, `buildingNumber`, `streetNameAr`, `districtAr`, `cityAr`, `postalCode`, `additionalNumber`.
  - Printing: `priceDisplayMode` ∈ `inclusive|exclusive`، `invoicePaperType` ∈ `thermal|a4`، `logoWidth`, `logoHeight`, `printCopies`.
  - Payment: `enabledPaymentMethods`, `defaultPaymentMethod`.
  - Logo: `imageBase64` + `imageMime` **أو** `removeLogo=true`.
  - `customFields`: مصفوفة (≤ 20 عنصر).

## Outputs
- `getAppSettings` → `{ settings: { ...rest, logoMime, logoDataUrl } }` (لا يُرجَع الـ blob الخام).

## Rules
- صف واحد بـ `id=1`.
- `vat_rate` افتراضي 15.00 (KSA).
- `logo_width/height` افتراضي 180×70.
- `print_copies` افتراضي 1.
- حجم الشعار raw max 15 MB، يُخزَّن gzip level 9.
- `price_display_mode` الافتراضي `exclusive`.
- `invoice_paper_type` الافتراضي `thermal`.

## Edge cases
- `removeLogo=true` يتجاوز `imageBase64` حتى لو مُرسَل.
- `custom_fields_json` يتجاوز 20 عنصر → يجب رفضه (المسؤولية في الواجهة + حد ثابت `MAX_APP_SETTINGS_CUSTOM_FIELDS`).
- قيم ZATCA الفارغة مقبولة لكن QR قد يُرفض من DZAT Validator.
- تغيير `price_display_mode` لا يؤثر على الفواتير القديمة (الحقل محفوظ على الفاتورة نفسها).
