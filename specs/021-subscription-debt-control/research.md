# Research: التحكم في مديونية الاشتراك عند نفاد الرصيد

## الحالة الراهنة في الكود (Current State)

### ما يوجد فعلاً ✅

| المكوِّن | الحالة | الملاحظة |
|---------|--------|----------|
| `app_settings.allow_subscription_debt` (DB column) | موجود | `TINYINT(1) DEFAULT 0` — `migrateAppSettingsAllowSubscriptionDebt()` في db.js:924 |
| قراءة الإعداد (`getAppSettings`) | موجود | `allowSubscriptionDebt: row.allow_subscription_debt === 1` في db.js:3633 |
| حفظ الإعداد (`saveAppSettings`) | موجود | مُدرَج في UPDATE query في db.js:3829 |
| عنصر HTML في الإعدادات | موجود | `<input type="checkbox" id="allowSubscriptionDebt" />` في settings.html:1362 |
| ربط JS في settings.js | موجود | read/write في settings.js:114، 282، 414 |
| تمرير الإعداد إلى `createOrder` | موجود | `invokeHandlers.js:898` يقرأ `settings.allowSubscriptionDebt` ويمرره |
| منطق الخصم في `createOrder` | موجود جزئياً | db.js:4735-4741 — عند `allowDebt=true` يخصم كامل المبلغ (يقبل سالب) |
| فلتر `negative` في تقرير الاشتراكات | موجود | db.js:2568 يُعرِّف `credit_remaining <= 0` كـ "negative" |

### ما ينقص ❌

| الفجوة | التفاصيل |
|--------|----------|
| **حجب الطلب** | عندما `allowDebt=false` ورصيد الاشتراك = 0 أو أقل من قيمة الطلب، يتم تحويل الطلب صامتاً إلى دفع نقدي بدلاً من حجبه |
| **إشعار نفاد الرصيد** | لا يوجد أي إشعار للكاشير يوضح أن الاشتراك لا يغطي الطلب عندما المديونية ممنوعة |
| **منع الطباعة** | لا توجد آلية تمنع طباعة الإيصال في حالة فشل الاشتراك |
| **رسالة خطأ منظّمة** | لا يوجد رمز خطأ مخصص (`INSUFFICIENT_SUBSCRIPTION_CREDIT`) يسمح بتمييز هذه الحالة عن أخطاء أخرى |

---

## قرارات التصميم

### Q1: أين يُجرى الحجب — في الـ Backend أم الـ Frontend؟

**القرار**: الحجب في الـ **Backend** (`createOrder`) مع معالجة مناسبة في الـ **Frontend**.

**المنطق**:
- `createOrder` هو المصدر الوحيد للحقيقة عن رصيد الاشتراك — يمتلك قفل `FOR UPDATE` على `subscription_periods`.
- لو حُجب في الـ Frontend فقط، يمكن ثغرة: رصيد يتغير بين الفحص والإرسال.
- `createOrder` يُعيد `success: false` مع رمز خطأ `code: 'INSUFFICIENT_SUBSCRIPTION_CREDIT'` — pos.js يفرّق هذا عن الأخطاء الأخرى ويعرض الإشعار المناسب.

### Q2: ما نطاق الحجب — فقط عندما رصيد = 0، أم عندما رصيد < قيمة الطلب؟

**القرار**: الحجب عندما يكون **الرصيد < قيمة الطلب** (غير كافٍ لتغطية الطلب كاملاً).

**المنطق**:
- الطلب عبر الاشتراك (`payment_method = subscription`) يعني أن العميل يريد تغطية الطلب من رصيده.
- إذا كان الرصيد جزئياً وأُكمل بنقد/بطاقة → هذا سلوك مختلف ومقبول (الحالة الحالية).
- الحجب يُطبَّق فقط عندما **طريقة الدفع المختارة هي "اشتراك"** (`isConsumptionOnly` intended) ولا يوجد رصيد كافٍ.

**البديل المرفوض**: الحجب دائماً عند أي نقص في الرصيد (حتى مع دفع جزئي نقدي) — يُعقّد السلوك ويكسر حالات استخدام مشروعة.

### Q3: هل يُسمح بالرصيد السالب في DB عند تفعيل المديونية؟

**القرار**: نعم — عند `allowDebt=true` يُكتب الرصيد السالب مباشرةً في `subscription_periods.credit_remaining`.

**الأثر على الـ Constitution**:
- Invariant #1 و Hard Constraint #9 يقولان `credit_remaining >= 0` ALWAYS.
- هذه الميزة **تُخفّف هذا القيد** بشكل متعمّد عندما يُفعِّل المشغّل خيار المديونية.
- البديل (تخزين الدَيْن في جدول منفصل) أعقد ويكسر منطق العرض والتقارير الموجودة.
- **الحل**: تعديل النص في الـ Constitution ليقرأ: "`credit_remaining` قد يكون سالباً فقط عند تفعيل `allow_subscription_debt`".

**ملاحظة**: الكود الحالي في db.js:4737-4741 يُطبّق المديونية بالفعل (`consumptionAmount = numTotal`) لكنه لم يُختبر بالسيناريوهات المطلوبة.

### Q4: ماذا عن `updateActiveSubscriptionPeriod` و `newCredit < 0`؟

**القرار**: إبقاء الـ validation الحالي (`newCredit < 0` → error) في التعديل اليدوي.

**المنطق**: التعديل اليدوي للرصيد في شاشة الاشتراكات لا يجب أن يقبل رصيداً سالباً لأن المدير لا يُدخل قيماً سالبة بشكل مقصود. الرصيد السالب يُنشأ فقط آلياً عبر `createOrder`.

---

## خريطة الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `database/db.js` | إضافة حجب في `createOrder` مع رمز خطأ `INSUFFICIENT_SUBSCRIPTION_CREDIT` |
| `screens/pos/pos.js` | معالجة رمز الخطأ وعرض إشعار مفصّل، منع الطباعة |
| لا تغيير مطلوب في: | `server/invokeHandlers.js`، `settings.*`، `web-api.js` |

---

## الملاحظات على المنطق الحالي في createOrder (db.js:4735-4741)

```
if (allowDebt) {
  consumptionAmount = numTotal;           // ✅ يخصم كامل المبلغ → رصيد قد يصبح سالب
} else if (creditRemaining > 0) {
  consumptionAmount = Math.min(numTotal, creditRemaining);  // ✅ خصم جزئي
}
// else: consumptionAmount = 0 → طلب عادي (لا حجب) ← هنا تكمن الثغرة
```

**المطلوب** بعد `else if`: إضافة فحص — إذا كان دفع الطلب الكامل مقصوداً عبر الاشتراك (`paymentMethod === 'subscription'`) ولا يوجد رصيد كافٍ ولا مديونية → رفع خطأ `INSUFFICIENT_SUBSCRIPTION_CREDIT`.
