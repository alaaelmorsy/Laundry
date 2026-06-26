<!--
  SYNC IMPACT REPORT
  ==================================================
  Version change: 1.0.0 -> 1.2.0
  Modified principles:
    - I. Monolithic Single-Invoke Architecture (clarified, unchanged)
    - VI. Saudi Compliance (clarified ZATCA immutability rule)
  Added sections:
    - Project Priorities (explicit priority ordering)
    - VIII. New Feature Development Pattern (mandatory stack pattern)
    - IX. Business Logic Immutability (invoice/tax/ZATCA/subscription protection)
    - X. Database Backward Compatibility (safe migration rules)
    - XI. MySQL 5.7 Compatibility (SQL dialect constraints)
    - XII. Feature Impact Assessment (7-area mandatory checklist)
    - Hard Constraints 16 + 17 (MySQL 5.7 + impact assessment gates)
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md: ✅ updated (2026-06-26)
    - .specify/templates/spec-template.md: ✅ compatible
    - .specify/templates/tasks-template.md: ✅ compatible
  Follow-up TODOs: None
  ==================================================
-->

# PLUS Laundry POS Constitution

## Project Priorities

When tradeoffs occur, prioritize in this exact order (never sacrifice a
higher-priority item for a lower one):

1. **Data integrity** — no data loss, no silent corruption, no inconsistent state
2. **ZATCA compliance** — legally mandatory; unauthorized changes are a regulatory risk
3. **Existing workflow stability** — POS, subscriptions, invoices, refunds MUST keep working
4. **Backward compatibility** — existing customer deployments MUST NOT break on update
5. **Correct business behavior** — calculations, balances, and statuses MUST be accurate
6. **Maintainability** — code MUST be readable and follow established patterns
7. **Performance** — speed matters but not at the cost of any higher item
8. **Developer convenience** — tooling, shortcuts, abstractions come last

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

ZATCA submission workflow MUST NOT be altered without explicit written
requirement from the project owner.

### VII. Single-Tenant On-Premise

The system is single-tenant (one laundry per installation). Settings
use a single-row `app_settings` table (id=1). The server runs as a
local Express app with dual HTTP/HTTPS. PDF generation requires
Chrome/Chromium installed locally (`CHROME_PATH` env var). License
validation uses hardware fingerprinting (disk serial, MAC address,
baseboard serial).

### VIII. New Feature Development Pattern

Every new feature MUST follow the existing stack. No exceptions without
explicit written owner approval.

- **Backend**: Node.js CommonJS (`require`), Express.js, `mysql2/promise`
- **Frontend**: Vanilla JS (no framework, no bundler, no TypeScript)
- **Screen structure**: `screens/<feature>/<feature>.{html,js,css}`
- **API**: `POST /api/invoke` → `invokeHandlers.js` case → `db.js` function
- **DB logic**: ALL queries in `database/db.js`. Never in `invokeHandlers.js`.
- **No ORM** — raw `mysql2` queries only
- **No new frontend frameworks** — Tailwind + vanilla JS only
- **Reuse before create**: search existing APIs, DB functions, and screens
  before introducing any new ones.

### IX. Business Logic Immutability

The following calculations and workflows are FROZEN. They MUST NOT be
modified unless the request explicitly and unambiguously targets them:

- Invoice total calculation (`subtotal - discount + vat_amount`)
- VAT calculation and `price_display_mode` handling
- ZATCA submission logic and retry mechanism
- Subscription balance deduction (credit usage != cash payment)
- Partial payment / mixed payment logic (`paid_cash + paid_card == total`)
- Deferred (credit) invoice creation and settlement flow
- Refund balance update logic
- Loyalty points earn/redeem calculation

If a change appears to require touching these areas but the spec does not
explicitly call for it, STOP and ask for clarification.

### X. Database Backward Compatibility

All database schema changes MUST be safe for existing customer installations.

- Migrations MUST be additive: `ADD COLUMN`, `CREATE TABLE`, `ADD INDEX`
- NEVER use `DROP COLUMN`, `RENAME COLUMN`, `DROP TABLE`, or `RENAME TABLE`
  in migrations
