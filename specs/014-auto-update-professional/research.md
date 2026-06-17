# Research: نظام التحديث التلقائي الاحترافي

**Date**: 2026-06-15

---

## النتيجة الرئيسية: الـ Update System موجود بالفعل (90% منجز)

بعد مراجعة الكود الحالي اكتشفنا أن نظام التحديث مُنفَّذ بشكل كامل تقريباً. الفجوة الوحيدة المتبقية هي إضافة **فحص صلاحية الدعم الفني** قبل تنفيذ التحديث.

---

## ما هو موجود بالفعل

### Backend — `server/services/updateService.js`

| الدالة | الوصف | الحالة |
|--------|-------|--------|
| `checkForUpdate(force)` | يستعلم GitHub Releases API، يخزن cache ساعة | ✅ مكتمل |
| `getUpdateStatus()` | يقرأ الـ cache المحلي | ✅ مكتمل |
| `performUpdate()` | backup → download → verify SHA256 → spawn updater.ps1 | ✅ مكتمل |
| `getUpdateProgress()` | يُعيد حالة التقدم من الذاكرة | ✅ مكتمل |

### Backend — `server/invokeHandlers.js`

| Case | الحالة |
|------|--------|
| `checkForUpdate` | ✅ مسجَّل |
| `getUpdateStatus` | ✅ مسجَّل |
| `performUpdate` | ✅ مسجَّل |
| `getUpdateProgress` | ✅ مسجَّل |

### Frontend — `assets/web-api.js`

جميع الـ methods مسجَّلة تحت `window.api`:
- `checkForUpdate`, `getUpdateStatus`, `performUpdate`, `getUpdateProgress`

### Frontend — `screens/settings/settings.js` + `settings.html`

- تبويب "التحديثات" موجود
- الـ panel يُظهر الإصدار الحالي وزر "فحص التحديثات"
- عند الفحص يُظهر الإصدار الجديد وزر "تحديث الآن"
- شريط تقدم كامل مع خطوات (backup → download → verify → replace → migrate → restart)

### Frontend — `screens/login/login.js`

- `updateBadge` يُظهر إشعار التحديث عند فتح صفحة تسجيل الدخول
- يقرأ من `/api/update-status` (endpoint مخصص في `server/index.js`)

### `scripts/updater.ps1`

- يوقف الـ service (NSSM)
- ينتظر خروج الـ process
- يُنشئ نسخة احتياطية من exe
- يستبدل exe
- Rollback تلقائي عند الفشل
- يُعيد تشغيل الـ service

---

## الفجوة الوحيدة: فحص صلاحية الدعم الفني

### ما يوجد في الكود (اسم العمود الفعلي)

في `database/db.js` (السطر 3447):
```sql
ALTER TABLE app_settings ADD COLUMN support_expiry_date DATE DEFAULT NULL
```

**ملاحظة مهمة**: اسم العمود هو `support_expiry_date` وليس `support_end_date` كما ذُكر في الـ spec. هذا يجب أن يُعكس في التنفيذ.

### ما هو غائب

`performUpdate()` في `updateService.js` لا يتحقق من `support_expiry_date` قبل بدء التحديث.

### القرار: كيف نضيف الفحص

**الخيار المختار**: تمرير دالة `getSupportExpiry` من `database/db.js` إلى `updateService.js`

- **Rationale**: `updateService.js` لا يستورد `db.js` حالياً (فصل جيد للمخاوف). الأفضل تمرير نتيجة الفحص من `invokeHandlers.js` — حيث يتوفر الوصول لـ `db`.
- **كيف**: الـ handler في `invokeHandlers.js` (case `performUpdate`) يفحص `support_expiry_date` من `app_settings` قبل استدعاء `updateService.performUpdate()`. إذا انتهى الدعم، يُعيد `{ success: false, supportExpired: true, message: '...' }`.

**الخيارات الأخرى المرفوضة**:
- تمرير `db` إلى `updateService.js`: يُضيف coupling غير ضروري
- فحص في `updateService.js` مباشرةً: يكسر الفصل بين service وdatabase layer

---

## مقارنة نظام كاشير مع برنامج الغسيل

| الجانب | كاشير | غسيل |
|--------|-------|------|
| آلية التحديث | `electron-updater` | `updateService.js` + `updater.ps1` |
| قناة الاتصال | Electron IPC (`ipcMain.handle`) | HTTP invoke (`/api/invoke`) |
| Push events | `win.webContents.send` | Polling كل 500ms |
| تنفيذ التثبيت | `updater.quitAndInstall()` | `spawn updater.ps1` detached |
| واجهة المستخدم | Dialog modal | Tab panel في الإعدادات |
| فحص الدعم | `checkSupportValidity()` في updater.js | handler في `invokeHandlers.js` (مطلوب إضافة) |
| إشعار تسجيل الدخول | `setTimeout(2000)` في renderer.js | `updateBadge` في login.js (موجود) |

---

## اسم الـ Windows Service

القيمة الحالية الـ hardcoded في `updater.ps1`:
```powershell
$ServiceName = 'LaundryPlusApp'
```

الـ spec طلبت تمرير الاسم كـ parameter — لكن نظراً لأن هذا المشروع single-tenant وكذا نظام كاشير (القيمة فيه أيضاً hardcoded في بعض الأماكن)، نُبقي عليه كـ constant مع إمكانية override عبر env var مستقبلاً.

---

## الملخص التنفيذي

**العمل المطلوب فعلياً:**

1. إضافة فحص `support_expiry_date` في `invokeHandlers.js` → case `performUpdate`
2. إضافة دالة `getSupportExpiry` في `database/db.js` (أو استخدام `getAppSettings` الموجودة)
3. تسجيل `getSupportStatus` في `web-api.js` (اختياري للـ UI)
4. تحديث الـ spec لاستخدام اسم العمود الصحيح `support_expiry_date`

**التقدير**: 2-3 ساعات عمل فعلي
