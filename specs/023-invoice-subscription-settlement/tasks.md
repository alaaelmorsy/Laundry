# Tasks: ØªØ³ÙˆÙŠØ© Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ù…Ù† Ø±ØµÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ

**Input**: Design documents from `specs/023-invoice-subscription-settlement/`

**Prerequisites**: plan.md âœ… | spec.md âœ… | research.md âœ… | data-model.md âœ… | contracts/ âœ…

**Organization**: Tasks organized by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: DB migration ÙˆØªÙ‡ÙŠØ¦Ø© Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ø§Ù„Ù…Ø´ØªØ±ÙƒØ©

- [X] T001 Add `settled_by_subscription_period_id INT DEFAULT NULL` column to `orders` table via idempotent migration (try/catch) in `database/db.js` inside `db.initialize()`
- [X] T002 Add index `idx_orders_settled_by_sub` on `orders(settled_by_subscription_period_id)` in `database/db.js` (immediately after T001 migration)

**Checkpoint**: Ø§Ù„Ù€ migration ÙŠØ¹Ù…Ù„ Ø¨Ø¯ÙˆÙ† Ø£Ø®Ø·Ø§Ø¡ Ø¹Ù†Ø¯ ØªØ´ØºÙŠÙ„ Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬ â€” Ø§Ù„Ø¹Ù…ÙˆØ¯ Ù…ÙˆØ¬ÙˆØ¯ ÙÙŠ Ø§Ù„Ù€ DB

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ø¯ÙˆØ§Ù„ DB Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© â€” ØªÙ…Ù†Ø¹ Ø£ÙŠ Ø¹Ù…Ù„ Ø¹Ù„Ù‰ Ø§Ù„Ù€ API Ø£Ùˆ Ø§Ù„Ù€ UI Ù‚Ø¨Ù„ Ø§ÙƒØªÙ…Ø§Ù„Ù‡Ø§

**âš ï¸ CRITICAL**: Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„Ø¨Ø¯Ø¡ ÙÙŠ Ø§Ù„Ù€ API Ø£Ùˆ Ø§Ù„Ù€ UI Ù‚Ø¨Ù„ Ø§ÙƒØªÙ…Ø§Ù„ Ù‡Ø°Ù‡ Ø§Ù„Ø¯ÙˆØ§Ù„

- [X] T003 Implement `getCustomerUnpaidInvoices(customerId)` in `database/db.js` â€” SELECT from `orders` WHERE `customer_id=?` AND `payment_status='pending'` AND `is_refund=0` AND `is_consumption_only=0` AND `settled_by_subscription_period_id IS NULL` ORDER BY `created_at ASC`, returning `id, invoice_seq, total_amount, created_at`
- [X] T004 Implement `settleInvoicesFromSubscription(data)` in `database/db.js` â€” full transaction: get connection â†’ beginTransaction â†’ SELECT period FOR UPDATE â†’ validate `status='active'` â†’ SELECT invoices + validate ownership + `payment_status='pending'` + not settled â†’ validate `SUM(total_amount) <= credit_remaining` â†’ UPDATE orders SET `payment_status='paid', paid_at=NOW(), settled_by_subscription_period_id=periodId` using `conn.query('UPDATE orders SET ... WHERE id IN (?)', [invoiceIds])` (mysql2 expands array automatically â€” no string concatenation) â†’ UPDATE `subscription_periods` SET `credit_remaining = credit_remaining - totalSettled` WHERE id=periodId â†’ INSERT into `subscription_ledger` (entry_type='adjustment', amount=-totalSettled, balance_after=newBalance, notes='ØªØ³ÙˆÙŠØ© ÙÙˆØ§ØªÙŠØ± â€” Ø¹Ø¯Ø¯: N') â†’ commit â†’ return `{ settledCount, totalSettled, creditRemainingAfter }`
- [X] T005 Add `case 'getCustomerUnpaidInvoices'` in `server/invokeHandlers.js` â€” extract `customerId` from payload, call `db.getCustomerUnpaidInvoices()`, return `{ success: true, invoices }`
- [X] T006 Add `case 'settleInvoicesFromSubscription'` in `server/invokeHandlers.js` â€” extract `subscriptionPeriodId, invoiceIds, createdBy` from payload, call `db.settleInvoicesFromSubscription()`, return result with `success: true`
- [X] T007 [P] Register `getCustomerUnpaidInvoices` in `assets/web-api.js` under `window.api` â€” method call via `invoke('getCustomerUnpaidInvoices', payload)`
- [X] T008 [P] Register `settleInvoicesFromSubscription` in `assets/web-api.js` under `window.api` â€” method call via `invoke('settleInvoicesFromSubscription', payload)`
- [X] T021 [P] Export `getCustomerUnpaidInvoices` and `settleInvoicesFromSubscription` in the exports object at the bottom of `database/db.js` â€” required before handlers in T005/T006 can call them

