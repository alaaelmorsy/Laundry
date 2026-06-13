# Quickstart Validation Guide: Full Self-Contained Installer Bundle

**Feature**: `007-full-installer-bundle`
**Date**: 2026-06-13

---

## Prerequisites

- Windows 10/11 (64-bit)
- MySQL مثبَّت وقاعدة البيانات جاهزة (أو فارغة — البرنامج يُنشئها)
- `npm run build` مكتمل → `release\laundry-app.exe` موجود
- `npm run build:installer` مكتمل → `dist\PLUS-Laundry-Setup.exe` موجود

---

## Scenario 1: تثبيت نظيف على جهاز بدون Node.js

**الهدف**: التحقق من أن البرنامج يشتغل بعد التثبيت مباشرة.

1. شغّل `dist\PLUS-Laundry-Setup.exe` كـ Administrator
2. اختر مجلد التثبيت (أو اتركه افتراضياً)
3. اضغط Next حتى يكتمل التثبيت
4. **التحقق**: المتصفح يفتح على `https://localhost:3443` 🔒 Secure
5. **التحقق**: صفحة تسجيل الدخول تظهر بدون أخطاء

**Expected**: ✅ اكتمال التثبيت في أقل من 90 ثانية + صفحة login

---

## Scenario 2: جهاز كان عليه Node.js ثم حُذف

**الهدف**: التحقق من حل مشكلة متغيرات Node.js المتبقية.

**الإعداد** (محاكاة المشكلة):
```powershell
# أضف متغيرات Node.js مصطنعة كما تفعلها عملية تثبيت Node.js
[System.Environment]::SetEnvironmentVariable("OPENSSL_CONF", "C:\fake\openssl.cnf", "Machine")
[System.Environment]::SetEnvironmentVariable("NODE_PATH", "C:\fake\node_modules", "Machine")
[System.Environment]::SetEnvironmentVariable("NODE_OPTIONS", "--max-old-space-size=512", "Machine")
```

**التثبيت**:
1. شغّل `PLUS-Laundry-Setup.exe`
2. اكتمل التثبيت

**التحقق بعد التثبيت**:
```powershell
# يجب أن تعود null لجميع هذه المتغيرات
[System.Environment]::GetEnvironmentVariable("OPENSSL_CONF", "Machine")
[System.Environment]::GetEnvironmentVariable("NODE_PATH", "Machine")
[System.Environment]::GetEnvironmentVariable("NODE_OPTIONS", "Machine")
```

**Expected**: ✅ القيم كلها `null` + البرنامج يعمل بدون أخطاء OPENSSL

---

## Scenario 3: مجلد تثبيت مخصص

**الهدف**: التحقق من أن جميع الملفات في المجلد المختار.

1. أثناء التثبيت، اختر `D:\MyLaundry` كمجلد
2. بعد التثبيت، تحقق:

```powershell
Get-ChildItem "D:\MyLaundry" -Recurse | Select-Object FullName
# يجب أن تجد: laundry-app.exe, launcher.vbs, mkcert.exe, .env, data/, ssl/, scripts/
```

**Expected**: ✅ جميع الملفات في `D:\MyLaundry` — لا شيء في `C:\Program Files` أو أي مجلد آخر

---

## Scenario 4: إعادة التشغيل التلقائي

**الهدف**: التحقق من Task Scheduler.

1. أعد تشغيل الجهاز بعد التثبيت
2. انتظر 30 ثانية
3. افتح `https://localhost:3443`

**Expected**: ✅ البرنامج يشتغل تلقائياً، المتصفح يعرض صفحة login

```powershell
# تحقق إضافي
Get-ScheduledTask -TaskName "LaundryPOS" | Select-Object State
# يجب أن يكون: Running
```

---

## Scenario 5: تحديث (إعادة التثبيت)

**الهدف**: التحقق من الحفاظ على البيانات.

**الإعداد**:
1. ثبّت نسخة قديمة
2. أضف ملف اختبار في `{app}\data\test-file.txt`
3. شغّل نسخة جديدة من الـ installer على نفس المجلد

**التحقق**:
```powershell
Test-Path "{app}\data\test-file.txt"  # يجب: True
(Get-Item "{app}\laundry-app.exe").LastWriteTime  # يجب: تاريخ الإصدار الجديد
```

**Expected**: ✅ `test-file.txt` موجود + `laundry-app.exe` محدَّث

---

## Build Commands Reference

```powershell
# بناء البرنامج
npm run build

# بناء الـ installer
npm run build:installer

# الاثنان معاً من الصفر
npm run build; npm run build:installer
```

**ملف الناتج**: `dist\PLUS-Laundry-Setup.exe`

---

## Troubleshooting

| المشكلة | السبب المحتمل | الحل |
|---------|--------------|------|
| المتصفح لا يفتح | البرنامج لم يبدأ بعد | انتظر 20 ثانية ثم افتح `https://localhost:3443` يدوياً |
| `NET::ERR_CERT_AUTHORITY_INVALID` | mkcert CA لم يُثبَّت | شغّل الـ installer من جديد كـ Admin |
| البرنامج لا يبدأ مع Windows | Task Scheduler لم يُسجَّل | شغّل `{app}\scripts\register-task.ps1` كـ Admin |
| خطأ "Access Denied" أثناء التثبيت | البرنامج يعمل أثناء التحديث | أوقف البرنامج ثم أعد التثبيت |
