<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
[specs/029-customer-custom-prices/plan.md](specs/029-customer-custom-prices/plan.md)
<!-- SPECKIT END -->

# CLAUDE.md — PLUS Laundry AI Agent Guide

## 0. Mandatory First Rule

**Before making any code change, always read this file first and follow it.
If a request conflicts with this file, ask for clarification before changing code.**

---

## 1. Source of Truth

| Document | Purpose |
|----------|---------|
| [PROJECT_CONSTITUTION.md](PROJECT_CONSTITUTION.md) | Full authoritative rules, workflows, code patterns |
| [.specify/memory/constitution.md](.specify/memory/constitution.md) | Spec Kit governance source (version-controlled) |
| This file (`CLAUDE.md`) | Daily AI agent guide — concise, practical, always read first |

**Project Priorities** (never sacrifice a higher for a lower):

1. Data integrity — no data loss, no silent corruption
2. ZATCA compliance — legally mandatory
3. Workflow stability — POS, subscriptions, invoices, refunds must keep working
4. Backward compatibility — existing customer deployments must not break
5. Correct business behavior — calculations and balances must be accurate
6. Maintainability — follow established patterns
7. Performance
8. Developer convenience

---

## 2. Project Overview

**PLUS Laundry** — نظام نقاط بيع لمحلات التنظيف الجاف

| Property | Value |
|----------|-------|
| Runtime | Node.js 20 → Windows `.exe` via `@yao-pkg/pkg` |
| Frontend | Vanilla JS, no framework, no bundler, no TypeScript |
| Database | MySQL via `mysql2/promise`, no ORM |
| Deployment | Windows Service (NSSM), single-tenant on-premise |
| Version | `package.json` → `"version"` |
| Compliance | ZATCA e-invoicing (Saudi Arabia) |

---

## 3. Project Structure

```
server/
  index.js                   — Express entry point, auth routes, cron jobs, ZATCA scheduler
  paths.js                   — APP_ROOT / DATA_ROOT resolution (pkg-aware)
  invokeHandlers.js          — ALL /api/invoke business logic, single switch(method)
  middleware/auth.js         — JWT sign/verify, authMiddleware
  services/
    updateService.js         — GitHub Releases auto-update
    zatcaBridge.js           — ZATCA singleton (LocalZatcaBridge)
    whatsappService.js       — WhatsApp via Baileys
    reportEmailScheduler.js  — Daily report email cron
    exportsService.js        — Excel/PDF exports
    reportHtml.js / emailService.js / branding.js
database/
  db.js                      — MySQL pool + ALL db functions + ALL migrations
assets/
  web-api.js                 — window.api (browser-side invoke wrapper)
  tailwind.css / input.css
screens/
  pos/                       — Point of Sale (pos.html, pos.js, pos.css)
  invoices/                  — Invoice list
  credit-invoices/           — Deferred/credit invoices
  consumption-receipts/      — Subscription consumption
  customers/ products/ services/ subscriptions/ offers/ expenses/
  users/ roles/ dashboard/ payment/ invoice-a4/ login/ settings/
  zatca-settings/ whatsapp/ installing/
  reports/                   — daily-report, period-report, all-invoices-report,
                               worker-report, subscriptions-report, zakat-report, ...
scripts/
  updater.ps1 / launch-updater.ps1   — exe rename updater (Task Scheduler)
  launch-installer.ps1 / run-installer.ps1 — Inno Setup installer
  install-service.ps1                — NSSM service setup
installer/laundry.iss        — Inno Setup script
release/laundry-app.exe      — Built exe (committed to repo)
specs/<NNN>-<feature>/       — spec.md, plan.md, tasks.md
```

**Runtime paths** (from `server/paths.js`):
```js
APP_ROOT  = path.join(__dirname, '..')    // bundled files: screens, assets, scripts
DATA_ROOT = isPkg ? EXEC_DIR : APP_ROOT  // writable files: .env, data/, ssl/
DATA_DIR  = path.join(DATA_ROOT, 'data') // logs/, update-status.json, whatsapp_session/
```
PowerShell scripts cannot read files inside the pkg snapshot — copy to `DATA_DIR` first.

