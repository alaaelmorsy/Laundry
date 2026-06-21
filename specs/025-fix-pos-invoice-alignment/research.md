# Research: إصلاح محاذاة النص في الطباعة الحرارية — جميع الشاشات

## النتائج

### تشخيص المشكلة الجذرية

بعد فحص CSS لكل شاشة تطبع إيصالاً حرارياً 80mm، تبيّن وجود خطأين رئيسيين متكررين:

**خطأ 1 — عرض `.inv-paper` خاطئ في `@media print`**
`.inv-paper` يُضبط على `width: 80mm` و`max-width: 80mm` بينما الصحيح `76mm` لكليهما.
الورقة عرضها الكلي 80mm، والـ 4mm الباقية هي هامش الحاوية (print zone). المحتوى يجب أن يكون 76mm لكي يتمركز داخل الحاوية 80mm بمعادلة `margin: 0 auto`.

**خطأ 2 — padding خاطئ**
`padding: 4mm` بدلاً من `padding: 2mm 3mm`. هذا يُضيف 2mm زائدة على أعلى/أسفل.

**خطأ 3 — `@page` مع margin غير صفري**
بعض الشاشات تستخدم `@page { margin: 4mm 3mm }` بدلاً من `@page { size: 80mm auto; margin: 0 }`.
هذا يُسبب إزاحة المحتوى من الجانبين على مستوى الصفحة المطبوعة.

**خطأ 4 — غياب `@page` كلياً**
شاشتا `pos` و`hangers` لا تملكان `@page { size: 80mm auto; margin: 0 }` أصلاً، مما يجعل الطابعة تستخدم إعداداتها الافتراضية.

### جدول حالة كل شاشة

| الشاشة | inv-paper عرض | @page margin | الحالة |
|--------|--------------|-------------|--------|
| `pos/pos.css` | 80mm ❌ | **غائب** ❌ | تحتاج إصلاح |
| `hangers/hangers.css` | 80mm ❌ | **غائب** ❌ | تحتاج إصلاح |
| `credit-invoices/credit-invoices.css` | 80mm ❌ | **غائب** ❌ | تحتاج إصلاح |
| `reports/daily-report/daily-report.css` | 80mm ❌ | 4mm 3mm ❌ | تحتاج إصلاح |
| `reports/period-report/period-report.css` | 80mm ❌ | 4mm 3mm ❌ | تحتاج إصلاح |
| `reports/worker-report/worker-report.css` | 80mm ❌ | 4mm 3mm ❌ | تحتاج إصلاح |
| `reports/all-invoices-report/all-invoices-report.css` | 80mm ❌ | 3mm 2mm ❌ | تحتاج إصلاح |
| `invoices/invoices.css` | 76mm ✅ | 0 ✅ | صحيحة |
| `consumption-receipts/consumption-receipts.css` | 76mm ✅ | 0 ✅ | صحيحة |

### القاعدة الصحيحة (من CLAUDE.md)

```css
@page { size: 80mm auto; margin: 0; }

@media print {
  /* الحاوية الخارجية (print zone) */
  body.printing-X #printZone {
    width: 80mm !important;
    margin: 0 auto !important;
  }
  /* ورقة الإيصال */
  body.printing-X #printZone .inv-paper {
    width: 76mm !important;
    max-width: 76mm !important;
    margin: 0 auto !important;      /* NEVER margin: 0 4mm */
    padding: 2mm 3mm !important;    /* NOT 4mm */
  }
}
```

### ملاحظات إضافية على pos.css

في `pos.css` يوجد نمطان للطباعة:
1. **الفاتورة العادية**: تطبع مباشرة من `#invoiceModal` (لا print zone منفصلة)
2. **إيصال الاستهلاك من شاشة البيع**: تطبع عبر `#consumptionPrintZone` (print zone صحيحة بـ 80mm)

الـ `.inv-paper` المُعرَّفة بـ `80mm` في `pos.css` تؤثر على كلا النمطين.

### القرار

- **Decision**: تغيير `width/max-width` من `80mm` إلى `76mm`، وإصلاح `padding` إلى `2mm 3mm`، وإضافة/تصحيح `@page` في كل ملف CSS مُتأثر.
- **Rationale**: `76mm` هو عرض المحتوى الفعلي داخل طابعة 80mm وهو القيمة الموثّقة في CLAUDE.md. الـ `margin: 0` في `@page` يضمن أن لا هامش يُضاف على مستوى الصفحة يتداخل مع تمركز المحتوى.
- **Alternatives**: تغيير الحاوية الخارجية إلى 76mm — مرفوض لأن الطابعة تتوقع 80mm والحاوية يجب أن تطابق حجم الورقة.
- **Scope**: 7 ملفات CSS فقط، لا تغيير في HTML أو JS.
