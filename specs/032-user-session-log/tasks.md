# Tasks: سجل جلسات المستخدمين

**Input**: Design documents from `/specs/032-user-session-log/`

**References**: [spec.md](spec.md) | [plan.md](plan.md) | [data-model.md](data-model.md) | [research.md](research.md) | [quickstart.md](quickstart.md)

---

## Phase 1: Setup

- [x] T001 إنشاء migration function `createUserSessionsMigration()` في `database/db.js`
- [x] T002 تسجيل `createUserSessionsMigration` في `db.initialize()`
- [x] T003 إضافة دالة `createUserSession(userId)` في `database/db.js`
- [x] T004 [P] إضافة دالة `closeUserSession` في `database/db.js`
- [x] T005 [P] إضافة دالة `heartbeatUserSession` في `database/db.js`
- [x] T006 [P] إضافة دالة `closeAllActiveSessions` في `database/db.js`

---

## Phase 2: Foundational

- [x] T007 تعديل `signUserToken(user, sessionId)` في `server/middleware/auth.js`
- [x] T008 تعديل `/api/auth/login` في `server/index.js`
- [x] T009 تعديل `/api/auth/logout` في `server/index.js`
- [x] T010 إضافة graceful shutdown في `server/index.js`
- [x] T011 إضافة startup cleanup في `server/index.js`
- [x] T012 تعديل `authMiddleware` في `server/middleware/auth.js`

---

## Phase 3: US1 — عرض سجل الجلسات

- [x] T013 [US1] إضافة دالة `getUserSessions(filters)` في `database/db.js`
- [x] T014 [US1] إضافة `case 'getUserSessions':` في `server/invokeHandlers.js`
- [x] T015 [US1] إضافة `api.getUserSessions` في `assets/web-api.js`
- [x] T016 [US1] إضافة قسم "سجل الجلسات" في `screens/users/users.html`
- [x] T017 [US1] إضافة منطق عرض الجلسات في `screens/users/users.js`
- [x] T018 [US1] إضافة CSS لجدول الجلسات في `screens/users/users.css`

---

## Phase 4: US2 — تسجيل الخروج التلقائي

- [x] T019 [US2] إضافة `case 'heartbeat':` في `server/invokeHandlers.js`
- [x] T020 [US2] إضافة `api.heartbeat` في `assets/web-api.js`
- [x] T021 [US2] إضافة heartbeat loop في `screens/users/users.js`
- [x] T022 [US2] إضافة `navigator.sendBeacon` عند إغلاق المتصفح
- [x] T023 [US2] إضافة endpoint `/api/auth/logout-beacon` في `server/index.js`

---

## Phase 5: US3 — التصدير Excel وPDF

- [x] T024 [US3] إضافة دالة `exportSessions(type, filters)` في `server/services/exportsService.js`
- [x] T025 [US3] بناء HTML template للـ PDF
- [x] T026 [US3] بناء Excel data
- [x] T027 [US3] إضافة endpoint `/api/export/sessions` في `server/index.js`
- [x] T028 [US3] إضافة أزرار التصدير في `screens/users/users.html`
- [x] T029 [US3] إضافة منطق التصدير في `screens/users/users.js`

---

## Phase 6: Polish

- [x] T030 إضافة `api.startHeartbeat` و`api.stopHeartbeat` في `assets/web-api.js`
- [x] T031 إضافة `api.getMe` في `assets/web-api.js`
- [ ] T032 اختبار السيناريوهات السبعة من `quickstart.md` يدوياً

---

**Status**: 31/32 مكتملة
