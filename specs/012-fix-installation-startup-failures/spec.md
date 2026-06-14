# Feature Specification: حل جذري لمشكلة عدم تشغيل البرنامج بعد التثبيت

**Feature Branch**: `012-fix-installation-startup-failures`
**Created**: 2026-06-14
**Status**: In Progress

## Problem Statement

بعد تثبيت البرنامج من ملف exe، الـ Windows Service يبقى في حالة `Paused` ولا يوجد أي معلومات لتشخيص السبب الفعلي.

## Root Causes (شامل)

1. **MySQL غير مثبّتة** على جهاز العميل
2. **كلمة سر MySQL مختلفة** عن `Db2@dm1n2022`
3. **MySQL متأخرة البدء** — ✅ تم حلها (retry 90s)
4. **NSSM AppThrottle** يُجمّد الـ service — ✅ تم حلها (0)
5. **لا توجد logs** — السبب الذي يمنعنا من التشخيص الآن
6. **Port 3000 مشغول**
7. **`.env` تالف أو غير محمَّل**

## Functional Requirements

### FR1: NSSM Logging (حرج)
NSSM يجب أن يكتب stdout/stderr إلى `{app}\data\logs\service-stdout.log` و`service-stderr.log`

### FR2: MySQL Pre-check at Install
الـ installer يفحص MySQL قبل التثبيت ويُظهر MsgBox واضح إذا غير موجودة

### FR3: Graceful Service Failure
البرنامج لا يخرج بـ exit code 1 عند فشل MySQL — يبقى Running ويسجّل المحاولات

### FR4: Boot Diagnostics
عند بدء البرنامج يُسجَّل: الإصدار، DATA_ROOT، حالة .env، حالة MySQL

### FR5: Diagnostic Tool
`diagnose.bat` يُنتج تقرير شامل بحالة النظام

## Success Criteria

- **SC1**: المطوّر يعرف سبب الفشل خلال 30 ثانية من قراءة الـ log
- **SC2**: الـ installer يكتشف غياب MySQL قبل التثبيت
- **SC3**: الـ service لا يدخل `Paused` أبداً
- **SC4**: 95% من حالات الفشل تشخّص ذاتياً
