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
    if (u.role === 'admin' || u.role === 'superadmin') return true;
    return !!(u.permissions && u.permissions[key]);
  };

  // ── فحص التحديثات وعرض إشعار ──────────────────────────────────────────────
  (function checkUpdateNotification() {
    // لا تعرض الإشعار في صفحة الإعدادات (لديها واجهتها الخاصة)
    const currentPath = location.pathname.replace(/\\/g, '/');
    if (currentPath.indexOf('/screens/settings/') !== -1) return;

    const SESSION_KEY = 'update_notif_shown';
    if (sessionStorage.getItem(SESSION_KEY)) return;

    function fmtBytes(b) {
      if (!b) return '';
      if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
      if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
      return b + ' B';
    }

    function showUpdateBanner(data) {
      sessionStorage.setItem(SESSION_KEY, '1');

      const banner = document.createElement('div');
      banner.id = 'global-update-banner';
      banner.style.cssText = [
        'position:fixed',
        'top:16px',
        'left:16px',
        'z-index:99999',
        'background:linear-gradient(135deg,#1d4ed8,#3b82f6)',
        'color:#fff',
        'border-radius:14px',
        'padding:14px 18px',
        'box-shadow:0 8px 32px rgba(37,99,235,.35)',
        'display:flex',
        'align-items:flex-start',
        'gap:12px',
        'max-width:320px',
        'min-width:240px',
        'font-family:Cairo,sans-serif',
        'font-weight:700',
        'animation:slideInLeft .4s cubic-bezier(.4,0,.2,1)',
        'cursor:pointer',
      ].join(';');

      const size = data.assetSize ? ` (${fmtBytes(data.assetSize)})` : '';
      banner.innerHTML = `
        <style>
          @keyframes slideInLeft{from{transform:translateX(-120%);opacity:0}to{transform:translateX(0);opacity:1}}
          @keyframes slideOutLeft{from{transform:translateX(0);opacity:1}to{transform:translateX(-120%);opacity:0}}
        </style>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="flex-shrink:0;margin-top:1px">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;margin-bottom:3px">تحديث متاح — الإصدار ${data.latestVersion || ''}</div>
          <div style="font-size:11px;opacity:.82;font-weight:400">اضغط للذهاب إلى الإعدادات${size}</div>
        </div>
        <button id="closeBannerBtn" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:14px;line-height:1;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:-2px" title="إغلاق">×</button>
      `;

      function dismiss() {
        banner.style.animation = 'slideOutLeft .35s cubic-bezier(.4,0,.2,1) forwards';
        setTimeout(() => { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 350);
      }

      banner.addEventListener('click', (e) => {
        if (e.target.id === 'closeBannerBtn') { dismiss(); return; }
        location.href = '/screens/settings/settings.html#update';
      });

      document.body.appendChild(banner);

      // يختفي تلقائياً بعد 8 ثوانٍ
      setTimeout(dismiss, 8000);
    }

    fetch('/api/invoke', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'getUpdateStatus' }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.hasUpdate) {
          // تأخير بسيط حتى تكتمل الصفحة
          setTimeout(() => showUpdateBanner(data), 1500);
        }
      })
      .catch(() => {});
  })();
})();
