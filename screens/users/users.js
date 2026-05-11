window.addEventListener('DOMContentLoaded', () => {
  const btnBack        = document.getElementById('btnBack');
  const btnAddUser     = document.getElementById('btnAddUser');
  const searchInput    = document.getElementById('searchInput');
  const usersTableBody = document.getElementById('usersTableBody');
  const emptyState     = document.getElementById('emptyState');
  const toastContainer = document.getElementById('toastContainer');
  const confirmOverlay = document.getElementById('confirmOverlay');
  const confirmMsg     = document.getElementById('confirmMsg');
  const btnConfirmOk   = document.getElementById('btnConfirmOk');
  const btnConfirmCancel = document.getElementById('btnConfirmCancel');

  const modalOverlay   = document.getElementById('modalOverlay');
  const modalTitle     = document.getElementById('modalTitle');
  const modalError     = document.getElementById('modalError');
  const editUserId     = document.getElementById('editUserId');
  const inputFullName  = document.getElementById('inputFullName');
  const inputUsername  = document.getElementById('inputUsername');
  const inputPassword  = document.getElementById('inputPassword');
  const inputRole      = document.getElementById('inputRole');
  const passwordLabel  = document.getElementById('passwordLabel');
  const btnModalClose  = document.getElementById('btnModalClose');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalSave   = document.getElementById('btnModalSave');
  const toggleModalPassword = document.getElementById('toggleModalPassword');
  const modalEyeIcon   = document.getElementById('modalEyeIcon');
  const modalEyeOffIcon = document.getElementById('modalEyeOffIcon');

  let allUsers = [];

  I18N.apply();

  // منع التعبئة التلقائية لحقل البحث باسم المستخدم (مثل admin) بعد تسجيل الدخول
  searchInput.setAttribute('readonly', 'readonly');
  searchInput.value = '';
  searchInput.addEventListener('focus', () => searchInput.removeAttribute('readonly'), { once: true });
  window.addEventListener('load', () => {
    searchInput.value = '';
  });

  btnBack.addEventListener('click', () => window.api.navigateBack());

  toggleModalPassword.addEventListener('click', () => {
    const hidden = inputPassword.type === 'password';
    inputPassword.type = hidden ? 'text' : 'password';
    modalEyeIcon.style.display = hidden ? 'none' : 'block';
    modalEyeOffIcon.style.display = hidden ? 'block' : 'none';
    inputPassword.focus();
  });

  searchInput.addEventListener('input', () => {
    renderTable(allUsers, searchInput.value.trim());
  });

  btnAddUser.addEventListener('click', () => openModal(null));
  btnModalClose.addEventListener('click', closeModal);
  btnModalCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  btnModalSave.addEventListener('click', saveUser);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  async function loadUsers() {
    try {
      const result = await window.api.getUsers();
      if (result.success) {
        allUsers = result.users;
        renderTable(allUsers, searchInput.value.trim());
      } else {
        showToast(I18N.t('users-err-load'), 'error');
      }
    } catch (err) {
      showToast(I18N.t('users-err-db'), 'error');
    }
  }

  function renderTable(users, search) {
    const filtered = search
      ? users.filter(u =>
          (u.full_name || '').includes(search) ||
          u.username.includes(search)
        )
      : users;

    if (filtered.length === 0) {
      usersTableBody.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    usersTableBody.innerHTML = filtered.map((u, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escHtml(u.full_name || '—')}</td>
        <td>${escHtml(u.username)}</td>
        <td>
          <span class="badge-role ${u.role === 'admin' ? 'badge-admin' : 'badge-cashier'}">
            ${u.role === 'admin' ? I18N.t('users-role-admin') : I18N.t('users-role-cashier')}
          </span>
        </td>
        <td>
          <span class="badge-status ${u.is_active ? 'badge-active' : 'badge-inactive'}">
            <span class="status-dot"></span>
            ${u.is_active ? I18N.t('users-status-active') : I18N.t('users-status-inactive')}
          </span>
        </td>
        <td>
          <div class="actions-cell">
            <button class="action-btn btn-edit" title="${I18N.t('users-btn-edit-title')}" data-action="edit" data-id="${u.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="action-btn ${u.is_active ? 'btn-deactivate' : 'btn-activate'}"
              title="${u.is_active ? I18N.t('users-btn-deactivate-title') : I18N.t('users-btn-activate-title')}"
              data-action="toggle"
              data-id="${u.id}"
              data-active="${u.is_active}">
              ${u.is_active
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                   </svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                   </svg>`
              }
            </button>
            <button class="action-btn btn-delete" title="${I18N.t('users-btn-delete')}" data-action="delete" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    usersTableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const user = allUsers.find(u => u.id == btn.dataset.id);
        if (user) openModal(user);
      });
    });

    usersTableBody.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener('click', () => toggleStatus(Number(btn.dataset.id), Number(btn.dataset.active)));
    });

    usersTableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(Number(btn.dataset.id), btn.dataset.name));
    });
  }

  function openModal(user) {
    editUserId.value = user ? user.id : '';
    inputFullName.value = user ? (user.full_name || '') : '';
    inputUsername.value = user ? user.username : '';
    inputPassword.value = '';
    inputRole.value = user ? user.role : 'cashier';
    modalTitle.textContent = user ? I18N.t('users-modal-edit-title') : I18N.t('users-modal-add-title');
    passwordLabel.textContent = I18N.t('users-label-password');
    inputPassword.type = 'password';
    modalEyeIcon.style.display = 'block';
    modalEyeOffIcon.style.display = 'none';
    hideModalError();
    modalOverlay.style.display = 'flex';
    setTimeout(() => inputFullName.focus(), 100);
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    hideModalError();
  }

  async function saveUser() {
    const id       = editUserId.value;
    const fullName = inputFullName.value.trim();
    const username = inputUsername.value.trim();
    const password = inputPassword.value;
    const role     = inputRole.value;

    if (!fullName) { showModalError(I18N.t('users-err-fullname')); return; }
    if (!username) { showModalError(I18N.t('users-err-username')); return; }
    if (!id && !password) { showModalError(I18N.t('users-err-password')); return; }

    btnModalSave.disabled = true;
    hideModalError();

    try {
      let result;
      if (id) {
        const payload = { id: Number(id), username, fullName, role };
        if (password) payload.password = password;
        result = await window.api.updateUser(payload);
      } else {
        result = await window.api.createUser({ username, password, fullName, role });
      }

      if (result.success) {
        closeModal();
        showToast(id ? I18N.t('users-success-update') : I18N.t('users-success-add'), 'success');
        await loadUsers();
      } else {
        showModalError(result.message || I18N.t('users-err-unexpected'));
      }
    } catch (err) {
      showModalError(I18N.t('users-err-db'));
    }

    btnModalSave.disabled = false;
  }

  async function deleteUser(id, name) {
    confirmMsg.textContent = I18N.t('users-confirm-msg').replace('{name}', name);
    confirmOverlay.style.display = 'flex';

    return new Promise((resolve) => {
      function onOk() {
        cleanup();
        confirmOverlay.style.display = 'none';
        resolve(true);
      }
      function onCancel() {
        cleanup();
        confirmOverlay.style.display = 'none';
        resolve(false);
      }
      function cleanup() {
        btnConfirmOk.removeEventListener('click', onOk);
        btnConfirmCancel.removeEventListener('click', onCancel);
      }
      btnConfirmOk.addEventListener('click', onOk);
      btnConfirmCancel.addEventListener('click', onCancel);
    }).then(async (confirmed) => {
      if (!confirmed) return;
      try {
        const result = await window.api.deleteUser({ id });
        if (result.success) {
          showToast(I18N.t('users-success-delete'), 'success');
          await loadUsers();
        } else {
          showToast(result.message || I18N.t('users-err-delete'), 'error');
        }
      } catch (err) {
        showToast(I18N.t('users-err-db'), 'error');
      }
    });
  }

  async function toggleStatus(id, currentActive) {
    const newActive = currentActive ? 0 : 1;
    try {
      const result = await window.api.toggleUserStatus({ id, isActive: newActive });
      if (result.success) {
        showToast(newActive ? I18N.t('users-success-activate') : I18N.t('users-success-deactivate'), 'success');
        await loadUsers();
      } else {
        showToast(result.message || I18N.t('users-err-generic'), 'error');
      }
    } catch (err) {
      showToast(I18N.t('users-err-db'), 'error');
    }
  }

  function showToast(msg, type) {
    const isSuccess = type === 'success';
    const toast = document.createElement('div');
    toast.className = `toast ${isSuccess ? 'toast-success' : 'toast-error'}`;
    toast.innerHTML = `
      <div class="toast-icon">
        ${isSuccess
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
               <polyline points="20 6 9 17 4 12"/>
             </svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
               <circle cx="12" cy="12" r="10"/>
               <line x1="12" y1="8" x2="12" y2="12"/>
               <line x1="12" y1="16" x2="12.01" y2="16"/>
             </svg>`
        }
      </div>
      <span class="toast-text">${msg}</span>
      <button class="toast-close">✕</button>
      <span class="toast-progress"></span>
    `;
    toastContainer.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    function dismiss() {
      toast.classList.add('toast-hide');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }
    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, 3500);
  }

  function showModalError(msg) {
    modalError.textContent = msg;
    modalError.style.display = '';
  }

  function hideModalError() {
    modalError.style.display = 'none';
    modalError.textContent = '';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  loadUsers();
});
