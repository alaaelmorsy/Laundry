# Tasks: Windows Service Deployment

**Input**: Design documents from `specs/008-windows-service/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | quickstart.md ✅

**Organization**: Tasks مرتبة حسب User Story لتمكين التنفيذ والاختبار المستقل لكل قصة.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تنفيذه بالتوازي (ملفات مختلفة، لا تبعيات معلّقة)
- **[Story]**: القصة التي تنتمي إليها المهمة (US1..US4)

---

## Phase 1: Setup (البنية التحتية الأساسية)

**Purpose**: تجهيز الملفات والأدوات اللازمة قبل أي تنفيذ

- [ ] T001 تحميل `nssm.exe` v2.24 (64-bit) من الموقع الرسمي ووضعه في `installer/nssm.exe` **(يدوي — المستخدم)**
- [X] T002 [P] التحقق من إصدار `node-cron` في `package.json` والتأكد من وجوده (موجود بالفعل)
- [X] T003 [P] التحقق من أن `installer/laundry.iss` يحتوي على `PrivilegesRequired=admin` (موجود في السطر 24)

---

## Phase 2: Foundational (متطلبات أساسية تسبق كل القصص)

**Purpose**: البنية التي تعتمد عليها كل User Stories

**⚠️ CRITICAL**: لا يمكن البدء في أي User Story قبل إكمال هذه المرحلة

- [X] T004 `server/services/updateService.js` موجود بالكامل (checkForUpdate, performUpdate, getUpdateStatus, getUpdateProgress)
- [X] T005 `server/index.js` يفحص التحديثات عند البدء + cron كل 6 ساعات أُضيف في هذه الجلسة
- [X] T006 [P] Update UI موجودة في `screens/settings/settings.html` (panel كامل مع progress bar)
- [X] T007 [P] مفاتيح i18n لـ update موجودة في `assets/i18n.js` (17 مفتاح settings-update-*)

**Checkpoint**: ✅ Update infrastructure كاملة — يمكن البدء في User Stories

---

## Phase 3: User Story 1 — تشغيل تلقائي بعد الإقلاع (Priority: P1) 🎯 MVP

**Goal**: Windows Service يبدأ تلقائياً مع الجهاز بدون تدخل المستخدم

**Independent Test**: أعِد تشغيل الجهاز → بعد 60 ثانية → `https://localhost:3443` يفتح بدون تشغيل أي exe يدوياً

### Implementation

- [X] T008 [US1] إضافة `nssm.exe` في `[Files]` section في `installer/laundry.iss`

- [X] T009 [US1] إضافة procedure `RegisterService(AppDir: String)` في `[Code]` section في `installer/laundry.iss`:
  `nssm remove` → `nssm install` → `nssm set AppDirectory` → `nssm set DisplayName` → `nssm set Start SERVICE_AUTO_START` → `nssm set AppExit Default Restart` → `nssm set AppRestartDelay 5000` → `nssm set ObjectName LocalSystem` → `nssm start`

- [X] T010 [US1] تعديل `CurStepChanged` في `installer/laundry.iss`:
  - عند `ssInstall`: `nssm stop LaundryPlusApp` + sleep(2000) + `taskkill /F /IM laundry-app.exe` + sleep(1000)
  - عند `ssPostInstall`: icacls + hide .env + استدعاء `RegisterService()`

- [X] T011 [US1] إضافة procedure `CurUninstallStepChanged` في `installer/laundry.iss`:
  عند `usUninstall`: `nssm stop LaundryPlusApp` + `nssm remove LaundryPlusApp confirm`

- [X] T012 [US1] حذف `[Run]` entry فتح المتصفح من `installer/laundry.iss` + استبدال HKCU Run Registry بـ deletevalue

**Checkpoint**: بناء الـ installer وتثبيته على جهاز تجريبي → التحقق من `services.msc` أن "PLUS Laundry" Running — ثم إعادة تشغيل الجهاز

---

## Phase 4: User Story 2 — Desktop Shortcut (Priority: P1)

**Goal**: أيقونة على سطح المكتب تفتح المتصفح مباشرة بدون نوافذ سوداء

**Independent Test**: الضغط على الأيقونة → يفتح المتصفح على `https://localhost:3443` بدون cmd أو نافذة سوداء

### Implementation

