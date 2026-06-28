# PROJECT_CONTEXT — Laundry Management System

## 1. Overview
نظام إدارة مغسلة ملابس (Laundry Management System) باللغة العربية موجّه لبيئة السوق السعودي (متوافق مع ZATCA للفاتورة الإلكترونية). النظام مكوّن من خادم Node.js/Express يخدم صفحات HTML ثابتة (vanilla JS) ويتصل بقاعدة بيانات MySQL مباشرة عبر `mysql2`. يدعم نقطة البيع (POS) والاشتراكات مدفوعة مسبقًا والفواتير الآجلة والدفع الجزئي وتقارير التصدير (Excel/PDF).

- **Language / UI**: عربي (RTL) بشكل رئيسي + ترجمة إنجليزية اختيارية عبر Langbly.
- **Target deployment**: تشغيل محلي داخل المغسلة (desktop/server LAN) عبر `npm start`، المتصفح يفتح على `http://localhost:3000`. يُحزَّم كـ `.exe` بـ `@yao-pkg/pkg`.

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 + Express 4 |
| Auth | JWT (HttpOnly cookie `laundry_auth`) + bcryptjs |
| Database | **MySQL 5.7** عبر `mysql2/promise` pool — كل SQL يجب أن يكون متوافقًا مع 5.7 (لا window functions، لا CTEs) |
| Frontend | HTML ثابت + Vanilla JS + Tailwind CSS |
| PDF | `puppeteer-core` + Chrome المحلي (`pdfFromHtml.js`) + `jspdf` + `jspdf-autotable` |
| Excel | `xlsx` |
| QR (ZATCA) | `qrcode` + TLV encoding يدوي (tag 1..5) |
| Translate | Langbly API (اختياري: `LANGBLY_API_KEY`) |
| Security | `express-rate-limit` (50/15min على /login)، `cookie-parser`، CORS |
| Packaging | `@yao-pkg/pkg` → Windows `.exe` + NSSM service |

## 3. Project Structure

```
Laundry/
├── server/
│   ├── index.js              # Express app + routes /api/auth, /api/invoke, /api/export/*
│   ├── invokeHandlers.js     # Switch كبير لكل API method (159 case)
│   ├── paths.js              # APP_ROOT / DATA_ROOT resolution (pkg-aware)
│   ├── middleware/auth.js    # JWT sign/verify + authMiddleware
│   └── services/
│       ├── branding.js       # بيانات المغسلة للطباعة
│       ├── exportsService.js # Excel/PDF للمصاريف/العملاء/المنتجات/الاشتراكات
│       ├── reportHtml.js     # قوالب HTML للتقارير
│       ├── emailService.js   # إرسال البريد الإلكتروني
│       ├── reportEmailScheduler.js  # كرون البريد اليومي
│       ├── updateService.js  # GitHub Releases auto-update
│       ├── zatcaBridge.js    # ZATCA singleton
│       └── whatsappService.js # WhatsApp via Baileys
├── database/
│   └── db.js                 # كل منطق قاعدة البيانات + migrations + seeders
├── screens/                   # صفحات واجهة المستخدم
│   ├── login/                # تسجيل الدخول
│   ├── dashboard/            # لوحة التحكم (روابط سريعة)
│   ├── users/                # المستخدمون (admin فقط)
│   ├── roles/                # الأدوار والصلاحيات
│   ├── customers/            # العملاء
│   ├── services/             # خدمات المغسلة
│   ├── products/             # المنتجات + price lines
│   ├── subscriptions/        # الباقات والاشتراكات
│   ├── pos/                  # نقطة البيع
│   ├── invoices/             # قائمة الفواتير
│   ├── invoice-a4/           # صفحة طباعة A4
│   ├── payment/              # سداد الفواتير الآجلة / الجزئية
│   ├── credit-invoices/      # الفواتير الآجلة (credit notes)
│   ├── consumption-receipts/ # إيصالات الاستهلاك
│   ├── expenses/             # المصاريف
│   ├── hangers/              # الشماعات
│   ├── offers/               # العروض الترويجية
│   ├── customer-custom-prices/ # الأسعار المخصصة للعملاء
│   ├── hotels-companies/     # الفنادق والشركات (Work Orders)
│   ├── settings/             # إعدادات المغسلة
│   ├── zatca-settings/       # إعدادات ZATCA
│   ├── whatsapp/             # WhatsApp
│   ├── installing/           # شاشة التحديث
│   └── reports/              # التقارير
│       ├── daily-report/
│       ├── period-report/
│       ├── all-invoices-report/
│       ├── worker-report/
│       ├── subscriptions-report/
│       ├── zakat-report/
│       ├── types-report/
│       ├── customer-account-report/
│       ├── credit-invoices-report/
│       ├── expenses-report/
│       └── hotels-companies-report/
├── assets/
│   ├── i18n.js               # ترجمات
│   ├── web-api.js            # غلاف fetch لاستدعاء /api/invoke من الواجهة
│   ├── auth-guard.js         # حراسة الصفحات على الواجهة
│   ├── sidebar.js            # الشريط الجانبي
│   ├── tailwind.css          # ناتج البناء
│   └── fonts/
├── scripts/                  # سكربتات PowerShell للـ installer والـ updater
├── release/                  # laundry-app.exe المُبنيّ
├── ai_context/               # هذا المجلد
├── specs/                    # مواصفات الميزات (NNN-feature-name/)
├── .env / .env.example
└── package.json
```

