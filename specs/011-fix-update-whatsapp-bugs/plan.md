# Implementation Plan: إصلاح التحديث التلقائي وWhatsApp

**Branch**: `011-fix-update-whatsapp-bugs` | **Date**: 2026-06-14 | **Spec**: [spec.md](spec.md)

## Summary

إصلاح 4 أخطاء حرجة تمنع التحديث التلقائي من العمل على جهاز العميل:
1. `release.yml` → يبني exe بدون رفعه للـ Release
2. `updateService.js` → يبحث عن ZIP بدلاً من exe
3. `updater.ps1` → يحاول تشغيل `node` (غير موجود على العميل) بدلاً من NSSM Service
4. `updater.ps1` → يستخرج ZIP (لا يوجد zip بعد الإصلاح)

وإصلاح بسيط لـ WhatsApp (fallback version كـ named constant).

## Technical Context

**Language/Version**: Node.js 20 (pkg target: node20-win-x64), PowerShell 5.1

**Primary Dependencies**: `pkg` v5.8.1, `@whiskeysockets/baileys`, `nssm.exe`

**Storage**: `data/update-status.json` (محلي), GitHub Releases API (assets)

**Testing**: سيناريوهات يدوية موثقة في [quickstart.md](quickstart.md)

**Target Platform**: Windows 10/11 (جهاز العميل)، `windows-latest` في GitHub Actions

**Project Type**: Desktop App (pkg exe) + CI/CD pipeline

**Constraints**: لا node.js على جهاز العميل — الـ runtime مضمَّن داخل الـ exe

**Scale/Scope**: 3 ملفات تحتاج تعديل: `release.yml`, `updateService.js`, `updater.ps1` + سطر واحد في `whatsappService.js`

## Constitution Check

| المعيار | الحالة | ملاحظة |
|---------|--------|--------|
| 4-Step API Checklist | ✅ لا ينطبق | لا API جديدة |
| Screen-Per-Page Frontend | ✅ لا ينطبق | لا تغيير في الـ frontend |
| MySQL-Only Data Layer | ✅ لا ينطبق | لا تغيير في قاعدة البيانات |
| Bilingual Arabic-First | ✅ لا ينطبق | لا تغيير في الـ UI |
| Monolithic /api/invoke | ✅ لا ينطبق | لا endpoint جديدة |
| Uniform Response Contract | ✅ محفوظ | `performUpdate` يُرجع `{ success, message }` |

**نتيجة Gate**: ✅ لا توجد انتهاكات

## Project Structure

### Documentation (this feature)

```text
specs/011-fix-update-whatsapp-bugs/
├── plan.md          ← هذا الملف
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Code (التعديلات فقط)

```text
.github/workflows/release.yml          ← T1, T2, T3
server/services/updateService.js       ← T4, T5
scripts/updater.ps1                    ← T6, T7, T8
server/services/whatsappService.js     ← T9
```

---

## التعديلات التفصيلية

### T1 — release.yml: بناء exe باسم مُضمَّن بالإصدار

**الملف**: `.github/workflows/release.yml` — خطوة `Build exe`

**من**:
```yaml
npx pkg . --compress GZip --output "release\laundry-app.exe"
echo "exe size: ..."
```

**إلى**:
```powershell
$version = "${{ steps.version.outputs.version }}"
npx pkg . --compress GZip --output "release\laundry-app-v$version.exe"
# نسخة بدون رقم للـ installer (laundry.iss يتوقع laundry-app.exe)
Copy-Item "release\laundry-app-v$version.exe" "release\laundry-app.exe"
echo "exe size: $([Math]::Round((Get-Item 'release\laundry-app.exe').Length / 1MB, 1)) MB"
```

---

### T2 — release.yml: تحديث sha256sums.txt ليشمل hash الـ update exe (وحذف خطوة ZIP)

**الملف**: `.github/workflows/release.yml`

**خطوة `Create source ZIP` (الخطوة 9) — تُحذف كاملاً** — لم تعد مطلوبة.

**خطوة `Generate checksums` (الخطوة 10) — تُعدَّل**:

**من**:
```powershell
$zipName   = "laundry-v$version.zip"
$setupName = "dist\Laundry-PLUS-Setup-v$version.exe"
$zipHash   = (Get-FileHash $zipName   -Algorithm SHA256).Hash.ToLower()
$setupHash = (Get-FileHash $setupName -Algorithm SHA256).Hash.ToLower()
"$zipHash    $zipName"                          | Out-File -FilePath sha256sums.txt -Encoding utf8
"$setupHash  Laundry-PLUS-Setup-v$version.exe" | Add-Content -Path sha256sums.txt -Encoding utf8
```

**إلى**:
```powershell
$updateExe  = "release\laundry-app-v$version.exe"
$setupExe   = "dist\Laundry-PLUS-Setup-v$version.exe"
$updateHash = (Get-FileHash $updateExe -Algorithm SHA256).Hash.ToLower()
$setupHash  = (Get-FileHash $setupExe  -Algorithm SHA256).Hash.ToLower()
"$updateHash  laundry-app-v$version.exe"          | Out-File  -FilePath sha256sums.txt -Encoding utf8
"$setupHash   Laundry-PLUS-Setup-v$version.exe"   | Add-Content -Path sha256sums.txt -Encoding utf8
Get-Content sha256sums.txt
```

---

### T3 — release.yml: رفع الـ update exe للـ Release بدلاً من ZIP

**الملف**: `.github/workflows/release.yml` — خطوة `Create Release`

**من**:
```powershell
gh release create $tag `
  --title "الإصدار $tag" `
  --notes "إصدار $tag — تحديث تلقائي" `
  $zipName `
  sha256sums.txt `
  "dist\Laundry-PLUS-Setup-v$version.exe"
```