**Checkpoint**: ÙŠÙ…ÙƒÙ† Ø§Ø®ØªØ¨Ø§Ø± Ø§Ù„Ø¯ÙˆØ§Ù„ Ù…Ø¨Ø§Ø´Ø±Ø©Ù‹ Ù…Ù† console â€” `window.api.getCustomerUnpaidInvoices({ customerId: X })` ÙŠÙØ¹ÙŠØ¯ ÙÙˆØ§ØªÙŠØ±ØŒ Ùˆ`settleInvoicesFromSubscription` ØªÙÙ†ÙÙ‘Ø° Ø§Ù„ØªØ³ÙˆÙŠØ© Ø¨Ù†Ø¬Ø§Ø­

---

## Phase 3: User Story 1 - ØªØ³ÙˆÙŠØ© ÙÙˆØ§ØªÙŠØ± Ù…Ù† Ø±ØµÙŠØ¯ Ø§Ø´ØªØ±Ø§Ùƒ Ù†Ø´Ø· (Priority: P1) ðŸŽ¯ MVP

**Goal**: Ø²Ø± "ØªØ³ÙˆÙŠØ© ÙÙˆØ§ØªÙŠØ±" ÙÙŠ ØµÙ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ ÙŠÙØªØ­ modal ÙˆÙŠÙÙ†ÙÙ‘Ø° Ø§Ù„ØªØ³ÙˆÙŠØ© Ø§Ù„ÙƒØ§Ù…Ù„Ø©

**Independent Test**: Ø§Ø´ØªØ±Ø§Ùƒ Ù†Ø´Ø· + 3 ÙÙˆØ§ØªÙŠØ± pending â†’ Ø¶ØºØ· Ø§Ù„Ø²Ø± â†’ Ø§Ø®ØªÙŠØ§Ø± ÙØ§ØªÙˆØ±ØªÙŠÙ† â†’ ØªØ£ÙƒÙŠØ¯ â†’ Ø±ØµÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ ÙŠÙ†Ù‚Øµ ÙˆØ§Ù„ÙØ§ØªÙˆØ±ØªØ§Ù† ØªØµØ¨Ø­Ø§Ù† Ù…Ø¯ÙÙˆØ¹ØªÙŠÙ†

### Implementation for User Story 1

- [X] T009 [P] [US1] Add `#modalSettleInvoices` modal HTML in `screens/subscriptions/subscriptions.html` â€” modal with: header "ØªØ³ÙˆÙŠØ© ÙÙˆØ§ØªÙŠØ±"ØŒ div#settleInvCurrentBalance (Ø±ØµÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ)ØŒ table#settleInvTable (Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ù…Ø¹ checkbox Ù„ÙƒÙ„ Ù…Ù†Ù‡Ø§)ØŒ div#settleInvSummary (Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø®ØªØ§Ø± + Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ø¨Ø¹Ø¯ Ø§Ù„ØªØ³ÙˆÙŠØ©)ØŒ footer with btnSettleInvConfirm (disabled by default) + btnSettleInvCancel â€” use existing modal-overlay/modal-box CSS classes
- [X] T010 [P] [US1] Add "ØªØ³ÙˆÙŠØ© ÙÙˆØ§ØªÙŠØ±" button in `screens/subscriptions/subscriptions.js` inside `subscriptionsTableBody.innerHTML` map â€” render as `sub-action-btn` only when `s.display_status === 'active'`, add attribute `data-sub-settle="${s.id}"` and `data-sub-settle-customer="${s.customer_id}"` and `data-sub-settle-period="${s.current_period_id}"` and `data-sub-settle-balance="${s.credit_remaining}"` â€” use invoice SVG icon
- [X] T011 [US1] Implement `openSettleInvoicesModal(subscriptionId, customerId, periodId, creditRemaining)` in `screens/subscriptions/subscriptions.js` â€” calls `window.api.getCustomerUnpaidInvoices({ customerId })` â†’ if empty array: showToast('Ù„Ø§ ØªÙˆØ¬Ø¯ ÙÙˆØ§ØªÙŠØ± ØºÙŠØ± Ù…Ø³Ø¯Ø¯Ø©', 'error') and return â†’ else: populate #settleInvCurrentBalance with creditRemaining, render invoice rows in #settleInvTable with checkboxes, reset #settleInvSummary, disable #btnSettleInvConfirm, show modal
- [X] T012 [US1] Implement checkbox change handler in `screens/subscriptions/subscriptions.js` â€” on each checkbox change: recalculate `totalSelected = SUM(checked invoice amounts)` â†’ update #settleInvSummary showing total + `balanceAfter = creditRemaining - totalSelected` â†’ enable/disable #btnSettleInvConfirm based on: `totalSelected > 0 && totalSelected <= creditRemaining`
- [X] T013 [US1] Implement `handleSettleInvoicesConfirm()` in `screens/subscriptions/subscriptions.js` â€” get checked invoiceIds array, call `window.api.settleInvoicesFromSubscription({ subscriptionPeriodId, invoiceIds, createdBy })` â†’ on success: showToast('ØªÙ…Øª ØªØ³ÙˆÙŠØ© Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ø¨Ù†Ø¬Ø§Ø­')ØŒ close modalØŒ update credit_remaining cell in table row without full reload (find row by subscription id, update balance cell) â†’ on error: showToast(res.message, 'error')
- [X] T014 [US1] Bind click events for settle button and modal buttons in `screens/subscriptions/subscriptions.js` inside `bindSubscriptionRowActions()` â€” querySelectorAll('[data-sub-settle]') â†’ addEventListener('click', openSettleInvoicesModal) â€” also bind #btnSettleInvConfirm and #btnSettleInvCancel and modal overlay backdrop click to close

