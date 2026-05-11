# Bugfix Requirements Document

## Introduction

هذا المستند يوثق متطلبات إصلاح خطأ في شاشة الفواتير حيث تظهر الشاشة بالعربية حتى عندما تكون لغة البرنامج مضبوطة على الإنجليزية. المشكلة تحدث بسبب عدم وجود ترجمات إنجليزية لعناصر شاشة الفواتير في ملف `assets/i18n.js`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the application language is set to English (localStorage 'app_lang' = 'en') THEN the invoices screen displays all text elements in Arabic instead of English

1.2 WHEN the user navigates to the invoices screen (`screens/invoices/invoices.html`) with English language selected THEN the page title, headers, buttons, table columns, and all UI text remain in Arabic

1.3 WHEN the I18N.apply() function is called with 'en' language THEN the invoices screen elements do not translate because the English translation keys are missing from the `_translations.en` object in `assets/i18n.js`

### Expected Behavior (Correct)

2.1 WHEN the application language is set to English (localStorage 'app_lang' = 'en') THEN the invoices screen SHALL display all text elements in English

2.2 WHEN the user navigates to the invoices screen with English language selected THEN the page title, headers, buttons, table columns, and all UI text SHALL appear in English

2.3 WHEN the I18N.apply() function is called with 'en' language THEN the invoices screen elements SHALL translate to English using the corresponding keys from the `_translations.en` object in `assets/i18n.js`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the application language is set to Arabic (localStorage 'app_lang' = 'ar') THEN the invoices screen SHALL CONTINUE TO display all text elements in Arabic as it currently does

3.2 WHEN the user switches language from English to Arabic THEN all other screens (customers, expenses, services, products, etc.) SHALL CONTINUE TO function correctly with their existing translations

3.3 WHEN the I18N.apply() function is called THEN all existing screens with complete translations SHALL CONTINUE TO switch languages correctly without any regression

3.4 WHEN the invoices screen loads THEN the invoice modal, pagination controls, and all interactive elements SHALL CONTINUE TO function correctly regardless of language

3.5 WHEN the user prints an invoice THEN the invoice content and formatting SHALL CONTINUE TO work correctly in both languages
