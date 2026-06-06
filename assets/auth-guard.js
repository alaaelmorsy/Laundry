(function () {
  const p = location.pathname.replace(/\\/g, '/');
  if (p.indexOf('/screens/login/') !== -1) return;

  fetch('/api/auth/me', { credentials: 'include' })
    .then((r) => {
      if (!r.ok) {
        location.href = '/screens/login/login.html';
        return;
      }
      return r.json();
    })
    .then((data) => {
      if (!data) return;
      window.__currentUser = data.user || null;
      window.dispatchEvent(new CustomEvent('userReady', { detail: window.__currentUser }));
    })
    .catch(() => {
      location.href = '/screens/login/login.html';
    });

  window.hasPermission = function (key) {
    const u = window.__currentUser;
    if (!u) return false;
    if (u.role === 'admin') return true;
    return !!(u.permissions && u.permissions[key]);
  };
})();
