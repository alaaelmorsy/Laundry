# Tasks: Full Self-Contained Installer Bundle

**Input**: Design documents from `specs/007-full-installer-bundle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks organized by user story — كل story قابلة للتنفيذ والاختبار بشكل مستقل.

**Note**: ملف واحد يتغير فقط — `installer/laundry.iss` — مع 4 phases تُضيف إليه تدريجياً.

---

## Phase 1: Setup (قراءة الحالة الراهنة)

**Purpose**: قراءة الـ installer الحالي وفهم البنية قبل التعديل

- [x] T001 اقرأ `installer/laundry.iss` كاملاً وحدد: `[Files]` entries لـ `.env`، وجود/غياب `[Registry]` و `[Code]` sections، و entry فتح المتصفح في `[Run]`

---

## Phase 2: Foundational (المتطلبات الأساسية)

**Purpose**: لا توجد متطلبات أساسية blocking — كل التغييرات مستقلة في `installer/laundry.iss`

**Checkpoint**: يمكن البدء مباشرة بـ Phase 3

---

## Phase 3: User Story 1 — تثبيت نظيف + تشغيل تلقائي (Priority: P1) MVP

**Goal**: المستخدم يثبّت البرنامج ويجد المتصفح يفتح تلقائياً على `https://localhost:3443`

**Independent Test**: تثبيت على جهاز نظيف (MySQL فقط) → المتصفح يفتح → صفحة login تظهر خلال 90 ثانية

### Implementation for User Story 1

