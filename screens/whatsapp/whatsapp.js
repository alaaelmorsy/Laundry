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
      showToast('انتهت باقة الرسائل — تواصل مع الدعم الفني لشراء باقة جديدة', 'error');
    }
  }

  function checkQuotaBeforeSend() {
    var remaining = parseInt(document.getElementById('statRemaining').textContent, 10);
    var total     = parseInt(document.getElementById('statTotal').textContent, 10);
    if (total > 0 && remaining <= 0) {
      showToast('انتهت باقة الرسائل — تواصل مع الدعم الفني لشراء باقة جديدة', 'error');
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
      connected:    'متصل ✓',
      connecting:   'جاري الاتصال...',
      disconnected: 'غير متصل',
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
    showToast('تم تحديث الحالة');
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
        showToast('جاري الاتصال... امسح رمز QR من هاتفك');
      } else {
        showToast((res && res.message) || 'فشل الاتصال', 'error');
      }
    } catch (e) {
      showToast('حدث خطأ أثناء الاتصال', 'error');
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
          showToast('تم قطع الاتصال وحذف الجلسة');
        }
      } catch (e) {
        showToast('حدث خطأ', 'error');
      } finally {
        btn.disabled = false;
      }
    };
  });

  document.getElementById('btnSend').addEventListener('click', async function () {
    var phone   = document.getElementById('inputPhone').value.trim();
    var message = document.getElementById('inputMessage').value.trim();

    if (!phone || !message) {
      showToast('الرجاء إدخال رقم الجوال والرسالة', 'error');
      return;
    }
    if (_currentStatus !== 'connected') {
      showToast('يجب الاتصال بـ WhatsApp أولاً', 'error');
      return;
    }
    if (!checkQuotaBeforeSend()) return;

    var btn = this;
    btn.disabled = true;
    btn.textContent = 'جارٍ الإرسال...';

    try {
      var res = await window.api.whatsappSendTest({ phone: phone, message: message });
      if (res && res.success) {
        showToast('✓ تم إرسال الرسالة بنجاح');
        document.getElementById('inputPhone').value   = '';
        document.getElementById('inputMessage').value = '';
        // Refresh quota
        var q = await window.api.whatsappGetQuota();
        if (q && q.success) renderQuota(q);
      } else {
        showToast((res && res.message) || 'فشل الإرسال', 'error');
      }
    } catch (e) {
      showToast('حدث خطأ أثناء الإرسال', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:1rem;height:1rem"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> إرسال رسالة تجريبية';
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  (async function init() {
    startPolling();
    await fetchStatus();
  })();

  window.addEventListener('beforeunload', stopPolling);

})();
