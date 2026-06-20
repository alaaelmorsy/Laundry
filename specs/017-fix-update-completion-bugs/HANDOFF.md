# Handoff: Fix Update Completion Bugs — جاهز لـ /speckit-plan

## السياق

**المشروع**: PLUS Laundry POS — تطبيق ويب on-premise، Node.js + Express، يعمل كـ Windows Service عبر NSSM.

**الـ Branch الحالي**: `claude/auto-update-system-issues-ec8dvs`

**الـ Spec المكتملة**: `specs/017-fix-update-completion-bugs/spec.md` ✅

**المهمة**: تشغيل `/speckit-plan` على الـ spec دي لإنشاء خطة التنفيذ، ثم تنفيذ الإصلاحات.

---

## ملخص المشاكل (4 Bugs مؤكدة)

نظام التحديث التلقائي لا يكمل التحديث بعد إغلاق السيرفر بسبب 4 أخطاء في الملفين:
- `server/services/updateService.js`
- `scripts/launch-installer.ps1`
- `scripts/run-installer.ps1`

---

## Bug B1 — CRITICAL: `spawnUpdater` يتقتل من Windows Job Object

**الملف**: `server/services/updateService.js` السطر 407–419

**الكود الحالي (المكسور)**:
```js
function spawnUpdater({ targetVersion, fromVersion, newExePath, backupPath }) {
  const updaterScript = path.join(DATA_ROOT, 'scripts', 'updater.ps1');
  const child = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', updaterScript,
    '-ServerPid',     String(process.pid),
    '-TargetVersion', targetVersion,
    '-FromVersion',   fromVersion,
    '-NewExePath',    newExePath,
    '-BackupPath',    backupPath,
    '-AppRoot',       DATA_ROOT,
  ], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}
```

**المشكلة**: `detached: true` في Node.js على Windows يضيف `CREATE_NEW_PROCESS_GROUP` لكن **لا** يضيف `CREATE_BREAKAWAY_FROM_JOB`. لذلك `updater.ps1` لا يزال داخل Windows Job Object الخاص بـ NSSM. عندما يخرج Node بـ `process.exit(0)`، يقتل NSSM كل الـ children في الـ Job Object — ومعهم `updater.ps1` قبل أن يبدأ في استبدال أي ملف.

**الإثبات**: نفس هذه المشكلة موثّقة في `launch-installer.ps1` السطر 13-16:
```
# Any process the Node server spawns is a member of the service's job object
# and is KILLED the moment the server process exits
```

**الحل المطلوب**: استخدام نفس نمط `launch-installer.ps1` — تسجيل `updater.ps1` كـ Scheduled Task بدلاً من `spawn`. Task Scheduler يملك الـ process، وليس الـ Node server، فيبقى حياً بعد خروج Node.

**التفاصيل التقنية للحل**:
- إنشاء `scripts/launch-updater.ps1` يشبه `launch-installer.ps1` لكن يسجّل مهمة تشغيل `updater.ps1` بدلاً من `run-installer.ps1`
- أو: تعديل `launch-installer.ps1` ليقبل معاملات عامة (مسار السكريبت + معاملاته)
- `spawnUpdater()` في `updateService.js` يستخدم `execFileSync` (synchronous) لتسجيل المهمة مثلما تفعل `spawnInstaller()`
- نسخ `updater.ps1` من `ROOT/scripts/` إلى `DATA_DIR` قبل التسجيل (PowerShell لا يقرأ داخل pkg snapshot)

---

## Bug B2 — HIGH: Path 4a يخرج بدون إعادة تشغيل الـ Service

**الملف**: `scripts/run-installer.ps1` السطر 127–138

**الكود الحالي (المكسور)**:
```powershell
# ── 4a. Interactive session (dev/direct run): launch GUI directly ─────────────
if ($currentSessionId -ne 0) {
  Write-Log 'INFO' "Interactive session — launching installer GUI directly"
  try {
    Start-Process -FilePath $SetupPath -Wait -ErrorAction Stop
    Write-Log 'INFO' "Installer GUI completed"
    Write-Log 'INFO' "run-installer: done (direct GUI). Inno Setup restarted the service."
    Remove-SelfTask
    exit 0       # ← يخرج بدون NSSM restore أو service start
  } catch {
    Write-Log 'WARN' "Direct launch failed: $_ — trying API approach"
    # ← الكاتش يمشي للـ 4b بدون NSSM restore أيضاً
  }
}
```

