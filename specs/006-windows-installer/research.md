# Research: Windows Installer

## القرار 1: أداة البناء — Inno Setup

**Decision**: Inno Setup 6.x

**Rationale**:
- مجاني ومفتوح المصدر
- ينتج ملف exe واحداً لا يحتاج متطلبات
- يدعم Unicode/العربية بشكل كامل
- يدعم تسجيل Scheduled Tasks عبر `[Run]` section بـ PowerShell
- يدعم `[InstallDelete]` لحذف الملفات القديمة مع الحفاظ على `data/`
- يدعم UAC elevation تلقائياً عبر `PrivilegesRequired=admin`
- حجم الـ compiler صغير (~6 MB) ولا يحتاج تثبيت على جهاز العميل

**Alternatives considered**:
- **NSIS**: أصعب في دعم العربية، syntax أقل وضوحاً
- **WiX**: معقد جداً لهذا الحجم، يتطلب .NET
- **PowerShell self-extracting**: لا يدعم واجهة رسومية بسهولة

---

## القرار 2: تسجيل Startup

**Decision**: Task Scheduler فقط (بدون Startup folder shortcut)

**Rationale**:
- Task Scheduler يعمل كـ SYSTEM → يبدأ قبل login المستخدم
- أكثر موثوقية من Startup folder الذي يتطلب login
- Inno Setup يمكنه تشغيل PowerShell في `[Run]` section بعد التثبيت
- استخدام الـ `scripts/install-service.ps1` الموجود مباشرة

**Note**: الـ Startup folder shortcut اختياري — Task Scheduler كافٍ للبرنامج.

---

## القرار 3: هيكل الملفات داخل المثبّت

**Decision**: تضمين مجلد `release/` كاملاً

```
release/
├── laundry-app.exe      ← البرنامج الرئيسي
├── mkcert.exe           ← لإعداد HTTPS (اختياري بعد التثبيت)
├── rcedit.exe           ← ليس مطلوباً في runtime — يُستبعد
├── data/                ← بيانات أولية (whatsapp_session فارغ)
├── scripts/
│   ├── install-service.ps1
│   └── setup.ps1
└── ssl/                 ← فارغ (يُملأ بعد تشغيل setup-ssl)
```

**المثبّت يستبعد**: `rcedit.exe` (أداة build فقط)، `scripts/setup-ssl.ps1` (تشغّل منفصلاً)

---

## القرار 4: الحفاظ على بيانات العميل عند إعادة التثبيت

**Decision**: استخدام `[InstallDelete]` للملفات الثنائية فقط + `DontOverwrite` flag لملفات البيانات

**Rationale**:
- Inno Setup يدعم `Flags: onlyifdoesntexist` لملفات مثل `.env`
- مجلد `data/` يُنسخ مع `Flags: onlyifdoesntexist` لكل ملف فيه
- `laundry-app.exe` يُستبدل دائماً

---

## القرار 5: بناء المثبّت

**Decision**: سكريبت PowerShell `build-installer.ps1` يستدعي `iscc.exe` (Inno Setup Compiler)

**Workflow**:
```
npm run build          → ينتج dist/laundry-app.exe ويحقن الأيقونة وينسخه لـ release/
npm run build:installer → يشغّل iscc.exe على installer/laundry.iss → ينتج dist/PLUS-Laundry-Setup.exe
```

**Inno Setup path**: `C:\Program Files (x86)\Inno Setup 6\iscc.exe` (افتراضي)