- New `NOT NULL` columns MUST have a `DEFAULT` value
- Deprecated columns stay in the schema as nullable (no code references them)
- Every migration MUST be wrapped in `try { ... } catch (_) {}` to be idempotent
- Every migration function MUST be registered in `db.initialize()` in order
- NEVER run DDL from `invokeHandlers.js` — schema changes belong only in `db.js`

### XI. MySQL 5.7 Compatibility

All SQL MUST be compatible with MySQL 5.7 unless explicit written approval
is granted for a specific query. This ensures compatibility with older
customer installations.

Prohibited without approval:
- `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()` and other window functions
  (added in MySQL 8.0)
- `JSON_TABLE()` (MySQL 8.0 only)
- `LATERAL` joins (MySQL 8.0 only)
- `WITH RECURSIVE` CTEs (MySQL 8.0 only)
- `INVISIBLE` columns
- Any syntax flagged as MySQL 8.0+ in the official docs

Safe for MySQL 5.7:
- Standard `WITH` (non-recursive CTEs are NOT in 5.7 — use subqueries instead)
- `JSON_EXTRACT`, `JSON_OBJECT`, `JSON_ARRAY` (available since 5.7.8)
- `GROUP BY`, `ORDER BY`, `HAVING`, `LIMIT`, `OFFSET`
- Standard `INSERT … ON DUPLICATE KEY UPDATE`

### XII. Feature Impact Assessment

Every new feature and every bug fix MUST include an explicit impact
assessment across all seven areas before implementation begins:

| Area | Gate Question |
|------|--------------|
| Database | Are all migrations additive, idempotent, MySQL-5.7-safe, and registered? |
| POS | Is `createOrder` flow and cart/payment/receipt behavior unaffected? |
| ZATCA | Are `orders` ZATCA columns untouched and submission/retry unaffected? |
| Subscriptions | Is `credit_remaining >= 0` enforced and balance deduction logic intact? |
| Payments | Is the invoice total formula and mixed-payment tolerance unchanged? |
| Printing | Are thermal dimensions (`76mm / margin: 0 auto`) and print zone pattern intact? |
| Backward Compatibility | Are existing customer deployments and API callers unaffected? |

A feature MUST NOT be marked complete until all seven areas are verified.

## Technology Stack & Constraints

**Backend**: Node.js 20 (CommonJS `require`), Express.js, mysql2/promise
(connection pool, limit 10), bcryptjs, jsonwebtoken, puppeteer-core,
node-cron, Baileys (WhatsApp), xlsx, jspdf.

**Frontend**: Vanilla JS (no framework), Tailwind CSS (compiled from
`assets/input.css` to `assets/tailwind.css`), Cairo font (Arabic),
per-screen CSS files.

**Database**: MySQL/MariaDB, InnoDB, utf8mb4.

**Build**: `@yao-pkg/pkg` (Node 20, x64) → `release/laundry-app.exe`.
Inno Setup → installer. Tailwind CLI only.

**External Services**: Langbly API (translation, optional), ZATCA
(Saudi e-invoicing), Gmail SMTP (report emails), WhatsApp via Baileys.

**Size Limits**:
- Express body: 25 MB
- Image uploads: 15 MB raw before gzip
- Login rate limit: 50 req / 15 min

## Development Workflow & Standards

**Naming Conventions**:
- Files/directories: kebab-case (`consumption-receipts`)
- JS functions/variables: camelCase (`getCustomers`, `loadData`)
- HTML IDs: camelCase (`btnBack`, `searchInput`)
- CSS classes: kebab-case (`header-bar`, `back-btn`)
- DB tables/columns: snake_case (`order_items`, `credit_remaining`)
- API method names: camelCase matching the DB function name
- i18n keys: kebab-case with screen prefix (`invoices-search-placeholder`)

**Error Handling**: Every invoke handler case MUST wrap in try/catch
returning `{ success: false, message: err.message }`. Silent
`catch (_) {}` is permitted ONLY in migration code and optional
features (WhatsApp auto-connect, fire-and-forget ZATCA).

