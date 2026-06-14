# Feature Specification: إصلاح أخطاء التحديث التلقائي وWhatsApp

**Feature Branch**: `011-fix-update-whatsapp-bugs`

**Created**: 2026-06-14

**Status**: Draft

## المشكلة الجوهرية

عند التجربة الفعلية على جهاز عميل (حيث البرنامج مثبَّت كـ exe عبر NSSM Service ولا يوجد Node.js)، يوجد **3 أخطاء حرجة** تجعل التحديث التلقائي وWhatsApp يفشلان بالكامل.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — التحديث التلقائي يعمل من البداية للنهاية (Priority: P1)

المستخدم يضغط "تحديث الآن" من شاشة الإعدادات، يرى شريط التقدم، يُغلَق البرنامج، ويعود بالإصدار الجديد تلقائياً — بدون أي تدخل يدوي.

**Why this priority**: هذه الوظيفة الأساسية للتحديث — إن فشلت لا قيمة لكل النظام.

**Independent Test**: يمكن اختباره بالكامل بترقية من v1.0.10 إلى v1.0.11 على جهاز عميل حقيقي.

**Acceptance Scenarios**:

1. **Given** البرنامج يعمل كـ Windows Service على جهاز عميل بدون Node.js، **When** المستخدم يضغط "تحديث الآن"، **Then** يتوقف الـ Service، يُنزَّل الـ exe الجديد، يُستبدل، يُعاد تشغيل الـ Service، ويظهر الإصدار الجديد.
2. **Given** فشل الاستبدال، **When** يحدث خطأ أثناء التحديث، **Then** يُستعاد الـ exe القديم ويُعاد تشغيل الـ Service (rollback).
3. **Given** انقطع الإنترنت أثناء التحميل، **When** فشل التحميل، **Then** لا يُمسّ الـ exe الحالي وتظهر رسالة خطأ.

---

### User Story 2 — GitHub Release يحتوي على exe للتحديث التلقائي (Priority: P1)

عند رفع إصدار جديد عبر GitHub Actions، يكون الـ Release يحتوي على `laundry-app-v{version}.exe` بجانب الـ installer وملف الـ checksums.

**Why this priority**: بدون هذا لا يوجد ملف للتحميل في التحديث التلقائي.

**Independent Test**: رفع push على main بإصدار جديد والتحقق أن الـ Release يحتوي على ملفات: exe + installer + sha256sums.txt.

**Acceptance Scenarios**:

1. **Given** push على main بـ version جديدة، **When** ينتهي الـ workflow، **Then** الـ Release يحتوي على `laundry-app-v{version}.exe` و`Laundry-PLUS-Setup-v{version}.exe` و`sha256sums.txt`.
2. **Given** الـ checksum file، **When** `updateService.js` يبحث عن الـ zip asset، **Then** يجد الـ exe بدلاً من zip ويحمّله.

---

### User Story 3 — WhatsApp QR يظهر عند أول تشغيل (Priority: P2)

عند فتح شاشة WhatsApp على جهاز عميل جديد، يظهر الـ QR فوراً بدون أخطاء.

**Why this priority**: الخطأ `Invalid host defined options` يمنع ظهور QR نهائياً.

**Independent Test**: فتح شاشة WhatsApp بدون اتصال إنترنت → يجب أن يظهر QR.

**Acceptance Scenarios**:

1. **Given** جهاز عميل بدون وصول لـ GitHub Raw (firewall أو بطء)، **When** يفتح شاشة WhatsApp، **Then** يظهر QR خلال 10 ثوانٍ.
2. **Given** الـ fallback version مستخدم، **When** يمسح المستخدم الـ QR، **Then** يتصل الواتساب بشكل طبيعي.

---

### Edge Cases

- ماذا لو الـ Service لم يتوقف خلال 30 ثانية قبل استبدال الـ exe؟
- ماذا لو الـ exe الجديد أكبر من المساحة المتاحة؟
- ماذا لو مسار `nssm.exe` مختلف عند تشغيل `updater.ps1`؟
- ماذا لو الـ Baileys fallback version قديمة وWhatsApp رفضها؟

---

## Requirements *(mandatory)*

### Functional Requirements

**مجموعة أ — إصلاح release.yml (GitHub Actions)**

- **FR-001**: الـ workflow يجب أن يبني `laundry-app-v{version}.exe` (بدلاً من `laundry-app.exe`) ويرفعه للـ Release.
- **FR-002**: الـ release يجب أن يحتوي على exe للتحديث التلقائي بجانب الـ installer.
- **FR-003**: ملف `sha256sums.txt` يجب أن يحتوي على hash الـ exe الخاص بالتحديث (وليس ZIP).

**مجموعة ب — إصلاح updateService.js**

