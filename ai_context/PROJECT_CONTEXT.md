# PROJECT_CONTEXT — Laundry Management System

## 1. Overview
نظام إدارة مغسلة ملابس (Laundry Management System) باللغة العربية موجّه لبيئة السوق السعودي (متوافق مع ZATCA للفاتورة الإلكترونية). النظام مكوّن من خادم Node.js/Express يخدم صفحات HTML ثابتة (vanilla JS) ويتصل بقاعدة بيانات MySQL مباشرة عبر `mysql2`. يدعم نقطة البيع (POS) والاشتراكات مدفوعة مسبقًا والفواتير الآجلة والدفع الجزئي وتقارير التصدير (Excel/PDF).

- **Language / UI**: عربي (RTL) بشكل رئيسي + ترجمة إنجليزية اختيارية عبر Langbly.
- **Target deployment**: تشغيل محلي داخل المغسلة (desktop/server LAN) عبر `npm run web`، المتصفح يفتح على `http://localhost:3000`.

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + Express 4 |
| Auth | JWT (HttpOnly cookie `laundry_auth`) + bcryptjs |
| Database | MySQL 8 عبر `mysql2/promise` pool (10 connections) |
| Frontend | HTML ثابت + Vanilla JS + Tailwind CSS 4 (عبر `@tailwindcss/cli`) |
| PDF | `puppeteer-core` + Chrome المحلي (`pdfFromHtml.js`) + `jspdf` + `jspdf-autotable` |
| Excel | `xlsx` |
| QR (ZATCA) | `qrcode` + TLV encoding يدوي (tag 1..5) |
| Translate | Langbly API (اختياري: `LANGBLY_API_KEY`) |
| Security | `express-rate-limit` (50/15min على /login)، `cookie-parser`، CORS |

## 3. Project Structure

