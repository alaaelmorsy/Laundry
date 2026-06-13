window.addEventListener('DOMContentLoaded', () => {
  const btnBack          = document.getElementById('btnBack');
  const userSelect       = document.getElementById('userSelect');
  const permissionsPanel = document.getElementById('permissionsPanel');
  const emptyState       = document.getElementById('emptyState');
  const adminNotice      = document.getElementById('adminNotice');
  const permissionsGrid  = document.getElementById('permissionsGrid');
  const userInfoBar      = document.getElementById('userInfoBar');
  const btnSave          = document.getElementById('btnSave');
  const permError        = document.getElementById('permError');
  const toastContainer   = document.getElementById('toastContainer');

  let allUsers = [];
  let currentUser = null;

  btnBack.addEventListener('click', () => { location.href = '/screens/dashboard/dashboard.html'; });

  // ── Load users into dropdown ──────────────────────────────────────────────
  async function loadUsers() {
    try {
      const result = await window.api.getUsersList();
      if (!result.success) return;
      allUsers = result.users;

      userSelect.innerHTML = `<option value="">${I18N.t('roles-selector-placeholder')}</option>`;
      allUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        const roleLabel = u.role === 'admin' ? I18N.t('users-role-admin') : I18N.t('users-role-cashier');
        opt.textContent = `${u.full_name || u.username} (${roleLabel})`;
        userSelect.appendChild(opt);
      });
    } catch {
      showToast(I18N.t('users-err-load'), 'error');
    }
  }

  // ── User selected ─────────────────────────────────────────────────────────
  userSelect.addEventListener('change', () => {
    const id = Number(userSelect.value);
    if (!id) {
      showEmpty();
      return;
    }
    currentUser = allUsers.find(u => u.id === id) || null;
    if (currentUser) openPermissions(currentUser);
  });

  function openPermissions(user) {
    hideError();
    emptyState.style.display = 'none';
    permissionsPanel.style.display = '';

    // User info bar
    const roleLabel = user.role === 'admin' ? I18N.t('users-role-admin') : I18N.t('users-role-cashier');
    const roleColor = user.role === 'admin' ? '#6366f1' : '#a855f7';
    userInfoBar.innerHTML = `
      <div class="user-avatar">${(user.full_name || user.username).charAt(0)}</div>
      <div class="user-details">
        <span class="user-fullname">${escHtml(user.full_name || user.username)}</span>
        <span class="user-username">@${escHtml(user.username)}</span>
      </div>
      <span class="user-role-badge" style="background:${roleColor}20;color:${roleColor};border-color:${roleColor}40">${roleLabel}</span>
    `;

    if (user.role === 'admin') {
      adminNotice.style.display = 'flex';
      permissionsGrid.style.display = 'none';
      btnSave.style.display = 'none';
    } else {
      adminNotice.style.display = 'none';
      permissionsGrid.style.display = 'grid';
      btnSave.style.display = '';
      setCheckboxes(user.permissions || {});
      updateAllGroupToggles();
    }
  }

  function showEmpty() {
    currentUser = null;
    emptyState.style.display = 'flex';
    permissionsPanel.style.display = 'none';
  }

  // ── Checkboxes ────────────────────────────────────────────────────────────
  const REPORT_SUB_PERMS = [
    'report_daily','report_period','report_expenses','report_credit_invoices',
    'report_all_invoices','report_subscriptions','report_types','report_worker',
    'report_customer_account','report_zakat'
  ];

  function setCheckboxes(permissions) {
    // Legacy: if old `reports: true` with no sub-perms set, enable all sub-perms
    const hasSubPerms = REPORT_SUB_PERMS.some(k => k in permissions);
    document.querySelectorAll('.perm-item input[type="checkbox"]').forEach(cb => {
      const key = cb.dataset.perm;
      if (!hasSubPerms && REPORT_SUB_PERMS.includes(key)) {
        cb.checked = !!permissions['reports'];
      } else {
        cb.checked = !!permissions[key];
      }
    });
  }

  function getPermissionsFromForm() {
    const perms = {};
    document.querySelectorAll('.perm-item input[type="checkbox"]').forEach(cb => {
      perms[cb.dataset.perm] = cb.checked;
    });
    // Derive master `reports` key for dashboard compatibility
    perms['reports'] = REPORT_SUB_PERMS.some(k => perms[k]);
    return perms;
  }

  // Group toggle buttons
  document.querySelectorAll('.btn-group-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const items = document.querySelectorAll(`[data-group-items="${group}"] input[type="checkbox"]`);
      const allChecked = [...items].every(cb => cb.checked);
      items.forEach(cb => { cb.checked = !allChecked; });
      updateGroupToggle(group);
    });
  });

  document.querySelectorAll('.perm-items').forEach(container => {
    container.addEventListener('change', () => {
      updateGroupToggle(container.dataset.groupItems);
    });
  });

  function updateGroupToggle(group) {
    const btn = document.querySelector(`.btn-group-toggle[data-group="${group}"]`);
    if (!btn) return;
    const items = document.querySelectorAll(`[data-group-items="${group}"] input[type="checkbox"]`);
    const allChecked = [...items].every(cb => cb.checked);
    btn.textContent = allChecked ? I18N.t('roles-toggle-deselect-all') : I18N.t('roles-toggle-select-all');
  }

  function updateAllGroupToggles() {
    document.querySelectorAll('.perm-items').forEach(c => updateGroupToggle(c.dataset.groupItems));
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  btnSave.addEventListener('click', async () => {
    if (!currentUser) return;
    hideError();
    btnSave.disabled = true;

    try {
      const permissions = getPermissionsFromForm();
      const result = await window.api.saveUserPermissions({
        userId: currentUser.id,
        permissions
      });

      if (result.success) {
        currentUser.permissions = permissions;
        const idx = allUsers.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) allUsers[idx].permissions = permissions;
        showToast(`${I18N.t('roles-save-btn')} — ${currentUser.full_name || currentUser.username}`, 'success');
      } else {
        showError(result.message || 'حدث خطأ أثناء الحفظ');
      }
    } catch {
      showError('خطأ في الاتصال بالخادم');
    }

    btnSave.disabled = false;
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showError(msg) {
    permError.textContent = msg;
    permError.style.display = '';
  }
  function hideError() {
    permError.style.display = 'none';
    permError.textContent = '';
  }

  function showToast(msg, type) {
    const isSuccess = type === 'success';
    const toast = document.createElement('div');
    toast.className = `toast ${isSuccess ? 'toast-success' : 'toast-error'}`;
    toast.innerHTML = `
      <div class="toast-icon">
        ${isSuccess
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`}
      </div>
      <span class="toast-text">${msg}</span>
      <button class="toast-close">✕</button>
      <span class="toast-progress"></span>
    `;
    toastContainer.appendChild(toast);
    const close = toast.querySelector('.toast-close');
    function dismiss() {
      toast.classList.add('toast-hide');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }
    close.addEventListener('click', dismiss);
    setTimeout(dismiss, 3500);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  if (typeof I18N !== 'undefined') I18N.apply();
  loadUsers();
});
