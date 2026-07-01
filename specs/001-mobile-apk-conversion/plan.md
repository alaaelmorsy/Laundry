# Improved Implementation Plan: Laundry APK (Flutter + SQLite)

**Branch**: `001-mobile-apk-conversion` | **Date**: 2026-06-30 | **Spec**: [spec.md](spec.md)

---

## 1. Executive Summary

تحويل نظام PLUS Laundry (Node.js + MySQL + Windows) إلى تطبيق موبايل Flutter يعمل **offline بالكامل** على Android أولاً ثم iOS. قاعدة البيانات SQLite محلية داخل الهاتف. لا يوجد Cloud Server. ZATCA يُرسل عند توفر الإنترنت بنفس منطق retry الحالي (كل 15 دقيقة). المشروع مستقل تماماً في `D:\PLUS\Laundry-apk` — لا يُلمس `D:\PLUS\Laundry` أبداً.

**الأرقام الرئيسية:**
- 35 شاشة إجمالاً
- 10 شاشات في MVP الأول
- 7 مراحل تنفيذ
- هدف الجودة: 10/10 لكل شاشة
- صفر فارق في ترحيل البيانات

---

## 2. Scope

| داخل النطاق | خارج النطاق |
|-------------|------------|
| Android (API 26+) | Windows app — لا تعديل |
| iOS (المرحلة 2) | Cloud backend |
| Offline-first SQLite | Multi-tenant / SaaS |
| ZATCA Phase 1 + 2 | WhatsApp Business API |
| Bluetooth thermal print | لوحة تحكم ويب |
| ترحيل بيانات MySQL → SQLite | تحديث تلقائي OTA للتطبيق |
| 35 شاشة بنفس المنطق الحالي | تغيير منطق الأعمال |

---

## 3. Non-Goals

- لا تعديل على `D:\PLUS\Laundry` أو قاعدة بيانات MySQL
- لا تغيير في معادلات الضريبة، الخصم، رصيد الاشتراك عن النظام الحالي
- لا cloud sync — الهاتف هو مصدر الحقيقة الوحيد
- لا دعم multi-device في نفس الوقت (في النطاق الحالي)
- لا بناء iOS حتى اكتمال Android MVP

---

## 4. Architecture

### طبقات المشروع (Clean Architecture)

```
┌─────────────────────────────────────────┐
│            UI Layer (Screens)           │  ← Flutter Widgets فقط، لا business logic
├─────────────────────────────────────────┤
│       Presentation Layer (Notifiers)    │  ← Riverpod AsyncNotifiers، تنسيق البيانات
├─────────────────────────────────────────┤
│         Domain Layer (Use Cases)        │  ← Business rules، حسابات الفواتير
├─────────────────────────────────────────┤
│       Data Layer (Repositories + DAOs)  │  ← drift DAOs، SQLite queries
├─────────────────────────────────────────┤
│         Core Services (Singletons)      │  ← ZATCA، Print، Auth، Migration
└─────────────────────────────────────────┘
```

### مسؤولية كل طبقة

| الطبقة | المسؤولية | ممنوع |
|--------|-----------|-------|
| **Screen** | عرض البيانات، استقبال Input، استدعاء Notifier | أي حساب مالي أو query مباشر |
| **Notifier** | إدارة الحالة (state)، ترجمة أخطاء لرسائل عربية | Business logic مباشر |
| **Use Case** | تنفيذ عملية واحدة (CreateOrder, DeductSubscription) | قراءة/كتابة DB مباشرة |
| **Repository** | واجهة بين Use Cases وDAOs | Business logic |
| **DAO** | SQL queries فقط | أي منطق أعمال |
| **Service** | ZATCA HTTP، طباعة، Auth | State management |

### أين يوجد كل منطق

| المنطق | الموقع |
|--------|--------|
| حساب الفاتورة (subtotal, VAT, total) | `domain/use_cases/order/calculate_order.dart` |
| منطق الاشتراكات والرصيد | `domain/use_cases/subscription/deduct_credit.dart` |
| ZATCA TLV + إرسال + retry | `core/services/zatca_service.dart` |
| طباعة ESC/POS | `core/services/print_service.dart` |
| Auth + JWT | `core/services/auth_service.dart` |
| SQL queries | `core/database/daos/*.dart` |

### قاعدة صارمة

> **لا يحق لأي Widget أو Notifier أن يحسب مبلغاً مالياً مباشرة.**
> كل حساب = Use Case. كل Use Case = unit test.

---

## 5. Project Structure

