# Data Model: تغليف البرنامج بـ pkg

## لا توجد جداول قاعدة بيانات جديدة

هذه الميزة لا تضيف أي جداول أو بيانات في MySQL — هي تغيير في طريقة تشغيل البرنامج وليس في منطق البيانات.

---

## هيكل الملفات بعد التغليف

### داخل `laundry.exe` (pkg snapshot — قراءة فقط)
```
/snapshot/laundry-app/
├── server/
│   ├── paths.js               ← NEW: مودول المسارات المركزي
│   ├── index.js
│   ├── invokeHandlers.js
│   ├── middleware/
│   └── services/
├── database/
│   └── db.js
├── screens/**                 ← pkg assets
└── assets/**                  ← pkg assets
```

### بجانب `laundry.exe` على القرص (قراءة/كتابة)
```
C:\Laundry\                    ← مجلد التثبيت (مثال)
├── laundry.exe
├── .env                       ← إعدادات MySQL والـ port
├── data/
│   ├── update-status.json
│   ├── update-log.txt
│   └── whatsapp_session/
├── ssl/
│   ├── key.pem
│   └── cert.pem
├── backup/                    ← نسخ احتياطية قبل التحديثات
├── scripts/
│   ├── updater.ps1
│   └── install-service.ps1    ← NEW
└── nssm.exe                   ← NEW (مُوزَّع مع الـ zip)
```

---

## مودول `server/paths.js`

```js
const path = require('path');
const isPkg = typeof process.pkg !== 'undefined';
const EXEC_DIR = path.dirname(process.execPath);

// APP_ROOT: للملفات الثابتة (screens, assets) — داخل exe أو مجلد المشروع
const APP_ROOT  = isPkg ? path.join(__dirname, '..') : path.join(__dirname, '..');

// DATA_ROOT: للملفات القابلة للكتابة (data, ssl, .env) — بجانب exe دائماً
const DATA_ROOT = isPkg ? EXEC_DIR : path.join(__dirname, '..');

module.exports = { APP_ROOT, DATA_ROOT, isPkg, EXEC_DIR };
```

**استخدام موحّد في جميع الملفات**:
```js
const { APP_ROOT, DATA_ROOT } = require('../paths'); // أو المسار المناسب
```

---

## ملف `.env.example` (يُوزَّع مع الـ zip)

```env
# إعدادات قاعدة البيانات
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=laundry_db

# إعدادات السيرفر
PORT=3000

# مسار Chrome للطباعة (اختياري)
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```
