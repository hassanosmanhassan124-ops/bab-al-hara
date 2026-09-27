(() => {
  'use strict';

  const CART_KEY = 'bab-cart';
  const WISHLIST_KEY = 'bab-wishlist';
  const IMAGE_FALLBACK = '▣';
  const PAGE_TITLE = document.title;
  let supabase = null;
  let products = [];
  let categories = [];
  let offers = [];
  let storeSettings = null;
  let storeSettingsLoadFailed = false;
  const state = { products: 'idle', categories: 'idle', offers: 'idle' };

  const read = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };

  function cartRows() {
    const quantities = new Map();
    read(CART_KEY).forEach((item) => {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || !Number.isInteger(Number(item.qty)) || Number(item.qty) < 1) return;
      quantities.set(item.id, Math.min(99, (quantities.get(item.id) || 0) + Number(item.qty)));
    });
    return [...quantities].map(([id, qty]) => ({ id, qty }));
  }

  function clearPurchasedCart(purchasedRows) {
    const quantities = new Map(purchasedRows.map(({ id, qty }) => [id, qty]));
    const remaining = cartRows().flatMap(({ id, qty }) => {
      const purchased = quantities.get(id) || 0;
      const consumed = Math.min(qty, purchased);
      if (purchased > consumed) quantities.set(id, purchased - consumed);
      else quantities.delete(id);
      return qty > consumed ? [{ id, qty: qty - consumed }] : [];
    });
    return write(CART_KEY, remaining);
  }

  function wishlistIds() {
    return [...new Set(read(WISHLIST_KEY).filter((id) => typeof id === 'string' && id.length > 0))];
  }

  function getBasePath() {
    const path = location.pathname;
    const pages = ['products', 'categories', 'offers', 'wishlist', 'cart', 'order', 'contact', 'product'];
    for (const page of pages) {
      const marker = `/${page}`;
      const index = path.lastIndexOf(marker);
      if (index < 0) continue;
      const rest = path.slice(index + marker.length);
      if (rest === '' || rest === '/' || rest === '/index.html') return path.slice(0, index + 1);
    }
    if (path.endsWith('/index.html')) return path.slice(0, -10);
    if (path.endsWith('/')) return path;
    const lastSegment = path.slice(path.lastIndexOf('/') + 1);
    return lastSegment.includes('.') ? path.slice(0, path.lastIndexOf('/') + 1) : `${path}/`;
  }

  const base = getBasePath();
  function href(path) {
    const targetSegments = [...base.split('/').filter(Boolean), ...String(path).split('/').filter(Boolean)];
    const currentPath = location.pathname;
    const fromSegments = currentPath.split('/').filter(Boolean);
    if (!currentPath.endsWith('/')) fromSegments.pop();
    let shared = 0;
    while (shared < fromSegments.length && shared < targetSegments.length && fromSegments[shared] === targetSegments[shared]) shared += 1;
    let relative = `${'../'.repeat(fromSegments.length - shared)}${targetSegments.slice(shared).join('/')}`;
    if (!relative) relative = targetSegments.at(-1) || 'index.html';
    return relative;
  }
  const productHref = (id, offerId = '') => `${href('product/index.html')}?id=${encodeURIComponent(id)}${offerId ? `&offer=${encodeURIComponent(offerId)}` : ''}`;
  const categoryFor = (id) => categories.find((category) => category.id === id);
  const productFor = (id) => products.find((product) => product.id === id);
  const money = (amount) => `${Number(amount || 0).toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);

  function safeImageUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  }

  function normalizeDigits(value) {
    return String(value || '').replace(/[٠-٩۰-۹]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    });
  }

  function whatsappNumber(value) {
    let digits = normalizeDigits(value).replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
    return digits.length >= 8 && digits.length <= 15 && !digits.startsWith('0') ? digits : '';
  }

  function whatsappUrl(value, message = '') {
    const digits = whatsappNumber(value);
    if (!digits) return '';
    try {
      const query = message ? `?text=${encodeURIComponent(message)}` : '';
      return `https://wa.me/${digits}${query}`;
    } catch { return ''; }
  }

  function phoneUrl(value) {
    const original = normalizeDigits(value).trim();
    let digits = original.replace(/\D/g, '');
    const internationalPrefix = original.startsWith('+') || digits.startsWith('00');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length < 4 || digits.length > 15) return '';
    return `tel:${internationalPrefix ? '+' : ''}${digits}`;
  }

  function socialUrl(platform, value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const hosts = {
      instagram: ['instagram.com', 'www.instagram.com'],
      tiktok: ['tiktok.com', 'www.tiktok.com'],
      facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
    };
    const allowed = hosts[platform];
    if (/^https:\/\//i.test(text)) {
      try {
        const url = new URL(text);
        return allowed.includes(url.hostname.toLowerCase()) && !url.username && !url.password ? url.href : '';
      } catch { return ''; }
    }
    if (!/^@?[A-Za-z0-9._-]{1,100}$/.test(text)) return '';
    const user = encodeURIComponent(text.replace(/^@/, ''));
    if (platform === 'instagram') return `https://www.instagram.com/${user}/`;
    if (platform === 'tiktok') return `https://www.tiktok.com/@${user}`;
    return `https://www.facebook.com/${user}`;
  }

  function applyStoreSettings() {
    const value = (key) => String(storeSettings?.[key] ?? '').trim();
    const storeName = value('store_name');
    document.querySelectorAll('[data-store-name]').forEach((node) => {
      node.textContent = storeName;
      node.hidden = !storeName;
    });
    document.title = storeName
      ? PAGE_TITLE.replace(/باب الحارة/g, storeName)
      : PAGE_TITLE.replace(/(?:باب الحارة\s*\|\s*|\s*\|\s*باب الحارة)/g, '');
    document.querySelectorAll('.brand').forEach((brand) => {
      brand.setAttribute('aria-label', storeName ? `${storeName} — الرئيسية` : 'الرئيسية');
    });
    document.querySelectorAll('[data-store-value]').forEach((node) => {
      const text = value(node.dataset.storeValue);
      node.textContent = text;
      node.hidden = !text;
    });

    const whatsapp = whatsappUrl(value('whatsapp'));
    document.querySelectorAll('[data-store-link="whatsapp"]').forEach((link) => {
      link.hidden = !whatsapp;
      if (whatsapp) link.href = whatsapp;
    });
    const phone = phoneUrl(value('phone'));
    document.querySelectorAll('[data-store-link="phone"]').forEach((link) => {
      link.hidden = !phone;
      if (phone) {
        link.href = phone;
        link.textContent = value('phone');
      }
    });
    const rowVisibility = [
      ['whatsapp', Boolean(whatsapp)], ['phone', Boolean(phone)], ['address', Boolean(value('address'))],
      ['working_hours', Boolean(value('working_hours'))],
    ];
    rowVisibility.forEach(([key, visible]) => {
      document.querySelectorAll(`[data-contact-row="${key}"]`).forEach((row) => { row.hidden = !visible; });
    });
    document.querySelectorAll('[data-footer-phone]').forEach((row) => { row.hidden = !phone; });
    document.querySelectorAll('[data-footer-whatsapp]').forEach((row) => { row.hidden = !whatsapp; });
    document.querySelectorAll('[data-footer-address]').forEach((row) => { row.hidden = !value('address'); });
    document.querySelectorAll('[data-footer-hours]').forEach((row) => { row.hidden = !value('working_hours'); });
    document.querySelectorAll('[data-footer-setting]').forEach((row) => {
      const link = row.querySelector('a[data-store-link]');
      row.hidden = link ? link.hidden : !value(row.dataset.footerSetting);
    });
    document.querySelectorAll('[data-store-settings-error]').forEach((row) => {
      row.hidden = !storeSettingsLoadFailed;
    });

    const socialLabels = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };
    document.querySelectorAll('[data-store-socials]').forEach((host) => {
      const configured = Object.entries(socialLabels).map(([key, label]) => {
        const url = socialUrl(key, value(key));
        return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';
      }).filter(Boolean);
      host.innerHTML = configured.join(' · ');
      const socialGroup = host.closest('[data-contact-socials], [data-footer-social-group]');
      if (socialGroup) socialGroup.hidden = configured.length === 0;
    });

    ['delivery_information', 'payment_information'].forEach((key) => {
      const visible = Boolean(value(key));
      document.querySelectorAll(`[data-contact-policy="${key}"], [data-checkout-policy="${key}"]`).forEach((section) => { section.hidden = !visible; });
    });
    document.querySelectorAll('[data-checkout-policies]').forEach((section) => {
      section.hidden = !value('delivery_information') && !value('payment_information');
    });
  }

  function refreshCounts() {
    const availableCart = cartRows().filter((item) => {
      const product = productFor(item.id);
      return state.products !== 'ready' || (product && Number(product.stock_quantity) > 0);
    });
    const validWishlist = wishlistIds().filter((id) => state.products !== 'ready' || productFor(id));
    const cartCount = availableCart.reduce((sum, item) => {
      const product = productFor(item.id);
      const quantity = product ? Math.min(item.qty, Number(product.stock_quantity)) : item.qty;
      return sum + quantity;
    }, 0);
    document.querySelectorAll('[data-count="cart"]').forEach((node) => { node.textContent = cartCount; });
    document.querySelectorAll('[data-count="wishlist"]').forEach((node) => { node.textContent = validWishlist.length; });
  }

  function renderShell() {
    const links = [
      ['index.html', 'الرئيسية'], ['products/index.html', 'المنتجات'], ['categories/index.html', 'الفئات'],
      ['offers/index.html', 'العروض'], ['wishlist/index.html', 'المفضلة'], ['cart/index.html', 'السلة'], ['contact/index.html', 'تواصل معنا'],
    ];
    const header = document.querySelector('[data-site-header]');
    if (header) {
      header.innerHTML = `<header class="site-header"><div class="container header-inner">
        <a class="brand" href="${href('index.html')}" aria-label="باب الحارة — الرئيسية"><img class="brand-logo" src="${href('assets/images/bab-al-hara-logo.png')}" alt="شعار باب الحارة"><span data-store-name>باب الحارة</span></a>
        <button class="menu-toggle" type="button" aria-label="فتح القائمة" aria-expanded="false" aria-controls="main-navigation"><span></span><span></span><span></span></button>
        <nav class="main-nav" id="main-navigation" aria-label="التنقل الرئيسي">${links.map(([path, label]) => `<a href="${href(path)}">${label}</a>`).join('')}</nav>
        <div class="header-actions"><a class="header-icon-link" href="${href('wishlist/index.html')}" aria-label="المفضلة، ${wishlistIds().length} منتجات">♡ <span data-count="wishlist">0</span></a><a href="${href('cart/index.html')}">السلة <span class="count-pill" data-count="cart">0</span></a></div>
      </div></header>`;
      header.querySelectorAll('.main-nav a').forEach((link) => {
        if (new URL(link.href).pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '') && link.getAttribute('href') !== href('index.html')) link.setAttribute('aria-current', 'page');
      });
      const toggle = header.querySelector('.menu-toggle');
      const nav = header.querySelector('.main-nav');
      const closeMenu = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'فتح القائمة'); };
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
      });
      nav.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
    }
    const footer = document.querySelector('[data-site-footer]');
    if (footer) footer.innerHTML = `<footer class="site-footer"><div class="container footer-grid">
      <div><a class="brand" href="${href('index.html')}" aria-label="باب الحارة — الرئيسية"><img class="brand-logo" src="${href('assets/images/bab-al-hara-logo.png')}" alt="شعار باب الحارة"><span data-store-name>باب الحارة</span></a><p data-store-value="store_description" hidden></p></div>
      <div><h2>روابط سريعة</h2><ul>${links.slice(0, 4).map(([path, label]) => `<li><a href="${href(path)}">${label}</a></li>`).join('')}</ul></div>
      <div><h2>تواصل معنا</h2><p>للاستفسارات والطلبات، تواصل معنا عبر صفحة التواصل.</p><a href="${href('contact/index.html')}">صفحة التواصل</a></div>
      <div class="footer-store-info"><h2>معلومات المتجر</h2>
        <p data-footer-setting="store_name" hidden><strong>اسم المتجر: </strong><span data-store-value="store_name"></span></p>
        <p data-footer-setting="address" dir="rtl" hidden><strong>العنوان: </strong><span data-store-value="address"></span></p>
        <p data-footer-setting="phone" hidden><strong>الهاتف: </strong><a data-store-link="phone" dir="ltr"></a></p>
        <p data-footer-setting="whatsapp" hidden><strong>WhatsApp: </strong><a data-store-link="whatsapp">تواصل عبر واتساب</a></p>
        <div data-footer-social-group hidden><div data-store-socials></div></div>
        <p data-footer-setting="delivery_information" hidden><strong>معلومات التوصيل: </strong><span data-store-value="delivery_information"></span></p>
        <p data-footer-setting="payment_information" hidden><strong>معلومات الدفع: </strong><span data-store-value="payment_information"></span></p>
        <p data-footer-setting="working_hours" hidden><strong>ساعات العمل: </strong><span data-store-value="working_hours"></span></p>
        <p data-store-settings-error hidden>تعذر تحميل معلومات المتجر حالياً.</p>
      </div>
    </div><div class="footer-bottom">© ${new Date().getFullYear()} <span data-store-name></span> — جميع الحقوق محفوظة</div></footer>`;
    refreshCounts();
  }

  function setImageFallbacks(host) {
    host.querySelectorAll('[data-catalog-image]').forEach((image) => image.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.className = image.classList.contains('category-photo') ? 'category-icon' : 'product-glyph';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.textContent = IMAGE_FALLBACK;
      image.replaceWith(fallback);
    }, { once: true }));
  }

  function renderCategories() {
    document.querySelectorAll('[data-categories]').forEach((host) => {
      if (state.categories === 'loading' || state.categories === 'idle') {
        host.innerHTML = '<div class="empty-state"><h2>جارٍ تحميل التصنيفات…</h2></div>';
        return;
      }
      if (state.categories === 'error') {
        host.innerHTML = `<div class="empty-state"><h2>تعذر تحميل التصنيفات</h2><p>تحقق من إعدادات اتصال المتجر ثم أعد المحاولة.</p><button class="button button-outline" type="button" data-retry-catalog>إعادة المحاولة</button></div>`;
        return;
      }
      if (!categories.length) {
        host.innerHTML = '<div class="empty-state"><h2>لا توجد تصنيفات متاحة حالياً</h2><p>ستظهر التصنيفات النشطة هنا عند توفرها.</p></div>';
        return;
      }
      host.innerHTML = categories.map((category) => {
        const image = safeImageUrl(category.image_url);
        const categoryHref = `${href('products/index.html')}?category=${encodeURIComponent(category.id)}`;
        return `<article class="category-card">
          <a href="${categoryHref}" aria-label="تصفح منتجات تصنيف ${escapeHtml(category.name)}">${image ? `<img class="category-photo" data-catalog-image src="${escapeHtml(image)}" alt="${escapeHtml(category.name)}" loading="lazy">` : '<span class="category-icon" aria-hidden="true">▦</span>'}</a>
          <h3><a href="${categoryHref}">${escapeHtml(category.name)}</a></h3><p>${escapeHtml(category.description || 'استكشف المنتجات المتاحة ضمن هذا التصنيف.')}</p>
          <a class="text-link" href="${categoryHref}">تصفح المنتجات ←</a></article>`;
      }).join('');
      setImageFallbacks(host);
    });

    const select = document.querySelector('[data-category-filter]');
    if (select) {
      const chosen = new URLSearchParams(location.search).get('category');
      select.innerHTML = '<option value="all">كل الفئات</option>' + categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
      if (categories.some((category) => category.id === chosen)) select.value = chosen;
    }
  }

  function productAvailability(product) {
    const stock = Number(product.stock_quantity || 0);
    return stock > 0 ? `متوفر${stock <= 5 ? ` — الكمية المتاحة ${stock}` : ''}` : 'غير متوفر حالياً';
  }

  function productCard(product) {
    const wished = wishlistIds().includes(product.id);
    const category = categoryFor(product.category_id);
    const image = safeImageUrl(product.image_url);
    const oldPrice = product.old_price == null ? null : Number(product.old_price);
    const hasOldPrice = oldPrice !== null;
    const hasDiscount = hasOldPrice && oldPrice > Number(product.price);
    const discount = hasDiscount ? Math.round((1 - Number(product.price) / oldPrice) * 100) : 0;
    const stock = Number(product.stock_quantity || 0);
    const detailsHref = productHref(product.id);
    return `<article class="product-card" data-product-id="${escapeHtml(product.id)}">
      <div class="product-visual"><a class="product-card-visual-link" href="${detailsHref}" aria-label="عرض تفاصيل ${escapeHtml(product.name)}">${image ? `<img class="product-card-image" data-catalog-image src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : `<span class="product-glyph" aria-hidden="true">${IMAGE_FALLBACK}</span>`}</a>
        ${hasDiscount ? `<span class="tag">خصم ${discount}٪</span>` : ''}
        <button class="wish-button ${wished ? 'active' : ''}" type="button" data-wish="${escapeHtml(product.id)}" aria-label="${wished ? 'إزالة من' : 'إضافة إلى'} المفضلة" aria-pressed="${wished}">${wished ? '♥' : '♡'}</button>
      </div><div class="product-info"><span class="product-category">${escapeHtml(category?.name || '')}</span><h3><a href="${detailsHref}">${escapeHtml(product.name)}</a></h3>
        <span class="product-stock ${stock > 0 ? '' : 'out-of-stock'}">${escapeHtml(productAvailability(product))}</span>
        <div class="price">${money(product.price)}${hasOldPrice ? `<del class="old-price">${money(oldPrice)}</del>` : ''}</div><div class="product-actions"><a class="button button-small button-quiet" href="${detailsHref}">التفاصيل</a>
        <button class="button button-small" type="button" data-add="${escapeHtml(product.id)}"${stock < 1 ? ' disabled' : ''}>أضف للسلة</button></div></div></article>`;
  }

  function offerCard(offer) {
    const product = productFor(offer.product_id);
    if (!product) return '';
    const oldPrice = offer.old_price == null ? Number(product.price) : Number(offer.old_price);
    const offerPrice = offer.offer_price == null
      ? oldPrice * (100 - Number(offer.discount_percentage || 0)) / 100
      : Number(offer.offer_price);
    const image = safeImageUrl(offer.image_url) || safeImageUrl(product.image_url);
    const percent = Number(offer.discount_percentage);
    const expiry = offer.end_date
      ? `يسري حتى ${new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(offer.end_date))}`
      : 'تاريخ انتهاء العرض غير محدد';
    const detailsHref = productHref(product.id, offer.id);
    return `<article class="product-card offer-product-card">
      <div class="product-visual"><a class="product-card-visual-link" href="${detailsHref}" aria-label="عرض ${escapeHtml(offer.title)} وتفاصيل المنتج">${image ? `<img class="product-card-image" data-catalog-image src="${escapeHtml(image)}" alt="${escapeHtml(offer.title)}" loading="lazy">` : '<span class="product-glyph" aria-hidden="true">٪</span>'}</a>
        <span class="tag">خصم ${Number.isFinite(percent) ? `${percent.toLocaleString('ar')}٪` : ''}</span>
        <button class="wish-button ${wishlistIds().includes(product.id) ? 'active' : ''}" type="button" data-wish="${escapeHtml(product.id)}" aria-label="إضافة المنتج إلى المفضلة" aria-pressed="${wishlistIds().includes(product.id)}">${wishlistIds().includes(product.id) ? '♥' : '♡'}</button>
      </div><div class="product-info"><span class="product-category">${escapeHtml(product.name)}</span><h3><a href="${detailsHref}">${escapeHtml(offer.title)}</a></h3>
        <p class="offer-description">${escapeHtml(offer.description || '')}</p><small class="offer-validity">${escapeHtml(expiry)}</small>
        <div class="price">${money(offerPrice)}<del class="old-price">${money(oldPrice)}</del></div>
        <div class="product-actions"><a class="button button-small button-quiet" href="${detailsHref}">تفاصيل المنتج</a><button class="button button-small" type="button" data-add="${escapeHtml(product.id)}"${Number(product.stock_quantity) < 1 ? ' disabled' : ''}>أضف للسلة</button></div>
      </div></article>`;
  }

  function noData(host, title, description, retry = false) {
    host.innerHTML = `<div class="empty-state"><span class="empty-icon">⌕</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p>${retry ? '<button class="button button-outline" type="button" data-retry-catalog>إعادة المحاولة</button>' : ''}</div>`;
  }

  function renderProducts() {
    document.querySelectorAll('[data-products]').forEach((host) => {
      const mode = host.dataset.products;
      if (mode === 'offers') {
        if (state.offers === 'loading' || state.offers === 'idle') return noData(host, 'جارٍ تحميل العروض…', '');
        if (state.offers === 'error') return noData(host, 'تعذر تحميل العروض', 'تحقق من إعدادات اتصال المتجر ثم أعد المحاولة.', true);
        if (state.products === 'error') return noData(host, 'تعذر تحميل منتجات العروض', 'تحقق من إعدادات اتصال المتجر ثم أعد المحاولة.', true);
        const visibleOffers = offers.filter(isOfferCurrentlyValid).filter((offer) => productFor(offer.product_id));
        return visibleOffers.length
          ? (host.innerHTML = visibleOffers.map(offerCard).join(''), setImageFallbacks(host))
          : noData(host, 'لا توجد عروض متاحة حالياً', 'ستظهر العروض النشطة خلال فترة صلاحيتها هنا.');
      }
      if (state.products === 'loading' || state.products === 'idle') return noData(host, 'جارٍ تحميل المنتجات…', '');
      if (state.products === 'error') return noData(host, 'تعذر تحميل المنتجات', 'تحقق من إعدادات اتصال المتجر ثم أعد المحاولة.', true);
      let list = mode === 'featured' ? products.filter((item) => item.is_featured) : products;
      const search = document.querySelector('[data-search]');
      const filter = document.querySelector('[data-category-filter]');
      const query = (search?.value || '').trim().toLocaleLowerCase('ar');
      const selected = filter?.value || 'all';
      if (query) list = list.filter((item) => `${item.name} ${item.description || ''} ${categoryFor(item.category_id)?.name || ''}`.toLocaleLowerCase('ar').includes(query));
      if (selected !== 'all') list = list.filter((item) => item.category_id === selected);
      if (!list.length) return noData(host, query || selected !== 'all' ? 'لم نعثر على منتجات مطابقة' : 'لا توجد منتجات متاحة حالياً', query || selected !== 'all' ? 'جرّب كلمة بحث أخرى أو اختر فئة مختلفة.' : 'ستظهر المنتجات النشطة هنا عند توفرها.');
      const categoryWarning = state.categories === 'error'
        ? '<p class="local-data-notice">تعذر تحميل أسماء التصنيفات. ما زال بإمكانك تصفح المنتجات النشطة.</p>'
        : '';
      host.innerHTML = `${categoryWarning}${list.map(productCard).join('')}`;
      setImageFallbacks(host);
    });
  }

  function renderWishlist() {
    const host = document.querySelector('[data-wishlist]');
    if (!host) return;
    if (state.products === 'loading' || state.products === 'idle') return noData(host, 'جارٍ تحميل المفضلة…', '');
    if (state.products === 'error') return noData(host, 'تعذر تحميل المنتجات المحفوظة', 'تحقق من إعدادات اتصال المتجر ثم أعد المحاولة.', true);
    const ids = wishlistIds();
    const list = ids.map(productFor).filter(Boolean);
    const unavailableCount = ids.length - list.length;
    const cards = list.length ? list.map(productCard).join('') : `<div class="empty-state"><span class="empty-icon">♡</span><h2>قائمة المفضلة فارغة</h2><p>احفظ المنتجات النشطة التي ترغب بالعودة إليها.</p><a class="button" href="${href('products/index.html')}">تصفح المنتجات</a></div>`;
    host.innerHTML = `${cards}${unavailableCount ? `<div class="local-data-notice">يوجد ${unavailableCount} منتج لم يعد متاحاً. لم يتم احتسابه في المفضلة. <button class="text-link" type="button" data-remove-stale-wishlist>إزالة المنتجات غير المتاحة</button></div>` : ''}`;
    setImageFallbacks(host);
  }

  function renderCart() {
    const host = document.querySelector('[data-cart]');
    const summary = document.querySelector('[data-order-summary]');
    const stored = cartRows();
    const available = stored.map((item) => ({ item, product: productFor(item.id) }))
      .filter(({ product }) => product && Number(product.stock_quantity) > 0)
      .map(({ item, product }) => ({ item, product, qty: Math.min(item.qty, Number(product.stock_quantity), 99) }));
    const unavailableCount = stored.length - available.length;
    const total = available.reduce((sum, row) => sum + Number(row.product.price) * row.qty, 0);

    if (host) {
      if (state.products === 'loading' || state.products === 'idle') {
        noData(host, 'جارٍ تحميل السلة…', '');
      } else if (state.products === 'error') {
        noData(host, 'تعذر تحميل منتجات السلة', 'تحقق من إعدادات اتصال المتجر ثم أعد المحاولة.', true);
      } else if (!available.length) {
        host.innerHTML = `<div class="empty-state"><span class="empty-icon">🛒</span><h2>سلتك فارغة حالياً</h2><p>${unavailableCount ? 'بعض المنتجات المحفوظة لم تعد متاحة.' : 'ابدأ باكتشاف المنتجات النشطة التي تناسبك.'}</p><a class="button" href="${href('products/index.html')}">متابعة التسوق</a>${unavailableCount ? ' <button class="button button-outline" type="button" data-remove-stale-cart>إزالة المنتجات غير المتاحة</button>' : ''}</div>`;
      } else {
        const notice = unavailableCount ? `<div class="local-data-notice">تم إخفاء ${unavailableCount} منتج لم يعد متاحاً. <button class="text-link" type="button" data-remove-stale-cart>إزالة المنتجات غير المتاحة</button></div>` : '';
        host.innerHTML = `${notice}<div class="cart-layout"><div class="cart-items">${available.map(({ item, product, qty }) => {
          const category = categoryFor(product.category_id);
          const image = safeImageUrl(product.image_url);
          return `<article class="cart-row"><a class="cart-thumb" href="${productHref(product.id)}" aria-label="تفاصيل ${escapeHtml(product.name)}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : `<span aria-hidden="true">${IMAGE_FALLBACK}</span>`}</a><div class="cart-product"><h2><a href="${productHref(product.id)}">${escapeHtml(product.name)}</a></h2><span class="product-category">${escapeHtml(category?.name || '')}</span><div class="price">${money(product.price)}</div></div>
            <div class="quantity-control" aria-label="الكمية"><button type="button" data-qty="${escapeHtml(product.id)}" data-delta="-1" aria-label="تقليل الكمية">−</button><span aria-live="polite">${qty}</span><button type="button" data-qty="${escapeHtml(product.id)}" data-delta="1" aria-label="زيادة الكمية"${qty >= Number(product.stock_quantity) ? ' disabled' : ''}>+</button></div>
            <strong class="cart-line-total">${money(Number(product.price) * qty)}</strong><button class="remove-item" type="button" data-remove="${escapeHtml(product.id)}">حذف</button></article>`;
        }).join('')}</div><aside class="panel cart-summary"><h2>ملخص الطلب</h2><div class="summary-line"><span>عدد المنتجات</span><strong>${available.reduce((sum, row) => sum + row.qty, 0)}</strong></div><div class="summary-line"><span>المجموع الفرعي</span><strong>${money(total)}</strong></div><div class="summary-line summary-total"><span>الإجمالي</span><strong>${money(total)}</strong></div><a class="button" href="${href('order/index.html')}">متابعة لإتمام الطلب</a><a class="continue-link" href="${href('products/index.html')}">متابعة التسوق</a></aside></div>`;
        setImageFallbacks(host);
      }
    }
    if (summary) {
      if (state.products === 'error') summary.innerHTML = '<p>تعذر تحميل ملخص السلة حالياً.</p>';
      else if (state.products !== 'ready') summary.innerHTML = '<p>جارٍ تحميل ملخص السلة…</p>';
      else summary.innerHTML = available.length
        ? `${available.map(({ product, qty }) => `<div class="summary-line"><span>${escapeHtml(product.name)} × ${qty}</span><strong>${money(Number(product.price) * qty)}</strong></div>`).join('')}<div class="summary-line summary-total"><span>الإجمالي</span><strong>${money(total)}</strong></div>${unavailableCount ? '<p class="placeholder-note">بعض المنتجات غير المتاحة مستبعدة من الملخص.</p>' : ''}`
        : `<p>السلة فارغة. <a href="${href('products/index.html')}">تصفح المنتجات النشطة</a></p>`;
    }
    refreshCounts();
  }

  function renderDetail() {
    const host = document.querySelector('[data-product-detail]');
    if (!host) return;
    if (state.products === 'loading' || state.products === 'idle') return noData(host, 'جارٍ تحميل تفاصيل المنتج…', '');
    if (state.products === 'error') return noData(host, 'تعذر تحميل المنتج', 'تحقق من إعدادات اتصال المتجر ثم أعد المحاولة.', true);
    const parameters = new URLSearchParams(location.search);
    const selectedId = parameters.get('id');
    const selectedSlug = parameters.get('slug');
    const product = selectedId ? productFor(selectedId) : products.find((item) => item.slug === selectedSlug);
    if (!product) return noData(host, 'المنتج غير متاح', 'قد يكون الرابط غير صحيح أو أن المنتج لم يعد نشطاً.', false);
    const selectedOfferId = parameters.get('offer');
    const offer = selectedOfferId
      ? offers.find((item) => item.id === selectedOfferId && item.product_id === product.id && isOfferCurrentlyValid(item))
      : null;
    const category = categoryFor(product.category_id);
    const image = safeImageUrl(offer?.image_url) || safeImageUrl(product.image_url);
    const stock = Number(product.stock_quantity || 0);
    const oldPrice = product.old_price == null ? null : Number(product.old_price);
    const offerOldPrice = offer ? (offer.old_price == null ? Number(product.price) : Number(offer.old_price)) : null;
    const offerPrice = offer
      ? (offer.offer_price == null ? offerOldPrice * (100 - Number(offer.discount_percentage || 0)) / 100 : Number(offer.offer_price))
      : null;
    const wished = wishlistIds().includes(product.id);
    host.innerHTML = `<div class="detail-layout"><div class="detail-visual" aria-label="صورة المنتج">${image ? `<img data-catalog-image src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}">` : `<span>${IMAGE_FALLBACK}</span>`}${image ? '' : '<small>صورة المنتج</small>'}</div><div class="detail-copy">
      <a class="breadcrumb" href="${href('products/index.html')}${category ? `?category=${encodeURIComponent(category.id)}` : ''}">${escapeHtml(category?.name || 'المنتجات')} ←</a>${offer ? `<span class="eyebrow">${escapeHtml(offer.title)}</span>` : ''}<h1>${escapeHtml(product.name)}</h1>
      <div class="price detail-price">${money(offer ? offerPrice : product.price)}${offer ? `<del class="old-price">${money(offerOldPrice)}</del>` : (oldPrice !== null ? `<del class="old-price">${money(oldPrice)}</del>` : '')}</div>
      ${offer?.description ? `<p>${escapeHtml(offer.description)}</p>` : ''}
      <span class="availability ${stock > 0 ? '' : 'unavailable'}"><i></i> ${escapeHtml(productAvailability(product))}</span>
      <p>${escapeHtml(product.description || 'لا يتوفر وصف لهذا المنتج حالياً.')}</p>
      <label class="quantity-label" for="detail-quantity">الكمية</label><div class="quantity-control"><button type="button" data-detail-qty="-1" aria-label="تقليل الكمية">−</button><input id="detail-quantity" data-detail-count type="number" min="1" max="${Math.max(1, Math.min(99, stock))}" value="1" inputmode="numeric"${stock < 1 ? ' disabled' : ''}><button type="button" data-detail-qty="1" aria-label="زيادة الكمية"${stock < 1 ? ' disabled' : ''}>+</button></div>
      <div class="actions"><button class="button" type="button" data-detail-add="${escapeHtml(product.id)}"${stock < 1 ? ' disabled' : ''}>أضف إلى السلة</button><button class="button button-outline" type="button" data-wish="${escapeHtml(product.id)}" aria-pressed="${wished}">${wished ? '♥ إزالة من المفضلة' : '♡ أضف للمفضلة'}</button></div>
      </div></div>`;
    setImageFallbacks(host);
  }

  function renderOrderSummary() {
    const summary = document.querySelector('[data-order-summary]');
    if (!summary) return;
    const button = document.querySelector('[data-submit-order]');
    if (state.products === 'loading' || state.products === 'idle') {
      summary.innerHTML = '<p>جارٍ تحميل المنتجات والأسعار الحالية…</p>';
      if (button) button.disabled = true;
      return;
    }
    if (state.products === 'error') {
      summary.innerHTML = '<p>تعذر تحميل أسعار المنتجات الحالية. أعد المحاولة قبل إتمام الطلب.</p><button class="button button-outline" type="button" data-retry-catalog>إعادة المحاولة</button>';
      if (button) button.disabled = true;
      return;
    }
    const rows = cartRows();
    const entries = rows.map((item) => ({ item, product: productFor(item.id) }));
    const invalid = entries.some(({ item, product }) => !product || Number(product.stock_quantity) < 1 || item.qty > Number(product.stock_quantity));
    if (!entries.length) {
      summary.innerHTML = `<p>سلتك فارغة. <a href="${href('products/index.html')}">تصفح المنتجات النشطة</a></p>`;
      if (button) button.disabled = true;
      return;
    }
    const validEntries = entries.filter(({ item, product }) => product && Number(product.stock_quantity) > 0 && item.qty <= Number(product.stock_quantity));
    const total = validEntries.reduce((sum, { item, product }) => sum + Number(product.price) * item.qty, 0);
    summary.innerHTML = `${entries.map(({ item, product }) => {
      if (!product || Number(product.stock_quantity) < 1) return `<div class="summary-line"><span>منتج لم يعد متاحاً (${escapeHtml(item.id)})</span><strong>أزله من <a href="${href('cart/index.html')}">السلة</a></strong></div>`;
      const lineTotal = Number(product.price) * item.qty;
      const quantityNote = item.qty > Number(product.stock_quantity) ? '<small class="local-data-notice">الكمية المطلوبة تتجاوز المخزون المتاح. عدّلها من السلة.</small>' : '';
      return `<div class="summary-line checkout-summary-item"><span>${escapeHtml(product.name)} × ${item.qty}<small>سعر الوحدة: ${money(product.price)}</small>${quantityNote}</span><strong>${money(lineTotal)}</strong></div>`;
    }).join('')}<div class="summary-line summary-total"><span>إجمالي الطلب</span><strong>${money(total)}</strong></div>${invalid ? `<p class="local-data-notice">تحقق من توفر المنتجات والكميات في <a href="${href('cart/index.html')}">سلة التسوق</a> قبل الإرسال.</p>` : ''}`;
    if (button) button.disabled = invalid;
  }

  function checkoutDiagnostic(stage) {
    if (new URLSearchParams(window.location.search).get('checkout-debug') === '1') {
      console.info(`[checkout-debug] ${stage}`);
    }
  }

  function checkoutRpcErrorMessage(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toUpperCase();
    if (message.includes('INVALID_CUSTOMER_DETAILS')) return 'يرجى مراجعة الاسم ورقم الهاتف والعنوان ثم المحاولة مرة أخرى.';
    if (/INVALID_CART|INVALID_CART_ITEM|DUPLICATE_CART_ITEM/.test(message)) return 'السلة غير صالحة. راجع المنتجات والكميات ثم حاول مرة أخرى.';
    if (message.includes('PRODUCT_UNAVAILABLE_OR_STOCK_CHANGED')) return 'تغير توفر أحد المنتجات أو كميته. حدّث السلة ثم حاول مرة أخرى.';
    if (code === 'PGRST202' || code === '42883') return 'إجراء إنشاء الطلب غير متاح في قاعدة البيانات حالياً. يرجى التواصل مع المتجر.';
    if (code === '42501') return 'لا تسمح صلاحيات قاعدة البيانات بإنشاء الطلب حالياً. يرجى التواصل مع المتجر.';
    return 'تعذر إنشاء الطلب. يرجى المحاولة مرة أخرى.';
  }

  async function submitCustomerOrder(form) {
    if (form.dataset.submitting === 'true') return;
    const message = form.querySelector('[data-checkout-message]');
    const button = form.querySelector('[data-submit-order]');
    const setMessage = (text, isError = false) => {
      if (!message) return;
      message.textContent = text;
      message.classList.toggle('error-message', isError);
    };
    const fields = new FormData(form);
    const customer = {
      name: String(fields.get('name') || '').trim(),
      phone: String(fields.get('phone') || '').trim(),
      address: String(fields.get('address') || '').trim(),
      notes: String(fields.get('notes') || '').trim(),
    };
    if (!customer.name) return setMessage('يرجى إدخال الاسم الكامل.', true);
    if (!customer.phone) return setMessage('يرجى إدخال رقم الهاتف.', true);
    if (!customer.address) return setMessage('يرجى إدخال العنوان.', true);
    if (customer.name.length > 200 || customer.phone.length > 50 || customer.address.length > 1000 || customer.notes.length > 2000) return setMessage('تجاوز أحد الحقول الحد المسموح به.', true);
    if (!supabase) return setMessage('تعذر الاتصال بالمتجر. أعد تحميل الصفحة وحاول مجدداً.', true);
    const cart = cartRows();
    if (!cart.length) return setMessage('السلة فارغة. أضف المنتجات قبل إرسال الطلب.', true);
    checkoutDiagnostic('validation-passed');

    let checkoutStage = 'store-settings';
    form.dataset.submitting = 'true';
    if (button) button.disabled = true;
    if (button) button.textContent = 'جارٍ التحقق وإرسال الطلب…';
    setMessage('جارٍ التحقق من الأسعار والتوفر الحاليين…');
    try {
      await storeSettingsReady;
      checkoutStage = 'active-products-check';
      checkoutDiagnostic('active-products-check-started');
      const ids = [...new Set(cart.map((item) => item.id))];
      const { data: currentProducts, error: productsError } = await supabase.from('products')
        .select('id,name,price,stock_quantity,is_active').in('id', ids).eq('is_active', true);
      if (productsError) throw productsError;
      const currentById = new Map((currentProducts || []).map((product) => [product.id, product]));
      const displayedDetailsChanged = cart.some(({ id }) => {
        const displayed = productFor(id);
        const current = currentById.get(id);
        return current && displayed
          && (displayed.name !== current.name || Number(displayed.price) !== Number(current.price));
      });
      cart.forEach(({ id }) => {
        const cached = productFor(id);
        const fresh = currentById.get(id);
        if (cached && fresh) Object.assign(cached, fresh);
        else if (cached) { cached.is_active = false; cached.stock_quantity = 0; }
      });
      const invalid = cart.some((item) => {
        const product = currentById.get(item.id);
        return !product || !productFor(item.id) || Number(product.stock_quantity) < 1 || item.qty > Number(product.stock_quantity);
      });
      if (invalid) {
        checkoutDiagnostic('active-products-check-failed');
        setMessage('تغير توفر أحد المنتجات أو كميته. راجع السلة ثم حاول مجدداً.', true);
        renderCart();
        return;
      }
      if (displayedDetailsChanged) {
        checkoutDiagnostic('product-price-or-name-changed');
        setMessage('تغير اسم منتج أو سعره. حدّثنا الملخص؛ راجعه ثم أكد الطلب مرة أخرى.');
        renderOrderSummary();
        return;
      }
      const verifiedItems = cart.map(({ id, qty }) => ({ product: currentById.get(id), quantity: qty }));
      const verifiedTotal = verifiedItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
      checkoutStage = 'rpc';
      checkoutDiagnostic('rpc-started');
      const { data: orderId, error: orderError } = await supabase.rpc('submit_customer_order', {
        p_customer_name: customer.name,
        p_phone: customer.phone,
        p_address: customer.address,
        p_notes: customer.notes || null,
        p_items: cart.map(({ id, qty }) => ({ product_id: id, quantity: qty })),
      });
      if (orderError) {
        checkoutDiagnostic('rpc-returned-error');
        setMessage(checkoutRpcErrorMessage(orderError), true);
        return;
      }
      checkoutStage = 'rpc-response';
      if (typeof orderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        checkoutDiagnostic('rpc-response-missing-valid-uuid');
        setMessage('لم يصل تأكيد صالح لمعرّف الطلب. يرجى التواصل مع المتجر قبل إعادة المحاولة.', true);
        return;
      }
      checkoutDiagnostic('rpc-returned-order-uuid');

      const cartCleared = clearPurchasedCart(cart);
      const checkout = document.querySelector('[data-checkout]');
      const confirmation = document.querySelector('[data-order-confirmation]');
      const paymentInformation = String(storeSettings?.payment_information ?? '').trim();
      const deliveryInformation = String(storeSettings?.delivery_information ?? '').trim();
      const customerMessage = [
        'طلب جديد من باب الحارة',
        `رقم الطلب: ${orderId}`,
        '',
        'المنتجات:',
        ...verifiedItems.map(({ product, quantity }) => `${product.name} × ${quantity} — ${money(product.price)}`),
        '',
        `الإجمالي: ${money(verifiedTotal)}`,
        '',
        'بيانات العميل:',
        `الاسم: ${customer.name}`,
        `الهاتف: ${customer.phone}`,
        `العنوان: ${customer.address}`,
        paymentInformation ? `طريقة الدفع: ${paymentInformation}` : '',
        deliveryInformation ? `معلومات التوصيل: ${deliveryInformation}` : '',
      ].filter((line) => line !== '').join('\n');
      const orderWhatsAppUrl = whatsappUrl(storeSettings?.whatsapp, customerMessage);
      checkoutDiagnostic(orderWhatsAppUrl ? 'whatsapp-url-ready' : 'whatsapp-url-unavailable');
      const whatsappStatus = orderWhatsAppUrl ? '' : 'تعذر تجهيز رابط WhatsApp. يرجى التأكد من رقم WhatsApp في إعدادات المتجر.';
      if (checkout) checkout.hidden = true;
      if (confirmation) {
        confirmation.innerHTML = `<span class="empty-icon" aria-hidden="true">✓</span><h2>تم استلام طلبك بنجاح.</h2><p>رقم الطلب: <strong dir="ltr">${escapeHtml(orderId)}</strong></p><p>سنراجع طلبك ونتواصل معك بشأنه.</p>${orderWhatsAppUrl ? `<a class="button" data-order-whatsapp href="${escapeHtml(orderWhatsAppUrl)}">إرسال الطلب عبر WhatsApp</a><p class="form-note error-message" role="status" data-order-whatsapp-error hidden>${escapeHtml(whatsappStatus)}</p>` : `<p class="form-note error-message" role="status">${escapeHtml(whatsappStatus)}</p>`}${cartCleared ? '' : '<p class="local-data-notice">تعذر تحديث السلة المحفوظة في هذا المتصفح. راجع محتوياتها قبل إرسال طلب آخر.</p>'}<a class="button button-outline" href="${href('products/index.html')}">العودة إلى المتجر</a>`;
        confirmation.hidden = false;
      }
      checkoutStage = 'confirmation-rendered';
      checkoutDiagnostic('confirmation-rendered');
      refreshCounts();
    } catch {
      checkoutDiagnostic(`${checkoutStage}-failed`);
      const errorMessage = checkoutStage === 'active-products-check'
        ? 'تعذر التحقق من المنتجات والمخزون. تحقق من الاتصال ثم حاول مرة أخرى.'
        : checkoutStage === 'rpc'
          ? 'تعذر الاتصال بخدمة إنشاء الطلب. يرجى المحاولة مرة أخرى.'
          : 'تعذر إكمال الطلب. تحقق من الاتصال ثم حاول مرة أخرى.';
      setMessage(errorMessage, true);
      if (button) button.disabled = false;
    } finally {
      delete form.dataset.submitting;
      if (button && !document.querySelector('[data-order-confirmation]:not([hidden])')) button.textContent = 'تأكيد وإرسال الطلب';
      renderOrderSummary();
    }
  }

  function isOfferCurrentlyValid(offer) {
    const now = Date.now();
    const start = offer.start_date ? new Date(offer.start_date).getTime() : -Infinity;
    const end = offer.end_date ? new Date(offer.end_date).getTime() : Infinity;
    return Boolean(offer.is_active) && start <= now && end > now;
  }

  function renderAll() {
    renderCategories();
    renderProducts();
    renderWishlist();
    renderCart();
    renderDetail();
    renderOrderSummary();
    refreshCounts();
  }

  function configError(kind) {
    if (kind === 'config') return new Error('CONFIG');
    if (kind === 'sdk') return new Error('SDK');
    return new Error('DATABASE');
  }

  function createSupabaseClient() {
    if (supabase) return supabase;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') throw configError('sdk');
    const configuration = window.BAB_AL_HARA_SUPABASE_CONFIG;
    const url = configuration?.SUPABASE_URL;
    const key = configuration?.SUPABASE_ANON_KEY || configuration?.SUPABASE_PUBLISHABLE_KEY;
    if (typeof url !== 'string' || !/^https:\/\//i.test(url) || typeof key !== 'string' || !key.trim()) throw configError('config');
    if (/^sb_secret_/i.test(key)) throw configError('config');
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role === 'service_role') throw configError('config');
    } catch (error) {
      if (error.message === 'CONFIG') throw error;
      // New publishable keys are opaque and do not contain a JWT role claim.
    }
    supabase = window.supabase.createClient(url, key);
    return supabase;
  }

  async function loadStoreSettings() {
    try {
      if (!supabase) supabase = createSupabaseClient();
      const { data, error } = await supabase.from('store_settings')
        .select('store_name,store_description,whatsapp,phone,address,delivery_information,payment_information,instagram,tiktok,facebook,working_hours')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      storeSettings = data || {};
    } catch {
      storeSettings = {};
      storeSettingsLoadFailed = true;
    }
    applyStoreSettings();
  }

  let storeSettingsReady = Promise.resolve();

  async function loadProducts() {
    state.products = 'loading';
    const { data, error } = await supabase.from('products')
      .select('id,category_id,name,slug,description,price,old_price,stock_quantity,image_url,is_featured,is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    products = data || [];
    state.products = 'ready';
  }

  async function loadCategories() {
    state.categories = 'loading';
    const { data, error } = await supabase.from('categories')
      .select('id,name,slug,description,image_url,is_active')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    categories = data || [];
    state.categories = 'ready';
  }

  async function loadOffers() {
    state.offers = 'loading';
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('offers')
      .select('id,product_id,title,description,discount_percentage,old_price,offer_price,image_url,start_date,end_date,is_active')
      .eq('is_active', true)
      .lte('start_date', now)
      .or(`end_date.is.null,end_date.gt.${now}`)
      .order('start_date', { ascending: false });
    if (error) throw error;
    offers = (data || []).filter(isOfferCurrentlyValid);
    state.offers = 'ready';
  }

  async function loadCatalog() {
    const needsProducts = Boolean(document.querySelector('[data-products]:not([data-products="offers"]),[data-wishlist],[data-cart],[data-product-detail],[data-order-summary]'))
      || Boolean(document.querySelector('[data-products="offers"]'));
    const needsCategories = Boolean(document.querySelector('[data-categories]')) || needsProducts;
    const needsOffers = Boolean(document.querySelector('[data-products="offers"]'))
      || (Boolean(document.querySelector('[data-product-detail]')) && new URLSearchParams(location.search).has('offer'));
    if (!needsProducts && !needsCategories && !needsOffers) return;
    try { supabase = createSupabaseClient(); }
    catch (error) {
      if (needsProducts) state.products = 'error';
      if (needsCategories) state.categories = 'error';
      if (needsOffers) state.offers = 'error';
      renderAll();
      return;
    }
    const tasks = [];
    if (needsProducts) tasks.push(loadProducts().catch(() => { state.products = 'error'; }));
    if (needsCategories) tasks.push(loadCategories().catch(() => { state.categories = 'error'; }));
    if (needsOffers) tasks.push(loadOffers().catch(() => { state.offers = 'error'; }));
    await Promise.all(tasks);
    renderAll();
  }

  function showButtonNotice(button, message) {
    const oldLabel = button.textContent;
    button.textContent = message;
    window.setTimeout(() => { if (button.isConnected) button.textContent = oldLabel; }, 1300);
  }

  function bindEvents() {
    document.addEventListener('input', (event) => {
      if (event.target.matches('[data-search]')) renderProducts();
    });
    document.addEventListener('change', (event) => {
      if (event.target.matches('[data-category-filter]')) renderProducts();
    });
    document.addEventListener('click', (event) => {
      const whatsappLink = event.target.closest('[data-order-whatsapp]');
      if (whatsappLink) {
        event.preventDefault();
        checkoutDiagnostic('whatsapp-clicked');
        try {
          const target = new URL(whatsappLink.href);
          if (target.protocol !== 'https:' || target.hostname !== 'wa.me' || !/^\/\d{8,15}$/.test(target.pathname) || !target.searchParams.has('text')) {
            throw new Error('INVALID_WHATSAPP_URL');
          }
          // Navigate synchronously from the user's click; no async popup can be blocked.
          window.location.assign(target.href);
          checkoutDiagnostic('whatsapp-navigation-requested');
        } catch {
          const error = whatsappLink.parentElement.querySelector('[data-order-whatsapp-error]');
          if (error) {
            error.textContent = 'تعذر تجهيز رابط WhatsApp. يرجى التأكد من رقم WhatsApp في إعدادات المتجر.';
            error.hidden = false;
          }
        }
        return;
      }
      const clear = event.target.closest('[data-clear-filters]');
      if (clear) {
        const search = document.querySelector('[data-search]');
        const filter = document.querySelector('[data-category-filter]');
        if (search) search.value = '';
        if (filter) filter.value = 'all';
        renderProducts();
        return;
      }
      if (event.target.closest('[data-retry-catalog]')) { loadCatalog(); return; }
      if (event.target.closest('[data-remove-stale-cart]')) {
        const remaining = cartRows().filter((item) => {
          const product = productFor(item.id);
          return product && Number(product.stock_quantity) > 0;
        });
        write(CART_KEY, remaining);
        renderCart();
        return;
      }
      if (event.target.closest('[data-remove-stale-wishlist]')) {
        write(WISHLIST_KEY, wishlistIds().filter((id) => productFor(id)));
        renderWishlist();
        refreshCounts();
        return;
      }
      const addButton = event.target.closest('[data-add], [data-detail-add]');
      if (addButton) {
        const id = addButton.dataset.add || addButton.dataset.detailAdd;
        const product = productFor(id);
        if (!product) return showButtonNotice(addButton, 'المنتج غير متاح');
        const limit = Math.max(0, Math.min(99, Number(product.stock_quantity) || 0));
        if (!limit) return showButtonNotice(addButton, 'غير متوفر حالياً');
        const cart = cartRows();
        const existing = cart.find((item) => item.id === id);
        const requested = addButton.hasAttribute('data-detail-add') ? Math.max(1, Math.min(99, Number(document.querySelector('[data-detail-count]')?.value) || 1)) : 1;
        const current = existing?.qty || 0;
        if (current >= limit) return showButtonNotice(addButton, 'بلغت الكمية المتاحة');
        const nextQty = Math.min(limit, current + requested);
        if (existing) existing.qty = nextQty;
        else cart.push({ id, qty: nextQty });
        if (!write(CART_KEY, cart)) return showButtonNotice(addButton, 'تعذر حفظ السلة');
        renderCart();
        showButtonNotice(addButton, 'تمت الإضافة ✓');
        return;
      }
      const wishButton = event.target.closest('[data-wish]');
      if (wishButton) {
        const id = wishButton.dataset.wish;
        const wishlist = wishlistIds();
        const index = wishlist.indexOf(id);
        if (index < 0) wishlist.push(id); else wishlist.splice(index, 1);
        if (!write(WISHLIST_KEY, wishlist)) return showButtonNotice(wishButton, 'تعذر حفظ المفضلة');
        renderWishlist();
        renderProducts();
        renderDetail();
        refreshCounts();
        return;
      }
      const quantityButton = event.target.closest('[data-qty]');
      if (quantityButton) {
        const product = productFor(quantityButton.dataset.qty);
        const cart = cartRows();
        const item = cart.find((row) => row.id === quantityButton.dataset.qty);
        if (item && product) {
          const max = Math.max(0, Math.min(99, Number(product.stock_quantity) || 0));
          item.qty = Math.max(0, Math.min(max, item.qty + Number(quantityButton.dataset.delta)));
        }
        write(CART_KEY, cart.filter((row) => row.qty > 0));
        renderCart();
        return;
      }
      const removeButton = event.target.closest('[data-remove]');
      if (removeButton) {
        write(CART_KEY, cartRows().filter((item) => item.id !== removeButton.dataset.remove));
        renderCart();
        return;
      }
      const detailQuantity = event.target.closest('[data-detail-qty]');
      if (detailQuantity) {
        const input = document.querySelector('[data-detail-count]');
        const productId = document.querySelector('[data-detail-add]')?.dataset.detailAdd;
        const product = productFor(productId);
        if (input && product) input.value = Math.max(1, Math.min(Number(input.max) || 99, (Number(input.value) || 1) + Number(detailQuantity.dataset.detailQty)));
      }
    });

    document.addEventListener('submit', (event) => {
      if (event.target.matches('[data-checkout-form]')) {
        event.preventDefault();
        submitCustomerOrder(event.target);
        return;
      }
      if (!event.target.matches('[data-demo-form]')) return;
      event.preventDefault();
      const message = event.target.querySelector('[data-form-message]');
      if (message) message.textContent = 'هذه واجهة نموذجية فقط. لم يتم إرسال البيانات أو إنشاء طلب.';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderShell();
    bindEvents();
    renderCategories();
    renderProducts();
    renderWishlist();
    renderCart();
    renderDetail();
    applyStoreSettings();
    storeSettingsReady = loadStoreSettings();
    loadCatalog();
  });
})();
