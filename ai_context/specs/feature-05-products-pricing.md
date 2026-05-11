# Feature 05 — Products & Price Lines

## Goal
إدارة قطع الملابس/المنتجات مع صورها، وتسعير كل منتج لكل خدمة مغسلة بشكل مستقل.

## Entry points
- UI: `screens/products/products.html|js|css`
- API: `getProducts`, `getProduct`, `saveProduct`, `deleteProduct`, `toggleProductStatus`, `reorderProduct`.
- Export: `POST /api/export/products`.

## Inputs
- `saveProduct` (create/update): `{ id?, nameAr, nameEn?, isActive, priceLines: [{ laundryServiceId, price }], imageBase64?, imageMime?, removeImage? }`
- `getProducts`: `{ page?, pageSize?, search? }`
- `reorderProduct`: `{ id, beforeId? }`

## Outputs
- `getProducts`: قائمة بحقول `{ id, name_ar, name_en, is_active, sort_order, has_image, price_line_count, imageDataUrl? }` (يُرفق imageDataUrl فقط لمن `has_image=1`).
- `getProduct` تفصيل كامل + `priceLines` مفصّلة باسم الخدمة.

## Rules
- `name_ar` مطلوب. `name_en` اختياري (يُحوَّل إلى NULL إن فارغ).
- الصورة:
  - max raw 15 MB، إلا يُرد `"حجم الملف كبير جداً (الحد 15 ميجابايت)"`.
  - تُخزَّن مضغوطة gzip مستوى 9 في `image_blob` + `image_mime`.
  - `removeImage=true` يمسح الصورة.
- `product_price_lines`:
  - UNIQUE `(product_id, laundry_service_id)`.
  - `price` يجب أن يكون > 0 وإلا يُهمَل السطر.
  - عند `saveProduct` تُحذَف كل الأسطر القديمة وتُعاد الإضافة.
- ترتيب العرض: `sort_order ASC, id ASC`. `reorderProduct` يعيد حساب الكل داخل transaction.

## Edge cases
- تكرار سطر price line → MySQL `ER_DUP_ENTRY` (1062) → `"تكرار: نفس العملية لهذا المنتج مسجلة مسبقاً"`.
- حذف منتج لديه price lines → CASCADE يحذف الأسطر.
- `getPosProducts` يُرجع `has_image` فقط دون الصور (lazy loading عبر `getPosProductImage`).
- إذا fail gzip decompress → `imageDataUrl = null`.

## Performance
- صور المنتج في شاشة POS تُحمَّل عند الطلب (عبر `getPosProductImage({ productId })`) لتقليل حجم الاستجابة الأوّلية.
