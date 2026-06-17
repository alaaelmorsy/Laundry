# Research: نظام التحديث عبر GitHub

**Feature**: 015-github-update-flow | **Date**: 2026-06-15

## ما هو موجود حالياً (الكود الحالي)

### `server/services/updateService.js`

| دالة | الحالة | الاستخدام الجديد |
|------|--------|-----------------|
| `checkForUpdate(force)` | ✅ موجودة | تُبقى كما هي |
| `downloadWithProgress(url, destPath, onProgress)` | ✅ موجودة | تُستخدم داخل `downloadUpdate()` الجديدة |
| `getProgress()` / `setProgress()` / `clearProgress()` | ✅ موجودة | تُبقى كما هي |
| `getUpdateProgress()` | ✅ موجودة | تُبقى كما هي — الـ frontend يستعملها للـ polling |
| `performUpdate()` | ⚠️ موجودة | **تُحذف** أو تُبقى للـ backward compat |
| `createBackup()` | ⚠️ موجودة | **لا تُستخدم** في التدفق الجديد |
| `verifySha256()` | ⚠️ موجودة | **لا تُستخدم** في التدفق الجديد |

**دالتان جديدتان مطلوبتان:**
- `downloadUpdate()` — تبدأ التحميل في الخلفية (non-blocking)، تخزّن التقدم في `updateProgress`، تحفظ مسار الملف عند الانتهاء
- `installUpdate()` — تطلق `updater.ps1` وتنهي العملية

### `server/invokeHandlers.js`

| case | الحالة |
|------|--------|
| `checkForUpdate` | ✅ موجود — يُبقى |
| `getUpdateStatus` | ✅ موجود — يُبقى |
| `getUpdateProgress` | ✅ موجود — يُبقى |
| `getSupportStatus` | ✅ موجود — يُبقى |
| `performUpdate` | ⚠️ موجود — **يُحذف** من التدفق الجديد |
| `downloadUpdate` | ❌ جديد — يُضاف |
| `installUpdate` | ❌ جديد — يُضاف |

### `assets/web-api.js`

الموجود (السطر 407-411):
```js
checkForUpdate:    (payload) => invoke('checkForUpdate', payload || {}),
getUpdateStatus:   ()        => invoke('getUpdateStatus'),
performUpdate:     ()        => invoke('performUpdate'),
getUpdateProgress: ()        => invoke('getUpdateProgress'),
getSupportStatus:  ()        => invoke('getSupportStatus'),
```

**يُضاف:**
```js
downloadUpdate:    ()        => invoke('downloadUpdate'),
installUpdate:     ()        => invoke('installUpdate'),
```

## قرارات التصميم

### Q1: كيف يعمل التحميل في الخلفية؟

**Decision**: `downloadUpdate` handler يُطلق التحميل بـ `setImmediate(async () => { ... })` ويعود فوراً بـ `{ success: true, started: true }`. التقدم متاح عبر `getUpdateProgress` polling.

**Rationale**: يتوافق مع نمط `performUpdate` الحالي الذي يبدأ عمليات في الخلفية. `setImmediate` هو النمط المعتمد في هذا المشروع للـ fire-and-forget.

**Alternatives considered**: استخدام Worker threads — مرفوض لأنه تعقيد غير ضروري.

### Q2: كيف يعرف الـ frontend أن التحميل اكتمل؟

**Decision**: `getUpdateProgress` يُعيد `{ inProgress, percent, downloadedBytes, totalBytes }`. عندما يصبح `inProgress: false` و`percent` كان `100` قبله، يعرف الـ frontend أن التحميل انتهى. نُضيف حقل `downloadDone: true` + `downloadedFilePath` إلى حالة التقدم عند الانتهاء.

**Rationale**: لا تغيير في بنية الـ polling — نُعيد استخدام `getUpdateProgress` الموجودة.

### Q3: ماذا يفعل `installUpdate`؟

**Decision**: يُطلق `updater.ps1` بنفس الطريقة الموجودة في نهاية `performUpdate()`:
```js
spawn('cmd.exe', ['/d', '/c', psLine], { detached: true, stdio: 'ignore', windowsHide: true })
child.unref()
setTimeout(() => process.exit(0), 1500)
```

يقرأ مسار الملف المُنزَّل من حالة `updateProgress.downloadedFilePath`.

**Rationale**: نفس الكود الذي يعمل حالياً — لا داعي لتغييره.

### Q4: هل نتحقق من الدعم في `checkForUpdate` أم في `downloadUpdate`؟

**Decision**: نتحقق في **كلاهما**:
- `checkForUpdate` handler: يفحص الدعم أولاً قبل الاتصال بـ GitHub — إذا انتهى يُعيد `{ success: false, supportExpired: true }`
- `downloadUpdate` handler: يفحص الدعم أيضاً كطبقة أمان ثانية

**Rationale**: الـ spec يقول "عند الضغط على زر تحديث يتحقق من تاريخ الدعم الفني أولاً". الزر يُطلق `checkForUpdate` — لذا الفحص يكون هناك أساساً. الفحص في `downloadUpdate` هو ضمان إضافي.

### Q5: حالة `updateProgress` — ماذا نُضيف؟

نُضيف حقلين جديدين للـ in-memory state:
```js
let updateProgress = {
  // ... الحقول الموجودة ...
  downloadDone: false,        // true عند اكتمال التحميل
  downloadedFilePath: null,   // المسار الكامل للـ .exe المُنزَّل
};
```

## ملخص التغييرات

| الملف | نوع التغيير | التفاصيل |
|-------|------------|---------|
| `updateService.js` | إضافة دالتين | `downloadUpdate()` + `installUpdate()` + حقلان في `updateProgress` |
| `invokeHandlers.js` | إضافة + تعديل | cases جديدة + تعديل `checkForUpdate` case لفحص الدعم |
| `web-api.js` | إضافة سطرين | `downloadUpdate` + `installUpdate` |
| `settings.html` | تبسيط | حذف `#updateStepsList` div، الإبقاء على progress bar + MB display |
| `settings.js` | إعادة كتابة `initUpdatePanel()` | تدفق جديد 3 مراحل بدلاً من التدفق الحالي المعقد |
