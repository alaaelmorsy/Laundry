# A4 Invoice Mobile Print - Bugfix Design

## Overview

فاتورة A4 مبنية بأبعاد ثابتة (210mm) تناسب الطباعة من سطح المكتب فقط. عند فتحها من جهاز جوال تتجاوز عناصر الصفحة حدود الشاشة الضيقة مما يُظهر شريط تمرير أفقي ويقطع المحتوى عند الطباعة.

استراتيجية الإصلاح: إضافة `@media` query لشاشات أقل من 768px في ملف `invoice-a4.css` يُحوّل التخطيط إلى عمود واحد ويجعل `.a4-paper` يملأ عرض الشاشة، مع الحفاظ على التخطيط الحالي كاملاً على شاشات سطح المكتب وعند الطباعة منه.

---

## Glossary

- **Bug_Condition (C)**: الحالة التي تُظهر الخلل — عرض الشاشة أقل من 768px مع وجود عناصر CSS ذات أبعاد ثابتة بالـ mm أو grids متعددة الأعمدة بلا breakpoints
- **Property (P)**: السلوك الصحيح المطلوب — الفاتورة تملأ عرض الشاشة بالكامل بلا تمرير أفقي وتُطبع بشكل مقروء
- **Preservation**: التخطيط الحالي على شاشات سطح المكتب (≥ 768px) وسلوك الطباعة منها يجب أن يبقى دون أي تغيير
- **`.a4-paper`**: الحاوية الرئيسية في `invoice-a4.css` التي تحمل العرض الثابت `width: 210mm`
- **`.a4-header`**: grid ثلاثي الأعمدة للرأس الثنائي اللغة والشعار
- **`.a4-meta-grid`**: grid ثلاثي الأعمدة لبيانات الفاتورة (رقم، تاريخ، دفع)
- **`.a4-bill-to`**: grid ثنائي الأعمدة لبيانات العميل والتواريخ
- **`.a4-summary`**: flex row يضم QR والإجماليات
- **`.a4-items`**: جدول ثماني الأعمدة لبنود الفاتورة
- **`@media print`**: كتلة CSS موجودة تتحكم في تخطيط الطباعة من سطح المكتب

---

## Bug Details

### Bug Condition

الخلل يظهر عندما يفتح المستخدم صفحة الفاتورة على شاشة جوال (عرض < 768px). ملف `invoice-a4.css` يُعرّف `.a4-paper` بعرض ثابت `210mm` (~794px) دون أي media query للشاشات الضيقة، كما أن جميع عناصر الـ grid والـ flex تفترض عرضاً كافياً لأعمدة متعددة.

**Formal Specification:**
```
FUNCTION isBugCondition(viewport)
  INPUT: viewport of type ViewportState
  OUTPUT: boolean

  RETURN viewport.width < 768
         AND document.querySelector('.a4-paper') EXISTS
         AND getComputedStyle('.a4-paper').width == '210mm'
         AND noMobileMediaQueryExists('.a4-paper')
END FUNCTION
```

### Examples

- **مثال 1**: مستخدم يفتح الفاتورة على iPhone 14 (390px عرضاً) → يظهر شريط تمرير أفقي، المحتوى يمتد خارج الشاشة بمقدار ~400px
- **مثال 2**: مستخدم يضغط "طباعة" من Samsung Galaxy (360px) → تُطبع الفاتورة بعرض 210mm مما يقطع العمود الأيسر من الجدول
- **مثال 3**: مستخدم يفتح الفاتورة على iPad (768px) → الحالة الحدية، يجب أن يعمل التخطيط الثابت بشكل طبيعي
- **حالة حدية**: شاشة بعرض 767px → يجب تطبيق التخطيط المتجاوب (mobile layout)

---

## Expected Behavior

### Preservation Requirements

**السلوكيات التي يجب أن تبقى دون تغيير:**
- عرض الفاتورة على شاشات سطح المكتب (≥ 768px) يجب أن يستمر بأبعاد A4 الثابتة (210mm) كما هو
- الطباعة من متصفح سطح المكتب يجب أن تستمر بحجم A4 portrait مع جميع التنسيقات الحالية
- جميع بيانات الفاتورة (الرأس، بيانات العميل، البنود، الإجماليات، QR) يجب أن تظهر كاملة على أي جهاز
- شريط الأدوات (أزرار الطباعة والإغلاق) يجب أن يعمل بشكل صحيح ويختفي عند الطباعة

**النطاق:**
جميع المدخلات التي لا تنطبق عليها حالة الخلل (viewport.width ≥ 768px) يجب أن تبقى غير متأثرة بالإصلاح تماماً. هذا يشمل:
- أي متصفح على شاشة عرضها 768px أو أكثر
- طباعة الفاتورة من سطح المكتب عبر `@media print`
- عرض الفاتورة على شاشات عريضة (1920px وما فوق)

**ملاحظة:** السلوك الصحيح المطلوب على الجوال مُعرَّف في قسم Correctness Properties (Property 1).

---

## Hypothesized Root Cause

