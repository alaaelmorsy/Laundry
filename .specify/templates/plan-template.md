# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: Node.js 20 (CommonJS), Vanilla JS (no framework)

**Backend**: Express.js + `mysql2/promise` — no ORM

**Frontend**: Vanilla JS + Tailwind CSS — no bundler, no TypeScript

**Storage**: MySQL/MariaDB — InnoDB, utf8mb4, `DECIMAL(10,2)` for money

**MySQL Compatibility**: MySQL 5.7 — all SQL MUST be compatible with MySQL 5.7.
MySQL 5.7 does NOT support window functions. Do not use `ROW_NUMBER()`, `RANK()`,
`DENSE_RANK()`, `OVER()`, `WITH`/CTEs, `WITH RECURSIVE`, `JSON_TABLE`, `LATERAL`,
or invisible columns. Use subqueries, derived tables, joins, temporary tables, or
application-side logic instead.

**Target Platform**: Windows 10/11 — bundled as `.exe` via `@yao-pkg/pkg`

**Deployment**: Windows Service (NSSM) — single-tenant on-premise

**API Pattern**: `POST /api/invoke` → `invokeHandlers.js` → `db.js`

**Screen Pattern**: `screens/<feature>/<feature>.{html,js,css}` (self-contained)

**Constraints**: No ES modules server-side. No shared components across screens.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Priority Order Compliance

| Priority | Concern | Impact on This Feature |
|----------|---------|----------------------|
| 1 | Data integrity | [describe] |
| 2 | ZATCA compliance | [describe or N/A] |
| 3 | Workflow stability | [describe] |
| 4 | Backward compatibility | [describe] |
| 5 | Correct business behavior | [describe] |

### 4-Step API Checklist

For each new API method, confirm all 4 steps are planned:

| Method Name | db.js | invokeHandlers.js | web-api.js | Screen JS |
|-------------|-------|-------------------|------------|-----------|
| [methodName] | ☐ | ☐ | ☐ | ☐ |

### Forbidden Changes Proximity

List any forbidden change areas (PROJECT_CONSTITUTION.md §19) that this
feature works near. If none apply, write "None".

| # | Forbidden Area | Proximity | Mitigation |
|---|---------------|-----------|------------|
| [e.g., 7] | ZATCA submission | [near/touching] | [describe] |

### MySQL 5.7 Compatibility

- [ ] All SQL uses only MySQL 5.7 compatible syntax
- [ ] No window functions (`ROW_NUMBER`, `RANK`, `DENSE_RANK`, `OVER`) — use subqueries or derived tables
- [ ] No `WITH`/CTEs, `WITH RECURSIVE`, `JSON_TABLE`, `LATERAL`, or invisible columns

## Feature Impact Checklist

*Complete this before writing any code. Re-verify before marking done.*

| Area | Affected? | What Changes / What to Verify |
|------|-----------|-------------------------------|
| **Database** | ☐ Yes / ☐ No | New tables/columns; all migrations additive + try/catch + registered |
| **POS Checkout** | ☐ Yes / ☐ No | `createOrder` flow intact; cart, payment, receipt unaffected |
| **ZATCA** | ☐ Yes / ☐ No | `orders` ZATCA columns untouched; submission/retry unaffected |
| **Subscriptions** | ☐ Yes / ☐ No | `credit_remaining >= 0`; one active period; balance deduction logic intact |
| **Payments** | ☐ Yes / ☐ No | Invoice total formula unchanged; mixed payment tolerance intact |
| **Printing** | ☐ Yes / ☐ No | Thermal: `76mm / margin: 0 auto`; print zone pattern intact |
| **Backward Compatibility** | ☐ Yes / ☐ No | Existing deployments safe; no breaking schema changes; existing API callers unaffected |

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (this feature)

```text
screens/[feature-name]/
├── [feature-name].html
├── [feature-name].js
└── [feature-name].css

database/db.js           — add migration function(s) + query function(s)
server/invokeHandlers.js — add case(s) in switch(m)
assets/web-api.js        — add api.method = (p) => invoke('method', p)
```

[Describe any additional files if needed]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [describe] | [need] | [reason] |