## 4. Runtime / Config

### متغيرات البيئة (`.env`)
- `PORT` — افتراضي 3000
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `DB_NAME` — قاعدة MySQL (الافتراضي `laundry_db`)
- `JWT_SECRET` — مطلوب في الإنتاج (≥16 حرفاً)، افتراضي dev `laundry-dev-secret-change-me`
- `JWT_EXPIRES_IN` — افتراضي `7d`
- `CHROME_PATH` — اختياري لـ Puppeteer
- `LANGBLY_API_KEY` — اختياري للترجمة التلقائية

### السكربتات
- `npm start` / `npm run web` → `node server/index.js`
- `npm run build` — بناء exe + installer
- `npm run build:css` — بناء Tailwind
- `npm run watch:css` — مراقبة Tailwind

### التهيئة الذاتية للـ DB
عند `db.initialize()` يتم إنشاء قاعدة البيانات إن لم تكن موجودة، ثم تنفيذ جميع الـ migrations و seeders تلقائيًا. يُنشأ مستخدم افتراضي:
- **username**: `admin` / **password**: `admin123` / **role**: `admin`.

## 5. HTTP Endpoints

| Method | Path | Auth | الوصف |
|--------|------|------|-------|
| GET    | `/`                                           | — | إعادة توجيه إلى شاشة تسجيل الدخول |
| POST   | `/api/auth/login`                             | rate-limit | تسجيل الدخول (يضع cookie) |
| POST   | `/api/auth/logout`                            | — | تسجيل الخروج |
| GET    | `/api/auth/me`                                | ✓ | بيانات المستخدم الحالي |
| GET    | `/api/license/check`                          | — | فحص الترخيص |
| POST   | `/api/accounts/register`                      | — | تسجيل حساب تجريبي |
| GET    | `/api/accounts/trial-status`                  | — | حالة الفترة التجريبية |
| GET    | `/api/app/day-reset-hour`                     | ✓ | ساعة إعادة ضبط اليوم |
| GET    | `/api/app/support-info`                       | ✓ | معلومات الدعم |
| POST   | `/api/invoke`                                 | ✓ | الموجّه الرئيسي لكل عمليات CRUD (159 method) |
| POST   | `/api/export/expenses`                        | ✓ | Excel/PDF للمصاريف |
| POST   | `/api/export/customers`                       | ✓ | Excel/PDF للعملاء |
| POST   | `/api/export/products`                        | ✓ | Excel/PDF للمنتجات |
| POST   | `/api/export/subscriptions`                   | ✓ | Excel/PDF للاشتراكات |
| POST   | `/api/export/subscription-customer-report`    | ✓ | تقرير عميل مفصّل |
| POST   | `/api/export/subscription-receipt-pdf`        | ✓ | إيصال اشتراك PDF |
| POST   | `/api/export/invoice-pdf`                     | ✓ | فاتورة PDF |
| POST   | `/api/export/invoice-pdf-from-html`           | ✓ | فاتورة PDF من HTML |
| POST   | `/api/export/hanger-ticket`                   | ✓ | تذكرة شماعة PDF |
| POST   | `/api/export/credit-notes`                    | ✓ | إيصالات ائتمان Excel |
| POST   | `/api/export/types-report`                    | ✓ | تقرير الأنواع |
| POST   | `/api/export/report`                          | ✓ | تقرير عام |
| POST   | `/api/export/worker-report`                   | ✓ | تقرير العامل |
| POST   | `/api/export/all-invoices-report`             | ✓ | تقرير كل الفواتير |
| POST   | `/api/export/subscriptions-report`            | ✓ | تقرير الاشتراكات |
| POST   | `/api/export/zakat-report`                    | ✓ | تقرير الزكاة |
| POST   | `/api/export/customer-account-report`         | ✓ | كشف حساب العميل |
| POST   | `/api/export/hotels-companies-report`         | ✓ | تقرير الفنادق والشركات |
| POST   | `/api/export/consolidated-work-orders-list`   | ✓ | قائمة أوامر العمل المجمّعة |
| POST   | `/api/subscriptions/receipt-print-html`       | ✓ | HTML لإيصال حراري |
| POST   | `/api/print/hanger-ticket-thermal`            | ✓ | تذكرة شماعة حرارية |
| POST   | `/api/translate`                              | ✓ | ترجمة (Langbly) |

