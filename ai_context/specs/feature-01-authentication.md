# Feature 01 — Authentication (Login / Session / Logout)

## Goal
تمكين المستخدمين المصرّح لهم من الدخول إلى النظام وحماية جميع المسارات الأخرى بوسيط JWT عبر cookie آمنة.

## Entry points
- UI: `screens/login/login.html` + `login.js` + `assets/auth-guard.js`
- API:
  - `POST /api/auth/login` (rate-limited)
  - `POST /api/auth/logout`
  - `GET /api/auth/me` (محمي)

## Inputs
- `username: string` (trim)
- `password: string`

## Outputs
- Success: cookie `laundry_auth` (JWT) + `{ success: true, user: { id, username, full_name, role } }`.
- Failure: `{ success: false, message }` (عربية).

## Rules
- `users.is_active = 1` فقط.
- كلمات المرور `bcryptjs` rounds=10؛ القديمة plain تُرقّى تلقائيًا بعد نجاح المقارنة.
- JWT: secret من `JWT_SECRET` (≥16 حرف في production)، `expiresIn=7d`.
- cookie: `httpOnly`, `sameSite=lax`, `path=/`, `maxAge=7d`, `secure` في production.
- Rate limit: 50 طلب / 15 دقيقة لـ `/api/auth/login`.

## Edge cases
- حقول فارغة → "أدخل اسم المستخدم وكلمة المرور".
- بيانات خاطئة أو مستخدم معطّل → "اسم المستخدم أو كلمة المرور غير صحيحة".
- فشل الاتصال بالقاعدة → "خطأ في الاتصال بقاعدة البيانات" (500-level logic).
- انتهاء الجلسة → `GET /api/auth/me` يرجع 401 `"انتهت الجلسة"`.
- غياب الكوكي → 401 `"غير مصرح"`.

## Related code
- `server/middleware/auth.js`, `server/index.js` (routes)، `database/db.js#findUser`.
