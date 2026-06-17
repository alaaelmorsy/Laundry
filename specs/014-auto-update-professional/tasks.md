# Tasks: نظام التحديث التلقائي الاحترافي

**Input**: Design documents from `specs/014-auto-update-professional/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**ملاحظة مهمة**: 90% من النظام موجود ومُنفَّذ. المهام هنا تُغطي الفجوة الوحيدة المتبقية: فحص صلاحية الدعم الفني (`support_expiry_date`) قبل بدء التحديث.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (مراجعة الوضع الحالي)

**Purpose**: التحقق من حالة الملفات قبل البدء

- [x] T001 تأكيد وجود `support_expiry_date` في جدول `app_settings` — تشغيل البرنامج ومراجعة `database/db.js` السطر ~3447
- [x] T002 [P] تأكيد أن `db.getAppSettings()` تُعيد `supportExpiryDate` — مراجعة `database/db.js` السطر ~3586

**Checkpoint**: التأكد من أن العمود موجود والقراءة تعمل قبل إضافة الفحص

---

## Phase 2: Foundational (لا يوجد — النظام مكتمل الأساس)

**Status**: ✅ الملفات الأساسية موجودة بالكامل:
- `server/services/updateService.js` — منطق التحديث الكامل ✅
- `scripts/updater.ps1` — استبدال exe وإعادة التشغيل ✅
- `server/invokeHandlers.js` — الـ cases: checkForUpdate, getUpdateStatus, performUpdate, getUpdateProgress ✅
- `assets/web-api.js` — جميع الـ methods مسجَّلة ✅
- `screens/settings/settings.html` + `settings.js` — واجهة التحديث كاملة ✅
- `screens/login/login.js` — إشعار التحديث موجود ✅

**⚠️ CRITICAL**: المرور بـ Phase 2 لا يلزم — التنفيذ يبدأ مباشرةً من Phase 3

---

## Phase 3: User Story 1 - فحص التحديثات (Priority: P1) 🎯

**Goal**: فتح الإعدادات → فحص التحديثات → عرض النتيجة

**Status**: ✅ **مكتمل بالكامل** — `handleCheckUpdate()` في `settings.js` يعمل

**Independent Test**: افتح الإعدادات → تبويب التحديثات → اضغط "فحص التحديثات"

لا مهام مطلوبة.

---

## Phase 4: User Story 2+3 - تحميل وتثبيت التحديث مع فحص الدعم الفني (Priority: P1) 🎯 MVP

**Goal**: إضافة فحص صلاحية الدعم الفني (`support_expiry_date`) قبل السماح بالتحميل والتثبيت

**Independent Test**: (1) اضبط `support_expiry_date = '2020-01-01'` → اضغط "تحديث الآن" → يجب أن تظهر رسالة انتهاء الدعم. (2) اضبط `support_expiry_date = NULL` → اضغط "تحديث الآن" → يجب أن يبدأ التحديث

### Implementation

- [x] T003 [US2] إضافة فحص `support_expiry_date` في `server/invokeHandlers.js` — case `'performUpdate'` (السطر ~1779): استدعاء `db.getAppSettings()` → إذا كانت `supportExpiryDate` مضت اليوم → إعادة `{ success: false, supportExpired: true, message: 'انتهت فترة الدعم الفني — يرجى تجديد الدعم للحصول على التحديثات' }`
- [x] T004 [US2] معالجة استجابة `supportExpired` في `screens/settings/settings.js` — دالة `handleUpdateNow`: عند `res.supportExpired === true` عرض رسالة تحذير بلون برتقالي/أصفر وإعادة تفعيل الزر

**Checkpoint**: اختبار السيناريو 2 من `quickstart.md` — تعيين `support_expiry_date` تاريخ ماضٍ والتأكد من رفض التحديث

---

## Phase 5: User Story 4 - إشعار تسجيل الدخول (Priority: P2)

**Goal**: إشعار تلقائي عند فتح الصفحة إذا كان هناك تحديث

**Status**: ✅ **مكتمل** — `updateBadge` في `screens/login/login.js` يعمل عبر `/api/update-status`

لا مهام مطلوبة.

---

## Phase 6 (اختياري): عرض حالة الدعم الفني في الإعدادات

**Goal**: إظهار تاريخ انتهاء الدعم الفني في صفحة الإعدادات للمستخدم

- [x] T005 [P] [US2] إضافة case `'getSupportStatus'` في `server/invokeHandlers.js`: استدعاء `db.getAppSettings()` → حساب `daysLeft` → إعادة `{ valid, daysLeft, expiryDate }`
- [x] T006 [P] [US2] تسجيل `getSupportStatus: () => invoke('getSupportStatus')` في `assets/web-api.js`
- [x] T007 [US2] إضافة عرض تاريخ انتهاء الدعم الفني في `screens/settings/settings.js` — دالة `initUpdatePanel()`: استدعاء `window.api.getSupportStatus()` وعرض النتيجة في panel التحديثات (مثلاً: "الدعم الفني سارٍ حتى: 31/12/2027" أو "⚠️ انتهى الدعم الفني")

---

## Phase 7: Polish & التحقق النهائي

- [x] T008 [P] تشغيل السيناريو 1 من `quickstart.md`: فحص التحديثات من الإعدادات
- [x] T009 [P] تشغيل السيناريو 2 من `quickstart.md`: التحقق من فحص صلاحية الدعم
- [x] T010 التحقق من `update-log.txt` بعد محاولة التحديث المرفوضة — يجب أن تكون الرسالة غائبة (الرفض يحدث في handler قبل وصول `updateService`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): لا تبعيات — ابدأ فوراً
- **Phase 4** (T003, T004): يعتمد على تأكيد T001 + T002
- **Phase 6** (T005-T007): مستقل، يمكن تأجيله
- **Phase 7** (Polish): يعتمد على اكتمال T003 + T004

### User Story Dependencies

- **US1 (فحص)**: ✅ مكتمل — لا تبعيات
- **US2/US3 (تحميل/تثبيت)**: يعتمد على T001+T002 (فحص الـ DB)
- **US4 (إشعار)**: ✅ مكتمل — لا تبعيات

### Parallel Opportunities

- T001 + T002 يمكن تشغيلهما معاً (قراءة فقط)
- T003 + T008/T009 (من Phase 7) **لا** يمكن — T008/T009 يعتمدان على T003
- T005 + T006 يمكن تشغيلهما معاً (ملفات مختلفة)

---

## Implementation Strategy

### MVP (الحد الأدنى لإكمال المتطلب)

1. تأكيد T001 + T002 (قراءة، 5 دقائق)
2. تنفيذ T003 في `invokeHandlers.js` (تعديل ~8 أسطر)
3. تنفيذ T004 في `settings.js` (تعديل ~5 أسطر)
4. اختبار يدوي بـ SQL: `UPDATE app_settings SET support_expiry_date = '2020-01-01' WHERE id = 1`

**إجمالي المهام الأساسية**: 4 مهام، ~30 دقيقة عمل

### Full Delivery (مع عرض حالة الدعم في UI)

أضف T005 → T006 → T007 بعد MVP.

---

## Notes

- `support_expiry_date` في db.js موجود كـ `supportExpiryDate` في كائن الـ settings
- الفحص يجب أن يكون في `invokeHandlers.js` (لا في `updateService.js`) للحفاظ على الفصل بين layers
- `NULL` = دعم ساري (لا تاريخ انتهاء مُعيَّن)
- التحميل من الإنترنت هو الخطوة التي تحتاج حماية — الفحص يمنع `performUpdate()` من البدء أصلاً
