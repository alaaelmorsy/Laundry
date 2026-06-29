# Implementation Plan: سجل جلسات المستخدمين

**Branch**: `032-user-session-log` | **Date**: 2026-06-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/032-user-session-log/spec.md`

## Summary

إضافة نظام تتبع جلسات المستخدمين: تسجيل وقت الدخول/الخروج تلقائياً مع نوع الخروج، heartbeat كل دقيقتين للكشف عن الإغلاق غير الطبيعي، إغلاق جميع الجلسات النشطة عند startup، وشاشة عرض داخل `screens/users/` للمدير مع تصدير Excel/PDF احترافي من السيرفر.

## Technical Context

**Language/Version**: Node.js 20 (CommonJS), Vanilla JS (no framework)

**Backend**: Express.js + `mysql2/promise` — no ORM

**Frontend**: Vanilla JS + Tailwind CSS — no bundler, no TypeScript

**Storage**: MySQL/MariaDB — InnoDB, utf8mb4

**MySQL Compatibility**: MySQL 5.7 — جميع الاستعلامات متوافقة مع MySQL 5.7. لا window functions، لا CTEs، لا LATERAL.

**Target Platform**: Windows 10/11 — bundled as `.exe` via `@yao-pkg/pkg`

**Deployment**: Windows Service (NSSM) — single-tenant on-premise

**API Pattern**: `POST /api/invoke` → `invokeHandlers.js` → `db.js`

**Export Pattern**: `/api/export/sessions` في `server/index.js` → `services/exportsService.js` (نفس نمط `exportExpenses`, `exportCustomers`)

**Screen Pattern**: تُضاف الجلسات داخل `screens/users/` كقسم منفصل وليس شاشة مستقلة

**Constraints**: No ES modules server-side. No shared components across screens.

**نقاط التكامل الموجودة:**
- `server/middleware/auth.js` → `signUserToken()` يحتاج `session_id` كمعامل إضافي
- `server/index.js` → `/api/auth/login` و `/api/auth/logout` نقطتا التسجيل الحالي
- `server/services/exportsService.js` → نمط التصدير المُتّبع (XLSX + htmlToPdfBuffer)
- `screens/users/users.{html,js,css}` → الشاشة الموجودة التي تُضاف إليها الجلسات

## Constitution Check

### Priority Order Compliance

| Priority | Concern | Impact on This Feature |
|----------|---------|----------------------|
| 1 | Data integrity | جدول `user_sessions` append-mostly؛ لا حذف، لا تعديل على بيانات موجودة. `closeAllActiveSessions` يُحدِّث فقط الجلسات النشطة |
| 2 | ZATCA compliance | N/A — لا تأثير على جدول `orders` أو أي حقل ZATCA |
| 3 | Workflow stability | تعديل `/api/auth/login` و `/api/auth/logout` بـ INSERT/UPDATE فقط، المنطق الأصلي يبقى كما هو |
| 4 | Backward compatibility | `session_id` يُضاف للـ JWT كحقل اختياري — الـ `verifyToken` الحالي يتجاهل الحقول الإضافية، JWT القديمة تظل صالحة |
| 5 | Correct business behavior | الـ heartbeat يضمن دقة `logout_at` بحدود دقيقتين عند الإغلاق غير الطبيعي |

### 4-Step API Checklist

| Method Name | db.js | invokeHandlers.js | web-api.js | Screen JS |
|-------------|-------|-------------------|------------|-----------|
| `getUserSessions` | ☐ | ☐ | ☐ | ☐ |
| `heartbeat` | ☐ | ☐ | ☐ | ☐ |

> ملاحظة: التصدير يسلك مسار `/api/export/sessions` وليس `/api/invoke` — هذا استثناء مسموح صريح في المعمارية لمسارات `export/*`.

### Forbidden Changes Proximity

| # | Forbidden Area | Proximity | Mitigation |
|---|---------------|-----------|------------|
| 4 | REST routes per feature | `/api/export/sessions` مسار جديد | مسموح — `export/*` استثناء صريح في المعمارية |
| لا غيرها | — | بعيد عن ZATCA والطباعة والـ POS | — |

### MySQL 5.7 Compatibility

- [x] جميع الاستعلامات تستخدم `WHERE`, `ORDER BY`, `LIMIT/OFFSET`, `UPDATE` فقط
- [x] لا window functions
- [x] لا CTEs أو LATERAL أو JSON_TABLE

## Feature Impact Checklist

| Area | Affected? | What Changes / What to Verify |
|------|-----------|-------------------------------|
| **Database** | ☑ Yes | جدول جديد `user_sessions` — migration additive، try/catch، MySQL 5.7، مسجَّل في `db.initialize()` |
| **POS Checkout** | ☐ No | لا تأثير على `createOrder` أو أي منطق POS |
| **ZATCA** | ☐ No | لا تعديل على `orders` أو ZATCA columns |
| **Subscriptions** | ☐ No | لا تأثير |
| **Payments** | ☐ No | لا تأثير على formula أو mixed payment |
| **Printing** | ☐ No | لا تأثير على الطباعة الحرارية |
| **Backward Compatibility** | ☑ Yes | JWT الجديد يحتوي `session_id` — متوافق مع الـ JWT القديمة؛ الـ `verifyToken` يتجاهل الحقول الإضافية |

## Project Structure

### Documentation (this feature)

```text
specs/032-user-session-log/
├── plan.md              ← هذا الملف
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── quickstart.md        ← Phase 1
└── tasks.md             ← /speckit-tasks
```

### Source Code (this feature)

```text
database/db.js
  ├── createUserSessionsMigration()     ← migration جديد (CREATE TABLE + indexes)
  ├── createUserSession(userId)         ← INSERT → returns { sessionId }
  ├── closeUserSession(sessionId, logoutType, logoutAt?)
  ├── heartbeatUserSession(sessionId)   ← UPDATE last_seen_at = NOW()
  ├── closeAllActiveSessions(logoutType) ← عند startup وSIGTERM
  └── getUserSessions(filters)          ← للعرض والتصدير (فلترة + pagination)

server/middleware/auth.js
  └── signUserToken(user, sessionId)    ← إضافة session_id للـ payload

server/index.js
  ├── /api/auth/login    ← createUserSession() ثم إضافة session_id للـ JWT
  ├── /api/auth/logout   ← closeUserSession(session_id, 'manual')
  ├── /api/export/sessions  ← endpoint جديد → exportsService.exportSessions()
  ├── startup            ← closeAllActiveSessions('abnormal') قبل بدء الاستماع
  └── process.on('SIGTERM'/'SIGINT') ← closeAllActiveSessions('server_shutdown')

server/invokeHandlers.js
  ├── case 'getUserSessions'  ← جلب البيانات بفلاتر + pagination
  └── case 'heartbeat'        ← UPDATE last_seen_at

server/services/exportsService.js
  └── exportSessions(type, filters)  ← Excel + PDF بنمط موحَّد مع باقي التصديرات

assets/web-api.js
  ├── api.getUserSessions = (p) => invoke('getUserSessions', p)
  └── api.heartbeat = (p) => invoke('heartbeat', p)

screens/users/users.html  ← إضافة تبويب/قسم "سجل الجلسات" + زرَّا التصدير
screens/users/users.js    ← جدول الجلسات + فلتر + pagination + heartbeat setInterval + تصدير
screens/users/users.css   ← تنسيق جدول الجلسات وبطاقة الفلاتر
```

## Complexity Tracking

لا انتهاكات للـ Constitution تستوجب تبريراً — الميزة تتبع النمط الموجود بالكامل.
