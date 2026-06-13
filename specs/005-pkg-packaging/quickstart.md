# Quickstart: التحقق من تغليف البرنامج بـ pkg

## المتطلبات

- Node.js 18+ مثبت على جهاز التطوير (للبناء فقط)
- MySQL مثبت على الجهاز المستهدف
- Windows 10+ (64-bit)
- `pkg` مثبت عالمياً: `npm install -g pkg`

---

## السيناريو 1: البناء والتشغيل المحلي

```powershell
# 1. بناء الـ exe
npm run build

# 2. التحقق أن الملف أُنشئ
ls dist\laundry.exe

# 3. نسخ .env للمجلد الناتج
copy .env dist\.env

# 4. تشغيل الـ exe
.\dist\laundry.exe
```

**النتيجة المتوقعة**: السيرفر يبدأ وتظهر رسالة `Server running on port 3000` في الـ console، والمتصفح يفتح `http://localhost:3000`.

---

## السيناريو 2: الاختبار على جهاز بدون Node.js

1. انسخ `dist\laundry.exe` و `.env` لجهاز Windows آخر بدون Node.js
2. عدّل `.env` ببيانات MySQL الصحيحة
3. شغّل `laundry.exe` مزدوج الضغط
4. افتح المتصفح على `http://localhost:3000`

**النتيجة المتوقعة**: شاشة تسجيل الدخول تظهر خلال 15 ثانية.

---

## السيناريو 3: التحقق من كتابة البيانات خارج الـ exe

```powershell
# بعد تشغيل laundry.exe، تحقق أن data/ أُنشئ بجانب الـ exe
ls dist\data\
```

**النتيجة المتوقعة**: مجلد `data\` يظهر بجانب `laundry.exe` وليس داخله.

---

## السيناريو 4: تثبيت كـ Windows Service

```powershell
# من مجلد التثبيت (Admin)
.\scripts\install-service.ps1 -ExePath "C:\Laundry\laundry.exe"
```

**النتيجة المتوقعة**:
- رسالة: `✅ تم تسجيل خدمة LaundryPOS بنجاح`
- الخدمة تظهر في `services.msc` باسم `LaundryPOS`
- بعد إعادة التشغيل: السيرفر يبدأ تلقائياً

---

## السيناريو 5: MySQL غير متاح

1. أوقف MySQL
2. شغّل `laundry.exe`

**النتيجة المتوقعة**: رسالة خطأ واضحة تُشير لمشكلة الاتصال بقاعدة البيانات (وليس crash صامت).

---

## التحقق من حجم الـ exe

```powershell
(Get-Item dist\laundry.exe).Length / 1MB
```

**النتيجة المتوقعة**: أقل من 100 MB.