```
D:\PLUS\Laundry-apk\
├── lib/
│   ├── main.dart
│   ├── app.dart                          — MaterialApp + GoRouter + Riverpod + RTL
│   │
│   ├── core/
│   │   ├── database/
│   │   │   ├── app_database.dart         — drift LazyDatabase + migrations
│   │   │   ├── tables/                   — جدول drift لكل entity
│   │   │   │   ├── orders_table.dart
│   │   │   │   ├── customers_table.dart
│   │   │   │   └── ...
│   │   │   └── daos/                     — SQL queries فقط
│   │   │       ├── orders_dao.dart
│   │   │       ├── customers_dao.dart
│   │   │       └── ...
│   │   ├── services/
│   │   │   ├── auth_service.dart
│   │   │   ├── zatca_service.dart
│   │   │   ├── print_service.dart
│   │   │   └── backup_service.dart
│   │   ├── providers/
│   │   │   ├── database_provider.dart
│   │   │   └── services_provider.dart
│   │   └── utils/
│   │       ├── money.dart                — int cents ↔ display, منع double
│   │       ├── arabic_digits.dart
│   │       ├── date_format.dart
│   │       └── validators.dart
│   │
│   ├── domain/
│   │   ├── entities/                     — Plain Dart objects (no DB)
│   │   │   ├── order.dart
│   │   │   ├── customer.dart
│   │   │   └── ...
│   │   ├── repositories/                 — Abstract interfaces
│   │   │   ├── order_repository.dart
│   │   │   └── ...
│   │   └── use_cases/
│   │       ├── order/
│   │       │   ├── calculate_order.dart  — الحساب المالي الأساسي
│   │       │   ├── create_order.dart     — transaction: order + items + zatca_queue
│   │       │   └── validate_payment.dart
│   │       ├── subscription/
│   │       │   ├── deduct_credit.dart
│   │       │   └── validate_credit.dart
│   │       ├── zatca/
│   │       │   └── build_zatca_payload.dart
│   │       └── loyalty/
│   │           └── calculate_points.dart
│   │
│   ├── data/
│   │   └── repositories/                 — تنفيذ Repository interfaces
│   │       ├── order_repository_impl.dart
│   │       └── ...
│   │
│   ├── presentation/
│   │   └── notifiers/                    — Riverpod AsyncNotifiers
│   │       ├── pos_notifier.dart
│   │       ├── customers_notifier.dart
│   │       └── ...
│   │
│   └── screens/
│       ├── login/
│       ├── dashboard/
│       ├── pos/
│       ├── invoices/
│       ├── customers/
│       ├── products/
│       ├── services/
│       ├── subscriptions/
│       ├── credit_invoices/
│       ├── consumption_receipts/
│       ├── subscription_receipts/
│       ├── payment/
│       ├── offers/
│       ├── expenses/
│       ├── hangers/
│       ├── hotels_companies/
│       ├── customer_custom_prices/
│       ├── users/
│       ├── roles/
│       ├── settings/
│       ├── zatca_settings/
│       ├── invoice_a4/
│       └── reports/
│           ├── reports_hub/
│           ├── daily_report/
│           ├── period_report/
│           ├── all_invoices_report/
│           ├── credit_invoices_report/
│           ├── subscriptions_report/
│           ├── customer_account_report/
│           ├── expenses_report/
│           ├── worker_report/
│           ├── types_report/
│           ├── hotels_companies_report/
│           └── zakat_report/
│
├── test/
│   ├── unit/
│   │   ├── calculate_order_test.dart
│   │   ├── deduct_credit_test.dart
│   │   ├── validate_payment_test.dart
│   │   └── zatca_tlv_test.dart
│   ├── integration/
│   │   ├── pos_flow_test.dart
│   │   ├── migration_test.dart
│   │   └── zatca_queue_test.dart
│   └── golden/
│       ├── pos_screen_test.dart
│       └── invoice_print_test.dart
│
├── tools/
│   └── migrate/
│       ├── mysql_to_sqlite.js
│       └── validate_migration.js
│
├── docs/
│   ├── business-rules.md
│   ├── database-mapping.md
│   ├── architecture.md
│   ├── testing-strategy.md
│   ├── zatca-plan.md
│   ├── printing-plan.md
│   ├── security.md
│   ├── performance.md
│   ├── risk-register.md
│   └── release-plan.md
│
└── pubspec.yaml
```

---

## 6. Team Workflow

### تقسيم الفريق والمسؤوليات

| الدور | المسؤولية | الملفات |
|-------|-----------|---------|
| **Team Lead** | معمارية، مراجعة PR، قرارات تقنية | `app.dart`, `architecture.md` |
| **Business Logic Dev** | Use Cases، حسابات، Domain layer | `domain/` كلها |
| **Database Dev** | drift tables، DAOs، migration | `core/database/`, `tools/migrate/` |
| **Flutter UI Dev** | Screens، Widgets، Notifiers | `screens/`, `presentation/` |
| **ZATCA Dev** | ZATCA service، TLV، retry | `core/services/zatca_service.dart` |
| **QA Tester** | Tests، QA checklists، تقييم /10 | `test/` كلها |

### Branching Strategy

```
main                    ← production only
  └── develop           ← integration branch
        ├── feature/login
        ├── feature/pos
        ├── feature/subscriptions
        ├── fix/pos-vat-calculation
        └── migration/mysql-to-sqlite
```

### قواعد Pull Requests

- PR صغير: شاشة واحدة أو feature واحدة فقط
- لا PR يزيد عن 400 سطر
- مطلوب: unit test لأي use case جديد
- مطلوب: تقييم /10 في وصف الـ PR
- مراجعة: Team Lead + مطور آخر
- لا merge قبل اكتمال Definition of Done

### قواعد Code Review

- [ ] لا business logic داخل Widget أو Notifier
- [ ] لا `double` للمبالغ المالية — فقط `int` (cents)
- [ ] كل استعلام SQL في DAO فقط
- [ ] كل خطأ يُترجم لرسالة عربية واضحة
- [ ] لا hardcoded strings — كل النصوص في constants

