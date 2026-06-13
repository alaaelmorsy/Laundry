# Feature Specification: GitHub Actions Automated Release & Auto-Update Trigger

**Feature Branch**: `010-github-actions-release`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "GitHub Actions workflow that automatically builds Laundry-PLUS-v{version}.exe when pushing to main, creates a GitHub Release with the exe + source ZIP + sha256sums.txt. The exe name should be Laundry-PLUS-v{version}.exe. Auto-update should also trigger automatically if a new version is available (bump version in package.json, push, Actions builds and releases, the in-app auto-updater detects and applies it)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Push Triggers Automatic Build and Release (Priority: P1)

المطور (Alaa) يرفع تحديثاً جديداً على GitHub بعد رفع رقم الإصدار في `package.json`، فيجد بعد دقائق أن GitHub أنشأ Release جديداً تلقائياً يحتوي على ملف exe مبني وجاهز.

**Why this priority**: هذه هي النقطة المحورية للميزة — بدونها لا تعمل أي بقية المنظومة.

**Independent Test**: يكفي رفع `package.json` بإصدار جديد ومشاهدة أن الـ Release يظهر على GitHub خلال 10 دقائق.

**Acceptance Scenarios**:

1. **Given** المطور غيّر `version` في `package.json` من `1.0.12` إلى `1.0.13`، **When** يرفع على `main`، **Then** ينشئ GitHub Actions تلقائياً Release بعنوان `v1.0.13` يحتوي على `Laundry-PLUS-v1.0.13.exe` و `laundry-v1.0.13.zip` و `sha256sums.txt`.

2. **Given** المطور يرفع تغييراً على `main` بنفس رقم الإصدار الموجود، **When** يشتغل الـ workflow، **Then** لا يُنشئ Release مكرر ويتوقف بدون خطأ.

3. **Given** فشل البناء (خطأ في الكود)، **When** يشتغل الـ workflow، **Then** لا يُنشئ Release ويظهر الخطأ واضحاً في GitHub Actions.

---

### User Story 2 - In-App Auto-Updater Detects New Release (Priority: P2)

المستخدم يشغّل البرنامج في المحل، فيظهر له إشعار بوجود إصدار جديد تلقائياً دون أي تدخل يدوي.

**Why this priority**: هذه هي الحلقة التي تربط الـ Release بالمستخدم النهائي.

**Independent Test**: بعد نشر Release جديد على GitHub، يفتح المستخدم البرنامج ويرى إشعار التحديث خلال الساعة.

**Acceptance Scenarios**:

1. **Given** يوجد Release جديد على GitHub بإصدار أعلى من المثبت، **When** يشتغل البرنامج أو يضغط "التحقق من التحديثات"، **Then** يظهر إشعار بوجود إصدار جديد مع زر لتطبيقه.

2. **Given** البرنامج محدّث بآخر إصدار، **When** يتحقق من التحديثات، **Then** يظهر "البرنامج محدّث" بدون أي إشعار.

3. **Given** لا يوجد اتصال بالإنترنت، **When** يحاول التحقق من التحديثات، **Then** يظهر رسالة واضحة بعدم القدرة على الاتصال بدون أن يتعطل البرنامج.

---

### User Story 3 - Auto-Update Applies Automatically (Priority: P3)

المستخدم يضغط "تطبيق التحديث"، فيتم تنزيل التحديث وتثبيته وإعادة تشغيل البرنامج تلقائياً.

**Why this priority**: هذه المرحلة مبنية على P1 و P2، ونظام التحديث الداخلي موجود بالفعل.

**Independent Test**: تنزيل الـ ZIP من الـ Release يدوياً والتحقق من أن `updater.ps1` يطبقه بنجاح.

**Acceptance Scenarios**:

1. **Given** المستخدم ضغط "تطبيق التحديث"، **When** اكتمل التنزيل والتحقق من الـ checksum، **Then** يُغلق البرنامج تلقائياً ويُطبق التحديث ويُعاد التشغيل.