**إلى**:
```powershell
$updateExe = "release\laundry-app-v$version.exe"
gh release create $tag `
  --title "الإصدار $tag" `
  --notes "إصدار $tag — تحديث تلقائي" `
  $updateExe `
  sha256sums.txt `
  "dist\Laundry-PLUS-Setup-v$version.exe"
```

---

### T4 — updateService.js: البحث عن exe asset بدلاً من zip

**الملف**: `server/services/updateService.js` — في `checkForUpdate()`

**من**:
```js
const zipAsset  = (release.assets || []).find(a => a.name.endsWith('.zip'));
// ...
downloadUrl: zipAsset ? zipAsset.browser_download_url : null,
assetSize:   zipAsset ? (zipAsset.size || null) : null,
```

**إلى**:
```js
const exeAsset  = (release.assets || []).find(
  a => a.name.startsWith('laundry-app-v') && a.name.endsWith('.exe')
);
// ...
downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
assetSize:   exeAsset ? (exeAsset.size || null) : null,
```

---

### T5 — updateService.js: تعديل performUpdate لتحميل exe

**الملف**: `server/services/updateService.js` — في `performUpdate()`

**تغيير اسم الملف المؤقت**:
```js
// من:
const zipName = `laundry-v${targetVersion}.zip`;
const zipPath = path.join(DATA_DIR, zipName);
// إلى:
const exeName = `laundry-app-v${targetVersion}.exe`;
const exePath = path.join(DATA_DIR, exeName);
```

**تغيير معامل الـ updater**:
```js
// من:
'-ZipPath', zipPath,
// إلى:
'-NewExePath', exePath,
```

**تغيير cleanup عند الفشل**:
```js
// من:
const zipPath = path.join(DATA_DIR, `laundry-v${targetVersion}.zip`);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
// إلى:
const exePath = path.join(DATA_DIR, `laundry-app-v${targetVersion}.exe`);
if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
```

---

### T6 — updater.ps1: تغيير المعاملات وتعريف المتغيرات

**الملف**: `scripts/updater.ps1` — أعلى الملف

**من**:
```powershell
param(
  [Parameter(Mandatory=$true)][int]$ServerPid,
  [Parameter(Mandatory=$true)][string]$TargetVersion,
  [Parameter(Mandatory=$true)][string]$ZipPath,
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [Parameter(Mandatory=$true)][string]$AppRoot
)
$StatusFile  = Join-Path $AppRoot "data\update-status.json"
$LogFile     = Join-Path $AppRoot "data\update-log.txt"
$MigrateJs   = Join-Path $AppRoot "migrate.js"
$ServerJs    = Join-Path $AppRoot "server\index.js"
$PRESERVE = @('data', '.env', 'ssl', 'backup', 'node_modules', ...)
```

**إلى**:
```powershell
param(
  [Parameter(Mandatory=$true)][int]$ServerPid,
  [Parameter(Mandatory=$true)][string]$TargetVersion,
  [Parameter(Mandatory=$true)][string]$NewExePath,
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [Parameter(Mandatory=$true)][string]$AppRoot
)
$StatusFile  = Join-Path $AppRoot "data\update-status.json"
$LogFile     = Join-Path $AppRoot "data\update-log.txt"
$ExeFile     = Join-Path $AppRoot 'laundry-app.exe'
$NssmPath    = Join-Path $AppRoot 'nssm.exe'
$ServiceName = 'LaundryPlusApp'
```

---

### T7 — updater.ps1: تغيير Start-AppServer → Start-AppService

**من**:
```powershell
function Start-AppServer {
  Write-Log 'INFO' 'Starting app server...'
  Start-Sleep -Seconds 3
  $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $nodeExe) { $nodeExe = 'node' }
  Start-Process -FilePath $nodeExe -ArgumentList "`"$ServerJs`"" -WorkingDirectory $AppRoot -WindowStyle Normal
}
```

