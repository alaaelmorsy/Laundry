# Data Model & File Structure: Windows Installer

## ملفات المثبّت (المصدر)

```text
installer/
└── laundry.iss              ← Inno Setup script (الملف الرئيسي)

dist/
└── PLUS-Laundry-Setup.exe   ← الناتج النهائي (يُبنى بـ npm run build:installer)
```

## ملفات المصدر المضمّنة في المثبّت

```text
release/
├── laundry-app.exe          ← [REQUIRED] البرنامج الرئيسي
├── mkcert.exe               ← [REQUIRED] إعداد HTTPS
├── data/                    ← [ONLYIFDOESNTEXIST] بيانات أولية
│   └── whatsapp_session/    ← مجلد فارغ (يُنشأ تلقائياً)
├── scripts/
│   ├── install-service.ps1  ← [REQUIRED] تسجيل Task Scheduler
│   └── setup.ps1            ← [REQUIRED] إعداد شامل
└── ssl/                     ← [ONLYIFDOESNTEXIST] شهادة HTTPS
```

## ما يُثبَّت على جهاز العميل

```text
{مجلد التثبيت}\           ← مثال: C:\PLUS\Laundry\
├── laundry-app.exe
├── mkcert.exe
├── data\
│   └── whatsapp_session\
├── scripts\
│   ├── install-service.ps1
│   └── setup.ps1
└── ssl\
```

## إجراءات ما بعد التثبيت (بالترتيب)

| الترتيب | الإجراء | الأداة |
|---------|---------|--------|
| 1 | نسخ الملفات | Inno Setup [Files] |
| 2 | تسجيل Scheduled Task | PowerShell في [Run] |
| 3 | إضافة Startup shortcut | Inno Setup [Icons] |
| 4 | تشغيل laundry-app.exe | Inno Setup [Run] |

## مفتاح Registry (للـ Uninstall المستقبلي)

```
HKLM\Software\PLUS\Laundry
  InstallDir = {مجلد التثبيت}
  Version    = {رقم الإصدار}
```

## Scheduled Task

```
Name        : LaundryPOS
Execute     : {مجلد التثبيت}\laundry-app.exe
WorkingDir  : {مجلد التثبيت}
Trigger     : AtStartup
Principal   : SYSTEM / RunLevel Highest
RestartCount: 3 / Interval 1 minute
```
