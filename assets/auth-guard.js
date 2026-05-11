(function () {
  const p = location.pathname.replace(/\\/g, '/');
  if (p.indexOf('/screens/login/') !== -1) return;

  fetch('/api/auth/me', { credentials: 'include' })
    .then((r) => {
      if (!r.ok) {
        location.href = '/screens/login/login.html';
      }
    })
    .catch(() => {
      location.href = '/screens/login/login.html';
    });
})();