### Definition of Done لكل شاشة

- [ ] الوظائف كاملة ومطابقة للنظام الحالي
- [ ] RTL كامل، عربي، رمز الريال صحيح
- [ ] Unit tests للـ use cases المرتبطة
- [ ] لا business logic في الـ Widget
- [ ] أداء ضمن الحدود المطلوبة (§18)
- [ ] كل الحالات الاستثنائية مُعالجة
- [ ] QA Tester وافق على التقييم /10
- [ ] PR مُراجَع وmergeable

---

## 7. Coding Standards

### تسمية الملفات والكلاسات

| النوع | الصيغة | مثال |
|-------|--------|------|
| ملف Dart | `snake_case.dart` | `calculate_order.dart` |
| Class | `PascalCase` | `CalculateOrder` |
| Variable/method | `camelCase` | `totalAmount` |
| Constant | `kCamelCase` | `kVatRate` |
| Provider | `camelCaseProvider` | `posNotifierProvider` |

### التعامل مع المبالغ المالية

```dart
// ✅ صحيح — int cents
int subtotal = 9950;       // 99.50 ريال
int vat = subtotal * 15 ~/ 100;  // عملية int فقط

// ❌ خطأ — double
double subtotal = 99.50;
double vat = subtotal * 0.15;   // floating point error!
```

**القاعدة الصارمة:**
- كل مبلغ مالي = `int` (هللات) داخل الكود وقاعدة البيانات
- فقط عند العرض للمستخدم يُقسَّم على 100
- `money.dart` هو المكان الوحيد للتحويل

```dart
// money.dart — الملف الوحيد للتحويل
extension Money on int {
  String get display => (this / 100).toStringAsFixed(2);
  String get displayWithSymbol => '${display} ر.س';
}

int riyalsToInt(String input) =>
    (double.parse(input) * 100).round();
```

### التعامل مع الأخطاء

```dart
// Use Case يرمي exception مُصنَّف
sealed class OrderError {
  const OrderError();
}
class InsufficientCredit extends OrderError {}
class ZeroAmountOrder extends OrderError {}
class PaymentMismatch extends OrderError {}

// Notifier يمسك الخطأ ويترجمه
} on InsufficientCredit {
  state = AsyncError('الرصيد غير كافٍ', StackTrace.current);
} on PaymentMismatch {
  state = AsyncError('مجموع الدفع لا يساوي الإجمالي', StackTrace.current);
}
```

### Logging

```dart
// core/utils/logger.dart
import 'package:flutter/foundation.dart';

void logInfo(String msg) { if (kDebugMode) debugPrint('[INFO] $msg'); }
void logError(String msg, [Object? e]) { debugPrint('[ERROR] $msg ${e ?? ''}'); }
void logZatca(String msg) { debugPrint('[ZATCA] $msg'); }
```

### التعامل مع Null

- استخدام `required` في constructors — لا nullable بدون سبب
- `??` للقيم الافتراضية — لا `!` إلا عند التأكد 100%
- Nullable fields تُوثَّق بتعليق: `// null = لم يُحدَّد بعد`

### منع تكرار الكود

- كل حساب مالي = Use Case واحد يُعاد استخدامه
- كل widget مشترك في `shared/widgets/`
- لا نسخ-لصق منطق الضريبة أو الخصم — مرجع واحد فقط

---

## 8. Database Design

راجع [data-model.md](data-model.md) للـ schema الكامل.

**المبادئ الأساسية:**
- جميع المبالغ: `INTEGER` (هللات × 100)
- جميع التواريخ: `TEXT` بصيغة `ISO8601` — `datetime('now')` في SQLite
- الصور: `BLOB` (gzip compressed — كما هي في MySQL)
- كل جدول رئيسي له index على الحقول الأكثر بحثاً
- `FOREIGN KEY` مُفعَّل: `PRAGMA foreign_keys = ON`
- `CHECK` constraints للقيم الحرجة: `credit_remaining >= 0`

**Indexes الأساسية:**
```sql
-- orders: البحث الأكثر تكراراً
CREATE INDEX idx_orders_created_at   ON orders(created_at);
CREATE INDEX idx_orders_customer_id  ON orders(customer_id);
CREATE INDEX idx_orders_invoice_seq  ON orders(invoice_seq);
CREATE INDEX idx_orders_zatca_status ON orders(zatca_status);

-- customers: بحث سريع
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name  ON customers(name);

-- subscription_periods: الرصيد
CREATE INDEX idx_sp_subscription_id ON subscription_periods(subscription_id);
CREATE INDEX idx_sp_status          ON subscription_periods(status);

-- ZATCA queue
CREATE INDEX idx_zatca_queue_status ON zatca_queue(status);
```

---

## 9. Database Mapping (MySQL → SQLite)

راجع `docs/database-mapping.md` للتفاصيل الكاملة.

### جدول التحويل السريع

| MySQL Type | SQLite Type | ملاحظة |
|-----------|------------|--------|
| `DECIMAL(10,2)` | `INTEGER` (cents ×100) | `99.50` → `9950` |
| `TINYINT(1)` | `INTEGER` (0/1) | Boolean |
| `DATETIME` | `TEXT` ISO8601 | `2026-06-30T12:00:00` |
| `LONGBLOB` | `BLOB` | صور gzip — بدون تغيير |
| `VARCHAR(N)` | `TEXT` | بدون تغيير |
| `INT AUTO_INCREMENT` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `NULL` | `NULL` | يُحتفظ بـ NULL كما هو |

