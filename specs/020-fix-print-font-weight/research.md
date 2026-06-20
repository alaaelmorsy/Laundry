# Research: Fix Print Font Weight in Chrome

## Root Cause Analysis

### Decision: مشكلة `print-color-adjust` في Chrome
**Rationale**: Chrome بشكل افتراضي يُطبّق خوارزمية لـ"توفير الحبر" عند الطباعة (`print-color-adjust: economy`). هذه الخوارزمية تُحوّل الخطوط الداكنة إلى رمادية وتُخفّف أوزانها بصرياً. الحل هو إجبار Chrome على استخدام الألوان الحقيقية بإضافة `print-color-adjust: exact`.

**الدليل من الكود**: ملفات CSS الموجودة (daily-report.css, period-report.css) تحتوي على `font-weight:900` في `@media print` لكنها لا تحتوي على `print-color-adjust: exact`، مما يسمح لـ Chrome بتجاوز هذه القيم.

**Alternatives considered**:
- زيادة font-weight أكثر → لن تحل المشكلة لأن Chrome يتجاهلها
- تغيير إعدادات الطابعة → يتطلب تدخلاً يدوياً من المستخدم عند كل طباعة
- إضافة `print-color-adjust: exact` → الحل الصحيح والموحّد

---

### Decision: نطاق التعديل — CSS فقط
**Rationale**: المشكلة بصرية بحتة ولا تمس منطق الأعمال ولا قاعدة البيانات ولا الـ API.

**Alternatives considered**:
- تعديل HTML → غير ضروري، الـ CSS يكفي
- تعديل JS → غير ضروري

---

### Decision: الملفات المتأثرة

الملفات التي تحتوي على `@media print` وتحتاج إضافة `print-color-adjust`:
1. `screens/reports/daily-report/daily-report.css`
2. `screens/reports/period-report/period-report.css`
3. `screens/invoices/invoices.css`
4. `screens/pos/pos.css`
5. `screens/consumption-receipts/consumption-receipts.css`
6. `screens/credit-invoices/credit-invoices.css`
7. `screens/hangers/hangers.css`

الملفات التي تحتاج `@media print` جديد:
1. `screens/reports/worker-report/worker-report.css`
2. `screens/reports/subscriptions-report/subscriptions-report.css`
3. `screens/reports/all-invoices-report/all-invoices-report.css`

---

### Decision: الـ CSS المضاف
```css
/* في بداية كل @media print { ... } */
html, body {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color: #000 !important;
}
* {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
```

**Rationale**: 
- `-webkit-print-color-adjust` للـ Chrome القديم
- `print-color-adjust` للمعيار الجديد (W3C)
- `!important` لتجاوز أي قيمة افتراضية من Tailwind أو Chrome
- `color: #000` على body لضمان سواد النص

**Alternatives considered**:
- فقط على `html, body` → بعض العناصر المتداخلة قد تتجاهلها
- فقط على `*` → أشمل وأفضل
