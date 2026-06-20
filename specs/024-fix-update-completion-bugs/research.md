# Research: Fix Auto-Update Completion Bugs

**Date**: 2026-06-20

---

## R1 — Windows Job Object والـ `detached: true` في Node.js

**Decision**: استخدام Task Scheduler بدلاً من `spawn(detached: true)` للـ legacy updater path.

**Rationale**:
- `detached: true` في Node.js على Windows يضيف `CREATE_NEW_PROCESS_GROUP` فقط، **لا** `CREATE_BREAKAWAY_FROM_JOB`
- NSSM يضع الـ service وجميع child processes داخل Job Object
- عند `process.exit(0)`، يقتل NSSM كل الـ processes في الـ Job Object تلقائياً
- Task Scheduler يملك الـ process مباشرةً خارج Job Object → يبقى حياً

**الإثبات من الكود الحالي**: `launch-installer.ps1` يوثّق هذا بالضبط في تعليقه (السطر 8–24):
```
# Any process the Node server spawns is a member of the service's job object
# and is KILLED the moment the server process exits
# A scheduled task is owned by Task Scheduler, NOT the service job object
```

**Alternatives considered**:
- `CREATE_BREAKAWAY_FROM_JOB` flag عبر Win32 API: يتطلب Add-Type في PowerShell أو native code — معقّد ودون فائدة إضافية
- Named pipe/socket للتنسيق بين Node وـ updater: مفرط في التعقيد

---

## R2 — NSSM AppExit Behavior

**Decision**: استعادة `AppExit 0 Restart` بعد كل مسار تثبيت (4a, 4b, 4c).

**Rationale**:
- `launch-installer.ps1` يضبط `AppExit 0 Exit` لمنع NSSM من إعادة التشغيل أثناء التثبيت
- إذا لم يُستعَد هذا الإعداد، يبقى الـ service "permanently dead" عند أي خروج بكود 0
- `run-installer.ps1` يستعيد الإعداد بالفعل في path 4c (silent fallback) لكن **لا** يفعل ذلك في paths 4a و 4b

**التحقق من الكود الحالي** (`run-installer.ps1`):
- Path 4a (السطر 134): `exit 0` مباشرةً بدون restore ❌
- Path 4b (السطر 246): `exit 0` بدون restore ❌
- Path 4c (السطر 268–278): restore موجود ✅

**Alternatives considered**:
- الاعتماد على Inno Setup لإعادة تشغيل الـ service: غير مضمون — قد لا تحتوي `[Run]` section على الـ service start
- إعادة تشغيل NSSM عبر watchdog خارجي: يُضيف تعقيداً غير ضروري

---

## R3 — `-ServerPid` في `launch-installer.ps1`

**Decision**: إضافة `-ServerPid $ServerPid` في `$psArgs` (سطر 75 في `launch-installer.ps1`).

**Rationale**:
- `launch-installer.ps1` يستقبل `$ServerPid` كـ parameter (السطر 5)
- `updateService.js` يمرّره بشكل صحيح (السطر 566)
- لكن `$psArgs` في السطر 75 لا يتضمّنه → `run-installer.ps1` يستقبل `$ServerPid = 0` دائماً
- بدون PID صحيح، يتخطى `run-installer.ps1` خطوة الانتظار → يبدأ التثبيت قبل خروج Node → قد تُقفَل الملفات

**التحقق من `run-installer.ps1`** (السطر 78):
```powershell
if ($ServerPid -gt 0) {
  # Wait loop
} else {
  # يتخطى الانتظار — unsafe
}
```

---

## R4 — `execFileSync` في `updateService.js`

**Decision**: `execFileSync` موجودة بالفعل في الـ require (السطر ~1).

**التحقق**: `spawnInstaller()` تستخدمها (السطر 561) — لا حاجة لتغيير الـ imports.

---

## R5 — نمط `launch-updater.ps1`

**Decision**: نسخ `launch-installer.ps1` وتكييفه للـ updater.

**الفروق عن `launch-installer.ps1`**:
1. لا `$SetupPath` و`$RunScript` — بدلاً منهما `$UpdaterScript` + معاملات `updater.ps1`
2. لا ضبط `NSSM AppExit 0 Exit` — الـ updater يعمل بعد خروج Node، وNSSM يعيد التشغيل تلقائياً بعد اكتمال الـ rename (AppExit default = Restart)
3. اسم الـ Task: `LaundryPlusUpdater`
4. `$psArgs` يتضمّن جميع معاملات `updater.ps1`:
   `-ServerPid`, `-TargetVersion`, `-FromVersion`, `-NewExePath`, `-BackupPath`, `-AppRoot`
