# Research: GitHub Actions Automated Release

**Date**: 2026-06-14

## قرار 1: اسم الـ exe

**Decision**: `Laundry-PLUS-v{version}.exe`
**Rationale**: المستخدم طلب هذا الاسم صراحةً. يتم تمريره لـ `pkg` عبر `--output dist\Laundry-PLUS-v$version.exe`.
**Alternatives considered**: `laundry-app.exe` (الحالي) — مرفوض لعدم احتواء اسم المنتج والإصدار.

## قرار 2: اسم الـ ZIP للتحديث التلقائي

**Decision**: `laundry-v{version}.zip`
**Rationale**: `updateService.js` السطر 195 يبحث عن: `a.name.endsWith('.zip')` — لا يشترط اسماً محدداً.
الاسم الحالي متوافق تماماً مع النظام الموجود.
**Alternatives considered**: تغيير اسمه لـ `Laundry-PLUS-v{version}.zip` — ممكن لكن غير ضروري.

## قرار 3: هل يحتاج الـ ZIP للـ `scripts/` مجلد؟

**Decision**: نعم، يجب أن يشمل `scripts/updater.ps1`
**Rationale**: `performUpdate` في `updateService.js` السطر 412 يبحث عن `scripts/updater.ps1` داخل الـ `APP_ROOT`. الـ ZIP هو مصدر التحديث فيجب أن يحتوي على هذا الملف.
**الوضع الحالي**: مجلد `scripts/` موجود في الـ repo ويُضم في الـ ZIP (لأنه غير مدرج في قائمة الاستثناءات).

## قرار 4: `pkg` target

**Decision**: `node18-win-x64`
**Rationale**: مضبوط بالفعل في `package.json` تحت `pkg.targets`. يعمل على `windows-latest` في GitHub Actions.

## قرار 5: منع التكرار في الـ Release

**Decision**: فحص وجود الـ Release بـ `gh release view {tag}` قبل البناء
**Rationale**: يمنع البناء الكامل (وقت + موارد) إذا كان الإصدار موجوداً بالفعل.

## قرار 6: متى يُنشَأ الـ Release؟

**Decision**: كل push على `main` يُشغّل الـ workflow، لكن الـ Release يُنشَأ فقط إذا تغيّر الإصدار.
**Rationale**: المطور لا يحتاج لإنشاء tag يدوياً — رقم الإصدار في `package.json` هو المُشغّل الحقيقي.
