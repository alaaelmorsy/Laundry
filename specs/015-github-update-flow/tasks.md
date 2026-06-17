# Tasks: نظام التحديث عبر GitHub

**Input**: Design documents from `specs/015-github-update-flow/`

**ملاحظة مهمة**: البنية التحتية كاملة تقريباً في الكود الحالي. المهام هنا تُغطي فقط التغييرات المطلوبة: إضافة `downloadUpdate` + `installUpdate` في الـ backend، وتبسيط الواجهة لتدفق جديد.

---

## Phase 1: Setup (تأكيد البنية الموجودة)

**Purpose**: التحقق من أن البنية الحالية كاملة قبل البدء في التعديلات

- [x] T001 [P] تأكيد وجود `supportExpiryDate` في استجابة `db.getAppSettings()` — راجع `database/db.js` السطر ~3586
- [x] T002 [P] تأكيد وجود `checkForUpdate` + `getUpdateProgress` + `getSupportStatus` في `assets/web-api.js` السطر ~407
- [x] T003 [P] تأكيد وجود `downloadUrl` في `update-status.json` بعد `checkForUpdate` — راجع `server/services/updateService.js` السطر ~212

**Checkpoint**: البنية مؤكدة — يمكن البدء في التعديلات

---

## Phase 2: Foundational (تعديل invokeHandlers — يحجب كل المراحل التالية)

**Purpose**: تعديل `checkForUpdate` ليفحص الدعم أولاً + إضافة الـ cases الجديدة

**⚠️ CRITICAL**: لا يمكن اختبار الـ US1 قبل اكتمال هذه المرحلة

- [x] T004 تعديل case `'checkForUpdate'` في `server/invokeHandlers.js` السطر ~1760: استدعاء `db.getAppSettings()` → إذا كانت `supportExpiryDate` مضت اليوم → إعادة `{ success: false, supportExpired: true, message: 'انتهت فترة الدعم الفني — يرجى تجديد الدعم للحصول على التحديثات' }` → وإلا استدعاء `updateService.checkForUpdate(force)` كما هو

- [x] T005 إضافة دالة `downloadUpdate()` في `server/services/updateService.js` بعد `performUpdate()`: (١) تفحص `updateProgress.inProgress` — إذا true تُعيد error `DOWNLOAD_IN_PROGRESS`، (٢) تقرأ `readStatus()` للحصول على `downloadUrl` + `latestVersion`، (٣) تحسب مسار الـ exe في `DATA_DIR`، (٤) تستدعي `setProgress('downloading', 0)` وتضبط `updateProgress.downloadDone = false`، (٥) تطلق `setImmediate(async () => { await downloadWithProgress(..., onProgress); updateProgress.downloadDone = true; updateProgress.downloadedFilePath = exePath; updateProgress.inProgress = false; })` ثم تُعيد `{ started: true }` فوراً

- [x] T006 إضافة دالة `installUpdate()` في `server/services/updateService.js` بعد `downloadUpdate()`: (١) تتحقق من `updateProgress.downloadDone === true` وأن `downloadedFilePath` موجود، (٢) تقرأ `readStatus()` للحصول على `latestVersion` + `backupPath` (غير مطلوب — null)، (٣) تطلق `updater.ps1` بنفس الكود الموجود في نهاية `performUpdate()` السطر ~444، (٤) تستدعي `setTimeout(() => process.exit(0), 1500)`، (٥) تُعيد `{ success: true, message: 'جارٍ التثبيت...' }`

- [x] T007 تحديث `module.exports` في `server/services/updateService.js` لتشمل `downloadUpdate` + `installUpdate`

- [x] T008 إضافة case `'downloadUpdate'` في `server/invokeHandlers.js` بعد case `'getUpdateProgress'`: فحص الدعم أولاً (نفس كود T004) → استدعاء `updateService.downloadUpdate()` → إعادة `{ success: true, started: true }` أو `{ success: false, ... }`

- [x] T009 إضافة case `'installUpdate'` في `server/invokeHandlers.js` بعد case `'downloadUpdate'`: استدعاء `updateService.installUpdate()` → إعادة النتيجة مباشرة مع `try/catch`

- [x] T010 تسجيل `downloadUpdate` + `installUpdate` في `assets/web-api.js` بعد السطر 410: `downloadUpdate: () => invoke('downloadUpdate'), installUpdate: () => invoke('installUpdate'),`

**Checkpoint**: شغّل `npm start`، افتح الإعدادات → التحديثات، تأكد من ظهور الواجهة بدون أخطاء في الـ console

---

## Phase 3: User Story 1 - التحقق من الدعم والبحث عن تحديث (Priority: P1) 🎯 MVP

