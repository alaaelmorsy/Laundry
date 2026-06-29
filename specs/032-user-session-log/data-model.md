# Data Model: سجل جلسات المستخدمين

## جدول: user_sessions

```sql
CREATE TABLE IF NOT EXISTS user_sessions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  login_at      DATETIME     NOT NULL,
  logout_at     DATETIME     NULL,
  last_seen_at  DATETIME     NULL,
  status        ENUM('active', 'closed') NOT NULL DEFAULT 'active',
  logout_type   ENUM(
    'manual',
    'browser_closed',
    'server_shutdown',
    'abnormal',
    'jwt_expired'
  ) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_us_user_id   (user_id),
  INDEX idx_us_login_at  (login_at),
  INDEX idx_us_status    (status),
  INDEX idx_us_user_date (user_id, login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> لا `FOREIGN KEY` على `user_id` — تجنباً لمشاكل حذف المستخدمين في المستقبل.

---

## الحقول

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | INT PK | معرِّف الجلسة الفريد — يُستخدم كـ `session_id` في JWT |
| `user_id` | INT | معرِّف المستخدم من جدول `users` |
| `login_at` | DATETIME | وقت تسجيل الدخول الناجح |
| `logout_at` | DATETIME NULL | وقت الخروج — NULL إذا الجلسة نشطة أو أُغلقت بـ `last_seen_at` |
| `last_seen_at` | DATETIME NULL | آخر heartbeat وصل من المتصفح (يُحدَّث كل دقيقتين) |
| `status` | ENUM | `active` = نشطة، `closed` = مغلقة |
| `logout_type` | ENUM NULL | سبب الخروج (انظر القيم أدناه) |
| `created_at` | DATETIME | وقت إنشاء الصف (= login_at عملياً) |
| `updated_at` | DATETIME | آخر تعديل على الصف |

---

## قيم logout_type

| القيمة | المعنى | متى تُضبَط |
|--------|--------|-----------|
| `manual` | خروج يدوي | المستخدم ضغط "تسجيل خروج" |
| `browser_closed` | إغلاق المتصفح | `navigator.sendBeacon` نجح عند `beforeunload` |
| `server_shutdown` | إغلاق نظيف للسيرفر | SIGTERM/SIGINT التُقِط |
| `abnormal` | إغلاق غير طبيعي | عند startup — جلسات نشطة من تشغيل سابق |
| `jwt_expired` | انتهاء صلاحية الجلسة | رفض 401 من `authMiddleware` |

---

## دالة حساب المدة (تطبيق-side)

```
duration = logout_at ?? last_seen_at ?? NOW()  -  login_at
عرض: "Xس Yد" (ساعات ودقائق)
```

---

## التغييرات على الجداول الموجودة

لا تغييرات على أي جدول موجود. الميزة تضيف جدولاً جديداً فقط.

**تعديل منطقي فقط** (لا DDL):
- `signUserToken()` يستقبل `sessionId` ويضيفه للـ JWT payload كـ `session_id`
- JWT القديمة بدون `session_id` تظل صالحة — الـ middleware يتعامل مع `undefined` بأمان
