window.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btnLogout');
  const btnLang = document.getElementById('btnLang');
  const langLabel = document.getElementById('langLabel');

  btnLogout.addEventListener('click', () => window.api.logout());

  document.querySelectorAll('.menu-card').forEach(card => {
    card.addEventListener('click', () => {
      const screen = card.dataset.screen;
      if (screen === 'roles') {
        location.href = '/screens/roles/roles.html';
        return;
      }
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

  function applyPermissions(user) {
    if (!user) return;
    if (user.role === 'admin' || user.role === 'superadmin') return; // admin sees everything

    document.querySelectorAll('.menu-card[data-permission]').forEach(card => {
      const perm = card.dataset.permission;
      const allowed = user.permissions && user.permissions[perm];
      card.style.display = allowed ? '' : 'none';
    });

    const welcomeEl = document.getElementById('welcomeUser');
    if (welcomeEl && user.full_name) {
      welcomeEl.textContent = 'مرحباً، ' + user.full_name;
    }
  }

  if (window.__currentUser) {
    applyPermissions(window.__currentUser);
  } else {
    window.addEventListener('userReady', (e) => applyPermissions(e.detail));
  }
});
