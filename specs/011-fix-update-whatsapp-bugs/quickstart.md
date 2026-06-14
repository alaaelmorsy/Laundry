# Quickstart: اختبار التحديث التلقائي وWhatsApp

**Date**: 2026-06-14

---

## اختبار 1 — التحقق من GitHub Release (بدون جهاز عميل)

**المتطلبات**: وصول لـ GitHub، إصدار جديد على `main`.

```text
1. رفع push بتغيير version في package.json على main
2. انتظار انتهاء GitHub Actions workflow (~10-12 دقيقة)
3. فتح الـ Release على GitHub والتحقق:
   ✅ laundry-app-v{version}.exe موجود
   ✅ Laundry-PLUS-Setup-v{version}.exe موجود
   ✅ sha256sums.txt موجود ويحتوي على hash لـ laundry-app-v{version}.exe
```

---

## اختبار 2 — التحديث التلقائي على جهاز عميل حقيقي

**المتطلبات**: جهاز مثبَّت عليه البرنامج كـ Windows Service، إنترنت.

**الخطوات**:
```text
1. تأكد أن البرنامج يعمل: افتح https://localhost:3443
2. افتح الإعدادات → تبويب التحديث
3. اضغط "فحص التحديثات" → يجب أن يظهر الإصدار الجديد وحجم الملف
4. اضغط "تحديث الآن"
5. شاهد شريط التقدم (جارٍ التنزيل → التحقق → الاستبدال)
6. يُغلَق المتصفح تلقائياً وتظهر رسالة "سيُعاد التشغيل"
7. انتظر 30-60 ثانية
8. افتح https://localhost:3443 من جديد
9. تحقق من رقم الإصدار في الإعدادات → يجب أن يكون الجديد
```

**النتيجة المتوقعة**:
```
✅ البرنامج يعود بالإصدار الجديد
✅ لا خطأ في event log
✅ update-log.txt يحتوي: "Update complete: vOLD -> vNEW"
✅ update-status.json: lastUpdateResult.status = "success"
```

---

## اختبار 3 — WhatsApp QR بدون إنترنت لـ GitHub

**المتطلبات**: جهاز بدون وصول لـ raw.githubusercontent.com.

```text
1. افتح الواتساب من القائمة الجانبية
2. انتظر 10 ثوانٍ
3. النتيجة المتوقعة: يظهر QR Code بدون أخطاء
4. تحقق من console logs: لا يوجد "Invalid host defined options"
```

---

## اختبار 4 — Rollback عند فشل التحديث

**المحاكاة**: تحريف الـ exe المُحمَّل قبل الاستبدال (للاختبار فقط).

```text
1. بعد التحميل وقبل الاستبدال: احذف الـ exe المُحمَّل يدوياً
2. يجب أن:
   ✅ updater.ps1 يُسجّل "Exe replacement failed"
   ✅ الـ exe القديم يظل كما هو
   ✅ Service يُعاد تشغيله بالإصدار القديم
   ✅ update-status.json: lastUpdateResult.status = "rollback"
```

---

## التحقق من السجلات

```text
ملف: {app}\data\update-log.txt

سجل ناجح:
[...] [INFO] Update started: target=1.0.11
[...] [INFO] Backup created: ...
[...] [INFO] Download complete: ... (xx bytes)
[...] [INFO] Checksum verified: OK
[...] [INFO] Spawning updater, server exiting
[...] [INFO] Updater started: from=1.0.10 to=1.0.11 pid=...
[...] [INFO] Server process exited
[...] [INFO] Exe replaced successfully
[...] [INFO] Starting service LaundryPlusApp...
[...] [INFO] Update complete: 1.0.10 -> 1.0.11
```