**Checkpoint**: ØªØ¯ÙÙ‚ US1 ÙŠØ¹Ù…Ù„ ÙƒØ§Ù…Ù„Ø§Ù‹ â€” Ø§Ù„Ø²Ø± ÙŠØ¸Ù‡Ø± Ù„Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ø§Ù„Ù†Ø´Ø·Ø©ØŒ Ø§Ù„Ù€ modal ÙŠØ¹Ø±Ø¶ Ø§Ù„ÙÙˆØ§ØªÙŠØ±ØŒ Ø§Ù„Ø§Ø®ØªÙŠØ§Ø± ÙŠØ­Ø¯Ù‘Ø« Ø§Ù„Ø±ØµÙŠØ¯ Ù„Ø­Ø¸ÙŠØ§Ù‹ØŒ Ø§Ù„ØªØ£ÙƒÙŠØ¯ ÙŠÙÙ†ÙÙ‘Ø° Ø§Ù„ØªØ³ÙˆÙŠØ©

---

## Phase 4: User Story 2 - Ù…Ù†Ø¹ ØªØ¬Ø§ÙˆØ² Ø±ØµÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ (Priority: P1)

**Goal**: Ù…Ù†Ø¹ Ø§Ù„ØªØ£ÙƒÙŠØ¯ Ø¥Ø°Ø§ ØªØ¬Ø§ÙˆØ² Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø®ØªØ§Ø±Ø© Ø±ØµÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ

**Independent Test**: Ø§Ø®ØªÙŠØ§Ø± ÙÙˆØ§ØªÙŠØ± Ø¨Ø¥Ø¬Ù…Ø§Ù„ÙŠ > Ø±ØµÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ â†’ Ø²Ø± Ø§Ù„ØªØ£ÙƒÙŠØ¯ Ù…Ø¹Ø·Ù‘Ù„ + Ø±Ø³Ø§Ù„Ø© ÙˆØ§Ø¶Ø­Ø©

*Ù…Ù„Ø§Ø­Ø¸Ø©: Ù‡Ø°Ù‡ Ø§Ù„Ù‚ØµØ© ØªÙÙ†ÙÙŽÙ‘Ø° ÙƒØ¬Ø²Ø¡ Ù…Ù† Ù…Ù†Ø·Ù‚ T012 â€” Ø§Ù„Ù€ checkbox handler ÙŠÙØ¹Ø·Ù‘Ù„ Ø§Ù„Ø²Ø± ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø¥Ø°Ø§ `totalSelected > creditRemaining`. Ø§Ù„ØªØ­Ù‚Ù‚ Ø§Ù„Ø¥Ø¶Ø§ÙÙŠ ÙÙŠ Ø§Ù„Ù€ DB layer Ù…ÙˆØ¬ÙˆØ¯ ÙÙŠ T004.*