**المشكلة**: 
- `NSSM AppExit 0 = Exit` ضُبط في `launch-installer.ps1` ولم يُستعد
- بعد اكتمال التثبيت أو فشله، لا أحد يعيد تشغيل الـ service
- التعليق `"Inno Setup restarted the service"` افتراض خاطئ — لا ضمان أن الـ `.iss` file يحتوي `[Run]` section يشغّل الـ service

**الحل المطلوب**: بعد `Start-Process -Wait` (سواء نجح أو رمى exception)، يجب:
```powershell
# أضف هذا في finally block أو بعد try/catch
if ((Test-Path $NssmPath) -and (Test-ServiceExists)) {
  Write-Log 'INFO' "Restoring NSSM AppExit 0 to Restart (post-GUI install)..."
  & $NssmPath set $ServiceName AppExit 0 Restart 2>$null | Out-Null
  Write-Log 'INFO' "Starting service $ServiceName (post-GUI install)..."
  & $NssmPath start $ServiceName 2>$null | Out-Null
  & sc.exe start $ServiceName 2>$null | Out-Null
}
```

**ملاحظة**: الكاتش الحالي يسقط للـ 4b — هذا الـ flow منطقي لكن يجب ضمان NSSM restore في جميع مسارات الخروج.

---

## Bug B3 — HIGH: Path 4b يخرج فوراً بدون ضمان إعادة تشغيل الـ Service

**الملف**: `scripts/run-installer.ps1` السطر 238–246

**الكود الحالي (المكسور)**:
```powershell
  [UserSessionLauncher]::CloseHandle($pi.hProcess) | Out-Null
  [UserSessionLauncher]::CloseHandle($pi.hThread) | Out-Null

  Write-Log 'INFO' "Installer GUI launched in session $sid PID=$($pi.dwProcessId)"
  Write-Log 'INFO' "run-installer: done (GUI via CreateProcessAsUser). Inno Setup will restart the service."
  $guiLaunched = $true

} catch {
  Write-Log 'WARN' "CreateProcessAsUser failed: $_ — falling back to silent install"
}

if ($guiLaunched) { Remove-SelfTask; exit 0 }   # ← يخرج فوراً بدون NSSM restore
```

**المشكلة**:
- Path 4b يطلق الـ installer GUI ويخرج فوراً (fire-and-forget) — لا `-Wait` لأن `CreateProcessAsUser` لا يدعمه بسهولة
- `NSSM AppExit 0 = Exit` لا يزال مضبوطاً
- إذا خرج `run-installer.ps1` بـ `exit 0` وـ NSSM AppExit لا يزال `Exit`، لن يُعيد NSSM تشغيل الـ service تلقائياً

**الحل المطلوب**: قبل `exit 0` في path 4b، استعادة NSSM لـ `Restart` حتى يكون بمثابة safety net:
```powershell
if ($guiLaunched) {
  # Restore NSSM to Restart so it acts as a safety net after Inno Setup finishes
  if ((Test-Path $NssmPath) -and (Test-ServiceExists)) {
    Write-Log 'INFO' "NSSM AppExit restored to Restart (path 4b safety net)"
    & $NssmPath set $ServiceName AppExit 0 Restart 2>$null | Out-Null
  }
  Remove-SelfTask
  exit 0
}
```

**لماذا هذا يكفي**: بعد أن يُكمل Inno Setup التثبيت:
- إما أن Inno Setup يشغّل الـ service من `[Run]` section → يعمل مباشرة
- أو إذا فشل ذلك، NSSM AppExit = Restart يضمن إعادة التشغيل عند أي restart للـ service لاحقاً
- على الأقل التطبيق لن يكون "permanently dead" كما هو الحال الآن

---

## Bug B4 — MEDIUM: `-ServerPid` لا يصل لـ `run-installer.ps1`

**الملف**: `scripts/launch-installer.ps1` السطر 75

**الكود الحالي (المكسور)**:
```powershell
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunScript`" -SetupPath `"$SetupPath`" -AppRoot `"$AppRoot`""
#         ↑ -ServerPid مفقود من هنا رغم أن $ServerPid متاح كـ parameter!
```

`launch-installer.ps1` يستقبل `$ServerPid` كـ parameter (السطر 5) ويأخذه من Node (السطر 566 في `updateService.js`):
```js
execFileSync('powershell.exe', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launchScript,
  '-SetupPath',  setupPath,
  '-RunScript',  runScript,
  '-AppRoot',    DATA_ROOT,
  '-ServerPid',  String(process.pid),  // ← بيتبعت لـ launch-installer.ps1 ✓
], ...);
```

لكنه **لا يُمرَّر** لـ `run-installer.ps1` في `$psArgs`. نتيجة: `run-installer.ps1` يستقبل `$ServerPid = 0` دائماً، فيتخطى Step 1 (الانتظار لحين خروج Node).

**الحل — سطر واحد فقط**:
```powershell
# قبل:
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunScript`" -SetupPath `"$SetupPath`" -AppRoot `"$AppRoot`""

