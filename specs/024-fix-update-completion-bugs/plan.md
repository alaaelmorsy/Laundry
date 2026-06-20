# Implementation Plan: Fix Auto-Update Completion Bugs

**Branch**: `024-fix-update-completion-bugs` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/024-fix-update-completion-bugs/spec.md`

---

## Summary

إصلاح 4 أخطاء تمنع اكتمال نظام التحديث التلقائي في PLUS Laundry POS:
- **B1**: `spawnUpdater()` يشغّل `updater.ps1` كـ child process داخل NSSM Job Object → يُقتل عند خروج Node
- **B2**: Path 4a في `run-installer.ps1` يخرج بدون استعادة NSSM أو تشغيل الـ service
- **B3**: Path 4b يخرج فوراً بدون استعادة NSSM كـ safety net
- **B4**: `-ServerPid` لا يُمرَّر من `launch-installer.ps1` إلى `run-installer.ps1`

الحل يعتمد على نفس نمط `spawnInstaller()` الموجود — استخدام Task Scheduler لـ `updater.ps1` أيضاً.

---

## Technical Context

**Language/Version**: Node.js (pkg-bundled exe) + PowerShell 5.1

**Primary Dependencies**:
- `server/services/updateService.js` — منطق التحديث الرئيسي
- `scripts/launch-installer.ps1` — تسجيل Scheduled Task للـ installer
- `scripts/run-installer.ps1` — تشغيل Inno Setup بمساراته المختلفة
- `scripts/updater.ps1` — استبدال الـ exe بـ rename pattern

**Storage**: ملفات على الـ disk في `DATA_DIR` (جنب الـ exe)

**Testing**: تشغيل يدوي على Windows مع NSSM service

**Target Platform**: Windows 10/11 مع NSSM Windows Service

**Project Type**: Desktop app (pkg-bundled Node.js)

**Constraints**:
- PowerShell لا يقرأ الملفات داخل pkg snapshot → يجب النسخ لـ DATA_DIR قبل التنفيذ
- NSSM Job Object يقتل كل child processes عند خروج الـ service
- Task Scheduler يملك الـ process خارج Job Object → يبقى حياً بعد خروج Node

---

## Constitution Check

هذه الـ feature إصلاحات في طبقة الـ infrastructure (scripts + updateService) وليست features جديدة في الـ UI.

- ✅ لا API جديدة → لا يتطلب 4-Step API Checklist
- ✅ لا تغيير في الـ database schema
- ✅ لا إضافة dependencies جديدة
- ✅ لا تغيير في الـ frontend (HTML/JS/CSS)
- ✅ التغييرات محدودة النطاق: 2 ملفات موجودة + ملف PS جديد واحد

---

## Project Structure

### Documentation (this feature)

```text
specs/024-fix-update-completion-bugs/
├── plan.md              ← هذا الملف
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
server/
└── services/
    └── updateService.js          ← B1: spawnUpdater() — استبدال spawn بـ execFileSync(launch-updater.ps1)

scripts/
├── launch-installer.ps1          ← B4: إضافة -ServerPid في $psArgs (سطر 75)
├── launch-updater.ps1            ← B1: ملف جديد — مكيَّف من launch-installer.ps1
└── run-installer.ps1             ← B2 + B3: إضافة NSSM restore في paths 4a و 4b
```

---

## Phase 0: Research

انظر [research.md](research.md)

---

## Phase 1: Design

### B1 — `launch-updater.ps1` (ملف جديد)

يشبه `launch-installer.ps1` لكن:
- يشغّل `updater.ps1` بدلاً من `run-installer.ps1`
- اسم الـ Task: `LaundryPlusUpdater`
- يستقبل معاملات `updater.ps1` الكاملة ويمرّرها في `$psArgs`:
  `-ServerPid`, `-TargetVersion`, `-FromVersion`, `-NewExePath`, `-BackupPath`, `-AppRoot`
- **لا** يضبط `NSSM AppExit 0 Exit` (الـ updater يعمل بعد خروج Node، وNSSM سيعيد التشغيل بعد الـ rename تلقائياً)
- في حالة فشل التسجيل: يخرج بـ exit 1 (لا تعديل NSSM لأنه لم يُغيَّر)

### B1 — تعديل `spawnUpdater()` في `updateService.js`

**قبل** (مكسور — spawn داخل Job Object):
```js
function spawnUpdater({ targetVersion, fromVersion, newExePath, backupPath }) {
  const updaterScript = path.join(DATA_ROOT, 'scripts', 'updater.ps1');
  const child = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', updaterScript,
    '-ServerPid', String(process.pid), ...
  ], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}
