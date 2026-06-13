# Tasks: تغليف البرنامج كملف تنفيذي مستقل (pkg)

**Input**: Design documents from `specs/005-pkg-packaging/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | quickstart.md ✅

**Organization**: مرتبة بحسب قصص المستخدم لتمكين التنفيذ والاختبار المستقل لكل قصة.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن التنفيذ بالتوازي (ملفات مختلفة، لا تبعيات على مهام غير مكتملة)
- **[Story]**: القصة التي تنتمي إليها المهمة (US1, US2, US3, US4)
- كل وصف يحتوي المسار الدقيق للملف

---

## Phase 1: Setup (البنية التحتية المشتركة)

**Purpose**: تجهيز أدوات البناء قبل أي تعديل في الكود

- [x] T001 تثبيت `pkg` كـ devDependency: `npm install --save-dev pkg` وتحديث `package.json`

---

## Phase 2: Foundational (متطلبات أساسية تعوق جميع القصص)

**Purpose**: مودول المسارات المركزي — كل الملفات الأخرى تعتمد عليه

**⚠️ CRITICAL**: لا يمكن البدء في أي قصة قبل اكتمال هذه المرحلة

- [x] T002 إنشاء `server/paths.js` بـ `APP_ROOT` و`DATA_ROOT` و`isPkg` و`EXEC_DIR` كما في `data-model.md`

**Checkpoint**: `paths.js` جاهز — يمكن البدء في تعديل باقي الملفات

---

## Phase 3: User Story 1 - تشغيل البرنامج بدون Node.js (Priority: P1) 🎯 MVP

**Goal**: `laundry.exe` يشتغل كاملاً على جهاز بدون Node.js

**Independent Test**: نقل `dist\laundry.exe` + `.env` لجهاز بدون Node.js، تشغيله، فتح `http://localhost:3000` والتحقق من ظهور شاشة تسجيل الدخول

### Implementation for User Story 1

- [x] T003 [US1] تعديل `server/index.js`: إضافة `require('./paths')` في السطر الأول، تغيير `dotenv.config` لاستخدام `DATA_ROOT`، تغيير `ROOT` ليستخدم `APP_ROOT`
- [x] T004 [P] [US1] تعديل `server/sslCert.js`: استبدال `path.join(__dirname, '..', 'ssl')` بـ `path.join(DATA_ROOT, 'ssl')` باستخدام `require('./paths')`
- [x] T005 [P] [US1] تعديل `server/services/exportsService.js`: استبدال `ROOT = path.join(__dirname, '..', '..')` بـ `const { APP_ROOT: ROOT } = require('../paths')`
- [x] T006 [US1] تعديل `package.json`: إضافة `"bin"`, `"pkg"` (targets, assets, outputPath) و`"build"` script كما في plan.md Phase G (depends on T001)
- [x] T007 [US1] تشغيل `npm run build` والتحقق من إنشاء `dist\laundry-app.exe` بحجم 71.6 MB (depends on T003, T004, T005, T006)
- [x] T008 [US1] اختبار `dist\laundry-app.exe` محلياً — HTTP 200 ✅ (depends on T007)

**Checkpoint**: `laundry.exe` يعمل محلياً — جاهز للاختبار على جهاز بدون Node.js

---

## Phase 4: User Story 2+3 - إعدادات قابلة للتعديل + البيانات خارج الـ exe (Priority: P2)

**Goal**: `.env` و`data/` و`ssl/` تعمل دائماً بجانب الـ exe وليس داخله

