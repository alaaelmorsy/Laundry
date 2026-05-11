# Feature 02 — Users Management

## Goal
إدارة حسابات موظفي المغسلة (admin/cashier) مع إمكانية التفعيل/التعطيل وإعادة تعيين كلمات المرور.

## Entry points
- UI: `screens/users/users.html|js|css`
- API (`/api/invoke` methods): `getUsers`, `createUser`, `updateUser`, `toggleUserStatus`, `deleteUser`.

## Inputs
- `createUser`: `{ username, password, fullName, role }`
- `updateUser`: `{ id, username, password?, fullName, role }` (كلمة المرور اختيارية — إن تُرِكت فارغة لا تُحدَّث)
- `toggleUserStatus`: `{ id, isActive: 0|1 }`
- `deleteUser`: `{ id }`

## Outputs
- `getUsers` → `{ success, users: [{ id, username, full_name, role, is_active, created_at, password: '' }] }` (كلمة المرور تُصفَّر في الاستجابة).
- عمليات الحفظ → `{ success, id? }` أو `{ success:false, message }`.

## Rules
- `username UNIQUE` — تكرار يُرجع `"اسم المستخدم موجود بالفعل"` (`ER_DUP_ENTRY`).
- `role` ∈ `{admin, cashier}`.
- bcrypt hash قبل الحفظ (10 rounds).
- Seed: يُنشأ `admin/admin123/admin` إذا لم يوجد.

## Edge cases
- حذف المستخدم الوحيد أو النفس: ليس محميًا برمجيًا — مسؤولية الواجهة.
- كلمة مرور فارغة عند التعديل تعني "لا تغيير".
- عدم السماح بالدخول لمستخدم معطّل (`is_active=0`).

## Permissions
- يجب أن تُظهر الواجهة هذه الشاشة فقط لـ `role=admin` (حراسة UI).
