# Feature 15 — Translate (Langbly)

## Goal
ترجمة نص (عربي ← إنجليزي) من الواجهة أثناء تعبئة الحقول ثنائية اللغة (أسماء الخدمات/المنتجات/المغسلة).

## Entry points
- API: `POST /api/translate` (محمي بـ `authMiddleware`).

## Inputs
```json
{ "text": "غسيل وكوي", "source": "ar", "target": "en" }
```
- `source/target` افتراضي `ar`/`en` إن غابا.

## Outputs
- نجاح: `{ success: true, text: "Wash & Iron" }`.
- فشل: `{ success: false, message }`.

## Rules
- يحتاج `LANGBLY_API_KEY` في `.env`.
- يرسل إلى `https://api.langbly.com/language/translate/v2` عبر `fetch` الأصلي (Node 18+) مع header `X-API-Key`.
- يقرأ `data.data.translations[0].translatedText` كنتيجة. غياب الحقل → "فشلت الترجمة".

## Edge cases
- نص فارغ → "النص مطلوب".
- مفتاح API غير مضبوط → "مفتاح Langbly API غير مضبوط في ملف .env".
- Rate limit أو أخطاء شبكة من Langbly → رسالة الخطأ تُنقل كما هي في `message`.
- هذا endpoint اختياري: الواجهة يجب أن تخفي زر الترجمة إن لم يُضبط المفتاح.
