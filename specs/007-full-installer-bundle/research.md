# Research: Full Self-Contained Installer Bundle

**Feature**: `007-full-installer-bundle`
**Date**: 2026-06-13

---

## 1. تنظيف متغيرات Node.js من System Registry

### Decision
استخدام قسم `[Registry]` في Inno Setup لحذف المتغيرات الضارة نهائياً من `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment` أثناء التثبيت.

### Rationale
- الـ `[Registry]` section في Inno Setup يُنفَّذ قبل `[Run]` — أي أن البرنامج يشتغل بعد تنظيف المتغيرات.
- الحذف من `HKLM` (System environment) يعمل على **جميع المستخدمين** وهو المكان الذي يكتب فيه Node.js installer.
- `Flags: deletevalue` يحذف الـ key نهائياً — أفضل من ضبطه على قيمة فارغة لأن القيمة الفارغة قد تُسبب مشاكل في بعض البيئات.
- `Flags: deletevalue uninsdeletevalue` يضمن التنظيف في كلتا الحالتين (تثبيت وإلغاء تثبيت).

### Implementation
```pascal
[Registry]
; حذف متغيرات Node.js الضارة من System environment
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "OPENSSL_CONF";    Flags: deletevalue; Check: EnvVarExists('OPENSSL_CONF')
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "OPENSSL_ENGINES"; Flags: deletevalue; Check: EnvVarExists('OPENSSL_ENGINES')
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "NODE_OPTIONS";    Flags: deletevalue; Check: EnvVarExists('NODE_OPTIONS')
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "NODE_PATH";       Flags: deletevalue; Check: EnvVarExists('NODE_PATH')
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
  ValueName: "NODE_ENV";        Flags: deletevalue; Check: EnvVarExists('NODE_ENV')
```

بعد الحذف من registry، يجب إرسال `WM_SETTINGCHANGE` لإعلام Windows بالتغيير:
```pascal
[Code]
procedure BroadcastEnvironmentChange();
var ResultCode: DWORD;
begin
  SendBroadcastMessage(WM_WININICHANGE, 0, 'Environment');
end;
```

### Alternatives Considered
- **VBScript في launcher.vbs** (موجود): يُنظّف فقط لعملية واحدة مؤقتاً — لا يحل المشكلة إذا شغّل المستخدم `laundry-app.exe` مباشرة.
- **PowerShell [Run] entry**: أبطأ وأكثر تعقيداً من `[Registry]` section المباشر.

---

## 2. ضمان حفظ جميع الملفات في مجلد التثبيت المختار

### Decision
مراجعة جميع مسارات `[Files]` في `installer/laundry.iss` للتأكد من استخدام `{app}` كـ `DestDir` وليس أي مسار مطلق.

### Findings
الـ installer الحالي (specs/006) يستخدم `{app}` بشكل صحيح في جميع entries:
- `laundry-app.exe` → `{app}`
- `mkcert.exe` → `{app}`
- `scripts/` → `{app}\scripts`
- `data/` → `{app}\data`
- `ssl/` → `{app}\ssl`
- `launcher.vbs` → `{app}` ✅ (موجود في release/)

`.env` يُنسخ من `installer\.env` → `{app}` ✅

**لا توجد مسارات مطلقة** — هذا المطلب محقَّق.

---

## 3. مشكلة `.env` في release/

### Decision
إضافة `.env` إلى قائمة ملفات `[Files]` في الـ installer مع `Flags: onlyifdoesntexist` للحفاظ على إعدادات المستخدم عند التحديث.

### Current State
الـ `.env` موجود في `installer\.env` وليس في `release\`. الـ installer ينسخه كـ Hidden file.

### Rationale
- `onlyifdoesntexist`: لا يُستبدل `.env` عند التحديث — يحافظ على بيانات MySQL التي ربما غيّرها المستخدم.
- `uninsneveruninstall`: لا يُحذف عند إلغاء التثبيت — يحافظ على الإعدادات.

---

## 4. إيقاف النسخة القديمة قبل نسخ الملفات

### Decision
إضافة `[Code]` section في Inno Setup يوقف `laundry-app.exe` قبل بدء نسخ الملفات (`CurStepChanged(ssInstall)`).

### Implementation
```pascal
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then begin
    Exec('taskkill.exe', '/F /IM laundry-app.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1000); // انتظر لإغلاق الملفات
  end;
end;
```

### Rationale
بدون إيقاف البرنامج، Windows يرفض استبدال `laundry-app.exe` لأنه مفتوح → خطأ "access denied" أثناء التثبيت.

---

## 5. فتح المتصفح بعد التثبيت

### Decision
استخدام `ShellExec` في `[Code]` بعد تشغيل Task Scheduler ببضع ثوانٍ انتظار، بديلاً عن `cmd ping + start`.

### Current State
الـ installer الحالي يستخدم:
```
Filename: "cmd.exe"; Parameters: "/c ping 127.0.0.1 -n 14 >nul && start https://localhost:3443"
```

### Improvement
استخدام `[Run]` entry مع `postinstall` flag:
```pascal
Filename: "{cmd}"; Parameters: "/c timeout /t 15 /nobreak >nul & start https://localhost:3443"; \
  Flags: runhidden postinstall nowait; Description: "فتح البرنامج في المتصفح"
```
`postinstall` يجعله اختيارياً (checkbox) في نهاية التثبيت — أفضل UX.

---

## Summary of Changes Required

| التغيير | الملف | الأولوية |
|---------|-------|---------|
| إضافة `[Registry]` section لحذف متغيرات Node.js | `installer/laundry.iss` | P1 — حل المشكلة الجذرية |
| إضافة `BroadcastEnvironmentChange()` بعد الحذف | `installer/laundry.iss` | P1 |
| إضافة `CurStepChanged` لإيقاف laundry-app.exe قبل التثبيت | `installer/laundry.iss` | P1 |
| إضافة `.env` في `[Files]` مع `onlyifdoesntexist` | `installer/laundry.iss` | P2 |
| تحسين فتح المتصفح بـ `postinstall` flag | `installer/laundry.iss` | P3 |
