# Feature Specification: Fix Auto-Update Completion Bugs

**Feature Branch**: `024-fix-update-completion-bugs`

**Created**: 2026-06-20

**Status**: Draft

**Input**: إصلاح 4 أخطاء تمنع اكتمال التحديث التلقائي في PLUS Laundry POS

---

## Context

نظام التحديث التلقائي يعمل عبر GitHub Releases. الـ App يشتغل كـ Windows Service (NSSM).
التحديث يمر بمرحلتين:
- **Legacy path** (`isInstaller = false`): يشغّل `updater.ps1` مباشرةً
- **Installer path**: يشغّل Inno Setup installer بواجهة مرئية

المشكلة: التحديث لا يكتمل بعد إغلاق السيرفر، والـ service لا يرجع تلقائياً.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — تحديث تلقائي يكتمل فعلياً بعد إغلاق السيرفر (Priority: P1)

عندما يحمّل النظام تحديثاً ويطلب من السيرفر إغلاق نفسه، يجب أن تُكمل عملية التحديث استبدال الملفات وإعادة تشغيل الـ service — حتى وإن كان البروسس الأصلي قد انتهى.

**Why this priority**: هذه المشكلة الجوهرية — التحديث يتوقف تماماً عند إغلاق Node لأن `updater.ps1` يُقتل داخل Job Object الخاص بـ NSSM.

**Independent Test**: شغّل تحديثاً وأغلق السيرفر — راقب أن الـ `.exe` الجديد يُنسخ وأن الـ service يعود للعمل.

**Acceptance Scenarios**:

1. **Given** نظام يشتغل كـ Windows Service عبر NSSM، **When** يُطلب تحديث legacy (بدون installer)، **Then** يُسجَّل `updater.ps1` كـ Scheduled Task منفصل عن Job Object ويكتمل بعد خروج Node.
2. **Given** `updater.ps1` مُسجَّل كـ Scheduled Task، **When** يخرج Node بـ `process.exit(0)`، **Then** لا يُقتل `updater.ps1` ويستمر في استبدال الملفات.

---

### User Story 2 — الـ Service يعود للعمل بعد تثبيت الـ Installer (Priority: P1)

بعد اكتمال تثبيت Inno Setup Installer، يجب أن يعود الـ service للعمل تلقائياً.

**Why this priority**: حالياً الـ service يبقى متوقفاً بعد التثبيت لأن `NSSM AppExit 0 = Exit` لا يُستعاد.

**Independent Test**: شغّل installer وأتمّه — تحقق أن الـ service يرجع ويمكن الوصول للتطبيق.

**Acceptance Scenarios**:

1. **Given** تثبيت اكتمل عبر Path 4a (interactive session)، **When** ينتهي `Start-Process -Wait`، **Then** يُستعاد `NSSM AppExit 0 = Restart` ويُشغَّل الـ service فوراً.
2. **Given** تثبيت اكتمل عبر Path 4b (Session-0 / CreateProcessAsUser)، **When** يخرج `run-installer.ps1`، **Then** يُستعاد `NSSM AppExit 0 = Restart` كـ safety net قبل الخروج.
3. **Given** فشل الـ service في الرجوع تلقائياً عبر Inno Setup، **When** NSSM يكتشف توقف الـ service، **Then** يعيد تشغيله بفضل `AppExit = Restart`.

---

### User Story 3 — انتظار خروج Node قبل بدء التثبيت (Priority: P2)

يجب أن ينتظر `run-installer.ps1` حتى يخرج Node server فعلياً قبل تشغيل الـ installer، وذلك عبر PID الصحيح.

**Why this priority**: حالياً `$ServerPid = 0` دائماً فتُتخطى خطوة الانتظار، مما قد يُسبب تعارضاً بين الملفات المفتوحة والتثبيت.

**Independent Test**: راقب الـ log — يجب أن يظهر `"Waiting for Node server PID XXXX to exit"` وليس `"ServerPid is 0"`.

**Acceptance Scenarios**:

