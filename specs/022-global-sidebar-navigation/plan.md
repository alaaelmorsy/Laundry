# Implementation Plan: Global Sidebar Navigation

**Branch**: `022-global-sidebar-navigation` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/022-global-sidebar-navigation/spec.md`

## Summary

إضافة قائمة جانبية عامة تظهر في جميع الشاشات على أجهزة الكمبيوتر (عرض ≥ 768px) وتختفي تماماً على الجوال. القائمة مستوحاة من تصميم القائمة الجانبية الموجودة في `screens/settings/settings.html` ومنفذة كمكوّن مشترك (`assets/sidebar.js` + `assets/sidebar.css`) يُضمَّن في كل شاشة مستهدفة. التنقل عبر `window.api.navigateTo()`.

---

## Technical Context

**Language/Version**: Node.js (CommonJS) — Vanilla JS (no framework)

**Primary Dependencies**: Tailwind CSS (compiled), Cairo font, `assets/web-api.js`, `assets/auth-guard.js`

**Storage**: `localStorage` لحفظ حالة الطي (مطوية/كاملة)

**Testing**: Manual (no test framework in project)

**Target Platform**: Desktop browser (Electron wrapper) + mobile browser

**Project Type**: Desktop web app (multi-screen, no SPA router)

**Performance Goals**: القائمة تعرض فوراً بلا تأخر (CSS-driven transitions)

**Constraints**: لا import/export — كل الكود vanilla JS يُحمَّل بـ `<script>` tag. RTL أساسي. لا تغيير على هيكل HTML الحالي للشاشات إلا بإضافة wrapper div والـ sidebar HTML.

**Scale/Scope**: ~17 شاشة رئيسية تحتاج القائمة (كل الشاشات عدا login, installing, invoice-a4, payment).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Screen-Per-Page Frontend (Principle II) | ✅ | مكوّن مشترك في `assets/` محمَّل بـ `<script>` — لا SPA router ولا framework |
| لا import/export (Principle II) | ✅ | `sidebar.js` يُصدِّر دوال عبر `window.Sidebar` |
| RTL + `dir="rtl"` (Principle IV) | ✅ | القائمة تدعم RTL/LTR عبر `html[dir]` selectors كنمط التصميم الحالي |
| Bilingual i18n (Principle IV) | ✅ | نصوص القائمة عبر مفاتيح i18n موجودة في `assets/i18n.js` |
| لا backend changes (Principles I/III) | ✅ | ميزة frontend بحتة — لا API جديد، لا DB |
| Auth via `window.__currentUser` (Dev Standards) | ✅ | يُقرأ بعد `userReady` event من `auth-guard.js` |

**لا انتهاكات للدستور.**

---

## Project Structure

### Documentation (this feature)

```text
specs/022-global-sidebar-navigation/
├── plan.md              ← هذا الملف
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── quickstart.md        ← Phase 1
└── tasks.md             ← /speckit-tasks (لم يُنشأ بعد)
```

### Source Code (repository root)

```text
assets/
├── sidebar.js           ← NEW: مكوّن القائمة الجانبية (vanilla JS)
└── sidebar.css          ← NEW: تنسيقات القائمة الجانبية

screens/
├── dashboard/dashboard.html            ← MODIFIED: إضافة sidebar
├── pos/pos.html                        ← MODIFIED: إضافة sidebar
├── invoices/invoices.html              ← MODIFIED: إضافة sidebar
├── credit-invoices/credit-invoices.html ← MODIFIED: إضافة sidebar
├── consumption-receipts/…html          ← MODIFIED: إضافة sidebar
├── hangers/hangers.html                ← MODIFIED: إضافة sidebar
├── subscriptions/subscriptions.html    ← MODIFIED: إضافة sidebar
├── customers/customers.html            ← MODIFIED: إضافة sidebar
├── reports/reports.html                ← MODIFIED: إضافة sidebar
├── products/products.html              ← MODIFIED: إضافة sidebar
├── services/services.html              ← MODIFIED: إضافة sidebar
├── users/users.html                    ← MODIFIED: إضافة sidebar
├── roles/roles.html                    ← MODIFIED: إضافة sidebar
├── expenses/expenses.html              ← MODIFIED: إضافة sidebar
├── offers/offers.html                  ← MODIFIED: إضافة sidebar
├── whatsapp/whatsapp.html              ← MODIFIED: إضافة sidebar
├── zatca-settings/zatca-settings.html  ← MODIFIED: إضافة sidebar
├── settings/settings.html             ← MODIFIED: استبدال القائمة الداخلية بـ nav global + الإبقاء على تبويبات الإعدادات
├── login/login.html                    ← NO CHANGE
├── installing/installing.html          ← NO CHANGE
├── invoice-a4/invoice-a4.html          ← NO CHANGE (print page)
└── payment/payment.html                ← NO CHANGE (modal-style)
```

**Structure Decision**: مكوّن مشترك في `assets/` — يتبع نمط `auth-guard.js` و`web-api.js` الحاليَّين.

---

## Complexity Tracking

لا انتهاكات للدستور تحتاج تبريراً.
