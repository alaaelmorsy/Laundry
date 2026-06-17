(function () {
  var MAX_WAIT_MS = 5 * 60 * 1000;
  var POLL_MS = 3000;
  var started = Date.now();
  var statusMsg = document.getElementById('statusMsg');

  function poll() {
    if (Date.now() - started > MAX_WAIT_MS) {
      if (statusMsg) statusMsg.textContent = 'انتهت مهلة الانتظار. يرجى إعادة تشغيل التطبيق يدوياً.';
      return;
    }
    fetch('/', { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        if (r.ok) {
          window.location.href = '/';
        } else {
          setTimeout(poll, POLL_MS);
        }
      })
      .catch(function () {
        setTimeout(poll, POLL_MS);
      });
  }

  setTimeout(poll, POLL_MS);
})();
