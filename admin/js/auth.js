(() => {
  'use strict';

  const CONFIG_ERROR = 'AUTH_CONFIGURATION';
  const SDK_ERROR = 'AUTH_SDK_UNAVAILABLE';
  const NETWORK_ERROR = 'AUTH_NETWORK';
  const AUTHORIZATION_ERROR = 'AUTHORIZATION_CHECK_FAILED';
  let client;

  function authError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function isNetworkError(error) {
    return error?.name === 'AuthRetryableFetchError'
      || error?.name === 'TypeError'
      || error?.status === 0;
  }

  function configuration() {
    const settings = window.BAB_AL_HARA_SUPABASE_CONFIG;
    const url = settings?.SUPABASE_URL?.trim();
    const key = settings?.SUPABASE_ANON_KEY?.trim();
    if (!url || !key || url.includes('<') || key.includes('<')) throw authError(CONFIG_ERROR);

    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { throw authError(CONFIG_ERROR); }
    if (parsedUrl.protocol !== 'https:') throw authError(CONFIG_ERROR);

    // Reject both current secret-key values and legacy JWT service_role keys.
    if (/^sb_secret_/i.test(key)) throw authError(CONFIG_ERROR);
    const tokenPart = key.split('.')[1];
    if (tokenPart) {
      try {
        const encodedPayload = tokenPart.replace(/-/g, '+').replace(/_/g, '/');
        const paddedPayload = encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');
        const payload = JSON.parse(atob(paddedPayload));
        if (payload.role === 'service_role') throw authError(CONFIG_ERROR);
      } catch (error) {
        if (error?.code === CONFIG_ERROR) throw error;
      }
    }
    return { url, key };
  }

  function getClient() {
    if (client) return client;
    const settings = configuration();
    if (!window.supabase || typeof window.supabase.createClient !== 'function') throw authError(SDK_ERROR);
    client = window.supabase.createClient(settings.url, settings.key, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
    return client;
  }

  async function getAuthenticatedUser() {
    const supabase = getClient();
    let sessionResult;
    try {
      sessionResult = await supabase.auth.getSession();
    } catch (error) {
      if (isNetworkError(error)) throw authError(NETWORK_ERROR);
      return null;
    }
    if (sessionResult.error) {
      if (isNetworkError(sessionResult.error)) throw authError(NETWORK_ERROR);
      return null;
    }
    if (!sessionResult.data?.session) return null;

    // Verify the stored session with Supabase Auth before showing protected content.
    let userResult;
    try {
      userResult = await supabase.auth.getUser();
    } catch (error) {
      if (isNetworkError(error)) throw authError(NETWORK_ERROR);
      return null;
    }
    if (userResult.error) {
      if (isNetworkError(userResult.error)) throw authError(NETWORK_ERROR);
      return null;
    }
    return userResult.data?.user || null;
  }

  async function getAdminAccess() {
    const user = await getAuthenticatedUser();
    if (!user) return { user: null, isAdmin: false };

    let result;
    try {
      result = await getClient()
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
    } catch (error) {
      if (isNetworkError(error)) throw authError(NETWORK_ERROR);
      throw authError(AUTHORIZATION_ERROR);
    }
    if (result.error) {
      if (isNetworkError(result.error)) throw authError(NETWORK_ERROR);
      throw authError(AUTHORIZATION_ERROR);
    }
    return { user, isAdmin: Boolean(result.data) };
  }

  async function signOutQuietly() {
    try { await signOut(); }
    catch { /* Fail closed in the UI even if the network prevents session revocation. */ }
  }

  async function signIn(email, password) {
    const supabase = getClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (isNetworkError(error)) throw authError(NETWORK_ERROR);
      throw authError('AUTH_LOGIN_FAILED');
    }
    return data.user;
  }

  async function signOut() {
    const supabase = getClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      if (isNetworkError(error)) throw authError(NETWORK_ERROR);
      throw authError('AUTH_LOGOUT_FAILED');
    }
  }

  window.BabAdminAuth = Object.freeze({
    getClient,
    getAuthenticatedUser,
    getAdminAccess,
    signIn,
    signOut,
    signOutQuietly,
    errors: Object.freeze({ CONFIG_ERROR, SDK_ERROR, NETWORK_ERROR, AUTHORIZATION_ERROR }),
  });

  function showLoginMessage(message) {
    const area = document.querySelector('[data-auth-message]');
    if (!area) return;
    area.textContent = message;
    area.hidden = !message;
  }

  function setLoginLoading(loading) {
    const button = document.querySelector('[data-login-button]');
    const label = document.querySelector('[data-button-label]');
    const spinner = document.querySelector('.login-form .button-spinner');
    if (button) {
      button.disabled = loading;
      button.setAttribute('aria-busy', String(loading));
    }
    if (label) label.textContent = loading ? 'جارٍ التحقق…' : 'دخول آمن';
    if (spinner) spinner.hidden = !loading;
  }

  function loginErrorMessage(error) {
    if (error?.code === CONFIG_ERROR) return 'إعدادات Supabase غير مكتملة. أضف رابط المشروع ومفتاح anon إلى ملف الإعدادات المحلي.';
    if (error?.code === SDK_ERROR) return 'تعذر تحميل خدمة تسجيل الدخول. تحقق من اتصال الإنترنت ثم أعد المحاولة.';
    if (error?.code === NETWORK_ERROR) return 'تعذر الاتصال بخدمة تسجيل الدخول. تحقق من اتصال الإنترنت وحاول مرة أخرى.';
    if (error?.code === AUTHORIZATION_ERROR) return 'تعذر التحقق من صلاحية الحساب. حاول مرة أخرى لاحقاً.';
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }

  function initializeLogin() {
    const form = document.querySelector('[data-login-form]');
    if (!form) return;

    try { getClient(); }
    catch (error) { showLoginMessage(loginErrorMessage(error)); }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      showLoginMessage('');
      if (!form.reportValidity()) return;
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      setLoginLoading(true);
      try {
        await signIn(email, password);
        let access;
        try { access = await getAdminAccess(); }
        catch (error) {
          await signOutQuietly();
          throw error;
        }
        if (!access.user || !access.isAdmin) {
          await signOutQuietly();
          showLoginMessage('ليس لديك صلاحية للوصول إلى لوحة الإدارة.');
          return;
        }
        window.location.replace('dashboard.html');
      } catch (error) {
        showLoginMessage(loginErrorMessage(error));
      } finally {
        setLoginLoading(false);
        form.elements.password.value = '';
      }
    });

    // Existing sessions are also required to have an active admin record.
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'unauthorized') showLoginMessage('ليس لديك صلاحية للوصول إلى لوحة الإدارة.');
    else if (reason === 'authorization-check') showLoginMessage('تعذر التحقق من صلاحية الحساب. حاول مرة أخرى لاحقاً.');

    getAdminAccess().then(async (access) => {
      if (access.user && access.isAdmin) {
        window.location.replace('dashboard.html');
      } else if (access.user) {
        await signOutQuietly();
        if (!reason) showLoginMessage('ليس لديك صلاحية للوصول إلى لوحة الإدارة.');
      }
    }).catch((error) => {
      signOutQuietly().finally(() => showLoginMessage(loginErrorMessage(error)));
    });
  }

  document.addEventListener('DOMContentLoaded', initializeLogin);
})();