1. **Given** `launch-installer.ps1` يستقبل `-ServerPid` من Node، **When** يُسجَّل الـ Task، **Then** يُمرَّر `-ServerPid` لـ `run-installer.ps1` في `$psArgs`.
2. **Given** `run-installer.ps1` يستقبل `$ServerPid > 0`، **When** يبدأ تنفيذه، **Then** ينتظر خروج الـ process بذلك الـ PID قبل تشغيل الـ installer.

---

### Edge Cases

- ماذا لو فشل تسجيل الـ Scheduled Task؟ → يجب تسجيل الخطأ بوضوح
- ماذا لو كان `$ServerPid = 0` (تشغيل مباشر بدون Node)؟ → يجب الـ fallback لـ time-based wait
- ماذا لو كان NSSM غير موجود؟ → تخطي خطوة restore بأمان مع تسجيل تحذير
- ماذا لو كانت `updater.ps1` داخل pkg snapshot؟ → يجب نسخها لـ DATA_DIR قبل التسجيل

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: يجب إنشاء `scripts/launch-updater.ps1` لتسجيل `updater.ps1` كـ Scheduled Task (خارج Job Object الخاص بـ NSSM).
- **FR-002**: يجب تعديل `spawnUpdater()` في `updateService.js` لاستخدام `execFileSync` لتشغيل `launch-updater.ps1` بدلاً من `spawn(updater.ps1, detached)`.
- **FR-003**: قبل تسجيل الـ Task، يجب نسخ `updater.ps1` من `ROOT/scripts/` إلى `DATA_DIR/scripts/` (لأن PowerShell لا يقرأ داخل pkg snapshot).
- **FR-004**: يجب إضافة `-ServerPid $ServerPid` في `$psArgs` داخل `launch-installer.ps1` (السطر ~75).
- **FR-005**: في Path 4a (interactive) داخل `run-installer.ps1`، يجب استعادة `NSSM AppExit 0 = Restart` وتشغيل الـ service بعد انتهاء `Start-Process -Wait` (نجح أو فشل).
- **FR-006**: في Path 4b (Session-0) داخل `run-installer.ps1`، يجب استعادة `NSSM AppExit 0 = Restart` كـ safety net قبل `exit 0`.
- **FR-007**: يجب إضافة log واضح عند `$ServerPid = 0` (`"ServerPid is 0 — skipping PID wait"`).

### Key Entities

- **Windows Job Object**: حاوية NSSM تقتل جميع الـ child processes عند خروج الـ service
- **Scheduled Task**: مهمة مسجّلة في Task Scheduler تعمل خارج Job Object
- **NSSM AppExit**: إعداد يتحكم في سلوك NSSM عند خروج الـ service بكود محدد
- **updater.ps1**: سكريبت استبدال الملفات والـ rename الجذري
- **run-installer.ps1**: سكريبت إدارة تشغيل الـ Installer بمساراته المختلفة
- **launch-installer.ps1**: سكريبت تسجيل مهمة تشغيل الـ installer كـ Scheduled Task

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: بعد طلب تحديث legacy، يُكمل `updater.ps1` استبدال الملفات بنجاح حتى بعد خروج Node server.
- **SC-002**: بعد اكتمال تثبيت الـ installer (path 4a أو 4b)، يعود الـ service للعمل في أقل من 30 ثانية.
- **SC-003**: يظهر في الـ log PID الصحيح لـ Node server عند الانتظار (ليس 0).
- **SC-004**: لا يبقى الـ service في حالة "permanently stopped" بعد أي مسار تحديث.
- **SC-005**: يُسجَّل `updater.ps1` كـ Scheduled Task ناجح ويظهر في Task Scheduler قبل خروج Node.

---

## Assumptions

- الـ App يشتغل كـ NSSM Windows Service باسم `LaundryPlusApp`.
- `DATA_ROOT` هو مجلد الـ exe في production (حيث `scripts/` موجودة جنبه).
- `scripts/launch-installer.ps1` الموجود حالياً يعمل بشكل صحيح — التعديل على `$psArgs` فقط.
- Inno Setup installer قد لا يحتوي على `[Run]` section يشغّل الـ service — لذا لا نعتمد عليه.
- التعديل لا يؤثر على Interactive mode (تشغيل مباشر بدون NSSM).
