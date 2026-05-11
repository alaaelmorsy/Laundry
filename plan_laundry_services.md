# عمليات الغسيل (عربي / إنجليزي) — تنفيذ مبسّط

## السياق

- التنقل: `main.js` يحمّل `screens/services/services.html` من بطاقة **الخدمات** في لوحة التحكم (`data-screen="services"`).
- التدفق: واجهة `services` → `preload.js` → IPC في `main.js` → `database/db.js` → MySQL (`laundry_db`).

## نموذج البيانات

جدول **`laundry_services`** (حقول فقط):

| الحقل      | الغرض                          |
|-----------|---------------------------------|
| `id`      | المعرف                          |
| `name_ar` | اسم العملية بالعربية           |
| `name_en` | اسم العملية بالإنجليزية       |
| `created_at` | وقت الإنشاء (تلقائي)      |

عند وجود جدول قديم بأعمدة إضافية، تُشغَّل **`migrateLaundryServicesToMinimal()`** مرة عند التشغيل لإسقاط الأعمدة الزائدة.

بذور افتراضية عند الجدول الفارغ: أربع عمليات نموذجية (أسماء عربي/إنجليزي فقط).

## `db.js`

- `getAllLaundryServices({ page, pageSize, search })` — البحث في `name_ar` و `name_en` فقط.
- `createLaundryService({ nameAr, nameEn })` / `updateLaundryService` / `deleteLaundryService`.

## IPC

- `get-laundry-services`, `create-laundry-service`, `update-laundry-service`, `delete-laundry-service`.

## الشاشة `screens/services/`

- جدول: #، اسم عربي، اسم إنجليزي، إجراءات (تعديل / حذف).
- مودال: حقلان فقط (عربي + إنجليزي).
- بحث بالاسمين، ترقيم صفحات، تأكيد حذف.

## الترجمة

مفاتيح `services-*` و `page-title-services` في `assets/i18n.js` (عربي وإنجليزي).

---

*وثيقة مواكبة للتنفيذ الحالي في المشروع.*
