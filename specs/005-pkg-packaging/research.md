# Research: تغليف البرنامج بـ pkg

## القرار 1: كيف يتعامل pkg مع المسارات

**المشكلة**: داخل الـ exe الذي ينتجه pkg، يُشير `__dirname` إلى نظام ملفات افتراضي مدمج (virtual snapshot) وليس لمسار حقيقي على القرص — مما يمنع الكتابة إليه.

**الحل المختار**: مودول مركزي `server/paths.js` يكشف ثابتَين:
- `APP_ROOT` — مسار الملفات الثابتة القابلة للقراءة (assets, screens). في وضع pkg يُحل من snapshot، في وضع dev يُحل من `__dirname`.
- `DATA_ROOT` — مسار الملفات القابلة للكتابة (data/, ssl/, .env). دائماً `path.dirname(process.execPath)` في وضع pkg، أو مجلد المشروع في وضع dev.

```js
// server/paths.js
const path = require('path');
const isPkg = typeof process.pkg !== 'undefined';
const EXEC_DIR = path.dirname(process.execPath);

const APP_ROOT  = isPkg ? path.join(__dirname, '..') : path.join(__dirname, '..');
const DATA_ROOT = isPkg ? EXEC_DIR : path.join(__dirname, '..');

module.exports = { APP_ROOT, DATA_ROOT, isPkg, EXEC_DIR };
```

**البديل المرفوض**: تغيير كل ملف مباشرة بدون مودول مركزي — يصعب الصيانة ويزيد احتمال الخطأ.

---

## القرار 2: أي الملفات تُدمَج داخل exe وأيها تبقى خارجه

| الملف/المجلد | موقعه | السبب |
|---|---|---|
| `screens/**` | داخل exe (pkg asset) | قراءة فقط — HTML/JS/CSS |
| `assets/**` | داخل exe (pkg asset) | قراءة فقط — fonts, i18n, web-api |
| `server/**` | داخل exe (تلقائي) | كود الـ server |
| `database/**` | داخل exe (تلقائي) | كود قاعدة البيانات |
| `data/` | خارج exe | بيانات قابلة للكتابة |
| `ssl/` | خارج exe | شهادات قابلة للكتابة |
| `.env` | خارج exe | إعدادات قابلة للتعديل |
| `scripts/updater.ps1` | خارج exe | يُشغَّل بـ PowerShell مستقل |

---

## القرار 3: التوزيع — zip وليس installer

**المختار**: مجلد مضغوط يحتوي:
```
laundry-v1.0.12-win-x64.zip
├── laundry.exe
├── .env.example         ← يُعدَّل يدوياً لكل عميل
├── scripts/
│   └── install-service.ps1   ← تسجيل Windows Service بـ nssm
└── nssm.exe             ← مدمج في الـ zip
```

**البديل المرفوض**: Inno Setup installer — يتطلب أدوات build إضافية ووقت أطول، مبرر للمستقبل.

---

## القرار 4: تسجيل Windows Service بـ nssm

**المختار**: `nssm` (Non-Sucking Service Manager) — أداة مجانية تُسجّل أي exe كـ Windows Service بأمر واحد:
```powershell
nssm install LaundryPOS "C:\Laundry\laundry.exe"
nssm set LaundryPOS AppRestartDelay 5000
nssm start LaundryPOS
```
يتضمن إعادة التشغيل التلقائي عند الفشل.

**البديل المرفوض**: `node-windows` npm package — يحتاج Node.js مثبتاً وهو ما نحاول تجنبه.

---

## القرار 5: قراءة dotenv في وضع pkg

**المشكلة**: `require('dotenv').config({ path: path.join(__dirname, '..', '.env') })` يقرأ من snapshot (داخل exe) — لن يجد `.env`.

**الحل**: استخدام `DATA_ROOT` من `paths.js`:
```js
require('dotenv').config({ path: path.join(DATA_ROOT, '.env') });
```
يجب أن يكون هذا أول شيء يُنفَّذ قبل أي `require` آخر.

---

## القرار 6: تعارض مع نظام التحديث (spec 004)

نظام التحديث في spec 004 يستخدم `ROOT` للكتابة والقراءة. بعد هذا التغيير:
- `DATA_DIR` (قراءة/كتابة) ← يستخدم `DATA_ROOT`
- `scripts/updater.ps1` يُستدعى بـ `path.join(DATA_ROOT, 'scripts', 'updater.ps1')`
- الـ zip المُنزَّل يُحفظ في `DATA_ROOT/data/`

لا تعارض — spec 004 لم يُنفَّذ بعد، وهذا القرار يُحدَّد قبل تنفيذه.

---

## ملاحظة: pkg وـ @whiskeysockets/baileys

مكتبة Baileys تستخدم ملفات native bindings. يجب اختبارها داخل الـ exe وقد تحتاج إدراجها كـ pkg asset أو استثناء معين في إعداد `pkg`.
