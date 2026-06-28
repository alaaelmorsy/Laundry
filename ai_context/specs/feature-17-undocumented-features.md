# Feature 17 — ميزات منفذة غير موثّقة مسبقًا

هذا الملف يوثّق الميزات المنفذة الكاملة التي لم تكن لها specs مستقلة. كل ميزة موثّقة هنا مستخرجة مباشرة من الكود.

---

## A. Roles & Permissions (الأدوار والصلاحيات)

**الشاشة**: `screens/roles/`
**DB Tables**: `roles`, `role_permissions`
**API Methods**: `getAllRoles`, `createRole`, `updateRole`, `deleteRole`, `saveUserPermissions`

- `admin` يتجاوز كل الفحوصات (built-in).
- الأدوار المخصصة تُنشأ عبر `createRole` وتُحدَّث صلاحياتها عبر `saveUserPermissions`.
- الفحوصات client-side عبر `data-permission` attributes + `auth-guard.js`.

---

## B. Hangers (الشماعات)

**الشاشة**: `screens/hangers/`
**DB Table**: `hangers`
**API Methods**: `getHangers`, `getAvailableHangers`, `createHanger`, `batchCreateHangers`, `updateHanger`, `deleteHanger`, `toggleHangerStatus`
**Export**: `exportHangerTicket` (PDF)، `printHangerTicketThermal` (حراري)

- `batchCreateHangers({ from, to, prefix })` — إنشاء جماعي بنطاق أرقام.
- `hanger_status`: `available` أو `in_use`.
- الطباعة الحرارية عبر `/api/print/hanger-ticket-thermal`.
- PDF عبر `/api/export/hanger-ticket`.

---

## C. Offers & Product Offers (العروض)

**الشاشة**: `screens/offers/`
**DB Tables**: `offers`, `product_offers`, `product_offer_lines`
**API Methods**:
- `getOffers`, `getActiveOffers`, `createOffer`, `updateOffer`, `toggleOffer`, `deleteOffer`
- `getProductOffers`, `getProductOfferById`, `createProductOffer`, `updateProductOffer`, `toggleProductOfferStatus`, `deleteProductOffer`
- `getActiveProductOffersForPos`

**نوعان**:
1. **Offers** (`offers`): خصم نسبي (%) على إجمالي الفاتورة. له `valid_from` / `valid_to`.
2. **Product Offers** (`product_offers` + `product_offer_lines`): أسعار خاصة لكل منتج × خدمة.

في POS: `getActiveOffers` + `getActiveProductOffersForPos` تُرجع العروض النشطة فقط ضمن التاريخ الصالح.

---

## D. Customer Custom Prices (الأسعار المخصصة)

**الشاشة**: `screens/customer-custom-prices/`
**DB Table**: `customer_custom_prices`
**API Methods**: `getCustomPricesScreenData`, `saveCustomerCustomPrices`, `getCustomerPosCustomPrices`

- أسعار مخصصة لكل عميل لكل منتج × خدمة.
- في POS: `getCustomerPosCustomPrices(customerId)` تتجاوز الأسعار الافتراضية.

---

## E. Work Orders & Hotels/Companies (الفنادق والشركات)

**الشاشة**: `screens/hotels-companies/`
**DB Tables**: `work_orders`, `work_order_items`
**API Methods**:
- `getWorkOrders`, `createWorkOrder`, `cancelWorkOrder`, `getWorkOrderForPrint`
- `markWorkOrderCleaned`, `markWorkOrderDelivered`
- `createConsolidatedInvoice`, `getConsolidatedInvoiceForPrint`, `settleConsolidatedInvoice`
- `getCorporateCustomers`, `getCorporateReportStatement`, `getCorporateReportSummary`
**Report Screen**: `screens/reports/hotels-companies-report/`
**Export**: `exportHotelsCompaniesReport`, `exportConsolidatedWorkOrdersList`

- مرتبط بعملاء `customer_type = 'corporate'`.
- `getCorporateCustomers` — فلترة العملاء الشركات.
- **Consolidated Invoice**: تجميع أوامر عمل متعددة في فاتورة واحدة (`createConsolidatedInvoice`).
- `settleConsolidatedInvoice` — تسوية الفاتورة المجمّعة.
- `getCorporateReportStatement` — كشف حساب تفصيلي.
- `getCorporateReportSummary` — ملخص.

---

## F. Loyalty Points (نقاط الولاء)