بناءً على تحليل ملف `invoice-a4.css`:

1. **عرض ثابت بالـ mm على `.a4-paper`**: السطر `width: 210mm` يُحدد عرضاً مطلقاً يتجاوز عرض أي شاشة جوال. لا يوجد `max-width` أو `width: 100%` كبديل للشاشات الضيقة.

2. **Grid متعدد الأعمدة بلا breakpoints**:
   - `.a4-header`: `grid-template-columns: 1fr 110px 1fr` — ثلاثة أعمدة ثابتة
   - `.a4-meta-grid`: `grid-template-columns: repeat(3, 1fr)` — ثلاثة أعمدة
   - `.a4-bill-to`: `grid-template-columns: 1fr 1fr` — عمودان
   - `.a4-summary`: `flex-direction: row` — عناصر جنباً إلى جنب

3. **جدول البنود ثماني الأعمدة**: `.a4-items` يحتوي على 8 أعمدة بعرض ثابت نسبياً، لا يوجد `overflow-x: auto` على الحاوية.

4. **غياب `@media` query للشاشات الضيقة**: ملف CSS يحتوي فقط على `@media print` دون أي `@media screen and (max-width: 767px)`.

---

## Correctness Properties

Property 1: Bug Condition - Mobile Responsive Layout

_For any_ viewport where the bug condition holds (isBugCondition returns true — عرض < 768px), the fixed CSS SHALL render `.a4-paper` filling the full screen width without horizontal scrollbar, convert all multi-column grids to single-column layout, and allow the items table to scroll horizontally within a bounded container, ensuring all invoice content is readable on mobile screens.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Desktop and Print Layout Unchanged

_For any_ viewport where the bug condition does NOT hold (isBugCondition returns false — عرض ≥ 768px), the fixed CSS SHALL produce exactly the same visual output as the original CSS, preserving the A4 fixed-width layout (210mm), all multi-column grids, and the existing `@media print` behavior for desktop printing.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

**File**: `screens/invoice-a4/invoice-a4.css`

**Approach**: إضافة `@media screen and (max-width: 767px)` block في نهاية الملف (قبل أو بعد `@media print`)

**Specific Changes**:

1. **`.a4-paper` — إزالة العرض الثابت على الجوال**:
   ```css
   .a4-paper {
     width: 100%;
     min-height: unset;
     margin: 0;
     padding: 4mm 4mm 10mm;
     box-shadow: none;
   }
   ```

2. **`.a4-header` — تحويل إلى عمود واحد**:
   ```css
   .a4-header {
     grid-template-columns: 1fr;
   }
   .a4-header-ar { grid-column: 1; grid-row: 1; }
   .a4-header-logo { grid-column: 1; grid-row: 2; }
   .a4-header-en { grid-column: 1; grid-row: 3; text-align: right; direction: rtl; }
   ```

3. **`.a4-meta-grid` و `.a4-bill-to` — تحويل إلى عمود واحد**:
   ```css
   .a4-meta-grid { grid-template-columns: 1fr; }
   .a4-meta-cell { border-left: none; border-bottom: 2px solid #000; }
   .a4-meta-cell:last-child { border-bottom: none; }
   .a4-bill-to { grid-template-columns: 1fr; }
   ```

4. **`.a4-items` — تمرير أفقي داخل حاوية**:
   ```css
   /* في HTML: لف الجدول بـ <div class="a4-items-wrap"> */
   .a4-items-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
   .a4-items { min-width: 500px; }
   ```
   أو بديلاً: تطبيق `overflow-x: auto` مباشرة على عنصر أب موجود.

5. **`.a4-summary` — تحويل إلى عمود**:
   ```css
   .a4-summary { flex-direction: column; }
   .a4-totals { width: 100%; }
   .a4-notes-box { width: 100%; }
   ```

6. **`.a4-actions` — تحسين شريط الأدوات على الجوال**:
   ```css
   .a4-actions { padding: 8px 12px; }
   ```

**ملاحظة حول الجدول**: إذا كان لف الجدول بـ `div` يتطلب تعديل HTML، يمكن بدلاً من ذلك تطبيق `overflow-x: auto` على `.a4-paper` نفسه فقط للجدول عبر تغليف CSS، أو قبول التمرير الأفقي للجدول فقط داخل الصفحة المتجاوبة.

---

## Testing Strategy

### Validation Approach

تتبع استراتيجية الاختبار مرحلتين: أولاً استكشاف الخلل على الكود غير المُصلح للتحقق من تحليل السبب الجذري، ثم التحقق من صحة الإصلاح وعدم تأثيره على السلوك الموجود.

### Exploratory Bug Condition Checking

**الهدف**: إظهار أمثلة مضادة تُثبت الخلل على الكود الحالي قبل الإصلاح. تأكيد أو نفي تحليل السبب الجذري.

**خطة الاختبار**: فتح `invoice-a4.html` في المتصفح مع تفعيل DevTools وضبط viewport على 390px، ثم فحص العناصر وقياس overflow.

