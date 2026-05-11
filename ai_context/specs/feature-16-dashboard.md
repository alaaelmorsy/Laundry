# Feature 16 — Dashboard

## Goal
صفحة استقبال للمستخدم بعد تسجيل الدخول تقدّم ملخصًا بصريًا مبدئيًا وروابط سريعة للشاشات الرئيسية.

## Entry points
- UI: `screens/dashboard/dashboard.html|js|css` (حجم `dashboard.js` صغير ≈ 776B، المنطق بسيط).

## Inputs
- لا توجد واجهات API مخصّصة للـ dashboard — يعتمد على endpoints موجودة أخرى (Invoices, Subscriptions, Expenses) إن أضيفت لوحات لاحقًا.

## Outputs
- عناصر واجهة سريعة (بطاقات/روابط).

## Rules
- يجب حماية الصفحة عبر `assets/auth-guard.js` (يتحقق من cookie).
- يُعاد التوجيه من `/` إلى `screens/login/login.html` (السيرفر)، وبعد الدخول الناجح يُنقَل المستخدم إلى dashboard عبر الواجهة.

## Edge cases
- استخدام الشاشة بدون جلسة يجب أن يعيد التوجيه إلى تسجيل الدخول.
- إضافة widgets لاحقًا يتطلب endpoints إحصائية جديدة (KPIs) في `invokeHandlers.js`.

## Future work
- بطاقات الإيرادات اليومية/الشهرية، عدد الاشتراكات النشطة، مصاريف الشهر، عدد الفواتير الآجلة — غير مُنفَّذة حاليًا في الشيفرة.
