<!--
  SYNC IMPACT REPORT
  ==================================================
  Version change: 0.0.0 (new) -> 1.0.0
  Modified principles: N/A (initial creation)
  Added sections:
    - Core Principles (7 principles)
    - Technology Stack & Constraints
    - Development Workflow & Standards
    - Business Logic Invariants
    - Hard Constraints
    - Tech Debt & Risks
    - Governance
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md: ⚠ pending
      (Constitution Check section references generic gates;
       update to reference PLUS Laundry principles)
    - .specify/templates/spec-template.md: ✅ compatible (no changes needed)
    - .specify/templates/tasks-template.md: ✅ compatible (no changes needed)
  Follow-up TODOs: None
  ==================================================
-->

# PLUS Laundry POS Constitution

## Core Principles

### I. Monolithic Single-Invoke Architecture

All business logic MUST route through the single `POST /api/invoke`
endpoint with `{ method, payload }` body. New backend functions MUST
be added as a case in `server/invokeHandlers.js` and registered in
`assets/web-api.js`. Dedicated REST endpoints are reserved for auth
(`/api/auth/*`), exports (`/api/export/*`), translation
(`/api/translate`), and license (`/api/license/*`).

**4-Step API Checklist** (NON-NEGOTIABLE):
1. Add DB function in `database/db.js`
2. Add handler case in `server/invokeHandlers.js`
3. Register method in `assets/web-api.js` under `window.api`
4. Call from the screen JS file

### II. Screen-Per-Page Frontend

Each feature is a self-contained screen under
`screens/<name>/<name>.{html,js,css}`. No SPA router, no component
framework, no JS module system. Each screen loads `web-api.js` and
`i18n.js` via `<script>` tags. State is plain JS objects with
imperative DOM updates. Navigation uses full page loads via
`window.api.navigateTo()`.

Frontend code MUST NOT use `import`/`export`. All shared code lives
in `assets/` and is loaded per-page.

### III. MySQL-Only Data Layer

All data persists in MySQL/MariaDB with InnoDB engine and `utf8mb4`
charset. Schema changes MUST use the migration-on-startup pattern in
`db.initialize()` with idempotent `try { ALTER } catch (_) {}`
blocks. Monetary values MUST use `DECIMAL(10,2)`. Images MUST be
stored as gzip-compressed LONGBLOBs in the database (no filesystem
storage). All queries MUST use parameterized statements. Transactions
MUST use `pool.getConnection()` -> `beginTransaction` ->
`commit`/`rollback` -> `conn.release()`.

### IV. Bilingual Arabic-First

Arabic is the primary language. All HTML pages MUST use
`<html lang="ar" dir="rtl">`. The `i18n.js` system provides `ar`
and `en` translations via `data-i18n` attributes. i18n keys use
kebab-case with screen prefix (e.g., `pos-cart-title`). The Saudi
Riyal symbol MUST use the custom `SaudiRiyal` font with glyph
`&#xE900;` and CSS class `.sar`. Phone inputs MUST normalize Eastern
Arabic digits (U+0660-0669) and Persian digits (U+06F0-06F9) to
ASCII.

### V. Uniform Response Contract

All API responses MUST follow `{ success: boolean, ...data }` or
`{ success: false, message: string }`. Business errors return HTTP
200 with `success: false`. HTTP status codes are reserved for
infrastructure errors only (400 bad request, 401 unauthorized, 500
server error). Error codes (e.g., `PHONE_DUPLICATE`,
`NAME_DUPLICATE`) SHOULD be included in a `code` field for
machine-readable error handling.

### VI. Saudi Compliance (ZATCA & VAT)

VAT rate is configurable (default 15%) in `app_settings`. Each
invoice MUST store its own `price_display_mode` at creation time
(never retroactively affected by global setting changes). ZATCA Phase
1 QR codes use TLV encoding with tags 1-5 (seller, VAT number,
timestamp, total, VAT amount). Failed ZATCA submissions retry every
15 minutes via background cron. All monetary amounts in ZATCA fields
MUST have exactly 2 decimal places.

### VII. Single-Tenant On-Premise

The system is single-tenant (one laundry per installation). Settings
use a single-row `app_settings` table (id=1). The server runs as a
local Express app with dual HTTP/HTTPS. PDF generation requires
Chrome/Chromium installed locally (`CHROME_PATH` env var). License
validation uses hardware fingerprinting (disk serial, MAC address,
baseboard serial).

## Technology Stack & Constraints

**Backend**: Node.js (CommonJS `require`), Express.js, mysql2/promise
(connection pool, limit 10), bcryptjs, jsonwebtoken, puppeteer-core,
node-cron, Baileys (WhatsApp), xlsx, jspdf.

**Frontend**: Vanilla JS (no framework), Tailwind CSS (compiled from
`assets/input.css` to `assets/tailwind.css`), Cairo font (Arabic),
per-screen CSS files.

**Database**: MySQL/MariaDB, InnoDB, utf8mb4.

**External Services**: Langbly API (translation, optional), ZATCA
(Saudi e-invoicing), Gmail SMTP (report emails), WhatsApp via
Baileys.

**Build Tools**: Tailwind CLI only. No JS bundler, no TypeScript, no
minification.

**Dev Tools**: None mandated. No test framework. No linter
configuration.

**Size Limits**:
- Express body: 25 MB
- Image uploads: 15 MB raw before gzip
- Custom fields: max 20 per settings
- Login rate limit: 50 req / 15 min
- JWT secret: >= 16 chars in production

## Development Workflow & Standards

