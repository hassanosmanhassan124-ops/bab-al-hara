(() => {
  'use strict';

  const SETTINGS_FIELDS = [
    'store_name', 'store_description', 'whatsapp', 'phone', 'address',
    'delivery_information', 'payment_information', 'working_hours',
    'instagram', 'tiktok', 'facebook',
  ];
  const one = (selector) => document.querySelector(selector);
  let supabase;

  function showMessage(text, success = false) {
    const area = one('[data-settings-message]');
    if (!area) return;
    area.textContent = text;
    area.hidden = !text;
    area.classList.toggle('admin-alert-success', success);
  }

  function populateForm(record = {}) {
    const form = one('[data-settings-form]');
    if (!form) return;
    SETTINGS_FIELDS.forEach((field) => { form.elements[field].value = record[field] ?? ''; });
  }

  function validSocial(value, hosts) {
    const text = value.trim();
    if (!text) return true;
    if (/^https:\/\//i.test(text)) {
      try {
        const url = new URL(text);
        return hosts.includes(url.hostname.toLowerCase()) && !url.username && !url.password;
      } catch { return false; }
    }
    return /^@?[A-Za-z0-9._-]{1,100}$/.test(text);
  }

  function validateSettings(form) {
    const fields = new FormData(form);
    if (!validSocial(String(fields.get('instagram') || ''), ['instagram.com', 'www.instagram.com'])) return 'أدخل رابط Instagram صحيحاً أو اسم المستخدم فقط.';
    if (!validSocial(String(fields.get('tiktok') || ''), ['tiktok.com', 'www.tiktok.com'])) return 'أدخل رابط TikTok صحيحاً أو اسم المستخدم فقط.';
    if (!validSocial(String(fields.get('facebook') || ''), ['facebook.com', 'www.facebook.com', 'm.facebook.com'])) return 'أدخل رابط Facebook صحيحاً أو اسم المستخدم فقط.';
    return '';
  }

  function readRecord(form) {
    const fields = new FormData(form);
    const record = { id: true };
    SETTINGS_FIELDS.forEach((field) => {
      record[field] = String(fields.get(field) || '').trim() || null;
    });
    return record;
  }

  async function loadSettings() {
    const message = one('[data-settings-loading]');
    const form = one('[data-settings-form]');
    if (message) message.textContent = 'جارٍ تحميل الإعدادات…';
    try {
      const { data, error } = await supabase.from('store_settings')
        .select(SETTINGS_FIELDS.join(','))
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      populateForm(data || {});
      if (message) message.textContent = data ? 'تم تحميل الإعدادات المحفوظة.' : 'لا توجد إعدادات محفوظة بعد. أدخل بيانات المتجر واحفظها.';
      if (form) form.hidden = false;
    } catch {
      if (message) message.textContent = 'تعذر تحميل إعدادات المتجر. تحقق من الاتصال وسياسات قاعدة البيانات.';
      showMessage('تعذر تحميل الإعدادات الحالية. لم يتم تغيير أي بيانات.', false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const validation = validateSettings(form);
    if (validation) return showMessage(validation, false);
    const button = one('[data-save-settings]');
    if (button?.disabled) return;
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'جارٍ الحفظ…';
    }
    showMessage('');
    try {
      const { data, error } = await supabase.from('store_settings')
        .upsert(readRecord(form), { onConflict: 'id' })
        .select(SETTINGS_FIELDS.join(','))
        .single();
      if (error) throw error;
      populateForm(data || {});
      const loading = one('[data-settings-loading]');
      if (loading) loading.textContent = 'تم تحميل الإعدادات المحفوظة.';
      showMessage('تم حفظ إعدادات المتجر بنجاح.', true);
    } catch (error) {
      if (error?.status === 401 || error?.status === 403 || error?.code === '42501') {
        showMessage('انتهت الجلسة أو لا تملك صلاحية تعديل الإعدادات. سجّل الدخول مجدداً.', false);
      } else {
        showMessage('تعذر حفظ الإعدادات. تحقق من الاتصال ثم حاول مرة أخرى.', false);
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = 'حفظ الإعدادات';
      }
    }
  }

  async function protectSettings() {
    const check = one('[data-auth-check]');
    const message = one('[data-settings-auth-message]');
    const login = one('[data-settings-login]');
    try {
      const access = await window.BabAdminAuth.getAdminAccess();
      if (!access.user) {
        window.location.replace('login.html');
        return;
      }
      if (!access.isAdmin) {
        await window.BabAdminAuth.signOutQuietly();
        window.location.replace('login.html?reason=unauthorized');
        return;
      }
      supabase = window.BabAdminAuth.getClient();
      const email = one('[data-admin-email]');
      if (email) email.textContent = access.user.email || 'حساب الإدارة';
      one('[data-protected-content]').hidden = false;
      if (check) check.hidden = true;
      one('[data-settings-form]').addEventListener('submit', saveSettings);
      await loadSettings();
    } catch {
      if (message) message.textContent = 'تعذر التحقق من صلاحيات الإدارة. سجّل الدخول مجدداً.';
      if (login) login.hidden = false;
    }
  }

  const logoutButton = one('[data-logout-button]');
  logoutButton?.addEventListener('click', async () => {
    logoutButton.disabled = true;
    logoutButton.setAttribute('aria-busy', 'true');
    const label = one('[data-logout-label]');
    const spinner = logoutButton.querySelector('.button-spinner');
    if (label) label.textContent = 'جارٍ تسجيل الخروج…';
    if (spinner) spinner.hidden = false;
    try {
      await window.BabAdminAuth.signOut();
      window.location.replace('login.html');
    } catch {
      showMessage('تعذر تسجيل الخروج. تحقق من الاتصال وحاول مجدداً.', false);
      logoutButton.disabled = false;
      logoutButton.removeAttribute('aria-busy');
      if (label) label.textContent = 'إعادة المحاولة';
      if (spinner) spinner.hidden = true;
    }
  });

  protectSettings();
})();
