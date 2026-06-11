(function () {
  'use strict';

  var _pollInterval  = null;
  var _currentStatus = 'disconnected';

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(msg, type) {
    type = type || 'success';
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = 'toast ' + type;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = 'toast hidden'; }, 3500);
  }

  // ── Quota ──────────────────────────────────────────────────────────────────

  var _quotaWarningShown = false;

  function renderQuota(quota, showWarning) {
    if (!quota) return;
    document.getElementById('statUsed').textContent      = quota.quota_used      != null ? quota.quota_used      : '—';
    document.getElementById('statRemaining').textContent = quota.quota_remaining  != null ? quota.quota_remaining : '—';
    document.getElementById('statTotal').textContent     = quota.quota_total      != null ? quota.quota_total     : '—';

    if (showWarning && quota.quota_total > 0 && quota.quota_remaining <= 0 && !_quotaWarningShown) {
      _quotaWarningShown = true;
      showToast(window.I18N.t('whatsapp-toast-quota-error'), 'error');
    }
  }

  function checkQuotaBeforeSend() {
    var remaining = parseInt(document.getElementById('statRemaining').textContent, 10);
    var total     = parseInt(document.getElementById('statTotal').textContent, 10);
    if (total > 0 && remaining <= 0) {
      showToast(window.I18N.t('whatsapp-toast-quota-error'), 'error');
      return false;
    }
    return true;
  }

  // ── Connection Status ──────────────────────────────────────────────────────

  function renderStatus(status, qr) {
    _currentStatus = status;

    var dot         = document.getElementById('statusDot');
    var text        = document.getElementById('statusText');
    var qrArea      = document.getElementById('qrArea');
    var qrImage     = document.getElementById('qrImage');
    var connInfo    = document.getElementById('connectedInfo');
    var connPlaceholder = document.getElementById('connPlaceholder');
    var btnConnect  = document.getElementById('btnConnect');
    var btnDisconn  = document.getElementById('btnDisconnect');

    // Status dot
    dot.className = 'status-dot ' + status;

    var labels = {
      connected:    window.I18N.t('whatsapp-status-connected'),
      connecting:   window.I18N.t('whatsapp-status-connecting'),
      disconnected: window.I18N.t('whatsapp-status-disconnected'),
    };
    text.textContent = labels[status] || status;

    // QR
    if (status === 'connecting' && qr) {
      qrArea.classList.remove('hidden');
      qrImage.src = qr;
      connInfo.classList.add('hidden');
    } else {
      qrArea.classList.add('hidden');
    }

    // Connected info
    if (status === 'connected') {
      connInfo.classList.remove('hidden');
      if (connPlaceholder) connPlaceholder.classList.add('hidden');
    } else {
      connInfo.classList.add('hidden');
    }

    // Placeholder (shown only when disconnected with no QR)
    if (connPlaceholder) {
      if (status === 'disconnected') {
        connPlaceholder.classList.remove('hidden');
      } else {
        connPlaceholder.classList.add('hidden');
      }
    }

    // Buttons
    if (status === 'connected') {
      btnConnect.classList.add('hidden');
      btnDisconn.classList.remove('hidden');
      stopPolling();
    } else {
      btnConnect.classList.remove('hidden');
      btnDisconn.classList.add('hidden');
    }

  }

  // ── Polling ────────────────────────────────────────────────────────────────

  async function fetchStatus() {
    try {
      if (!window.api) return;
      var res = await window.api.whatsappGetStatus();
      if (res && res.success) {
        renderStatus(res.status, res.qr);
        renderQuota(res.quota, true);
      } else {
        renderStatus('disconnected', null);
      }
    } catch (e) {
      renderStatus('disconnected', null);
    }
  }

  function startPolling() {
    if (_pollInterval) return;
    _pollInterval = setInterval(fetchStatus, 3000);
  }

  function stopPolling() {
    if (_pollInterval) {
      clearInterval(_pollInterval);
      _pollInterval = null;
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  document.getElementById('btnBack').addEventListener('click', function () {
    location.href = '/screens/dashboard/dashboard.html';
  });

  document.getElementById('btnRefresh').addEventListener('click', async function () {
    await fetchStatus();
    showToast(window.I18N.t('whatsapp-toast-status-updated'));
  });

  document.getElementById('btnConnect').addEventListener('click', async function () {
    var btn = this;
    btn.disabled = true;
    try {
      var res = await window.api.whatsappConnect();
      if (res && res.success) {
        renderStatus(res.status, res.qr);
        renderQuota(res.quota);
        startPolling();
        showToast(window.I18N.t('whatsapp-toast-connecting'));
      } else {
        showToast((res && res.message) || window.I18N.t('whatsapp-toast-conn-failed'), 'error');
      }
    } catch (e) {
      showToast(window.I18N.t('whatsapp-toast-conn-error'), 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btnDisconnect').addEventListener('click', function () {
    var btn = this;
    var modal = document.getElementById('confirmModal');
    modal.classList.remove('hidden');

    document.getElementById('modalCancel').onclick = function () {
      modal.classList.add('hidden');
    };

    document.getElementById('modalConfirm').onclick = async function () {
      modal.classList.add('hidden');
      btn.disabled = true;
      try {
        var res = await window.api.whatsappDisconnect();
        if (res && res.success) {
          renderStatus('disconnected', null);
          stopPolling();
          showToast(window.I18N.t('whatsapp-toast-disconnected'));
        }
      } catch (e) {
        showToast(window.I18N.t('whatsapp-toast-error'), 'error');
      } finally {
        btn.disabled = false;
      }
    };
  });

  document.getElementById('btnSend').addEventListener('click', async function () {
    var phone   = document.getElementById('inputPhone').value.trim();
    var message = document.getElementById('inputMessage').value.trim();

    if (!phone || !message) {
      showToast(window.I18N.t('whatsapp-toast-validation'), 'error');
      return;
    }
    if (_currentStatus !== 'connected') {
      showToast(window.I18N.t('whatsapp-toast-must-connect'), 'error');
      return;
    }
    if (!checkQuotaBeforeSend()) return;

    var btn = this;
    btn.disabled = true;
    var btnOriginalHtml = btn.innerHTML;
    btn.textContent = window.I18N.t('whatsapp-btn-sending');

    try {
      var res = await window.api.whatsappSendTest({ phone: phone, message: message });
      if (res && res.success) {
        showToast(window.I18N.t('whatsapp-toast-sent-success'));
        document.getElementById('inputPhone').value   = '';
        document.getElementById('inputMessage').value = '';
        // Refresh quota
        var q = await window.api.whatsappGetQuota();
        if (q && q.success) renderQuota(q);
      } else {
        showToast((res && res.message) || window.I18N.t('whatsapp-toast-send-failed'), 'error');
      }
    } catch (e) {
      showToast(window.I18N.t('whatsapp-toast-send-error'), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = btnOriginalHtml;
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  (async function init() {
    if (window.I18N) window.I18N.apply();
    startPolling();
    await fetchStatus();
  })();

  window.addEventListener('beforeunload', stopPolling);

})();
