# Implementation Plan: عروض الأصناف (Product-Specific Offers)

**Branch**: `027-product-offers` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

---

## Summary

إضافة تيوب "عروض الأصناف" منفصل في شاشة العروض الحالية، يتيح إنشاء عروض خصم مرتبطة بأصناف وعمليات محددة (product_price_lines). يُخزَّن كل عرض في جدول `product_offers` مستقل مع جدول وسيط `product_offer_lines` يربطه بسطور أسعار الأصناف. الشاشة الحالية تحتفظ بتيوب "العروض العامة" دون تغيير.

---

## Technical Context

**Language/Version**: Node.js 20 (CommonJS `require`)

**Primary Dependencies**: Express.js, mysql2/promise, vanilla JS (no framework)

**Storage**: MySQL/InnoDB — جدولان جديدان: `product_offers`, `product_offer_lines`

**Testing**: Manual (لا يوجد test framework في المشروع)

**Target Platform**: Windows desktop app (pkg exe + NSSM service)

**Project Type**: Monolithic single-invoke web application (POS system)

**Performance Goals**: استجابة قائمة الأصناف < 1 ثانية

**Constraints**: لا ORM، لا ES modules، كل SQL استعلامات parameterized، DECIMAL(10,2) للأموال

**Scale/Scope**: single-tenant، عدد الأصناف عادةً < 200، العروض < 50

---

## Constitution Check

| Gate | Status | Note |
|------|--------|------|
| 4-Step API Checklist | ✅ | db.js → invokeHandlers.js → web-api.js → screen JS |
| No ORM | ✅ | raw mysql2 queries فقط |
| No `fetch('/api/invoke')` directly | ✅ | window.api فقط |
| DECIMAL(10,2) للأموال | ✅ | discount_value DECIMAL(10,2) |
| Additive migrations only | ✅ | CREATE TABLE IF NOT EXISTS فقط |
| No DDL from invokeHandlers.js | ✅ | الـ migrations في db.initialize() |
| Parameterized queries | ✅ | لا string concatenation في SQL |
| Arabic UI + RTL | ✅ | كل النصوص عربية، dir="rtl" |
| Saudi Riyal font glyph | ✅ | يُستخدم عند عرض قيمة الخصم المبلغ الثابت |
| No framework (React/Vue) | ✅ | vanilla JS فقط |
| ZATCA fields untouched | ✅ | لا علاقة لهذه الميزة بـ orders/ZATCA |
| Thermal print untouched | ✅ | لا طباعة في هذه الشاشة |

**Constitution Check: PASS ✅**

---

## Project Structure

### Documentation (this feature)

```text
specs/027-product-offers/
├── plan.md              ✅ هذا الملف
├── research.md          ✅ Phase 0
├── data-model.md        ✅ Phase 1
├── quickstart.md        ✅ Phase 1
├── contracts/
│   └── api.md           ✅ Phase 1
└── tasks.md             ⏳ /speckit-tasks
```

### Source Code (repository root)

```text
database/
└── db.js                — دوال جديدة: createProductOffersTable,
                           createProductOfferLinesTable,
                           getAllProductOffers, getProductOfferById,
                           createProductOffer, updateProductOffer,
                           toggleProductOfferStatus, deleteProductOffer,
                           getProductsForOffers

server/
└── invokeHandlers.js    — cases: getProductOffers, getProductOfferById,
                           createProductOffer, updateProductOffer,
                           toggleProductOfferStatus, deleteProductOffer,
                           getProductsForOffers

assets/
└── web-api.js           — api.getProductOffers, api.getProductOfferById,
                           api.createProductOffer, api.updateProductOffer,
                           api.toggleProductOfferStatus, api.deleteProductOffer,
                           api.getProductsForOffers

screens/offers/
├── offers.html          — تيوب ثانٍ "عروض الأصناف" + modal الإضافة/التعديل
├── offers.js            — منطق التيوب الجديد + اختيار الأصناف والعمليات
└── offers.css           — تعديلات بسيطة إن لزم
```

**Structure Decision**: شاشة واحدة موجودة (`screens/offers/`) يُضاف إليها التيوب الثاني. لا شاشة جديدة منفصلة.

---

## Implementation Phases

### Phase 0 → research.md ✅
### Phase 1 → data-model.md + contracts/ + quickstart.md ✅
### Phase 2 → tasks.md (عبر `/speckit-tasks`)
