# Data Model: Full Self-Contained Installer Bundle

**Feature**: `007-full-installer-bundle`
**Date**: 2026-06-13

---

## هيكل الملفات بعد التثبيت

كل شيء داخل المجلد الذي اختاره المستخدم `{app}` (افتراضياً `C:\Program Files\PLUS\Laundry`):

```
{app}\                          ← المجلد المختار أثناء التثبيت
├── laundry-app.exe             ← البرنامج الرئيسي (يُستبدل عند التحديث)
├── mkcert.exe                  ← أداة SSL (يُستبدل عند التحديث)
├── launcher.vbs                ← المشغّل المخفي (يُستبدل عند التحديث)
├── .env                        ← إعدادات MySQL (محفوظ عند التحديث، Hidden)
│
├── data\                       ← بيانات WhatsApp session (محفوظة عند التحديث)
│   └── whatsapp_session\
│       └── *.json
│
├── ssl\                        ← شهادات mkcert (تُولَّد أثناء التثبيت، محفوظة)
│   ├── localhost-cert.pem
│   └── localhost-key.pem
│
└── scripts\                    ← سكريبتات الإعداد (تُستبدل عند التحديث)
    ├── register-task.ps1
    ├── install-service.ps1
    ├── setup-ssl.ps1
    └── setup.ps1
```

---

## سياسة الملفات عند التحديث (إعادة التثبيت)

| الملف/المجلد | سياسة التحديث | السبب |
|--------------|---------------|-------|
| `laundry-app.exe` | يُستبدل دائماً (`ignoreversion`) | هو التحديث نفسه |
| `mkcert.exe` | يُستبدل دائماً | قد يكون إصدار أحدث |
| `launcher.vbs` | يُستبدل دائماً | إصلاحات محتملة |
| `scripts\*` | يُستبدل دائماً | إصلاحات محتملة |
| `.env` | يُحفظ (`onlyifdoesntexist`) | إعدادات MySQL للمستخدم |
| `data\*` | يُحفظ (`onlyifdoesntexist uninsneveruninstall`) | بيانات جلسات WhatsApp |
| `ssl\*` | يُحفظ (`onlyifdoesntexist uninsneveruninstall`) | شهادات صالحة للجهاز |

---

## Windows Registry — التعديلات

### حذف (أثناء التثبيت)
```
HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment
  DELETE: OPENSSL_CONF
  DELETE: OPENSSL_ENGINES
  DELETE: NODE_OPTIONS
  DELETE: NODE_PATH
  DELETE: NODE_ENV
```

### إضافة (Task Scheduler — عبر PowerShell)
```
Task Name: LaundryPOS
Execute:   wscript.exe /nologo "{app}\launcher.vbs"
Trigger:   AtStartup
User:      SYSTEM
RunLevel:  Highest
```

---

## `.env` — محتوى ملف الإعدادات

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Db2@dm1n2022
DB_NAME=laundry
DB_PORT=3306
PORT=3000
HTTPS_PORT=3443
JWT_SECRET=LaundryJWT@2024!
```

**ملاحظة**: يُنسخ من `installer\.env` ويُضبط كـ Hidden attribute. لا يُستبدل عند التحديث.

---

## تسلسل الأحداث أثناء التثبيت

```
1. UAC prompt → صلاحيات Admin
2. اختيار مجلد التثبيت ({app})
3. إيقاف laundry-app.exe القديم (إن وجد) → taskkill
4. [Registry] → حذف متغيرات Node.js من HKLM
5. BroadcastEnvironmentChange → إعلام Windows
6. [Files] → نسخ الملفات إلى {app}
7. [Run] mkcert -install → تثبيت CA في Windows trust store
8. [Run] mkcert localhost → توليد شهادات SSL في {app}\ssl\
9. [Run] register-task.ps1 → تسجيل LaundryPOS في Task Scheduler
10. [Run] Start-ScheduledTask LaundryPOS → تشغيل البرنامج
11. [Run postinstall] → فتح https://localhost:3443 في المتصفح
```
