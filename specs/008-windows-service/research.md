# Research: Windows Service Deployment

**Date**: 2026-06-13 | **Feature**: 008-windows-service

---

## Q1: أداة تسجيل Windows Service — NSSM vs Alternatives

**Decision**: NSSM (Non-Sucking Service Manager) v2.24

**Rationale**:
- يعمل مع أي exe بدون تعديل في الكود — `laundry-app.exe` يعمل كما هو
- يدعم auto-restart عند الفشل (3 مستويات: restart, restart, reboot)
- يُوزَّع كـ exe واحد (300 KB) — يُضاف داخل الـ installer مباشرة
- مستقر منذ 2011، مُثبَّت في ملايين الأجهزة
- يعطي stdout/stderr logs في Windows Event Log

**Alternatives Considered**:
- `node-windows`: يحتاج Node.js مثبتاً على الجهاز + يعدّل الكود → رُفض
- `WinSW`: XML config أكثر تعقيداً، يحتاج .NET → رُفض
- `sc.exe` (مدمج في Windows): لا يدعم auto-restart بسهولة → رُفض

**Installation Commands**:
```
nssm install LaundryPlusApp "C:\Laundry\laundry-app.exe"
nssm set LaundryPlusApp AppDirectory "C:\Laundry"
nssm set LaundryPlusApp DisplayName "مغسلة بلس"
nssm set LaundryPlusApp Description "نظام إدارة المغسلة"
nssm set LaundryPlusApp Start SERVICE_AUTO_START
nssm set LaundryPlusApp AppRestartDelay 5000
nssm set LaundryPlusApp AppThrottle 1500
nssm set LaundryPlusApp AppStopMethodSkip 0
nssm set LaundryPlusApp ObjectName LocalSystem
nssm set LaundryPlusApp AppExit Default Restart
```

---

## Q2: Desktop Shortcut — كيف يفتح المتصفح بدون نافذة سوداء

**Decision**: Shortcut يشغّل `explorer.exe https://localhost:3443`

**Rationale**:
- `explorer.exe <url>` يفتح المتصفح الافتراضي بدون أي نافذة سوداء
- لا يحتاج أي ملف إضافي — مدمج في Windows
- Inno Setup يُنشئه مباشرة في `[Icons]` section

**Inno Setup Code**:
```pascal
[Icons]
Name: "{commondesktop}\مغسلة بلس"; \
  Filename: "{sys}\explorer.exe"; \
  Parameters: "https://localhost:3443"; \
  IconFilename: "{app}\laundry-app.exe"; \
  Comment: "فتح نظام إدارة المغسلة"
```

**Alternatives Considered**:
- `.bat` file يشغل `start https://...` → يظهر نافذة سوداء لثانية → رُفض
- `.vbs` script → يتطلب ملف إضافي → رُفض
- `cmd /c start https://...` → نفس مشكلة النافذة → رُفض

---

## Q3: Auto-Update — الآلية الكاملة

**Decision**: Cron داخل Express يفحص `version.json` على GitHub Releases، الـ frontend يستعلم عبر invoke API، المستخدم يوافق، يُفتح الـ installer تلقائياً.

**Rationale**:
- لا خدمة منفصلة — cron داخل `server.js` الموجود
- يتوافق مع Architecture القائمة (invoke endpoint)
- GitHub Releases مجاني وموثوق لاستضافة الـ installer

**تدفق التحديث**:
```
كل 6 ساعات (cron):
  1. fetch https://github.com/.../releases/latest → { tag_name, assets[...] }
  2. قارن مع CURRENT_VERSION من package.json
  3. إذا أحدث: احفظ { version, downloadUrl, releaseNotes } في الذاكرة

Frontend (عند فتح أي صفحة):
  4. استعلم window.api.checkForUpdate()
  5. إذا يوجد تحديث: أظهر banner
  6. المستخدم يضغط "تثبيت" → window.api.installUpdate()

Backend (installUpdate):
  7. حمّل الـ installer إلى %TEMP%\laundry-update-setup.exe
  8. شغّل الـ installer بـ: spawn('cmd', ['/c', 'start', '/wait', tmpPath])
  9. الـ installer يوقف الـ service، ينسخ الملفات، يعيد تشغيله
```

**GitHub Releases API**:
```
GET https://api.github.com/repos/OWNER/REPO/releases/latest
Response: { tag_name: "v1.0.13", assets: [{ name: "laundry-setup.exe", browser_download_url: "..." }] }
```

**version.json** (بديل أبسط لو لم يكن GitHub):
```json
{ "version": "1.0.13", "url": "https://...", "notes": "إصلاح مشاكل الفواتير" }
```

**Alternatives Considered**:
- خدمة Windows Service منفصلة للتحديث → تعقيد إضافي غير ضروري → رُفضت
- Auto-install بدون موافقة المستخدم → خطر فقدان بيانات غير محفوظة → رُفض
- Squirrel / electron-updater → مخصص لـ Electron → لا علاقة → رُفض

---

## Q4: تعارض NSSM مع الـ installer عند التحديث

**Decision**: الـ installer يوقف الـ service بـ NSSM قبل نسخ الملفات.

**التسلسل الصحيح في laundry.iss**:
```pascal
[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var ResultCode: Integer;
begin
  if CurStep = ssInstall then begin
    // أوقف عبر NSSM (أنظف من taskkill)
    Exec(ExpandConstant('{app}\nssm.exe'), 'stop LaundryPlusApp', '',
         SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(2000);
    // احتياط: taskkill لو NSSM فشل
    Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM laundry-app.exe', '',
         SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1000);
  end;
  if CurStep = ssPostInstall then begin
    Exec(ExpandConstant('{app}\nssm.exe'), 'start LaundryPlusApp', '',
         SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
```

---

## Q5: استضافة الـ releases — GitHub vs محلي

**Decision**: GitHub Releases (مجاني، موثوق، CDN سريع)

**Setup المطلوب**:
- إنشاء repo خاص (private) على GitHub
- رفع كل إصدار كـ GitHub Release مع الـ .exe
- استخدام GitHub API token في `.env` للـ private repos

**للـ Public repos**: لا token مطلوب، الـ API مفتوح.

---

## Q6: التعامل مع MySQL عند بدء الـ Service

**Decision**: Express يعيد المحاولة للاتصال بـ MySQL تلقائياً (موجود بالفعل في `db.js`).

**الوضع الحالي**: `db.js` يستخدم connection pool — إذا كان MySQL لم يبدأ بعد، يفشل الـ request الأول ثم ينجح التالي بعد بدء MySQL.

**لا تعديل مطلوب** — NSSM يبدأ `laundry-app.exe` وهو يتعامل مع MySQL الغائب بنفس الطريقة الحالية.
