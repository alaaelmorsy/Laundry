# Tasks: Fix Auto-Update Completion Bugs

**Input**: Design documents from `specs/024-fix-update-completion-bugs/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | quickstart.md ✅

**Organization**: مُرتَّبة حسب User Story لتمكين التنفيذ والاختبار المستقل لكل قصة.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تشغيلها بالتوازي (ملفات مختلفة، لا اعتمادية)
- **[Story]**: الـ User Story المرتبطة (US1, US2, US3)

---

## Phase 1: Setup (لا يوجد إعداد مسبق — الملفات الموجودة تكفي)

**Purpose**: هذا الـ bugfix لا يحتاج إعداد بنية جديدة — جميع الملفات موجودة بالفعل.

- [x] T001 تحقق من وجود `scripts/updater.ps1` و`scripts/launch-installer.ps1` و`scripts/run-installer.ps1` في الـ repo
- [x] T002 تحقق أن `execFileSync` مستوردة في `server/services/updateService.js` (السطر ~1)

---

## Phase 2: User Story 3 — انتظار خروج Node قبل التثبيت (Priority: P2 / Foundational)

**Purpose**: B4 هو الأساس — بدونه لا يصل PID لـ `run-installer.ps1` → paths 4a/4b لا تنتظر Node. يجب إصلاحه أولاً.

**⚠️ CRITICAL**: إصلاح B4 أولاً لأنه يؤثر على صحة B2 و B3.

- [x] T003 [US3] في `scripts/launch-installer.ps1` السطر 75: أضف `-ServerPid $ServerPid` في نهاية `$psArgs`
- [x] T003b [US3] في `scripts/run-installer.ps1` السطر 78: أضف `else { Write-Log 'WARN' "ServerPid is 0 — skipping PID wait (falling back to time-based wait)" }` بعد بلوك الـ `if ($ServerPid -gt 0)` (يُغطي FR-007)

**Checkpoint**: اللوج يجب أن يُظهر `Waiting for Node server PID XXXX` وليس `ServerPid=0`

---

## Phase 3: User Story 2 — الـ Service يعود بعد الـ Installer (Priority: P1) 🎯 MVP

**Goal**: بعد اكتمال الـ installer عبر أي مسار (4a أو 4b)، يُستعاد NSSM ويشتغل الـ service تلقائياً.

**Independent Test**: شغّل installer وأتمّه — تحقق أن الـ service يرجع وأن `nssm.exe get LaundryPlusApp AppExit` يُعيد `0 Restart`.

### Implementation for User Story 2 — B2 (Path 4a)

- [x] T004 [US2] في `scripts/run-installer.ps1` السطر 127–138: حوّل `try/catch` في path 4a لـ `try/catch/finally`:
  - احذف `Remove-SelfTask` و`exit 0` من داخل الـ `try`
  - أضف `finally` block يحتوي: NSSM restore + `sc start` + `Remove-SelfTask` + `exit 0`
  - الـ catch يُبقي على `Write-Log 'WARN'` فقط (لا exit — الـ finally يتولى ذلك)

### Implementation for User Story 2 — B3 (Path 4b)

- [x] T005 [US2] في `scripts/run-installer.ps1` السطر 246: استبدل السطر الواحد `if ($guiLaunched) { Remove-SelfTask; exit 0 }` بـ block يحتوي NSSM restore قبل `exit 0`

**Checkpoint**: كلا path 4a و 4b يستعيدان NSSM — الـ service يرجع في جميع الأحوال

---

## Phase 5: User Story 1 — Legacy Updater عبر Task Scheduler (Priority: P1)

**Goal**: `spawnUpdater()` يسجّل `updater.ps1` كـ Scheduled Task خارج Job Object → يكتمل بعد خروج Node.

**Independent Test**: شغّل `installUpdate()` مع `isInstaller = false` — تحقق من `Get-ScheduledTask -TaskName 'LaundryPlusUpdater'` قبل خروج Node، وتحقق أن الـ exe يُستبدَل بعد خروجه.

### Implementation for User Story 1 — B1a (الملف الجديد)

- [x] T006 [US1] أنشئ `scripts/launch-updater.ps1` — نسخة مكيَّفة من `scripts/launch-installer.ps1`:
  - المعاملات: `$UpdaterScript`, `$ServerPid`, `$TargetVersion`, `$FromVersion`, `$NewExePath`, `$BackupPath`, `$AppRoot`
  - اسم الـ Task: `LaundryPlusUpdater`
  - `$psArgs`: يُمرَّر جميع معاملات `updater.ps1` بنفس الطريقة
  - **لا** تُضبط `NSSM AppExit 0 Exit` (الـ updater يعمل بعد خروج Node والـ service يرجع تلقائياً)
  - في حالة فشل التسجيل: `exit 1` فقط (لا تعديل NSSM)
  - نفس نمط الـ logging والـ console user detection الموجود في `launch-installer.ps1`

### Implementation for User Story 1 — B1b (تعديل updateService.js)

- [x] T007 [US1] في `server/services/updateService.js` دالة `spawnUpdater()` (السطر 406–419): استبدل `spawn(updater.ps1, detached)` بـ `execFileSync(launch-updater.ps1)` باتباع نفس نمط `spawnInstaller()`:
  - أضف `srcUpdater = path.join(ROOT, 'scripts', 'updater.ps1')`
  - أضف `srcLaunch = path.join(ROOT, 'scripts', 'launch-updater.ps1')`
  - تحقق من وجود الملفين (throw إذا غابا)
  - انسخهما لـ `DATA_DIR` كـ `_updater.ps1` و`_launch-updater.ps1`
  - استبدل `spawn` بـ `execFileSync` مع جميع المعاملات
  - احذف `child.unref()`

**Checkpoint**: `Get-ScheduledTask -TaskName 'LaundryPlusUpdater'` يُعيد نتيجة بعد استدعاء `spawnUpdater()` وقبل خروج Node

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T008 [P] راجع اللوج الكامل (`data/update-log.txt`) وتحقق أن جميع المسارات تُسجّل بوضوح
- [x] T009 تشغيل quickstart.md scenarios (B4 ← B2 ← B3 ← B1 بالترتيب)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: لا اعتماديات — يبدأ فوراً
- **Phase 2 (B4)**: يعتمد على Phase 1 — يُنجَز أولاً (يُمكّن صحة B2/B3)
- **Phase 3 (B2)**: يعتمد على Phase 2 — path 4a
- **Phase 4 (B3)**: يعتمد على Phase 2 — path 4b (يمكن التوازي مع Phase 3)
- **Phase 5 (B1)**: مستقل عن B2/B3 — يمكن العمل عليه بعد Phase 1
- **Phase 6 (Polish)**: يعتمد على اكتمال الكل

### User Story Dependencies

- **US2 (B2+B3)**: يعتمد على إصلاح B4 أولاً للتحقق الصحيح
- **US1 (B1)**: مستقل — يمكن تنفيذه بالتوازي مع US2 بعد Phase 1

### Parallel Opportunities

```bash
# T004 و T005 يُعدِّلان نفس الملف (run-installer.ps1) — لا يمكن التوازي:
T003 → T003b → T004 → T005 (متسلسلة في نفس الملف)