### Invoice Sequence

```js
// في mysql_to_sqlite.js
// نقل invoice_seq كما هو
// ثم تعيين SQLite sequence:
db.run(`INSERT OR REPLACE INTO sqlite_sequence (name, seq)
        VALUES ('orders', (SELECT MAX(invoice_seq) FROM orders))`);
```

---

## 10. Migration Plan

### الخطوات

```
1. [نسخة احتياطية] mysqldump -u root -p laundry > backup_YYYYMMDD.sql
2. [تشغيل] node tools/migrate/mysql_to_sqlite.js
3. [تحقق] node tools/migrate/validate_migration.js
4. [مراجعة] فتح تقرير validation_report.json
5. [نقل] copy laundry_data.sqlite to device (USB/ADB/share)
```

### mysql_to_sqlite.js — المنطق

```js
// 1. اتصال بـ MySQL
// 2. إنشاء SQLite (better-sqlite3)
// 3. لكل جدول:
//    a. CREATE TABLE (نفس schema بعد تحويل الأنواع)
//    b. SELECT * FROM mysql_table
//    c. لكل صف: تحويل DECIMAL → int (×100)، DATE → ISO8601
//    d. INSERT INTO sqlite_table
// 4. تفعيل PRAGMA foreign_keys
// 5. إنشاء الـ indexes
// 6. كتابة migration_log.json
```

### validate_migration.js — مقارنات

| المقارنة | الهدف |
|---------|-------|
| عدد الصفوف لكل جدول | مطابق 100% |
| SUM(total_amount) في orders | صفر فارق |
| SUM(paid_amount) في orders | صفر فارق |
| COUNT فواتير مدفوعة / معلقة | مطابق |
| SUM(credit_remaining) في subscription_periods | صفر فارق |
| أرصدة العملاء (loyalty_points) | مطابق |
| إجمالي التقرير اليومي لآخر يوم | مطابق |

### ماذا يحدث إذا فشل الترحيل؟

1. ملف SQLite المُنشأ يُحذف تلقائياً (لا ترحيل جزئي)
2. `migration_log.json` يُسجّل سبب الفشل
3. يُصحَّح السبب ويُعاد التشغيل من الصفر (الـ migration idempotent)
4. النظام الحالي (MySQL) لا يتأثر أبداً

### إعادة المحاولة بأمان

```
rm laundry_data.sqlite          # حذف الملف الناقص
node mysql_to_sqlite.js          # إعادة من الصفر
node validate_migration.js       # تحقق مجدداً
```

---

## 11. Business Rules

راجع `docs/business-rules.md` للقواعد الكاملة. ملخص القواعد الحرجة:

### حساب الفاتورة

```dart
// calculate_order.dart — المصدر الوحيد للحقيقة
int calcSubtotal(List<OrderItem> items) =>
    items.fold(0, (sum, i) => sum + i.unitPrice * i.quantity);

int calcDiscount(int subtotal, DiscountType type, int value) =>
    type == DiscountType.percentage
        ? subtotal * value ~/ 10000   // value = percentage × 100
        : value;

int calcVat(int taxableAmount, int vatRate) =>
    taxableAmount * vatRate ~/ 10000; // vatRate = 15.00% → 1500

int calcTotal(int subtotal, int discount, int vat) =>
    subtotal - discount + vat;
```

### قواعد الدفع

```
paid_cash + paid_card == total_amount  (فرق مسموح ≤ 1 هللة = 1 int)
دفع آجل: paid_amount = 0, payment_status = 'pending'
دفع اشتراك: لا يُغيَّر paid_amount — يُخصم من credit_remaining فقط
```

### قواعد الاشتراكات

```
credit_remaining >= 0  (CHECK constraint في DB + validation في use case)
اشتراك واحد نشط لكل عميل (UNIQUE على customer_id في subscriptions)
subscription_periods: append-only — لا DELETE نهائياً
```

### قواعد ZATCA

```
كل فاتورة مكتملة → تُضاف تلقائياً إلى zatca_queue (pending)
retry كل 15 دقيقة عند توفر الإنترنت
لا إعادة إرسال فاتورة submitted (UNIQUE order_id في zatca_queue)
```

---

## 12. ZATCA Plan

راجع `docs/zatca-plan.md` للتفاصيل. ملخص:

### ZATCA Queue Logic

```
┌─────────────────────────────────────────────┐
│  createOrder() transaction                  │
│    → INSERT INTO orders                     │
│    → INSERT INTO order_items                │
│    → INSERT INTO zatca_queue (pending)      │  ← في نفس الـ transaction
└─────────────────────────────────────────────┘
        ↓ Timer.periodic(15 min)
┌─────────────────────────────────────────────┐
│  ZatcaService.processQueue()                │
│    → check connectivity                     │
│    → SELECT pending from zatca_queue        │
│    → buildTlvQr()                           │
│    → POST to ZATCA API                      │
│    → UPDATE status: submitted / failed      │
│    → UPDATE orders.zatca_status             │
└─────────────────────────────────────────────┘
```

### حالات ZATCA

