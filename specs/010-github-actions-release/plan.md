# Implementation Plan: GitHub Actions Automated Release & Auto-Update

**Branch**: `010-github-actions-release` | **Date**: 2026-06-14 | **Spec**: [spec.md](spec.md)

## Summary

إنشاء GitHub Actions workflow يبني تلقائياً ملف `Laundry-PLUS-v{version}.exe` ويرفع Release جديداً على GitHub عند كل push على `main` بإصدار جديد. الـ Release يحتوي على exe + ZIP مصدر للتحديث التلقائي + sha256sums.txt. نظام التحديث الداخلي الموجود (`updateService.js`) سيلتقط الـ Release تلقائياً بدون أي تعديل على كوده.

## Technical Context

**Language/Version**: Node.js 18 (pkg target) + PowerShell (workflow scripts)

**Primary Dependencies**: `pkg` v5.8.1 (موجود في devDependencies), `gh` CLI (متوفر في GitHub Actions)

**Storage**: GitHub Releases API (assets), `data/update-status.json` (محلي)

**Testing**: سيناريوهات يدوية موثقة في [quickstart.md](quickstart.md)

**Target Platform**: `windows-latest` في GitHub Actions (لبناء exe Windows)

**Project Type**: CI/CD pipeline + Desktop App distribution

**Performance Goals**: وقت البناء الكامل أقل من 15 دقيقة

**Constraints**: حجم assets في GitHub Releases يصل لـ 2 GB — الـ exe الحالي أقل بكثير

**Scale/Scope**: release لكل إصدار، deployment يدوي بتغيير رقم في `package.json`

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| المعيار | الحالة | ملاحظة |
|---------|--------|--------|
| 4-Step API Checklist | لا ينطبق | workflow خارج الـ app، لا يضيف API جديدة |
| Screen-Per-Page Frontend | لا ينطبق | لا يوجد تغيير في الـ frontend |
| MySQL-Only Data Layer | لا ينطبق | لا تغيير في البيانات |
| Bilingual Arabic-First | لا ينطبق | عناوين الـ Release عربي في الـ workflow |
| Monolithic /api/invoke | لا ينطبق | لا endpoint جديدة |
| updateService.js | لا تعديل | النظام يعمل بدون تعديل |

**نتيجة Gate**: لا توجد انتهاكات

## Project Structure

### Documentation (this feature)

```text
specs/010-github-actions-release/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md   (ينشئه /speckit-tasks)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── release.yml    (الملف الوحيد المطلوب تعديله)
```

**Structure Decision**: ملف واحد فقط. لا تغيير في باقي هيكل المشروع.

## التعديلات المطلوبة على release.yml

الـ workflow موجود بالفعل لكن يحتاج 3 تعديلات لتصحيح اسم الـ exe:

### تعديل 1 — خطوة Build exe

```yaml
# من:
run: npx pkg . --compress GZip --output dist\laundry-app.exe

# إلى:
run: |
  $version = "${{ steps.version.outputs.version }}"
  npx pkg . --compress GZip --output "dist\Laundry-PLUS-v$version.exe"
```

### تعديل 2 — خطوة Generate checksums

```yaml
# تحديث متغير exeName واسم السطر في الملف:
$exeName = "dist\Laundry-PLUS-v$version.exe"
$exeHash = (Get-FileHash $exeName -Algorithm SHA256).Hash.ToLower()
"$exeHash  Laundry-PLUS-v$version.exe" | Add-Content -Path sha256sums.txt -Encoding utf8
```

### تعديل 3 — خطوة Create Release

```yaml
# من:
"dist\laundry-app.exe"

# إلى:
"dist\Laundry-PLUS-v$version.exe"
```

## Implementation Tasks Summary

1. تعديل `.github/workflows/release.yml` بالتغييرات الثلاثة أعلاه
2. push تجريبي برقم إصدار جديد
3. التحقق من ظهور الـ Release على GitHub بالاسم الصحيح
4. التحقق من اكتشاف التحديث في البرنامج

## Complexity Tracking

لا توجد انتهاكات للـ constitution.