- [X] T015 [US2] Add inline warning message element `#settleInvWarning` in `screens/subscriptions/subscriptions.html` inside #modalSettleInvoices â€” hidden by default, shows "Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø®ØªØ§Ø±Ø© ÙŠØªØ¬Ø§ÙˆØ² Ø±ØµÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ" in red when totalSelected > creditRemaining
- [X] T016 [US2] Update checkbox change handler (T012) in `screens/subscriptions/subscriptions.js` â€” show #settleInvWarning and apply red style on #settleInvSummary when `totalSelected > creditRemaining`, hide warning and restore normal style when `totalSelected <= creditRemaining`

**Checkpoint**: Ø§Ø®ØªÙŠØ§Ø± ÙÙˆØ§ØªÙŠØ± Ø¨Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø²Ø§Ø¦Ø¯ ÙŠÙØ¸Ù‡Ø± ØªØ­Ø°ÙŠØ±Ø§Ù‹ Ø£Ø­Ù…Ø± ÙˆÙŠÙØ¹Ø·Ù‘Ù„ Ø²Ø± Ø§Ù„ØªØ£ÙƒÙŠØ¯ â€” DB layer ÙŠØ±ÙØ¶ Ø£ÙŠØ¶Ø§Ù‹ ÙƒØ­Ø§Ø¬Ø² Ø«Ø§Ù†Ù

---

## Phase 5: User Story 3 - Ø§Ù„Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ø¬Ø²Ø¦ÙŠ Ù„Ù„ÙÙˆØ§ØªÙŠØ± (Priority: P2)

**Goal**: ØªØ£ÙƒÙŠØ¯ Ø£Ù† Ø§Ù„ÙÙˆØ§ØªÙŠØ± ØºÙŠØ± Ø§Ù„Ù…Ø®ØªØ§Ø±Ø© ØªØ¨Ù‚Ù‰ Ù…ÙØªÙˆØ­Ø©

**Independent Test**: 5 ÙÙˆØ§ØªÙŠØ± â†’ Ø§Ø®ØªÙŠØ§Ø± 2 â†’ ØªØ£ÙƒÙŠØ¯ â†’ Ø§Ù„ØªØ­Ù‚Ù‚ Ø£Ù† 3 Ù„Ø§ ØªØ²Ø§Ù„ pending ÙÙŠ Ø´Ø§Ø´Ø© Ø§Ù„ÙÙˆØ§ØªÙŠØ±

*Ù…Ù„Ø§Ø­Ø¸Ø©: Ù‡Ø°Ù‡ Ø§Ù„Ù‚ØµØ© Ù…ÙØºØ·Ø§Ø© Ø¨Ø§Ù„ÙƒØ§Ù…Ù„ Ø¨Ù…Ù†Ø·Ù‚ T004 Ùˆ T013 â€” Ø§Ù„Ù€ `WHERE id IN (invoiceIds)` ÙŠÙØ¹Ø§Ù„Ø¬ Ø§Ù„Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ø¬Ø²Ø¦ÙŠ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹. Ù„Ø§ ØªØ¹Ø¯ÙŠÙ„ Ø¥Ø¶Ø§ÙÙŠ Ù…Ø·Ù„ÙˆØ¨.*

- [X] T017 [P] [US3] Visual confirmation: update #settleInvTable in `screens/subscriptions/subscriptions.html` to show clearly unselected invoices with muted style â€” add CSS class `settle-inv-row--unselected` that dims unchecked rows â€” handle via checkbox change event in `screens/subscriptions/subscriptions.js`

**Checkpoint**: Ø§Ù„Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ø¬Ø²Ø¦ÙŠ ÙŠØ¹Ù…Ù„ Ø¨Ø´ÙƒÙ„ ØµØ­ÙŠØ­ â€” Ø§Ù„ÙÙˆØ§ØªÙŠØ± ØºÙŠØ± Ø§Ù„Ù…Ø®ØªØ§Ø±Ø© ÙˆØ§Ø¶Ø­Ø© Ø¨ØµØ±ÙŠØ§Ù‹ ÙˆØªØ¨Ù‚Ù‰ pending Ø¨Ø¹Ø¯ Ø§Ù„ØªØ³ÙˆÙŠØ©

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T018 [P] Add i18n keys for new UI strings in `assets/i18n.js` â€” keys: `subscriptions-settle-invoices-btn`, `subscriptions-settle-modal-title`, `subscriptions-settle-current-balance`, `subscriptions-settle-total-selected`, `subscriptions-settle-balance-after`, `subscriptions-settle-confirm-btn`, `subscriptions-settle-warning-exceeds`, `subscriptions-settle-no-invoices`, `subscriptions-settle-success` â€” add Arabic and English values
- [ ] T019 [P] Add CSS styles for #modalSettleInvoices and settle-related elements in `screens/subscriptions/subscriptions.html` inline styles block â€” `.settle-inv-row--unselected { opacity: 0.5 }`, `.settle-inv-warning { color: #dc2626; font-size: 12px; }`, `.settle-inv-balance-negative { color: #dc2626; font-weight: 800; }`
- [ ] T020 Run quickstart.md Scenario 1 through 5 manually and verify all checkpoints pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies â€” start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 â€” BLOCKS all UI work
  - T003 â†’ T004 (settleInvoicesFromSubscription depends on getCustomerUnpaidInvoices pattern)
  - T005 depends on T003 | T006 depends on T004
  - T007, T008, T021 [P] â€” can run in parallel with each other and with T005/T006
