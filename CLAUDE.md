<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
[specs/001-customer-discount/plan.md](specs/001-customer-discount/plan.md)
<!-- SPECKIT END -->

> **MANDATORY: Before doing anything else, read the full Project Constitution:**
> **[PROJECT_CONSTITUTION.md](PROJECT_CONSTITUTION.md)**
> This file contains priorities, forbidden changes, all workflows, and development rules.
> Do not write a single line of code before reading it.

---

## ⚠️ AI Agent: Read This First

Before writing any code, confirm you understand:

1. **Project Priorities** (in order — never sacrifice a higher for a lower):
   `Data integrity → ZATCA compliance → Workflow stability → Backward compatibility → Correct business behavior → Maintainability → Performance → Developer convenience`

2. **4-Step API Checklist** — every new API requires all 4:
   `database/db.js` → `server/invokeHandlers.js` → `server/index.js` (only direct endpoints) → `assets/web-api.js`

3. **Forbidden** (no exceptions without explicit owner approval):
   - No React / Vue / any JS framework
   - No ORM
   - No `fetch('/api/invoke')` directly in screen JS — use `window.api` only
   - No `spawn(detached: true)` for post-exit scripts — use Task Scheduler
   - No `DROP` / `RENAME` column in migrations — additive only
   - No DDL from `invokeHandlers.js`
   - No `process.exit()` in request handlers
   - No change to ZATCA workflow without explicit requirement
   - No redesign of thermal print mechanism
   - No change to `.inv-paper` print dimensions (`76mm / margin: 0 auto`)

4. **Before finishing**, verify:
   - No duplicate logic introduced
   - POS checkout still works end-to-end
   - Thermal print still centered (`76mm`, `margin: 0 auto`)
   - ZATCA fields on `orders` table untouched
   - All new DB migrations are additive + try/catch + registered in `db.initialize()`
   - All 4 API steps completed for every new method

---

## Project Overview

**PLUS Laundry** — نظام نقاط بيع لمحلات التنظيف الجاف (Laundry POS System)
- Node.js Express server bundled as a Windows `.exe` via `@yao-pkg/pkg` (Node 20, x64)
- Vanilla JS frontend (no framework) served as static files by Express
- MySQL database via `mysql2/promise`
- Deployed as a Windows Service using NSSM
- Version: see `package.json` → `"version"`

---

## Folder Structure

```
D:\PLUS\Laundry\
├── server/
│   ├── index.js              — Entry point: Express app, cron jobs, ZATCA scheduler
│   ├── paths.js              — APP_ROOT / DATA_ROOT resolution (pkg-aware)
│   ├── invokeHandlers.js     — All API business logic (switch on method name)
│   ├── middleware/auth.js    — JWT sign/verify, authMiddleware
│   └── services/
│       ├── updateService.js       — Auto-update via GitHub Releases
│       ├── exportsService.js      — Excel/PDF exports
│       ├── reportHtml.js          — HTML report generation
│       ├── emailService.js        — Nodemailer + encryption helpers
│       ├── reportEmailScheduler.js— Daily report email cron
│       ├── whatsappService.js     — WhatsApp via Baileys
│       ├── zatcaBridge.js         — ZATCA e-invoicing (LocalZatcaBridge)
│       └── branding.js            — Logo/branding for receipts
├── database/
│   └── db.js                 — MySQL pool, createTables(), all db functions, migrations
├── assets/
│   ├── web-api.js            — Browser-side window.api (fetch wrapper for /api/invoke)
│   └── tailwind.css / input.css
├── screens/                  — One folder per screen
│   ├── pos/                  — Point of Sale (pos.html, pos.js, pos.css)
│   ├── invoices/             — Invoices list
│   ├── credit-invoices/      — Credit/deferred invoices
│   ├── consumption-receipts/ — Consumption receipts
│   ├── hangers/              — Hanger tracking
│   ├── customers/            — Customer management
│   ├── products/             — Product catalog
│   ├── services/             — Laundry services
│   ├── subscriptions/        — Subscription packages
│   ├── offers/               — Discount offers
│   ├── expenses/             — Expense tracking
│   ├── users/                — User management
│   ├── roles/                — Role-based permissions
│   ├── dashboard/            — Dashboard/summary
│   ├── payment/              — Payment screen
│   ├── invoice-a4/           — A4 invoice print view
│   ├── login/                — Login screen
│   ├── settings/             — App settings
│   ├── zatca-settings/       — ZATCA configuration
│   ├── whatsapp/             — WhatsApp setup
│   ├── installing/           — Update progress screen
│   └── reports/              — All report screens
│       ├── daily-report/
│       ├── period-report/
│       ├── all-invoices-report/
│       ├── worker-report/
│       ├── credit-invoices-report/
│       ├── expenses-report/
│       ├── types-report/
│       ├── subscriptions-report/
│       ├── customer-account-report/
│       └── zakat-report/
├── scripts/                  — PowerShell scripts for service/update management
│   ├── updater.ps1           — Rename-based exe replacement
│   ├── launch-updater.ps1    — Register updater as Task Scheduler task
│   ├── run-installer.ps1     — Run Inno Setup installer (4 paths)
│   ├── launch-installer.ps1  — Register installer as Task Scheduler task
│   ├── install-service.ps1   — NSSM service installation
│   ├── register-task.ps1     — Generic task registration helper
│   └── setup-ssl.ps1 / setup.ps1
├── installer/
│   └── laundry.iss           — Inno Setup script
├── release/
│   └── laundry-app.exe       — Built executable (committed for deploy)
└── specs/                    — Feature specs (Spec Kit)
    └── <NNN>-<feature>/
        ├── spec.md, plan.md, tasks.md
        └── research.md, data-model.md, quickstart.md
```

