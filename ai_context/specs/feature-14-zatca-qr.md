# Feature 14 — ZATCA QR Code (Phase 1 Simplified)

## Goal
توليد رمز QR متوافق مع ZATCA المرحلة الأولى (Simplified Invoice) لعرضه على فاتورة المبيعات.

## Entry points
- API: `generateZatcaQR` عبر `/api/invoke`.
- Client: يستدعيها `screens/pos/pos.js` وصفحات طباعة الفاتورة.

## Inputs
```json
{
  "sellerName": string,
  "vatNumber": string,
  "timestamp": string,  // ISO 8601
  "totalAmount": string, // "123.45"
  "vatAmount": string    // "18.52"
}
```

## Outputs
- `{ success: true, svg: "<svg ...>...</svg>" }`.

## Rules
- بناء TLV buffer: لكل حقل tag+length+value، في الترتيب: `1,2,3,4,5`.
- الطول عبارة عن byte واحد (يفترض قيم < 256 byte UTF-8 لكل حقل).
- الناتج يُحوَّل base64 ثم يُمرَّر لمكتبة `qrcode`:
  - `type: 'svg'`, `errorCorrectionLevel: 'M'`, `margin: 1`, `width: 120`.

## Edge cases
- قيم فارغة → تُكتب كـ `''` ثم `length=0` (لا يفشل لكن QR قد يُرفض).
- `totalAmount` / `vatAmount` يجب أن يكونا نصوصًا بعشرتَين فقط (مثل `"12.34"`).
- حقول تتجاوز 255 byte UTF-8 (اسم طويل جداً) ستفسد TLV — يجب التقصير على الواجهة.
- `timestamp` يستخدم توقيت UTC ISO كاملًا (مثال: `2024-01-15T12:34:56Z`).