**Goal**: الضغط على "فحص التحديثات" يتحقق من الدعم أولاً، إذا انتهى يوقف العملية، وإلا يبحث في GitHub.

**Independent Test**: اضبط `support_expiry_date = '2020-01-01'` → اضغط "فحص التحديثات" → يجب أن تظهر رسالة انتهاء الدعم بدون اتصال بـ GitHub.

### Implementation for User Story 1

- [x] T011 [US1] تبسيط `initUpdatePanel()` في `screens/settings/settings.js` السطر ~820: استبدال `handleCheckUpdate()` بنسخة جديدة تستدعي `window.api.checkForUpdate({ force: true })` → إذا `res.supportExpired` تعرض رسالة الدعم المنتهي → إذا `!res.success` تعرض `showToast(res.message)` → إذا `!res.hasUpdate` تعرض رسالة "البرنامج محدَّث" → إذا `res.hasUpdate` تستدعي `renderUpdateResult(res)`

- [x] T012 [US1] تحديث `renderUpdateResult(res)` في `screens/settings/settings.js` السطر ~891: استبدال زر "تحديث الآن" (الذي كان يستدعي `performUpdate`) بزر "تحميل التحديث" يستدعي `handleDownload()` — الباقي (عرض الإصدار + الحجم) يبقى كما هو

- [x] T013 [US1] تحديث عرض حالة الدعم الفني في `initUpdatePanel()`: `window.api.getSupportStatus()` موجودة → الكود في السطر ~852 يبقى كما هو (لا تغيير مطلوب)

**Checkpoint**: اضبط `support_expiry_date = '2020-01-01'` → اضغط "فحص التحديثات" → يظهر خطأ الدعم المنتهي. اضبط `support_expiry_date = '2027-12-31'` → يبحث في GitHub ويعرض النتيجة الصحيحة.

---

## Phase 4: User Story 2 - تحميل التحديث مع شريط تقدم MB (Priority: P2)

**Goal**: الضغط على "تحميل التحديث" يبدأ التحميل ويعرض `X.X MB / Y.Y MB` يتحدث كل ثانية.

**Independent Test**: اضغط "تحميل التحديث" بعد ظهور بطاقة التحديث → الشريط يبدأ من 0 ويتحدث، الأرقام بالـ MB حقيقية.

### Implementation for User Story 2

- [x] T014 [P] [US2] تبسيط `#updateProgressPanel` HTML في `screens/settings/settings.html` السطر ~1624: حذف `#updateStepsList` div (السطر 1649)، الإبقاء على: progress bar (`#updateProgressBar`)، `#updateProgressPercent`، `#updateDownloadSize`، `#updateProgressTitle`، `#updateErrorMsg` — الـ gradient header يبقى

- [x] T015 [US2] إضافة دالة `handleDownload()` في `screens/settings/settings.js` داخل `initUpdatePanel()`: (١) تعطّل زر "تحميل التحديث"، (٢) تستدعي `showProgressPanel()` وتضبط عنوانه على "جارٍ التحميل..."، (٣) تستدعي `window.api.downloadUpdate()` → إذا فشل تعرض الخطأ، (٤) تبدأ polling كل 1000ms بـ `window.api.getUpdateProgress()` → تحدث `#updateProgressBar` + `#updateProgressPercent` + `#updateDownloadSize` (مثل `12.3 MB / 45.0 MB`) → إذا `res.downloadDone === true` توقف الـ polling وتستدعي `onDownloadComplete()`

- [x] T016 [US2] إضافة دالة `onDownloadComplete()` في `screens/settings/settings.js` داخل `initUpdatePanel()`: (١) تضبط الشريط على 100%، (٢) تغيّر عنوان panel إلى "اكتمل التحميل ✓"، (٣) تخفي `#updateProgressPanel` بعد ثانية، (٤) تعرض منطقة النتيجة `resultArea` مع زر "تثبيت الآن" (مُفعَّل) بدلاً من زر "تحميل التحديث"

- [x] T017 [US2] تحديث `fmtBytes()` في `screens/settings/settings.js` السطر ~837 إذا لزم: التأكد من أن المخرج يكون `MB` بخانة عشرية واحدة (`12.3 MB`) وليس `KB` عند الأحجام الكبيرة (الكود الموجود صحيح — تأكيد فقط)

- [x] T018 [US2] معالجة حالة خطأ التحميل في `handleDownload()`: إذا فشل `getUpdateProgress()` أو أعاد خطأ → وقف الـ polling → عرض رسالة خطأ واضحة → تفعيل زر "تحميل التحديث" مجدداً

