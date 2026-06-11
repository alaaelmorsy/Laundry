# Research: تقرير هيئة الزكاة

**Date**: 2026-06-11

## Decisions

### 1. جدول الإشعارات الدائنة

**Decision**: استخدام جدول `credit_notes` مع الحقول: `id`, `credit_note_number`, `credit_note_seq`, `customer_id`, `subtotal`, `vat_amount`, `total_amount`, `created_at`
**Rationale**: هذا هو الجدول الرسمي للإشعارات الدائنة في النظام. تاريخ الإنشاء `created_at` هو ما يُستخدم للتصفية.
**Alternatives considered**: جدول `credit_invoices` الموجود كاسم شاشة فقط وليس جدولاً مستقلاً.

### 2. جدول الفواتير

**Decision**: استخدام جدول `orders` مع تصفية `created_at` بين تاريخَي الفترة، بصرف النظر عن `payment_status`.
**Rationale**: المتطلبات صريحة: الاعتماد على تاريخ الإنشاء وليس التسديد. يشمل الآجل (`pending`) والمدفوع (`paid`) والجزئي.
**Alternatives considered**: التصفية على `paid_at` — مرفوض بناءً على المتطلبات.

### 3. جدول المصروفات

**Decision**: استخدام جدول `expenses` مع الحقول: `id`, `title`, `category`, `amount`, `tax_amount`, `total_amount`, `expense_date`.
**Rationale**: الجدول موجود ويحتوي على `expense_date` (نوع DATE) للتصفية.
**Note**: `expense_date` هو DATE وليس TIMESTAMP، لذا التصفية تكون `expense_date BETWEEN ? AND ?`.

### 4. اسم الدالة وطريقة الاستدعاء

**Decision**: دالة واحدة `getZakatReport({ dateFrom, dateTo })` في `db.js` تُرجع `{ orders, creditNotes, expenses }`.
**Rationale**: الاتساق مع نمط النظام (دالة واحدة لكل تقرير). يقلل عدد استدعاءات الشبكة.
**Alternatives considered**: ثلاث دوال منفصلة — مرفوض لأنه يُضاعف رحلات الشبكة.

### 5. نمط الشاشة

**Decision**: نمط مطابق لـ `period-report` — فلتر تاريخ + زر عرض + ثلاثة جداول + ملخص.
**Rationale**: `period-report` أقرب تقرير موجود من حيث البنية (فترة من/إلى + فواتير + مصروفات). إعادة استخدام نفس أنماط CSS والـ JS.

### 6. حساب الصافي

**Decision**: صافي = إجمالي الفواتير (total_amount) − إجمالي الإشعارات الدائنة (total_amount) − إجمالي المصروفات (total_amount)
**Rationale**: المتطلب المحدد من المستخدم. يُعرض باللون الأحمر إذا كانت القيمة سالبة.

### 7. اسم المستخدم في جدول الفواتير

**Decision**: `JOIN customers c ON c.id = o.customer_id` للحصول على اسم العميل.
**Rationale**: نفس النمط المستخدم في تقارير الفواتير الأخرى.
