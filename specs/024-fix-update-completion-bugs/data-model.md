# Data Model: Fix Auto-Update Completion Bugs

**Date**: 2026-06-20

هذه الـ feature إصلاحات في الـ infrastructure ولا تُضيف entities جديدة للـ database. الـ data model موجود بالفعل.

---

## الكيانات المتأثرة

### Windows Scheduled Task

| الحقل | القيمة (Installer) | القيمة (Updater) |
|-------|-------------------|------------------|
| TaskName | `LaundryPlusInstaller` | `LaundryPlusUpdater` |
| Execute | `powershell.exe` | `powershell.exe` |
| Arguments | `... -File run-installer.ps1 -SetupPath ... -AppRoot ... -ServerPid ...` | `... -File launch-updater.ps1 -UpdaterScript ... -ServerPid ... -TargetVersion ... -FromVersion ... -NewExePath ... -BackupPath ... -AppRoot ...` |
| Trigger | Once, +6s from now | Once, +6s from now |
| Principal | Interactive user أو SYSTEM | Interactive user أو SYSTEM |
| Lifecycle | One-time, self-deletes بعد الاكتمال | One-time, self-deletes بعد الاكتمال |

### NSSM AppExit State Machine

```
[Normal] AppExit 0 = Restart
    │
    │ launch-installer.ps1
    ▼
[Update Mode] AppExit 0 = Exit
    │
    ├─── Path 4a (Interactive) → finally block → Restore + sc start → [Normal]
    ├─── Path 4b (Session-0)   → before exit 0 → Restore            → [Normal]
    └─── Path 4c (Silent)      → section 5     → Restore + sc start → [Normal]
```

**المشكلة الحالية**: Paths 4a و 4b لا يُعيدان لـ [Normal] → الـ service يبقى في [Update Mode] إلى الأبد.

### ملفات على الـ Disk

| الملف | المصدر | الوجهة | الغرض |
|-------|--------|--------|-------|
| `_run-installer.ps1` | `ROOT/scripts/run-installer.ps1` | `DATA_DIR/` | تجاوز pkg snapshot |
| `_launch-installer.ps1` | `ROOT/scripts/launch-installer.ps1` | `DATA_DIR/` | تجاوز pkg snapshot |
| `_updater.ps1` | `ROOT/scripts/updater.ps1` | `DATA_DIR/` | **جديد** — تجاوز pkg snapshot |
| `_launch-updater.ps1` | `ROOT/scripts/launch-updater.ps1` | `DATA_DIR/` | **جديد** — تجاوز pkg snapshot |
