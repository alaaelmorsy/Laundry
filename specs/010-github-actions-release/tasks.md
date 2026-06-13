# Tasks: GitHub Actions Automated Release & Auto-Update

**Input**: Design documents from `specs/010-github-actions-release/`

**Organization**: Tasks مرتبة حسب User Story لتمكين التنفيذ والاختبار المستقل لكل story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تشغيلها بالتوازي (ملفات مختلفة، بدون تبعيات)
- **[Story]**: الـ User Story المرتبطة بالمهمة

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: التحقق من وجود الـ workflow file وتجهيز البيئة

- [ ] T001 تحقق من وجود `.github/workflows/release.yml` في المشروع
- [ ] T002 تحقق من ضبط Workflow permissions على "Read and write" في GitHub repo settings

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: تطبيق التعديلات على الـ workflow لتصحيح اسم الـ exe

**⚠️ CRITICAL**: لا يمكن البدء في اختبار أي User Story قبل اكتمال هذه المرحلة

- [ ] T003 تعديل خطوة "Build exe" في `.github/workflows/release.yml` لاستخدام `--output "dist\Laundry-PLUS-v$version.exe"` بدلاً من `dist\laundry-app.exe`
- [ ] T004 تعديل خطوة "Generate checksums" في `.github/workflows/release.yml` — تحديث متغير `$exeName` وسطر الـ hash ليحمل `Laundry-PLUS-v$version.exe`
- [ ] T005 تعديل خطوة "Create Release" في `.github/workflows/release.yml` — تحديث مسار الـ exe المرفوع من `dist\laundry-app.exe` إلى `dist\Laundry-PLUS-v$version.exe`

**ملاحظة**: التعديلات T003-T005 تم تطبيقها بالفعل في جلسة التخطيط. هذه المهام للتحقق فقط.

**Checkpoint**: الـ workflow جاهز للاختبار

---

## Phase 3: User Story 1 — Push Triggers Build and Release (Priority: P1) 🎯 MVP

**Goal**: كل push على `main` بإصدار جديد يُنشئ GitHub Release تلقائياً يحتوي على `Laundry-PLUS-v{version}.exe`

**Independent Test**: رفع `package.json` بإصدار جديد ومشاهدة الـ Release على GitHub خلال 15 دقيقة

### Implementation for User Story 1

- [ ] T006 [US1] رفع الكود على GitHub — `git add .github/workflows/release.yml && git commit -m "fix: rename exe to Laundry-PLUS-v{version}" && git push`
- [ ] T007 [US1] مراقبة الـ workflow على `https://github.com/alaaelmorsy/Laundry/actions` والتحقق من نجاح كل خطوة
- [ ] T008 [US1] التحقق من الـ Release على `https://github.com/alaaelmorsy/Laundry/releases` — يجب أن يحتوي على:
  - `Laundry-PLUS-v1.0.12.exe`
  - `laundry-v1.0.12.zip`
  - `sha256sums.txt`
- [ ] T009 [US1] اختبار منع التكرار — رفع commit جديد بنفس الإصدار والتحقق من أن الـ workflow يتوقف بدون إنشاء release مكرر

**Checkpoint**: US1 مكتمل — الـ Release يُنشأ تلقائياً بالاسم الصحيح

---

## Phase 4: User Story 2 — In-App Auto-Updater Detects Release (Priority: P2)

**Goal**: نظام التحديث الداخلي يكتشف الـ Release الجديد تلقائياً ويعرض إشعار للمستخدم

**Independent Test**: بعد نشر Release، يظهر إشعار التحديث في البرنامج خلال ساعة

### Implementation for User Story 2

- [ ] T010 [P] [US2] رفع إصدار جديد — غيّر `version` في `package.json` من `1.0.12` إلى `1.0.13` واضغط push لإنشاء Release جديد
- [ ] T011 [US2] تشغيل البرنامج على جهاز بالإصدار `1.0.12` والضغط على "التحقق من التحديثات"
- [ ] T012 [US2] التحقق من ملف `data/update-status.json` — يجب أن يحتوي على `"hasUpdate": true` و `"latestVersion": "1.0.13"` و `"downloadUrl"` يشير لـ `laundry-v1.0.13.zip`
- [ ] T013 [US2] التحقق من أن `downloadUrl` في الـ status file يشير لملف الـ ZIP الموجود فعلاً في الـ Release

**Checkpoint**: US2 مكتمل — البرنامج يكتشف التحديثات تلقائياً

---

## Phase 5: User Story 3 — Auto-Update Applies Automatically (Priority: P3)

**Goal**: المستخدم يضغط "تطبيق التحديث" فيتم التنزيل والتثبيت وإعادة التشغيل تلقائياً

**Independent Test**: تنزيل الـ ZIP من الـ Release يدوياً والتحقق من أن `updater.ps1` يطبقه بنجاح

### Implementation for User Story 3

- [ ] T014 [US3] الضغط على "تطبيق التحديث" في البرنامج ومراقبة مراحل التحديث (backup → downloading → verify → replace → restart)
- [ ] T015 [US3] التحقق من `data/update-log.txt` — يجب أن يسجل كل خطوة بنجاح وينتهي بـ `Update complete: 1.0.12 -> 1.0.13`
- [ ] T016 [US3] بعد إعادة التشغيل، التحقق من أن البرنامج يعرض الإصدار `1.0.13`
- [ ] T017 [US3] اختبار سيناريو فشل الـ checksum — تعديل `sha256sums.txt` يدوياً والتحقق من ظهور رسالة خطأ واضحة بدون تلف البيانات

**Checkpoint**: US3 مكتمل — التحديث التلقائي الكامل يعمل end-to-end

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T018 [P] توثيق طريقة رفع إصدار جديد في `README` أو `CLAUDE.md` — خطوات: غيّر version → push → انتظر 15 دقيقة
- [ ] T019 التحقق من أن `.gitignore` يستثني `dist/` لمنع رفع الـ exe المحلي على GitHub

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: تبدأ فوراً
- **Foundational (Phase 2)**: بعد Phase 1 — تحجب كل الـ User Stories
- **US1 (Phase 3)**: بعد Phase 2 — لا تعتمد على US2 أو US3
- **US2 (Phase 4)**: تعتمد على US1 (لأن الـ Release يجب أن ينشأ أولاً)
- **US3 (Phase 5)**: تعتمد على US2 (لأن التحديث يحتاج اكتشافه أولاً)
- **Polish (Phase 6)**: بعد اكتمال US1 على الأقل

### Parallel Opportunities

- T003، T004، T005 (التعديلات على الـ workflow) — T003 يسبق T004 و T005 لأنها على نفس الملف
- T010 (رفع إصدار جديد) يمكن تشغيله بشكل مستقل قبل T011-T013

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2: التحقق من الـ workflow وتطبيق التعديلات
2. Phase 3 (US1): push واختبار البناء والـ Release
3. **توقف وتحقق**: الـ Release موجود بالاسم الصحيح على GitHub
4. هذا MVP كافٍ للتوزيع اليدوي

### Incremental Delivery

1. Setup + Foundational → الـ workflow جاهز
2. US1 → الـ Release يُنشأ تلقائياً (MVP!)
3. US2 → البرنامج يكتشف التحديثات
4. US3 → التحديث التلقائي الكامل

---

## Notes

- التعديلات على `.github/workflows/release.yml` (T003-T005) تم تطبيقها مسبقاً — تحتاج تحقق فقط
- [P] = ملفات مختلفة أو مهام مستقلة بدون تبعيات
- اختبار US3 يحتاج إصدارين مختلفين (جهاز بـ 1.0.12 + Release بـ 1.0.13)