| الحالة | المعنى |
|--------|--------|
| `pending` | لم يُرسَل بعد |
| `processing` | جاري الإرسال |
| `submitted` | نجح ✅ |
| `failed` | فشل مؤقت — سيُعاد |
| `rejected` | رفضت الهيئة — يحتاج تدخل يدوي |
| `exempt` | معفاة من ZATCA |

### Retry Policy

- عدد المحاولات: لا حد — يُعاد حتى النجاح
- delay بين المحاولات: 15 دقيقة
- حفظ آخر خطأ في `zatca_queue.last_error`
- حفظ عدد المحاولات في `zatca_queue.attempt_count`
- بعد 50 محاولة فاشلة: تنبيه مرئي في الواجهة

---

## 13. Printing Plan

راجع `docs/printing-plan.md` للتفاصيل. ملخص:

### Flow الطباعة

```
1. اكتمال الفاتورة
2. PrintService.buildReceipt(order) → List<int> bytes ESC/POS
3. PrintService.getPairedPrinters() → List<BluetoothDevice>
4. إذا defaultPrinter محفوظ → طباعة مباشرة
5. إذا لا → عرض قائمة اختيار
6. BluetoothPrint.sendData(bytes)
7. إذا فشل → رسالة + زر "إعادة الطباعة" (الفاتورة محفوظة)
```

### قواعد الطباعة

- العرض دائماً 80mm (48 حرف في السطر)
- RTL: النص العربي يُعكس للـ ESC/POS
- QR code مضمّن (ZATCA QR إذا متوفر)
- حفظ الطابعة الافتراضية في secure storage
- فشل الطباعة لا يُلغي الفاتورة — مستقلان تماماً

---

## 14. Testing Strategy

راجع `docs/testing-strategy.md` للتفاصيل. الملخص:

### Unit Tests (كل use case له test)

```dart
// test/unit/calculate_order_test.dart
test('VAT inclusive: total يساوي subtotal - discount + vat', () {
  final result = calculateOrder(
    items: [OrderItem(unitPrice: 10000, quantity: 2)],  // 200 ريال
    discountPercent: 1000,    // 10%
    vatRate: 1500,            // 15%
    mode: PriceMode.exclusive,
  );
  expect(result.subtotal, 20000);   // 200 ريال
  expect(result.discount, 2000);    // 20 ريال
  expect(result.vat,      2700);    // 27 ريال
  expect(result.total,    20700);   // 207 ريال
});
```

**Tests مطلوبة:**
- [ ] `calculate_order_test.dart` — VAT inclusive/exclusive، خصم نسبة/مبلغ
- [ ] `validate_payment_test.dart` — دفع مختلط، آجل، اشتراك
- [ ] `deduct_credit_test.dart` — خصم رصيد، منع سالب، رصيد صفر
- [ ] `invoice_seq_test.dart` — تسلسل الأرقام atomic
- [ ] `loyalty_points_test.dart` — كسب وصرف النقاط
- [ ] `zatca_tlv_test.dart` — بناء TLV QR صحيح

### Integration Tests

- [ ] دورة بيع كاملة (POS → Invoice → Print → ZATCA queue)
- [ ] اشتراك: شراء → خصم → منع سالب → انتهاء
- [ ] ترحيل: MySQL → SQLite → validation

### Manual QA Checklist (لكل شاشة)

```
اسم الشاشة: _______    التاريخ: _______    المختبر: _______
[ ] كل الوظائف تعمل (4/4)
[ ] التصميم RTL ومطابق (3/3)
[ ] الأداء ضمن الحدود (2/2)
[ ] الحالات الاستثنائية مُعالجة (1/1)
التقييم: __/10
ملاحظات: _______
```

---

## 15. MVP Plan

### MVP الأول (10 شاشات — المرحلة 3)

**الهدف**: دورة بيع كاملة تعمل من الهاتف

| # | الشاشة | الأولوية | ملاحظة |
|---|--------|----------|--------|
| 1 | Login | P1 | بوابة الدخول |
| 2 | Settings (أساسية) | P1 | VAT rate، اسم المحل |
| 3 | Customers | P1 | بحث + إضافة سريعة |
| 4 | Products | P1 | قائمة + إضافة |
| 5 | Services | P1 | قائمة + إضافة |
| 6 | POS | P1 | كل وظائف البيع |
| 7 | Payment | P1 | كاش + بطاقة + مختلط |
| 8 | Invoices | P1 | قائمة + تفاصيل |
| 9 | Thermal Printing | P1 | Bluetooth 80mm |
| 10 | Daily Report | P1 | تقرير اليوم |

**معيار قبول MVP**: إتمام دورة بيع كاملة (فاتورة + طباعة + ZATCA queue) في < 60 ثانية.

### المرحلة الثانية (بعد MVP)

- Subscriptions + Credit Invoices
- Hotels & Companies
- Offers + Custom Prices
- Full Reports (11 تقرير)
- Users / Roles
- A4 Invoice (PDF)
- WhatsApp / Share

---

## 16. Full Implementation Phases

### المرحلة 1 — Foundation (أسبوع 1-2)

- [ ] إنشاء مشروع Flutter في `D:\PLUS\Laundry-apk`
- [ ] `pubspec.yaml` مع كل الـ dependencies
- [ ] `app_database.dart` — drift + جميع الجداول + indexes
- [ ] Riverpod providers setup
- [ ] GoRouter setup
- [ ] `money.dart` — محول المبالغ
- [ ] `app_theme.dart` — نفس ألوان النظام الحالي
- [ ] شاشة **Login** → 10/10
- [ ] Unit tests للـ money utils

