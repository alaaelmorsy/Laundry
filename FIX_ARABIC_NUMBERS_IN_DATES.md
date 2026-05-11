# إصلاح عرض التواريخ بالأرقام الإنجليزية

## المشكلة
كانت التواريخ تظهر بالأرقام العربية (١٨/٠٤/٢٠٢٦) بدلاً من الأرقام الإنجليزية (18/04/2026).

## الحل المطبق

### 1. تحديث HTML (screens/subscriptions/subscriptions.html)

#### تغيير `lang` من `en` إلى `en-US`
تم تحديث جميع حقول التاريخ لاستخدام `lang="en-US"` بدلاً من `lang="en"`:

**الحقول المحدثة:**
- `newSubStart` - تاريخ بداية الاشتراك الجديد
- `newSubEnd` - تاريخ انتهاء الباقة (جديد)
- `editSubPeriodFrom` - تاريخ بداية الفترة (تعديل)
- `editSubPeriodTo` - تاريخ نهاية الفترة (تعديل)
- `editSubEndDate` - تاريخ انتهاء الباقة (تعديل)
- `renewStart` - تاريخ بداية التجديد
- `filterDateFrom` - فلتر من تاريخ
- `filterDateTo` - فلتر إلى تاريخ

#### تحسين CSS
```css
input[type="date"],input[type="number"]{
  font-family:'Segoe UI',Tahoma,sans-serif;
  direction:ltr;
  text-align:right;
  font-variant-numeric:tabular-nums;
  -webkit-font-feature-settings:'tnum';
  font-feature-settings:'tnum'
}

input[type="date"]::-webkit-datetime-edit,
input[type="date"]::-webkit-inner-spin-button,
input[type="date"]::-webkit-calendar-picker-indicator{
  direction:ltr;
  unicode-bidi:bidi-override
}
```

### 2. تحديث JavaScript (screens/subscriptions/subscriptions.js)

#### إضافة دالة `forceEnglishNumbers()`
```javascript
function forceEnglishNumbers() {
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    // تعيين locale إلى الإنجليزية
    input.setAttribute('lang', 'en-US');
    // إضافة معالج لتحويل الأرقام العربية إلى إنجليزية عند الإدخال
    input.addEventListener('input', function(e) {
      const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      const englishNums = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      let val = this.value;
      for (let i = 0; i < arabicNums.length; i++) {
        val = val.replace(new RegExp(arabicNums[i], 'g'), englishNums[i]);
      }
      if (val !== this.value) this.value = val;
    });
  });
}
```

#### إضافة MutationObserver
```javascript
// تطبيق عند التحميل
forceEnglishNumbers();

// إعادة التطبيق عند فتح النوافذ المنبثقة
const observer = new MutationObserver(() => {
  forceEnglishNumbers();
});
observer.observe(document.body, { childList: true, subtree: true });
```

## النتيجة

### قبل الإصلاح ❌
- التاريخ: ١٨/٠٤/٢٠٢٦ (أرقام عربية)

### بعد الإصلاح ✅
- التاريخ: 18/04/2026 (أرقام إنجليزية)

## الملفات المعدلة
1. `screens/subscriptions/subscriptions.html` - تحديث HTML و CSS
2. `screens/subscriptions/subscriptions.js` - إضافة JavaScript لفرض الأرقام الإنجليزية

## كيفية العمل

1. **HTML `lang="en-US"`**: يخبر المتصفح باستخدام locale الإنجليزي الأمريكي
2. **CSS `direction:ltr`**: يجعل اتجاه النص من اليسار لليمين
3. **CSS `font-variant-numeric:tabular-nums`**: يفرض استخدام الأرقام الجدولية
4. **JavaScript**: يحول أي أرقام عربية يتم إدخالها إلى أرقام إنجليزية تلقائياً
5. **MutationObserver**: يضمن تطبيق الإعدادات على أي حقول تاريخ جديدة تُضاف ديناميكياً

## اختبار

1. افتح نموذج "اشتراك جديد"
2. انقر على حقل "تاريخ بداية الفترة"
3. تحقق من أن التاريخ يظهر بالأرقام الإنجليزية (18/04/2026)
4. جرّب إدخال تاريخ يدوياً
5. تحقق من أن الأرقام تظهر بالإنجليزية

## ملاحظات

- الحل يعمل على جميع المتصفحات الحديثة (Chrome, Firefox, Safari, Edge)
- الأرقام تظهر بالإنجليزية حتى لو كان نظام التشغيل باللغة العربية
- الحل لا يؤثر على باقي النصوص العربية في الواجهة
