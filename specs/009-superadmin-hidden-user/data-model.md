# Data Model: SuperAdmin Hidden User

## لا تغييرات على قاعدة البيانات

هذه الميزة لا تُضيف جداول أو أعمدة جديدة. superAdmin حساب مدمج في الكود وليس كياناً في DB.

## التغييرات على نموذج البيانات المنطقي

### JWT Payload — superAdmin

```
{
  id: 0,
  username: "superAdmin",
  role: "superadmin",
  role_id: null,
  full_name: "Super Admin"
}
```

- `id: 0` — قيمة مستحيلة في DB (AUTO_INCREMENT يبدأ من 1) تُمثّل حساب النظام
- `role: "superadmin"` — قيمة جديدة مميّزة (الحاليتان هما `admin` و `cashier`)

### كائن الـ User المُعاد في `/api/auth/me` و `/api/auth/login`

```javascript
// superAdmin user object
{
  id: 0,
  username: "superAdmin",
  full_name: "Super Admin",
  role: "superadmin",
  role_id: null,
  permissions: { /* جميع المفاتيح = true */ }
}
```

## القيود والإجراءات

- `getAllUsers()` في `db.js`: `WHERE username != 'superAdmin'`
- `createUser()` في `db.js`: رفض إذا `username === 'superAdmin'` (مقارنة case-insensitive)
- `systemRestore` handler: رفض إذا `reqUser.role !== 'superadmin'`
- `hasPermission()` في `auth-guard.js`: يُضيف `|| u.role === 'superadmin'` لمنح كل الصلاحيات