**معيار الاكتمال**: تطبيق يُثبَّت على Android ويُسجَّل الدخول ✅

---

### المرحلة 2 — Migration (أسبوع 2-3)

- [ ] `tools/migrate/mysql_to_sqlite.js`
- [ ] `tools/migrate/validate_migration.js`
- [ ] Migration Integration Test
- [ ] تقرير `validation_report.json`

**معيار الاكتمال**: 100% بيانات مُرحّلة، صفر فارق ✅

---

### المرحلة 3 — MVP Core (أسبوع 3-6)

ترتيب البناء (كل شاشة → 10/10 قبل التالية):

- [ ] `CalculateOrder` use case + unit tests
- [ ] `CreateOrder` use case (SQLite transaction)
- [ ] `ValidatePayment` use case + unit tests
- [ ] **Customers** → 10/10
- [ ] **Products** → 10/10
- [ ] **Services** → 10/10
- [ ] **Payment** → 10/10
- [ ] **POS** → 10/10 *(أسبوع كامل)*
- [ ] **Invoices** → 10/10
- [ ] PrintService (Bluetooth ESC/POS)
- [ ] **Daily Report** → 10/10
- [ ] **Settings (أساسية)** → 10/10
- [ ] ZatcaService (queue + retry timer)
- [ ] **Dashboard** → 10/10

**معيار الاكتمال**: MVP يعمل كاملاً على Android ✅

---

### المرحلة 4 — Subscriptions (أسبوع 6-8)

- [ ] `DeductCredit` use case + unit tests
- [ ] **Subscriptions** → 10/10
- [ ] **Consumption Receipts** → 10/10
- [ ] **Subscription Receipts** → 10/10
- [ ] **Credit Invoices** → 10/10

**معيار الاكتمال**: إدارة اشتراكات كاملة ✅

---

### المرحلة 5 — Secondary Screens (أسبوع 8-10)

- [ ] **Hotels & Companies** → 10/10
- [ ] **Customer Custom Prices** → 10/10
- [ ] **Offers** → 10/10
- [ ] **Expenses** → 10/10
- [ ] **Hangers** → 10/10
- [ ] **Users** → 10/10
- [ ] **Roles** → 10/10
- [ ] **ZATCA Settings** → 10/10
- [ ] **Invoice A4** (PDF + share) → 10/10
- [ ] **WhatsApp/Share** → 10/10

---

### المرحلة 6 — Full Reports (أسبوع 10-12)

- [ ] **Reports Hub** → 10/10
- [ ] **Period Report** → 10/10
- [ ] **All Invoices Report** → 10/10
- [ ] **Credit Invoices Report** → 10/10
- [ ] **Subscriptions Report** → 10/10
- [ ] **Customer Account Report** → 10/10
- [ ] **Expenses Report** → 10/10
- [ ] **Worker Report** → 10/10
- [ ] **Types Report** → 10/10
- [ ] **Hotels & Companies Report** → 10/10
- [ ] **Zakat Report** → 10/10

---

### المرحلة 7 — Polish & Release (أسبوع 12-14)

- [ ] اختبار شامل على 3+ أجهزة Android
- [ ] iOS testing
- [ ] إصلاح كل bugs
- [ ] تحقق نهائي: جميع الـ 35 شاشة = 10/10
- [ ] Release APK build
- [ ] Release documentation

---

## 17. Screen-by-Screen Acceptance Criteria

**منهجية التقييم:**

| المحور | النقاط | الوصف |
|--------|--------|-------|
| الوظائف | /4 | كل وظيفة مذكورة في النظام الحالي تعمل |
| التصميم | /3 | RTL، عربي، ألوان مطابقة، رمز الريال |
| الأداء | /2 | ضمن الحدود المحددة في §18 |
| الاستثنائيات | /1 | أخطاء مُعالجة، رسائل عربية، لا crash |

### جدول التقييم الكامل

