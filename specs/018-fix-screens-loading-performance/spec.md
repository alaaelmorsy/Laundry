# Feature Specification: إصلاح بطء تحميل شاشة الخدمات وشاشة المنتجات

**Feature Branch**: `018-fix-screens-loading-performance`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "لماذا شاشة الخدمات وشاشة العمليات لاتظهر بها المنتجات والعمليات بسرعة جدا — لماذا تأخذ وقت كبير جدا حتى تفتح ويظهر جميع المنتجات والعمليات"

## تشخيص المشكلة (Root Cause Analysis)

شاشتا **الخدمات** (`screens/services/`) و**المنتجات** (`screens/products/`) تُعاني من بطء التحميل الأولي بسبب المشاكل التالية المكتشفة في الكود:

### المشكلة الرئيسية — Correlated Subquery لكل صف (database/db.js:2117)

في دالة `getProducts`، يُنفَّذ لكل منتج استعلام فرعي مترابط منفصل:
```sql
(SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id) AS price_line_count
```
هذا يعني أنه مع 100 منتج → 100 استعلام إضافي على قاعدة البيانات في كل مرة تُفتح الشاشة.

### المشكلة الثانية — ORDER BY بـ Correlated Subquery (db.js:1936)

عند الفرز حسب عمود "عدد العمليات"، يصبح الاستعلام الفرعي في `ORDER BY`:
```sql
ORDER BY (SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id)
```
وهو أبطأ بكثير لأن MySQL تُنفِّذه لكل صف قبل الترتيب.

### المشكلة الثالثة — غياب الفهارس (Indexes)

لا توجد فهارس على الأعمدة الأكثر استخداماً في البحث والفرز:
- `products.sort_order` — مستخدم في الترتيب الافتراضي
- `products.name_ar`, `products.name_en` — مستخدمان في `LIKE` البحث
- `product_price_lines.product_id` — مستخدم في الـ subquery
- `laundry_services.sort_order`, `laundry_services.name_ar`

### المشكلة الرابعة — SELECT * في شاشة الخدمات (db.js:1967)

استعلام الخدمات يستخدم `SELECT *` بدلاً من تحديد الأعمدة المطلوبة فقط.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - تحميل سريع لشاشة المنتجات (Priority: P1)

عندما يفتح المستخدم شاشة المنتجات، يجب أن تظهر قائمة المنتجات فورياً دون انتظار.

**Why this priority**: هذه هي أكثر الشاشات تضرراً بسبب الـ correlated subquery الذي يتكرر مع كل منتج.

**Independent Test**: فتح شاشة المنتجات وقياس الوقت من الضغط على الرابط حتى ظهور البيانات في الجدول.

**Acceptance Scenarios**:

1. **Given** قاعدة بيانات تحتوي على 50+ منتج, **When** يفتح المستخدم شاشة المنتجات, **Then** تظهر الصفحة الأولى من المنتجات في أقل من ثانيتين
2. **Given** منتجات مع عمليات متعددة, **When** يُحمَّل الجدول, **Then** يظهر عدد العمليات لكل منتج بشكل صحيح

---

### User Story 2 - تحميل سريع لشاشة الخدمات (Priority: P1)

عندما يفتح المستخدم شاشة الخدمات، تظهر قائمة الخدمات بسرعة.

**Why this priority**: مساوية للمنتجات في الأولوية — كلتاهما شاشات إدارية يفتحها المستخدم بانتظام.

**Independent Test**: فتح شاشة الخدمات وقياس وقت ظهور البيانات.

**Acceptance Scenarios**:

1. **Given** قاعدة بيانات تحتوي على 20+ خدمة, **When** يفتح المستخدم شاشة الخدمات, **Then** تظهر الخدمات في أقل من ثانية واحدة
2. **Given** البحث عن خدمة بالاسم, **When** يكتب المستخدم في خانة البحث, **Then** تظهر النتائج بعد 300ms (debounce) دون بطء إضافي

---

### User Story 3 - الفرز السريع بعمود عدد العمليات (Priority: P2)

عند الضغط على رأس عمود "عدد العمليات" للفرز، تستجيب الشاشة بسرعة.

**Why this priority**: مهم للأداء العام لكنه سيناريو فرعي أقل تكراراً من التحميل الأولي.

**Independent Test**: الضغط على رأس العمود "عدد العمليات" وقياس وقت إعادة ترتيب الجدول.

**Acceptance Scenarios**:

1. **Given** جدول منتجات مُحمَّل, **When** يضغط المستخدم على رأس عمود عدد العمليات, **Then** يُعاد ترتيب الجدول في أقل من ثانيتين

---

### Edge Cases

- ماذا يحدث إذا لم تكن هناك منتجات أو خدمات؟ → يظهر حالة "فارغ" بسرعة مثل السابق
- هل تؤثر الفهارس على عمليات الإضافة/التعديل/الحذف؟ → لا تأثير ملحوظ لأن الجداول صغيرة نسبياً
- هل تظل البيانات صحيحة بعد التحسين؟ → نعم، الفهارس والـ JOIN لا تغير النتائج

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: يجب استبدال الـ correlated subquery في `getProducts` بـ `LEFT JOIN` مع `GROUP BY` لحساب `price_line_count` مرة واحدة
- **FR-002**: يجب إضافة فهرس على `product_price_lines.product_id` عبر migration idempotent في `db.initialize()`
- **FR-003**: يجب إضافة فهارس على `products.sort_order` و`products.name_ar` و`products.name_en`
- **FR-004**: يجب إضافة فهارس على `laundry_services.sort_order` و`laundry_services.name_ar`
- **FR-005**: يجب استبدال `SELECT *` في استعلام الخدمات بقائمة أعمدة محددة
- **FR-006**: يجب أن تظل جميع نتائج الاستعلامات متطابقة مع الحالة الحالية (لا يتغير أي سلوك مرئي)
- **FR-007**: يجب أن تتبع migrations نمط `try { ALTER/CREATE INDEX } catch (_) {}` الموجود في `db.initialize()`

### Key Entities

- **products**: جدول المنتجات، يُستعلَم مع عدّ صفوف `product_price_lines` لكل منتج
- **product_price_lines**: جدول أسعار المنتج بحسب الخدمة، العمود `product_id` بحاجة لفهرس
- **laundry_services**: جدول الخدمات، يُستعلَم بالبحث والفرز

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: تفتح شاشة المنتجات (50+ منتج) وتعرض البيانات في أقل من ثانيتين على جهاز المستخدم
- **SC-002**: تفتح شاشة الخدمات (20+ خدمة) وتعرض البيانات في أقل من ثانية واحدة
- **SC-003**: الفرز بأي عمود في شاشة المنتجات يكتمل في أقل من ثانيتين
- **SC-004**: لا يتغير أي سلوك مرئي — نفس البيانات، نفس الترتيب الافتراضي، نفس الترقيم

## Assumptions

- عدد المنتجات والخدمات في الإنتاج لا يتجاوز بضع مئات (نظام أحادي المستأجر)
- MySQL/MariaDB تدعم `CREATE INDEX IF NOT EXISTS` أو يمكن استخدام `try/catch` لإنشاء الفهارس
- التحسين يكفي بتعديل `database/db.js` فقط دون تغيير في الواجهة الأمامية
- لا توجد حاجة لـ caching طبقة إضافية — الفهارس وحدها كافية للحجم المتوقع
