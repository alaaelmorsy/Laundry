# Research: إصلاح التحديث التلقائي وWhatsApp

**Date**: 2026-06-14

---

## Q1: كيف يجب أن يعمل التحديث التلقائي عندما يكون البرنامج مجمَّعاً كـ pkg exe؟

**Decision**: التحديث يحمّل الـ exe الجديد ويستبدل `laundry-app.exe`، ثم يعيد تشغيل الـ Windows Service.

**Rationale**:
- في pkg mode، لا يوجد Node.js على جهاز العميل — لا يمكن استخراج JS files وتشغيلها
- الـ Service المُنشأ بـ NSSM يشغّل مباشرةً `laundry-app.exe`
- استبدال الـ exe هو الأسلوب الصحيح الوحيد للتحديث
- الـ migrations تعمل تلقائياً عند تشغيل الـ exe الجديد عبر `db.initialize()`

**Alternatives considered**:
- استخراج ZIP مع JS files: يفشل — لا node لتشغيلها
- تحميل installer جديد وتشغيله: يُعقّد العملية، يحتاج UAC prompt

---

## Q2: ما الـ asset اسمه في الـ Release لأغراض التحديث التلقائي؟

**Decision**: `laundry-app-v{version}.exe` — اسم مُضمَّن بالإصدار لتسهيل التمييز.

**Rationale**:
- `laundry-app.exe` (بدون إصدار) يُسبّب تعارض مع اسم الملف المُثبَّت في `{app}`
- اسم `laundry-app-v{version}.exe` يتطابق مع نمط `laundry-v{version}.zip` الموجود
- `updateService.js` يبحث عن asset باستخدام: `a.name.startsWith('laundry-app-v') && a.name.endsWith('.exe')`

---

## Q3: كيف يُعيد updater.ps1 تشغيل البرنامج؟

**Decision**: `nssm.exe start LaundryPlusApp` — مع fallback لـ `sc.exe start LaundryPlusApp`.

**Rationale**:
- الـ Service مُسجَّل بالاسم `LaundryPlusApp` في `laundry.iss`
- `nssm.exe` موجود في `{app}\nssm.exe` (مُثبَّت بالـ installer)
- `sc.exe` موجود في كل Windows كـ fallback
- السطر الحالي `node server\index.js` يفشل — لا node على جهاز العميل

**مسار nssm.exe**: `Join-Path $AppRoot 'nssm.exe'` — حيث `$AppRoot` = مجلد التثبيت.

---

## Q4: هل الـ DB migration يحتاج خطوة منفصلة في updater.ps1؟

**Decision**: لا — الـ migration يعمل تلقائياً عند تشغيل الـ exe الجديد.

**Rationale**:
- `server/index.js` يستدعي `db.initialize()` عند البدء
- `db.initialize()` يُشغّل جميع الـ migrations بنمط `try { ALTER } catch (_) {}`
- لا يوجد node.js مستقل على الجهاز لتشغيل `migrate.js` بشكل منفصل

---

## Q5: ما استراتيجية الـ rollback للـ exe؟

**Decision**: نسخ احتياطي من `laundry-app.exe` القديم قبل الاستبدال، استعادته عند الفشل.

**Rationale**:
- `createBackup()` في updateService.js ينسخ الملفات المصدرية — لكنها JS files داخل الـ exe bundle
- يجب إضافة نسخ احتياطي خاص بـ `laundry-app.exe` نفسه في `updater.ps1`
- الـ rollback: `Copy-Item $oldExeBackup $ExeFile -Force`

---

## Q6: الـ sha256sums.txt — أي ملف يُتحقق منه الآن؟

**Decision**: يُتحقق من `laundry-app-v{version}.exe` (بدلاً من ZIP).

**في release.yml**: hash الـ update exe في السطر الأول من sha256sums.txt.

**في verifySha256()**: `path.basename(exePath)` سيكون `laundry-app-v{version}.exe` — يطابق السطر في الملف.

---

## Q7: WhatsApp fallback version — كيف يُحدَّث؟

**Decision**: تعريف constant مسمى `BAILEYS_FALLBACK_VERSION` في `whatsappService.js`.

**Rationale**:
- يسهّل التحديث اليدوي بدون البحث في الكود
- الـ version الحالي `[2, 3000, 1035194821]` صالح ويعمل
- يُحدَّث عند كل إصدار جديد من Baileys (نادراً)
