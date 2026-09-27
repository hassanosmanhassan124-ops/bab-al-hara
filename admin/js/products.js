(() => {
  'use strict';

  const IMAGE_BUCKET = 'product-images';
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const IMAGE_TYPES = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ]);
  let supabase;
  let categories = [];
  let products = [];
  let editingProduct = null;
  let previewObjectUrl = null;

  const one = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const money = (value) => `${Number(value || 0).toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

  function showMessage(message, kind = 'success') {
    const area = one('[data-products-message]');
    if (!area) return;
    area.textContent = message;
    area.hidden = !message;
    area.classList.toggle('admin-alert-success', kind === 'success');
  }

  function setListMessage(message) {
    const area = one('[data-list-message]');
    if (area) area.textContent = message;
  }

  function productErrorMessage(error) {
    if (error?.code === '23505') return 'تعذر الحفظ: اسم الرابط مستخدم من قبل. اختر slug مختلفاً.';
    if (error?.code === '23503') return 'تعذر تنفيذ العملية لارتباط المنتج ببيانات أخرى. يمكنك إلغاء تفعيله بدلاً من حذفه.';
    if (error?.status === 401 || error?.status === 403 || error?.code === '42501') return 'انتهت صلاحية الجلسة أو لا تملك صلاحية تنفيذ هذا الإجراء. سجّل الدخول مجدداً.';
    return 'تعذر إكمال العملية. تحقق من الاتصال وإعدادات قاعدة البيانات ثم حاول مرة أخرى.';
  }

  function safeImageUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function productImageMarkup(product) {
    const imageUrl = safeImageUrl(product.image_url);
    return imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="صورة ${escapeHtml(product.name)}" loading="lazy" data-product-image>`
      : '<span aria-hidden="true">▣</span>';
  }

  function renderProducts() {
    const host = one('[data-product-list]');
    if (!host) return;
    const query = (one('[data-product-search]')?.value || '').trim().toLocaleLowerCase('ar');
    const filtered = products.filter((product) => (`${product.name} ${product.slug}`).toLocaleLowerCase('ar').includes(query));
    if (!filtered.length) {
      host.innerHTML = `<div class="product-empty-state">${query ? 'لا توجد منتجات تطابق بحثك.' : 'لا توجد منتجات حتى الآن. أضف أول منتج من النموذج أعلاه.'}</div>`;
      return;
    }
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    host.innerHTML = filtered.map((product) => `<article class="managed-product" data-product-id="${escapeHtml(product.id)}">
      <div class="managed-product-top"><div class="managed-product-image">${productImageMarkup(product)}</div><div class="managed-product-title">
        <h3>${escapeHtml(product.name)}</h3><code>${escapeHtml(product.slug)}</code>
        <div class="managed-product-category">${escapeHtml(categoryNames.get(product.category_id) || 'تصنيف غير متاح')}</div>
      </div></div>
      <div class="managed-product-meta"><span>السعر: <strong>${money(product.price)}</strong></span><span>السعر السابق: <strong>${product.old_price == null ? '—' : money(product.old_price)}</strong></span><span>المخزون: <strong>${Number(product.stock_quantity)}</strong></span></div>
      <div class="managed-product-flags"><span class="product-flag ${product.is_active ? '' : 'inactive'}">${product.is_active ? 'نشط' : 'غير نشط'}</span><span class="product-flag">${product.is_featured ? 'منتج مميز' : 'عادي'}</span></div>
      <div class="product-card-actions"><button type="button" data-edit-product="${escapeHtml(product.id)}">تعديل</button><button type="button" data-toggle-active="${escapeHtml(product.id)}">${product.is_active ? 'إلغاء التفعيل' : 'تفعيل'}</button><button type="button" data-toggle-featured="${escapeHtml(product.id)}">${product.is_featured ? 'إزالة من المميز' : 'تمييز'}</button><button type="button" data-delete-product="${escapeHtml(product.id)}">حذف</button></div>
    </article>`).join('');
    host.querySelectorAll('[data-product-image]').forEach((image) => image.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.setAttribute('aria-hidden', 'true');
      fallback.textContent = '▣';
      image.replaceWith(fallback);
    }, { once: true }));
  }

  async function loadCategories() {
    const select = one('[data-category-select]');
    const message = one('[data-category-message]');
    try {
      const { data, error } = await supabase.from('categories').select('id,name').eq('is_active', true).order('name');
      if (error) throw error;
      categories = data || [];
      if (select) {
        select.innerHTML = '<option value="">اختر تصنيفاً</option>' + categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
        select.disabled = categories.length === 0;
      }
      if (message) message.textContent = categories.length ? '' : 'لا توجد تصنيفات نشطة. أضف تصنيفاً من قاعدة البيانات قبل إنشاء المنتجات.';
    } catch {
      categories = [];
      if (select) {
        select.innerHTML = '<option value="">تعذر تحميل التصنيفات</option>';
        select.disabled = true;
      }
      if (message) message.textContent = 'تعذر تحميل التصنيفات. تحقق من اتصال Supabase وسياسات القراءة.';
    }
  }

  async function loadProducts() {
    setListMessage('جارٍ تحميل المنتجات…');
    try {
      const { data, error } = await supabase.from('products')
        .select('id,name,slug,description,category_id,price,old_price,stock_quantity,image_url,is_active,is_featured,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      products = data || [];
      setListMessage(products.length ? `عدد المنتجات: ${products.length}` : '');
      renderProducts();
    } catch (error) {
      products = [];
      setListMessage(productErrorMessage(error));
      one('[data-product-list]').innerHTML = '<div class="product-empty-state">تعذر تحميل قائمة المنتجات.</div>';
    }
  }

  function setCurrentImage(url) {
    const box = one('[data-current-image]');
    const image = one('[data-current-image-element]');
    const safeUrl = safeImageUrl(url);
    if (box && image) {
      image.src = safeUrl;
      box.hidden = !safeUrl;
    }
  }

  function clearPreview() {
    const input = one('[data-image-input]');
    const preview = one('[data-image-preview]');
    if (input) input.value = '';
    if (preview) preview.hidden = true;
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
    const form = one('[data-product-form]');
    if (editingProduct && form?.dataset.removeCurrentImage !== 'true') setCurrentImage(editingProduct.image_url);
  }

  function resetForm() {
    const form = one('[data-product-form]');
    form?.reset();
    editingProduct = null;
    if (form) delete form.dataset.removeCurrentImage;
    setCurrentImage('');
    clearPreview();
    if (one('[data-product-form-title]')) one('[data-product-form-title]').textContent = 'إضافة منتج جديد';
    const cancel = one('[data-cancel-edit]');
    if (cancel) cancel.hidden = true;
    const save = one('[data-save-product]');
    if (save) save.textContent = 'حفظ المنتج';
  }

  function beginEdit(product) {
    const form = one('[data-product-form]');
    if (!form) return;
    editingProduct = product;
    form.elements.name.value = product.name || '';
    form.elements.slug.value = product.slug || '';
    form.elements.description.value = product.description || '';
    form.elements.category_id.value = categories.some((category) => category.id === product.category_id) ? product.category_id : '';
    form.elements.price.value = product.price ?? '';
    form.elements.old_price.value = product.old_price ?? '';
    form.elements.stock_quantity.value = product.stock_quantity ?? 0;
    form.elements.is_active.checked = Boolean(product.is_active);
    form.elements.is_featured.checked = Boolean(product.is_featured);
    delete form.dataset.removeCurrentImage;
    clearPreview();
    setCurrentImage(product.image_url);
    if (one('[data-product-form-title]')) one('[data-product-form-title]').textContent = 'تعديل المنتج';
    const cancel = one('[data-cancel-edit]');
    if (cancel) cancel.hidden = false;
    const save = one('[data-save-product]');
    if (save) save.textContent = 'حفظ التعديلات';
    one('#product-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function randomUuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (!window.crypto?.getRandomValues) throw new Error('SECURE_RANDOM_UNAVAILABLE');
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return [...bytes].map((byte, index) => `${[4, 6, 8, 10].includes(index) ? '-' : ''}${byte.toString(16).padStart(2, '0')}`).join('');
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
    const path = `products/${randomUuid()}.${extension}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      await supabase.storage.from(IMAGE_BUCKET).remove([path]).catch(() => {});
      throw new Error('IMAGE_URL_UNAVAILABLE');
    }
    return { path, url: data.publicUrl };
  }

  async function cleanUploadedImage(path) {
    if (!path) return;
    try { await supabase.storage.from(IMAGE_BUCKET).remove([path]); }
    catch { /* Best effort cleanup; no product record points at this upload. */ }
  }

  function databasePayload(form, imageUrl) {
    const price = Number(form.elements.price.value);
    const oldPrice = form.elements.old_price.value.trim();
    const stock = Number(form.elements.stock_quantity.value);
    return {
      name: form.elements.name.value.trim(),
      slug: form.elements.slug.value.trim(),
      description: form.elements.description.value.trim() || null,
      category_id: form.elements.category_id.value,
      price,
      old_price: oldPrice === '' ? null : Number(oldPrice),
      stock_quantity: stock,
      image_url: imageUrl || null,
      is_active: form.elements.is_active.checked,
      is_featured: form.elements.is_featured.checked,
    };
  }

  function validateForm(form) {
    if (!categories.length) {
      showMessage('لا يمكن حفظ المنتج قبل توفر تصنيف نشط.', 'error');
      return false;
    }
    if (!form.reportValidity()) return false;
    const price = Number(form.elements.price.value);
    const oldPrice = form.elements.old_price.value.trim();
    const stock = Number(form.elements.stock_quantity.value);
    if (!Number.isFinite(price) || price < 0 || (oldPrice !== '' && (!Number.isFinite(Number(oldPrice)) || Number(oldPrice) < 0)) || !Number.isInteger(stock) || stock < 0) {
      showMessage('تحقق من السعر والسعر السابق والكمية في المخزون.', 'error');
      return false;
    }
    if (!categories.some((category) => category.id === form.elements.category_id.value)) {
      showMessage('اختر تصنيفاً نشطاً للمنتج.', 'error');
      return false;
    }
    const file = one('[data-image-input]')?.files?.[0];
    try { validateImage(file); }
    catch (error) {
      showMessage(error.message === 'IMAGE_SIZE' ? 'حجم الصورة يتجاوز 5 ميغابايت.' : 'نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.', 'error');
      return false;
    }
    return true;
  }

  async function saveProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    showMessage('');
    if (!validateForm(form)) return;
    const saveButton = one('[data-save-product]');
    if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'جارٍ الحفظ…'; }
    let uploadedPath = null;
    try {
      const selectedFile = one('[data-image-input]')?.files?.[0];
      let imageUrl = editingProduct?.image_url || null;
      if (form.dataset.removeCurrentImage === 'true') imageUrl = null;
      if (selectedFile) {
        const uploaded = await uploadImage(selectedFile);
        imageUrl = uploaded.url;
        uploadedPath = uploaded.path;
      }
      const payload = databasePayload(form, imageUrl);
      const query = editingProduct
        ? supabase.from('products').update(payload).eq('id', editingProduct.id)
        : supabase.from('products').insert(payload);
      const { error } = await query.select('id').single();
      if (error) throw error;
      uploadedPath = null;
      showMessage(editingProduct ? 'تم تحديث المنتج بنجاح.' : 'تمت إضافة المنتج بنجاح.');
      resetForm();
      await loadProducts();
    } catch (error) {
      await cleanUploadedImage(uploadedPath);
      if (error?.message === 'IMAGE_TYPE' || error?.message === 'IMAGE_SIZE') {
        showMessage(error.message === 'IMAGE_SIZE' ? 'حجم الصورة يتجاوز 5 ميغابايت.' : 'نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.', 'error');
      } else {
        showMessage(productErrorMessage(error), 'error');
      }
    } finally {
      if (saveButton) { saveButton.disabled = false; saveButton.textContent = editingProduct ? 'حفظ التعديلات' : 'حفظ المنتج'; }
    }
  }

  async function updateProduct(product, patch, successMessage) {
    showMessage('');
    try {
      const { error } = await supabase.from('products').update(patch).eq('id', product.id).select('id').single();
      if (error) throw error;
      showMessage(successMessage);
      await loadProducts();
    } catch (error) {
      showMessage(productErrorMessage(error), 'error');
    }
  }

  async function deleteProduct(product) {
    const confirmed = window.confirm(`هل تريد حذف «${product.name}»؟ ستبقى تفاصيله المحفوظة ضمن الطلبات السابقة.`);
    if (!confirmed) return;
    showMessage('');
    try {
      const { error } = await supabase.from('products').delete().eq('id', product.id).select('id').single();
      if (error) throw error;
      showMessage('تم حذف المنتج. تبقى تفاصيله التاريخية محفوظة في الطلبات.');
      await loadProducts();
    } catch (error) {
      showMessage(error?.code === '23503'
        ? 'تعذر حذف المنتج لوجود ارتباطات به. ألغِ تفعيله بدلاً من حذفه.'
        : productErrorMessage(error), 'error');
    }
  }

  function handleProductActions(event) {
    const button = event.target.closest('button[data-edit-product],button[data-toggle-active],button[data-toggle-featured],button[data-delete-product]');
    if (!button) return;
    const product = products.find((item) => item.id === button.dataset.editProduct
      || item.id === button.dataset.toggleActive
      || item.id === button.dataset.toggleFeatured
      || item.id === button.dataset.deleteProduct);
    if (!product) return;
    if (button.dataset.editProduct) {
      beginEdit(product);
    } else if (button.dataset.toggleActive) {
      const nextState = !product.is_active;
      if (!window.confirm(nextState ? 'هل تريد تفعيل هذا المنتج؟' : 'هل تريد إلغاء تفعيل هذا المنتج؟ سيبقى محفوظاً في قاعدة البيانات.')) return;
      updateProduct(product, { is_active: nextState }, nextState ? 'تم تفعيل المنتج.' : 'تم إلغاء تفعيل المنتج.');
    } else if (button.dataset.toggleFeatured) {
      const nextState = !product.is_featured;
      updateProduct(product, { is_featured: nextState }, nextState ? 'تم تمييز المنتج.' : 'تمت إزالة المنتج من المنتجات المميزة.');
    } else if (button.dataset.deleteProduct) {
      deleteProduct(product);
    }
  }

  function handleImagePreview() {
    const file = one('[data-image-input]')?.files?.[0];
    const preview = one('[data-image-preview]');
    const image = one('[data-preview-image]');
    const form = one('[data-product-form]');
    if (!file || !preview || !image) return;
    try { validateImage(file); }
    catch (error) {
      one('[data-image-input]').value = '';
      showMessage(error.message === 'IMAGE_SIZE' ? 'حجم الصورة يتجاوز 5 ميغابايت.' : 'نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.', 'error');
      return;
    }
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(file);
    image.src = previewObjectUrl;
    preview.hidden = false;
    one('[data-current-image]').hidden = true;
    if (form) delete form.dataset.removeCurrentImage;
  }

  function bindEvents() {
    one('[data-product-form]')?.addEventListener('submit', saveProduct);
    one('[data-product-list]')?.addEventListener('click', handleProductActions);
    one('[data-product-search]')?.addEventListener('input', renderProducts);
    one('[data-image-input]')?.addEventListener('change', handleImagePreview);
    one('[data-clear-image]')?.addEventListener('click', clearPreview);
    one('[data-remove-current-image]')?.addEventListener('click', () => {
      one('[data-product-form]').dataset.removeCurrentImage = 'true';
      setCurrentImage('');
    });
    one('[data-cancel-edit]')?.addEventListener('click', () => { resetForm(); showMessage(''); });
    one('[data-logout-button]')?.addEventListener('click', async (event) => {
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
      one('[data-admin-email]').textContent = access.user.email || '';
      if (protectedContent) protectedContent.hidden = false;
      if (authCheck) authCheck.hidden = true;
      bindEvents();
      await Promise.all([loadCategories(), loadProducts()]);
    } catch {
      await window.BabAdminAuth.signOutQuietly();
      window.location.replace('login.html?reason=authorization-check');
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