**Independent Test**: تعديل `.env` بجانب `laundry.exe` وإعادة تشغيله — يتصل بـ MySQL الصحيح. فحص `dist\data\` يظهر بجانب الـ exe وليس داخله.

### Implementation for User Story 2 + 3

- [x] T009 [P] [US2] تعديل `server/services/updateService.js`: استبدال `ROOT` و`DATA_DIR` و`BACKUP_DIR` باستخدام `paths.js` (depends on T002)
- [x] T010 [P] [US2] تعديل `server/services/whatsappService.js`: استبدال `SESSION_DIR` بـ `path.join(DATA_ROOT, 'data', 'whatsapp_session')` (depends on T002)
- [x] T011 [US2] `.env.example` موجود بالفعل في مجلد المشروع بجميع الحقول المطلوبة
- [x] T012 [US3] اختبار أن `data\` يُنشأ بجانب `laundry-app.exe` — تأكدنا: data\whatsapp_session, update-log.txt, update-status.json ✅

**Checkpoint**: البيانات والإعدادات تعمل خارج الـ exe بشكل صحيح

---

## Phase 5: User Story 4 - تشغيل تلقائي مع Windows (Priority: P3)

**Goal**: `laundry.exe` يبدأ تلقائياً مع Windows كـ Windows Service

**Independent Test**: تشغيل `install-service.ps1` ثم إعادة تشغيل الجهاز والتحقق أن البرنامج يبدأ تلقائياً خلال 60 ثانية

### Implementation for User Story 4

- [x] T013 [US4] إنشاء `scripts\install-service.ps1` بمعاملات `$ExePath`, `$ServiceName`, `$NssmPath` وأوامر nssm
- [x] T014 [US4] اختبار `install-service.ps1` — السكريبت يعمل ويعطي رسالة واضحة عند غياب nssm.exe ✅

**Checkpoint**: Windows Service يعمل ويعيد التشغيل تلقائياً عند الفشل

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: التحقق النهائي والتوثيق

- [ ] T015 [P] اختبار سيناريو MySQL غير متاح على جهاز العميل (اختبار يدوي)
- [ ] T016 [P] اختبار مسارات تحتوي مسافات على جهاز العميل (اختبار يدوي)
- [ ] T017 التحقق من Baileys/WhatsApp بعد التغليف على جهاز العميل (اختبار يدوي)
- [x] T018 [P] `dist\` موجودة بالفعل في `.gitignore` ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: لا تبعيات — يبدأ فوراً
- **Foundational (Phase 2)**: يعتمد على Phase 1 — يعوق جميع القصص
- **US1 (Phase 3)**: يعتمد على Phase 2 — MVP الأساسي
- **US2+US3 (Phase 4)**: يعتمد على Phase 2 — يمكن موازاته مع US1 في T009 و T010
- **US4 (Phase 5)**: يعتمد على اكتمال Phase 3 (لازم يكون الـ exe موجود)
- **Polish (Phase 6)**: يعتمد على اكتمال Phase 3 على الأقل

### User Story Dependencies

- **US1 (P1)**: الأولوية القصوى — MVPالكامل
- **US2+US3 (P2)**: مكمّلان لـ US1؛ T009 و T010 يمكن موازاتهما مع Phase 3
- **US4 (P3)**: يعتمد على وجود `laundry.exe` من US1

### Within Each Phase

- T003 يُنفَّذ أولاً في Phase 3 (index.js يحدد ROOT المستخدم في static serving)
- T004 و T005 يمكن موازاتهما مع T003 (ملفات مستقلة)
- T006 بعد T001 (يحتاج pkg مثبتاً)
- T007 بعد T003+T004+T005+T006 (بناء الـ exe)

### Parallel Opportunities

- T004 و T005 في Phase 3: ملفات مستقلة تماماً
- T009 و T010 في Phase 4: ملفات مستقلة تماماً
- T015 و T016 و T018 في Phase 6: مستقلة

---

## Parallel Example: User Story 1

```text
# بعد T002 (paths.js جاهز)، شغّل هذه بالتوازي:
T003: تعديل server/index.js
T004: تعديل server/sslCert.js
T005: تعديل server/services/exportsService.js
T006: تعديل package.json pkg config

# بعد اكتمال الأربعة:
T007: npm run build
T008: اختبار dist\laundry.exe
```

---

## Implementation Strategy

### MVP First (User Story 1 فقط)

1. أكمل Phase 1 (T001) — تثبيت pkg
2. أكمل Phase 2 (T002) — paths.js
3. أكمل Phase 3 (T003-T008) — بناء واختبار الـ exe
4. **توقف وتحقق**: اختبر `laundry.exe` على جهاز بدون Node.js
5. اعتبره MVP قابلاً للتسليم

### Incremental Delivery

1. Phase 1+2 → البنية التحتية جاهزة
2. Phase 3 → `laundry.exe` يعمل (MVP ✅)
3. Phase 4 → البيانات والإعدادات خارج الـ exe
4. Phase 5 → تشغيل تلقائي مع Windows
5. Phase 6 → اختبارات نهائية وتوثيق

---

## Notes

- [P] = ملفات مختلفة، لا تبعيات، يمكن تنفيذها بالتوازي
- [US?] = تتبع المهمة لقصة مستخدم محددة
- الـ exe الناتج في `dist\laundry.exe` — لا يُرفع لـ git (`dist\` في `.gitignore`)
- نسخ `nssm.exe` يدوياً من الموقع الرسمي وإدراجه في حزمة التوزيع
- تحقق من سيناريوهات `quickstart.md` بعد كل Checkpoint