- [x] T002 [US1] في `installer/laundry.iss`، تحقق أن entry `.env` في `[Files]` يستخدم `Flags: ignoreversion onlyifdoesntexist uninsneveruninstall` بدلاً من `ignoreversion` فقط — إذا كان مختلفاً، عدّله
- [x] T003 [US1] في `installer/laundry.iss`، تحقق أن جميع `DestDir` entries تستخدم `{app}` — وثّق في تعليق إذا كانت صحيحة أو عدّلها إذا وجدت مسار مطلق
- [x] T004 [US1] ابنِ `PLUS-Laundry-Setup.exe` بتشغيل `npm run build:installer` وتحقق من اكتمال البناء وحجم الناتج في `dist\`

**Checkpoint**: الـ installer الحالي يعمل بدون تغييرات جوهرية — جاهز للـ Phase 4

---

## Phase 4: User Story 2 — إعادة التثبيت مع حفظ البيانات (Priority: P2)

**Goal**: تثبيت نسخة جديدة فوق قديمة دون حذف `data/` أو `.env`

**Independent Test**: ثبّت نسخة → أضف ملف في `data/` → ثبّت مرة ثانية → الملف لا يزال موجوداً + `.env` لم يتغير

### Implementation for User Story 2

- [x] T005 [US2] في `installer/laundry.iss`، أضف `[Code]` section مع دالة `CurStepChanged(CurStep: TSetupStep)` تنفّذ `taskkill /F /IM laundry-app.exe` ثم `Sleep(1500)` عند `ssInstall` — يمنع "access denied" عند استبدال الـ exe
- [x] T006 [US2] ابنِ `PLUS-Laundry-Setup.exe` من جديد بـ `npm run build:installer` وتحقق من البناء

**Checkpoint**: إعادة التثبيت تعمل بدون أخطاء "access denied" + البيانات محفوظة

---

## Phase 5: User Story 3 — معالجة بيئة Node.js المحذوفة (Priority: P2)

**Goal**: أجهزة كانت عليها Node.js ثم حُذف → البرنامج يشتغل بدون أخطاء OPENSSL

**Independent Test**: أضف `OPENSSL_CONF` مصطنع في registry → ثبّت البرنامج → تحقق من حذف المتغير + البرنامج يشتغل

### Implementation for User Story 3

- [x] T007 [US3] في `installer/laundry.iss`، أضف قسم `[Registry]` يحذف المتغيرات الخمسة من `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment`: `OPENSSL_CONF`, `OPENSSL_ENGINES`, `NODE_OPTIONS`, `NODE_PATH`, `NODE_ENV` — كل سطر بـ `Flags: deletevalue; Tasks: ;`
- [x] T008 [US3] في دالة `CurStepChanged` الموجودة من T005، أضف بعد `Sleep(1500)` استدعاء `SendBroadcastMessage($001A, 0, 'Environment')` لإعلام Windows بتغيير متغيرات البيئة
- [x] T009 [US3] ابنِ `PLUS-Laundry-Setup.exe` بـ `npm run build:installer` وتحقق من البناء
- [ ] T010 [US3] اختبر Scenario 2 من `quickstart.md`: أضف متغيرات Node.js مصطنعة في registry، ثبّت البرنامج، تحقق من حذفها بـ `[System.Environment]::GetEnvironmentVariable("OPENSSL_CONF", "Machine")`

**Checkpoint**: البرنامج يشتغل على أجهزة كانت عليها Node.js مُحذَف

---

## Phase 6: Polish — تحسين UX فتح المتصفح (Priority: P3)

**Purpose**: تحسين اختياري لتجربة نهاية التثبيت

- [x] T011 [P] في `installer/laundry.iss`، في قسم `[Run]`، استبدل entry فتح المتصفح (الذي يستخدم `ping`) بـ entry يستخدم `timeout /t 15 /nobreak` مع `Flags: runhidden postinstall nowait` و `Description: "فتح البرنامج في المتصفح"` — هذا يجعله checkbox اختياري في نهاية التثبيت
- [x] T012 [P] ابنِ `PLUS-Laundry-Setup.exe` النهائي بـ `npm run build:installer` وتحقق من الحجم (< 130 MB)
- [ ] T013 نفّذ Scenario 1 من `quickstart.md` (تثبيت نظيف كامل) وتحقق من جميع معايير النجاح
- [ ] T014 نفّذ Scenario 3 (مجلد مخصص) و Scenario 4 (إعادة التشغيل) من `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: لا dependencies — ابدأ فوراً
- **Phase 2 (Foundational)**: لا يوجد — Phase 3 يبدأ مباشرة بعد Phase 1
- **Phase 3 (US1 — P1)**: يعتمد على Phase 1 فقط
- **Phase 4 (US2 — P2)**: يعتمد على Phase 3 (لأن `[Code]` section يُضاف فوق ما في Phase 3)
- **Phase 5 (US3 — P2)**: يعتمد على Phase 4 (يُضيف على `CurStepChanged` الموجودة)
- **Phase 6 (Polish)**: يعتمد على Phase 5

### Within Each Phase

- T005 قبل T008 (لا يمكن إضافة `SendBroadcastMessage` في دالة غير موجودة)
- T007 يمكن تنفيذه بالتوازي مع T005 (sections مختلفة في نفس الملف)

### Parallel Opportunities

- T007 و T005 يمكن كتابتهما بالتوازي (كل منهما في section مختلفة)
- T011 و T012 و T013 و T014 في Phase 6 يمكن تنفيذها بشكل متتالٍ سريع

---

## Implementation Strategy

### MVP (User Story 1 فقط — Phases 1 و 3)

1. اقرأ الـ installer الحالي (T001)
2. تحقق من `.env` flags (T002)
3. تحقق من مسارات `{app}` (T003)
4. ابنِ وتحقق (T004)
5. **توقف وتحقق**: هل الـ installer يعمل على جهاز نظيف؟

### الترتيب الكامل الموصى به

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 + T008 → T009 → T010 → T011 → T012 → T013 → T014
```

T007 و T008 يمكن كتابتهما معاً قبل البناء T009.

---

## Notes

- `installer/laundry.iss` هو الملف الوحيد الذي يتغير
- كل build (`npm run build:installer`) يستغرق ~30 ثانية
- اختبر دائماً على جهاز حقيقي (وليس نفس جهاز التطوير) للسيناريوهات الحساسة
- `deletevalue` flag في Inno Setup آمن حتى لو لم يكن الـ key موجوداً
