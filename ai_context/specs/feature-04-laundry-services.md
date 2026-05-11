# Feature 04 — Laundry Services

## Goal
تعريف أنواع خدمات المغسلة (غسيل وكوي، كوي فقط، تنظيف جاف…) التي تُستخدم لاحقًا كمفاتيح في تسعير المنتجات.

## Entry points
- UI: `screens/services/services.html|js|css`
- API: `getLaundryServices`, `createLaundryService`, `updateLaundryService`, `deleteLaundryService`, `toggleLaundryServiceStatus`, `reorderLaundryService`.
- Translate helper: `POST /api/translate` (Langbly) لتوليد الاسم الإنجليزي.

## Inputs
- `create/update`: `{ id?, nameAr, nameEn }`
- `reorderLaundryService`: `{ id, beforeId? }` — `beforeId=null` يعني نقل إلى النهاية.
- `toggleLaundryServiceStatus`: `{ id, isActive: boolean }`

## Outputs
- القوائم مرتّبة `ORDER BY sort_order ASC, id ASC`.

## Rules
- `name_ar` و `name_en` مطلوبان في الشيفرة (NOT NULL).
- `is_active` افتراضي 1.
- `sort_order`: يُحسَب عند الإنشاء كـ `MAX(sort_order)+1`.
- Seed أوّلي: 4 خدمات (غسيل عادي/مستعجل، كوي فقط، تنظيف جاف).

## Edge cases
- حذف خدمة مرتبطة بسطور أسعار → FK `ON DELETE RESTRICT` يرفض.
- `reorderLaundryService` يُنفَّذ داخل transaction ليضمن اتساق `sort_order`.
- الخدمات غير المفعّلة لا تظهر في POS (`WHERE is_active=1`) لكنها تظل قابلة للعرض في شاشة الإدارة.

## UX hints
- الترجمة الآلية للـ `name_en` متاحة فقط إذا ضُبط `LANGBLY_API_KEY` في `.env`.
