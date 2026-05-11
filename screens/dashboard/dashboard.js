window.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btnLogout');
  const btnLang = document.getElementById('btnLang');
  const langLabel = document.getElementById('langLabel');

  btnLogout.addEventListener('click', () => window.api.logout());

  document.querySelectorAll('.menu-card').forEach(card => {
    card.addEventListener('click', () => {
      const screen = card.dataset.screen;
      window.api.navigateTo(screen);
    });
  });

  function updateLangButton() {
    langLabel.textContent = I18N.t('lang-switch');
  }

  btnLang.addEventListener('click', () => {
    const newLang = I18N.getLang() === 'ar' ? 'en' : 'ar';
    I18N.apply(newLang);
    updateLangButton();
  });

  I18N.apply();
  updateLangButton();
});