```
Laundry/
├── server/
│   ├── index.js              # Express app + routes /api/auth, /api/invoke, /api/export/*
│   ├── invokeHandlers.js     # Switch كبير لكل API method (getUsers, createOrder, ...)
│   ├── pdfFromHtml.js        # تحويل HTML إلى PDF عبر Puppeteer
│   ├── middleware/auth.js    # JWT sign/verify + authMiddleware
│   └── services/
│       ├── branding.js       # بيانات المغسلة للطباعة
│       ├── exportsService.js # Excel/PDF للمصاريف/العملاء/المنتجات/الاشتراكات
│       └── reportHtml.js     # قوالب HTML للتقارير
├── database/
│   └── db.js                 # كل منطق قاعدة البيانات + migrations + seeders (≈2944 سطر)
├── screens/                   # صفحات واجهة المستخدم
│   ├── login/                # تسجيل الدخول
│   ├── dashboard/            # لوحة التحكم
│   ├── customers/            # العملاء
│   ├── services/             # خدمات المغسلة (غسيل/كوي/...)
│   ├── products/             # المنتجات (قطع الملابس) + price lines
│   ├── subscriptions/        # الباقات مدفوعة مسبقًا والاشتراكات
│   ├── pos/                  # نقطة البيع
│   ├── invoices/             # قائمة الفواتير + تفاصيلها
│   ├── invoice-a4/           # صفحة طباعة A4
│   ├── payment/              # سداد الفواتير الآجلة / الجزئية
│   ├── expenses/             # المصاريف
│   ├── settings/             # إعدادات المغسلة (شعار/VAT/عنوان/طباعة)
│   └── users/                # المستخدمون (admin فقط)
├── assets/
│   ├── i18n.js               # ترجمات
│   ├── web-api.js            # غلاف fetch لاستدعاء /api/invoke من الواجهة
│   ├── auth-guard.js         # حراسة الصفحات على الواجهة
│   ├── qrcode-min.js
│   ├── tailwind.css          # ناتج البناء
│   ├── input.css             # مدخلات tailwind
│   └── fonts/
├── ai_context/               # هذا المجلد
├── .env / .env.example
├── tailwind.config.js
└── package.json              # سكربتات: start, web, build:css, watch:css
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
- `npm run web` / `npm start` → `node server/index.js`
- `npm run build:css` — بناء Tailwind
- `npm run watch:css` — مراقبة Tailwind

### التهيئة الذاتية للـ DB
عند `db.initialize()` يتم إنشاء قاعدة البيانات إن لم تكن موجودة، ثم تنفيذ جميع الـ migrations و seeders تلقائيًا (users, laundry_services, app_settings, …). يُنشأ مستخدم افتراضي:
- **username**: `admin` / **password**: `admin123` / **role**: `admin`.

## 5. HTTP Endpoints

| Method | Path | Auth | الوصف |
|--------|------|------|-------|
| GET    | `/`                                           | — | إعادة توجيه إلى شاشة تسجيل الدخول |
| POST   | `/api/auth/login`                             | rate-limit | تسجيل الدخول (يضع cookie) |
| POST   | `/api/auth/logout`                            | — | تسجيل الخروج |
| GET    | `/api/auth/me`                                | ✓ | بيانات المستخدم الحالي |
| POST   | `/api/invoke`                                 | ✓ | الموجّه الرئيسي لكل عمليات CRUD (انظر §6) |
| POST   | `/api/export/expenses`                        | ✓ | Excel/PDF للمصاريف |
| POST   | `/api/export/customers`                       | ✓ | Excel/PDF للعملاء |
| POST   | `/api/export/products`                        | ✓ | Excel/PDF للمنتجات |
| POST   | `/api/export/subscriptions`                   | ✓ | Excel/PDF للاشتراكات |
| POST   | `/api/export/subscription-customer-report`    | ✓ | تقرير عميل مفصّل |
| POST   | `/api/export/subscription-receipt-pdf`        | ✓ | إيصال اشتراك PDF |
| POST   | `/api/subscriptions/receipt-print-html`       | ✓ | HTML لإيصال حراري |
| POST   | `/api/translate`                              | ✓ | ترجمة (Langbly) |

جميع طلبات `/api/*` (عدا login) تتطلب كوكي `laundry_auth`.

## 6. invokeHandlers — الطرق المتاحة (method)
استدعاء موحد `POST /api/invoke` بـ `{ method, payload }`. مصنّف حسب الشاشات:

- **App Settings**: `getAppSettings`, `saveAppSettings`
- **Users**: `getUsers`, `createUser`, `updateUser`, `toggleUserStatus`, `deleteUser`
- **Customers**: `getCustomers`, `createCustomer`, `updateCustomer`, `toggleCustomerStatus`, `deleteCustomer`
- **Expenses**: `getExpenses`, `getExpensesSummary`, `createExpense`, `updateExpense`, `deleteExpense`
- **Laundry Services**: `getLaundryServices`, `createLaundryService`, `updateLaundryService`, `deleteLaundryService`, `toggleLaundryServiceStatus`, `reorderLaundryService`
- **Products**: `getProducts`, `getProduct`, `saveProduct`, `deleteProduct`, `toggleProductStatus`, `reorderProduct`
- **Prepaid Packages**: `getPrepaidPackages`, `savePrepaidPackage`, `togglePrepaidPackage`, `deletePrepaidPackage`
- **Subscriptions**: `getCustomerActiveSubscription`, `getCustomerSubscriptionsList`, `getSubscriptionDetail`, `getSubscriptionPeriods`, `getSubscriptionLedger`, `createSubscription`, `renewSubscription`, `stopSubscription`, `resumeSubscription`, `updateActiveSubscriptionPeriod`, `deleteSubscription`
- **POS / Orders**: `getPosProducts`, `getPosProductImage`, `getPosServices`, `createOrder`, `getOrders`, `getOrdersBySubscription`, `getSubscriptionInvoices`, `getOrderById`, `getDeferredOrders`, `payDeferredOrder`, `markOrderCleaned`, `markOrderDelivered`
- **Invoice Payments**: `getInvoiceWithPayments`, `recordInvoicePayment`, `getPaymentHistory`
- **ZATCA**: `generateZatcaQR` (TLV → base64 → QR SVG)

## 7. Database Schema (الجداول الرئيسية)

| Table | Purpose |
|-------|---------|
| `users` | المستخدمون (admin/cashier) مع bcrypt |
| `app_settings` | صف واحد (id=1) يحتوي بيانات المغسلة، الشعار (LONGBLOB مضغوط gzip)، VAT، حقول طباعة مخصصة |
| `customers` | العملاء (subscription_number اختياري، phone unique، address/city مطلوب) |
| `laundry_services` | خدمات المغسلة (غسيل عادي/مستعجل/كوي/…) |
| `products` | القطع (ثوب/قميص…) + صورة LONGBLOB gzip |
| `product_price_lines` | سعر كل منتج لكل خدمة (UNIQUE(product_id, laundry_service_id)) |
| `prepaid_packages` | الباقات مدفوعة مسبقًا (prepaid_price, service_credit_value, duration_days) |
| `customer_subscriptions` | ارتباط عميل ↔ باقة حالية + subscription_ref (`SUB-000123`) |
| `subscription_periods` | الفترة الحالية/السابقة بحالة `active/expired/closed` + credit_remaining |
| `subscription_ledger` | حركات الرصيد (purchase/renewal/consumption/adjustment/refund) |
| `expenses` | المصاريف التشغيلية (قابلة للضريبة) |
| `orders` | الفواتير (total, paid_amount, remaining_amount, payment_status, payment_method, invoice_seq) |
| `order_items` | أسطر الفاتورة (product × service × quantity × unit_price) |
| `invoice_payments` | الدفعات الجزئية على فاتورة |

كل الجداول `utf8mb4` / `InnoDB`. يُعاد ضبط `subscription_periods.status = expired` تلقائيًا في كل قراءة عند انتهاء `period_to`.

## 8. Features (باختصار)
1. **Authentication** — JWT cookie + bcrypt + rate limit.
2. **Dashboard** — لوحة عرض مبدئية.
3. **Users Management** — (admin) إدارة المستخدمين.
4. **Customers Management** — CRUD + بحث + ترقيم صفحات + تصدير.
5. **Laundry Services** — CRUD + تفعيل + ترتيب يدوي.
6. **Products & Pricing** — CRUD + صور gzip + أسطر أسعار لكل خدمة.
7. **Prepaid Packages** — تعريف الباقات.
8. **Subscriptions** — شراء/تجديد/إيقاف/استئناف/تعديل رصيد + دفتر حركة.
9. **POS** — إنشاء فواتير + خصم تلقائي من الاشتراك النشط.
10. **Invoices** — قائمة/تفاصيل/فواتير الاشتراكات/طباعة حرارية/A4 (ZATCA QR).
11. **Deferred & Partial Payment** — فواتير آجلة + دفعات جزئية. في تبويب الفواتير الآجلة داخل POS: البحث برقم فاتورة (رقم قصير) يعرض الفاتورة بغض النظر عن فلتر الحالة.
12. **Expenses** — CRUD + VAT + ملخص + تصدير.
13. **Settings (App)** — اسم المغسلة، الشعار، الفاتورة (حراري/A4)، VAT، حقول مخصصة.
14. **Exports** — Excel (`xlsx`) و PDF (`puppeteer-core` من HTML) للمصاريف/العملاء/المنتجات/الاشتراكات/إيصالات.
15. **ZATCA QR** — Phase 1 (Simplified) TLV → base64 → QR SVG.
16. **Translate (optional)** — ترجمة عربي→إنجليزي عبر Langbly.

## 9. Conventions

- **RTL أولاً** — الواجهة عربية، الحقول `nameAr` / `name_ar` إلزامية، والإنجليزية اختيارية.
- **Error Codes** — رموز تطبيق ثابتة (`PHONE_DUPLICATE`, `NAME_DUPLICATE`, `PHONE_INVALID`, `PHONE_TOO_LONG`) يتم تحويلها إلى رسائل عربية في الواجهة.
- **Arabic Digit Normalization** — `normalizeCustomerPhoneDigits` يحوّل الأرقام الهندية/الفارسية إلى ASCII قبل الحفظ.
- **Monetary** — `DECIMAL(10,2)` لكل المبالغ. الخصم من الاشتراك يأخذ `min(total, credit_remaining)`.
- **IDs مرجعية**:
  - `subscription_ref`: `SUB-000123`
  - `order_number`: رقم تسلسلي من `MAX(order_number)+1`
  - `invoice_seq`: عدّاد موازٍ مستقل
  - `customers.subscription_number`: يُعيَّن تلقائيًا عند أول اشتراك فقط.
- **Images** — تُخزّن gzipped LONGBLOB في نفس الجدول (products.image_blob, app_settings.logo_blob). الحد الأقصى الخام 15MB.
- **Security** — كل الـ APIs (عدا login) تمرّ عبر `authMiddleware`؛ الكوكي `httpOnly` و `sameSite=lax`.

## 10. كيف تبدأ التطوير
1. نسخ `.env.example` إلى `.env` وتعبئته.
2. تشغيل MySQL محليًا.
3. `npm install` → `npm run build:css` → `npm run web`.
4. الدخول بـ `admin / admin123`.

## 11. ملفات سياق سابقة (plans)
هناك خطط سابقة بجانب الريبو (تم تنفيذها إلى حد كبير): `a4_invoice_plan.md`, `deferred_invoices_tab_plan.md`, `partial_payment_plan.md`, `expenses-screen-plan*.md`, `pos_screen_plan.md`, `plan_customers_screen.md`, `plan_export_customers.md`, `plan_laundry_services.md`, `SUBSCRIPTION_END_DATE_CHANGES.md`, `FIX_ARABIC_NUMBERS_IN_DATES.md`. يمكن الرجوع إليها للاختيارات التاريخية فقط.
