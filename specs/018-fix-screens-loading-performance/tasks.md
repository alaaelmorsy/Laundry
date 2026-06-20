# Tasks: إصلاح بطء تحميل شاشتي الخدمات والمنتجات

**Input**: Design documents from `specs/018-fix-screens-loading-performance/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | quickstart.md ✅

**Tests**: لا — التحقق يدوي وفق quickstart.md

**Organization**: جميع التغييرات في `database/db.js` — 4 خطوات مرتبة حسب التبعية.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تنفيذه بالتوازي (ملفات مختلفة، لا تبعيات)
- **[Story]**: قصة المستخدم التي تنتمي إليها المهمة
- لا يوجد ملف جديد — كل التعديلات في `database/db.js`

---

## Phase 1: Setup (لا يوجد — ملف واحد فقط)

لا حاجة لأي تهيئة أو بنية مشاريع جديدة. التغييرات كلها في ملف واحد موجود.

---

## Phase 2: Foundational — إضافة الفهارس (تسبق كل شيء)

**Purpose**: الفهارس تُضاف عند بدء التطبيق وتفيد كل الشاشات. يجب إضافتها أولاً لأنها مستقلة تماماً عن تعديلات الاستعلامات.

**⚠️ CRITICAL**: هذه المهمة تفيد قصص المستخدم US1 وUS2 وUS3 معاً.

- [x] T001 في `database/db.js` داخل دالة `db.initialize()` بعد آخر `CREATE INDEX IF NOT EXISTS` (≈ السطر 1153)، أضف 5 فهارس جديدة:
  ```js
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ppl_product_id ON product_price_lines (product_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products (sort_order)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_search ON products (name_ar, name_en)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_services_sort_order ON laundry_services (sort_order)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_services_search ON laundry_services (name_ar, name_en)`).catch(() => {});
  ```

**Checkpoint**: بعد إعادة تشغيل التطبيق، تحقق بـ `SHOW INDEX FROM products` وتأكد من وجود الفهارس.

---

## Phase 3: User Story 1 + 2 — إصلاح `getProducts` (P1) 🎯 MVP

**Goal**: إزالة الـ correlated subquery N+1 من شاشة المنتجات باستخدام LEFT JOIN.

**Independent Test**: افتح شاشة المنتجات — يجب أن تظهر البيانات بسرعة واضحة. عمود "عدد العمليات" يجب أن يعرض نفس الأرقام كما قبل.

### Implementation

- [x] T002 [US1] في `database/db.js` دالة `buildProductsOrderBy` (≈ السطر 1936)، عدّل fragment الـ `lines`:
  ```js
  // قبل:
  lines: '(SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id)',
  // بعد:
  lines: 'COUNT(ppl.id)',
  ```

- [x] T003 [US1] في `database/db.js` دالة `getProducts` (≈ السطر 2097)، عدّل الاستعلام المُرقَّم (paginated) ليستخدم LEFT JOIN:

  **أبقِ** `countSql` بدون تغيير (عد الصفوف لا يحتاج JOIN):
  ```js
  const countSql = `SELECT COUNT(*) as total FROM products p WHERE 1=1${whereClauses}`;
  ```

  **عدّل** `dataSql` ليستخدم JOIN + GROUP BY:
  ```js
  const dataSql = `
    SELECT p.id, p.name_ar, p.name_en, p.is_active, p.created_at, p.sort_order,
      (p.image_blob IS NOT NULL) AS has_image,
      COUNT(ppl.id) AS price_line_count
    FROM products p
    LEFT JOIN product_price_lines ppl ON ppl.product_id = p.id
    WHERE 1=1${whereClauses}
    GROUP BY p.id
    ${orderSql}
    LIMIT ? OFFSET ?`;
  ```

  **احذف** المتغير `baseFrom` أو أبقِه للـ `countSql` فقط.

- [x] T004 [US1] في نفس الدالة `getProducts`، عدّل الاستعلام بدون pagination (الـ fallback في نهاية الدالة ≈ السطر 2137):
  ```js
  const [rows] = await pool.query(
    `SELECT p.id, p.name_ar, p.name_en, p.is_active, p.created_at, p.sort_order,
       (p.image_blob IS NOT NULL) AS has_image,
       COUNT(ppl.id) AS price_line_count
     FROM products p
     LEFT JOIN product_price_lines ppl ON ppl.product_id = p.id
     WHERE 1=1${whereClauses}
     GROUP BY p.id
     ${orderSql}`,
    params
  );
  ```

**Checkpoint**: افتح شاشة المنتجات — يظهر الجدول بسرعة، عمود عدد العمليات صحيح.

---

## Phase 4: User Story 2 — إصلاح `getAllLaundryServices` (P1)

**Goal**: استبدال `SELECT *` بأعمدة محددة في استعلامات شاشة الخدمات.

**Independent Test**: افتح شاشة الخدمات — تظهر الخدمات بسرعة، وعمليات الإضافة/التعديل/الحذف تعمل كالمعتاد.

### Implementation

- [x] T005 [US2] في `database/db.js` دالة `getAllLaundryServices` (≈ السطر 1947)، أضف ثابتاً للأعمدة وعدّل كلا الاستعلامين:
  ```js
  const COLS = 'id, name_ar, name_en, is_active, sort_order, created_at';
  ```

  **عدّل** الاستعلام المُرقَّم (paginated) ≈ السطر 1967:
  ```js
  const dataSql = `SELECT ${COLS} ${baseFrom} ${orderSql} LIMIT ? OFFSET ?`;
  ```

  **عدّل** الاستعلام بدون pagination ≈ السطر 1984:
  ```js
  const [rows] = await pool.query(`SELECT ${COLS} ${baseFrom} ${orderSql}`, params);
  ```

**Checkpoint**: افتح شاشة الخدمات — تظهر جميع الخدمات بنفس البيانات السابقة.

---

## Phase 5: User Story 3 — التحقق الشامل والفرز

**Goal**: التأكد من أن الفرز بعمود "عدد العمليات" يعمل بسرعة بعد التعديل.

**Independent Test**: اضغط رأس عمود "عدد العمليات" في شاشة المنتجات — يُعاد الترتيب بسرعة.

### Implementation

- [ ] T006 [US3] تحقق يدوي: افتح شاشة المنتجات، اضغط على رأس عمود "عدد العمليات" مرتين (تصاعدي ثم تنازلي). يجب أن:
  - الترتيب يتغير بشكل صحيح
  - المنتجات بدون عمليات (`COUNT = 0`) تظهر أولاً أو آخراً حسب الاتجاه
  - لا يوجد خطأ في الـ console

- [ ] T007 [US3] تحقق بـ SQL مباشرة (اختياري، للتأكد):
  ```sql
  EXPLAIN SELECT p.id, COUNT(ppl.id) AS price_line_count
  FROM products p
  LEFT JOIN product_price_lines ppl ON ppl.product_id = p.id
  GROUP BY p.id
  ORDER BY COUNT(ppl.id) ASC;
  ```
  تحقق من أن `type` ليس `ALL` (full table scan).

**Checkpoint**: جميع سيناريوهات quickstart.md مكتملة بنجاح.

---

## Phase 6: Polish — التحقق النهائي

- [ ] T008 [P] شغّل التطبيق وافتح شاشة المنتجات + شاشة الخدمات وتأكد من غياب أي خطأ في `console` أو `boot.log`
- [ ] T009 نفّذ جميع سيناريوهات [quickstart.md](quickstart.md) وتأكد من اجتيازها كلها
- [ ] T010 [P] تحقق من وجود الفهارس الخمسة بتشغيل `SHOW INDEX FROM products`، `SHOW INDEX FROM product_price_lines`، `SHOW INDEX FROM laundry_services`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: لا تبعيات — ابدأ فوراً
- **Phase 3 (US1 — getProducts)**: تعتمد على T001 (الفهارس) لكن يمكن تطبيقها بالتوازي
- **Phase 4 (US2 — getAllLaundryServices)**: مستقلة تماماً — يمكن تطبيقها بالتوازي مع Phase 3
- **Phase 5 (US3 — التحقق من الفرز)**: تعتمد على Phase 3 (T002, T003, T004)
- **Phase 6 (Polish)**: تعتمد على اكتمال كل شيء

### User Story Dependencies

- **US1** (getProducts): يعتمد على T001 (فهارس) — مستقل عن US2
- **US2** (getAllLaundryServices): مستقل تماماً — يمكن تطبيقه قبل أو بعد US1
- **US3** (التحقق من الفرز): يعتمد على US1 (T002, T003, T004)

### Within Each Story

- T002 يجب أن يسبق T003 (تعديل fragment الفرز قبل تعديل الاستعلام الرئيسي)
- T003 يجب أن يسبق T004 (paginated query قبل non-paginated)

### Parallel Opportunities

- T001 يمكن تنفيذه بالتوازي مع T005 (ملفات/أقسام مختلفة في db.js)
- T002 + T003 + T004 متسلسلة (نفس الدالة، نفس المنطق)
- T005 مستقل تماماً عن T002-T004

---

## Parallel Example

```
# يمكن تنفيذ هذين بالتوازي:
T001: إضافة الفهارس في db.initialize()   ← Phase 2
T005: تعديل getAllLaundryServices          ← Phase 4

# ثم بالتسلسل:
T002 → T003 → T004: إصلاح getProducts    ← Phase 3
```

---

## Implementation Strategy

### MVP First (T001 → T002 → T003 → T004)

1. أضف الفهارس (T001) — أسرع تحسين وأثره فوري
2. أصلح `getProducts` (T002, T003, T004) — التأثير الأكبر
3. **STOP and VALIDATE**: افتح شاشة المنتجات وتحقق من السرعة
4. أصلح `getAllLaundryServices` (T005)
5. تحقق نهائي (T006-T010)

### الترتيب المقترح للتنفيذ الكامل

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010
```

الوقت المتوقع: 30-45 دقيقة لكل التغييرات.

---

## Notes

- كل التغييرات في ملف واحد: `database/db.js`
- لا تغييرات في الواجهة الأمامية أو الـ API layer
- `[P]` = يمكن تنفيذه بالتوازي مع مهام أخرى
- التحقق النهائي باتباع [quickstart.md](quickstart.md)
- لا حاجة لـ commit منفصل لكل مهمة — commit واحد بعد اكتمال الكل يكفي