```

**بعد** (صحيح — Task Scheduler خارج Job Object):
```js
function spawnUpdater({ targetVersion, fromVersion, newExePath, backupPath }) {
  const srcUpdater = path.join(ROOT, 'scripts', 'updater.ps1');
  const srcLaunch  = path.join(ROOT, 'scripts', 'launch-updater.ps1');
  if (!fs.existsSync(srcUpdater)) throw new Error(`updater.ps1 غير موجود: ${srcUpdater}`);
  if (!fs.existsSync(srcLaunch))  throw new Error(`launch-updater.ps1 غير موجود: ${srcLaunch}`);

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const updaterScript = path.join(DATA_DIR, '_updater.ps1');
  const launchScript  = path.join(DATA_DIR, '_launch-updater.ps1');
  fs.copyFileSync(srcUpdater, updaterScript);
  fs.copyFileSync(srcLaunch,  launchScript);

  execFileSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launchScript,
    '-UpdaterScript', updaterScript,
    '-ServerPid',     String(process.pid),
    '-TargetVersion', targetVersion,
    '-FromVersion',   fromVersion,
    '-NewExePath',    newExePath,
    '-BackupPath',    backupPath,
    '-AppRoot',       DATA_ROOT,
  ], { stdio: 'ignore', windowsHide: true, timeout: 30000 });
}
```

**تحقق**: `execFileSync` موجودة بالفعل في `updateService.js` — لا حاجة لـ require جديد.

### B4 — تعديل `launch-installer.ps1` السطر 75

**قبل**:
```powershell
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunScript`" -SetupPath `"$SetupPath`" -AppRoot `"$AppRoot`""
```

**بعد**:
```powershell
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunScript`" -SetupPath `"$SetupPath`" -AppRoot `"$AppRoot`" -ServerPid $ServerPid"
```

### B2 — تعديل `run-installer.ps1` Path 4a (السطر 127–138)

**قبل**:
```powershell
if ($currentSessionId -ne 0) {
  Write-Log 'INFO' "Interactive session — launching installer GUI directly"
  try {
    Start-Process -FilePath $SetupPath -Wait -ErrorAction Stop
    Write-Log 'INFO' "Installer GUI completed"
    Write-Log 'INFO' "run-installer: done (direct GUI). Inno Setup restarted the service."
    Remove-SelfTask
    exit 0
  } catch {
    Write-Log 'WARN' "Direct launch failed: $_ — trying API approach"
  }
}
```

**بعد** (finally block يضمن restore في جميع الحالات):
```powershell
if ($currentSessionId -ne 0) {
  Write-Log 'INFO' "Interactive session — launching installer GUI directly"
  try {
    Start-Process -FilePath $SetupPath -Wait -ErrorAction Stop
    Write-Log 'INFO' "Installer GUI completed"
  } catch {
    Write-Log 'WARN' "Direct launch failed: $_"
  } finally {
    if ((Test-Path $NssmPath) -and (Test-ServiceExists)) {
      Write-Log 'INFO' "Restoring NSSM AppExit 0 to Restart (path 4a)..."
      & $NssmPath set $ServiceName AppExit 0 Restart 2>$null | Out-Null
      Write-Log 'INFO' "Starting service $ServiceName (path 4a)..."
      & $NssmPath start $ServiceName 2>$null | Out-Null
      & sc.exe start $ServiceName 2>$null | Out-Null
    }
    Remove-SelfTask
    exit 0
  }
}
```

**ملاحظة مهمة**: `exit 0` في `finally` block يوقف الـ script هنا ولا يكمل لـ path 4b — هذا هو السلوك المطلوب. الكاتش لا يصل لـ path 4b بعد الآن لأن الـ finally يخرج.

### B3 — تعديل `run-installer.ps1` Path 4b (السطر 246)

**قبل**:
```powershell
if ($guiLaunched) { Remove-SelfTask; exit 0 }
```

**بعد**:
```powershell
if ($guiLaunched) {
  if ((Test-Path $NssmPath) -and (Test-ServiceExists)) {
    Write-Log 'INFO' "Restoring NSSM AppExit 0 to Restart (path 4b safety net)..."
    & $NssmPath set $ServiceName AppExit 0 Restart 2>$null | Out-Null
  }
  Remove-SelfTask
  exit 0
}
```

---

## Implementation Order

| # | Bug | الملف | نوع التغيير |
|---|-----|-------|-------------|
| 1 | B4 | `scripts/launch-installer.ps1` سطر 75 | سطر واحد فقط |
| 2 | B2 | `scripts/run-installer.ps1` path 4a | استبدال try/catch بـ try/catch/finally |
| 3 | B3 | `scripts/run-installer.ps1` path 4b | إضافة 4 أسطر قبل exit |
| 4 | B1a | `scripts/launch-updater.ps1` | ملف جديد (~100 سطر) |
| 5 | B1b | `server/services/updateService.js` | استبدال spawn بـ execFileSync |