---

## 4. API Architecture — 4-Step Checklist

Every new API method requires ALL 4 steps. Missing any step breaks the feature.

1. **`database/db.js`** — add a named export function with parameterized query
2. **`server/invokeHandlers.js`** — add `case 'methodName':` inside the `invoke()` switch
3. **`assets/web-api.js`** — add `api.methodName = (p) => invoke('methodName', p)`
4. **Screen JS** — call `window.api.methodName(payload)` (never `fetch('/api/invoke')` directly)

> `server/index.js` is for auth routes (`/api/auth/*`), exports (`/api/export/*`), binary/file
> download endpoints, and special infrastructure routes only. It is **not** part of normal
> `/api/invoke` features.

**Request flow:**
```
window.api.methodName(payload)
  → POST /api/invoke { method, payload }
    → invokeHandlers.js switch(method)
      → db.js namedFunction()
        → MySQL
```

**Response shape** — always one of:
```js
{ success: true,  ...data }
{ success: false, message: 'Arabic error string' }
```

---

## 5. Database Rules

- Schema changes are **additive only**: `ADD COLUMN`, `CREATE TABLE`, `ADD INDEX`
- **NEVER** `DROP COLUMN`, `RENAME COLUMN`, `DROP TABLE`, or `RENAME TABLE` in migrations
- New `NOT NULL` columns **must** have a `DEFAULT` value
- Every migration wrapped in `try { ... } catch (_) {}` (idempotent)
- Every migration function registered in `db.initialize()` in chronological order
- **Never run DDL from `invokeHandlers.js`** — schema changes belong only in `db.js`
- `DECIMAL(10,2)` for all monetary values — never floats
- Images stored as gzip-compressed BLOBs in the database (no filesystem storage)
- Transactions: `pool.getConnection()` → `beginTransaction()` → `commit/rollback` → `release()`

**Key tables:**

| Table | Purpose |
|-------|---------|
| `orders` | All invoices: POS, subscription, deferred |
| `order_items` | Line items per order |
| `customers` | Customer records |
| `products` | Products with optional image (gzip blob) |
| `laundry_services` | Laundry service types |
| `prepaid_packages` | Subscription packages |
| `subscriptions` | Customer subscriptions |
| `subscription_periods` | Active/expired periods (balance tracking) |
| `credit_notes` | Deferred invoices (آجل) |
| `refunds` | Refund records |
| `consumption_receipts` | Subscription consumption |
| `loyalty_points` | Loyalty point ledger |
| `app_settings` | Single-row settings (id=1): VAT, logo, ZATCA, print copies, etc. |
| `users` / `roles` / `role_permissions` | Auth and RBAC |
| `accounts` / `license` | Trial (IP-based) and hardware license |

---

## 6. MySQL 5.7 Compatibility

**All SQL must be compatible with MySQL 5.7. No exceptions without explicit written approval.**

MySQL 5.7 does NOT support window functions. The following are prohibited:

