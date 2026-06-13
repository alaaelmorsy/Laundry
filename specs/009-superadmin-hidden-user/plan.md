# Implementation Plan: SuperAdmin Hidden User

**Branch**: `009-superadmin-hidden-user` | **Date**: 2026-06-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-superadmin-hidden-user/spec.md`

## Summary

إضافة حساب `superAdmin` مدمج في الكود (hardcoded) لا يظهر في شاشة المستخدمين، يدخل بكل الصلاحيات، وهو الوحيد الذي يملك صلاحية استعادة النظام. يتطلب تعديل 6 ملفات موجودة دون إضافة جداول أو ملفات جديدة.

## Technical Context

**Language/Version**: Node.js (CommonJS), Vanilla JS

**Primary Dependencies**: Express.js, jsonwebtoken, bcryptjs, mysql2

**Storage**: MySQL — لا تغييرات على المخطط

**Testing**: يدوي (لا framework)

**Target Platform**: Windows (on-premise)

**Project Type**: Web application (local server)

**Performance Goals**: معياري — لا متطلبات إضافية

**Constraints**: لا تغييرات على DB schema، الحل يعمل مع الكود الحالي دون كسر أي وظيفة

**Scale/Scope**: 6 ملفات، ~30 سطراً إجمالاً

## Constitution Check

| المبدأ | الحالة | الملاحظة |
|--------|--------|----------|
| I. Monolithic API (4-Step Checklist) | ✅ لا API جديد | التغيير في handlers موجودة فقط |
| II. Screen-Per-Page Frontend | ✅ | تعديل `settings.js` و `auth-guard.js` موجودان |
| III. MySQL-Only Data Layer | ✅ | لا تغييرات على DB schema |
| IV. Bilingual Arabic-First | ✅ | رسائل الخطأ بالعربية |
| V. Uniform Response Contract | ✅ | Guard يُعيد `{ success: false, message }` |
| VI. Saudi Compliance | ✅ غير ذي صلة | |
| VII. Single-Tenant On-Premise | ✅ | |

**Security Note**: إضافة guard في `systemRestore` handler يُصحح نقطة ضعف موثقة في Constitution § Tech Debt.

## Project Structure

### Documentation (this feature)

```text
specs/009-superadmin-hidden-user/
├── plan.md              # هذا الملف
├── research.md          # ✅ مكتمل
├── data-model.md        # ✅ مكتمل
├── quickstart.md        # ✅ مكتمل
└── tasks.md             # سيُنشأ بـ /speckit-tasks
```

### Source Code — الملفات المتأثرة

```text
server/index.js                  — تعديل /api/auth/login و /api/auth/me
server/middleware/auth.js        — لا تعديل (signUserToken يقبل أي object)
database/db.js                   — فلتر getAllUsers + حماية createUser + تصدير buildAllPermissions
server/invokeHandlers.js         — Guard في case 'systemRestore'
assets/auth-guard.js             — hasPermission يعامل superadmin كـ admin
screens/settings/settings.js    — إخفاء tabSystemRestore لغير superAdmin
```

## تفاصيل التنفيذ

### T1: `database/db.js`

**أ. تصدير `buildAllPermissions`**:
```javascript
// أضفها لقائمة module.exports
module.exports = { ..., buildAllPermissions };
```

**ب. فلتر `getAllUsers`**:
```javascript
async function getAllUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.password, u.password_plain, u.full_name, u.role, u.role_id,
            r.name AS role_name, u.is_active, u.created_at
     FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.username != 'superAdmin'
     ORDER BY u.id ASC`
  );
  return rows;
}
```

**ج. حماية `createUser`**:
```javascript
async function createUser(username, password, fullName, role, roleId) {
  if (username.toLowerCase() === 'superadmin') {
    throw new Error('اسم المستخدم محجوز');
  }
  // ... باقي الكود بلا تعديل
}
```

---

### T2: `server/index.js`

**أ. `/api/auth/login` — short-circuit قبل `db.findUser`**:

```javascript
// أضف بعد السطر: if (!username || !password) { ... }
if (String(username).trim() === 'superAdmin' && password === 'LearnTech') {
  const superUser = { id: 0, username: 'superAdmin', role: 'superadmin', role_id: null, full_name: 'Super Admin' };
  const token = signUserToken(superUser);
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  res.cookie('laundry_auth', token, { httpOnly: true, maxAge, sameSite: 'lax', path: '/', secure: req.secure || req.protocol === 'https' });
  return res.json({ success: true, user: { ...superUser, permissions: db.buildAllPermissions(true) } });
}
```

**ب. `/api/auth/me` — short-circuit قبل `db.getPermissionsForUser`**:

```javascript
// أضف في أول try block
if (req.user.role === 'superadmin') {
  return res.json({
    success: true,
    user: { id: 0, username: 'superAdmin', full_name: 'Super Admin', role: 'superadmin', role_id: null, permissions: db.buildAllPermissions(true) }
  });
}
```

---

### T3: `server/invokeHandlers.js`

تحقق من signature دالة `invoke` — الوسيط الثالث هو `req.user` (يُسمّى `reqUser` أو `user` أو ما شابه).

```javascript
case 'systemRestore': {
  try {
    if (!reqUser || reqUser.role !== 'superadmin') {
      return { success: false, message: 'غير مصرح — هذه الصلاحية للمشرف العام فقط' };
    }
    const result = await db.systemRestore(payload || {});
    return result;
  } catch (err) {
    return { success: false, message: err.message };
  }
}
```

---

### T4: `assets/auth-guard.js`

```javascript
window.hasPermission = function (key) {
  const u = window.__currentUser;
  if (!u) return false;
  if (u.role === 'admin' || u.role === 'superadmin') return true;
  return !!(u.permissions && u.permissions[key]);
};
```

---

### T5: `screens/settings/settings.js`

بعد تعريف `tabSystemRestore` و `panelSystemRestore` (السطر ~9-17)، وقبل نهاية `DOMContentLoaded`، أضف:

```javascript
window.addEventListener('userReady', (e) => {
  const user = e.detail;
  if (!user || user.role !== 'superadmin') {
    if (tabSystemRestore) tabSystemRestore.style.display = 'none';
    if (panelSystemRestore) panelSystemRestore.style.display = 'none';
  }
});
```

**تحذير**: `userReady` قد يُطلق بعد DOMContentLoaded — تأكد أن `tabSystemRestore` متغير في scope الخارجي لـ event listener.

## Complexity Tracking

لا انتهاكات للـ Constitution — لا يحتاج تبرير.