**إلى**:
```powershell
function Start-AppService {
  Write-Log 'INFO' "Starting Windows Service $ServiceName..."
  if (Test-Path $NssmPath) {
    & $NssmPath start $ServiceName 2>$null
  } else {
    & sc.exe start $ServiceName 2>$null
  }
}
```

---

### T8 — updater.ps1: استبدال منطق ZIP بمنطق استبدال exe

**الملف**: `scripts/updater.ps1` — Step 2 و Step 3

**من** (Step 2 + 3 كاملاً):
```powershell
# ── Step 2: Extract ZIP ──
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
foreach ($entry in $zip.Entries) { ... استخراج الملفات ... }
$zip.Dispose()
try { Remove-Item -Path $ZipPath -Force -ErrorAction SilentlyContinue } catch {}

# ── Step 3: Run DB migration ──
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
$proc = Start-Process -FilePath $nodeExe -ArgumentList "`"$MigrateJs`"" -Wait -PassThru ...
```

**إلى**:
```powershell
# ── Step 2: Replace exe ──────────────────────────────────────────────────────
Write-Log 'INFO' "Replacing exe: $ExeFile"
$oldExeBackup = Join-Path $BackupPath 'laundry-app.exe.bak'
try {
  Copy-Item -Path $ExeFile    -Destination $oldExeBackup -Force -ErrorAction Stop
  Copy-Item -Path $NewExePath -Destination $ExeFile      -Force -ErrorAction Stop
  Write-Log 'INFO' 'Exe replaced successfully'
} catch {
  Write-Log 'ERROR' "Exe replacement failed: $_"
  if (Test-Path $oldExeBackup) {
    try {
      Copy-Item -Path $oldExeBackup -Destination $ExeFile -Force
      Write-Log 'INFO' 'Old exe restored from backup'
    } catch { Write-Log 'ERROR' "Restore failed: $_" }
  }
  Set-UpdateResult 'rollback' $fromVersion $TargetVersion
  Start-AppService
  exit 1
}
# حذف الـ exe المؤقت
try { Remove-Item -Path $NewExePath -Force -ErrorAction SilentlyContinue } catch {}
# NOTE: لا حاجة لتشغيل migrate.js — db.initialize() يعمل تلقائياً عند بدء الـ exe الجديد
```

**وتحديث جميع استدعاءات `Start-AppServer` → `Start-AppService`** (السطور 118، 168، 178 في الملف الحالي).

---

### T9 — whatsappService.js: named constant للـ fallback version

**الملف**: `server/services/whatsappService.js` — بعد `require`s

**إضافة ثابت**:
```js
const BAILEYS_FALLBACK_VERSION = [2, 3000, 1035194821];
```

**تحديث الاستخدام**:
```js
// من:
version = [2, 3000, 1035194821]; // fallback when network unavailable (pkg env)
// إلى:
version = BAILEYS_FALLBACK_VERSION;
```

---

## ترتيب التنفيذ

```
T9  → whatsappService.js (سطران، مستقل)
T4  → updateService.js: تغيير البحث عن asset
T5  → updateService.js: تغيير performUpdate
T6  → updater.ps1: تغيير params وتعريف المتغيرات
T7  → updater.ps1: Start-AppService
T8  → updater.ps1: استبدال ZIP بـ exe
T1  → release.yml: Build exe
T2  → release.yml: checksums + حذف خطوة ZIP
T3  → release.yml: Create Release
```

---

## التحقق بعد التنفيذ

```powershell
# لا يوجد node أو ZipPath أو zipName في updater.ps1
Select-String -Path scripts\updater.ps1 -Pattern '\bnode\b|ZipPath|zipName|Start-AppServer'

# updateService.js لا يبحث عن .zip كـ asset
Select-String -Path server\services\updateService.js -Pattern "\.find.*\.zip"

# release.yml يرفع laundry-app-v في Create Release
Select-String -Path .github\workflows\release.yml -Pattern 'laundry-app-v'
```