| # | الشاشة | المرحلة | /4 | /3 | /2 | /1 | **مجموع** | الحالة |
|---|--------|---------|-----|-----|-----|-----|-----------|--------|
| 1 | Login | 1 | - | - | - | - | **-/10** | ⏳ |
| 2 | Dashboard | 3 | - | - | - | - | **-/10** | ⏳ |
| 3 | POS | 3 | - | - | - | - | **-/10** | ⏳ |
| 4 | Invoices | 3 | - | - | - | - | **-/10** | ⏳ |
| 5 | Customers | 3 | - | - | - | - | **-/10** | ⏳ |
| 6 | Products | 3 | - | - | - | - | **-/10** | ⏳ |
| 7 | Services | 3 | - | - | - | - | **-/10** | ⏳ |
| 8 | Payment | 3 | - | - | - | - | **-/10** | ⏳ |
| 9 | Settings | 3 | - | - | - | - | **-/10** | ⏳ |
| 10 | Daily Report | 3 | - | - | - | - | **-/10** | ⏳ |
| 11 | Subscriptions | 4 | - | - | - | - | **-/10** | ⏳ |
| 12 | Credit Invoices | 4 | - | - | - | - | **-/10** | ⏳ |
| 13 | Consumption Receipts | 4 | - | - | - | - | **-/10** | ⏳ |
| 14 | Subscription Receipts | 4 | - | - | - | - | **-/10** | ⏳ |
| 15 | Hotels & Companies | 5 | - | - | - | - | **-/10** | ⏳ |
| 16 | Customer Custom Prices | 5 | - | - | - | - | **-/10** | ⏳ |
| 17 | Offers | 5 | - | - | - | - | **-/10** | ⏳ |
| 18 | Expenses | 5 | - | - | - | - | **-/10** | ⏳ |
| 19 | Hangers | 5 | - | - | - | - | **-/10** | ⏳ |
| 20 | Users | 5 | - | - | - | - | **-/10** | ⏳ |
| 21 | Roles | 5 | - | - | - | - | **-/10** | ⏳ |
| 22 | ZATCA Settings | 5 | - | - | - | - | **-/10** | ⏳ |
| 23 | Invoice A4 | 5 | - | - | - | - | **-/10** | ⏳ |
| 24 | WhatsApp/Share | 5 | - | - | - | - | **-/10** | ⏳ |
| 25 | Reports Hub | 6 | - | - | - | - | **-/10** | ⏳ |
| 26 | Period Report | 6 | - | - | - | - | **-/10** | ⏳ |
| 27 | All Invoices Report | 6 | - | - | - | - | **-/10** | ⏳ |
| 28 | Credit Invoices Report | 6 | - | - | - | - | **-/10** | ⏳ |
| 29 | Subscriptions Report | 6 | - | - | - | - | **-/10** | ⏳ |
| 30 | Customer Account Report | 6 | - | - | - | - | **-/10** | ⏳ |
| 31 | Expenses Report | 6 | - | - | - | - | **-/10** | ⏳ |
| 32 | Worker Report | 6 | - | - | - | - | **-/10** | ⏳ |
| 33 | Types Report | 6 | - | - | - | - | **-/10** | ⏳ |
| 34 | Hotels & Companies Report | 6 | - | - | - | - | **-/10** | ⏳ |
| 35 | Zakat Report | 6 | - | - | - | - | **-/10** | ⏳ |

**المستهدف: 35 × 10 = 350/350**

---

## 18. Performance Requirements

| العملية | الحد الأقصى | طريقة القياس |
|---------|------------|-------------|
| فتح التطبيق (cold start) | < 3 ثوانٍ | Stopwatch في `main()` |
| فتح شاشة POS | < 300ms | GoRouter transition |
| إضافة منتج للسلة | < 100ms | setState callback |
| حفظ الفاتورة | < 300ms | transaction duration |
| بحث عميل | < 200ms | SQL LIKE query |
| تحميل قائمة فواتير | < 500ms | Paginated (20 rows) |
| التقارير الكبيرة | < 2 ثانية | مع date filter |
| إرسال ZATCA | < 5 ثوانٍ | HTTP timeout |

**قواعد الأداء:**
- كل قائمة تستخدم `ListView.builder` (lazy loading)
- التقارير تشترط اختيار نطاق زمني قبل التحميل
- لا `SELECT *` بدون `LIMIT` في القوائم
- `Paginate` بـ 20 صف للفواتير والتقارير

---

## 19. Security Requirements

| المتطلب | التطبيق |
|---------|---------|
| تخزين JWT | `flutter_secure_storage` — لا SharedPreferences |
| بيانات ZATCA (شهادات) | `flutter_secure_storage` |
| ملف SQLite | داخل app sandbox (لا يظهر للمستخدم العادي) |
| Secrets في الكود | ممنوع — كل secrets في runtime config |
| صلاحيات المستخدمين | RBAC من `role_permissions` — check في كل notifier |
| منع الوصول غير المصرح | AuthGuard في GoRouter لكل route |

```dart
// router.dart — AuthGuard
redirect: (context, state) {
  final isLoggedIn = ref.read(authProvider).isLoggedIn;
  if (!isLoggedIn) return '/login';
  final canAccess = ref.read(permissionsProvider).canAccess(state.path);
  if (!canAccess) return '/unauthorized';
  return null;
},
```

---

## 20. Risk Register

| # | الخطر | التأثير | الاحتمالية | الوقاية | خطة العلاج |
|---|-------|---------|-----------|---------|------------|
| R1 | اختلاف حسابات الفاتورة عن النظام الحالي | عالٍ جداً | متوسطة | Use Case واحد + unit tests | مقارنة 100 فاتورة تاريخية |
| R2 | فشل ترحيل البيانات | عالٍ | منخفضة | validate_migration.js | إعادة من الصفر (idempotent) |
| R3 | رفض ZATCA للفواتير | عالٍ (قانوني) | منخفضة | اختبار TLV + sandbox | وضع `rejected` + تنبيه يدوي |
| R4 | مشاكل طابعة Bluetooth | متوسط | متوسطة | اختبار على 3+ طابعات | fallback: PDF share |
| R5 | بطء التقارير | متوسط | متوسطة | indexes + date filter | pagination + lazy load |
| R6 | تكرار منطق الفواتير في أماكن متعددة | عالٍ | عالية | Code review gate | refactor إلى Use Case واحد |
| R7 | ضياع ملف SQLite | عالٍ جداً | منخفضة | تحذير مستمر + export button | restore من backup |
| R8 | اختلاف التقارير بين MySQL وSQLite | عالٍ | منخفضة | validate_migration + رصد أسبوعي | تحليل الفارق وتصحيح |
| R9 | تعارض عمل الفريق | متوسط | متوسطة | branching strategy + PR صغيرة | merge develop يومياً |
| R10 | crash في production بسبب null | متوسط | متوسطة | no `!` operator، null safety strict | Crashlytics monitoring |