**Naming Conventions**:
- Files/directories: kebab-case (`consumption-receipts`)
- JS functions/variables: camelCase (`getCustomers`, `loadData`)
- HTML IDs: camelCase (`btnBack`, `searchInput`)
- CSS classes: kebab-case (`header-bar`, `back-btn`)
- DB tables/columns: snake_case (`order_items`, `credit_remaining`)
- API method names: camelCase matching the DB function name
- Constants: UPPER_SNAKE_CASE (`MAX_PRODUCT_IMAGE_RAW_BYTES`)
- i18n keys: kebab-case with screen prefix (`invoices-search-placeholder`)

**Error Handling**: Every invoke handler case MUST wrap in try/catch
returning `{ success: false, message: err.message }`. Silent
`catch (_) {}` is permitted ONLY in migration code and optional
features (WhatsApp auto-connect, fire-and-forget ZATCA).

**Async**: async/await throughout. No callbacks. Fire-and-forget for
non-critical side effects uses `setImmediate(async () => { ... })`.

**Frontend Patterns**:
- DOM refs cached at init via `getElementById` (either flat `const`
  variables or `const els = {}` object)
- Tables rendered via `innerHTML` with template literals
- Modals opened/closed via `style.display` toggle
- Search inputs debounced at 300ms via setTimeout/clearTimeout
- Toast notifications auto-removed after 3000-3500ms
- Pagination with first/prev/next/last buttons and page-size select
- Escape key closes modals; backdrop click closes modals

**Auth Model**: JWT in httpOnly cookie `laundry_auth` (7-day expiry).
Roles: `admin` and `cashier`. Admin bypasses all permission checks.
Permission checks are client-side only via `data-permission`
attributes and `auth-guard.js`. Server trusts JWT identity but does
NOT enforce per-method authorization.

## Business Logic Invariants

1. `credit_remaining >= 0` ALWAYS on subscription periods
2. Only ONE `active` subscription period per customer at any time
3. Subscription ledger entries are append-only (no DELETE operations)
4. `orders.total_amount = subtotal - discount + vat_amount`
   (computed on frontend, stored as-is)
5. Subscription deduction is parallel credit usage, NOT a cash
   payment -- it does NOT reduce `remaining_amount` on the invoice
6. Each invoice stores its own `price_display_mode` at creation time
7. `order_number` and `invoice_seq` are independent sequential
   counters, both generated inside transactions
8. Mixed payment: `paid_cash + paid_card == total_amount`
   (tolerance <= 0.01 SAR)
9. Deferred (credit) orders: `payment_status=pending`,
   `paid_at=NULL`, `paid_amount=0`, `remaining_amount=total`
10. One subscription per customer; second attempt is rejected
11. All monetary values use `DECIMAL(10,2)`
12. All DB tables use `utf8mb4 / InnoDB`
13. DB auto-initializes on `db.initialize()` (create DB, run
    migrations, seed defaults)

## Hard Constraints

**MUST NEVER be broken:**

1. Every new API method MUST follow the 4-step checklist (db.js ->
   invokeHandlers.js -> web-api.js -> screen JS)
2. All queries MUST use parameterized statements (no string
   concatenation for SQL)
3. Monetary values MUST be `DECIMAL(10,2)` -- never floats
4. Schema migrations MUST be idempotent (try/catch pattern)
5. The Saudi Riyal symbol MUST use the SaudiRiyal font glyph
6. All pages MUST be RTL with `dir="rtl"` (except phone inputs
   which use `dir="ltr"`)
7. Image storage MUST be gzip-compressed BLOBs in the database
8. Frontend MUST NOT use ES modules (import/export)
9. Subscription `credit_remaining` MUST never go below 0
10. Invoice `price_display_mode` MUST be frozen at creation time
11. JWT cookie MUST be httpOnly with sameSite=lax
12. `createOrder` MUST run entirely within a single transaction

## Tech Debt & Risks

**Security Risks (HIGH)**:
- `password_plain` column exists and is returned by `getAllUsers`
  API -- plaintext passwords visible to admin users
- No server-side per-method authorization -- any authenticated user
  can call any invoke method
- Hardcoded fallback DB password `'Db2@dm1n2022'` in `db.js:32`
- No CSRF protection beyond `sameSite: 'lax'` cookie
- No global Express error handler middleware

**Code Duplication (MEDIUM)**:
- `escHtml()`, `showToast()`, `formatDate()`, `sarFmt()`/`sarHtml()`
  are reimplemented in nearly every screen JS file
- Invoice display logic duplicated across pos.js, invoices.js,
  credit-invoices.js, consumption-receipts.js
- Pagination logic duplicated across all CRUD screens

**Complexity (MEDIUM)**:
- `screens/pos/pos.js` is 6,266 lines -- monolithic file containing
  cart, subscription, deferred invoices, refunds, loyalty, invoice
  rendering, A4 invoice, consumption receipts
- `server/invokeHandlers.js` is ~1,700 lines with ~120+ switch cases
- `database/db.js` contains all DB functions (no separation)

**Missing Architecture**:
- No test framework or test files
- No linter or formatter configuration
- No CI/CD pipeline
- No logging framework (console.log only)
- No API versioning strategy

## Governance

This constitution supersedes all ad-hoc practices. All new features
and modifications MUST comply with the principles and hard
constraints defined above. Amendments require:

1. Documentation of the change and rationale
2. Version increment following semver (MAJOR for principle
   removal/redefinition, MINOR for new sections, PATCH for
   clarifications)
3. Update of the Sync Impact Report at the top of this file
4. Propagation of changes to dependent templates

Complexity beyond established patterns MUST be justified. The
`ai_context/` documentation and `AGENTS.md` provide runtime
development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-06-11 | **Last Amended**: 2026-06-11
