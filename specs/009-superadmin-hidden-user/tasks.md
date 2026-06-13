# Tasks: SuperAdmin Hidden User

**Input**: Design documents from `specs/009-superadmin-hidden-user/`

**Organization**: Tasks مرتبة حسب قصة المستخدم لتمكين التنفيذ والاختبار المستقل.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تشغيله بالتوازي (ملفات مختلفة، لا تبعيات)
- **[Story]**: القصة التي تنتمي إليها المهمة

---

## Phase 1: Setup — لا يوجد (الميزة تعديل على ملفات موجودة)

لا حاجة لإنشاء بنية مشروع جديدة. ننتقل مباشرة للأساسيات.

---

## Phase 2: Foundational — تصدير `buildAllPermissions`

**Purpose**: شرط أساسي لجميع القصص — تصدير الدالة من `database/db.js` حتى يتمكن `server/index.js` من استخدامها.

**⚠️ CRITICAL**: لا يمكن تنفيذ أي قصة مستخدم قبل اكتمال هذه المرحلة.

- [x] T001 في `database/db.js` أضف `buildAllPermissions` لقائمة `module.exports` (حالياً السطر ~7492)

**Checkpoint**: `buildAllPermissions` قابلة للاستيراد من خارج `db.js`.

---

## Phase 3: User Story 1 — تسجيل دخول superAdmin (Priority: P1) 🎯 MVP

**Goal**: المستخدم `superAdmin`/`LearnTech` يستطيع تسجيل الدخول والحصول على جميع الصلاحيات.

**Independent Test**: تسجيل دخول بـ `superAdmin`/`LearnTech` → يدخل البرنامج بنجاح مع جميع الصلاحيات.

### Implementation for User Story 1

- [x] T002 [US1] في `server/index.js` — `/api/auth/login` (السطر ~269): أضف short-circuit قبل `db.findUser(...)` يتحقق من `username === 'superAdmin' && password === 'LearnTech'`، يُنشئ JWT بـ `{ id: 0, username: 'superAdmin', role: 'superadmin', role_id: null, full_name: 'Super Admin' }`، يضع الـ cookie بنفس الطريقة الحالية، ويُعيد `{ success: true, user: { ...superUser, permissions: db.buildAllPermissions(true) } }`

- [x] T003 [US1] في `server/index.js` — `/api/auth/me` (السطر ~305): أضف short-circuit في أول `try block` يتحقق من `req.user.role === 'superadmin'` ويُعيد `{ success: true, user: { id: 0, username: 'superAdmin', full_name: 'Super Admin', role: 'superadmin', role_id: null, permissions: db.buildAllPermissions(true) } }` مباشرة دون استعلام DB

- [x] T004 [US1] في `assets/auth-guard.js` (السطر 25): عدّل شرط `hasPermission` من `if (u.role === 'admin')` إلى `if (u.role === 'admin' || u.role === 'superadmin')` لمنح superAdmin جميع الصلاحيات في الواجهة

**Checkpoint**: تسجيل دخول بـ `superAdmin`/`LearnTech` يعمل، الصلاحيات كاملة، `/api/auth/me` يُعيد بيانات صحيحة.

---

## Phase 4: User Story 2 — إخفاء superAdmin من شاشة المستخدمين (Priority: P1)

**Goal**: `superAdmin` لا يظهر في أي قائمة أو بحث في شاشة المستخدمين، ولا يمكن إنشاء مستخدم بهذا الاسم.

**Independent Test**: فتح شاشة المستخدمين → `superAdmin` غير مُدرج. البحث عنه → لا نتائج. محاولة إنشاء مستخدم باسمه → رسالة خطأ.

### Implementation for User Story 2

- [x] T005 [US2] في `database/db.js` — دالة `getAllUsers` (السطر ~1563): أضف `WHERE u.username != 'superAdmin'` في استعلام SQL قبل `ORDER BY u.id ASC`

- [x] T006 [US2] في `database/db.js` — دالة `createUser` (السطر ~1571): أضف في أول السطور `if (username.toLowerCase() === 'superadmin') throw new Error('اسم المستخدم محجوز ولا يمكن استخدامه');`

**Checkpoint**: شاشة المستخدمين لا تعرض `superAdmin`، محاولة إنشائه تُعطي خطأ.

---

