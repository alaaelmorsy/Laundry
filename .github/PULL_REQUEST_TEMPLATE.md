## 📋 وصف التغيير

<!-- اشرح ما الذي تغيّر ولماذا. لا تشرح "ماذا" فقط — اشرح "لماذا". -->

## 🔗 Issue المرتبطة

Closes #<!-- رقم الـ Issue إن وجد -->

---

## ✅ Feature Impact Checklist

**أكمل هذا الجدول قبل طلب المراجعة. ضع N/A فقط إذا كان التغيير مستحيل التأثير على تلك المنطقة.**

| المنطقة | متأثرة؟ | تم التحقق؟ |
|---------|---------|------------|
| **قاعدة البيانات** — migrations additive · try/catch · MySQL 5.7 · مسجلة في `db.initialize()` | ☐ نعم / ☐ لا / ☐ N/A | ☐ |
| **POS Checkout** — `createOrder` يعمل من البداية للنهاية | ☐ نعم / ☐ لا / ☐ N/A | ☐ |
| **ZATCA** — أعمدة ZATCA على `orders` غير متأثرة · scheduler يعمل | ☐ نعم / ☐ لا / ☐ N/A | ☐ |
| **الاشتراكات** — `credit_remaining >= 0` · period واحدة نشطة فقط | ☐ نعم / ☐ لا / ☐ N/A | ☐ |
| **المدفوعات** — معادلة الفاتورة ثابتة · tolerance مختلط ≤ 0.01 ريال | ☐ نعم / ☐ لا / ☐ N/A | ☐ |
| **الطباعة** — `76mm / margin: 0 auto` · print zone · `afterprint` | ☐ نعم / ☐ لا / ☐ N/A | ☐ |
| **التوافق** — عمليات نشر العملاء الحالية آمنة · API callers غير متأثرة | ☐ نعم / ☐ لا / ☐ N/A | ☐ |

---

## 🔧 4-Step API Checklist

**لكل method جديدة أضفتها:**

| اسم الـ Method | `db.js` | `invokeHandlers.js` | `web-api.js` | Screen JS |
|----------------|---------|---------------------|--------------|-----------|
| — | ☐ | ☐ | ☐ | ☐ |

---

## 🗄️ تغييرات قاعدة البيانات

<!-- إذا لا توجد تغييرات DB، احذف هذا القسم -->

- [ ] Migration additive فقط (`ADD COLUMN` / `CREATE TABLE` / `ADD INDEX`)
- [ ] لا `DROP COLUMN` أو `RENAME COLUMN`
- [ ] كل `ALTER TABLE` محاطة بـ `try { ... } catch (_) {}`
- [ ] Migration مسجلة في `db.initialize()` بالترتيب
- [ ] SQL متوافق مع MySQL 5.7 (لا window functions، لا CTEs، لا JSON_TABLE)
- [ ] الأعمدة الجديدة `NOT NULL` لها `DEFAULT` value

---

## 🚫 تحقق من المحظورات

- [ ] لا React / Vue / Svelte أو أي JS framework
- [ ] لا ORM
- [ ] لا `fetch('/api/invoke')` مباشرة في screen JS
- [ ] لا تغيير على معمارية ZATCA
- [ ] لا تغيير على أبعاد الطباعة الحرارية
- [ ] لا `process.exit()` في request handlers
- [ ] لا `spawn(detached: true)`
- [ ] لا SQL بصيغة MySQL 8.0 فقط

---

## 📸 Screenshots / تسجيل شاشة

<!-- أرفق لقطة شاشة أو تسجيل إذا كان التغيير يخص واجهة المستخدم -->
