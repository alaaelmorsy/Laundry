# Invoices Screen Language Bug - Bugfix Design

## Overview

This document formalizes the bug condition and validation approach for fixing the invoices screen language display issue. The bug occurs when the application language is set to English but the invoices screen (`screens/invoices/invoices.html`) continues to display all text elements in Arabic. The root cause is the absence of English translation keys for invoices screen elements in the `assets/i18n.js` file.

The fix is straightforward: add the missing English translation keys to the `_translations.en` object in `assets/i18n.js`. This is a minimal, targeted fix that adds only the necessary translations without modifying any logic or existing functionality.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the application language is set to English (`localStorage 'app_lang' = 'en'`) but the invoices screen displays text in Arabic
- **Property (P)**: The desired behavior - when English is selected, all invoices screen text elements should display in English
- **Preservation**: All existing Arabic translations and other screen translations must remain unchanged
- **I18N.apply()**: The internationalization function in `assets/i18n.js` that applies translations based on the selected language
- **_translations.en**: The English translations object in `assets/i18n.js` that currently lacks invoices screen keys
- **data-i18n attribute**: HTML attribute used to mark elements for translation by the I18N system

## Bug Details

### Bug Condition

The bug manifests when a user has the application language set to English (localStorage 'app_lang' = 'en') and navigates to the invoices screen. The `I18N.apply()` function is called but cannot find English translation keys for invoices screen elements, so the hardcoded Arabic text in the HTML remains unchanged.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { language: string, screen: string }
  OUTPUT: boolean
  
  RETURN input.language = 'en'
         AND input.screen = 'invoices'
         AND NOT existsEnglishTranslations('page-title-invoices')
         AND NOT existsEnglishTranslations('invoices-*')