- **FR-004**: `checkForUpdate` يجب أن يبحث عن asset ينتهي بـ `.exe` واسمه `laundry-app-v*.exe` (وليس `.zip`) لتحميل التحديث.
- **FR-005**: `downloadUrl` في الـ cache يشير للـ exe الجديد.
- **FR-006**: خطوة `verify` تتحقق من hash الـ exe المُحمَّل.

**مجموعة ج — إصلاح updater.ps1 (الخطأ الأكبر)**

- **FR-007**: `Start-AppServer` يجب أن يستخدم NSSM لإعادة تشغيل الـ Service (`nssm start LaundryPlusApp`) وليس `node server\index.js`.
- **FR-008**: بدلاً من استخراج ZIP، يجب أن يستبدل الـ exe القديم بالجديد (`laundry-app.exe`).
- **FR-009**: المسار الصحيح للـ exe الجديد يُمرَّر من `updateService.js` للـ updater.ps1.
- **FR-010**: الـ updater يجب أن يعمل في حالة عدم وجود Node.js على الجهاز.

**مجموعة د — WhatsApp**

- **FR-011**: Fallback version محدَّثة دورياً — القيمة الحالية `[2, 3000, 1035194821]` مضمَّنة كـ constant قابل للتحديث.
- **FR-012**: `connect()` لا تُلقي خطأ إذا فشل `fetchLatestBaileysVersion()`.

### Key Entities

- **laundry-app-v{version}.exe**: الـ exe المُجمَّع الجديد الذي يُستبدل به الـ exe الحالي عند التحديث
- **updater.ps1**: سكريبت PowerShell منفصل يعمل بعد إغلاق السيرفر، مسؤول عن استبدال الـ exe وإعادة تشغيل الـ Service
- **LaundryPlusApp**: اسم الـ Windows Service المدار بـ NSSM

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: التحديث التلقائي يكتمل من الضغط على "تحديث الآن" حتى عودة البرنامج بالإصدار الجديد في أقل من 5 دقائق (على إنترنت طبيعي).
- **SC-002**: لا تظهر أي رسالة خطأ على شاشة الإعدادات طوال عملية التحديث.
- **SC-003**: WhatsApp QR يظهر خلال 10 ثوانٍ بصرف النظر عن توافر الإنترنت لـ GitHub.
- **SC-004**: عند فشل التحديث، البرنامج القديم يعود ويعمل بشكل طبيعي (rollback ناجح 100%).
- **SC-005**: الـ GitHub Release يُنشأ تلقائياً بـ 3 ملفات: exe للتحديث + installer + sha256sums.txt.

---

## الأخطاء المكتشفة (Bug Inventory)

| # | الملف | الخطأ | الخطورة |
|---|-------|-------|---------|
| B1 | `scripts/updater.ps1` سطر 54 | `Start-AppServer` تستدعي `node server\index.js` — لا يوجد node على جهاز العميل، يجب استخدام `nssm start LaundryPlusApp` | 🔴 حرج |
| B2 | `scripts/updater.ps1` + `server/services/updateService.js` | التحديث يحمّل SOURCE ZIP ويستخرج ملفات JS — لكن الـ Service يشغّل EXE مجمَّع، تغيير JS لا يؤثر على شيء | 🔴 حرج |
| B3 | `.github/workflows/release.yml` | الـ `laundry-app.exe` يُبنى لكن لا يُرفع للـ Release — يُرفع الـ installer فقط | 🔴 حرج |
| B4 | `server/services/updateService.js` سطر 197 | يبحث عن asset ينتهي بـ `.zip` لتحديد `downloadUrl` — لكن الحل الصحيح تحميل الـ exe | 🔴 حرج |
| B5 | `scripts/updater.ps1` سطر 9 | `$StatusFile = Join-Path $AppRoot "data\..."` — المسار صحيح لكن يفترض AppRoot = مجلد الـ exe وهذا يجب التأكد منه | 🟡 متوسط |
| B6 | `server/services/whatsappService.js` | `fetchLatestBaileysVersion()` تفشل بـ "Invalid host defined options" داخل pkg — **تم الإصلاح جزئياً** لكن الـ fallback version قد تصبح قديمة | 🟡 متوسط |
| B7 | `.github/workflows/release.yml` | خطوتا Build exe وInstall Inno Setup كلتاهما معنونتان بـ `── 8.` (تكرار في التسميات) | 🟢 بسيط |

---

## Assumptions

- الـ nssm.exe موجود في `{AppRoot}\nssm.exe` (نفس مجلد الـ exe).
- الـ Service المُنشأ من الـ installer اسمه دائماً `LaundryPlusApp`.
- الـ updater.ps1 يعمل بصلاحيات Administrator (لأن الـ Service يعمل بـ LocalSystem).
- حجم الـ exe للتحديث التلقائي لا يتجاوز 200 MB (تقدير حالي ~100 MB).
- الـ rollback يستعيد الـ exe القديم من BackupPath فقط (لا يحتاج DB rollback لأن الـ exe لا يغيّر schema).