---

## 21. Release Plan

راجع `docs/release-plan.md` للتفاصيل.

### أنواع الإصدارات

| النوع | الجمهور | الهدف |
|-------|---------|-------|
| Debug APK | فريق التطوير | اختبار أثناء التطوير |
| Internal Testing APK | QA Tester | اختبار قبل الإطلاق |
| Release APK | العميل | الإصدار النهائي |

### Versioning

```
MAJOR.MINOR.PATCH
1.0.0  — MVP الأول
1.1.0  — إضافة Subscriptions
2.0.0  — تغيير كبير في architecture
```

### تحديث التطبيق بدون ضياع SQLite

```
1. نسخ ملف SQLite احتياطياً قبل التثبيت
2. تثبيت APK الجديد (لا يمسح البيانات)
3. drift يُشغّل migrations التدريجية
4. التحقق من البيانات
```

### Rollback Plan

إذا فشل تحديث:
```
1. uninstall APK الجديد
2. install APK القديم
3. restore SQLite backup
```

### Release Checklist

- [ ] جميع 35 شاشة = 10/10
- [ ] جميع unit tests تجتاز
- [ ] integration tests تجتاز
- [ ] validate_migration report صفر فارق
- [ ] ZATCA اختُبر في sandbox
- [ ] طباعة اختُبرت على 3 طابعات
- [ ] اختبار على Android 8, 10, 12, 14
- [ ] لا hardcoded secrets في الكود
- [ ] `flutter analyze` صفر warnings
- [ ] Release APK موقّع

---

## 22. Definition of Done

### للشاشة

- [ ] الوظائف كاملة ومطابقة للنظام الحالي
- [ ] RTL + عربي + رمز الريال صحيح
- [ ] لا business logic في الـ Widget أو Notifier
- [ ] Unit tests لكل use case مرتبط
- [ ] Manual QA: 10/10
- [ ] PR مُراجَع من Team Lead
- [ ] لا `double` للمبالغ المالية
- [ ] لا hardcoded strings عربية داخل الكود

### للمشروع

- [ ] 35 شاشة × 10/10
- [ ] 0 failing tests
- [ ] Migration validation: صفر فارق
- [ ] ZATCA: نجح في sandbox
- [ ] Bluetooth print: نجح على 3 طابعات
- [ ] Release APK يعمل على Android 8+
- [ ] `docs/` كاملة ومُحدَّثة

---

## 23. Final Checklist (قبل الإطلاق)

### Architecture
- [ ] كل use case منفصل في ملفه
- [ ] لا SQL في Notifiers أو Screens
- [ ] لا حسابات مالية في Widgets
- [ ] `money.dart` هو المرجع الوحيد للتحويل

### Business Logic
- [ ] معادلة الفاتورة مطابقة للنظام الحالي (unit test يؤكد)
- [ ] الدفع المختلط: paid_cash + paid_card == total (فرق ≤ 1)
- [ ] رصيد الاشتراك: لا يقل عن صفر (DB constraint + use case)
- [ ] invoice_seq: تسلسلي atomic (integration test يؤكد)

### Database
- [ ] جميع indexes موجودة
- [ ] FOREIGN KEY مُفعَّل
- [ ] CHECK constraints مُفعَّلة
- [ ] Migration validation: صفر فارق

### ZATCA
- [ ] كل فاتورة مكتملة تدخل zatca_queue
- [ ] Retry يعمل كل 15 دقيقة
- [ ] لا إعادة إرسال فاتورة submitted
- [ ] آخر خطأ محفوظ

### Security
- [ ] JWT في secure storage
- [ ] شهادات ZATCA في secure storage
- [ ] لا secrets في الكود
- [ ] RBAC مُطبَّق على كل route

### Release
- [ ] `flutter analyze` صفر warnings
- [ ] Release APK موقّع
- [ ] نسخة احتياطية من SQLite قبل كل إصدار

---

## Documentation Files

```
specs/001-mobile-apk-conversion/
├── spec.md              ✅
├── plan.md              ✅ هذا الملف
├── data-model.md        ✅
├── quickstart.md        ✅
├── tasks.md             ← /speckit-tasks
└── docs/
    ├── business-rules.md     ← ينشأ في المرحلة 1
    ├── database-mapping.md   ← ينشأ في المرحلة 2
    ├── architecture.md       ← ينشأ في المرحلة 1
    ├── testing-strategy.md   ← ينشأ في المرحلة 3
    ├── zatca-plan.md         ← ينشأ في المرحلة 5
    ├── printing-plan.md      ← ينشأ في المرحلة 3
    ├── security.md           ← ينشأ في المرحلة 1
    ├── performance.md        ← ينشأ في المرحلة 3
    ├── risk-register.md      ← ينشأ في المرحلة 1
    └── release-plan.md       ← ينشأ في المرحلة 7
```
