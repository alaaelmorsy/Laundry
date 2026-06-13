# Quickstart: اختبار المثبّت

## المتطلبات

1. **Inno Setup 6** مثبَّت على جهاز التطوير:
   - تحميل: https://jrsoftware.org/isdl.php
   - المسار الافتراضي: `C:\Program Files (x86)\Inno Setup 6\`

2. `npm run build` اكتمل وملف `release\laundry-app.exe` موجود.

---

## بناء المثبّت

```powershell
# من جذر المشروع
npm run build:installer
```

الناتج: `dist\PLUS-Laundry-Setup.exe`

---

## سيناريو 1: تثبيت أول مرة (على جهاز نظيف)

```
1. انسخ PLUS-Laundry-Setup.exe إلى الجهاز المستهدف
2. انقر نقرًا مزدوجًا على الملف
3. إذا ظهر UAC → اضغط "نعم"
4. اختر مجلد التثبيت (أو اترك الافتراضي C:\PLUS\Laundry)
5. اضغط "تثبيت"
6. انتظر حتى يكتمل شريط التقدم
7. اضغط "إنهاء"
```

**النتيجة المتوقعة**:
- [ ] الملفات موجودة في المجلد المختار
- [ ] Task Scheduler يحتوي مهمة "LaundryPOS"
- [ ] البرنامج بدأ تلقائياً
- [ ] المتصفح يفتح `http://localhost:3000` أو يظهر رابط في نهاية التثبيت

---

## سيناريو 2: التحقق من الـ Startup

```powershell
# تحقق من وجود Task Scheduler
Get-ScheduledTask -TaskName "LaundryPOS"

# إعادة تشغيل الجهاز والتحقق من البدء التلقائي
Restart-Computer
# بعد الإقلاع: افتح http://localhost:3000
```

**النتيجة المتوقعة**:
- [ ] `TaskState = Ready` أو `Running`
- [ ] البرنامج يبدأ خلال 30 ثانية من الإقلاع

---

## سيناريو 3: إعادة التثبيت (ترقية)

```
1. ضع ملف بيانات اختبار في C:\PLUS\Laundry\data\test.txt
2. شغّل PLUS-Laundry-Setup.exe مجدداً
3. اختر نفس المجلد
4. اضغط تثبيت
```

**النتيجة المتوقعة**:
- [ ] `data\test.txt` لا يزال موجوداً (لم يُحذف)
- [ ] `laundry-app.exe` تم تحديثه
- [ ] Task Scheduler محدَّث

---

## سيناريو 4: تثبيت في مجلد مختلف

```
1. شغّل المثبّت
2. اضغط "استعراض" واختر D:\Programs\Laundry
3. اضغط تثبيت
```

**النتيجة المتوقعة**:
- [ ] الملفات في `D:\Programs\Laundry\`
- [ ] Task Scheduler يشير إلى `D:\Programs\Laundry\laundry-app.exe`