| Prohibited syntax | Reason |
|-------------------|--------|
| `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `OVER(...)` | Window functions — MySQL 8.0 only |
| `WITH ... AS (...)` (non-recursive CTEs) | MySQL 8.0 only |
| `WITH RECURSIVE` | MySQL 8.0 only |
| `JSON_TABLE()` | MySQL 8.0 only |
| `LATERAL` joins | MySQL 8.0 only |
| Invisible columns | MySQL 8.0 only |

**Use instead:** subqueries, derived tables (`FROM (SELECT ...) t`), `JOIN`, temporary tables,
or application-side logic in Node.js.

**Safe on MySQL 5.7:** `JSON_EXTRACT`, `JSON_OBJECT`, `JSON_ARRAY` (since 5.7.8),
`GROUP BY`, `ORDER BY`, `HAVING`, `LIMIT`/`OFFSET`, `UNION`/`UNION ALL`,
`INSERT … ON DUPLICATE KEY UPDATE`, standard subqueries.

---

## 7. Frontend Rules

- **Vanilla JS only** — no React, Vue, Angular, Svelte, or any JS framework
- **No ES modules** — no `import`/`export` in frontend files; use `<script>` tags
- **No bundler** — no Webpack, Vite, Rollup, etc.
- **One screen = one folder** — `screens/<name>/<name>.{html,js,css}`, self-contained
- **`window.api` is the only bridge** to the backend — never call `fetch('/api/invoke')` directly
- **Arabic UI** — all user-facing strings in Arabic; `<html lang="ar" dir="rtl">`
- **Riyal symbol** — `<span class="sar">&#xE900;</span>` with `SaudiRiyal` font; never use `﷼`
- **CommonJS on server** — `require()` / `module.exports`; no `import`/`export` server-side
- No shared components across screens — screens are fully self-contained

**Naming conventions:**
- Files/directories: `kebab-case`
- JS functions/variables: `camelCase`
- HTML IDs: `camelCase` (`btnBack`, `searchInput`)
- CSS classes: `kebab-case` (`header-bar`, `inv-paper`)
- DB tables/columns: `snake_case`
- API method names: `camelCase` matching the DB function name
- i18n keys: `kebab-case` with screen prefix (`pos-cart-title`)

---

## 8. POS Rules

- `createOrder` runs in a **single transaction** (orders + order_items + ZATCA trigger)
- `orders.total_amount = subtotal - discount + vat_amount` — **do not change this formula**
- Mixed payment: `paid_cash + paid_card == total_amount` (tolerance ≤ 0.01 SAR)
- Deferred order: `payment_method='deferred'`, `payment_status='pending'`, `paid_amount=0`
- Subscription deduction is credit usage — it does **not** reduce `remaining_amount` on the invoice
- `credit_remaining` on `subscription_periods` must never go below 0
- Only ONE active subscription period per customer at any time

---

## 9. Invoice, Payments & Subscription Rules

**Invoices:**
- Each invoice stores its own `price_display_mode` at creation — never retroactive
- VAT is configurable in `app_settings.priceDisplayMode` (inclusive / exclusive)
- `invoice_seq` and `order_number` are independent sequential counters, both inside transactions

**Payments:**
- Mixed payment tolerance: `paid_cash + paid_card == total_amount` (± 0.01 SAR)
- Deferred (credit) invoice: settled via `credit_notes`, separate from `orders` balance

**Subscriptions:**
- One subscription per customer; second attempt must be rejected
- `subscription_periods` is an append-only ledger (no DELETE operations)
- Consumption: `INSERT INTO consumption_receipts` + `UPDATE subscription_periods` (balance decrement)
- On balance = 0 or expiry: period status → `expired`, activate next period if any

**Business logic that is frozen — do not change without an explicit requirement:**
- Invoice total formula and VAT calculation
- ZATCA submission and retry logic
- Subscription credit deduction (≠ cash payment)
- Partial / mixed payment validation
- Deferred invoice creation and settlement flow
- Refund balance update logic
- Loyalty points earn / redeem calculation

---

## 10. ZATCA Rules

- Singleton: `LocalZatcaBridge.getInstance()` in `server/services/zatcaBridge.js`
- Retry scheduler: every 15 min via cron in `server/index.js`
- Settings stored in `app_settings`: `zatcaEnabled`, `zatcaMode`, `zatcaCertificate`, etc.
- ZATCA columns on `orders` table (`zatca_status`, `zatca_hash`, etc.) — **do not touch** in unrelated work
- **Do not alter ZATCA submission workflow** without explicit written requirement from project owner

---

## 11. Printing Rules

Every screen that prints an 80mm thermal receipt must follow this pattern exactly.

