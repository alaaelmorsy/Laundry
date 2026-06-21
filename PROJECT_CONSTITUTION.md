# PLUS Laundry — Project Constitution

> **Authoritative source of truth** for Claude Code, Spec-Kit, and all contributors.
> Every decision, rule, and constraint in this document is derived from the actual codebase.
> Do not contradict it. Do not work around it. Extend it when new permanent decisions are made.

---

## Project Priorities

When tradeoffs occur, prioritize in this exact order:

| Priority | Concern |
|----------|---------|
| 1 | **Data integrity** — no data loss, no silent corruption, no inconsistent state |
| 2 | **ZATCA compliance** — legally mandatory; non-compliance is a regulatory risk |
| 3 | **Existing workflow stability** — POS, subscriptions, invoices, refunds must keep working |
| 4 | **Backward compatibility** — existing deployments must not break on update |
| 5 | **Correct business behavior** — calculations, balances, and statuses must be accurate |
| 6 | **Maintainability** — code must be readable and follow established patterns |
| 7 | **Performance** — speed matters but not at the cost of any higher item |
| 8 | **Developer convenience** — tooling, shortcuts, abstractions come last |

**Never sacrifice a higher-priority item to improve a lower-priority item.**

Examples of applying this order:
- A faster query that risks data corruption → **reject it** (1 beats 7)
- A cleaner abstraction that changes invoice output → **reject it** (3 beats 6)
- A performance optimization that breaks an existing API caller → **reject it** (4 beats 7)
- A convenient helper that alters ZATCA submission logic → **reject it** (2 beats 8)
- A refactor that improves readability but risks a subtle balance bug → **reject it** (5 beats 6)

---

## Table of Contents

