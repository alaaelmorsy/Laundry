# Feature 07 — Customer Subscriptions

## Goal
ربط العميل بباقة محددة وإدارة دورة حياتها: شراء، تجديد، إيقاف، استئناف، تعديل، حذف، مع تتبع كل حركة في دفتر `subscription_ledger`.

## Entry points
- UI: `screens/subscriptions/subscriptions.html|js`
- API: `getCustomerActiveSubscription`, `getCustomerSubscriptionsList`, `getSubscriptionDetail`, `getSubscriptionPeriods`, `getSubscriptionLedger`, `createSubscription`, `renewSubscription`, `stopSubscription`, `resumeSubscription`, `updateActiveSubscriptionPeriod`, `deleteSubscription`.
- Reports/Exports: `/api/export/subscriptions`, `/api/export/subscription-customer-report`, `/api/export/subscription-receipt-pdf`, `/api/subscriptions/receipt-print-html`.

## Inputs (أبرزها)
- `createSubscription`: `{ customerId, packageId, periodFrom?, periodTo?, endDate?, createdBy? }`
- `renewSubscription`: `{ subscriptionId, packageId, periodFrom?, periodTo?, carryOverRemaining?, createdBy? }`
- `updateActiveSubscriptionPeriod`: `{ subscriptionId, periodFrom?, periodTo?, endDate?, creditRemaining?, createdBy? }`
- فلاتر القائمة: `{ customerId?, search?, statusFilter?, dateFrom?, dateTo?, page?, pageSize? }`.

## Outputs
- Subscription rows مع محسوبات: `package_name`, `credit_remaining`, `period_from/to`, `display_status` ∈ `{none, active, expired, closed}`.

## Rules
- **عميل واحد = اشتراك واحد**. محاولة ثانية ترفض: `"هذا العميل لديه اشتراك بالفعل…"`.
- `subscription_ref = 'SUB-' + pad(subId,6)`.
- أول اشتراك يُعيِّن `customers.subscription_number` تلقائيًا من `MAX(numeric)+1`.
- **period_from**: فارغ → CURDATE (إنشاء)، أو `last.period_to + 1 day` (تجديد، مع عدم الرجوع للماضي).
- **period_to** NULL = باقة مفتوحة بدون انتهاء.
- **Credit**:
  - إنشاء: `granted = remaining = service_credit_value`.
  - تجديد: `new = package.service_credit_value + carry(last.remaining إن carryOverRemaining)`.
  - إغلاق الفترة السابقة إلى `closed` قبل إنشاء الجديدة.
- **Ledger entries**:
  - `purchase` عند الإنشاء، `renewal` عند التجديد، `consumption` عند دفع فاتورة من الرصيد، `adjustment` عند تعديل يدوي للرصيد، `refund` (محجوز).
- **stop/resume**:
  - `stop`: يجب فترة active → تحوّل إلى closed.
  - `resume`: يجب عدم وجود active وأن تكون آخر فترة closed.
- **Expired auto-refresh**: `refreshExpiredSubscriptionPeriods` يُنفَّذ قبل كل قراءة ويحوّل `active → expired` إذا `period_to < CURDATE()`.

## Edge cases
- `updateActiveSubscriptionPeriod` يرفض `period_from > period_to` إن وُجدا، ويرفض رصيدًا سالبًا.
- `deleteSubscription`: CASCADE يحذف periods و ledger وأرصدة ضائعة.
- تجديد بفترة تبدأ في الماضي قبل اليوم: الشيفرة تستبدلها بـ CURDATE تلقائيًا.
- إذا لم تكن `carryOverRemaining` مُرسَلة، يُفترض `true`.
