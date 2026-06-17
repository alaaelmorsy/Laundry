# Research: إصلاح شامل لنظام التحديث التلقائي

## المشاكل المرصودة ونتائج البحث

### R1 — هل `package.json` متاح على القرص في وضع exe؟

**البحث**: في وضع `pkg`، ملف `package.json` مدمج داخل الـ virtual FS الخاص بالـ exe ويمكن قراءته عبر `fs.readFileSync` من داخل البرنامج نفسه. لكن `updater.ps1` يعمل كـ PowerShell script خارج الـ exe ويستخدم `Get-Content` لقراءة الملف من القرص الحقيقي.

**Decision**: تمرير `fromVersion` كمعامل (`-FromVersion`) من `performUpdate()` إلى `updater.ps1` — البرنامج يقرأ الإصدار من virtual FS بنجاح، والـ script يستقبله كقيمة جاهزة.

**Rationale**: لا حاجة لكتابة `package.json` على القرص أو تغيير هيكل الـ installer.

**Alternatives considered**:
- كتابة `package.json` إلى القرص عند بدء الـ exe: تعقيد غير ضروري
- قراءة الإصدار من `update-status.json`: احتمال أن يكون stale

---

### R2 — هل يجب تمرير اسم الـ Service كمعامل؟

**البحث**: اسم الـ service `LaundryPlusApp` مُعرَّف بشكل ثابت في:
- `installer/laundry.iss` (كل NSSM calls)
- `scripts/diagnose.bat`
- جميع specs السابقة

**Decision**: الاسم يبقى hardcoded في `updater.ps1` (`$ServiceName = 'LaundryPlusApp'`) — لا حاجة لتمريره كمعامل لأنه لا يتغير أبداً.

**Rationale**: الـ installer دائماً يُسجِّل الـ service بهذا الاسم — تمريره كمعامل يُضيف تعقيداً بلا فائدة.

---

### R3 — رسائل الخطأ الإنجليزية التي تصل للمستخدم

**البحث**: الرسائل التالية تظهر للمستخدم مباشرة:
- `'GitHub API timeout'` (من `githubGet`)
- `'Download failed: HTTP ${statusCode}'` (من `downloadWithProgress`)
- `'Download timed out'` (من `downloadWithProgress`)
- `'GitHub API error: ${res.status}'` (من `checkForUpdate`)
- `'Too many redirects'` (من `githubGet`)
- `'GitHub repo not configured in package.json'` (من `checkForUpdate`)
- `'تعذّر الاتصال بـ GitHub للتحقق من التحديثات'` — هذه عربية ✅

**Decision**: استبدال جميع رسائل الخطأ الإنجليزية برسائل عربية واضحة تُفيد المستخدم.

---

### R4 — المشاكل المُصلَّحة بالفعل في هذه الجلسة

| المشكلة | الحالة |
|---------|--------|
| `githubGet` لا يتبع redirects | ✅ مُصلَّح |
| Checksum timeout يوقف التحديث | ✅ مُصلَّح (graceful fallback) |
| شريط التقدم لا يتحرك | ✅ مُصلَّح (mini bars + animation) |
| إشعار التحديث في صفحة الـ login | ✅ كان موجوداً مسبقاً |

---

### R5 — هل `package.json` reads في `updateService.js` تعمل في pkg؟

**Decision**: نعم — `fs.readFileSync(path.join(ROOT, 'package.json'))` حيث `ROOT = APP_ROOT` يعمل لأن pkg يُعيد توجيه `fs` للـ virtual FS. لا تغيير مطلوب.
