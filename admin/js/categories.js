(() => {
  'use strict';

  const IMAGE_BUCKET = 'product-images';
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const IMAGE_TYPES = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
  let supabase;
  let categories = [];
  let editingCategory = null;
  let previewObjectUrl = null;

  const one = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);

  function showMessage(message, kind = 'success') {
    const area = one('[data-categories-message]');
    if (!area) return;
    area.textContent = message;
    area.hidden = !message;
    area.classList.toggle('admin-alert-success', kind === 'success');
  }

  function showListMessage(message) {
    const area = one('[data-list-message]');
    if (area) area.textContent = message;
  }

  function safeImageUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  }

  function categoryImage(category) {
    const url = safeImageUrl(category.image_url);
    return url
      ? `<img src="${escapeHtml(url)}" alt="صورة ${escapeHtml(category.name)}" loading="lazy" data-category-image>`
      : '<span aria-hidden="true">▦</span>';
  }

  function renderCategories() {
    const host = one('[data-category-list]');
    if (!host) return;
    const query = (one('[data-category-search]')?.value || '').trim().toLocaleLowerCase('ar');
    const filtered = categories.filter((category) => (`${category.name} ${category.slug}`).toLocaleLowerCase('ar').includes(query));
    if (!filtered.length) {
      host.innerHTML = `<div class="product-empty-state">${query ? 'لا توجد تصنيفات تطابق بحثك.' : 'لا توجد تصنيفات حتى الآن. أضف أول تصنيف من النموذج أعلاه.'}</div>`;
      return;
    }
    host.innerHTML = filtered.map((category) => `<article class="managed-product" data-category-id="${escapeHtml(category.id)}">
      <div class="managed-product-top"><div class="managed-product-image category-managed-image">${categoryImage(category)}</div><div class="managed-product-title">
        <h3>${escapeHtml(category.name)}</h3><code>${escapeHtml(category.slug)}</code>
        <div class="managed-product-category">${escapeHtml(category.description || 'لا يوجد وصف')}</div>
      </div></div>
      <div class="managed-product-flags"><span class="product-flag ${category.is_active ? '' : 'inactive'}">${category.is_active ? 'نشط' : 'غير نشط'}</span></div>
      <div class="product-card-actions"><button type="button" data-edit-category="${escapeHtml(category.id)}">تعديل</button><button type="button" data-toggle-category="${escapeHtml(category.id)}">${category.is_active ? 'إلغاء التفعيل' : 'تفعيل'}</button><button type="button" data-delete-category="${escapeHtml(category.id)}">حذف</button></div>
    </article>`).join('');
    host.querySelectorAll('[data-category-image]').forEach((image) => image.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.setAttribute('aria-hidden', 'true');
      fallback.textContent = '▦';
      image.replaceWith(fallback);
    }, { once: true }));
  }

  async function loadCategories() {
    showListMessage('جارٍ تحميل التصنيفات…');
    try {
      const { data, error } = await supabase.from('categories')
        .select('id,name,slug,description,image_url,is_active,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      categories = data || [];
      showListMessage(categories.length ? `عدد التصنيفات: ${categories.length}` : '');
      renderCategories();
    } catch (error) {
      categories = [];
      showListMessage(error?.status === 401 || error?.status === 403 || error?.code === '42501'
        ? 'انتهت صلاحية الجلسة أو لا تملك صلاحية عرض التصنيفات.'
        : 'تعذر تحميل التصنيفات. تحقق من الاتصال وسياسات القراءة.');
      one('[data-category-list]').innerHTML = '<div class="product-empty-state">تعذر تحميل قائمة التصنيفات.</div>';
    }
  }

  function setCurrentImage(value) {
    const box = one('[data-current-image]');
    const image = one('[data-current-image-element]');
    const url = safeImageUrl(value);
    if (box && image) {
      image.src = url;
      box.hidden = !url;
    }
  }

  function clearPreview() {
    const input = one('[data-image-input]');
    const preview = one('[data-image-preview]');
    if (input) input.value = '';
    if (preview) preview.hidden = true;
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
    const form = one('[data-category-form]');
    if (editingCategory && form?.dataset.removeCurrentImage !== 'true') setCurrentImage(editingCategory.image_url);
  }

  function resetForm() {
    const form = one('[data-category-form]');
    form?.reset();
    editingCategory = null;
    if (form) delete form.dataset.removeCurrentImage;
    setCurrentImage('');
    clearPreview();
    one('[data-category-form-title]').textContent = 'إضافة تصنيف جديد';
    one('[data-cancel-edit]').hidden = true;
    one('[data-save-category]').textContent = 'حفظ التصنيف';
  }

  function beginEdit(category) {
    const form = one('[data-category-form]');
    editingCategory = category;
    form.elements.name.value = category.name || '';
    form.elements.slug.value = category.slug || '';
    form.elements.description.value = category.description || '';
    form.elements.is_active.checked = Boolean(category.is_active);
    delete form.dataset.removeCurrentImage;
    clearPreview();
    setCurrentImage(category.image_url);
    one('[data-category-form-title]').textContent = 'تعديل التصنيف';
    one('[data-cancel-edit]').hidden = false;
    one('[data-save-category]').textContent = 'حفظ التعديلات';
    one('#category-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function validateImage(file) {
    if (!file) return '';
    const extension = IMAGE_TYPES.get(file.type);
    if (!extension) throw new Error('IMAGE_TYPE');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('IMAGE_SIZE');
    return extension;
  }

  async function uploadImage(file) {
    const extension = validateImage(file);
    if (!extension) return null;
    if (!window.crypto?.randomUUID) throw new Error('SECURE_RANDOM_UNAVAILABLE');
    const path = `categories/${window.crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      cacheControl: '3600', contentType: file.type, upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      await supabase.storage.from(IMAGE_BUCKET).remove([path]).catch(() => {});
      throw new Error('IMAGE_URL_UNAVAILABLE');
    }
    return { path, url: data.publicUrl };
  }

  function bucketObjectPath(value) {
    const url = safeImageUrl(value);
    if (!url) return null;
    const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
    const index = url.indexOf(marker);
    if (index < 0) return null;
    const path = url.slice(index + marker.length).split(/[?#]/)[0];
    return path.startsWith('categories/') ? path : null;
  }

  async function removeImage(value) {
    const path = bucketObjectPath(value);
    if (!path) return;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
    if (error) throw error;
  }

  function imageErrorMessage(error) {
    if (error?.message === 'IMAGE_TYPE') return 'نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.';
    if (error?.message === 'IMAGE_SIZE') return 'حجم الصورة يتجاوز 5 ميغابايت.';
    if (error?.message === 'SECURE_RANDOM_UNAVAILABLE') return 'تعذر إنشاء مسار آمن للصورة. استخدم اتصالاً آمناً ثم أعد المحاولة.';
    return null;
  }

  function categoryErrorMessage(error) {
    if (error?.code === '23505') return 'تعذر الحفظ: اسم الرابط المختصر مستخدم من قبل. اختر slug مختلفاً.';
    if (error?.code === '23503') return 'لا يمكن حذف هذا التصنيف لأنه مرتبط بمنتجات. يمكنك تعطيله بدلاً من حذفه.';
    if (error?.status === 401 || error?.status === 403 || error?.code === '42501') return 'انتهت صلاحية الجلسة أو لا تملك صلاحية تنفيذ هذا الإجراء.';
    return 'تعذر إكمال العملية. تحقق من الاتصال وإعدادات قاعدة البيانات ثم حاول مرة أخرى.';
  }

  async function saveCategory(event) {
    event.preventDefault();
    const form = event.currentTarget;
    showMessage('');
    if (!form.reportValidity()) return;
    const file = one('[data-image-input]').files[0];
    try { validateImage(file); }
    catch (error) { showMessage(imageErrorMessage(error), 'error'); return; }

    const button = one('[data-save-category]');
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ…';
    let uploadedPath = null;
    const oldImageUrl = editingCategory?.image_url || null;
    try {
      let imageUrl = editingCategory?.image_url || null;
      if (form.dataset.removeCurrentImage === 'true') imageUrl = null;
      if (file) {
        const uploaded = await uploadImage(file);
        imageUrl = uploaded.url;
        uploadedPath = uploaded.path;
      }
      const payload = {
        name: form.elements.name.value.trim(),
        slug: form.elements.slug.value.trim(),
        description: form.elements.description.value.trim() || null,
        image_url: imageUrl,
        is_active: form.elements.is_active.checked,
      };
      const query = editingCategory
        ? supabase.from('categories').update(payload).eq('id', editingCategory.id)
        : supabase.from('categories').insert(payload);
      const { error } = await query.select('id').single();
      if (error) throw error;
      uploadedPath = null;
      showMessage(editingCategory ? 'تم تحديث التصنيف بنجاح.' : 'تمت إضافة التصنيف بنجاح.');
      resetForm();
      await loadCategories();
      if (oldImageUrl && oldImageUrl !== imageUrl) {
        try { await removeImage(oldImageUrl); } catch { showMessage('تم حفظ التصنيف، لكن تعذر حذف الصورة القديمة من التخزين.', 'error'); }
      }
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(IMAGE_BUCKET).remove([uploadedPath]).catch(() => {});
      showMessage(imageErrorMessage(error) || categoryErrorMessage(error), 'error');
    } finally {
      button.disabled = false;
      button.textContent = editingCategory ? 'حفظ التعديلات' : 'حفظ التصنيف';
    }
  }

  async function toggleCategory(category) {
    const active = !category.is_active;
    if (!window.confirm(active ? 'هل تريد تفعيل هذا التصنيف؟' : 'هل تريد إلغاء تفعيل هذا التصنيف؟ سيبقى محفوظاً ويمكن تفعيله لاحقاً.')) return;
    try {
      const { error } = await supabase.from('categories').update({ is_active: active }).eq('id', category.id).select('id').single();
      if (error) throw error;
      showMessage(active ? 'تم تفعيل التصنيف.' : 'تم إلغاء تفعيل التصنيف.');
      await loadCategories();
    } catch (error) { showMessage(categoryErrorMessage(error), 'error'); }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`هل تريد حذف «${category.name}»؟ لا يمكن حذف أي تصنيف مرتبط بمنتجات.`)) return;
    showMessage('');
    try {
      const { data: references, error: referenceError } = await supabase.from('products').select('id').eq('category_id', category.id).limit(1);
      if (referenceError) throw referenceError;
      if (references?.length) {
        showMessage('لا يمكن حذف هذا التصنيف لأنه مرتبط بمنتجات. يمكنك تعطيله بدلاً من حذفه.', 'error');
        return;
      }
      const { error } = await supabase.from('categories').delete().eq('id', category.id).select('id').single();
      if (error) throw error;
      showMessage('تم حذف التصنيف.');
      await loadCategories();
      try { await removeImage(category.image_url); }
      catch { showMessage('تم حذف التصنيف، لكن تعذر حذف صورته من التخزين.', 'error'); }
    } catch (error) { showMessage(categoryErrorMessage(error), 'error'); }
  }

  function handleCategoryActions(event) {
    const button = event.target.closest('button[data-edit-category],button[data-toggle-category],button[data-delete-category]');
    if (!button) return;
    const category = categories.find((item) => item.id === (button.dataset.editCategory || button.dataset.toggleCategory || button.dataset.deleteCategory));
    if (!category) return;
    if (button.dataset.editCategory) beginEdit(category);
    else if (button.dataset.toggleCategory) toggleCategory(category);
    else deleteCategory(category);
  }

  function handleImagePreview() {
    const input = one('[data-image-input]');
    const file = input.files[0];
    if (!file) return;
    try { validateImage(file); }
    catch (error) { input.value = ''; showMessage(imageErrorMessage(error), 'error'); return; }
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(file);
    one('[data-preview-image]').src = previewObjectUrl;
    one('[data-image-preview]').hidden = false;
    one('[data-current-image]').hidden = true;
    delete one('[data-category-form]').dataset.removeCurrentImage;
  }

  function bindEvents() {
    one('[data-category-form]').addEventListener('submit', saveCategory);
    one('[data-category-list]').addEventListener('click', handleCategoryActions);
    one('[data-category-search]').addEventListener('input', renderCategories);
    one('[data-image-input]').addEventListener('change', handleImagePreview);
    one('[data-clear-image]').addEventListener('click', clearPreview);
    one('[data-remove-current-image]').addEventListener('click', () => {
      one('[data-category-form]').dataset.removeCurrentImage = 'true';
      setCurrentImage('');
    });
    one('[data-cancel-edit]').addEventListener('click', () => { resetForm(); showMessage(''); });
    one('[data-logout-button]').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      one('[data-logout-label]').textContent = 'جارٍ تسجيل الخروج…';
      button.querySelector('.button-spinner').hidden = false;
      try {
        await window.BabAdminAuth.signOut();
        window.location.replace('login.html');
      } catch {
        showMessage('تعذر تسجيل الخروج. تحقق من الاتصال وحاول مرة أخرى.', 'error');
        button.disabled = false;
        button.setAttribute('aria-busy', 'false');
        one('[data-logout-label]').textContent = 'إعادة المحاولة';
        button.querySelector('.button-spinner').hidden = true;
      }
    });
  }

  async function initialize() {
    const protectedContent = one('[data-protected-content]');
    const authCheck = one('[data-auth-check]');
    try {
      const access = await window.BabAdminAuth.getAdminAccess();
      if (!access.user) { window.location.replace('login.html'); return; }
      if (!access.isAdmin) {
        await window.BabAdminAuth.signOutQuietly();
        window.location.replace('login.html?reason=unauthorized');
        return;
      }
      supabase = window.BabAdminAuth.getClient();
      one('[data-admin-email]').textContent = access.user.email || '';
      protectedContent.hidden = false;
      authCheck.hidden = true;
      bindEvents();
      await loadCategories();
    } catch {
      await window.BabAdminAuth.signOutQuietly();
      window.location.replace('login.html?reason=authorization-check');
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