**Async**: async/await throughout. No callbacks.

**Frontend Patterns**:
- DOM refs cached at init via `getElementById`
- Tables rendered via `innerHTML` with template literals
- Modals opened/closed via `style.display` toggle
- Search inputs debounced at 300ms via setTimeout/clearTimeout
- Toast notifications auto-removed after 3000-3500ms
- Pagination with first/prev/next/last buttons and page-size select
- Escape key + backdrop click close modals

**Auth Model**: JWT in httpOnly cookie `laundry_auth` (7-day expiry).
Roles: `admin` and `cashier`. Admin bypasses all permission checks.

## Business Logic Invariants

1. `credit_remaining >= 0` ALWAYS on subscription periods
2. Only ONE `active` subscription period per customer at any time
3. Subscription ledger entries are append-only (no DELETE operations)
4. `orders.total_amount = subtotal - discount + vat_amount`
5. Subscription deduction is credit usage, NOT a cash payment
6. Each invoice stores its own `price_display_mode` at creation time
7. `order_number` and `invoice_seq` are independent sequential counters
8. Mixed payment: `paid_cash + paid_card == total_amount` (tolerance <= 0.01)
9. Deferred orders: `payment_status=pending`, `paid_at=NULL`, `paid_amount=0`
10. One subscription per customer; second attempt is rejected
11. All monetary values use `DECIMAL(10,2)`
12. All DB tables use `utf8mb4 / InnoDB`

## Hard Constraints

**MUST NEVER be broken:**

1. Every new API method MUST follow the 4-step checklist
2. All queries MUST use parameterized statements
3. Monetary values MUST be `DECIMAL(10,2)` — never floats
4. Schema migrations MUST be idempotent (try/catch pattern)
5. The Saudi Riyal symbol MUST use the SaudiRiyal font glyph
6. All pages MUST be RTL with `dir="rtl"`
7. Image storage MUST be gzip-compressed BLOBs in the database
8. Frontend MUST NOT use ES modules (import/export)
9. Subscription `credit_remaining` MUST never go below 0
10. Invoice `price_display_mode` MUST be frozen at creation time
11. JWT cookie MUST be httpOnly with sameSite=lax
12. `createOrder` MUST run entirely within a single transaction
13. New features MUST follow the existing stack (Principle VIII)
14. Business logic calculations MUST NOT be changed without explicit requirement (Principle IX)
15. All DB migrations MUST be backward-compatible (Principle X)
16. All SQL MUST be MySQL 5.7 compatible unless explicitly approved (Principle XI)
17. Every feature/fix MUST complete the 7-area impact assessment (Principle XII)

## Tech Debt & Risks

**Security Risks (HIGH)**:
- `password_plain` column exists and is returned by `getAllUsers`
  API — plaintext passwords visible to admin users
- No server-side per-method authorization — any authenticated user
  can call any invoke method
- Hardcoded fallback DB password in `db.js`
- No CSRF protection beyond `sameSite: 'lax'` cookie

**Code Duplication (MEDIUM)**:
- `escHtml()`, `showToast()`, `formatDate()`, `sarFmt()`/`sarHtml()`
  are reimplemented in nearly every screen JS file
- `screens/pos/pos.js` is a monolithic 6,000+ line file
- `server/invokeHandlers.js` is ~1,700 lines with 120+ switch cases

**Missing Architecture**:
- No test framework or test files
- No linter configuration
- No CI/CD pipeline
- No logging framework (console.log only)

## Governance

This constitution supersedes all ad-hoc practices. All new features
and modifications MUST comply with the principles and hard constraints
above. Amendments require:

1. Documentation of the change and rationale
2. Version increment following semver
3. Update of the Sync Impact Report at the top of this file
4. Propagation of changes to dependent templates

`PROJECT_CONSTITUTION.md` at the repo root is the authoritative
full-detail reference. `CLAUDE.md` is the daily AI agent guide.
This constitution (`.specify/memory/constitution.md`) is the Spec Kit
governance source.

**Version**: 1.2.0 | **Ratified**: 2026-06-11 | **Last Amended**: 2026-06-26