---

## API Architecture (4-Step Checklist)

**Every new API function must follow all 4 steps:**

1. **`database/db.js`** — Add the DB function (query, insert, update)
2. **`server/invokeHandlers.js`** — Add a `case 'methodName':` in the `invoke()` switch
3. **`server/index.js`** — Register route only if it's a direct HTTP endpoint (binary/export); most features use invoke
4. **`assets/web-api.js`** — Add `api.methodName = (payload) => invoke('methodName', payload)` to `window.api`

Frontend calls: `window.api.methodName(payload)` → POST `/api/invoke` → `invokeHandlers.js` → `db.js`

Response shape — always one of:
```js
{ success: true,  ...data }
{ success: false, message: 'Arabic error string' }
```

---

## Key Paths (Runtime)

```js
// server/paths.js
APP_ROOT  = path.join(__dirname, '..')      // bundled files (screens, assets, scripts)
DATA_ROOT = isPkg ? EXEC_DIR : APP_ROOT    // writable files (.env, data/, ssl/, backup/)
DATA_DIR  = path.join(DATA_ROOT, 'data')   // logs, update-status.json, whatsapp_session
```

PowerShell scripts **cannot** read files inside the pkg snapshot — copy to `DATA_DIR` first.

---

## Database Key Tables

| Table | Purpose |
|-------|---------|
| `orders` | All invoices (POS, subscription, deferred) |
| `order_items` | Line items per order |
| `customers` | Customer records |
| `products` | Products with optional image (gzip blob) |
| `laundry_services` | Laundry service types |
| `prepaid_packages` | Subscription packages |
| `subscriptions` | Customer subscriptions |
| `subscription_periods` | Active/expired periods per subscription |
| `credit_notes` | Credit invoices (آجل) |
| `refunds` | Refund records |
| `consumption_receipts` | Consumption receipt records |
| `hangers` | Hanger tracking |
| `expenses` | Expense records |
| `offers` | Discount offers |
| `loyalty_points` | Loyalty point transactions |
| `users` | System users |
| `roles` / `role_permissions` | RBAC |
| `app_settings` | Single-row settings (logo, VAT, ZATCA, etc.) |
| `accounts` | Trial/subscription accounts (ip-based) |
| `license` | Hardware serial license |

Migrations run at startup via `db.initialize()` — always use `ALTER TABLE … ADD COLUMN` in a try/catch for additive migrations.

---

## Coding Conventions

- **Arabic UI** throughout — all user-facing strings in Arabic
- **Riyal symbol**: `ر.س` (not ﷼)
- **No framework** — plain HTML + vanilla JS + CSS per screen
- **`window.api`** is the only bridge between frontend and backend — never call `/api/invoke` directly in screen JS
- Each screen is self-contained: one `.html`, one `.js`, one `.css`
- `db.js` exports named functions — no ORM, raw `mysql2` queries
- `invokeHandlers.js` uses a single `switch(m)` — one case per method
- Error responses: `{ success: false, message: '...' }` | Success: `{ success: true, ...data }`
- VAT calculations: stored as inclusive or exclusive based on `priceDisplayMode` setting
- JWT auth via `httpOnly` cookie (`token`); `authMiddleware` applied to `/api/invoke`

