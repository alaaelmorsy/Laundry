# Feature 08 — POS (Point of Sale)

## Goal
إصدار فواتير مغسلة بسرعة عبر اختيار منتجات × خدمات × كميات، تطبيق خصم وضريبة، تحديد طريقة الدفع، والخصم التلقائي من اشتراك العميل النشط إن وُجد.

## Entry points
- UI: `screens/pos/pos.html|js|css`
- API: `getPosProducts`, `getPosProductImage`, `getPosServices`, `createOrder`, `generateZatcaQR`.

## Inputs
- `createOrder`:
  ```json
  {
    "customerId": number|null,
    "items": [{ "productId": int, "serviceId": int, "quantity": int, "unitPrice": number, "lineTotal": number }],
    "subtotal": number,
    "discountAmount": number,
    "vatRate": number,
    "vatAmount": number,
    "totalAmount": number,
    "paymentMethod": "cash"|"card"|"credit"|...,
    "paidCash": number,   // 0 إذا لم يكن mixed
    "paidCard": number,   // 0 إذا لم يكن mixed
    "notes": string|null,
    "priceDisplayMode": "inclusive"|"exclusive"
  }
  ```

## Outputs
- `{ success, id, orderNumber, invoiceSeq }` (يُضاف `createdBy` من JWT).

## Rules
- `getPosProducts`/`getPosServices` يعرضان فقط العناصر المفعّلة (`is_active=1`) مرتّبة بـ `sort_order`.
- `order_number = MAX(CAST(order_number AS UNSIGNED)) + 1`. مستقل عن `invoice_seq`.
- `payment_method`:
  - `credit` → `payment_status=pending`, `paid_amount=0`, `remaining_amount=total`.
  - غير ذلك → `payment_status=paid`, `paid_at=now`, `paid_amount=total`, `remaining_amount=0`.
- `price_display_mode` يُحفَظ على مستوى الفاتورة (حماية من تغيير الإعداد العام لاحقًا).
- **خصم الاشتراك التلقائي**: إذا كان للعميل فترة `active` و `credit_remaining > 0`:
  - `deduct = min(total, credit_remaining)`
  - ينقص `credit_remaining` ويُسجَّل ledger بـ `consumption` + `ref_type='order', ref_id=orderId`, `notes='فاتورة رقم {invoiceSeq}'`.
  - فشل الخصم لا يُلغي الفاتورة (catch).

## Edge cases
- لا يوجد عميل (بيع عابر) → `customer_id = null`، لا خصم اشتراك.
- صفر عناصر → يُنشأ أمر فارغ (الواجهة يجب أن تمنع).
- صور المنتجات تُحمَّل lazy عبر `getPosProductImage` لتفادي كبر الاستجابة.
- ZATCA QR يُولَّد عبر `generateZatcaQR` بعد الحفظ (TLV Tags 1..5 → base64 → SVG).

## Transaction
- كل `createOrder` يتم داخل transaction (orders + order_items + subscription debit + ledger) مع rollback عند أي فشل في الأسطر.
