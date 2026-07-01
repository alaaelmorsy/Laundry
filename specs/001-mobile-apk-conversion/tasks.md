# Tasks: تحويل نظام المغاسل إلى تطبيق Flutter موبايل

**Input**: Design documents from `specs/001-mobile-apk-conversion/`

**Tech Stack**: Flutter 3.x + Dart + drift (SQLite) + Riverpod + GoRouter

**Target Folder**: `D:\PLUS\Laundry-apk\`

**User Stories**:
- US1 (P1): تسجيل الدخول + دورة بيع كاملة (MVP)
- US2 (P1): ترحيل البيانات MySQL → SQLite
- US3 (P2): إدارة الاشتراكات
- US4 (P2): طباعة الإيصالات Bluetooth
- US5 (P3): التقارير والإحصائيات

## Format: `[ID] [P?] [Story?] Description`

---

## Phase 1: Setup — هيكل المشروع

**Purpose**: إنشاء مشروع Flutter وإعداد البنية الأساسية

- [ ] T001 إنشاء مشروع Flutter في `D:\PLUS\Laundry-apk` بالأمر: `flutter create laundry_apk --org com.plus.laundry`
- [ ] T002 تحديث `pubspec.yaml` بجميع الـ dependencies (drift, riverpod, go_router, esc_pos_bluetooth, flutter_secure_storage, http, connectivity_plus, intl, share_plus, pdf, printing, image)
- [ ] T003 [P] إنشاء هيكل المجلدات الكامل: `lib/core/`, `lib/domain/`, `lib/data/`, `lib/presentation/`, `lib/screens/`, `lib/shared/`, `test/unit/`, `test/integration/`, `test/golden/`, `tools/migrate/`, `docs/`
- [ ] T004 [P] إنشاء `lib/core/utils/money.dart` — `extension Money on int` للتحويل بين cents وعرض الريال (لا double أبداً)
- [ ] T005 [P] إنشاء `lib/core/utils/arabic_digits.dart` — تحويل أرقام عربية/فارسية إلى ASCII
- [ ] T006 [P] إنشاء `lib/core/utils/date_format.dart` — تنسيق التواريخ بصيغة ISO8601 وعرضها
- [ ] T007 [P] إنشاء `lib/core/utils/validators.dart` — validation للهاتف، المبالغ، الحقول المطلوبة
- [ ] T008 [P] إنشاء `lib/core/utils/logger.dart` — `logInfo`, `logError`, `logZatca` بـ `kDebugMode`
- [ ] T009 إنشاء `lib/shared/theme/app_theme.dart` — نفس ألوان النظام الحالي (أزرق داكن، أبيض، ذهبي)
- [ ] T010 [P] إنشاء `lib/shared/theme/text_theme.dart` — خط عربي، أحجام، RTL
- [ ] T011 [P] إنشاء `lib/shared/widgets/arabic_text_field.dart` — TextField مع RTL + رقم عربي
- [ ] T012 [P] إنشاء `lib/shared/widgets/currency_display.dart` — عرض رمز الريال السعودي + المبلغ
- [ ] T013 [P] إنشاء `lib/shared/widgets/loading_overlay.dart` — overlay أثناء العمليات
- [ ] T014 [P] إنشاء `lib/shared/widgets/confirm_dialog.dart` — نافذة تأكيد بالعربي
- [ ] T015 [P] إنشاء `lib/shared/widgets/rtl_search_bar.dart` — شريط بحث RTL

**Checkpoint**: هيكل المشروع جاهز — `flutter pub get` يعمل ✅

---

## Phase 2: Foundation — قاعدة البيانات (Blocking)

**Purpose**: drift database كاملة — يجب اكتمالها قبل أي شاشة

**⚠️ CRITICAL**: لا يمكن البدء بأي شاشة قبل اكتمال هذه المرحلة

### drift Tables

- [ ] T016 إنشاء `lib/core/database/app_database.dart` — `@DriftDatabase` مع `LazyDatabase`, `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`, قائمة جميع الجداول والـ DAOs
- [ ] T017 [P] إنشاء `lib/core/database/tables/app_settings_table.dart` — جدول الإعدادات (صف واحد id=1)
- [ ] T018 [P] إنشاء `lib/core/database/tables/users_table.dart` — جدول المستخدمين مع `password_hash`
- [ ] T019 [P] إنشاء `lib/core/database/tables/roles_table.dart` + `role_permissions_table.dart`
- [ ] T020 [P] إنشاء `lib/core/database/tables/customers_table.dart` — مع index على phone و name
- [ ] T021 [P] إنشاء `lib/core/database/tables/products_table.dart` — مع `BlobColumn` للصور gzip
- [ ] T022 [P] إنشاء `lib/core/database/tables/laundry_services_table.dart`
- [ ] T023 [P] إنشاء `lib/core/database/tables/prepaid_packages_table.dart`
- [ ] T024 [P] إنشاء `lib/core/database/tables/subscriptions_table.dart` — مع `UNIQUE(customer_id)`
- [ ] T025 [P] إنشاء `lib/core/database/tables/subscription_periods_table.dart` — مع `CHECK(credit_remaining >= 0)`
- [ ] T026 [P] إنشاء `lib/core/database/tables/orders_table.dart` — مع جميع حقول ZATCA وindexes على `created_at`, `customer_id`, `invoice_seq`, `zatca_status`
- [ ] T027 [P] إنشاء `lib/core/database/tables/order_items_table.dart` — مع index على `order_id`
- [ ] T028 [P] إنشاء `lib/core/database/tables/credit_notes_table.dart`
- [ ] T029 [P] إنشاء `lib/core/database/tables/refunds_table.dart`
- [ ] T030 [P] إنشاء `lib/core/database/tables/consumption_receipts_table.dart`
- [ ] T031 [P] إنشاء `lib/core/database/tables/subscription_receipts_table.dart`
- [ ] T032 [P] إنشاء `lib/core/database/tables/loyalty_points_table.dart` — مع index على `customer_id`
- [ ] T033 [P] إنشاء `lib/core/database/tables/expenses_table.dart` — مع index على `expense_date`
- [ ] T034 [P] إنشاء `lib/core/database/tables/offers_table.dart`
- [ ] T035 [P] إنشاء `lib/core/database/tables/hangers_table.dart`
- [ ] T036 [P] إنشاء `lib/core/database/tables/customer_custom_prices_table.dart` — مع `UNIQUE(customer_id, item_type, item_id)`
- [ ] T037 [P] إنشاء `lib/core/database/tables/accounts_table.dart` + `license_table.dart`
- [ ] T038 [P] إنشاء `lib/core/database/tables/zatca_queue_table.dart` — مع `UNIQUE(order_id)` وindex على `status`

### drift DAOs

- [ ] T039 تشغيل `dart run build_runner build --delete-conflicting-outputs` لتوليد كود drift
- [ ] T040 [P] إنشاء `lib/core/database/daos/settings_dao.dart` — `getSettings()`, `updateSettings()`
- [ ] T041 [P] إنشاء `lib/core/database/daos/users_dao.dart` — `getUserByUsername()`, `verifyPassword()`, `getAllUsers()`, `createUser()`, `updateUser()`
- [ ] T042 [P] إنشاء `lib/core/database/daos/customers_dao.dart` — `searchCustomers(query)`, `getCustomerById()`, `createCustomer()`, `updateCustomer()`, `getCustomerWithBalance()`
- [ ] T043 [P] إنشاء `lib/core/database/daos/products_dao.dart` — `getAllProducts()`, `createProduct()`, `updateProduct()`, `deactivateProduct()`
- [ ] T044 [P] إنشاء `lib/core/database/daos/services_dao.dart` — `getAllServices()`, `createService()`, `updateService()`
- [ ] T045 [P] إنشاء `lib/core/database/daos/orders_dao.dart` — `createOrderWithItems()` (transaction)، `getOrderById()`, `searchOrders()`, `getNextInvoiceSeq()` (EXCLUSIVE lock)
- [ ] T046 [P] إنشاء `lib/core/database/daos/subscriptions_dao.dart` — `getActiveSubscription()`, `createSubscription()`, `deductCredit()` (transaction), `getSubscriptionHistory()`
- [ ] T047 [P] إنشاء `lib/core/database/daos/zatca_dao.dart` — `getPendingZatcaOrders()`, `markSubmitted()`, `markFailed()`, `markRejected()`
- [ ] T048 [P] إنشاء `lib/core/database/daos/reports_dao.dart` — `getDailyReport()`, `getPeriodReport()`, `getWorkerReport()`, `getSubscriptionsReport()`, `getZakatReport()`

### Riverpod Providers

- [ ] T049 إنشاء `lib/core/providers/database_provider.dart` — `databaseProvider` singleton مع `LazyDatabase`
- [ ] T050 [P] إنشاء `lib/core/providers/services_provider.dart` — providers لـ AuthService, ZatcaService, PrintService

**Checkpoint**: `dart run build_runner build` ينجح — الـ database تعمل ✅

---

## Phase 3: User Story 1 — دورة بيع كاملة (P1) 🎯 MVP

**Goal**: كاشير يسجّل دخوله ويُتمّ فاتورة بيع كاملة من الهاتف

**Independent Test**: إتمام دورة بيع (فاتورة + طباعة + ZATCA queue) في < 60 ثانية على هاتف Android بدون إنترنت

### Domain Entities

- [ ] T051 [P] [US1] إنشاء `lib/domain/entities/order.dart` — Order, OrderItem (plain Dart objects، لا DB)
- [ ] T052 [P] [US1] إنشاء `lib/domain/entities/customer.dart`
- [ ] T053 [P] [US1] إنشاء `lib/domain/entities/product.dart` + `lib/domain/entities/service.dart`
- [ ] T054 [P] [US1] إنشاء `lib/domain/entities/app_settings.dart`

### Use Cases (Business Logic)

- [ ] T055 [US1] إنشاء `lib/domain/use_cases/order/calculate_order.dart`:
  ```dart
  // subtotal = sum(unitPrice * qty)
  // discount = subtotal * discountPct / 10000  OR  fixedDiscount
  // vat = taxable * vatRate / 10000
  // total = subtotal - discount + vat
  // جميع الأرقام int (cents) — لا double
  ```
- [ ] T056 [US1] إنشاء `lib/domain/use_cases/order/validate_payment.dart`:
  ```dart
  // paid_cash + paid_card == total (فرق مسموح ≤ 1)
  // deferred: paid = 0, status = pending
  // subscription: credit_remaining >= amount_to_deduct
  ```
- [ ] T057 [US1] إنشاء `lib/domain/use_cases/order/create_order.dart`:
  ```dart
  // SQLite EXCLUSIVE transaction:
  //   1. getNextInvoiceSeq() — atomic
  //   2. INSERT INTO orders
  //   3. INSERT INTO order_items (all items)
  //   4. IF subscription: deductCredit()
  //   5. INSERT INTO zatca_queue (pending) — إذا ZATCA مُفعَّل
  // أي خطأ = rollback كامل
  ```
- [ ] T058 [US1] كتابة `test/unit/calculate_order_test.dart` — اختبار 6 حالات: VAT inclusive/exclusive، خصم نسبة/مبلغ، دفع مختلط، مبلغ صفر
- [ ] T059 [US1] كتابة `test/unit/validate_payment_test.dart` — دفع نقدي، بطاقة، مختلط، آجل، اشتراك

### AuthService + Login

- [ ] T060 [US1] إنشاء `lib/core/services/auth_service.dart`:
  - `login(username, password)` → تحقق من `password_hash` (bcrypt أو SHA256)، أنشئ JWT، احفظه في `flutter_secure_storage`
  - `logout()` → احذف JWT
  - `getCurrentUser()` → قرأ JWT من secure storage
  - `isLoggedIn` → bool
- [ ] T061 [US1] إنشاء `lib/presentation/notifiers/auth_notifier.dart` — `AsyncNotifier` لحالة تسجيل الدخول
- [ ] T062 [US1] إنشاء `lib/screens/login/login_screen.dart` — حقول username/password، زر دخول، رسالة خطأ عربية
- [ ] T063 [US1] إنشاء `lib/screens/login/login_form.dart` — form widget منفصل عن الشاشة
- [ ] T064 [US1] إنشاء `lib/app.dart` — `MaterialApp.router` مع GoRouter، RTL (`textDirection: TextDirection.rtl`)، AuthGuard
- [ ] T065 [US1] إنشاء `lib/main.dart` — `ProviderScope` + `runApp(LaundryApp())`

**نقطة تحقق Login**: التطبيق يفتح على Android ويُسجَّل الدخول → يُحفظ JWT ✅

### Settings Screen (أساسية)

- [ ] T066 [US1] إنشاء `lib/presentation/notifiers/settings_notifier.dart` — تحميل وحفظ `app_settings`
- [ ] T067 [US1] إنشاء `lib/screens/settings/settings_screen.dart` — اسم المحل، VAT rate، price_display_mode، نسخ الطباعة
- [ ] T068 [US1] إنشاء `lib/screens/settings/settings_form.dart` — form widget للإعدادات

### Customers Screen

- [ ] T069 [US1] إنشاء `lib/presentation/notifiers/customers_notifier.dart` — بحث + CRUD
- [ ] T070 [US1] إنشاء `lib/screens/customers/customers_screen.dart` — قائمة + بحث (< 200ms) + FAB إضافة
- [ ] T071 [US1] إنشاء `lib/screens/customers/customer_form_screen.dart` — نموذج إضافة/تعديل عميل
- [ ] T072 [US1] إنشاء `lib/screens/customers/customer_detail_screen.dart` — تفاصيل + رصيد + اشتراك + تاريخ فواتير

### Products Screen

- [ ] T073 [US1] إنشاء `lib/presentation/notifiers/products_notifier.dart` — CRUD + صورة
- [ ] T074 [US1] إنشاء `lib/screens/products/products_screen.dart` — قائمة + بحث + FAB
- [ ] T075 [US1] إنشاء `lib/screens/products/product_form_screen.dart` — نموذج مع حقل الصورة

### Services Screen

- [ ] T076 [US1] إنشاء `lib/presentation/notifiers/services_notifier.dart`
- [ ] T077 [US1] إنشاء `lib/screens/services/services_screen.dart` — قائمة + بحث + FAB
- [ ] T078 [US1] إنشاء `lib/screens/services/service_form_screen.dart`

### POS Screen (الأهم — P1 🔴)

- [ ] T079 [US1] إنشاء `lib/domain/use_cases/order/get_pos_data.dart` — تحميل products + services + customers في parallel
- [ ] T080 [US1] إنشاء `lib/presentation/notifiers/pos_notifier.dart`:
  - `addItem(item, qty)` → تحديث السلة
  - `removeItem(id)` → حذف من السلة
  - `applyDiscount(type, value)` → استدعاء `CalculateOrder`
  - `selectCustomer(id)` → تحميل بيانات العميل + اشتراكاته
  - `setPaymentMethod(method)` → نقدي/بطاقة/مختلط/آجل/اشتراك
  - `calculateTotals()` → يستدعي `calculateOrder` (لا حساب في الـ notifier)
  - `submitOrder()` → يستدعي `validatePayment` ثم `createOrder` في transaction
- [ ] T081 [US1] إنشاء `lib/screens/pos/pos_screen.dart` — الشاشة الرئيسية (< 300ms فتح)
- [ ] T082 [US1] إنشاء `lib/screens/pos/widgets/product_grid.dart` — شبكة المنتجات والخدمات
- [ ] T083 [US1] إنشاء `lib/screens/pos/widgets/cart_panel.dart` — السلة مع الكميات والحذف
- [ ] T084 [US1] إنشاء `lib/screens/pos/widgets/totals_summary.dart` — subtotal + discount + VAT + total (int cents → display)
- [ ] T085 [US1] إنشاء `lib/screens/pos/widgets/customer_selector.dart` — بحث عميل + عرض رصيد اشتراكه
- [ ] T086 [US1] إنشاء `lib/screens/pos/widgets/discount_input.dart` — خصم نسبة أو مبلغ ثابت
- [ ] T087 [US1] إنشاء `lib/screens/pos/widgets/payment_method_selector.dart` — نقدي / بطاقة / مختلط / آجل / اشتراك
- [ ] T088 [US1] إنشاء `lib/screens/pos/widgets/order_complete_dialog.dart` — نجاح الفاتورة + زر طباعة + رقم الفاتورة
- [ ] T089 [US1] كتابة `test/integration/pos_flow_test.dart` — دورة بيع كاملة (add items → discount → pay → createOrder → verify DB)

### Payment Screen

- [ ] T090 [US1] إنشاء `lib/screens/payment/payment_screen.dart` — إدخال المبالغ (نقدي + بطاقة) مع حساب الباقي
- [ ] T091 [US1] إنشاء `lib/screens/payment/widgets/cash_input.dart`
- [ ] T092 [US1] إنشاء `lib/screens/payment/widgets/card_input.dart`
- [ ] T093 [US1] إنشاء `lib/screens/payment/widgets/change_display.dart` — عرض المبلغ المُسترجع

### Invoices Screen

- [ ] T094 [US1] إنشاء `lib/presentation/notifiers/invoices_notifier.dart` — بحث + فلترة + pagination (20 صف)
- [ ] T095 [US1] إنشاء `lib/screens/invoices/invoices_screen.dart` — قائمة مع بحث وفلترة تاريخ
- [ ] T096 [US1] إنشاء `lib/screens/invoices/invoice_detail_screen.dart` — تفاصيل الفاتورة + حالة ZATCA + زر طباعة

### ZATCA Queue Service

- [ ] T097 [US1] إنشاء `lib/core/services/zatca_service.dart`:
  - `startRetryTimer()` → `Timer.periodic(15 min, processQueue)`
  - `processQueue()` → `check connectivity → getPendingZatcaOrders() → _submitInvoice(order) → markSubmitted/Failed`
  - `buildTlvQr(order, settings)` → TLV encoding الصحيح (tags 1-5: seller, VAT#, timestamp, total, VAT amount)
  - `_submitInvoice(order)` → HTTP POST مع timeout 10s
  - `stopTimer()`
- [ ] T098 [US1] إنشاء `lib/domain/use_cases/zatca/build_zatca_payload.dart` — TLV + QR + signed invoice
- [ ] T099 [US1] كتابة `test/unit/zatca_tlv_test.dart` — اختبار بناء TLV صحيح
- [ ] T100 [US1] إنشاء `lib/screens/zatca_settings/zatca_settings_screen.dart` — تفعيل ZATCA، mode (simulation/production)، شهادات في secure storage

### Dashboard Screen

- [ ] T101 [US1] إنشاء `lib/presentation/notifiers/dashboard_notifier.dart` — إحصائيات اليوم من `reports_dao`
- [ ] T102 [US1] إنشاء `lib/screens/dashboard/dashboard_screen.dart` — مبيعات اليوم، عدد الفواتير، اختصارات POS/Customers/Reports

### Daily Report

- [ ] T103 [US1] إنشاء `lib/presentation/notifiers/reports/daily_report_notifier.dart`
- [ ] T104 [US1] إنشاء `lib/screens/reports/daily_report/daily_report_screen.dart` — إجمالي + تفاصيل + طباعة

### App Shell & Navigation

- [ ] T105 [US1] إنشاء `lib/screens/shell/app_shell.dart` — Navigation Drawer أو Bottom Nav بالعربي
- [ ] T106 [US1] تحديث `lib/app.dart` — إضافة جميع routes (login، shell، كل الشاشات)

**Checkpoint US1**: دورة بيع كاملة تعمل على Android بدون إنترنت. التقييم: __/10 ✅

---

## Phase 4: User Story 2 — ترحيل البيانات (P1)

**Goal**: نقل 100% من بيانات MySQL إلى SQLite بدون فقدان

**Independent Test**: `node validate_migration.js` ينتج تقريراً بصفر فوارق في جميع الإجماليات

- [ ] T107 [US2] إنشاء `tools/migrate/package.json` — `{"dependencies": {"mysql2": "^3", "better-sqlite3": "^9"}}`
- [ ] T108 [US2] إنشاء `tools/migrate/mysql_to_sqlite.js`:
  - اتصال بـ MySQL (config من `.env`)
  - إنشاء SQLite بـ `better-sqlite3`
  - لكل جدول: `CREATE TABLE` (مع تحويل الأنواع) → `SELECT *` → تحويل DECIMAL×100 → `INSERT`
  - تحويل التواريخ: `DATE/DATETIME` → ISO8601 string
  - BLOBs (صور gzip): `Buffer` → `Uint8Array` بدون تغيير
  - NULL: يُبقى كما هو
  - إعداد `invoice_seq` في `sqlite_sequence`
  - كتابة `migration_log.json`
- [ ] T109 [US2] إنشاء `tools/migrate/validate_migration.js`:
  - مقارنة COUNT لكل جدول
  - مقارنة SUM(total_amount) في orders (مع تحويل الوحدات)
  - مقارنة SUM(paid_amount) في orders
  - مقارنة SUM(credit_remaining) في subscription_periods
  - مقارنة COUNT فواتير مدفوعة/معلقة
  - مقارنة إجمالي التقرير اليومي لآخر يوم
  - كتابة `validation_report.json` — صفر فوارق = نجاح، أي فارق = فشل + سبب
- [ ] T110 [US2] إنشاء `tools/migrate/.env.example` — `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASS`, `MYSQL_DB`, `OUTPUT_PATH`
- [ ] T111 [US2] كتابة `test/integration/migration_test.dart` — اختبار ترحيل 100 فاتورة تاريخية والتحقق من صحة الأرقام

**Checkpoint US2**: `validation_report.json` يُظهر صفر فوارق ✅

---

## Phase 5: User Story 3 — إدارة الاشتراكات (P2)

**Goal**: إنشاء وإدارة اشتراكات العملاء مع منع الرصيد السالب

**Independent Test**: إنشاء اشتراك جديد + خصم رصيد + محاولة خصم أكثر من الرصيد (يُرفض)

### Use Cases

- [ ] T112 [US3] إنشاء `lib/domain/use_cases/subscription/deduct_credit.dart`:
  ```dart
  // transaction: SELECT credit_remaining FOR UPDATE → check >= amount → UPDATE credit_remaining -= amount
  // throws InsufficientCredit إذا credit_remaining < amount
  // throws ZeroCreditBalance إذا credit_remaining == 0
  ```
- [ ] T113 [US3] إنشاء `lib/domain/use_cases/subscription/create_subscription.dart`:
  ```dart
  // تحقق: لا اشتراك نشط آخر (UNIQUE constraint)
  // INSERT INTO subscriptions
  // INSERT INTO subscription_periods (active)
  ```
- [ ] T114 [US3] إنشاء `lib/domain/use_cases/subscription/expire_period.dart` — status = expired عند انتهاء الرصيد أو التاريخ
- [ ] T115 [US3] كتابة `test/unit/deduct_credit_test.dart` — خصم عادي، رصيد ناقص، رصيد صفر، منع سالب

### Screens

- [ ] T116 [US3] إنشاء `lib/presentation/notifiers/subscriptions_notifier.dart`
- [ ] T117 [US3] إنشاء `lib/screens/subscriptions/subscriptions_screen.dart` — قائمة اشتراكات + بحث
- [ ] T118 [US3] إنشاء `lib/screens/subscriptions/subscription_form_screen.dart` — نموذج اشتراك جديد (اختيار عميل + باقة)
- [ ] T119 [US3] إنشاء `lib/screens/subscriptions/subscription_detail_screen.dart` — رصيد + تاريخ + عمليات الخصم
- [ ] T120 [US3] إنشاء `lib/screens/consumption_receipts/consumption_receipts_screen.dart` — قائمة إيصالات الاستهلاك
- [ ] T121 [US3] إنشاء `lib/screens/consumption_receipts/consumption_receipt_form_screen.dart` — نموذج خصم رصيد
- [ ] T122 [US3] إنشاء `lib/screens/subscription_receipts/subscription_receipts_screen.dart`
- [ ] T123 [US3] إنشاء `lib/screens/credit_invoices/credit_invoices_screen.dart` — فواتير آجلة + تسوية
- [ ] T124 [US3] إنشاء `lib/screens/credit_invoices/credit_invoice_detail_screen.dart` — تفاصيل + زر التسوية
- [ ] T125 [US3] إنشاء `lib/domain/use_cases/order/settle_credit_note.dart` — تسوية الفاتورة الآجلة

**Checkpoint US3**: إدارة الاشتراكات كاملة. التقييم: __/10 ✅

---

## Phase 6: User Story 4 — الطباعة الحرارية (P2)

**Goal**: طباعة إيصالات 80mm على طابعة Bluetooth بعد كل فاتورة

**Independent Test**: إتمام فاتورة + طباعة ناجحة على طابعة Bluetooth → إيصال صحيح RTL

- [ ] T126 [US4] إنشاء `lib/core/services/print_service.dart`:
  - `getPairedPrinters()` → `List<BluetoothDevice>`
  - `buildReceipt(order, settings)` → `List<int>` ESC/POS bytes
    - header: اسم المحل، VAT#، تاريخ
    - items: كل صف = `name ... qty × price = total` (RTL)
    - footer: subtotal، discount، VAT، total
    - ZATCA QR (إذا متوفر)
    - footer text من settings
  - `printReceipt(printer, bytes)` → bool
  - `saveDefaultPrinter(device)` → secure storage
  - `getDefaultPrinter()` → `BluetoothDevice?`
- [ ] T127 [US4] إنشاء `lib/core/services/arabic_esc_pos.dart` — تحويل النص العربي لـ ESC/POS (RTL reversal)
- [ ] T128 [US4] إنشاء `lib/screens/settings/printer_settings_screen.dart` — اختيار طابعة افتراضية + اختبار طباعة
- [ ] T129 [US4] إنشاء `lib/shared/widgets/print_button.dart` — زر طباعة مع fallback (PDF share إذا لا طابعة)
- [ ] T130 [US4] ربط `PrintService` بـ `pos_screen.dart` — طباعة تلقائية بعد إتمام الفاتورة (أو زر يدوي)
- [ ] T131 [US4] ربط `PrintService` بـ `daily_report_screen.dart` — طباعة تقرير اليوم
- [ ] T132 [US4] إنشاء `lib/screens/invoices/widgets/reprint_button.dart` — إعادة طباعة فاتورة قديمة

**Checkpoint US4**: طباعة تعمل على 3 طابعات مختلفة. التقييم: __/10 ✅

---

## Phase 7: الشاشات الثانوية (P2)

**Goal**: إكمال الوظائف الثانوية — فنادق، عروض، مصاريف، مستخدمون

- [ ] T133 [P] إنشاء `lib/screens/hotels_companies/hotels_companies_screen.dart` — قائمة العملاء الشركات + بحث
- [ ] T134 [P] إنشاء `lib/screens/hotels_companies/hotel_company_form_screen.dart`
- [ ] T135 [P] إنشاء `lib/screens/customer_custom_prices/custom_prices_screen.dart` — أسعار مخصصة لعميل
- [ ] T136 [P] إنشاء `lib/screens/customer_custom_prices/custom_price_form_screen.dart`
- [ ] T137 [P] إنشاء `lib/screens/offers/offers_screen.dart` — قائمة العروض والخصومات
- [ ] T138 [P] إنشاء `lib/screens/offers/offer_form_screen.dart`
- [ ] T139 [P] إنشاء `lib/screens/expenses/expenses_screen.dart` — قائمة مصاريف + فلترة
- [ ] T140 [P] إنشاء `lib/screens/expenses/expense_form_screen.dart`
- [ ] T141 [P] إنشاء `lib/screens/hangers/hangers_screen.dart` — شماعات مع حالة
- [ ] T142 [P] إنشاء `lib/screens/users/users_screen.dart` — إدارة الكاشيرين
- [ ] T143 [P] إنشاء `lib/screens/users/user_form_screen.dart` — نموذج مستخدم جديد + كلمة مرور
- [ ] T144 [P] إنشاء `lib/screens/roles/roles_screen.dart` — أدوار وصلاحيات
- [ ] T145 [P] إنشاء `lib/screens/roles/role_form_screen.dart` — نموذج دور + checkboxes الصلاحيات
- [ ] T146 إنشاء `lib/core/services/loyalty_service.dart` — `calculatePoints()`, `redeemPoints()`
- [ ] T147 إنشاء `lib/domain/use_cases/loyalty/calculate_points.dart` + `test/unit/loyalty_points_test.dart`
- [ ] T148 [P] إنشاء `lib/screens/invoice_a4/invoice_a4_screen.dart` — عرض فاتورة A4 + زر share PDF
- [ ] T149 [P] إنشاء `lib/core/services/pdf_service.dart` — توليد PDF فاتورة A4 بـ `pdf` package
- [ ] T150 [P] إنشاء `lib/screens/invoice_a4/share_invoice_screen.dart` — مشاركة عبر WhatsApp/البريد/غيره

**Checkpoint Phase 7**: جميع الشاشات الثانوية = 10/10 ✅

---

## Phase 8: User Story 5 — التقارير الكاملة (P3)

**Goal**: 12 شاشة تقارير مع فلترة زمنية وpagination

**Independent Test**: تقرير يومي يُظهر إجمالياً مطابقاً لمجموع فواتير اليوم في DB

- [ ] T151 إنشاء `lib/screens/reports/reports_hub/reports_hub_screen.dart` — قائمة التقارير المتاحة
- [ ] T152 [P] [US5] إنشاء `lib/presentation/notifiers/reports/period_report_notifier.dart` + `lib/screens/reports/period_report/period_report_screen.dart` — فلترة بتاريخ بداية/نهاية
- [ ] T153 [P] [US5] إنشاء `lib/screens/reports/all_invoices_report/all_invoices_report_screen.dart` — كل الفواتير مع pagination (20 صف)
- [ ] T154 [P] [US5] إنشاء `lib/screens/reports/credit_invoices_report/credit_invoices_report_screen.dart` — الفواتير الآجلة + حالتها
- [ ] T155 [P] [US5] إنشاء `lib/screens/reports/subscriptions_report/subscriptions_report_screen.dart` — ملخص الاشتراكات + الأرصدة
- [ ] T156 [P] [US5] إنشاء `lib/screens/reports/customer_account_report/customer_account_report_screen.dart` — كشف حساب عميل
- [ ] T157 [P] [US5] إنشاء `lib/screens/reports/expenses_report/expenses_report_screen.dart` — مصاريف حسب الفئة والتاريخ
- [ ] T158 [P] [US5] إنشاء `lib/screens/reports/worker_report/worker_report_screen.dart` — مبيعات حسب الكاشير
- [ ] T159 [P] [US5] إنشاء `lib/screens/reports/types_report/types_report_screen.dart` — تقرير حسب نوع الخدمة
- [ ] T160 [P] [US5] إنشاء `lib/screens/reports/hotels_companies_report/hotels_companies_report_screen.dart`
- [ ] T161 [P] [US5] إنشاء `lib/screens/reports/zakat_report/zakat_report_screen.dart` — تقرير ZATCA السنوي

**Checkpoint US5**: جميع التقارير = 10/10 ✅

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: جودة نهائية + أمان + أداء + إطلاق

### Security

- [ ] T162 مراجعة جميع الـ notifiers: تأكيد وجود `RBAC check` قبل كل عملية حساسة
- [ ] T163 تأكيد أن جميع الـ JWT وشهادات ZATCA في `flutter_secure_storage` — لا `SharedPreferences`
- [ ] T164 مراجعة الكود: لا hardcoded secrets — `flutter analyze` يمر بصفر warnings

### Performance

- [ ] T165 تشغيل `flutter run --profile` وقياس cold start time — يجب < 3 ثوانٍ
- [ ] T166 [P] إضافة `ListView.builder` في كل شاشة قائمة (لا `Column + List.map`)
- [ ] T167 [P] اختبار بحث العملاء مع 100,000 سجل — يجب < 200ms (تحقق من استخدام الـ index)
- [ ] T168 اختبار التقارير مع 1,000,000 فاتورة — pagination إلزامي، date filter إلزامي

### Testing Final Pass

- [ ] T169 تشغيل `flutter test` — جميع الـ unit tests تجتاز
- [ ] T170 [P] كتابة `test/integration/zatca_queue_test.dart` — إنشاء 5 فواتير بدون إنترنت → عودة الإنترنت → ZATCA يُرسل
- [ ] T171 [P] تشغيل QA manual checklist لكل الـ 35 شاشة وملء جدول التقييم في `plan.md`

### Screen Ratings Final Verification

- [ ] T172 تحديث جدول Screen Ratings في `specs/001-mobile-apk-conversion/plan.md` بالتقييمات الفعلية — الهدف: 35 × 10/10

### Build & Release

- [ ] T173 تشغيل `flutter build apk --release` — APK موقّع
- [ ] T174 [P] اختبار Release APK على Android 8, 10, 12, 14
- [ ] T175 [P] إنشاء `docs/release-plan.md` + `docs/business-rules.md` + `docs/database-mapping.md` (للملفات الناقصة)
- [ ] T176 [P] إنشاء `docs/architecture.md` — رسم بياني للطبقات + مسؤولية كل طبقة
- [ ] T177 تحديث `README.md` في `D:\PLUS\Laundry-apk` — setup instructions + build commands

**Checkpoint Final**: 35 × 10/10، `flutter analyze` صفر warnings، Release APK يعمل ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: لا يوجد — يبدأ فوراً
- **Phase 2 (Foundation/DB)**: يتبع Phase 1 — **يحجب جميع الشاشات**
- **Phase 3 (US1 MVP)**: يتبع Phase 2 — الأولوية القصوى
- **Phase 4 (US2 Migration)**: يتبع Phase 2 — يعمل بالتوازي مع US1 (ملفات مختلفة تماماً)
- **Phase 5 (US3 Subscriptions)**: يتبع Phase 3 (يحتاج POS + Customers)
- **Phase 6 (US4 Printing)**: يتبع Phase 3 (يحتاج invoices)
- **Phase 7 (Secondary)**: يتبع Phase 3 — معظمها متوازٍ [P]
- **Phase 8 (US5 Reports)**: يتبع Phase 3 (يحتاج orders + invoices في DB)
- **Phase 9 (Polish)**: يتبع جميع المراحل

### User Story Dependencies

| US | يعتمد على | يمكن البدء بعد |
|----|-----------|----------------|
| US1 | Phase 2 | T039 (build_runner) |
| US2 | Phase 2 | T039 (بالتوازي مع US1) |
| US3 | US1 | T106 (app navigation جاهز) |
| US4 | US1 | T106 (invoices جاهز) |
| US5 | US1 | T104 (reports_dao جاهز) |

### Parallel Opportunities

**Phase 1**: T003–T015 جميعها [P] — تعمل في نفس الوقت

**Phase 2 Tables**: T017–T038 جميعها [P] — ملفات مختلفة

**Phase 2 DAOs**: T040–T048 جميعها [P] — بعد T039

**US2 + US1**: T107–T111 تعمل بالتوازي مع T051–T106

**Phase 7**: T133–T150 معظمها [P]

**Phase 8**: T152–T161 جميعها [P]

---

## Parallel Example: Phase 2 (Database)

```
# في نفس الوقت — ملفات مختلفة تماماً:
T017: إنشاء app_settings_table.dart
T018: إنشاء users_table.dart
T019: إنشاء roles_table.dart
T020: إنشاء customers_table.dart
T021: إنشاء products_table.dart
... (21 جدول في نفس الوقت)