**Fixed values — never change:**

| Property | Correct value | Common mistake |
|----------|--------------|----------------|
| `.inv-paper` width | `76mm` | `72mm` |
| `.inv-paper` margin | `margin: 0 auto` | `margin: 0 4mm` → misalignment |
| Print zone width | `80mm` + `margin: 0 auto` | constraining `body` width |
| `@page` rule | `size: 80mm auto; margin: 0` | omitting entirely |
| Content copy | `printZone.innerHTML = paperEl.outerHTML` | printing modal directly |
| Multi-copy sequencing | `afterprint` event + `setTimeout(200)` between copies | fixed timers |
| Printer offset | `transform: translateX(Nmm)` only when shift ≠ 0 | adjusting `margin` instead |

Full JS + CSS pattern: [PROJECT_CONSTITUTION.md §8](PROJECT_CONSTITUTION.md#8-thermal-print-rules-80mm-receipts)

---

## 12. Permissions & Auth

- JWT stored in `httpOnly` cookie `laundry_auth` (7-day expiry)
- `authMiddleware` applied to all `/api/invoke` requests
- Roles: `admin` (bypasses all checks), `cashier`
- Permission checks are client-side via `data-permission` attributes and `auth-guard.js`
- Rate limit on login: 50 requests / 15 min
- License validation: disk serial + MAC + motherboard serial vs `license` table

---

## 13. Build, Installer & Updates

**Build commands:**
```bash
npm start            # Dev server
npm run build        # Full build: pkg exe + Inno Setup installer
npm run watch:css    # Tailwind CSS watch
npm run build:css    # Tailwind CSS one-shot
npm run build:installer  # Installer only
```

Service name: `LaundryPlus` | Boot log: `DATA_ROOT/data/logs/boot.log`

**Update flow:**
```
updateService.js → GitHub Releases API → download .exe → SHA256 verify
  → spawnUpdater() → copy scripts to DATA_DIR
    → Task Scheduler: LaundryPlusUpdater
      → updater.ps1: wait for Node PID exit → rename exe → NSSM restarts
```

**Installer flow:**
```
launch-installer.ps1 → Task Scheduler → run-installer.ps1 → Inno Setup → NSSM restore
```

- **Never use `spawn(detached: true)`** for post-exit scripts — NSSM Job Object kills them
- Always use Task Scheduler via a `launch-*.ps1` script for post-exit work
- Progress tracked in `DATA_ROOT/data/update-status.json`, polled by `screens/installing/`

**Background crons:**

| Service | Schedule | File |
|---------|----------|------|
| Update check | Startup + every 6h | `services/updateService.js` |
| ZATCA retry | Every 15 min | `services/zatcaBridge.js` via `index.js` |
| Daily report email | Configurable in settings | `services/reportEmailScheduler.js` |
| WhatsApp reconnect | Startup if session exists | `services/whatsappService.js` |

---

## 14. Feature Impact Checklist

**Complete before writing any code. Re-verify before marking the task done.**
Mark N/A only if the feature provably cannot affect that area.

| Area | What to verify |
|------|---------------|
| **Database** | Migrations additive, MySQL-5.7-safe, wrapped in try/catch, registered in `db.initialize()` |
| **POS Checkout** | `createOrder` flow, cart, payment, and receipt behavior fully intact |
| **ZATCA** | `orders` ZATCA columns untouched; submission/retry scheduler unaffected |
| **Subscriptions** | `credit_remaining >= 0`; one active period; balance deduction logic intact |
| **Payments** | Invoice total formula unchanged; mixed-payment tolerance (≤ 0.01 SAR) intact |
| **Printing** | Thermal: `76mm / margin: 0 auto`; print zone pattern; `afterprint` cleanup intact |
| **Backward Compatibility** | Existing customer deployments safe; no breaking schema or API changes |

---

## 15. New Feature Rules

Every new feature must follow the existing stack (no exceptions without owner approval):

1. Add migration function in `db.js` (additive, try/catch, MySQL 5.7, register in `db.initialize()`)
2. Add named query function(s) in `db.js`
3. Add `case 'methodName':` in `invokeHandlers.js` (try/catch, standard response shape, Arabic errors)
4. Add `api.methodName = (p) => invoke('methodName', p)` in `assets/web-api.js`
5. Create `screens/<feature>/<feature>.{html,js,css}` (self-contained, Arabic UI, RTL)
6. Call only `window.api.*` from screen JS — never `fetch('/api/invoke')` directly

**Before writing code:**
- Search `invokeHandlers.js` for the method name — do not duplicate an existing case
- Search `db.js` for the table/function — do not duplicate existing queries
- Search `screens/` for a similar screen — extend it rather than reinventing

---

## 16. Bug Fix Rules

1. Identify the root cause before touching any code
2. Make the minimal change — fix exactly what is broken
3. Do not refactor or clean up surrounding code in the same fix
4. Do not change the response shape of existing API methods — callers depend on it
5. Verify these workflows after every fix: POS checkout, subscription balance,
   invoice printing, ZATCA submission queue, credit invoice flow, auth/login

---

## 17. Forbidden Changes

The following are prohibited without explicit written approval from the project owner.
An AI agent must refuse to implement these even if instructed mid-task.

| # | Prohibited action | Reason |
|---|-------------------|--------|
| 1 | React / Vue / Svelte / any JS framework | Architecture is vanilla JS by design |
| 2 | ORM (Sequelize, Prisma, Knex, TypeORM, etc.) | All queries are hand-written in `db.js` |
| 3 | Direct `fetch('/api/invoke')` in screen JS | Breaks the `window.api` abstraction layer |
| 4 | REST routes per feature (bypass invoke pattern) | The single-switch pattern is intentional |
| 5 | Redesign the thermal printing mechanism | Print zone + body class is the only pattern that works |
| 6 | Change `.inv-paper` dimensions (`76mm / margin: 0 auto`) | Causes physical misalignment on thermal printers |
| 7 | Alter ZATCA submission workflow | Legally mandatory compliance; unauthorized changes risk violations |
| 8 | Replace the update system (Task Scheduler + updater.ps1) | NSSM Job Object constraint |
| 9 | `spawn(detached: true)` for post-exit scripts | NSSM kills detached child processes |
| 10 | DDL from `invokeHandlers.js` | Schema changes belong exclusively in `db.js` |
| 11 | `process.exit()` in request handlers | NSSM watchdog handles restarts |
| 12 | `DROP COLUMN` / `RENAME COLUMN` in migrations | Breaking change for existing customer data |
| 13 | ES module `import`/`export` in server-side files | Entire backend is CommonJS; breaks pkg bundling |
| 14 | Shared JS components across screens | Screens are self-contained; shared state is unpredictable |
| 15 | MySQL 8.0-only syntax without explicit approval | Customer installations may run MySQL 5.7 |

---

## 18. Final Checklist Before Completing Work

- [ ] 4-Step API checklist complete for every new method (db.js → invokeHandlers.js → web-api.js → screen)
- [ ] All DB migrations are additive, try/catch-wrapped, MySQL-5.7-safe, and registered
- [ ] No duplicate logic introduced (search before adding)
- [ ] Feature Impact Checklist (§14) completed for all 7 areas
- [ ] POS checkout works end-to-end
- [ ] Thermal print dimensions unchanged (`76mm`, `margin: 0 auto`)
- [ ] ZATCA columns on `orders` table untouched
- [ ] Existing API callers unaffected (backward compatible)
- [ ] All user-facing strings in Arabic
- [ ] No forbidden change (§17) implemented

---

*Full authoritative rules and code patterns: [PROJECT_CONSTITUTION.md](PROJECT_CONSTITUTION.md)*
*Spec Kit constitution: [.specify/memory/constitution.md](.specify/memory/constitution.md)*
