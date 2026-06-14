# Tasks: إصلاح التحديث التلقائي وWhatsApp

**Input**: `specs/011-fix-update-whatsapp-bugs/`

**ملاحظة**: لا يوجد setup أو foundational phases — جميع المهام تعديلات على ملفات موجودة بالفعل.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تنفيذه بالتوازي مع مهام أخرى
- **[US1]**: التحديث التلقائي من البداية للنهاية
- **[US2]**: GitHub Release يحتوي على exe للتحديث
- **[US3]**: WhatsApp QR بدون أخطاء

---

## Phase 1: إصلاح WhatsApp (US3) — مستقل تماماً

**Story Goal**: `fetchLatestBaileysVersion` يفشل داخل pkg → استخدام constant مُسمى كـ fallback.

**Independent Test**: فتح شاشة WhatsApp بدون وصول GitHub → QR يظهر خلال 10 ثوانٍ.

- [x] T001 [US3] أضف `const BAILEYS_FALLBACK_VERSION = [2, 3000, 1035194821]` بعد `require`s في `server/services/whatsappService.js`
- [x] T002 [US3] استبدل الـ inline array `[2, 3000, 1035194821]` داخل `catch` block بـ `BAILEYS_FALLBACK_VERSION` في `server/services/whatsappService.js`

---

## Phase 2: إصلاح updateService.js (US1 + US2)

**Story Goal**: `checkForUpdate` يجد الـ exe asset الصحيح، و`performUpdate` يحمّله ويمرره للـ updater.

**Independent Test**: استدعاء `checkForUpdate()` يُرجع `downloadUrl` يشير لـ `laundry-app-v*.exe`.

- [x] T003 [US2] في `server/services/updateService.js` داخل `checkForUpdate()`: استبدل `zipAsset` بـ `exeAsset` — البحث عن `a.name.startsWith('laundry-app-v') && a.name.endsWith('.exe')`
- [x] T004 [US2] في نفس الدالة: غيّر `downloadUrl` و`assetSize` ليستخدما `exeAsset` بدلاً من `zipAsset`
- [x] T005 [US1] في `server/services/updateService.js` داخل `performUpdate()`: غيّر اسم الملف المؤقت من `laundry-v${targetVersion}.zip` إلى `laundry-app-v${targetVersion}.exe` ومتغير `zipPath` → `exePath`
- [x] T006 [US1] في `performUpdate()`: غيّر معامل الـ updater من `-ZipPath zipPath` إلى `-NewExePath exePath`
- [x] T007 [US1] في `performUpdate()` cleanup block عند الفشل: غيّر مسار الحذف من `laundry-v${targetVersion}.zip` إلى `laundry-app-v${targetVersion}.exe`

---

## Phase 3: إصلاح updater.ps1 (US1) — الخطأ الأكبر

**Story Goal**: updater.ps1 يستبدل `laundry-app.exe` بالجديد ويُعيد تشغيل الـ Windows Service.

**Independent Test**: تشغيل updater.ps1 يدوياً على جهاز عميل → exe يُستبدل، Service يُعاد تشغيله.

- [x] T008 [US1] في `scripts/updater.ps1`: غيّر param `$ZipPath` إلى `$NewExePath` في block الـ `param()`
- [x] T009 [US1] في `scripts/updater.ps1`: احذف متغيرات `$MigrateJs` و`$ServerJs` و`$PRESERVE`، وأضف `$ExeFile`, `$NssmPath`, `$ServiceName`
- [x] T010 [US1] في `scripts/updater.ps1`: استبدل دالة `Start-AppServer` كاملاً بـ `Start-AppService` التي تستخدم `nssm.exe start LaundryPlusApp` مع fallback لـ `sc.exe`
- [x] T011 [US1] في `scripts/updater.ps1`: احذف Step 2 (Extract ZIP) كاملاً واستبدله بـ Step 2 (Replace exe): نسخ احتياطي للـ exe القديم، نسخ الجديد، rollback عند الفشل
- [x] T012 [US1] في `scripts/updater.ps1`: احذف Step 3 (Run DB migration) كاملاً — الـ migrations تعمل تلقائياً عند تشغيل الـ exe الجديد
- [x] T013 [US1] في `scripts/updater.ps1`: غيّر جميع استدعاءات `Start-AppServer` إلى `Start-AppService` (3 مواضع: في rollback Step 2، في rollback Step 3 القديم المحذوف، وفي Step 4 Success)

---

## Phase 4: إصلاح release.yml (US2)

**Story Goal**: الـ Release يحتوي على `laundry-app-v{version}.exe` صالح للتحديث التلقائي.

**Independent Test**: push على main → Release يحتوي على 3 ملفات: update exe + installer + sha256sums.

- [x] T014 [P] [US2] في `.github/workflows/release.yml` خطوة `Build exe`: أضف `$version` variable، غيّر output لـ `release\laundry-app-v$version.exe`، ثم `Copy-Item` لـ `release\laundry-app.exe` للـ installer
- [x] T015 [US2] في `.github/workflows/release.yml`: احذف خطوة `Create source ZIP` كاملاً (الخطوة 9)
- [x] T016 [US2] في `.github/workflows/release.yml` خطوة `Generate checksums`: استبدل `$zipName`/`$zipHash` بـ `$updateExe`/`$updateHash` — hash الـ update exe
- [x] T017 [US2] في `.github/workflows/release.yml` خطوة `Create Release`: استبدل `$zipName` بـ `"release\laundry-app-v$version.exe"` في قائمة assets المرفوعة

---

## Phase 5: التحقق النهائي

- [x] T018 شغّل `Select-String -Path scripts\updater.ps1 -Pattern '\bnode\b|ZipPath|Start-AppServer'` وتأكد من عدم وجود نتائج
- [x] T019 شغّل `Select-String -Path server\services\updateService.js -Pattern "\.find.*\.zip"` وتأكد من عدم وجود نتائج
- [x] T020 شغّل `Select-String -Path .github\workflows\release.yml -Pattern 'laundry-app-v'` وتأكد من ظهور النتيجة في خطوة Create Release

---

## Implementation Strategy

**MVP**: Phase 1 (T001-T002) مستقل تماماً — يُصلح WhatsApp فوراً بدون أي مخاطر.

**الترتيب المقترح**:
```
T001-T002 → WhatsApp (مستقل، آمن، سريع)
T003-T007 → updateService.js (يجب قبل updater.ps1 لفهم المعاملات)
T008-T013 → updater.ps1 (يعتمد على T005-T006 لمعرفة NewExePath)
T014-T017 → release.yml (مستقل عن باقي الكود)
T018-T020 → التحقق
```

**التوازي الممكن**:
- T001-T002 مع T003-T007 مع T014-T015 — ثلاثة ملفات مختلفة تماماً
- T016-T017 بعد T015

---

## Dependencies

```
US3 (WhatsApp) ← مستقل
US2 (Release)  ← مستقل عن US1 وUS3
US1 (Update)   ← يعتمد على US2 (الـ exe يجب أن يُرفع للـ Release أولاً)
```

**ملاحظة**: US1 وUS2 يجب إصلاحهما معاً للحصول على نظام تحديث يعمل end-to-end.
