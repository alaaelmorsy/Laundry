# Quickstart: التحقق من صحة نظام التحديث

## سيناريو الاختبار الكامل

### المتطلبات
- نسخة مُنشأة كـ exe تعمل كـ Windows Service (LaundryPlusApp)
- إصدار جديد مرفوع على GitHub Releases يحتوي:
  - `laundry-app-v{X.Y.Z}.exe`
  - `sha256sums.txt`

---

### خطوات التحقق

#### 1. فحص التحديثات
1. افتح المتصفح على `https://localhost:3000`
2. سجّل دخولك واذهب لـ **الإعدادات → التحديثات**
3. اضغط **"فحص التحديثات"**

**المتوقع:**
- يظهر مؤشر تحميل على الزر
- بعد ≤ 15 ثانية: إما "أنت تستخدم أحدث إصدار" أو بطاقة التحديث مع الإصدار الجديد وحجم الملف

#### 2. تنفيذ التحديث
1. اضغط **"تحديث الآن"**

**المتوقع:**
- يظهر panel التقدم فوراً
- كل خطوة لها mini progress bar يمتلئ:
  - نسخة احتياطية: ~18 ثانية
  - تحميل: real-time bytes progress
  - تحقق: ~6 ثوانٍ
  - استبدال: ~4 ثوانٍ
  - إعادة تشغيل: البرنامج يقفل تلقائياً

#### 3. التحقق من النجاح
بعد 30-60 ثانية (وقت إعادة تشغيل الـ service):
1. حاول فتح `https://localhost:3000` مرة أخرى
2. افتح الإعدادات → التحديثات
3. تحقق من رقم الإصدار

**المتوقع:**
- الإصدار الجديد يظهر
- جميع البيانات السابقة موجودة
- "أنت تستخدم أحدث إصدار" عند فحص التحديثات

---

### اختبار سيناريو الفشل (اختياري)
1. قطع الإنترنت أثناء التحميل
2. **المتوقع:** شريط أحمر + رسالة "فشل التنزيل — تحقق من الإنترنت وأعد المحاولة"
3. الزر "تحديث الآن" يعود للعمل بعد 4 ثوانٍ

---

### التحقق من log الـ updater
```powershell
Get-Content "$env:APPDATA\..\Local\Laundry\data\update-log.txt" -Tail 20
# أو حسب مسار التثبيت:
Get-Content "C:\Laundry\data\update-log.txt" -Tail 20
```

**المتوقع في حالة النجاح:**
```
[INFO] Updater started: from=1.0.17 to=1.0.18 pid=XXXX
[INFO] Waiting for server PID XXXX to exit...
[INFO] Server process exited
[INFO] Replacing exe: C:\Laundry\laundry-app.exe
[INFO] Exe replaced successfully
[INFO] Update complete: 1.0.17 -> 1.0.18
[INFO] Starting Windows Service LaundryPlusApp...
```
