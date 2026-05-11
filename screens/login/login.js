const REMEMBER_KEY = 'laundry_remember';

window.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const rememberCheckbox = document.getElementById('rememberMe');
  const btnLogin = document.getElementById('btnLogin');
  const errorMsg = document.getElementById('errorMsg');
  const togglePassword = document.getElementById('togglePassword');
  const eyeIcon = document.getElementById('eyeIcon');
  const eyeOffIcon = document.getElementById('eyeOffIcon');
  const formArea = document.getElementById('formArea');
  const welcomePanel = document.getElementById('welcomePanel');

  I18N.apply();

  function applyDir() {
    const isAr = I18N.getLang() === 'ar';
    formArea.dir = isAr ? 'rtl' : 'ltr';
    welcomePanel.dir = isAr ? 'rtl' : 'ltr';
  }
  applyDir();

  togglePassword.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    eyeIcon.style.display = isHidden ? 'none' : 'block';
    eyeOffIcon.style.display = isHidden ? 'block' : 'none';

    passwordInput.focus();
  });

  const saved = localStorage.getItem(REMEMBER_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      usernameInput.value = data.username || '';
      passwordInput.value = data.password || '';
      rememberCheckbox.checked = true;
    } catch (_) {}
  }

  btnLogin.addEventListener('click', doLogin);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });

  async function doLogin() {
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

      if (result.success) {
        if (rememberCheckbox.checked) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
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

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  function hideError() {
    errorMsg.style.display = 'none';
  }
});
