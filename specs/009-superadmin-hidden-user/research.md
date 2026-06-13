# Research: SuperAdmin Hidden User

## قرارات التصميم

### 1. أين يُخزَّن حساب superAdmin؟

**القرار**: مدمج في الكود (hardcoded) في `server/index.js` داخل handler تسجيل الدخول — لا يُخزَّن في قاعدة البيانات نهائياً.

**المبرر**: تخزينه في DB يجعله قابلاً للاكتشاف عبر `getAllUsers` حتى لو أضفنا فلتراً، وقابل للحذف أو التعديل من الواجهة. الكود أكثر أماناً للأسرار الثابتة.

**البدائل المرفوضة**: تخزينه في DB مع علامة `is_hidden` — أعقد ولا يضيف أماناً حقيقياً.

---

### 2. كيف يُعطى superAdmin كل الصلاحيات؟

**القرار**: `role: 'superadmin'` في JWT. `auth-guard.js` يعدَّل ليعامل `superadmin` مثل `admin` في `hasPermission()`. كذلك `/api/auth/me` يُعدَّل ليُعيد `buildAllPermissions(true)` عندما `role === 'superadmin'` دون الاستعلام من DB.

**المبرر**: النظام الحالي يعامل `role === 'admin'` كبوابة "كل الصلاحيات" في موضعين: `auth-guard.js:25` وفي `getPermissionsForUser` (db.js:344). إضافة `superadmin` لنفس المنطق بسيطة وآمنة.

---

### 3. إخفاء superAdmin من شاشة المستخدمين

**القرار**: إضافة `WHERE username != 'superAdmin'` في دالة `getAllUsers` في `database/db.js`. وكذلك رفض `createUser` إذا كان الاسم `superAdmin`.

**المبرر**: الفلتر في DB أضمن من الفلتر في الواجهة — حتى لو تجاوز أحدهم الواجهة واستدعى API مباشرة.

---

### 4. حصرية صلاحية استعادة النظام

**القرار**: 
- **الخادم**: في `server/invokeHandlers.js`، case `systemRestore` يُضاف check: `if (reqUser.role !== 'superadmin') return { success: false, message: 'غير مصرح' }`.
- **الواجهة**: في `screens/settings/settings.js`، عند تحميل الصفحة، إذا `window.__currentUser.role !== 'superadmin'` يُخفى `tabSystemRestore` ويُخفى `panelSystemRestore`. لا يُضاف مفتاح permission جديد لأن هذا لا يظهر في واجهة إدارة الصلاحيات أصلاً.

**المبرر**: التحقق من الخادم ضروري (لأن `server/invokeHandlers.js` لا يتحقق من الصلاحيات حالياً — نقطة ضعف موثقة في constitution). إخفاء الواجهة يُحسّن تجربة المستخدم.

**البدائل المرفوضة**: إضافة `reset_system` لـ `ALL_PERMISSION_KEYS` — يعني ظهوره في واجهة إدارة الأدوار مما يكشف وجوده.

---

### 5. الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `server/index.js` | Short-circuit في `/api/auth/login` و `/api/auth/me` |
| `server/middleware/auth.js` | `signUserToken` يقبل `id: 0` لـ superAdmin |
| `database/db.js` | فلتر `getAllUsers` + رفض `createUser` لـ superAdmin |
| `server/invokeHandlers.js` | Guard في case `systemRestore` |
| `assets/auth-guard.js` | `hasPermission` يعامل `superadmin` كـ `admin` |
| `screens/settings/settings.js` | إخفاء tab استعادة النظام لغير superAdmin |