**DB Table**: `loyalty_transactions`
**API Methods**: `getCustomerLoyaltyBalance`, `getLoyaltyTransactions`, `getLoyaltySettings`, `saveLoyaltySettings`

**الإعدادات محفوظة في `app_settings` (id=1)**، أعمدة مضافة بـ migration:
- `loyalty_enabled` — تفعيل/تعطيل النظام
- `loyalty_points_per_sar` — نقاط مكتسبة لكل ريال (افتراضي 1)
- `loyalty_sar_per_point` — قيمة النقطة بالريال عند الاسترداد (افتراضي 0.05)
- `loyalty_expiry_date` — تاريخ انتهاء النقاط (اختياري، صيغة `YYYY-MM-DD`)

حقول مضافة على `orders`:
- `loyalty_points_earned` — النقاط المكتسبة من هذه الفاتورة
- `loyalty_points_redeemed` — النقاط المستردة في هذه الفاتورة
- `loyalty_discount_amount` — قيمة الخصم بالريال من الاسترداد

- `transaction_type`: `earn` عند الشراء, `redeem` عند الاسترداد.
- `getCustomerLoyaltyBalance(customerId)` — رصيد النقاط الحالي.
- `getLoyaltyTransactions(customerId)` — تاريخ الحركات.

---

## G. Merzam Types (أنواع المرزام)

**DB Table**: `merzam_types`
**API Methods**: `getMerzamTypes`, `saveMerzamType`, `deleteMerzamType`

- قائمة أنواع المرزام المستخدمة في بعض المنتجات أو الفواتير.

---

## H. WhatsApp

**الشاشة**: `screens/whatsapp/`
**DB Table**: `whatsapp_quota`
**API Methods**: `whatsappConnect`, `whatsappDisconnect`, `whatsappGetStatus`, `whatsappGetQuota`, `whatsappSetQuota`, `whatsappSendTest`, `whatsappSendInvoicePdf`, `whatsappSendInvoicePdfFromHtml`
**Service**: `server/services/whatsappService.js` (Baileys)

- `whatsapp_quota` (صف واحد id=1): `used_count`, `max_quota`.
- الجلسة محفوظة في `DATA_ROOT/data/whatsapp_session/`.
- `whatsappSendInvoicePdf(orderId)` — إرسال فاتورة PDF لرقم العميل.
- `whatsappSendInvoicePdfFromHtml(html, phone)` — إرسال من HTML مباشرة.

---

## I. Update System (نظام التحديث)

**الشاشة**: `screens/installing/`
**API Methods**: `getUpdateStatus`, `getUpdateProgress`, `checkForUpdate`, `downloadUpdate`, `performUpdate`, `installUpdate`
**Service**: `server/services/updateService.js`

- `checkForUpdate` — يفحص GitHub Releases API.
- `downloadUpdate` — تنزيل الـ exe الجديد + SHA256 verify.
- `performUpdate` / `installUpdate` — تشغيل Task Scheduler → `updater.ps1` → rename exe → NSSM restart.
- التقدم يُتتبع في `DATA_ROOT/data/update-status.json` ويُستطلع من `screens/installing/`.
- **لا تستخدم `spawn(detached: true)`** — NSSM Job Object يقتل العمليات المنفصلة.

---

## J. Trial & License (الترخيص)

**DB Tables**: `license`, `accounts`
**Endpoints**: `/api/license/check`, `/api/accounts/register`, `/api/accounts/trial-status`

- **Serial License**: يعتمد على disk serial + MAC + motherboard serial vs `license` table.
- **Trial**: IP-based عبر `accounts` table.
- هذه الـ endpoints لا تمرّ عبر `/api/invoke` — لها routes مستقلة في `server/index.js`.

---

## K. Credit Notes & Refunds (الفواتير الآجلة والاسترجاعات)

**الشاشة**: `screens/credit-invoices/`
**DB Tables**: `credit_notes`, `credit_note_items`, `refunds`
**API Methods**: `getCreditNotes`, `getCreditNoteById`, `createCreditNote`, `getOrderForRefund`, `createRefund`, `searchConsumptionReceiptForRefund`, `refundConsumptionReceipt`
**Export**: `exportCreditNotes`

- `credit_notes` مرتبطة بـ `orders` (الفواتير الآجلة).
- `createCreditNote` — إنشاء إيصال ائتمان بعد الفاتورة.
- `createRefund` — استرجاع فاتورة بالكامل أو جزئيًا.
- `refundConsumptionReceipt` — استرجاع إيصال استهلاك (يُعيد الرصيد للاشتراك).