جميع طلبات `/api/*` (عدا login, license, accounts) تتطلب كوكي `laundry_auth`.

## 6. invokeHandlers — الطرق المتاحة (159 method)

استدعاء موحد `POST /api/invoke` بـ `{ method, payload }`. مصنّف حسب الشاشات:

### إعدادات التطبيق
`getAppSettings`, `saveAppSettings`, `getZatcaSettings`, `saveZatcaSettings`, `getLoyaltySettings`, `saveLoyaltySettings`, `sendTestDailyReportEmail`

### المستخدمون والأدوار
`getUsers`, `getUsersList`, `createUser`, `updateUser`, `toggleUserStatus`, `deleteUser`,
`getAllRoles`, `createRole`, `updateRole`, `deleteRole`, `saveUserPermissions`

### العملاء
`getCustomers`, `createCustomer`, `updateCustomer`, `toggleCustomerStatus`, `deleteCustomer`,
`getCorporateCustomers`, `getCustomerUnpaidInvoices`, `getCustomerLoyaltyBalance`, `getLoyaltyTransactions`

### خدمات المغسلة
`getLaundryServices`, `createLaundryService`, `updateLaundryService`, `deleteLaundryService`, `toggleLaundryServiceStatus`, `reorderLaundryService`

### المنتجات
`getProducts`, `getProduct`, `saveProduct`, `deleteProduct`, `toggleProductStatus`, `reorderProduct`,
`getProductImageById`, `getPosProductImage`, `getPosProductImages`, `getProductsForPosNoImages`, `getProductsForOffers`

### الباقات مدفوعة مسبقًا
`getPrepaidPackages`, `savePrepaidPackage`, `togglePrepaidPackage`, `deletePrepaidPackage`

### الاشتراكات
`getCustomerActiveSubscription`, `getCustomerSubscriptionsList`, `getSubscriptionDetail`,
`getSubscriptionPeriods`, `getSubscriptionLedger`, `getSubscriptionTransactions`,
`createSubscription`, `renewSubscription`, `stopSubscription`, `resumeSubscription`,
`updateActiveSubscriptionPeriod`, `deleteSubscription`,
`settleInvoicesFromSubscription`, `getDeferredBySubscription`, `getOrdersBySubscription`, `getSubscriptionInvoices`

### نقطة البيع (POS)
`getPosProducts`, `getPosServices`, `createOrder`,
`getActiveOffers`, `getActiveProductOffersForPos`,
`getCustomerPosCustomPrices`

### الفواتير والأوامر
`getOrders`, `getOrderById`, `getDeferredOrders`, `payDeferredOrder`,
`markOrderCleaned`, `markOrderDelivered`, `markReceiptCleaned`, `markReceiptDelivered`,
`getInvoiceBySeq`, `getSubscriptionInvoiceData`

### الدفعات الجزئية
`getInvoiceWithPayments`, `recordInvoicePayment`, `getPaymentHistory`

### الفواتير الآجلة (Credit Notes)
`getCreditNotes`, `getCreditNoteById`, `createCreditNote`

### الاسترجاعات
`getOrderForRefund`, `createRefund`, `searchConsumptionReceiptForRefund`, `refundConsumptionReceipt`

### إيصالات الاستهلاك
`getConsumptionReceipts`, `getConsumptionReceiptById`

### المصاريف
`getExpenses`, `getExpensesSummary`, `createExpense`, `updateExpense`, `deleteExpense`

### الشماعات (Hangers)
`getHangers`, `getAvailableHangers`, `createHanger`, `batchCreateHangers`, `updateHanger`, `deleteHanger`, `toggleHangerStatus`

### العروض الترويجية
`getOffers`, `getActiveOffers`, `createOffer`, `updateOffer`, `toggleOffer`, `deleteOffer`,
`getProductOffers`, `getProductOfferById`, `createProductOffer`, `updateProductOffer`, `toggleProductOfferStatus`, `deleteProductOffer`