2. **Given** الـ checksum لا يتطابق، **When** يتحقق النظام من سلامة الملف، **Then** يُلغى التحديث وتظهر رسالة خطأ واضحة.

---

### Edge Cases

- ماذا لو كان الـ exe أكبر من 2 GB (حد GitHub للـ assets)؟ — الحجم الحالي أقل بكثير، لكن يجب مراقبته.
- ماذا لو رُفع نفس الإصدار مرتين في نفس الوقت؟ — الـ workflow يتحقق من وجود الـ Release قبل إنشائه.
- ماذا لو انقطع الاتصال أثناء التنزيل؟ — النظام الحالي يحتوي على timeout ويُلغي الملف الناقص.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: الـ workflow يجب أن يُشغَّل تلقائياً عند كل push على `main`.
- **FR-002**: اسم الـ exe المبني يجب أن يكون `Laundry-PLUS-v{version}.exe` حيث `{version}` مقروء من `package.json`.
- **FR-003**: الـ Release يجب أن يحتوي على ثلاثة assets: `Laundry-PLUS-v{version}.exe` + `laundry-v{version}.zip` + `sha256sums.txt`.
- **FR-004**: الـ `sha256sums.txt` يجب أن يحتوي على hash الـ ZIP والـ exe.
- **FR-005**: الـ workflow يجب أن يتحقق من عدم وجود Release بنفس الإصدار قبل الإنشاء (منع التكرار).
- **FR-006**: الـ ZIP يجب أن يشمل السورس كود فقط بدون `node_modules` و `data` و `.env` و `ssl` و `backup`.
- **FR-007**: نظام التحديث الداخلي (`updateService.js`) يجب أن يتعرف على الـ Release الجديد تلقائياً عبر GitHub API.
- **FR-008**: رابط تنزيل الـ ZIP في الـ Release يجب أن يكون متوافقاً مع الـ pattern الذي يبحث عنه `updateService.js` (ملف ينتهي بـ `.zip`).

### Key Entities

- **GitHub Release**: الإصدار المنشور على GitHub يحتوي على tag (`v{version}`)، عنوان، وملفات مرفقة (assets).
- **workflow YAML**: ملف التهيئة في `.github/workflows/release.yml` يتحكم في خطوات البناء والنشر.
- **update-status.json**: ملف محلي في `data/` يخزن آخر نتيجة للتحقق من التحديثات.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: من لحظة الـ push حتى ظهور الـ Release الجاهز على GitHub لا تتجاوز 15 دقيقة.
- **SC-002**: الـ exe المبني يعمل بدون تثبيت Node.js على الجهاز المستهدف.
- **SC-003**: نظام التحديث الداخلي يكتشف الإصدار الجديد خلال ساعة واحدة من نشره.
- **SC-004**: المطور لا يحتاج لأي خطوة يدوية لإنشاء الـ Release سوى تغيير الرقم في `package.json` والـ push.
- **SC-005**: الـ workflow لا يُنشئ releases مكررة بنفس الإصدار.

## Assumptions

- البناء يتم على `windows-latest` في GitHub Actions لأن `pkg` يبني exe مرتبط بالمنصة.
- `GITHUB_TOKEN` المتوفر تلقائياً في Actions كافٍ لإنشاء الـ Releases (لا يحتاج PAT).
- Workflow permissions مضبوطة على "Read and write" في إعدادات الـ repo (تم التحقق من ذلك).
- نظام التحديث الداخلي الموجود (`updateService.js`) يبحث عن asset ينتهي بـ `.zip` في أحدث Release — هذا موجود بالفعل في الكود.
- رقم الإصدار في `package.json` هو المصدر الوحيد للحقيقة — لا يوجد ملف إصدار آخر.
- الـ workflow يعمل فقط على الـ push للـ `main` branch، وليس على الـ PRs أو الـ branches الأخرى.
