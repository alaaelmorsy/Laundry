window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnBack').addEventListener('click', () => window.api.navigateBack());

  document.getElementById('cardDailyReport').addEventListener('click', () => {
    location.href = '/screens/reports/daily-report/daily-report.html';
  });

  document.getElementById('cardPeriodReport').addEventListener('click', () => {
    location.href = '/screens/reports/period-report/period-report.html';
  });

  document.getElementById('cardAllInvoicesReport').addEventListener('click', () => {
    location.href = '/screens/reports/all-invoices-report/all-invoices-report.html';
  });

  document.getElementById('cardSubscriptionsReport').addEventListener('click', () => {
    location.href = '/screens/reports/subscriptions-report/subscriptions-report.html';
  });

  if (typeof I18N !== 'undefined') I18N.apply();
});
