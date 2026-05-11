# خطة التنفيذ: منع تكرار اسم العميل (customer-name-uniqueness)

## نظرة عامة

تنفيذ ميزة منع تكرار اسم العميل عبر ثلاث طبقات: قاعدة البيانات (`database/db.js`)، معالج الطلبات (`server/invokeHandlers.js`)، والواجهة الأمامية (`screens/customers/customers.js`). يُضاف أيضاً مفتاح ترجمة جديد في `assets/i18n.js`.

## المهام

- [x] 1. إضافة مفتاح الترجمة الجديد في `assets/i18n.js`
  - إضافة مفتاح `'customers-err-name-duplicate'` بالقيمة `'اسم العميل مكرر، يرجى استخدام اسم مختلف'` ضمن كائن الترجمة العربية
  - التأكد من وضعه بجانب مفاتيح أخطاء العملاء الموجودة (`customers-err-phone-duplicate` وما شابهها)
  - _المتطلبات: 4.1_

- [x] 2. تعديل `database/db.js` لإضافة التحقق من تفرد الاسم
  - [x] 2.1 تعديل دالة `createCustomer` لإضافة استعلام التحقق من تكرار الاسم
    - إضافة `SELECT id FROM customers WHERE customer_name = ? LIMIT 1` بعد التحقق من رقم الهاتف وقبل `INSERT`
    - رمي خطأ بـ `appCode = 'NAME_DUPLICATE'` عند وجود تكرار
    - _المتطلبات: 2.1, 2.2_

  - [ ]* 2.2 كتابة اختبار خاصية لـ `createCustomer` - رفض الاسم المكرر
    - **الخاصية 2: رفض الاسم المكرر عند الإضافة**
    - **Validates: Requirements 2.1**

  - [x] 2.3 تعديل دالة `updateCustomer` لإضافة استعلام التحقق من تكرار الاسم مع استثناء العميل الحالي
    - إضافة `SELECT id FROM customers WHERE customer_name = ? AND id <> ? LIMIT 1` بعد التحقق من رقم الهاتف وقبل `UPDATE`
    - رمي خطأ بـ `appCode = 'NAME_DUPLICATE'` عند وجود تكرار مع عميل آخر
    - _المتطلبات: 2.3, 2.4_

  - [ ]* 2.4 كتابة اختبار خاصية لـ `updateCustomer` - رفض الاسم المكرر ونجاح نفس الاسم
    - **الخاصية 3: رفض الاسم المكرر عند التعديل**
    - **الخاصية 4: نجاح التعديل بنفس الاسم الحالي**
    - **Validates: Requirements 2.3, 2.4**

- [x] 3. نقطة تحقق - التأكد من صحة طبقة قاعدة البيانات
  - التأكد من أن دالتي `createCustomer` و `updateCustomer` ترميان `NAME_DUPLICATE` في الحالات الصحيحة، اسأل المستخدم إن وجدت أي استفسارات.

- [x] 4. تعديل `server/invokeHandlers.js` لمعالجة خطأ `NAME_DUPLICATE`
  - [x] 4.1 تعديل `case 'createCustomer'` لإضافة معالجة `NAME_DUPLICATE`
    - إضافة `if (err.appCode === 'NAME_DUPLICATE') return { success: false, code: 'NAME_DUPLICATE' };` كأول شرط في كتلة `catch`، قبل معالجة `PHONE_DUPLICATE`
    - _المتطلبات: 3.1, 3.3_

  - [x] 4.2 تعديل `case 'updateCustomer'` لإضافة معالجة `NAME_DUPLICATE`
    - إضافة `if (err.appCode === 'NAME_DUPLICATE') return { success: false, code: 'NAME_DUPLICATE' };` كأول شرط في كتلة `catch`، قبل معالجة `PHONE_DUPLICATE`
    - _المتطلبات: 3.2, 3.3_

  - [ ]* 4.3 كتابة اختبارات وحدة للمعالج
    - اختبار أن `createCustomer` يُعيد `{ success: false, code: 'NAME_DUPLICATE' }` عند استقبال خطأ `NAME_DUPLICATE` من طبقة DB
    - اختبار أن `updateCustomer` يُعيد `{ success: false, code: 'NAME_DUPLICATE' }` عند استقبال خطأ `NAME_DUPLICATE` من طبقة DB
    - اختبار أن الأخطاء الأخرى (`PHONE_DUPLICATE`، `PHONE_INVALID`، `PHONE_TOO_LONG`) لا تزال تُعالج بشكل صحيح
    - _المتطلبات: 3.1, 3.2, 3.3_

- [x] 5. تعديل `screens/customers/customers.js` لمعالجة `NAME_DUPLICATE` في الواجهة الأمامية
  - [x] 5.1 إضافة التحقق المحلي من أن اسم العميل غير فارغ في دالة `saveCustomer`
    - إضافة `if (!customerName) { showModalError(I18N.t('customers-err-name')); return; }` قبل تعطيل زر الحفظ وإرسال الطلب
    - _المتطلبات: 1.1, 1.2_

  - [x] 5.2 إضافة معالجة كود `NAME_DUPLICATE` في كتلة `else` داخل `saveCustomer`
    - تعديل منطق `codeMsg` ليشمل `result.code === 'NAME_DUPLICATE'` يُعيد `I18N.t('customers-err-name-duplicate')`
    - إضافة شرط: إذا كان `result.code === 'NAME_DUPLICATE'` فاستخدم `showToast` بدلاً من `showModalError` مع إبقاء النموذج مفتوحاً
    - _المتطلبات: 4.1, 4.2, 4.3_

  - [ ]* 5.3 كتابة اختبار خاصية للواجهة الأمامية
    - **الخاصية 1: رفض الاسم الفارغ أو المكوّن من مسافات**
    - **الخاصية 5: عرض Toast عند استقبال NAME_DUPLICATE**
    - **Validates: Requirements 1.1, 4.1, 4.2**

- [x] 6. نقطة تحقق نهائية - التأكد من عمل الميزة كاملةً
  - التأكد من أن جميع الاختبارات تمر، وأن التدفق الكامل (إضافة عميل بنفس الاسم، تعديل عميل بنفس اسم عميل آخر، تعديل عميل بنفس اسمه الحالي) يعمل بشكل صحيح. اسأل المستخدم إن وجدت أي استفسارات.

## ملاحظات

- المهام المُعلَّمة بـ `*` اختيارية ويمكن تخطيها للحصول على MVP أسرع
- كل مهمة تُشير إلى متطلبات محددة لضمان التتبع
- نقاط التحقق تضمن التحقق التدريجي من الصحة
- اختبارات الخصائص تتحقق من ضمانات الصحة الشاملة المعرّفة في وثيقة التصميم
- الخاصية 6 (تفرد الأسماء بعد كل عملية حفظ ناجحة) مُغطاة ضمنياً بالمهام 2.1 و 2.3