### الأسعار المخصصة للعملاء
`getCustomPricesScreenData`, `saveCustomerCustomPrices`

### الفنادق والشركات (Work Orders)
`getWorkOrders`, `createWorkOrder`, `cancelWorkOrder`, `getWorkOrderForPrint`,
`markWorkOrderCleaned`, `markWorkOrderDelivered`,
`createConsolidatedInvoice`, `getConsolidatedInvoiceForPrint`, `settleConsolidatedInvoice`,
`getCorporateReportStatement`, `getCorporateReportSummary`

### أنواع المرزام
`getMerzamTypes`, `saveMerzamType`, `deleteMerzamType`

### التقارير
`getReportData`, `getWorkerReport`, `getAllInvoicesReport`, `getSubscriptionsReport`,
`getTypesReport`, `getZakatReport`, `getCustomerAccountStatement`

### WhatsApp
`whatsappConnect`, `whatsappDisconnect`, `whatsappGetStatus`, `whatsappGetQuota`, `whatsappSetQuota`,
`whatsappSendTest`, `whatsappSendInvoicePdf`, `whatsappSendInvoicePdfFromHtml`

### ZATCA
`generateZatcaQR`, `zatcaSubmitOrder`, `zatcaSubmitCreditNote`, `zatcaGetUnsentOrders`, `zatcaRetryUnsent`

### التحديثات
`getUpdateStatus`, `getUpdateProgress`, `checkForUpdate`, `downloadUpdate`, `performUpdate`, `installUpdate`

### الدعم والنظام
`getSupportStatus`, `systemRestore`

### نقاط الولاء
`getCustomerLoyaltyBalance`, `getLoyaltyTransactions`, `getLoyaltySettings`, `saveLoyaltySettings`

## 7. Database Schema (34 جدول)

| Table | Purpose |
|-------|---------|
| `users` | المستخدمون مع bcrypt |
| `roles` | الأدوار المخصصة |
| `role_permissions` | صلاحيات كل دور |
| `app_settings` | صف واحد (id=1): بيانات المغسلة، الشعار gzip، VAT، إعدادات الطباعة والبريد |
| `zatca_settings` | إعدادات ZATCA (شهادات، مفاتيح) |
| `customers` | العملاء (individual/corporate) |
| `laundry_services` | أنواع الخدمات (غسيل/كوي/...) |
| `products` | المنتجات + صورة LONGBLOB gzip |
| `product_price_lines` | سعر كل منتج × خدمة (UNIQUE constraint) |
| `prepaid_packages` | الباقات مدفوعة مسبقًا |
| `customer_subscriptions` | ارتباط عميل ↔ باقة |
| `subscription_periods` | فترات الاشتراك (active/expired/closed) |
| `subscription_ledger` | حركات الرصيد (purchase/renewal/consumption/adjustment/refund) |
| `subscription_invoices` | فواتير الاشتراكات |
| `orders` | الفواتير/الطلبات (total, paid_amount, remaining_amount, ZATCA columns) |
| `order_items` | أسطر الفاتورة |
| `invoice_payments` | الدفعات الجزئية |
| `credit_notes` | إيصالات الائتمان (الفواتير الآجلة) |
| `credit_note_items` | أسطر إيصالات الائتمان |
| `refunds` | الاسترجاعات |
| `consumption_receipts` | إيصالات الاستهلاك |
| `expenses` | المصاريف التشغيلية |
| `hangers` | الشماعات |
| `offers` | العروض الترويجية |
| `product_offers` | ربط المنتجات بالعروض |
| `product_offer_lines` | أسعار العروض لكل منتج × خدمة |
| `loyalty_transactions` | حركات نقاط الولاء |
| `merzam_types` | أنواع المرزام |
| `customer_custom_prices` | أسعار مخصصة للعملاء |
| `work_orders` | طلبات العمل (الفنادق/الشركات) |
| `work_order_items` | أسطر طلبات العمل |
| `whatsapp_quota` | حصة WhatsApp (صف واحد id=1) |
| `license` | معلومات الترخيص الدائم |
| `accounts` | حسابات التجربة (trial) |

كل الجداول `utf8mb4` / `InnoDB`. **لا window functions ولا CTEs — كل SQL متوافق مع MySQL 5.7.**

## 8. Features المنفّذة