- **Phase 3 (US1)**: Depends on Phase 2 completion
  - T009 [P] with T010 â€” different files (HTML vs JS)
  - T011 depends on T009 (modal must exist) and Phase 2 (API must work)
  - T012 depends on T011
  - T013 depends on T012
  - T014 depends on T009, T010, T011, T013
- **Phase 4 (US2)**: Can start after T012 is done (same handler)
- **Phase 5 (US3)**: Can start after T009 (HTML modal structure)
- **Phase 6 (Polish)**: T018 [P] T019 [P] can run anytime after Phase 3 starts | T020 after all phases

### Critical Path

`T001 â†’ T002 â†’ T003 â†’ T004 â†’ T005/T006/T007/T008/T021 â†’ T009/T010 â†’ T011 â†’ T012 â†’ T013 â†’ T014 â†’ T020`

---

## Parallel Opportunities

```
# Phase 1 â€” sequential (T001 then T002, same location in db.js)

# Phase 2 â€” partial parallel:
T003 (db function 1) â”€â”
                       â”œâ”€â†’ T005 (handler 1) â”€â”
T004 (db function 2) â”€â”¤                       â”œâ”€â†’ T007 [P] (web-api 1)
                       â””â”€â†’ T006 (handler 2) â”€â”¤
T021 [P] (db exports) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤â”€â†’ T008 [P] (web-api 2)
                                               â””â”€â†’ (Phase 3)

# Phase 3 â€” partial parallel:
T009 [P] (HTML modal) â”€â”€â”
T010 [P] (JS button)  â”€â”€â”˜â”€â†’ T011 â†’ T012 â†’ T013 â†’ T014

# Phase 6 â€” fully parallel:
T018 [P] (i18n) â”€â”
T019 [P] (CSS)  â”€â”¤â”€ all independent
T021 [P] (exports)â”€â”˜
```

---

## Implementation Strategy

### MVP (User Story 1 + 2 â€” Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ§Øª)

1. Phase 1: DB migration (T001, T002)
2. Phase 2: DB functions + API (T003â€“T008)
3. Phase 3: Modal + Button + Logic (T009â€“T014)
4. Phase 4: Warning message (T015â€“T016)
5. **STOP and VALIDATE**: quickstart.md Scenario 1 + 2

### Full Delivery

5. Phase 5: Visual polish for partial selection (T017)
6. Phase 6: i18n + CSS polish + exports (T018â€“T021)
7. Final validation: quickstart.md Scenarios 3â€“5

---

## Notes

- Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ù‡Ø§Ù… ØªØ¹Ø¯Ù‘Ù„ Ù…Ù„ÙØ§Øª Ù…ÙˆØ¬ÙˆØ¯Ø© ÙÙ‚Ø· â€” Ù„Ø§ Ù…Ù„ÙØ§Øª Ø¬Ø¯ÙŠØ¯Ø©
- T004 Ù‡ÙŠ Ø£Ø¹Ù‚Ø¯ Ù…Ù‡Ù…Ø© â€” transaction ÙƒØ§Ù…Ù„Ø© Ù…Ø¹ 6 Ø®Ø·ÙˆØ§Øª
- T014 (bind events) ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† Ø¢Ø®Ø± Ù…Ù‡Ù…Ø© ÙÙŠ Phase 3
- T021 (exports) Ù…Ù‡Ù… Ù„ØªØ¬Ù†Ø¨ `undefined` error Ø¹Ù†Ø¯ Ø§Ø³ØªØ¯Ø¹Ø§Ø¡ Ø§Ù„Ø¯ÙˆØ§Ù„
- Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø± Ø§Ù„ÙŠØ¯ÙˆÙŠ Ø¨Ù€ quickstart.md ÙŠÙØ¹ÙˆÙ‘Ø¶ ØºÙŠØ§Ø¨ test framework