**Test Cases**:
1. **اختبار العرض الثابت**: ضبط viewport على 390px والتحقق من أن `.a4-paper` عرضه 210mm (~794px) — سيفشل على الكود غير المُصلح
2. **اختبار الـ Grid**: التحقق من أن `.a4-header` يعرض 3 أعمدة على شاشة 390px — سيُظهر تداخلاً
3. **اختبار الجدول**: التحقق من أن `.a4-items` يتجاوز حدود الشاشة — سيُظهر overflow
4. **اختبار الطباعة من الجوال**: محاكاة `@media print` على viewport ضيق — سيُظهر قطع المحتوى

**Expected Counterexamples**:
- `document.querySelector('.a4-paper').getBoundingClientRect().width` يُرجع ~794 بدلاً من 390
- `document.body.scrollWidth > window.innerWidth` يُرجع `true`

### Fix Checking

**الهدف**: التحقق من أن جميع المدخلات التي تنطبق عليها حالة الخلل تُنتج السلوك الصحيح بعد الإصلاح.

**Pseudocode:**
```
FOR ALL viewport WHERE isBugCondition(viewport) DO
  result := renderInvoice_fixed(viewport)
  ASSERT result.hasHorizontalScrollbar == false
  ASSERT result.a4PaperWidth <= viewport.width
  ASSERT result.allContentVisible == true
  ASSERT result.allGridsSingleColumn == true
END FOR
```

### Preservation Checking

**الهدف**: التحقق من أن جميع المدخلات التي لا تنطبق عليها حالة الخلل تُنتج نفس النتيجة قبل وبعد الإصلاح.

**Pseudocode:**
```
FOR ALL viewport WHERE NOT isBugCondition(viewport) DO
  ASSERT renderInvoice_original(viewport) == renderInvoice_fixed(viewport)
END FOR
```

**نهج الاختبار**: يُنصح باستخدام Property-Based Testing للتحقق من الـ Preservation لأنه:
- يُولّد حالات اختبار كثيرة تلقائياً عبر نطاق المدخلات
- يكتشف حالات حدية قد تفوت الاختبارات اليدوية
- يُقدم ضمانات قوية بأن السلوك لم يتغير لجميع المدخلات غير المعطوبة

**خطة الاختبار**: رصد السلوك على الكود غير المُصلح لشاشات سطح المكتب أولاً، ثم كتابة اختبارات property-based تُثبت استمرار هذا السلوك بعد الإصلاح.

**Test Cases**:
1. **Preservation — Desktop Layout**: التحقق من أن `.a4-paper` يحتفظ بعرض 210mm على viewport ≥ 768px بعد الإصلاح
2. **Preservation — Print Media**: التحقق من أن `@media print` لا يزال يُطبق `width: 210mm` بعد الإصلاح
3. **Preservation — Grid Columns**: التحقق من أن `.a4-header` يحتفظ بـ 3 أعمدة على viewport ≥ 768px
4. **Preservation — Content Completeness**: التحقق من أن جميع بيانات الفاتورة تظهر كاملة على سطح المكتب

### Unit Tests

- اختبار أن `.a4-paper` يأخذ `width: 100%` على viewport بعرض 390px بعد الإصلاح
- اختبار أن `.a4-header` يتحول إلى عمود واحد على viewport بعرض 390px
- اختبار أن `.a4-meta-grid` يتحول إلى عمود واحد على viewport بعرض 390px
- اختبار أن `.a4-bill-to` يتحول إلى عمود واحد على viewport بعرض 390px
- اختبار أن `.a4-summary` يتحول إلى `flex-direction: column` على viewport بعرض 390px
- اختبار أن `.a4-items` قابل للتمرير أفقياً داخل حاويته على viewport ضيق
- اختبار حالة الحد: viewport بعرض 767px يُطبق mobile layout
- اختبار حالة الحد: viewport بعرض 768px يُطبق desktop layout

### Property-Based Tests

- توليد viewports عشوائية بعرض < 768px والتحقق من أن `body.scrollWidth <= viewport.width` (لا تمرير أفقي)
- توليد viewports عشوائية بعرض ≥ 768px والتحقق من أن `.a4-paper` يحتفظ بعرض 210mm (preservation)
- توليد بيانات فاتورة عشوائية (عدد بنود متغير، نصوص طويلة) والتحقق من عدم overflow على الجوال
- التحقق من أن `@media print` styles لا تتأثر بأي viewport width

### Integration Tests

- فتح الفاتورة على محاكي iPhone 14 (390px) والتحقق من العرض الكامل بلا تمرير أفقي
- فتح الفاتورة على محاكي Samsung Galaxy S21 (360px) والتحقق من قراءة جميع البنود
- فتح الفاتورة على سطح المكتب (1280px) والتحقق من أن التخطيط لم يتغير
- محاكاة الطباعة من الجوال والتحقق من أن المحتوى لا يُقطع
- محاكاة الطباعة من سطح المكتب والتحقق من أن التخطيط يطابق السلوك الأصلي
- اختبار التبديل بين orientations (portrait/landscape) على الجوال