1. **Authentication** — JWT cookie + bcrypt + rate limit.
2. **Users & Roles** — CRUD المستخدمين + نظام أدوار مخصصة + صلاحيات تفصيلية.
3. **Customers** — CRUD + بحث + ترقيم + تصدير + customer_type (individual/corporate).
4. **Laundry Services** — CRUD + تفعيل + ترتيب يدوي.
5. **Products & Pricing** — CRUD + صور gzip + أسطر أسعار لكل خدمة + lazy loading.
6. **Prepaid Packages** — تعريف الباقات + تفعيل/تعطيل.
7. **Subscriptions** — شراء/تجديد/إيقاف/استئناف/تعديل رصيد + دفتر حركة + تصفية فواتير آجلة.
8. **POS** — إنشاء فواتير + خصم تلقائي من الاشتراك + دفع مختلط (نقدي+بطاقة) + عروض.
9. **Invoices** — قائمة/تفاصيل/بحث/طباعة حرارية/A4 (ZATCA QR) + وضع الغسيل/التسليم.
10. **Deferred & Partial Payments** — فواتير آجلة + دفعات جزئية + سداد كامل.
11. **Credit Notes** — إيصالات الائتمان (مرتبطة بالفواتير الآجلة).
12. **Refunds** — استرجاع الفواتير وإيصالات الاستهلاك.
13. **Consumption Receipts** — إيصالات استهلاك الاشتراكات.
14. **Expenses** — CRUD + VAT + ملخص + تصدير.
15. **Hangers** — إدارة الشماعات + ترقيم جماعي + طباعة حرارية.
16. **Offers** — عروض بسيطة (خصم %) + عروض على المنتجات (أسعار خاصة).
17. **Customer Custom Prices** — أسعار مخصصة لكل عميل لكل منتج × خدمة.
18. **Hotels & Companies (Work Orders)** — أوامر عمل للفنادق/الشركات + فاتورة مجمّعة + كشف حساب.
19. **Loyalty Points** — نقاط ولاء: كسب عند الشراء + استرداد.
20. **Merzam Types** — إدارة أنواع المرزام.
21. **Settings** — اسم المغسلة، الشعار، الفاتورة (حراري/A4)، VAT، حقول مخصصة، إعداد البريد اليومي.
22. **ZATCA** — Phase 1 QR (TLV → base64 → SVG) + Phase 2 (submitOrder، submitCreditNote، retry scheduler).
23. **WhatsApp** — إرسال الفواتير عبر WhatsApp Baileys + إدارة الحصة.
24. **Exports & Reports** — Excel/PDF للعملاء/المصاريف/المنتجات/الاشتراكات + تقارير يومية/دورية/عامل/فنادق.
25. **Update System** — فحص GitHub Releases + تحديث تلقائي عبر Task Scheduler + NSSM.
26. **Trial & License** — ترخيص بالمعرّف الإلكتروني + فترة تجريبية IP-based.
27. **Dashboard** — لوحة روابط سريعة (بدون إحصائيات متقدمة).
28. **Translate (optional)** — ترجمة عربي→إنجليزي عبر Langbly.

## 9. Conventions

- **RTL أولاً** — الواجهة عربية، الحقول `nameAr` / `name_ar` إلزامية، والإنجليزية اختيارية.
- **Error Codes** — رموز تطبيق ثابتة (`PHONE_DUPLICATE`, `NAME_DUPLICATE`, `PHONE_INVALID`, `PHONE_TOO_LONG`) تتحوّل إلى رسائل عربية في الواجهة.
- **Monetary** — `DECIMAL(10,2)` لكل المبالغ. الخصم من الاشتراك يأخذ `min(total, credit_remaining)`.
- **IDs مرجعية**: `subscription_ref: SUB-000123`, `order_number` و `invoice_seq` عدّادان مستقلان.
- **Images** — تُخزَّن gzipped LONGBLOB في نفس الجدول. الحد الأقصى الخام 15MB.
- **MySQL 5.7** — ممنوع استخدام window functions أو CTEs أو JSON_TABLE أو LATERAL joins.
- **Security** — كل الـ APIs (عدا login) تمرّ عبر `authMiddleware`؛ الكوكي `httpOnly` و `sameSite=lax`.
- **Riyal symbol** — `<span class="sar">&#xE900;</span>` مع خط `SaudiRiyal`، لا تستخدم `﷼` أبدًا.

## 10. كيف تبدأ التطوير
1. نسخ `.env.example` إلى `.env` وتعبئته.
2. تشغيل MySQL محليًا (5.7+).
3. `npm install` → `npm run build:css` → `npm start`.
4. الدخول بـ `admin / admin123`.
