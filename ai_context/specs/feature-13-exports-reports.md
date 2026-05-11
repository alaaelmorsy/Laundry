# Feature 13 — Exports & Reports (Excel / PDF)

## Goal
تصدير بيانات الوحدات الرئيسية إلى Excel أو PDF، وطباعة إيصالات الاشتراك الحرارية.

## Entry points
- API (مع `authMiddleware`):
  - `POST /api/export/expenses`
  - `POST /api/export/customers`
  - `POST /api/export/products`
  - `POST /api/export/subscriptions`
  - `POST /api/export/subscription-customer-report`
  - `POST /api/export/subscription-receipt-pdf`
  - `POST /api/subscriptions/receipt-print-html`
- Service: `server/services/exportsService.js` + قوالب `reportHtml.js` + `pdfFromHtml.js`.

## Inputs
- كل endpoint يستقبل `{ type: 'excel'|'pdf', filters: { ... } }`.
- `subscription-customer-report` إضافي: `{ customerId, subscriptionId? }`.
- `subscription-receipt-pdf`: `{ periodId }`.
- `receipt-print-html`: `{ periodId }` → يُرجع `{ success, html }` للطباعة من الواجهة.

## Outputs
- استجابة ثنائية (Buffer) مع:
  - `Content-Type`: إما `application/vnd.openxmlformats...` أو `application/pdf`.
  - `Content-Disposition: attachment; filename="..."` (URL-encoded).

## Rules
- Excel: مكتبة `xlsx`.
- PDF: `puppeteer-core` يقرأ HTML من `reportHtml.js` ويُحوّله لـ PDF.
  - يحتاج Chrome محلي؛ `CHROME_PATH` يمكن ضبطه صراحةً.
- الإيصال الحراري: HTML مخصّص يُرسَل كنص للواجهة لطباعته مباشرة.
- التصدير يتجاوز الترقيم (يُرسل كل النتائج بعد حذف `page/pageSize`).

## Edge cases
- غياب Chrome على الخادم → PDF يفشل. يجب fallback إلى رسالة واضحة.
- ملفات ضخمة: الحد 25 MB من express (لكن التصدير يبنى على الخادم قبل الإرسال).
- بيانات RTL داخل PDF: تأكد من خطوط عربية مضمّنة في القالب.