0. [Project Priorities](#project-priorities)
1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Key Runtime Paths](#3-key-runtime-paths)
4. [API Architecture](#4-api-architecture)
5. [Database Architecture](#5-database-architecture)
6. [Frontend Rules](#6-frontend-rules)
7. [Backend Rules](#7-backend-rules)
8. [Thermal Print Rules](#8-thermal-print-rules)
9. [ZATCA Integration](#9-zatca-integration)
10. [Update System](#10-update-system)
11. [Background Services](#11-background-services)
12. [Build & Deployment](#12-build--deployment)
13. [Security](#13-security)
14. [Feature Development Rules](#14-feature-development-rules)
15. [Bug Fix Rules](#15-bug-fix-rules)
16. [Database Modification Rules](#16-database-modification-rules)
17. [API Development Rules](#17-api-development-rules)
18. [Critical Business Workflows](#18-critical-business-workflows)
19. [Forbidden Changes](#19-forbidden-changes)
20. [Code Review Checklist](#20-code-review-checklist)
21. [AI Agent Instructions](#21-ai-agent-instructions)

---

## 1. Project Overview

**PLUS Laundry** — نظام نقاط بيع لمحلات التنظيف الجاف (Laundry POS System)

| Property | Value |
|----------|-------|
| Runtime | Node.js 20, bundled via `@yao-pkg/pkg` → Windows `.exe` |
| Frontend | Vanilla JS, no framework, served as static files by Express |
| Database | MySQL via `mysql2/promise`, no ORM |
| Deployment | Windows Service (NSSM) on Windows 10/11 |
| Version source | `package.json` → `"version"` |
| GitHub | `alaaelmorsy/Laundry` |
| Update delivery | GitHub Releases → self-update via Task Scheduler |
| Compliance | ZATCA e-invoicing (Saudi Arabia) |

---

## 2. Folder Structure

```
D:\PLUS\Laundry\
├── server/
│   ├── index.js                   — Entry point: Express app, cron jobs, ZATCA scheduler
│   ├── paths.js                   — APP_ROOT / DATA_ROOT resolution (pkg-aware)
│   ├── invokeHandlers.js          — ALL API business logic (single switch on method name)
│   ├── middleware/auth.js         — JWT sign/verify, authMiddleware
│   └── services/
│       ├── updateService.js       — Auto-update via GitHub Releases
│       ├── exportsService.js      — Excel/PDF exports
│       ├── reportHtml.js          — HTML report generation
│       ├── emailService.js        — Nodemailer + encryption helpers
│       ├── reportEmailScheduler.js— Daily report email cron
│       ├── whatsappService.js     — WhatsApp via Baileys
│       ├── zatcaBridge.js         — ZATCA e-invoicing (LocalZatcaBridge singleton)
│       └── branding.js            — Logo/branding for receipts
├── database/
│   └── db.js                      — MySQL pool, createTables(), ALL db functions, migrations
├── assets/
│   ├── web-api.js                 — Browser-side window.api (fetch wrapper for /api/invoke)
│   └── tailwind.css / input.css
├── screens/                       — One folder per screen (html + js + css)
│   ├── pos/                       — Point of Sale
│   ├── invoices/                  — Invoice list
│   ├── credit-invoices/           — Credit/deferred invoices
│   ├── consumption-receipts/      — Consumption receipts
│   ├── hangers/                   — Hanger tracking
│   ├── customers/                 — Customer management
│   ├── products/                  — Product catalog
│   ├── services/                  — Laundry service types
│   ├── subscriptions/             — Subscription packages
│   ├── offers/                    — Discount offers
│   ├── expenses/                  — Expense tracking
│   ├── users/                     — User management
│   ├── roles/                     — Role-based permissions
│   ├── dashboard/                 — Dashboard/summary
│   ├── payment/                   — Payment screen
│   ├── invoice-a4/                — A4 invoice print view
│   ├── login/                     — Login screen
│   ├── settings/                  — App settings
│   ├── zatca-settings/            — ZATCA configuration
│   ├── whatsapp/                  — WhatsApp setup
│   ├── installing/                — Update progress screen
│   └── reports/
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
├── scripts/                       — PowerShell scripts for service/update management
│   ├── updater.ps1                — Rename-based exe replacement
│   ├── launch-updater.ps1         — Register updater as Task Scheduler task
│   ├── run-installer.ps1          — Run Inno Setup installer (4 session-type paths)
│   ├── launch-installer.ps1       — Register installer as Task Scheduler task
│   ├── install-service.ps1        — NSSM service installation
│   ├── register-task.ps1          — Generic task registration helper
│   └── setup-ssl.ps1 / setup.ps1
├── installer/
│   └── laundry.iss                — Inno Setup script
├── release/
│   └── laundry-app.exe            — Built executable (committed for deploy)
└── specs/                         — Feature specs (Spec Kit)
    └── <NNN>-<feature>/
        ├── spec.md, plan.md, tasks.md
        └── research.md, data-model.md, quickstart.md
```

---

## 3. Key Runtime Paths

```js
// server/paths.js
const isPkg   = typeof process.pkg !== 'undefined';
const EXEC_DIR = path.dirname(process.execPath);

APP_ROOT  = path.join(__dirname, '..')      // bundled files: screens, assets, scripts
DATA_ROOT = isPkg ? EXEC_DIR : APP_ROOT    // writable files: .env, data/, ssl/, backup/
DATA_DIR  = path.join(DATA_ROOT, 'data')   // logs/, update-status.json, whatsapp_session/
```

**Critical constraint:** PowerShell scripts cannot read files inside the pkg snapshot.
Always copy scripts from `APP_ROOT` to `DATA_DIR` before executing them via PowerShell.

---

## 4. API Architecture

### The Invoke Pattern

All browser-to-server communication flows through a single channel:

```
window.api.methodName(payload)
  → POST /api/invoke  { method: 'methodName', payload: {...} }
    → server/invokeHandlers.js  switch(method) { case 'methodName': ... }
      → database/db.js  namedFunction(args)
        → MySQL
```

### Response Shape

```js
// Always return one of these two shapes — no exceptions:
{ success: true,  ...data }
{ success: false, message: 'Arabic error string' }
```

### Binary / Export Endpoints

Files (Excel, PDF) use direct POST routes on `server/index.js` and return binary blobs.
They do **not** go through `/api/invoke`.

### Authentication

`authMiddleware` is applied to all `/api/invoke` requests.
Auth uses a JWT stored in an `httpOnly` cookie named `token` (24h expiry).
If the cookie is missing or invalid, the server returns HTTP 401 and the client redirects to `/screens/login/login.html`.

---

## 5. Database Architecture

### Key Tables

| Table | Purpose |
|-------|---------|
| `orders` | All invoices: POS, subscription, deferred |
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
| `app_settings` | Single-row settings: logo, VAT, ZATCA, etc. |
| `accounts` | Trial/subscription accounts (IP-based) |
| `license` | Hardware serial license |

### Migration Pattern

Migrations run at startup inside `db.initialize()`.
**Always use additive `ALTER TABLE … ADD COLUMN` wrapped in try/catch:**

```js
async function migrateMyFeature() {
  try {
    await pool.query(`ALTER TABLE orders ADD COLUMN my_field VARCHAR(50) NULL`);
  } catch (_) {}  // Silently ignore if column already exists
}
```

### VAT Handling

VAT is calculated as inclusive or exclusive based on `app_settings.priceDisplayMode`.
All monetary values are stored as decimals. Round to 2 decimal places before storing.

---

## 6. Frontend Rules

### Absolute Rules

1. **Arabic UI only.** All user-facing strings are in Arabic. No English UI text in screens.
2. **Vanilla JS only.** No React, Vue, Angular, Svelte, or any JS framework.
3. **One screen = one folder = `screen.html` + `screen.js` + `screen.css`.** No shared screen components.
4. **`window.api` is the only bridge to the backend.** Never call `fetch('/api/invoke', ...)` directly in screen JS.
5. **Riyal symbol:** use `ر.س` rendered via `<span class="sar">&#xE900;</span>` with the `SaudiRiyal` font. Never use `﷼`.
6. **No inline styles for layout logic.** Use CSS classes.
7. **`direction: rtl`** on body for all screens.

### Naming Conventions

- Screen IDs: camelCase (`receiptViewModal`, `btnCrPrint`)
- API methods: camelCase (`getAppSettings`, `saveAppSettings`)
- CSS classes: kebab-case (`.inv-paper`, `.btn-inv-print`)
- Print zone IDs: `<screenName>PrintZone` or `invPrintZone`
- Body print class: `printing-<screenname>`

### UX Patterns to Maintain

- Modal dialogs use `.modal-overlay` + `.inv-dialog` structure
- Toasts for feedback (`.toast-success`, `.toast-error`, `.toast-info`)
- Loading spinner: `.spinner` class inside table cells
- Empty state: `.empty-state` with SVG icon
- Pagination bar: standard `.pagination-bar` component
- Header: `.header-bar` with back button + logo + title

---

## 7. Backend Rules

### Absolute Rules

1. **CommonJS only.** No ES modules (`import`/`export`). Use `require()`/`module.exports`.
2. **`mysql2/promise`** for all database access. No ORM, no query builder.
3. **All DB functions are named exports from `database/db.js`.** Never query MySQL directly from `invokeHandlers.js` or services.
4. **`invokeHandlers.js` uses a single `switch(m)` block.** One `case` per method. No sub-routers.
5. **Services are thin orchestrators.** Business logic that touches the DB goes through `db.js` functions.
6. **No `process.exit()` in request handlers.** The NSSM watchdog handles crashes.
7. **`execFileSync` for synchronous child processes.** Use `execFile` (async) for non-blocking work.

### Error Handling

```js
// Standard case block pattern:
case 'myMethod': {
  try {
    const result = await db.myFunction(payload.arg);
    return { success: true, data: result };
  } catch (err) {
    console.error('[myMethod]', err);
    return { success: false, message: err.message || 'حدث خطأ غير متوقع' };
  }
}
```

---

## 8. Thermal Print Rules (80mm Receipts)

**Every screen that prints an 80mm thermal receipt MUST follow this pattern exactly.**
Deviation causes off-center or broken prints on thermal printers.

### 8.1 HTML — Print Zone

Add this `div` outside the modal, just before `</body>`:

```html
<div id="myPrintZone" data-print-root="true" style="display:none"></div>
```

### 8.2 CSS — `@page` + `@media print`

```css
/* Outside @media print — defines paper size */
@page { size: 80mm auto; margin: 0; }

@media print {
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
  }

  /* Hide everything except the print zone */
  body.printing-myscreen > *:not(#myPrintZone) { display: none !important; }

  /* Container: exactly 80mm, centered on page */
  body.printing-myscreen #myPrintZone {
    display: block !important;
    position: static !important;
    background: none !important;
    padding: 0 !important;
    overflow: visible !important;
    height: auto !important;
    width: 80mm !important;
    margin: 0 auto !important;
  }

  /* Receipt paper: 76mm, centered via margin: 0 auto */
  body.printing-myscreen #myPrintZone .inv-paper {
    box-shadow: none !important;
    border-radius: 0 !important;
    width: 76mm !important;
    max-width: 76mm !important;
    margin: 0 auto !important;      /* NEVER use margin: 0 4mm — causes misalignment */
    padding: 2mm 3mm !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  .no-print { display: none !important; }
}
```

### 8.3 JS — Print Function

```js
function printReceipt() {
  var copies = Number((state.appSettings && state.appSettings.printCopies) || 1);
  if (!Number.isFinite(copies) || copies < 1) copies = 1;
  if (copies > 20) copies = 20;

  var paperEl   = document.getElementById('myPaper');      // .inv-paper inside modal
  var printZone = document.getElementById('myPrintZone');  // container outside modal
  if (!paperEl || !printZone) return;
  printZone.innerHTML = paperEl.outerHTML;  // clone into print zone

  // Read printer offset from settings
  var mLeft  = parseFloat((state.appSettings && state.appSettings.thermalMarginLeft)  || 0) || 0;
  var mRight = parseFloat((state.appSettings && state.appSettings.thermalMarginRight) || 0) || 0;
  var shift  = mLeft - mRight;

  // Inject print styles dynamically (overrides static CSS for this print)
  var styleEl = document.createElement('style');
  styleEl.id  = 'thermalPageStyle';
  styleEl.textContent =
    '@page { size: 80mm auto; margin: 0; }' +
    '@media print {' +
    '  html, body.printing-myscreen { direction: ltr !important; }' +
    '  body.printing-myscreen > *:not(#myPrintZone) { display: none !important; }' +
    '  body.printing-myscreen #myPrintZone { display: block !important; position: static !important;' +
    '    background: none !important; padding: 0 !important; overflow: visible !important;' +
    '    height: auto !important; width: 80mm !important; margin: 0 auto !important; }' +
    '  body.printing-myscreen #myPrintZone .inv-paper { box-shadow: none !important;' +
    '    border-radius: 0 !important; width: 76mm !important; max-width: 76mm !important;' +
    '    margin: 0 auto !important; padding: 2mm 3mm !important;' +
    '    height: auto !important; max-height: none !important; overflow: visible !important;'
    + (shift !== 0 ? ' transform: translateX(' + shift + 'mm) !important;' : '')
    + ' }' +
    '}';
  document.head.appendChild(styleEl);

  function cleanup() {
    document.body.classList.remove('printing-myscreen');
    printZone.innerHTML = '';
    var ts = document.getElementById('thermalPageStyle');
    if (ts) ts.remove();
  }

  document.body.classList.add('printing-myscreen');
  var current = 0;
  function printNext() {
    if (current >= copies) { cleanup(); return; }
    current++;
    var handled = false;
    function afterPrint() {
      if (handled) return;
      handled = true;
      window.removeEventListener('afterprint', afterPrint);
      if (current < copies) setTimeout(printNext, 200); else cleanup();
    }
    window.addEventListener('afterprint', afterPrint);
    window.print();
  }
  printNext();
}
```

### 8.4 Fixed Values — Never Change

| Rule | Correct Value | Common Mistake |
|------|--------------|----------------|
| `.inv-paper` width inside zone | `76mm` | `72mm` |
| `.inv-paper` margin inside zone | `margin: 0 auto` | `margin: 0 4mm` → misalignment |
| Print zone container width | `80mm` + `margin: 0 auto` | constraining `body` width |
| `@page` declaration | `size: 80mm auto; margin: 0` | omitting `@page` entirely |
| Copy paper content | `printZone.innerHTML = paperEl.outerHTML` | printing modal directly |
| Printer offset | `transform: translateX(shift mm)` only when `shift !== 0` | adjusting `margin` |
| Cleanup trigger | `afterprint` event + `setTimeout(200)` between copies | fixed timers |

---

## 9. ZATCA Integration

- **Singleton:** `server/services/zatcaBridge.js` → `LocalZatcaBridge.getInstance()`
- **Settings:** stored in `app_settings` row: `zatcaEnabled`, `zatcaMode`, `zatcaCertificate`, and related fields
- **Retry scheduler:** every 15 minutes via `cron.schedule('*/15 * * * *', ...)` in `server/index.js`
- **Unsent orders:** queried via `db.getUnsentZatcaOrders(500)`, submitted one by one with 5-second delay between each
- **Configuration UI:** `screens/zatca-settings/`
- **Order submission:** `bridge.submitOrderById(id)` — called from scheduler and on manual trigger
- **Do not alter ZATCA workflow** without an explicit requirement from the project owner

---

## 10. Update System

### Flow

```
updateService.checkForUpdate()
  → GitHub Releases API (alaaelmorsy/Laundry)
    → download .exe + verify SHA256
      → spawnUpdater({ targetVersion, fromVersion, newExePath, backupPath })
        → copy updater.ps1 + launch-updater.ps1 to DATA_DIR
          → execFileSync('powershell.exe', ['-File', launch-updater.ps1, ...])
            → Task Scheduler: LaundryPlusUpdater task (outside NSSM Job Object)
              → updater.ps1: wait for Node PID exit → rename .exe → NSSM restarts
```

### Installer Flow (for full version upgrades)

```
launch-installer.ps1
  → Task Scheduler: LaundryPlusInstaller task
    → run-installer.ps1 (4 paths based on Windows session type)
      → Inno Setup (laundry.iss)
        → NSSM restore + service restart
```

### Key Constraint

NSSM Job Object kills all child processes when Node exits.
**Task Scheduler is the only way to survive a Node process exit.**
Never use `spawn(detached: true)` for post-exit scripts — always use Task Scheduler via a launch-*.ps1 script.

### Progress Tracking

- Status file: `DATA_ROOT/data/update-status.json`
- Log file: `DATA_ROOT/data/update-log.txt`
- UI: `screens/installing/` polls `update-status.json`

---

## 11. Background Services

| Service | Schedule | Source File |
|---------|----------|-------------|
| Update check | On startup + every 6 hours | `server/services/updateService.js` |
| Daily report email | Configurable in settings | `server/services/reportEmailScheduler.js` |
| ZATCA retry | Every 15 minutes | `server/services/zatcaBridge.js` via `server/index.js` |
| WhatsApp auto-reconnect | On startup if session files exist | `server/services/whatsappService.js` |

---

## 12. Build & Deployment

```bash
# Full build: pkg exe → Inno Setup installer
npm run build

# Development server
npm start

# CSS compilation (Tailwind)
npm run watch:css
npm run build:css

# Installer only
npm run build:installer
```

| Artifact | Location | Description |
|----------|----------|-------------|
| Executable | `release/laundry-app.exe` | pkg-bundled Node app (committed) |
| Installer | Built by Inno Setup | Distributed to customers |
| Boot log | `DATA_ROOT/data/logs/boot.log` | Written at startup |
| Update log | `DATA_ROOT/data/update-log.txt` | Written during updates |
| Service name | `LaundryPlus` | NSSM service identifier |

---

## 13. Security

| Concern | Implementation |
|---------|---------------|
| Passwords | bcrypt, 10 rounds |
| Sessions | JWT in `httpOnly` cookie, 24h expiry |
| Rate limiting | 50 requests / 15 min on login endpoint |
| License | Disk serial + MAC + motherboard serial checked against `license` table |
| Trial mode | IP-based account in `accounts` table |
| Auth scope | `authMiddleware` on all `/api/invoke` requests |

---

## 14. Feature Development Rules

### Before Writing Any Code

1. **Search existing code.** Use grep/glob to find if the feature (or a close variant) already exists.
2. **Check existing API methods.** Look in `invokeHandlers.js` before creating a new one.
3. **Check existing DB functions.** Look in `db.js` before writing a new query.
4. **Identify the nearest existing screen.** Extend it or copy its pattern rather than inventing a new one.

### During Implementation

- **Reuse existing APIs** whenever the data is already available. Do not add a new method that duplicates an existing one.
- **Reuse existing DB functions.** If `db.getCustomer(id)` exists, do not write a new inline query.
- **Follow existing naming conventions** exactly (see Section 6).
- **Keep backward compatibility.** New fields must be optional or have defaults. Existing callers must not break.
- **Do not duplicate logic.** If VAT calculation exists in `db.js`, do not reimplement it in `invokeHandlers.js`.
- **Extend existing workflows.** If the POS flow already handles payment, extend it rather than adding a parallel path.
- **One concern per PR.** Do not mix feature work with refactors.

### Red Flags That Indicate Wrong Direction

- Creating a new service file when the functionality fits in an existing one
- Adding a second `/api/invoke`-equivalent endpoint
- Writing raw SQL inside `invokeHandlers.js` instead of `db.js`
- Adding a framework dependency (`axios`, `lodash`, React, etc.)
- Creating a shared component across screens (screens are self-contained)

---

## 15. Bug Fix Rules

### Mandatory Process

1. **Identify the root cause** before touching any code. Write it down in a comment or commit message.
2. **Prefer minimal changes.** Fix exactly what is broken. Do not clean up surrounding code in the same PR.
3. **Avoid broad refactors.** A one-line bug does not justify restructuring a file.
4. **Verify all affected workflows** before committing. At minimum, check:

| Workflow | Check |
|----------|-------|
| POS checkout | Can a sale be completed end-to-end? |
| Subscription deduction | Is balance correctly decremented? |
| Invoice printing | Do thermal and A4 prints render correctly? |
| ZATCA submission | Does the retry scheduler still fire? Are unsent orders still queued? |
| Credit invoice flow | Can a credit note be created and settled? |
| Refund flow | Does a refund correctly update balances? |

5. **Do not fix symptoms.** If a symptom appears in the UI but the root cause is in `db.js`, fix `db.js`.
6. **Do not change the response shape** of existing API methods. Callers depend on the exact shape.

---

## 16. Database Modification Rules

### Mandatory Rules

1. **Additive only.** Add columns, add tables, add indexes. Never automatically drop or rename.
2. **Never remove a column** in a migration. Deprecated columns stay nullable with no code referencing them.
3. **Never rename a column** in a migration. Add a new column, migrate data manually if needed.
4. **Always use try/catch** around `ALTER TABLE ADD COLUMN` migrations:

```js
async function migrateAddMyColumn() {
  try {
    await pool.query(`ALTER TABLE orders ADD COLUMN my_new_field VARCHAR(100) NULL`);
  } catch (_) {}
}
// Call inside db.initialize() after existing migrations
```

5. **Register every migration** in `db.initialize()` in chronological order. Never skip a migration function.
6. **Review all related queries** before any schema change. Search `db.js` and `invokeHandlers.js` for the table name before modifying it.
7. **New required fields must have defaults.** A new `NOT NULL` column without a default will break existing rows.
8. **Never run raw DDL from `invokeHandlers.js`.** Schema changes belong only in `db.js` migrations.

---

## 17. API Development Rules

### The 4-Step Checklist

Every new API method requires all 4 steps. Missing any step breaks the feature.

**Step 1 — `database/db.js`**

```js
// Add a named export function
async function getMyData(arg1, arg2) {
  const [rows] = await pool.query(
    'SELECT * FROM my_table WHERE col = ?',
    [arg1]
  );
  return rows;
}
module.exports = { ..., getMyData };
```

**Step 2 — `server/invokeHandlers.js`**

```js
// Add a case inside the invoke() switch
case 'getMyData': {
  try {
    const data = await db.getMyData(payload.arg1, payload.arg2);
    return { success: true, data };
  } catch (err) {
    console.error('[getMyData]', err);
    return { success: false, message: err.message || 'حدث خطأ' };
  }
}
```

**Step 3 — `server/index.js`** *(only for binary/direct endpoints)*

```js
// Only if this cannot go through /api/invoke (e.g., file download)
app.post('/api/my-export', authMiddleware, async (req, res) => {
  // ... return blob
});
```

**Step 4 — `assets/web-api.js`**

```js
// Add to the window.api object
api.getMyData = function(payload) { return invoke('getMyData', payload); };
```

### Verification

After adding the 4 steps, verify:
- `window.api.getMyData` is callable from browser console
- The response shape is `{ success: true, data: [...] }` or `{ success: false, message: '...' }`
- Auth is enforced (the default for all `/api/invoke` calls)
- The method name is unique in the `switch` block

---

## 18. Critical Business Workflows

> **These workflows must be fully analyzed before any modification.**
> A change that seems unrelated may break one of these flows.
> Always trace the complete path from UI → API → DB → response before touching these areas.

### 18.1 POS Checkout

```
POS screen (pos.js)
  → window.api.createOrder(payload)
    → invokeHandlers: 'createOrder'
      → db.createOrder({ items, customer, payment, vatRate, ... })
        → INSERT INTO orders + order_items
          → optional: ZATCA submission trigger
            → optional: WhatsApp receipt send
              → optional: thermal print
```

### 18.2 Subscription Consumption

```
POS screen (consumption modal)
  → window.api.recordConsumption(payload)
    → invokeHandlers: 'recordConsumption'
      → db.recordConsumption({ subscriptionPeriodId, items, amount })
        → INSERT INTO consumption_receipts
          → UPDATE subscription_periods (balance decrement)
            → thermal print (consumption receipt)
```

### 18.3 Subscription Deduction / Balance

```
Subscription period active check:
  → db.getActiveSubscriptionPeriod(subscriptionId)
    → SELECT FROM subscription_periods WHERE status = 'active' AND balance > 0
      → On consumption: balance -= amount
        → On balance = 0 OR expiry: period status = 'expired', refresh next period
```

### 18.4 Credit Invoice Flow (آجل)

```
POS screen (deferred payment)
  → order created with payment_method = 'deferred'
    → credit_notes record created
      → credit-invoices screen shows pending balance
        → settlement: UPDATE credit_notes SET settled = 1
```

### 18.5 Refund Flow

```
Invoice screen (refund action)
  → window.api.createRefund(payload)
    → db.createRefund({ orderId, amount, reason })
      → INSERT INTO refunds
        → UPDATE orders SET refund_status, refunded_amount
          → optional: loyalty points reversal
            → optional: subscription balance restoration
```

### 18.6 ZATCA Submission

```
After order creation (or retry scheduler):
  → LocalZatcaBridge.getInstance().submitOrderById(id)
    → Read order from DB
      → Build ZATCA XML
        → Submit to ZATCA API
          → UPDATE orders SET zatca_status = 'submitted' | 'rejected'
```

### 18.7 Receipt Printing

```
Print trigger (button click)
  → Copy .inv-paper content to #*PrintZone
    → Inject @page + @media print styles dynamically
      → Add body class (printing-<screen>)
        → window.print()
          → afterprint event → cleanup → repeat for copies
```
Reference: Section 8 for exact implementation.

### 18.8 Auto Update System

```
checkForUpdate() [startup + every 6h]
  → GitHub Releases API → compare versions
    → download .exe → verify SHA256
      → spawnUpdater()
        → copy scripts to DATA_DIR
          → execFileSync launch-updater.ps1
            → Task Scheduler: LaundryPlusUpdater
              → updater.ps1 [after Node exit]
                → rename exe → NSSM restart
```
Reference: Section 10 for full details.

### 18.9 WhatsApp Messaging

```
Trigger (print / manual send):
  → whatsappService.sendMessage(phone, content)
    → Baileys session (DATA_ROOT/data/whatsapp_session/)
      → WA Web protocol
        → delivery receipt
```
WhatsApp auto-reconnects on startup if session directory is non-empty.

---

## 19. Forbidden Changes

The following changes are **prohibited** without explicit written approval from the project owner.
An AI agent must refuse to implement these even if instructed mid-task.

| # | Prohibited Action | Reason |
|---|-------------------|--------|
| 1 | Migrate frontend to React, Vue, Svelte, or any JS framework | Architecture is vanilla JS by design; migration would break all screens |
| 2 | Introduce an ORM (Sequelize, Prisma, TypeORM, Knex, etc.) | All queries are hand-written in `db.js`; ORM adds overhead and breaks migration pattern |
| 3 | Bypass `window.api` with direct `fetch('/api/invoke')` in screen JS | Breaks the abstraction layer and makes API tracking impossible |
| 4 | Replace the invoke architecture with REST routes per feature | The single-switch pattern is intentional; REST routes are only for binary endpoints |
| 5 | Redesign the thermal printing mechanism | The print zone + body class pattern is the only approach that works on Windows thermal printers |
| 6 | Change `.inv-paper` print dimensions from `76mm / margin: 0 auto` | Causes physical misalignment on thermal printers |
| 7 | Alter the ZATCA submission workflow without explicit requirement | ZATCA compliance is legally mandatory; unauthorized changes risk non-compliance |
| 8 | Replace the update system (Task Scheduler + updater.ps1) without approval | The NSSM Job Object constraint makes this the only viable architecture |
| 9 | Use `spawn(detached: true)` for post-exit scripts | NSSM kills detached child processes; use Task Scheduler instead |
| 10 | Run DDL (`ALTER TABLE`, `CREATE TABLE`) from `invokeHandlers.js` | Schema changes belong exclusively in `db.js` migrations |
| 11 | Add `process.exit()` in request handlers | NSSM treats unexpected exits as crashes; let the watchdog handle restarts |
| 12 | Remove or rename existing database columns via migration | Breaking change for existing deployments with live data |
| 13 | Add ES module syntax (`import`/`export`) to server-side files | The entire backend is CommonJS; mixing breaks pkg bundling |
| 14 | Introduce shared JS components across screens | Screens are self-contained; shared state causes unpredictable behavior |

---

## 20. Code Review Checklist

Every change — whether from a human or an AI agent — must pass this checklist before being considered complete.

### Architecture Compliance

- [ ] Does the change follow the invoke pattern (db.js → invokeHandlers.js → web-api.js)?
- [ ] Are all new API methods registered in all 4 required locations?
- [ ] Is `window.api` the only bridge used in frontend code?
- [ ] Is the response shape `{ success: true/false, ... }` in all new handlers?
- [ ] Are all strings user-facing Arabic?

### Database Impact

- [ ] Are all schema changes additive only (no DROP, no RENAME)?
- [ ] Are all `ALTER TABLE ADD COLUMN` statements wrapped in try/catch?
- [ ] Is the migration registered in `db.initialize()`?
- [ ] Do new columns have appropriate defaults or are nullable?
- [ ] Have all existing queries referencing the changed table been reviewed?

### API Impact

- [ ] Does the new method name conflict with any existing case in the switch?
- [ ] Are all 4 checklist steps completed?
- [ ] Does the method handle errors and return the standard shape?

### Printing Impact

- [ ] If the change touches any screen with a print function, has the thermal print been verified?
- [ ] Are the dimensions still `76mm / margin: 0 auto`?
- [ ] Is the print zone approach used (not direct modal print)?
- [ ] Is the `afterprint` event used for cleanup and multi-copy sequencing?

### ZATCA Impact

- [ ] Does the change affect the `orders` table? If yes, are ZATCA fields preserved?
- [ ] Does the change affect `zatcaBridge.js` or the retry scheduler?
- [ ] Is `zatca_status` still tracked correctly for any new order type?

### Backward Compatibility

- [ ] Do existing callers of modified functions still work without changes?
- [ ] Are all new parameters optional or do old callers pass them?
- [ ] Are existing database rows still valid after the migration?

### Existing Workflow Verification

- [ ] POS checkout: can a sale be completed end-to-end?
- [ ] Subscription consumption: is balance correctly decremented?
- [ ] Credit invoice: can a deferred invoice be created and settled?
- [ ] Refund: does refund update balances correctly?
- [ ] Login and session: does auth still work?
- [ ] Update system: is `updateService.js` unaffected?

---

## 21. AI Agent Instructions

This section applies to Claude Code, Copilot, Cursor, and any AI coding agent working in this repository.

### Before Writing Any Code

1. **Read this Constitution.** All rules here override general coding conventions.
2. **Read the current feature plan** at `specs/<NNN>-<feature>/plan.md` (linked from `CLAUDE.md`).
3. **Search the existing codebase** for the function, table, or screen you are about to create:
   - Grep `invokeHandlers.js` for the method name before adding a new case
   - Grep `db.js` for the table or function before adding a new query
   - Glob `screens/` for a similar screen before creating a new one
4. **Identify all related workflows** from Section 18. List which of the 9 workflows your change touches.
5. **Identify all affected APIs** — which `window.api.*` methods your change adds, modifies, or removes.
6. **Identify all affected database tables** — list every table your change reads from or writes to.
7. **Plan the 4-Step API checklist** if adding a new API method (Section 17).
8. **State your constraints** before coding: which Forbidden Changes (Section 19) are near your work area.

### While Coding

- Follow the patterns in the nearest existing screen or service. Do not invent new patterns.
- Keep changes minimal and scoped. One concern per task.
- Add only what is required by the spec/plan. Do not add "while I'm here" improvements.
- When in doubt about a data shape, read the existing DB function and invokeHandler for that entity.
- Never use `console.log` for production logging in services — use `bootLog()` or `fs.appendFileSync` to the log file.

### Before Marking Work as Complete

1. **Verify no duplicate logic.** Search for similar functions before declaring done.
2. **Verify no workflow regression.** Trace each affected workflow from Section 18 mentally.
3. **Verify printing still works.** If any `.css`, `.html`, or `.js` in a screen with a print button was touched, re-check Section 8 rules.
4. **Verify ZATCA is unaffected.** If `orders` table or `zatcaBridge.js` was touched, confirm ZATCA fields and submission flow are intact.
5. **Verify the update system is unaffected.** If `server/index.js`, `paths.js`, or any script was touched, confirm `updateService.js` and `spawnUpdater()` still work.
6. **Verify the 4-Step checklist** is complete for every new API method.
7. **Verify database migrations** are additive, wrapped in try/catch, and registered in `db.initialize()`.
8. **Run the Code Review Checklist** (Section 20) item by item before reporting completion.

### What to Do When Uncertain

- **Uncertain about a business rule?** Read the existing implementation — it is the specification.
- **Uncertain about a DB schema?** Read `db.js` `createTables()` — the schema is defined there.
- **Uncertain about an API shape?** Read the existing case block in `invokeHandlers.js` for the same entity.
- **Uncertain whether to create a new file?** Default to extending an existing one.
- **Uncertain about a Forbidden Change?** Do not do it. Ask for explicit approval first.

---

*This document is the single authoritative source of truth for PLUS Laundry development.*
*Update it whenever a new permanent architectural decision is made.*
*Never let the code diverge silently from what this document describes.*