- [X] T013 [US2] إضافة `[Icons]` section في `installer/laundry.iss`:
  `{commondesktop}\PLUS Laundry` → `explorer.exe https://localhost:3443` مع أيقونة `laundry-app.exe`

**Checkpoint**: بناء installer → تثبيت → التحقق من وجود الأيقونة على Desktop → ضغطها → يفتح المتصفح مباشرة

---

## Phase 5: User Story 3 — Auto Update (Priority: P2)

**Goal**: البرنامج يفحص التحديثات ويُبلَّغ المستخدم ويثبّت بموافقته

**Independent Test**: صفحة Settings → قسم التحديثات → "فحص التحديثات" → يظهر الإصدار الجديد

### Implementation

- [X] T014 [US3] `fetchLatestVersion()` / `checkForUpdate()` مكتملة في `server/services/updateService.js` مع GitHub API
- [X] T015 [US3] `isNewer()` (semver) مكتملة في `server/services/updateService.js`
- [X] T016 [US3] `downloadWithProgress()` + `performUpdate()` مكتملة في `server/services/updateService.js`
- [X] T017 [US3] Cases مسجّلة في `server/invokeHandlers.js`: `checkForUpdate`, `getUpdateStatus`, `performUpdate`, `getUpdateProgress`
- [X] T018 [US3] Methods مسجّلة في `assets/web-api.js`: `checkForUpdate`, `getUpdateStatus`, `performUpdate`, `getUpdateProgress`
- [X] T019 [US3] Update UI في `screens/settings/settings.html` مع progress bar وخطوات التحديث
- [X] T020 [US3] Update cron كل 6 ساعات مُضاف في `server/index.js` في هذه الجلسة

**Checkpoint**: Settings → التحديثات → فحص يدوي يعمل

---

## Phase 6: User Story 4 — إدارة الـ Service (Priority: P3)

**Goal**: المستخدم يستطيع إيقاف وإعادة تشغيل البرنامج من Windows Services

**Independent Test**: إيقاف الـ service من `services.msc` → البرنامج يتوقف → إعادة تشغيله → يعود خلال 15 ثانية

### Implementation

هذه القصة تعتمد على T008-T012 (Phase 3) — الـ NSSM يعطي الإدارة الكاملة من `services.msc` تلقائياً. لا كود إضافي مطلوب.

- [ ] T021 [US4] التحقق يدوياً من أن الـ Service يظهر في `services.msc` بعد التثبيت (اختبار يدوي)

**Checkpoint**: السيناريو 4 و5 في quickstart.md

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: تحسينات تؤثر على جميع القصص

- [X] T022 [P] تنظيف `installer/laundry.iss`: حذف taskkill المكرر، إزالة HKCU Run entry، إزالة فتح المتصفح
- [X] T023 [P] `try/catch` صامت في cron update checking في `server/index.js`
- [ ] T024 تشغيل السيناريوهات الـ 6 كاملة من `quickstart.md` والتوثيق **(بعد تحميل nssm.exe)**
- [ ] T025 [P] بناء الـ `release/laundry-setup.exe` النهائي وفحص الحجم (يجب < 135 MB)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 يدوي (تحميل nssm.exe) — يحجب T008 فقط
- **Foundational (Phase 2)**: ✅ مكتملة
- **Phase 3 (US1)**: ✅ مكتملة في الكود — تحتاج nssm.exe للاختبار
- **Phase 4 (US2)**: ✅ مكتملة
- **Phase 5 (US3)**: ✅ مكتملة
- **Phase 6 (US4)**: تحتاج nssm.exe للاختبار
- **Polish**: T024/T025 بعد تحميل nssm.exe

---

## ما تبقى (يتطلب إجراء المستخدم)

| المهمة | الإجراء |
|--------|---------|
| T001 | تحميل `nssm.exe` v2.24 x64 من `nssm.cc/download` ووضعه في `installer/nssm.exe` |
| T021-T025 | اختبار يدوي بعد بناء الـ installer |

## Notes

- جميع تعديلات `installer/laundry.iss` مكتملة — تحتاج `nssm.exe` فقط لبناء الـ installer
- Update Service مكتمل بالفعل قبل هذه الجلسة مع GitHub API وchecksum verification
- 6-hour cron أُضيف في `server/index.js` في هذه الجلسة
- بناء الـ installer: `npm run build:installer` من مجلد `D:\PLUS\Laundry`
