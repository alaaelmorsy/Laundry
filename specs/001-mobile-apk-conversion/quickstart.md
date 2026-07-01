# Quickstart & Validation Guide

**Feature**: تطبيق Flutter للمغاسل
**Date**: 2026-06-30

## Prerequisites

- Flutter SDK 3.x مثبّت
- Android Studio أو VS Code
- هاتف Android (API 26+) أو مُحاكي
- Node.js 20 (لسكريبت الترحيل فقط)
- اتصال بـ MySQL الحالي (للترحيل فقط)

---

## Setup

```bash
# 1. إنشاء المشروع
cd D:\PLUS
flutter create laundry_apk --org com.plus.laundry
cd laundry_apk

# 2. تثبيت الـ packages
flutter pub get

# 3. توليد كود drift + riverpod
dart run build_runner build --delete-conflicting-outputs

# 4. تشغيل على المحاكي
flutter run
```

---

## Validation Scenarios

### Scenario 1: Login (شاشة 1/35)
```
افتح التطبيق
→ تظهر شاشة Login بالعربي RTL
→ أدخل اسم مستخدم وكلمة مرور
→ اضغط "دخول"
→ تظهر شاشة Dashboard
```
**Expected**: تسجيل دخول في < 1 ثانية، JWT محفوظ في secure storage

### Scenario 2: Complete POS Sale (شاشة 3/35)
```
اضغط "نقطة البيع"
→ ابحث عن عميل بالاسم أو الهاتف
→ أضف خدمة غسيل (كميات)
→ أضف منتج
→ طبّق خصم 10%
→ اختر "نقدي"
→ اضغط "إتمام الفاتورة"
→ يظهر رقم الفاتورة + زر الطباعة
```
**Expected**:
- الفاتورة تُحفظ في SQLite في < 200ms
- رقم `invoice_seq` تسلسلي صحيح
- المعادلة: `total = subtotal - discount + vat`
- يُضاف إلى `zatca_queue` إذا كان ZATCA مُفعَّلاً

### Scenario 3: Offline Mode
```
أوقف الإنترنت (وضع طيران)
→ أنشئ 3 فواتير
→ كل الفواتير تُحفظ محلياً ✅
→ أعد الإنترنت
→ بعد 15 دقيقة (أو يدوياً): ZATCA يُرسل الفواتير
```
**Expected**: لا توقف في العمل بدون إنترنت

### Scenario 4: Subscription Balance
```
ابحث عن عميل لديه اشتراك
→ اختر "اشتراك" كطريقة دفع
→ أتمم الفاتورة
→ تحقق أن `credit_remaining` انخفض بالمبلغ الصحيح
→ جرّب خصم أكثر من الرصيد المتاح
```
**Expected**: رفض العملية برسالة عربية "الرصيد غير كافٍ"

### Scenario 5: Data Migration Validation
```
شغّل: node tools/migrate/mysql_to_sqlite.js
→ يُنشئ laundry_data.sqlite
→ شغّل: node tools/migrate/validate_migration.js
→ يُنشئ تقرير مقارنة
```
**Expected**:
- عدد الفواتير متطابق
- إجمالي المبيعات متطابق
- صفر اختلافات

### Scenario 6: Bluetooth Print
```
اربط طابعة Bluetooth حرارية 80mm
→ أتمم فاتورة من POS
→ اضغط "طباعة"
→ اختر الطابعة من القائمة
→ يُطبع الإيصال
```
**Expected**: إيصال مطابق لتنسيق النظام الحالي

---

## Screen Rating Verification

بعد بناء كل شاشة، استخدم هذا الـ checklist:

```
الشاشة: _______
[ ] الوظائف (4/4): كل الوظائف المطلوبة تعمل
[ ] التصميم (3/3): RTL + ألوان + رمز الريال
[ ] الأداء (2/2): < 300ms للفتح، < 200ms للعمليات
[ ] استثنائيات (1/1): رسائل خطأ واضحة بالعربي
التقييم: __/10
```

---

## Performance Benchmarks

| العملية | الهدف | يُقاس بـ |
|---------|-------|---------|
| فتح التطبيق | < 2 ثانية | flutter run --profile |
| فتح POS | < 300ms | Stopwatch في الكود |
| إضافة منتج للسلة | < 100ms | Stopwatch |
| حفظ الفاتورة | < 200ms | Stopwatch |
| بحث عميل (مليون سجل) | < 500ms | SQL EXPLAIN QUERY PLAN |
| تحميل قائمة فواتير | < 1 ثانية | Paginated: 20 rows |
