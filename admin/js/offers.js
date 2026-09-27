(() => {
  'use strict';

  const IMAGE_BUCKET = 'product-images';
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const IMAGE_TYPES = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
  let supabase;
  let products = [];
  let offers = [];
  let editingOffer = null;
  let previewObjectUrl = null;

  const one = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const money = (value) => `${Number(value || 0).toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

  function showMessage(message, kind = 'success') {
    const area = one('[data-offers-message]');
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

  function datetimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function formatDate(value) {
    if (!value) return 'بلا تاريخ انتهاء';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'تاريخ غير صالح' : new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function getOfferState(offer) {
    if (!offer.is_active) return 'غير نشط';
    const now = Date.now();
    const start = new Date(offer.start_date).getTime();
    const end = offer.end_date ? new Date(offer.end_date).getTime() : Infinity;
    if (start > now) return 'قادم';
    if (end <= now) return 'منتهي';
    return 'ساري الآن';
  }

  function productFor(offer) {
    return products.find((product) => product.id === offer.product_id);
  }

  function offerPrices(offer) {
    const product = productFor(offer);
    const oldPrice = offer.old_price == null ? Number(product?.price || 0) : Number(offer.old_price);
    const price = offer.offer_price == null
      ? oldPrice * (100 - Number(offer.discount_percentage || 0)) / 100
      : Number(offer.offer_price);
    return { oldPrice, price };
  }

  function renderOffers() {
    const host = one('[data-offer-list]');
    if (!host) return;
    const query = (one('[data-offer-search]')?.value || '').trim().toLocaleLowerCase('ar');
    const filtered = offers.filter((offer) => {
      const product = productFor(offer);
      return (`${offer.title} ${offer.description || ''} ${product?.name || ''}`).toLocaleLowerCase('ar').includes(query);
    });
    if (!filtered.length) {
      host.innerHTML = `<div class="product-empty-state">${query ? 'لا توجد عروض تطابق بحثك.' : 'لا توجد عروض حتى الآن. أضف أول عرض من النموذج أعلاه.'}</div>`;
      return;
    }
    host.innerHTML = filtered.map((offer) => {
      const product = productFor(offer);
      const imageUrl = safeImageUrl(offer.image_url);
      const prices = offerPrices(offer);
      const state = getOfferState(offer);
      return `<article class="managed-product offer-card" data-offer-id="${escapeHtml(offer.id)}">
        <div class="managed-product-top"><div class="managed-product-image">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(offer.title)}" loading="lazy" data-offer-image>` : '<span aria-hidden="true">%</span>'}</div><div class="managed-product-title">
          <h3>${escapeHtml(offer.title)}</h3><div class="managed-product-category">المنتج: ${escapeHtml(product?.name || 'منتج غير متاح')}</div>
          <div class="offer-price-line"><del>${money(prices.oldPrice)}</del><strong>${money(prices.price)}</strong><span>خصم ${Number(offer.discount_percentage).toLocaleString('ar')}%</span></div>
        </div></div>
        <div class="offer-dates"><span>البداية: ${escapeHtml(formatDate(offer.start_date))}</span><span>النهاية: ${escapeHtml(formatDate(offer.end_date))}</span></div>
        <div class="managed-product-flags"><span class="product-flag ${state === 'منتهي' || state === 'غير نشط' ? 'inactive' : ''}">${escapeHtml(state)}</span></div>
        <div class="product-card-actions"><button type="button" data-edit-offer="${escapeHtml(offer.id)}">تعديل</button><button type="button" data-toggle-offer="${escapeHtml(offer.id)}">${offer.is_active ? 'إلغاء التفعيل' : 'تفعيل'}</button><button type="button" data-delete-offer="${escapeHtml(offer.id)}">حذف</button></div>
      </article>`;
    }).join('');
    host.querySelectorAll('[data-offer-image]').forEach((image) => image.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.setAttribute('aria-hidden', 'true');
      fallback.textContent = '%';
      image.replaceWith(fallback);
    }, { once: true }));
  }

  function renderProductOptions(selectedId = '') {
    const select = one('[data-product-select]');
    if (!select) return;
    const selected = products.find((product) => product.id === selectedId);
    const options = products.filter((product) => product.is_active || product.id === selectedId);
    if (!options.length) {
      select.innerHTML = '<option value="">لا توجد منتجات نشطة</option>';
      select.disabled = true;
      return;
    }
    select.innerHTML = '<option value="">اختر منتجاً</option>' + options.map((product) =>
      `<option value="${escapeHtml(product.id)}"${product.id === selectedId ? ' selected' : ''}>${escapeHtml(product.name)}${product.is_active ? '' : ' (غير نشط)'}</option>`
    ).join('');
    select.disabled = false;
    if (selected && !selected.is_active && selectedId) select.value = selectedId;
  }

  async function loadProducts() {
    const message = one('[data-product-message]');
    try {
      const { data, error } = await supabase.from('products').select('id,name,price,is_active').order('name');
      if (error) throw error;
      products = data || [];
      renderProductOptions();
      if (message) message.textContent = products.some((product) => product.is_active)
        ? 'يمكن اختيار المنتجات النشطة للعروض الجديدة.'
        : 'لا توجد منتجات نشطة. فعّل منتجاً أولاً من صفحة المنتجات.';
    } catch {
      products = [];
      renderProductOptions();
      if (message) message.textContent = 'تعذر تحميل المنتجات. تحقق من سياسات القراءة والاتصال.';
    }
  }

  async function loadOffers() {
    showListMessage('جارٍ تحميل العروض…');
    try {
      const { data, error } = await supabase.from('offers')
        .select('id,product_id,title,description,discount_percentage,old_price,offer_price,image_url,start_date,end_date,is_active,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      offers = data || [];
      showListMessage(offers.length ? `عدد العروض: ${offers.length}` : '');
      renderOffers();
    } catch (error) {
      offers = [];
      showListMessage(error?.status === 401 || error?.status === 403 || error?.code === '42501'
        ? 'انتهت صلاحية الجلسة أو لا تملك صلاحية عرض العروض.'
        : 'تعذر تحميل العروض. تحقق من الاتصال وسياسات القراءة.');
      one('[data-offer-list]').innerHTML = '<div class="product-empty-state">تعذر تحميل قائمة العروض.</div>';
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
    const form = one('[data-offer-form]');
    if (editingOffer && form?.dataset.removeCurrentImage !== 'true') setCurrentImage(editingOffer.image_url);
  }

  function setDefaultStartDate() {
    one('[data-offer-form]').elements.start_date.value = datetimeLocal(new Date().toISOString());
  }

  function resetForm() {
    const form = one('[data-offer-form]');
    form.reset();
    editingOffer = null;
    delete form.dataset.removeCurrentImage;
    delete form.dataset.selectedProductId;
    setCurrentImage('');
    clearPreview();
    renderProductOptions();
    setDefaultStartDate();
    one('[data-offer-form-title]').textContent = 'إضافة عرض جديد';
    one('[data-cancel-edit]').hidden = true;
    one('[data-save-offer]').textContent = 'حفظ العرض';
  }

  function updateCalculatedOfferPrice() {
    const form = one('[data-offer-form]');
    const oldPrice = Number(form.elements.old_price.value);
    const discount = Number(form.elements.discount_percentage.value);
    if (Number.isFinite(oldPrice) && Number.isFinite(discount)) {
      form.elements.offer_price.value = Math.max(0, oldPrice * (100 - discount) / 100).toFixed(2);
    }
  }

  function beginEdit(offer) {
    const form = one('[data-offer-form]');
    editingOffer = offer;
    form.elements.title.value = offer.title || '';
    form.elements.description.value = offer.description || '';
    form.elements.discount_percentage.value = offer.discount_percentage ?? '';
    form.elements.old_price.value = offer.old_price ?? productFor(offer)?.price ?? '';
    form.elements.offer_price.value = offer.offer_price ?? Number(form.elements.old_price.value || 0) * (100 - Number(offer.discount_percentage || 0)) / 100;
    form.elements.start_date.value = datetimeLocal(offer.start_date);
    form.elements.end_date.value = datetimeLocal(offer.end_date);
    form.elements.is_active.value = String(Boolean(offer.is_active));
    form.dataset.selectedProductId = offer.product_id;
    delete form.dataset.removeCurrentImage;
    renderProductOptions(offer.product_id);
    clearPreview();
    setCurrentImage(offer.image_url);
    one('[data-offer-form-title]').textContent = 'تعديل العرض';
    one('[data-cancel-edit]').hidden = false;
    one('[data-save-offer]').textContent = 'حفظ التعديلات';
    one('#offer-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const path = `offers/${window.crypto.randomUUID()}.${extension}`;
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

  function offerImagePath(value) {
    try {
      const url = new URL(value);
      const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
      const index = url.href.indexOf(marker);
      if (url.protocol !== 'https:' || index < 0) return null;
      const path = url.href.slice(index + marker.length).split(/[?#]/)[0];
      return path.startsWith('offers/') ? path : null;
    } catch { return null; }
  }

  async function removeOfferImage(value) {
    const path = offerImagePath(value);
    if (!path) return;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
    if (error) throw error;
  }

  function validationError(form) {
    if (!form.elements.title.value.trim()) return 'أدخل عنوان العرض.';
    const productId = form.elements.product_id.value;
    const product = products.find((item) => item.id === productId);
    if (!productId || !product) return 'اختر منتجاً صالحاً للعرض.';
    if (!editingOffer && !product.is_active) return 'اختر منتجاً نشطاً لإنشاء العرض.';
    const discount = Number(form.elements.discount_percentage.value);
    const oldPrice = Number(form.elements.old_price.value);
    const offerPrice = Number(form.elements.offer_price.value);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) return 'يجب أن تكون نسبة الخصم بين 0 و100.';
    if (!Number.isFinite(oldPrice) || oldPrice < 0) return 'أدخل سعراً أصلياً صالحاً.';
    if (!Number.isFinite(offerPrice) || offerPrice < 0) return 'أدخل سعر عرض صالحاً.';
    if (oldPrice < offerPrice) return 'يجب أن يكون السعر الأصلي أكبر من أو مساوياً لسعر العرض.';
    const startValue = form.elements.start_date.value;
    const start = new Date(startValue);
    const endValue = form.elements.end_date.value;
    if (!startValue || Number.isNaN(start.getTime())) return 'حدد تاريخ ووقت بداية صالحين.';
    if (endValue) {
      const end = new Date(endValue);
      if (Number.isNaN(end.getTime())) return 'حدد تاريخ ووقت نهاية صالحين.';
      if (end <= start) return 'يجب أن يكون تاريخ نهاية العرض بعد تاريخ بدايته.';
    }
    const file = one('[data-image-input]').files[0];
    try { validateImage(file); }
    catch (error) { return error.message === 'IMAGE_SIZE' ? 'حجم الصورة يتجاوز 5 ميغابايت.' : 'نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.'; }
    return null;
  }

  function offerErrorMessage(error) {
    if (error?.code === '23505') return 'تعذر الحفظ بسبب تكرار قيمة فريدة.';
    if (error?.code === '23503') return 'تعذر حفظ العرض لأن المنتج المحدد لم يعد متاحاً.';
    if (error?.code === '23514') return 'بيانات العرض أو نطاق التواريخ لا يطابق قيود قاعدة البيانات.';
    if (error?.status === 401 || error?.status === 403 || error?.code === '42501') return 'انتهت صلاحية الجلسة أو لا تملك صلاحية تنفيذ هذا الإجراء.';
    if (error?.message === 'SECURE_RANDOM_UNAVAILABLE') return 'تعذر إنشاء مسار آمن للصورة. استخدم اتصالاً آمناً ثم أعد المحاولة.';
    return 'تعذر إكمال العملية. تحقق من الاتصال وإعدادات قاعدة البيانات ثم حاول مرة أخرى.';
  }

  async function saveOffer(event) {
    event.preventDefault();
    const form = event.currentTarget;
    showMessage('');
    if (!form.reportValidity()) return;
    const validation = validationError(form);
    if (validation) { showMessage(validation, 'error'); return; }

    const button = one('[data-save-offer]');
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ…';
    let uploadedPath = null;
    const oldImageUrl = editingOffer?.image_url || null;
    let imageUrl = editingOffer?.image_url || null;
    try {
      if (form.dataset.removeCurrentImage === 'true') imageUrl = null;
      const file = one('[data-image-input]').files[0];
      if (file) {
        const uploaded = await uploadImage(file);
        imageUrl = uploaded.url;
        uploadedPath = uploaded.path;
      }
      const payload = {
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim() || null,
        product_id: form.elements.product_id.value,
        discount_percentage: Number(form.elements.discount_percentage.value),
        old_price: Number(form.elements.old_price.value),
        offer_price: Number(form.elements.offer_price.value),
        image_url: imageUrl,
        start_date: new Date(form.elements.start_date.value).toISOString(),
        end_date: form.elements.end_date.value ? new Date(form.elements.end_date.value).toISOString() : null,
        is_active: form.elements.is_active.value === 'true',
      };
      const query = editingOffer
        ? supabase.from('offers').update(payload).eq('id', editingOffer.id)
        : supabase.from('offers').insert(payload);
      const { error } = await query.select('id').single();
      if (error) throw error;
      uploadedPath = null;
      showMessage(editingOffer ? 'تم تحديث العرض بنجاح.' : 'تمت إضافة العرض بنجاح.');
      resetForm();
      await Promise.all([loadOffers(), loadProducts()]);
      if (oldImageUrl && oldImageUrl !== imageUrl) {
        try { await removeOfferImage(oldImageUrl); }
        catch { showMessage('تم حفظ العرض، لكن تعذر حذف الصورة القديمة من التخزين.', 'error'); }
      }
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(IMAGE_BUCKET).remove([uploadedPath]).catch(() => {});
      showMessage(offerErrorMessage(error), 'error');
    } finally {
      button.disabled = false;
      button.textContent = editingOffer ? 'حفظ التعديلات' : 'حفظ العرض';
    }
  }

  async function toggleOffer(offer) {
    const active = !offer.is_active;
    if (!window.confirm(active ? 'هل تريد تفعيل هذا العرض؟' : 'هل تريد إلغاء تفعيل هذا العرض؟ سيبقى محفوظاً ويمكن تفعيله لاحقاً.')) return;
    try {
      const { error } = await supabase.from('offers').update({ is_active: active }).eq('id', offer.id).select('id').single();
      if (error) throw error;
      showMessage(active ? 'تم تفعيل العرض.' : 'تم إلغاء تفعيل العرض.');
      await loadOffers();
    } catch (error) { showMessage(offerErrorMessage(error), 'error'); }
  }

  async function deleteOffer(offer) {
    if (!window.confirm(`هل تريد حذف العرض «${offer.title}»؟`)) return;
    try {
      const { error } = await supabase.from('offers').delete().eq('id', offer.id).select('id').single();
      if (error) throw error;
      showMessage('تم حذف العرض.');
      await loadOffers();
      try { await removeOfferImage(offer.image_url); }
      catch { showMessage('تم حذف العرض، لكن تعذر حذف صورته من التخزين.', 'error'); }
    } catch (error) { showMessage(offerErrorMessage(error), 'error'); }
  }

  function handleOfferActions(event) {
    const button = event.target.closest('button[data-edit-offer],button[data-toggle-offer],button[data-delete-offer]');
    if (!button) return;
    const id = button.dataset.editOffer || button.dataset.toggleOffer || button.dataset.deleteOffer;
    const offer = offers.find((item) => item.id === id);
    if (!offer) return;
    if (button.dataset.editOffer) beginEdit(offer);
    else if (button.dataset.toggleOffer) toggleOffer(offer);
    else deleteOffer(offer);
  }

  function handleImagePreview() {
    const input = one('[data-image-input]');
    const file = input.files[0];
    if (!file) return;
    try { validateImage(file); }
    catch (error) {
      input.value = '';
      showMessage(error.message === 'IMAGE_SIZE' ? 'حجم الصورة يتجاوز 5 ميغابايت.' : 'نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.', 'error');
      return;
    }
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(file);
    one('[data-preview-image]').src = previewObjectUrl;
    one('[data-image-preview]').hidden = false;
    one('[data-current-image]').hidden = true;
    delete one('[data-offer-form]').dataset.removeCurrentImage;
  }

  function bindEvents() {
    const form = one('[data-offer-form]');
    form.addEventListener('submit', saveOffer);
    one('[data-offer-list]').addEventListener('click', handleOfferActions);
    one('[data-offer-search]').addEventListener('input', renderOffers);
    one('[data-product-select]').addEventListener('change', () => {
      const product = products.find((item) => item.id === one('[data-product-select]').value);
      if (product && (!editingOffer || product.id !== editingOffer.product_id)) {
        one('[data-offer-form]').elements.old_price.value = Number(product.price).toFixed(2);
      }
      updateCalculatedOfferPrice();
    });
    form.elements.old_price.addEventListener('input', updateCalculatedOfferPrice);
    form.elements.discount_percentage.addEventListener('input', updateCalculatedOfferPrice);
    one('[data-image-input]').addEventListener('change', handleImagePreview);
    one('[data-clear-image]').addEventListener('click', clearPreview);
    one('[data-remove-current-image]').addEventListener('click', () => {
      one('[data-offer-form]').dataset.removeCurrentImage = 'true';
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
      setDefaultStartDate();
      await Promise.all([loadProducts(), loadOffers()]);
      renderOffers();
    } catch {
      await window.BabAdminAuth.signOutQuietly();
      window.location.replace('login.html?reason=authorization-check');
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