# بعد:
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunScript`" -SetupPath `"$SetupPath`" -AppRoot `"$AppRoot`" -ServerPid $ServerPid"
```

**إضافة اختيارية في `run-installer.ps1` السطر 78**: لوضوح الـ log:
```powershell
if ($ServerPid -gt 0) {
  Write-Log 'INFO' "Waiting for Node server PID $ServerPid to exit..."
  # ... existing loop ...
} else {
  Write-Log 'WARN' "ServerPid is 0 — skipping PID wait (falling back to time-based wait)"
}
```

---

## هيكل الملفات المتأثرة

```
server/
└── services/
    └── updateService.js          ← B1: spawnUpdater() → استخدام Task Scheduler

scripts/
├── launch-installer.ps1          ← B4: إضافة -ServerPid في $psArgs (سطر 75)
├── launch-updater.ps1            ← B1: ملف جديد (نسخة من launch-installer.ps1 للـ updater)
└── run-installer.ps1             ← B2 + B3: إضافة NSSM restore بعد paths 4a و 4b
```

---

## Flow الحالي (المكسور) vs Flow المتوقع بعد الإصلاح

### Legacy path (`isInstaller = false`):
```
الحالي:  Node → spawn(updater.ps1, detached) → Node exits → Job Object kills updater.ps1 → لا تحديث
المطلوب: Node → execFileSync(launch-updater.ps1) → Task registered → Node exits → Task fires → updater.ps1 يكمل
```

### Installer path — path 4a (`currentSessionId ≠ 0`):
```
الحالي:  Start-Process -Wait → exit 0 → NSSM AppExit=Exit → service مش بترجع
المطلوب: Start-Process -Wait → restore NSSM → sc start → service ترجع → browser redirects
```

### Installer path — path 4b (Session-0, `CreateProcessAsUser`):
```
الحالي:  CreateProcessAsUser → exit 0 → NSSM AppExit=Exit → service permanently dead
المطلوب: CreateProcessAsUser → restore NSSM AppExit=Restart → exit 0 → NSSM safety net active
```

### `-ServerPid` (B4):
```
الحالي:  launch-installer.ps1 يستقبل PID لكن لا يمرّره → run-installer.ps1 يستقبل 0 → يتخطى wait
المطلوب: launch-installer.ps1 يمرر -ServerPid في $psArgs → run-installer.ps1 ينتظر بـ PID الصحيح
```

---

## المعلومات التقنية الضرورية

**App runs as**: NSSM Windows Service (`LaundryPlusApp`) في Session-0

**Key paths**:
- `ROOT` = مجلد الـ app (داخل pkg snapshot في production)
- `DATA_ROOT` = مجلد الـ exe في production (`isPkg = true`)، أو project root في dev
- `DATA_DIR` = `DATA_ROOT/data/` — الملفات المكتوبة على الـ disk
- `scripts/` في production يجب أن تكون موجودة جنب الـ exe (مش داخل snapshot)

**NSSM AppExit behavior**:
- `AppExit 0 Exit` = لا تعيد تشغيل الـ service لو خرج Node بـ code 0
- `AppExit 0 Restart` = أعد تشغيل الـ service دائماً

**Task Scheduler pattern** (الموجود في `launch-installer.ps1`):
- يُسجَّل بـ `Register-ScheduledTask` كـ one-time task يشتغل بعد 6 ثواني
- يشتغل كـ interactive user (إن وُجد) أو SYSTEM
- بعيد عن Job Object → يبقى حياً بعد خروج Node ✓

**`updater.ps1` parameters** (من السطر 407–418):
```
-ServerPid, -TargetVersion, -FromVersion, -NewExePath, -BackupPath, -AppRoot
```

---

## الخطوة التالية

```
/speckit-plan
```

الـ spec جاهزة في `specs/017-fix-update-completion-bugs/spec.md`. شغّل `/speckit-plan` لإنشاء خطة التنفيذ التفصيلية، ثم `/speckit-tasks` لإنشاء الـ tasks، ثم `/speckit-implement` للتنفيذ.

**الـ Branch**: `claude/auto-update-system-issues-ec8dvs`  
**Repository**: `alaaelmorsy/Laundry`
