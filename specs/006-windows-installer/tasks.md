# Tasks: Windows Installer (Inno Setup)

**Input**: Design documents from `specs/006-windows-installer/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | quickstart.md ✅

**Tests**: لا اختبارات آلية — التحقق يدوي وفق quickstart.md

**Organization**: Tasks مقسّمة بحسب User Story لتمكين التسليم التدريجي.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

**Purpose**: إعداد بيئة البناء وهيكل المشروع

- [x] T001 تثبيت Inno Setup 6 على جهاز التطوير من `https://jrsoftware.org/isdl.php` (مسار: `C:\Program Files (x86)\Inno Setup 6\`)
- [x] T002 إنشاء مجلد `installer\` في جذر المشروع
- [x] T003 [P] إنشاء ملف `installer\laundry.iss` بالقسم [Setup] الأساسي (AppName, Version, DefaultDirName, Icon, Compression, PrivilegesRequired)
- [x] T004 [P] إضافة script `build:installer` في `package.json` يستدعي `iscc.exe installer\laundry.iss`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: التأكد من جاهزية مجلد `release\` قبل بناء المثبّت

**⚠️ CRITICAL**: يجب اكتمال هذه المرحلة قبل Phase 3

- [x] T005 التحقق من وجود `release\laundry-app.exe` — إذا غاب شغّل `npm run build` أولاً
- [x] T006 التحقق من وجود `release\mkcert.exe` — إذا غاب انسخه من جذر المشروع
- [x] T007 [P] التحقق من وجود `release\scripts\install-service.ps1`
- [x] T008 [P] إنشاء مجلد `release\ssl\` إذا لم يكن موجوداً (مجلد فارغ — يُملأ لاحقاً بـ setup.ps1)
- [x] T009 [P] التأكد من عدم وجود `release\rcedit.exe` — هذا الملف للبناء فقط ويجب استبعاده من المثبّت

**Checkpoint**: مجلد `release\` جاهز لبناء المثبّت

---

## Phase 3: User Story 1 - تثبيت أول مرة (Priority: P1) 🎯 MVP

**Goal**: مثبّت وظيفي كامل ينسخ الملفات ويسجّل Startup ويشغّل البرنامج

**Independent Test**: تشغيل `PLUS-Laundry-Setup.exe` على جهاز نظيف وإتمام التثبيت — راجع `quickstart.md` سيناريو 1

### Implementation

- [x] T010 [US1] إضافة قسم `[Languages]` في `installer\laundry.iss` بـ `Default.isl` + رسائل عربية في `[CustomMessages]`
- [x] T011 [US1] إضافة قسم `[Files]` في `installer\laundry.iss` لنسخ الملفات (onlyifdoesntexist للـ data/ و ssl/)
- [x] T012 [US1] إضافة قسم `[Run]` في `installer\laundry.iss` (حذف Task القديم + تسجيل جديد + تشغيل)
- [x] T013 [US1] إضافة قسم `[Icons]` في `installer\laundry.iss` لاختصار `{commonstartup}\PLUS Laundry`
- [x] T014 [US1] بناء المثبّت: `npm run build:installer` — ينتج `dist\PLUS-Laundry-Setup.exe` (14.1 MB)
- [ ] T015 [US1] اختبار التثبيت وفق `quickstart.md` سيناريو 1 (تثبيت أول مرة)
- [ ] T016 [US1] اختبار التشغيل التلقائي وفق `quickstart.md` سيناريو 2 (Task Scheduler)

**Checkpoint**: المثبّت يعمل كاملاً على جهاز نظيف — MVP جاهز للتسليم ✅

---

## Phase 4: User Story 2 - تثبيت في مجلد مختلف (Priority: P2)

**Goal**: التحقق من أن اختيار مجلد غير افتراضي يعمل بشكل صحيح

**Independent Test**: اختيار `D:\Programs\Laundry` والتحقق من نسخ الملفات وتحديث Task Scheduler — راجع `quickstart.md` سيناريو 4

### Implementation

- [x] T017 [US2] التحقق من صحة `DefaultDirName={autopf}\PLUS\Laundry` في `installer\laundry.iss` وأن زر "استعراض" يظهر تلقائياً (Inno Setup يوفره افتراضياً)
- [ ] T018 [US2] اختبار `quickstart.md` سيناريو 4: تثبيت في `D:\Programs\Laundry` والتحقق من أن:
  - الملفات في المجلد المختار
  - Task Scheduler يشير إلى المجلد الصحيح
  - البرنامج يعمل من المجلد الجديد

**Checkpoint**: اختيار مجلد مخصص يعمل بشكل صحيح

---

## Phase 5: User Story 3 - إعادة التثبيت (Priority: P3)

**Goal**: إعادة التثبيت تحدّث الملفات الثنائية وتحافظ على بيانات العميل

**Independent Test**: تثبيت مرتين والتحقق من بقاء ملفات `data\` — راجع `quickstart.md` سيناريو 3

### Implementation

- [x] T019 [US3] التحقق من أن `Flags: onlyifdoesntexist uninsneveruninstall` مطبَّقة على `release\data\*` في `installer\laundry.iss`
- [x] T020 [US3] التحقق من أن خطوة حذف Scheduled Task في `[Run]` تعمل بصمت حتى لو لم تكن المهمة موجودة (الـ `2>&1 | Out-Null` يمنع الخطأ)
- [ ] T021 [US3] اختبار `quickstart.md` سيناريو 3:
  - تثبيت أول مرة وإنشاء `data\test.txt`
  - تثبيت ثانية في نفس المجلد
  - التحقق من بقاء `data\test.txt` وتحديث `laundry-app.exe`

**Checkpoint**: إعادة التثبيت آمنة على بيانات العميل ✅

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T022 [P] رسالة إنهاء عربية في `[CustomMessages]` تعرض رابط `http://localhost:3000`
- [x] T023 [P] `dist/` موجودة في `.gitignore` — ينطبق على `PLUS-Laundry-Setup.exe`
- [ ] T024 تحديث `package.json` version إذا تغيّر الإصدار قبل الإصدار الرسمي
- [x] T025 [P] حجم `PLUS-Laundry-Setup.exe` = 14.1 MB ← أقل من 120 MB ✅
- [ ] T026 اختبار نهائي على Windows 11 (إضافة إلى Windows 10) وفق جميع سيناريوهات `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: لا تبعيات — يبدأ فوراً
- **Phase 2 (Foundational)**: يعتمد على اكتمال Phase 1 — يمنع بدء Phase 3+
- **Phase 3 (US1)**: يعتمد على Phase 2 — **MVP كامل عند الانتهاء**
- **Phase 4 (US2)**: يعتمد على Phase 3 (المثبّت موجود)
- **Phase 5 (US3)**: يعتمد على Phase 3 (المثبّت موجود)
- **Phase 6 (Polish)**: يعتمد على Phase 3-5

### User Story Dependencies

- **US1 (P1)**: يبدأ بعد Phase 2 — لا يعتمد على US2 أو US3
- **US2 (P2)**: يبدأ بعد Phase 3 — يحتاج المثبّت موجوداً
- **US3 (P3)**: يبدأ بعد Phase 3 — يحتاج المثبّت موجوداً
- **US2 و US3 يمكن تشغيلهما بالتوازي** بعد اكتمال US1

### Parallel Opportunities

- T003 و T004 (Phase 1) بالتوازي
- T007, T008, T009 (Phase 2) بالتوازي
- T022 و T023 و T025 (Phase 6) بالتوازي

---

## Implementation Strategy

### MVP First (User Story 1 فقط)

1. اكمل Phase 1: Setup
2. اكمل Phase 2: Foundational (CRITICAL)
3. اكمل Phase 3: US1 (T010 → T016)
4. **STOP & VALIDATE**: شغّل `quickstart.md` سيناريو 1 و2
5. **سلّم `PLUS-Laundry-Setup.exe` للعميل** ← هذا هو الهدف الأول

### Incremental Delivery

1. Phase 1+2+3 → MVP جاهز للتسليم
2. Phase 4 → دعم مجلد مختلف (اختبار إضافي)
3. Phase 5 → ضمان إعادة التثبيت الآمن
4. Phase 6 → تحسينات ختامية

---

## Notes

- لا يحتاج جهاز العميل أي متطلبات — Inno Setup للبناء فقط
- `[P]` = ملفات مختلفة، لا تبعيات
- `[Story]` = ربط المهمة بالـ User Story المقابل
- بعد T014 (بناء المثبّت) كل اختبار يدوي وفق `quickstart.md`