END FUNCTION
```

### Examples

- **Example 1**: User sets language to English → navigates to invoices screen → page title shows "الفواتير - نظام المغسلة" instead of "Invoices - Laundry System"
- **Example 2**: User sets language to English → opens invoices screen → table headers show "رقم الفاتورة", "التاريخ", "العميل" instead of "Invoice #", "Date", "Customer"
- **Example 3**: User sets language to English → searches for invoice → search placeholder shows "بحث برقم الفاتورة أو اسم العميل أو الهاتف..." instead of "Search by invoice number, customer name or phone..."
- **Example 4**: User sets language to English → views invoice modal → all labels remain in Arabic (expected: English labels)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Arabic translations for the invoices screen must continue to work exactly as before
- All other screens (customers, expenses, services, products, etc.) must continue to function correctly with their existing translations
- The I18N.apply() function logic must remain unchanged
- The invoices screen HTML structure and JavaScript logic must remain unchanged
- Invoice printing functionality must continue to work correctly in both languages

**Scope:**
All inputs that do NOT involve the English language setting should be completely unaffected by this fix. This includes:
- Arabic language display (must remain identical to current behavior)
- Other screens' translations (must not be modified)
- Application logic and functionality (must not be changed)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is clear and confirmed:

1. **Missing Translation Keys**: The `_translations.en` object in `assets/i18n.js` does not contain any keys for the invoices screen elements
   - The Arabic translations object (`_translations.ar`) contains keys like `'page-title-invoices'`, `'invoices-header-title'`, etc.
   - The English translations object (`_translations.en`) is missing these corresponding keys
   - When `I18N.apply('en')` is called, it cannot find the English translations and leaves the Arabic text unchanged

2. **Confirmed by Code Review**: 
   - The `screens/invoices/invoices.html` file contains hardcoded Arabic text in the HTML
   - The `screens/invoices/invoices.js` file calls `I18N.apply()` on initialization
   - The `assets/i18n.js` file has complete Arabic translations but incomplete English translations for the invoices screen

## Correctness Properties

Property 1: Bug Condition - Invoices Screen English Translation

_For any_ application state where the language is set to English (`localStorage 'app_lang' = 'en'`) and the user navigates to the invoices screen, the fixed I18N system SHALL display all text elements in English by successfully finding and applying the English translation keys from `_translations.en`.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-English Language Behavior

_For any_ application state where the language is NOT set to English (e.g., Arabic), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing Arabic translations and functionality for the invoices screen and all other screens.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

The fix requires adding English translation keys to the `_translations.en` object in `assets/i18n.js`.

**File**: `assets/i18n.js`

**Section**: `_translations.en` object (starting around line 666)

**Specific Changes**:

1. **Add Page Title Translation**:
   - Key: `'page-title-invoices'`
   - Value: `'Invoices - Laundry System'`

2. **Add Header and Navigation Translations**:
   - `'invoices-header-title'`: `'Invoices'`
   - `'invoices-back'`: `'Back'`

3. **Add Search and Filter Translations**:
   - `'invoices-search-placeholder'`: `'Search by invoice number, customer name or phone...'`

4. **Add Table Translations**:
   - `'invoices-table-scroll-hint'`: `'← Scroll table left and right to view all columns →'`
   - `'invoices-col-invoice-num'`: `'Invoice #'`
   - `'invoices-col-date'`: `'Date'`
   - `'invoices-col-customer'`: `'Customer'`
   - `'invoices-col-payment'`: `'Payment Method'`
   - `'invoices-col-total'`: `'Total'`
   - `'invoices-col-actions'`: `'Actions'`

5. **Add State and Message Translations**:
   - `'invoices-loading'`: `'Loading...'`
   - `'invoices-empty'`: `'No invoices found'`
   - `'invoices-btn-view'`: `'View'`

6. **Add Pagination Translations**:
   - `'invoices-pagination-info'`: `'Showing {start}–{end} of {total} invoices'`
   - `'invoices-pagination-show'`: `'Show'`
   - `'invoices-pagination-per-page'`: `'per page'`
   - `'invoices-pagination-first'`: `'First page'`
   - `'invoices-pagination-prev'`: `'Previous'`
   - `'invoices-pagination-next'`: `'Next'`
   - `'invoices-pagination-last'`: `'Last page'`

7. **Add Invoice Modal Translations**:
   - `'invoices-modal-close'`: `'Close'`
   - `'invoices-modal-print'`: `'Print'`
   - `'invoices-modal-simplified-tax-invoice'`: `'Simplified Tax Invoice'`
   - `'invoices-modal-invoice-num'`: `'Invoice Number'`
   - `'invoices-modal-date'`: `'Date'`
   - `'invoices-modal-payment'`: `'Payment Method'`
   - `'invoices-modal-paid-at'`: `'Payment Date'`
   - `'invoices-modal-cleaned-at'`: `'Cleaning Date'`
   - `'invoices-modal-delivered-at'`: `'Delivery Date'`
   - `'invoices-modal-cr'`: `'Commercial Register'`
   - `'invoices-modal-cashier'`: `'Cashier'`
   - `'invoices-modal-customer-name'`: `'Name'`
   - `'invoices-modal-customer-phone'`: `'Mobile'`
   - `'invoices-modal-balance'`: `'Remaining Balance'`
   - `'invoices-modal-item-type'`: `'Type'`
   - `'invoices-modal-item-qty'`: `'Qty'`
   - `'invoices-modal-item-total'`: `'Total'`
   - `'invoices-modal-item-service'`: `'Service'`
   - `'invoices-modal-subtotal'`: `'Subtotal (before tax)'`
   - `'invoices-modal-discount'`: `'Discount'`
   - `'invoices-modal-vat'`: `'VAT'`
   - `'invoices-modal-grand-total'`: `'Total (including tax)'`
   - `'invoices-modal-terms'`: `'Terms and Conditions:'`

8. **Add Error Message Translations**:
   - `'invoices-err-load'`: `'Error loading invoices'`
   - `'invoices-err-load-invoice'`: `'Could not load invoice data'`
   - `'invoices-err-generic'`: `'An error occurred while loading the invoice'`

**Implementation Note**: These keys should be added to the `_translations.en` object in the same order and structure as they appear in the `_translations.ar` object for consistency and maintainability.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis.

**Test Plan**: Manually test the invoices screen with English language selected on the UNFIXED code to observe that text remains in Arabic. Document specific elements that fail to translate.

**Test Cases**:
1. **Page Title Test**: Set language to English → navigate to invoices screen → verify page title shows Arabic (will fail on unfixed code)
2. **Table Headers Test**: Set language to English → open invoices screen → verify table headers show Arabic (will fail on unfixed code)
3. **Search Placeholder Test**: Set language to English → focus on search input → verify placeholder shows Arabic (will fail on unfixed code)
4. **Invoice Modal Test**: Set language to English → open an invoice → verify modal labels show Arabic (will fail on unfixed code)

**Expected Counterexamples**:
- Page title displays "الفواتير - نظام المغسلة" instead of English
- Table headers display "رقم الفاتورة", "التاريخ", "العميل" instead of English
- Search placeholder displays Arabic text instead of English
- Invoice modal labels display Arabic text instead of English

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (English language selected), the fixed function produces the expected behavior (English text displayed).

**Pseudocode:**
```
FOR ALL screen_element WHERE language = 'en' AND screen = 'invoices' DO
  result := I18N.apply('en')
  ASSERT screen_element.textContent = englishTranslation(screen_element.key)
