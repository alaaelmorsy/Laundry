const REMEMBER_KEY = 'laundry_remember';
const SAVED_USERS_KEY = 'laundry_saved_users';

function getSavedUsers() {
  try {
    const arr = JSON.parse(localStorage.getItem(SAVED_USERS_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}

function setSavedUsers(arr) {
  localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(arr));
}

function upsertSavedUser(username, password) {
  const users = getSavedUsers().filter(u => u.username !== username);
  users.unshift({ username, password });
  setSavedUsers(users);
}

function removeSavedUser(username) {
  setSavedUsers(getSavedUsers().filter(u => u.username !== username));
}

window.addEventListener('DOMContentLoaded', async () => {
  const usernameInput      = document.getElementById('username');
  const passwordInput      = document.getElementById('password');
  const rememberCheckbox   = document.getElementById('rememberMe');
  const btnLogin           = document.getElementById('btnLogin');
  const errorMsg           = document.getElementById('errorMsg');
  const togglePassword     = document.getElementById('togglePassword');
  const eyeIcon            = document.getElementById('eyeIcon');
  const eyeOffIcon         = document.getElementById('eyeOffIcon');
  const formArea           = document.getElementById('formArea');
  const welcomePanel       = document.getElementById('welcomePanel');
  const userDropdownToggle = document.getElementById('userDropdownToggle');
  const userDeleteBtn      = document.getElementById('userDeleteBtn');
  const savedUsersDropdown = document.getElementById('savedUsersDropdown');

  // ── Update toast ──────────────────────────────────────────────────────────
  const updateToast   = document.getElementById('updateToast');
  const updateToastTitle   = document.getElementById('updateToastTitle');
  const updateToastVersion = document.getElementById('updateToastVersion');

  (async () => {
    try {
      const res = await fetch('/api/update-status');
      const status = await res.json();
      if (status && status.hasUpdate && status.latestVersion) {
        if (!updateToast) return;
        if (updateToastTitle)   updateToastTitle.textContent   = 'يتوفر تحديث جديد';
        if (updateToastVersion) updateToastVersion.textContent = `الإصدار ${status.latestVersion}`;
        updateToast.style.display = 'block';
        requestAnimationFrame(() => {
          updateToast.style.opacity   = '1';
          updateToast.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
          updateToast.style.opacity   = '0';
          updateToast.style.transform = 'translateY(-12px)';
          setTimeout(() => { updateToast.style.display = 'none'; }, 500);
        }, 7000);
      }
    } catch (_) {}
  })();

  const supportBadge       = document.getElementById('supportBadge');
  const trialBadge         = document.getElementById('trialBadge');
  const trialCta           = document.getElementById('trialCta');
  const expiredArea        = document.getElementById('expiredArea');
  const btnBackFromExpired = document.getElementById('btnBackFromExpired');

  const registerModal      = document.getElementById('registerModal');
  const btnShowRegister    = document.getElementById('btnShowRegister');
  const btnCloseModal      = document.getElementById('btnCloseModal');
  const btnRegister        = document.getElementById('btnRegister');
  const regName            = document.getElementById('regName');
  const regPhone           = document.getElementById('regPhone');
  const regPassword        = document.getElementById('regPassword');
  const registerErrorMsg   = document.getElementById('registerErrorMsg');
  const registerSuccessMsg = document.getElementById('registerSuccessMsg');

  I18N.apply();
  const isAr = I18N.getLang() === 'ar';
  formArea.dir = isAr ? 'rtl' : 'ltr';
  welcomePanel.dir = isAr ? 'rtl' : 'ltr';

  // ── التحقق من الترخيص (يجري في الخلفية — لا يعيق تحميل الصفحة) ──────────
  let isLicensed = null;
  const licenseCheckPromise = window.api.checkLicense()
    .then(r => { isLicensed = r.licensed === true; })
    .catch(() => { isLicensed = false; });

  // ── جلب معلومات الدعم الفني والتجربة بالتوازي (بدون انتظار) ──────────────
  window.api.getSupportInfo().then(support => {
    if (!support.hasExpiry) return;
    const d = new Date(support.date);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    const formatted = `${day}-${month}-${year}`;
    let cls, iconPath, daysText;
    if (support.expired) {
      cls = 'support-expired';
      iconPath = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
      daysText = 'منتهي';
    } else if (support.daysLeft <= 30) {
      cls = 'support-warn';
      iconPath = '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>';
      daysText = support.daysLeft === 0 ? 'آخر يوم' : `${support.daysLeft} يوم`;
    } else {
      cls = 'support-ok';
      iconPath = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
      daysText = `${support.daysLeft} يوم`;
    }
    supportBadge.className = `support-badge ${cls}`;
    supportBadge.innerHTML = `
      <div class="support-badge-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconPath}</svg>
      </div>
      <div class="support-badge-body">
        <span class="support-badge-label">تاريخ انتهاء الدعم الفني &nbsp;${formatted}</span>
      </div>
      <span class="support-badge-days">${daysText}</span>
    `;
    supportBadge.style.display = 'flex';
  }).catch(() => {});

  // ── جلب حالة التجربة وعرض الـ badge ─────────────────────────────────────
  window.api.getTrialStatus().then(trial => {
    if (!trial.trialModeEnabled) return;
    if (!trial.hasAccount) {
      trialCta.style.display = '';
    } else if (trial.active) {
      const days = trial.daysLeft;
      const isWarn = days <= 2;
      trialBadge.className = `trial-badge ${isWarn ? 'badge-warn' : 'badge-ok'}`;
      trialBadge.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        ${trial.status === 'Active'
          ? 'اشتراك نشط'
          : days === 0
            ? 'آخر يوم في فترة التجربة'
            : `متبقي ${days} ${days === 1 ? 'يوم' : 'أيام'} من التجربة المجانية`}
      `;
      trialBadge.style.display = 'flex';
    }
  }).catch(() => {});

  // ── التنقل بين الشاشات ────────────────────────────────────────────────────
  function showLogin() {
    formArea.style.display    = '';
    expiredArea.style.display = 'none';
  }

  function showExpired() {
    formArea.style.display    = 'none';
    expiredArea.style.display = '';
  }

  btnBackFromExpired.addEventListener('click', showLogin);

  // ── Modal التسجيل ─────────────────────────────────────────────────────────
  function openModal() {
    registerModal.style.display = 'flex';
    hideRegisterMsgs();
    regName.value = regPhone.value = regPassword.value = '';
    setTimeout(() => regName.focus(), 100);
  }

  function closeModal() {
    registerModal.style.display = 'none';
  }

  btnShowRegister.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);

  registerModal.addEventListener('click', (e) => {
    if (e.target === registerModal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && registerModal.style.display !== 'none') closeModal();
    if (e.key === 'Enter') {
      if (registerModal.style.display !== 'none') doRegister();
      else if (formArea.style.display !== 'none') doLogin();
    }
  });

  // ── تسجيل الدخول ─────────────────────────────────────────────────────────
  togglePassword.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type       = isHidden ? 'text'  : 'password';
    eyeIcon.style.display    = isHidden ? 'none'  : 'block';
    eyeOffIcon.style.display = isHidden ? 'block' : 'none';
    passwordInput.focus();
  });

  // ── المستخدمون المحفوظون (قائمة منسدلة للدخول السريع) ──────────────────────
  function closeDropdown() {
    savedUsersDropdown.style.display = 'none';
    userDropdownToggle.classList.remove('open');
  }

  function openDropdown() {
    if (!getSavedUsers().length) return;
    savedUsersDropdown.style.display = 'block';
    userDropdownToggle.classList.add('open');
  }

  function toggleDropdown() {
    if (savedUsersDropdown.style.display === 'block') closeDropdown();
    else openDropdown();
  }

  // إظهار زر الحذف إذا كان الاسم الحالي مطابقاً لمستخدم محفوظ
  function updateDeleteBtn() {
    const current = usernameInput.value.trim();
    const exists = getSavedUsers().some(u => u.username === current);
    userDeleteBtn.style.display = exists ? 'flex' : 'none';
  }

  function renderSavedUsers() {
    const users = getSavedUsers();
    savedUsersDropdown.innerHTML = '';

    // إظهار/إخفاء سهم القائمة حسب وجود مستخدمين محفوظين
    userDropdownToggle.style.display = users.length ? 'flex' : 'none';
    updateDeleteBtn();
    if (!users.length) { closeDropdown(); return; }

    users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'user-dropdown-item';
      item.title = `دخول سريع باسم ${u.username}`;

      const avatar = document.createElement('span');
      avatar.className = 'user-dropdown-avatar';
      avatar.textContent = (u.username || '?').charAt(0);

      const name = document.createElement('span');
      name.className = 'user-dropdown-name';
      name.textContent = u.username;

      const remove = document.createElement('span');
      remove.className = 'user-dropdown-remove';
      remove.textContent = '×';
      remove.title = 'إزالة';
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        removeSavedUser(u.username);
        renderSavedUsers();
      });

      item.appendChild(avatar);
      item.appendChild(name);
      item.appendChild(remove);

      // اختيار المستخدم = ملء البيانات فقط (الدخول يتم بالضغط على زر دخول)
      item.addEventListener('click', () => {
        usernameInput.value = u.username;
        passwordInput.value = u.password || '';
        rememberCheckbox.checked = true;
        closeDropdown();
        updateDeleteBtn();
        btnLogin.focus();
      });

      savedUsersDropdown.appendChild(item);
    });
  }

  userDropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  // حذف المستخدم المحفوظ الظاهر حالياً في الحقل
  userDeleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = usernameInput.value.trim();
    if (!current) return;
    removeSavedUser(current);
    usernameInput.value = '';
    passwordInput.value = '';
    renderSavedUsers();
    usernameInput.focus();
  });

  // تحديث زر الحذف أثناء الكتابة
  usernameInput.addEventListener('input', updateDeleteBtn);

  // إغلاق القائمة عند الضغط خارجها
  document.addEventListener('click', (e) => {
    if (!savedUsersDropdown.contains(e.target) && e.target !== userDropdownToggle) {
      closeDropdown();
    }
  });

  // ملء البيانات عند التحميل + تفعيل تذكرني افتراضياً
  const savedList = getSavedUsers();
  if (savedList.length) {
    usernameInput.value = savedList[0].username || '';
    rememberCheckbox.checked = true;
    // مستخدم واحد محفوظ فقط → املأ كلمة المرور تلقائياً (جاهز للدخول مباشرة)
    if (savedList.length === 1) {
      passwordInput.value = savedList[0].password || '';
    }
  }
  renderSavedUsers();

  btnLogin.addEventListener('click', doLogin);

  async function doLogin() {
    if (isLicensed === null) await licenseCheckPromise;
    if (!isLicensed) {
      showLicenseToast();
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError(I18N.t('error-empty-fields'));
      return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = I18N.t('btn-login-loading');
    hideError();

    try {
      const result = await window.api.login({ username, password });

      if (result.needsRegistration) {
        openModal();
        btnLogin.disabled = false;
        btnLogin.textContent = I18N.t('btn-login');
        return;
      }
      if (result.trialExpired) {
        showExpired();
        btnLogin.disabled = false;
        btnLogin.textContent = I18N.t('btn-login');
        return;
      }

      if (result.success) {
        if (rememberCheckbox.checked) {
          upsertSavedUser(username, password);
        } else {
          removeSavedUser(username);
        }
        if (result.user) window.__currentUser = result.user;
        window.api.openMain();
      } else {
        showError(result.message || I18N.t('error-login-failed'));
        btnLogin.disabled = false;
        btnLogin.textContent = I18N.t('btn-login');
      }
    } catch (err) {
      console.error(err);
      showError(I18N.t('error-login-failed'));
      btnLogin.disabled = false;
      btnLogin.textContent = I18N.t('btn-login');
    }
  }

  // ── تسجيل حساب جديد ──────────────────────────────────────────────────────
  btnRegister.addEventListener('click', doRegister);

  async function doRegister() {
    const name     = regName.value.trim();
    const phone    = regPhone.value.trim();
    const password = regPassword.value;

    hideRegisterMsgs();

    if (!name || !phone || !password) {
      showRegisterError('جميع الحقول مطلوبة');
      return;
    }
    if (password.length < 6) {
      showRegisterError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    btnRegister.disabled = true;
    btnRegister.textContent = 'جارٍ إنشاء الحساب...';

    try {
      const result = await window.api.registerAccount({ name, phone, password });
      if (result.success) {
        showRegisterSuccess('✓ تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول — مدة التجربة 7 أيام.');
        regName.value = regPhone.value = regPassword.value = '';
        setTimeout(() => {
          closeModal();
          location.reload();
        }, 2800);
      } else {
        showRegisterError(result.message || 'حدث خطأ، حاول مرة أخرى');
      }
    } catch {
      showRegisterError('حدث خطأ في الاتصال بالخادم');
    } finally {
      btnRegister.disabled = false;
      btnRegister.textContent = 'إنشاء الحساب وبدء التجربة';
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function showError(msg)         { errorMsg.textContent = msg; errorMsg.style.display = 'block'; }
  function hideError()            { errorMsg.style.display = 'none'; }
  function showRegisterError(msg) { registerErrorMsg.textContent = msg; registerErrorMsg.style.display = 'block'; }
  function showRegisterSuccess(m) { registerSuccessMsg.textContent = m; registerSuccessMsg.style.display = 'block'; }
  function hideRegisterMsgs()     { registerErrorMsg.style.display = 'none'; registerSuccessMsg.style.display = 'none'; }

  function showLicenseToast() {
    const existing = document.getElementById('licenseToast');
    if (existing) { existing.classList.add('toast-shake'); setTimeout(() => existing.classList.remove('toast-shake'), 500); return; }
    const toast = document.createElement('div');
    toast.id = 'licenseToast';
    toast.className = 'license-toast';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div class="license-toast-body">
        <span class="license-toast-title">نسخة غير موثقة</span>
        <span class="license-toast-msg">يجب التواصل مع الدعم الفني للتفعيل</span>
      </div>
      <button class="license-toast-close" onclick="this.closest('#licenseToast').remove()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
  }
});
