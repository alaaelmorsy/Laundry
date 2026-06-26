# Implementation Plan: خيار المزرام للمنتجات

**Branch**: `028-merzam-product-option` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/028-merzam-product-option/spec.md`

---

## Summary

إضافة خيار "المزرام" (نمط الخياطة/التطريز) على المنتجات في نظام البيع. يُفعَّل على مستوى المنتج من شاشة الخدمات، ثم يظهر في سلة البيع كقائمة منسدلة اختيارية أسفل خانة العملية، ويُطبع على الفاتورة الحرارية والـ A4. أنواع المزرام محفوظة في جدول مستقل قابل للتوسع.

---

## Technical Context

**Language/Version**: Node.js 20 (CommonJS), Vanilla JS

**Primary Dependencies**: Express.js, mysql2/promise

**Storage**: MySQL/MariaDB — جدول جديد `merzam_types`، تعديل `products` و`order_items`

**Testing**: يدوي (لا يوجد إطار اختبارات)

**Target Platform**: Windows on-premise POS

**Project Type**: Desktop web app (single-tenant)

**Performance Goals**: استجابة < 100ms للقوائم في شاشة البيع

**Constraints**: المزرام وصفي فقط — لا تأثير على الأسعار أو الإجماليات

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| 4-Step API Checklist | ✅ | db → invokeHandlers → web-api → screen |
| No ORM, parameterized queries | ✅ | raw mysql2 |
| Migrations additive-only + try/catch | ✅ | ALTER TABLE + CREATE TABLE IF NOT EXISTS |
| No DROP/RENAME columns | ✅ | إضافة فقط |
| No DDL from invokeHandlers.js | ✅ | DDL في db.initialize() |
| No change to ZATCA workflow | ✅ | |
| No change to thermal print dimensions | ✅ | 76mm / margin: 0 auto محفوظة |
| Arabic-first UI / RTL | ✅ | |
| window.api only in screen JS | ✅ | |

لا توجد انتهاكات.

---

## Project Structure

### Documentation (this feature)

```text
specs/028-merzam-product-option/
├── plan.md              ← هذا الملف
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
└── tasks.md             ← /speckit-tasks (لاحقاً)
```

### Source Code (الملفات المتأثرة)

```text
database/db.js               ← جدول merzam_types، migrations، دوال CRUD
server/invokeHandlers.js     ← cases: getMerzamTypes, saveMerzamType, deleteMerzamType, getMerzamEnabledProducts
assets/web-api.js            ← تسجيل window.api methods
screens/services/services.js ← toggle "مزرام" في نموذج المنتج
screens/pos/pos.js           ← قائمة في السلة + merzamTypeId في cart item + طباعة
screens/settings/settings.html ← قسم إدارة أنواع المزرام
screens/settings/settings.js   ← منطق إدارة merzam_types
```

---

## Phase 0: Research

لا توجد مجاهيل تقنية — الميزة تتبع أنماطاً موجودة بشكل مطابق.

| القرار | المختار | المبرر |
|--------|---------|--------|
| مكان إدارة أنواع المزرام | شاشة الإعدادات | تجنب شاشة منفصلة جديدة |
| تخزين اسم المزرام في order_items | `merzam_type_name` VARCHAR (نص) | حماية الأرشيف من تغيير/حذف الأنواع |
| الجدول المُعدَّل للـ merzam_enabled | `products` | المزرام مرتبط بالمنتج لا بنوع الخدمة |
| القائمة في وضع process/readonly | مخفية (لا تظهر) | تناسق مع السلوك الحالي |
| الطباعة الحرارية | سطر إضافي `مزرام: [اسم]` تحت العملية | يتناسب مع فضاء الإيصال 76mm |

---

## Phase 1: Design & Contracts

### Data Model

انظر [data-model.md](data-model.md)

### API Contracts

انظر [contracts/api.md](contracts/api.md)

### Quickstart Validation

انظر [quickstart.md](quickstart.md)
