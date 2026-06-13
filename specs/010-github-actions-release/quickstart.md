# Quickstart: التحقق من عمل الـ Release Pipeline

**Date**: 2026-06-14

## المتطلبات

- الـ repo مرفوع على GitHub: `https://github.com/alaaelmorsy/Laundry`
- Workflow permissions مضبوطة على "Read and write" في Settings → Actions → General
- ملف `.github/workflows/release.yml` موجود في الـ repo

## سيناريو 1: التحقق من البناء والـ Release

### الخطوات

```powershell
# 1. غيّر رقم الإصدار في package.json
# من: "version": "1.0.12"
# إلى: "version": "1.0.13"

# 2. ارفع على GitHub
git add package.json
git commit -m "v1.0.13"
git push
```

### النتيجة المتوقعة

- بعد 5-10 دقائق: يظهر على `https://github.com/alaaelmorsy/Laundry/actions` workflow ناجح
- يظهر Release جديد على `https://github.com/alaaelmorsy/Laundry/releases` بعنوان `الإصدار v1.0.13`
- الـ Release يحتوي على:
  - `Laundry-PLUS-v1.0.13.exe`
  - `laundry-v1.0.13.zip`
  - `sha256sums.txt`

## سيناريو 2: التحقق من اكتشاف التحديث تلقائياً

### الخطوات

1. افتح البرنامج على جهاز يشغّل الإصدار `1.0.12`
2. انتظر حتى ساعة، أو اضغط "التحقق من التحديثات" يدوياً

### النتيجة المتوقعة

- يظهر إشعار: "يوجد إصدار جديد 1.0.13"
- ملف `data/update-status.json` يحتوي على `"hasUpdate": true` و `"latestVersion": "1.0.13"`

## سيناريو 3: التحقق من منع الـ Release المكرر

### الخطوات

```powershell
# ارفع تغيير بدون رفع رقم الإصدار
git add .
git commit -m "fix typo"
git push
```

### النتيجة المتوقعة

- الـ workflow يشتغل لكن يتوقف بعد خطوة "Check existing release"
- رسالة: `Release v1.0.13 already exists — skipping.`
- لا يُنشأ release مكرر
