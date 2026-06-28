window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnBack').addEventListener('click', () => window.api.navigateBack());

  const REPORT_CARDS = [
    { id: 'cardDailyReport',          perm: 'report_daily',          url: '/screens/reports/daily-report/daily-report.html' },
    { id: 'cardPeriodReport',         perm: 'report_period',         url: '/screens/reports/period-report/period-report.html' },
    { id: 'cardExpensesReport',       perm: 'report_expenses',       url: '/screens/reports/expenses-report/expenses-report.html' },
    { id: 'cardCreditInvoicesReport', perm: 'report_credit_invoices',url: '/screens/reports/credit-invoices-report/credit-invoices-report.html' },
    { id: 'cardAllInvoicesReport',    perm: 'report_all_invoices',   url: '/screens/reports/all-invoices-report/all-invoices-report.html' },
    { id: 'cardSubscriptionsReport',  perm: 'report_subscriptions',  url: '/screens/reports/subscriptions-report/subscriptions-report.html' },
    { id: 'cardTypesReport',          perm: 'report_types',          url: '/screens/reports/types-report/types-report.html' },
    { id: 'cardWorkerReport',         perm: 'report_worker',         url: '/screens/reports/worker-report/worker-report.html' },
    { id: 'cardCustomerAccountReport', perm: 'report_customer_account', url: '/screens/reports/customer-account-report/customer-account-report.html' },
    { id: 'cardHotelsCompaniesReport', perm: 'report_hotels_companies', url: '/screens/reports/hotels-companies-report/hotels-companies-report.html' },
    { id: 'cardZakatReport',          perm: 'report_zakat',          url: '/screens/reports/zakat-report/zakat-report.html' },
  ];

  function applyPermissions() {
    const u = window.__currentUser;
    // Admin or legacy (has `reports` but no sub-perms yet) → show all
    const hasSubPerms = u && u.permissions &&
      ['report_daily','report_period','report_expenses','report_credit_invoices',
       'report_all_invoices','report_subscriptions','report_types','report_worker','report_zakat',
       'report_customer_account','report_hotels_companies']
        .some(k => k in u.permissions);

    REPORT_CARDS.forEach(({ id, perm, url }) => {
      const card = document.getElementById(id);
      if (!card) return;
      const allowed = !hasSubPerms || window.hasPermission(perm);
      card.style.display = allowed ? '' : 'none';
      if (allowed) card.addEventListener('click', () => { location.href = url; });
    });
  }

  if (window.__currentUser) {
    applyPermissions();
  } else {
    window.addEventListener('userReady', applyPermissions, { once: true });
  }

  if (typeof I18N !== 'undefined') I18N.apply();
});
