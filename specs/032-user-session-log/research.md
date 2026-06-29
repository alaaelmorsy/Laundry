# Research: سجل جلسات المستخدمين

**Date**: 2026-06-29

## 1. تكامل JWT مع session_id

**Decision**: إضافة `session_id` كحقل إضافي في payload الـ JWT بدون تغيير منطق `verifyToken`.

**Rationale**: `jwt.verify()` يُعيد كل الحقول الموجودة — أي حقل جديد يظهر تلقائياً في `req.user`. JWT القديمة (بدون `session_id`) تظل صالحة لأن `req.user.session_id` سيكون `undefined` وليس خطأً.

**How**: تعديل `signUserToken(user)` → `signUserToken(user, sessionId)` وإضافة `session_id: sessionId || null` للـ payload.

---

## 2. معالجة SIGTERM/SIGINT في بيئة NSSM

**Decision**: استخدام `process.on('SIGTERM')` و`process.on('SIGINT')` لإغلاق الجلسات قبل إيقاف السيرفر.

**Rationale**: NSSM يُرسل SIGTERM قبل إيقاف الخدمة — Node.js يلتقطه. لا يجوز استخدام `process.exit()` داخل handlers لأن NSSM watchdog يُعيد التشغيل. الحل: إغلاق الجلسات ثم السماح للـ process بالخروج الطبيعي.

**Pattern**:
```js
async function gracefulShutdown(signal) {
  await db.closeAllActiveSessions('server_shutdown');
  process.exit(0); // مسموح هنا لأنه في shutdown handler وليس request handler
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
```

**SIGKILL**: لا يمكن التقاطه — يُعالَج في startup بـ `closeAllActiveSessions('abnormal')`.

---

## 3. Heartbeat من المتصفح

**Decision**: `setInterval` كل 120,000ms (دقيقتان) يستدعي `api.heartbeat({ sessionId })`.

**Rationale**: الفجوة القصوى بين آخر heartbeat ووقت الإغلاق الفعلي = دقيقتان — مقبول حسب SC-004.

**إغلاق نافذة المتصفح**: استخدام `navigator.sendBeacon('/api/auth/logout-beacon', ...)` كـ best-effort في حدث `beforeunload`. لو فشل → يُعالَج في startup. لا يُعتمد عليه كضمان.

---

## 4. التصدير من السيرفر

**Decision**: اتباع نمط `exportExpenses` / `exportCustomers` الموجود في `exportsService.js`.

**Rationale**: النمط راسخ — XLSX للـ Excel، htmlToPdfBuffer للـ PDF، RTL مدعوم، Cairo fonts محمَّلة.

**Route**: `/api/export/sessions?type=excel&userId=&from=&to=` مع `authMiddleware` + تحقق admin.

---

## 5. Startup cleanup — إغلاق الجلسات غير الطبيعية

**Decision**: عند بدء تشغيل السيرفر، إغلاق **كل** الجلسات ذات `status='active'` فوراً بـ `logout_type='abnormal'` و`logout_at = last_seen_at` (أو `login_at` إن كانت NULL).

**Rationale**: في بيئة single-machine مع NSSM، أي جلسة نشطة عند startup هي بالضرورة من تشغيل سابق. المتصفح فقد الاتصال وسيطلب تسجيل دخول جديد. لا خطر من إغلاق جلسة "حية" لأنها مستحيلة في هذا السياق.

**SQL**:
```sql
UPDATE user_sessions
SET status = 'closed',
    logout_type = 'abnormal',
    logout_at = COALESCE(last_seen_at, login_at)
WHERE status = 'active'
```

---

## 6. عرض الوقت بنظام 12 ساعة

**Decision**: تنسيق وقت بـ JavaScript في المتصفح باستخدام `toLocaleTimeString('ar-SA', { hour12: true })` + `toLocaleDateString('ar-SA')`.

**Rationale**: متوافق مع المتصفحات ويُنتج "ص/م" تلقائياً بالعربية. لا حاجة لـ library خارجية.

**في التصدير**: تنسيق الوقت في السيرفر بـ `date.toLocaleString('ar-SA', { hour12: true })`.
