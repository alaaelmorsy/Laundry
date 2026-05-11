# Feature 11 — Expenses

## Goal
تسجيل مصاريف المغسلة التشغيلية مع دعم الضريبة وتصنيف العمليات، وعرض ملخصات إجمالية لفترة زمنية، وتصديرها.

## Entry points
- UI: `screens/expenses/expenses.html|js|css`
- API: `getExpenses`, `getExpensesSummary`, `createExpense`, `updateExpense`, `deleteExpense`.
- Export: `POST /api/export/expenses`.

## Inputs
- `create/update`: `{ id?, title, category?, amount, isTaxable?, taxRate?, taxAmount?, totalAmount, expenseDate, notes?, createdBy? }`
- `getExpenses`: `{ page?, pageSize?, search?, dateFrom?, dateTo? }`.
- `getExpensesSummary`: نفس فلاتر التاريخ والبحث.

## Outputs
- `getExpenses` → قائمة مع `{ total, page, pageSize, totalPages }` (عند الترقيم).
- `getExpensesSummary` → إجماليات (total_amount, tax_amount…) حسب الفلاتر.

## Rules
- الحقول الإلزامية DB: `title`, `category` (افتراضي `عام`), `amount`, `total_amount`, `expense_date`.
- `tax_rate` افتراضي `15.00%`، `is_taxable` افتراضي 0.
- حساب الضريبة (متوقع من الواجهة):
  - `is_taxable=1`: `tax_amount = amount * tax_rate / 100`, `total_amount = amount + tax_amount`.
  - `is_taxable=0`: `tax_amount = 0`, `total_amount = amount`.
- البحث يغطي `title` و `category`.
- الترتيب: `ORDER BY expense_date DESC, id DESC`.

## Edge cases
- `expense_date` مفقود/غير صالح → ترفضه MySQL.
- تعديل `amount` لا يُعيد حساب `tax_amount/total_amount` تلقائيًا — على الواجهة إعادة إرسال القيم الصحيحة.
- تصدير بدون نتائج: ملف فارغ صالح.

## Planning history
- تفاصيل التصميم في `expenses-screen-plan.md` و `expenses-screen-plan-phase2.md`.
