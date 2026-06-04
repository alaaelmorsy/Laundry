# Repository Guidelines

## Overview

Laundry management system for Saudi businesses. Node.js/Express backend with MySQL, vanilla JS + Tailwind CSS frontend. No framework — plain HTML screens with a single `/api/invoke` endpoint.

## Project Structure

```
server/index.js           — Express entry point, middleware, routes
server/invokeHandlers.js  — All API logic (80+ switch cases)
database/db.js            — All DB operations + auto-migrations (runs on start)
assets/web-api.js         — Client-side window.api.* interface (80+ methods)
screens/{name}/           — Each screen: {name}.html + {name}.js + {name}.css
server/services/          — branding, email, exports, ZATCA, reportHtml
ai_context/               — Business rules & feature specs (read before major changes)
```

**API pattern (4-step checklist for every new feature):**
1. Add DB function to `database/db.js` + export it
2. Add `case 'methodName':` in `server/invokeHandlers.js`
3. Add `methodName: (data) => invoke('methodName', data)` in `assets/web-api.js`
4. Call `window.api.methodName(data)` from the screen JS

**Navigation:** `window.api.navigateTo('screenName')` → `/screens/{screenName}/{screenName}.html`

## Commands

```bash
npm run web          # Start server (http://localhost:3000)
npm run build:css    # Build & minify Tailwind CSS
npm run watch:css    # Watch CSS changes (dev)
npm run ssl:setup    # Generate self-signed SSL cert
```

No test runner configured. Manual browser testing is the verification method.

## Coding Style

- Vanilla JS only — no React/Vue/bundlers
- IIFE pattern for all screen JS files: `(function(){ 'use strict'; ... })()`
- All async calls via `window.api.*()` — never fetch directly from screens
- RTL Arabic UI — `<html lang="ar" dir="rtl">`
- Currency: riyal symbol is `` via `font-family:SaudiRiyal` span — never use plain ﷼
- API responses always `{ success: boolean, ...data }` or `{ success: false, message: string }`
- DB queries use parameterized statements — no string concatenation
- Transactions via `pool.getConnection()` → `beginTransaction` → `commit/rollback` → `conn.release()`

## Database Conventions

- All migrations run automatically in `db.initialize()` — use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` with existence checks
- Single-row config tables (e.g., `app_settings`, `zatca_settings`) use `id = 1`
- Arabic text columns: `VARCHAR/TEXT CHARACTER SET utf8mb4`
- Soft references preferred — avoid hard FK constraints where flexibility needed

## Commit Conventions

Based on git history: version tags use `vX.Y.Z` format. Feature commits are descriptive prose in Arabic or English. No enforced commit message format.

## Environment Variables (`.env`)

```
DB_HOST / DB_USER / DB_PASSWORD / DB_PORT
JWT_SECRET
CHROME_PATH          # For Puppeteer PDF generation
LANGBLY_API_KEY      # Optional: Arabic→English translation
```

Default DB credentials in `db.js` fallback: `root / Db2@dm1n2022`, database `laundry_db`.
Default login: `admin / admin123` (seeded on first run).

## Key Reference Files

- `ai_context/PROJECT_CONTEXT.md` — Full API method list, DB schema, architecture
- `ai_context/BUSINESS_RULES.md` — Pricing logic, subscription rules, ZATCA requirements
- `ai_context/specs/` — Per-feature specifications (feature-01 through feature-16)