# لكن Phase 5 (B1) مستقلة تماماً:
# بعد T001-T002 مباشرةً:
Task T006 (إنشاء launch-updater.ps1) — موازية لـ T003/T004/T005
# ثم بعد T006:
Task T007 (تعديل spawnUpdater)
```

---

## Implementation Strategy

### الترتيب الموصى به (MVP First)

1. **T001-T002**: تحقق سريع (دقيقتان)
2. **T003** (B4): سطر واحد — أسهل إصلاح وأعلى تأثير
3. **T004** (B2): `try/catch/finally` في path 4a
4. **T005** (B3): 4 أسطر في path 4b
5. **T006** (B1a): ملف `launch-updater.ps1` الجديد
6. **T007** (B1b): تعديل `spawnUpdater()`
7. **T008-T009**: تحقق نهائي

### اختبر بعد كل مرحلة

- بعد T003: تحقق من اللوج أن PID يظهر
- بعد T004+T005: تحقق من NSSM بـ `nssm.exe get LaundryPlusApp AppExit`
- بعد T006+T007: تحقق من Task Scheduler

---

## Notes

- `execFileSync` موجودة بالفعل في `updateService.js` — لا حاجة لـ require جديد
- لا تُغيّر `NSSM AppExit` في `launch-updater.ps1` — الـ updater يعمل بعد خروج Node والـ service يرجع تلقائياً (AppExit default = Restart)
- path 4a: عند **نجاح** النافذة → يستعيد NSSM + يشغّل الـ service + exit. عند **فشلها** → يسقط لـ 4b/4c (اللذين يستعيدان NSSM بنفسيهما) — للحفاظ على fallback التثبيت الصامت
- جميع الإصلاحات backward-compatible — لا تأثير على dev mode أو interactive testing
