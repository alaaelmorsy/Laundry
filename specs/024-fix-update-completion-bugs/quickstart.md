# Quickstart Validation Guide: Fix Auto-Update Completion Bugs

**Date**: 2026-06-20

---

## Prerequisites

- Windows 10/11 مع NSSM service `LaundryPlusApp` مثبّت وشغّال
- صلاحيات Admin
- `nssm.exe` موجود في مجلد الـ app
- ملفات `scripts/` موجودة جنب الـ exe

---

## Validation Scenarios

### Scenario 1: B4 — `-ServerPid` يصل لـ `run-installer.ps1`

**الخطوات**:
1. شغّل تحديثاً عبر الـ app (أو simulate installUpdate)
2. راقب `data/update-log.txt`

**النتيجة المتوقعة**:
```
[INFO] Waiting for Node server PID 12345 to exit...
[INFO] Node server exited after 1.5s
```

**النتيجة المكسورة (قبل الإصلاح)**:
```
[INFO] run-installer started: SetupPath=... ServerPid=0
# لا يظهر سطر الانتظار
```

---

### Scenario 2: B2 — Path 4a يستعيد NSSM ويشغّل الـ service

**الخطوات**:
1. شغّل التطبيق في interactive mode (مش كـ service)
2. شغّل `run-installer.ps1` مباشرةً مع `-SetupPath` صحيح
3. أكمل الـ installer
4. تحقق من حالة NSSM

**النتيجة المتوقعة في اللوج**:
```
[INFO] Interactive session — launching installer GUI directly
[INFO] Installer GUI completed
[INFO] Restoring NSSM AppExit 0 to Restart (path 4a)...
[INFO] Starting service LaundryPlusApp (path 4a)...
```

**التحقق من NSSM**:
```powershell
& nssm.exe get LaundryPlusApp AppExit
# Expected: 0 Restart
```

---

### Scenario 3: B3 — Path 4b يستعيد NSSM قبل الخروج

**الخطوات**:
1. شغّل التطبيق كـ Windows Service (Session 0)
2. شغّل تحديثاً — سيمر بـ path 4b (CreateProcessAsUser)
3. راقب اللوج وـ NSSM

**النتيجة المتوقعة في اللوج**:
```
[INFO] Installer GUI launched in session 1 PID=5678
[INFO] Restoring NSSM AppExit 0 to Restart (path 4b safety net)...
```

**التحقق من NSSM**:
```powershell
& nssm.exe get LaundryPlusApp AppExit
# Expected: 0 Restart
```

---

### Scenario 4: B1 — Legacy updater يكتمل بعد خروج Node

**الخطوات**:
1. اضبط `cached.isInstaller = false` في update status (أو simulate)
2. شغّل `installUpdate()`
3. راقب Task Scheduler: `Get-ScheduledTask -TaskName 'LaundryPlusUpdater'`
4. انتظر خروج Node، ثم راقب `data/update-log.txt`

**النتيجة المتوقعة**:
```
[INFO] Scheduled task 'LaundryPlusUpdater' registered — fires in ~6s
# بعد 6 ثواني (بعد خروج Node):
[INFO] updater: waiting for Node PID 12345 to exit...
[INFO] Renaming old exe...
[INFO] Update complete
```

**النتيجة المكسورة (قبل الإصلاح)**:
```
# لا شيء — updater.ps1 يُقتل فوراً بعد خروج Node
```

---

## Quick NSSM Verification Commands

```powershell
# تحقق من AppExit setting
nssm.exe get LaundryPlusApp AppExit

# تحقق من حالة الـ service
sc.exe query LaundryPlusApp

# راقب اللوج في real-time
Get-Content "C:\path\to\app\data\update-log.txt" -Wait -Tail 50
```