END FOR
```

**Testing Approach**: After adding the English translation keys, manually test the invoices screen with English language selected to verify all text elements display in English.

**Test Cases**:
1. **Page Title Verification**: Set language to English → navigate to invoices screen → verify page title shows "Invoices - Laundry System"
2. **Table Headers Verification**: Set language to English → open invoices screen → verify table headers show "Invoice #", "Date", "Customer", "Payment Method", "Total", "Actions"
3. **Search Placeholder Verification**: Set language to English → focus on search input → verify placeholder shows "Search by invoice number, customer name or phone..."
4. **Invoice Modal Verification**: Set language to English → open an invoice → verify all modal labels show English text
5. **Pagination Verification**: Set language to English → navigate through pages → verify pagination controls show English text

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (Arabic language selected or other screens), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT (language = 'en' AND screen = 'invoices') DO
  ASSERT I18N_original.apply(input) = I18N_fixed.apply(input)
END FOR
```

**Testing Approach**: Test the invoices screen with Arabic language selected and test other screens with both languages to ensure no regression.

**Test Plan**: Observe behavior on UNFIXED code first for Arabic language and other screens, then verify the same behavior continues after the fix.

**Test Cases**:
1. **Arabic Language Preservation**: Set language to Arabic → navigate to invoices screen → verify all text displays in Arabic exactly as before
2. **Other Screens Preservation**: Set language to English → navigate to customers, expenses, services screens → verify they continue to work correctly
3. **Language Switching Preservation**: Switch between Arabic and English multiple times → verify all screens respond correctly
4. **Invoice Printing Preservation**: Print an invoice in both languages → verify printing works correctly

### Unit Tests

- Test that `I18N.apply('en')` successfully finds and applies English translations for invoices screen elements
- Test that `I18N.apply('ar')` continues to work correctly for invoices screen elements
- Test that missing translation keys fall back gracefully (if applicable)
- Test that all invoices screen translation keys exist in both `_translations.ar` and `_translations.en`

### Property-Based Tests

- Generate random language switches (between 'ar' and 'en') and verify the invoices screen always displays text in the correct language
- Generate random navigation sequences across different screens and verify translations work correctly
- Test that all translation keys used in the invoices HTML have corresponding entries in both language objects

### Integration Tests

- Test full user flow: login → change language to English → navigate to invoices → view invoice → print invoice
- Test language persistence: set language to English → close app → reopen → verify invoices screen still shows English
- Test cross-screen navigation: navigate from dashboard to invoices to customers and back, verifying translations work correctly throughout