**Checkpoint**: اضغط "تحميل التحديث" → يظهر شريط التقدم → الأرقام تتحدث كل ثانية بالـ MB → عند الاكتمال يظهر زر "تثبيت الآن".

---

## Phase 5: User Story 3 - تثبيت التحديث (Priority: P3)

**Goal**: الضغط على "تثبيت الآن" بعد اكتمال التحميل يُغلق البرنامج ويبدأ المثبّت.

**Independent Test**: بعد اكتمال التحميل، اضغط "تثبيت الآن" → البرنامج يُغلق والمثبّت يعمل.

### Implementation for User Story 3

- [x] T019 [US3] إضافة دالة `handleInstall()` في `screens/settings/settings.js` داخل `initUpdatePanel()`: (١) تعطّل زر "تثبيت الآن"، (٢) تعرض رسالة "جارٍ التثبيت..."، (٣) تستدعي `window.api.installUpdate()` → إذا `res.success` تعرض رسالة "سيتم إغلاق البرنامج..." → إذا فشل تعرض الخطأ وتُعيد تفعيل الزر

- [x] T020 [US3] التحقق من أن زر "تثبيت الآن" غير ظاهر/معطّل في أي حالة إلا بعد `onDownloadComplete()`: مراجعة تدفق الأزرار في `renderUpdateResult()` + `onDownloadComplete()` والتأكد من تسلسل الحالات الصحيح

**Checkpoint (Golden Path)**: اضبط `support_expiry_date = '2027-12-31'` → "فحص التحديثات" → "تحميل التحديث" → شريط MB يتحدث → "تثبيت الآن" → البرنامج يُغلق.

---

## Phase 6: Polish & التنظيف

**Purpose**: حذف الكود القديم غير المستخدم وإزالة التعقيد

- [x] T021 [P] حذف `renderSteps()` + `startProgressPolling()` + `startReconnectPolling()` + `animateBarToTarget()` + `handleUpdateNow()` من `screens/settings/settings.js` السطر ~1012-1186 (الدوال المرتبطة بالتدفق القديم)
- [x] T022 [P] إزالة case `'performUpdate'` من `server/invokeHandlers.js` — قرار: الإبقاء عليه كـ fallback (لا يُستخدم في الواجهة الجديدة)
- [x] T023 [P] إزالة `performUpdate` من `module.exports` — قرار: الإبقاء (موجود في `performUpdate` case وفي `web-api.js` كـ fallback)
- [ ] T024 التحقق من سيناريوهات `quickstart.md` الخمسة يدوياً

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: لا dependencies — يبدأ فوراً
- **Phase 2 (Foundational)**: يعتمد على Phase 1 — يحجب كل User Stories
- **Phase 3 (US1)**: يعتمد على Phase 2 فقط
- **Phase 4 (US2)**: يعتمد على Phase 2 + Phase 3 (الزر الجديد في T012)
- **Phase 5 (US3)**: يعتمد على Phase 4 (يحتاج `onDownloadComplete`)
- **Phase 6 (Polish)**: بعد اكتمال كل شيء

### User Story Dependencies

- **US1**: يعتمد على Phase 2 — مستقلة تماماً
- **US2**: يعتمد على US1 (T012 يضيف زر التحميل الذي يستدعي `handleDownload`)
- **US3**: يعتمد على US2 (زر "تثبيت الآن" يظهر من `onDownloadComplete`)

### Parallel Opportunities

- T001 + T002 + T003 يعملان معاً (Phase 1)
- T005 + T006 يعملان معاً (updateService فقط، لا تعارض)
- T014 + T021 يعملان معاً (HTML + JS cleanup في ملفين مختلفين)

---

## Implementation Strategy

### MVP First (User Story 1)

1. أكمل Phase 1 (تأكيد البنية)
2. أكمل Phase 2 Foundational (T004 → T010)
3. أكمل Phase 3 US1 (T011 → T013)
4. **اختبر يدوياً**: سيناريو 1 + 2 من `quickstart.md`

### الإصدار الكامل

5. أكمل Phase 4 US2 (T014 → T018)
6. أكمل Phase 5 US3 (T019 → T020)
7. **اختبر يدوياً**: سيناريو 3 (Golden Path) من `quickstart.md`
8. أكمل Phase 6 Polish

---

## Notes

- [P] tasks = ملفات مختلفة، لا تعارض
- [US?] label = ترتبط بـ User Story محددة من spec.md
- كل نقطة Checkpoint تعني إمكانية الاختبار المستقل
- مرجع quickstart.md: `specs/015-github-update-flow/quickstart.md`
- مرجع data-model.md للـ API contracts: `specs/015-github-update-flow/data-model.md`