## Phase 5: User Story 3 — حصرية استعادة النظام لـ superAdmin (Priority: P1)

**Goal**: صلاحية استعادة النظام حكر على `superAdmin` — مخفية عن الآخرين في الواجهة ومرفوضة على الخادم.

**Independent Test**: أدمن عادي: tab استعادة النظام مخفي. محاولة استدعاء `systemRestore` من الكونسول → `{ success: false }`. superAdmin: tab ظاهر ويعمل.

### Implementation for User Story 3

- [x] T007 [US3] في `server/invokeHandlers.js` — دالة `invoke` (السطر ~79): لاحظ أن المعامل الثالث هو `_user` (غير مستخدم حالياً). غيّر اسمه إلى `reqUser`، ثم في `case 'systemRestore'` (السطر ~1724): أضف قبل `db.systemRestore(...)`: `if (!reqUser || reqUser.role !== 'superadmin') return { success: false, message: 'غير مصرح — هذه الصلاحية للمشرف العام فقط' };`

- [x] T008 [US3] في `screens/settings/settings.js`: في نهاية دالة `DOMContentLoaded` (قبل آخر `}`، بعد السطر ~472)، أضف listener على `userReady` event يتحقق من `user.role !== 'superadmin'` ويُخفي `tabSystemRestore` و `panelSystemRestore` بـ `style.display = 'none'`

**Checkpoint**: أدمن عادي لا يرى tab استعادة النظام. محاولة API مباشرة تُعاد برفض. superAdmin يرى Tab ويستطيع الاستعادة.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T009 [P] تحقق يدوي من جميع سيناريوهات `quickstart.md` (7 سيناريوهات)
- [ ] T010 [P] تأكد من أن `superAdmin` لا يظهر في أي تقارير أو سجلات نشاط (ابحث في أي شاشات تعرض اسم المستخدم الحالي)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: لا تبعيات — تبدأ فوراً
- **US1 (Phase 3)**: يعتمد على T001 (تصدير `buildAllPermissions`)
- **US2 (Phase 4)**: مستقلة — يمكن تنفيذها بالتوازي مع US1 بعد T001
- **US3 (Phase 5)**: مستقلة — يمكن تنفيذها بالتوازي مع US1 و US2
- **Polish (Phase 6)**: يعتمد على اكتمال جميع القصص

### User Story Dependencies

- **US1**: تعتمد على T001 فقط
- **US2**: تعتمد على T001 فقط (لا تعتمد على US1)
- **US3**: مستقلة تماماً (ملفات مختلفة عن US1 و US2)

### Parallel Opportunities

بعد T001:
- T002, T003, T004 (US1) يمكن تنفيذها بالتسلسل
- T005, T006 (US2) يمكن تنفيذها بالتوازي مع US1
- T007, T008 (US3) يمكن تنفيذها بالتوازي مع US1 و US2

---

## Parallel Example: بعد T001

```
في نفس الوقت:
  - Stream A: T002 → T003 → T004  (US1: تسجيل الدخول)
  - Stream B: T005 → T006         (US2: إخفاء المستخدم)
  - Stream C: T007 → T008         (US3: حصرية الاستعادة)
```

---

## Implementation Strategy

### MVP First (الحد الأدنى للشحن)

1. T001 — تصدير `buildAllPermissions`
2. T002, T003, T004 — تسجيل دخول superAdmin يعمل كاملاً
3. **STOP and VALIDATE**: superAdmin يدخل ويملك كل الصلاحيات ✓
4. T005, T006 — إخفاء superAdmin من المستخدمين
5. T007, T008 — حصرية استعادة النظام
6. T009, T010 — التحقق الكامل

### ملاحظة مهمة على T007

دالة `invoke` في `invokeHandlers.js` تستقبل `_user` (underscore تعني غير مستخدم). قبل إضافة الـ guard يجب إزالة underscore وتغيير الاسم إلى `reqUser` في تعريف الدالة:
```javascript
async function invoke(method, payload, reqUser) {  // كان: _user
```

---

## Notes

- جميع التعديلات على ملفات موجودة — لا إنشاء ملفات جديدة
- 10 مهام إجمالاً، ~30 سطراً من الكود
- لا تغييرات على DB schema
- [P] = يمكن تنفيذه بالتوازي مع مهام أخرى في نفس المرحلة
