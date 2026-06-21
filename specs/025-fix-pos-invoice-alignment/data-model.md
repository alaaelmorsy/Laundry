# Data Model: إصلاح محاذاة الطباعة الحرارية

لا يتضمن هذا الإصلاح أي تغيير في قاعدة البيانات أو نماذج البيانات.
الإصلاح محصور بالكامل في ملفات CSS للشاشات المتأثرة.

## ملفات المُتأثرة

| الملف | السطر / القاعدة | المشكلة | الإصلاح |
|-------|----------------|---------|---------|
| `screens/pos/pos.css` | `@media print .inv-paper` | `width: 80mm`, `padding: 4mm`، بدون `@page` | `width: 76mm`, `padding: 2mm 3mm`، إضافة `@page` |
| `screens/hangers/hangers.css` | `@media print .inv-paper` | `width: 80mm`، بدون `@page` | `width: 76mm`، إضافة `@page` |
| `screens/credit-invoices/credit-invoices.css` | `@media print .inv-paper` | `width: 80mm`, `padding: 4mm`، بدون `@page` | `width: 76mm`, `padding: 2mm 3mm`، إضافة `@page` |
| `screens/reports/daily-report/daily-report.css` | `@page` + متعدد `.inv-paper` selectors | `margin: 4mm 3mm`، `width: 80mm` | `margin: 0`، `width: 76mm` |
| `screens/reports/period-report/period-report.css` | `@page` + متعدد `.inv-paper` selectors | `margin: 4mm 3mm`، `width: 80mm` | `margin: 0`، `width: 76mm` |
| `screens/reports/worker-report/worker-report.css` | `@page` + `.inv-paper` selectors | `margin: 4mm 3mm`، `width: 80mm` | `margin: 0`، `width: 76mm` |
| `screens/reports/all-invoices-report/all-invoices-report.css` | `@page` + `.inv-paper` selectors | `margin: 3mm 2mm`، `width: 80mm` | `margin: 0`، `width: 76mm` |