# بعد T039 (build_runner):
T040: settings_dao.dart
T041: users_dao.dart
T042: customers_dao.dart
... (9 DAOs في نفس الوقت)
```

---

## Parallel Example: Phase 7 (Secondary Screens)

```
# في نفس الوقت (ملفات مختلفة تماماً):
T133+T134: Hotels & Companies
T135+T136: Custom Prices
T137+T138: Offers
T139+T140: Expenses
T141: Hangers
T142+T143: Users
T144+T145: Roles
T148+T149+T150: Invoice A4 + PDF + Share
```

---

## Implementation Strategy

### MVP First (US1 — Phase 1-3)

```
1. Phase 1 Setup (يوم 1-2)
2. Phase 2 Database Foundation (يوم 2-5)
3. Phase 3 US1 MVP — بهذا الترتيب الصارم:
   a. money.dart + calculate_order + unit tests
   b. AuthService + Login screen
   c. Settings screen
   d. Customers screen
   e. Products + Services screens
   f. Payment screen
   g. POS screen (الأطول — 3-5 أيام)
   h. Invoices screen
   i. ZatcaService
   j. Daily Report
   k. Dashboard
4. STOP: اختبار MVP على هاتف حقيقي
5. تقييم: كل شاشة = 10/10 قبل التالية
```

### Incremental Delivery

```
MVP (Phase 3)     → دورة بيع كاملة ✅
+ Phase 4 (US2)   → بيانات تاريخية مُرحّلة ✅
+ Phase 5 (US3)   → اشتراكات تعمل ✅
+ Phase 6 (US4)   → طباعة Bluetooth ✅
+ Phase 7         → شاشات ثانوية ✅
+ Phase 8 (US5)   → تقارير كاملة ✅
+ Phase 9         → release جاهز ✅
```

---

## Notes

- `[P]` = ملف مختلف، لا تبعية على مهمة غير مكتملة — يعمل بالتوازي
- `[US1]` إلخ = ينتمي لهذه الـ User Story للتتبع
- كل شاشة تصل 10/10 قبل الانتقال للتالية
- لا `double` للمبالغ — `money.dart` هو المرجع الوحيد
- لا business logic في Widgets أو Notifiers — فقط في Use Cases
- `createOrder` دائماً في EXCLUSIVE SQLite transaction
- `credit_remaining >= 0` مُفعَّل في DB و Use Case معاً
