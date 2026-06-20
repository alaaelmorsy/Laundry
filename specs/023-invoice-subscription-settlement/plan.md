# Implementation Plan: تسوية الفواتير من رصيد الاشتراك

**Branch**: `023-invoice-subscription-settlement` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/023-invoice-subscription-settlement/spec.md`

---

## Summary

إضافة زر "تسوية فواتير" مستقل في صف كل اشتراك نشط في جدول الاشتراكات. عند الضغط يفتح modal يعرض الفواتير الغير مسددة للعميل مع إمكانية اختيارها وخصم قيمتها من رصيد الاشتراك في عملية واحدة (transaction). الزر يظهر فقط إذا كان الاشتراك نشطاً (`display_status = 'active'`).

---

## Technical Context

**Language/Version**: Node.js (CommonJS) — Backend | Vanilla JS — Frontend

**Primary Dependencies**: Express.js, mysql2/promise, existing subscription infrastructure in `database/db.js`

**Storage**: MySQL — جداول `orders`, `customer_subscriptions`, `subscription_periods`, `subscription_ledger`

**Testing**: Manual validation via quickstart.md (لا يوجد test framework في المشروع)

**Target Platform**: Windows desktop app — local Express server

**Project Type**: On-premise POS desktop application

**Performance Goals**: عملية التسوية < 2 ثانية (قاعدة بيانات محلية)

**Constraints**: Transaction atomicity — إما الكل أو لا شيء. `credit_remaining >= 0` دائماً.

**Scale/Scope**: عميل واحد في كل مرة، قائمة فواتير لا تتجاوز عشرات السجلات عادةً.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 4-Step API Checklist (db → invokeHandlers → web-api → screen) | ✅ PASS | دالتان جديدتان: `getCustomerUnpaidInvoices` + `settleInvoicesFromSubscription` |
| All queries parameterized | ✅ PASS | لا string concatenation في SQL |
| Monetary values DECIMAL(10,2) | ✅ PASS | `credit_remaining` و `total_amount` كلاهما DECIMAL(10,2) بالفعل |
| Schema migrations idempotent (try/catch) | ✅ PASS | عمود `settled_by_subscription_period_id` سيُضاف بنمط try/catch |
| Saudi Riyal symbol SaudiRiyal font | ✅ PASS | نفس النمط المستخدم في باقي شاشة الاشتراكات |
| RTL dir="rtl" | ✅ PASS | Modal جديد ضمن صفحة موجودة RTL |
| No ES modules | ✅ PASS | vanilla JS فقط |
| credit_remaining MUST never go below 0 | ✅ PASS | validation في DB layer قبل تنفيذ أي UPDATE |
| Single transaction for settlement | ✅ PASS | `beginTransaction → UPDATE orders → UPDATE subscription_periods → INSERT ledger → commit` |

**No violations.** ✅

---

## Project Structure

### Documentation (this feature)

```text
specs/023-invoice-subscription-settlement/
├── plan.md              ← هذا الملف
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── quickstart.md        ← Phase 1
├── contracts/
│   └── api-methods.md   ← Phase 1
└── tasks.md             ← /speckit-tasks (لاحقاً)
```

### Source Code (repository root)

```text
database/db.js
  ├── getCustomerUnpaidInvoices(customerId)        [جديد]
  └── settleInvoicesFromSubscription(data)         [جديد]

server/invokeHandlers.js
  ├── case 'getCustomerUnpaidInvoices'             [جديد]
  └── case 'settleInvoicesFromSubscription'        [جديد]

assets/web-api.js
  ├── getCustomerUnpaidInvoices                    [جديد]
  └── settleInvoicesFromSubscription               [جديد]

screens/subscriptions/subscriptions.html
  └── #modalSettleInvoices                         [modal جديد — داخل الصفحة الموجودة]

screens/subscriptions/subscriptions.js
  ├── زر التسوية في renderSubscriptions() — للاشتراكات النشطة فقط
  ├── openSettleInvoicesModal(subscriptionId, customerId, creditRemaining)
  ├── renderSettleInvoicesList(invoices, creditRemaining)
  └── handleSettleInvoicesConfirm()
```

**Structure Decision**: تعديل الملفات الموجودة فقط — لا شاشة جديدة، لا ملفات JS/CSS جديدة.
