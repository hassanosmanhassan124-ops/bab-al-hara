(() => {
  'use strict';

  const protectedContent = document.querySelector('[data-protected-content]');
  const checkPanel = document.querySelector('[data-auth-check]');
  const checkMessage = document.querySelector('[data-auth-check-message]');
  const loginLink = document.querySelector('[data-check-login]');
  const emailLabel = document.querySelector('[data-admin-email]');
  const logoutButton = document.querySelector('[data-logout-button]');
  const logoutLabel = document.querySelector('[data-logout-label]');
  const logoutSpinner = logoutButton?.querySelector('.button-spinner');
  const dashboardMessage = document.querySelector('[data-dashboard-message]');

  function redirectToLogin() {
    window.location.replace('login.html');
  }

  async function protectDashboard() {
    try {
      const access = await window.BabAdminAuth.getAdminAccess();
      if (!access.user) {
        redirectToLogin();
        return;
      }
      if (!access.isAdmin) {
        await window.BabAdminAuth.signOutQuietly();
        window.location.replace('login.html?reason=unauthorized');
        return;
      }
      if (emailLabel) emailLabel.textContent = access.user.email || 'حساب الإدارة';
      if (protectedContent) protectedContent.hidden = false;
      if (checkPanel) checkPanel.hidden = true;
    } catch (error) {
      if (error?.code === window.BabAdminAuth.errors.CONFIG_ERROR
          || error?.code === window.BabAdminAuth.errors.SDK_ERROR) {
        redirectToLogin();
        return;
      }
      await window.BabAdminAuth.signOutQuietly();
      window.location.replace('login.html?reason=authorization-check');
    }
  }

  function showLogoutError() {
    if (!dashboardMessage) return;
    dashboardMessage.textContent = 'تعذر تسجيل الخروج. تحقق من الاتصال وحاول مرة أخرى.';
    dashboardMessage.hidden = false;
  }

  logoutButton?.addEventListener('click', async () => {
    logoutButton.disabled = true;
    logoutButton.setAttribute('aria-busy', 'true');
    if (logoutLabel) logoutLabel.textContent = 'جارٍ تسجيل الخروج…';
    if (logoutSpinner) logoutSpinner.hidden = false;
    try {
      await window.BabAdminAuth.signOut();
      window.location.replace('login.html');
    } catch {
      showLogoutError();
      logoutButton.disabled = false;
      logoutButton.setAttribute('aria-busy', 'false');
      if (logoutLabel) logoutLabel.textContent = 'إعادة المحاولة';
      if (logoutSpinner) logoutSpinner.hidden = true;
    }
  });

  protectDashboard();
})();