---

## Build & Deployment

```bash
# Full build (pkg exe + Inno Setup installer)
npm run build

# Dev server
npm start

# CSS (Tailwind)
npm run watch:css
```

- **pkg** bundles `server/index.js` + assets → `release/laundry-app.exe`
- **Inno Setup** (`installer/laundry.iss`) creates the installer with scripts/, ssl setup, NSSM
- Service name: `LaundryPlus` (NSSM)
- Boot log: `DATA_ROOT/data/logs/boot.log`
- Update log: `DATA_ROOT/data/update-log.txt`

---

## Background Services & Crons

| Service | Schedule | File |
|---------|----------|------|
| Update check | startup + every 6h | `updateService.js` |
| Daily report email | configurable | `reportEmailScheduler.js` |
| ZATCA retry | every 15 min | `zatcaBridge.js` via `index.js` |
| WhatsApp auto-reconnect | on startup if session exists | `whatsappService.js` |

---

## Update System

- `updateService.js`: checks GitHub Releases API, downloads `.exe`, verifies SHA256, calls `spawnUpdater()`
- `spawnUpdater()`: copies scripts to `DATA_DIR`, registers `LaundryPlusUpdater` Task Scheduler task via `launch-updater.ps1`
- `updater.ps1`: waits for Node PID to exit → renames `.exe` → NSSM restarts service
- Installer path: `launch-installer.ps1` → `run-installer.ps1` → Inno Setup (4 paths based on session type)
- Progress tracked in `DATA_ROOT/data/update-status.json`, polled by `screens/installing/`

---

## ZATCA Integration

- `zatcaBridge.js` → `LocalZatcaBridge` singleton
- Settings stored in `app_settings` (zatcaEnabled, zatcaMode, zatcaCertificate, etc.)
- Unsent orders retried every 15 minutes
- `screens/zatca-settings/` for configuration UI

---

## Thermal Print Rules (80mm Receipts)

**أي شاشة جديدة تطبع إيصال حرارى 80mm يجب أن تتبع هذا النمط بالضبط:**

### Fixed Values — Never Change

| Rule | Correct Value | Common Mistake |
|------|--------------|----------------|
| `.inv-paper` width inside zone | `76mm` | `72mm` |
| `.inv-paper` margin inside zone | `margin: 0 auto` | `margin: 0 4mm` → misalignment |
| Print zone container width | `80mm` + `margin: 0 auto` | constraining `body` width |
| `@page` declaration | `size: 80mm auto; margin: 0` | omitting `@page` |
| Copy paper content | `printZone.innerHTML = paperEl.outerHTML` | printing modal directly |
| Printer offset | `transform: translateX(shift mm)` only when `shift !== 0` | adjusting `margin` |
| Cleanup trigger | `afterprint` event + `setTimeout(200)` between copies | fixed timers |

### Pattern (copy exactly)

**HTML** — outside modal before `</body>`:
```html
<div id="myPrintZone" data-print-root="true" style="display:none"></div>
```

**CSS**:
```css
@page { size: 80mm auto; margin: 0; }
@media print {
  html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
               overflow: visible !important; height: auto !important; max-height: none !important; }
  body.printing-myscreen > *:not(#myPrintZone) { display: none !important; }
  body.printing-myscreen #myPrintZone {
    display: block !important; position: static !important; background: none !important;
    padding: 0 !important; overflow: visible !important; height: auto !important;
    width: 80mm !important; margin: 0 auto !important; }
  body.printing-myscreen #myPrintZone .inv-paper {
    box-shadow: none !important; border-radius: 0 !important;
    width: 76mm !important; max-width: 76mm !important;
    margin: 0 auto !important;   /* NEVER margin: 0 4mm */
    padding: 2mm 3mm !important; height: auto !important;
    max-height: none !important; overflow: visible !important; }
  .no-print { display: none !important; }
}
```

**JS** — see full template in [PROJECT_CONSTITUTION.md § 8.3](PROJECT_CONSTITUTION.md#83-js--print-function)

---

## Security Notes

- Passwords hashed with bcrypt (10 rounds)
- JWT in `httpOnly` cookie, 24h expiry
- Rate limiting on login: 50 req / 15 min
- License check: disk serial + MAC + motherboard serial vs `license` table
- Trial mode: IP-based account in `accounts` table
