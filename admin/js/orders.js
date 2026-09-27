(() => {
  'use strict';

  const STATUS_LABELS = Object.freeze({
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    processing: 'قيد التجهيز',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  });
  let supabase;
  let orders = [];
  let currentOrderId = null;

  const one = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const money = (value) => `${Number(value || 0).toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

  function showMessage(message, kind = 'success') {
    const area = one('[data-orders-message]');
    if (!area) return;
    area.textContent = message;
    area.hidden = !message;
    area.classList.toggle('admin-alert-success', kind === 'success');
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || status || 'غير محدد';
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'تاريخ غير صالح' : new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  async function loadOrders() {
    const listMessage = one('[data-list-message]');
    listMessage.textContent = 'جارٍ تحميل الطلبات…';
    try {
      const { data, error } = await supabase.from('orders')
        .select('id,customer_name,phone,address,notes,total_amount,status,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      orders = data || [];
      listMessage.textContent = orders.length ? `عدد الطلبات: ${orders.length}` : '';
      renderOrders();
    } catch (error) {
      orders = [];
      listMessage.textContent = error?.status === 401 || error?.status === 403 || error?.code === '42501'
        ? 'انتهت صلاحية الجلسة أو لا تملك صلاحية عرض الطلبات.'
        : 'تعذر تحميل الطلبات. تحقق من الاتصال وسياسات قاعدة البيانات.';
      one('[data-order-list]').innerHTML = '<div class="product-empty-state">تعذر تحميل قائمة الطلبات.</div>';
    }
  }

  function renderOrders() {
    const host = one('[data-order-list]');
    const query = (one('[data-order-search]').value || '').trim().toLocaleLowerCase('ar');
    const status = one('[data-status-filter]').value;
    const filtered = orders.filter((order) => {
      const searchText = `${order.id} ${order.customer_name} ${order.phone}`.toLocaleLowerCase('ar');
      return searchText.includes(query) && (!status || order.status === status);
    });
    if (!filtered.length) {
      host.innerHTML = `<div class="product-empty-state">${query || status ? 'لا توجد طلبات تطابق عوامل البحث والتصفية.' : 'لا توجد طلبات حتى الآن.'}</div>`;
      return;
    }
    host.innerHTML = filtered.map((order) => `<article class="managed-product managed-order" data-order-id="${escapeHtml(order.id)}">
      <div class="managed-product-top"><div class="order-number-mark" aria-hidden="true">▤</div><div class="managed-product-title">
        <h3>${escapeHtml(order.customer_name)}</h3><code>${escapeHtml(order.id)}</code>
        <div class="managed-product-category">الهاتف: <bdi dir="ltr">${escapeHtml(order.phone)}</bdi></div>
      </div></div>
      <div class="managed-product-meta"><span>الإجمالي: <strong>${money(order.total_amount)}</strong></span><span>الحالة: <strong>${escapeHtml(statusLabel(order.status))}</strong></span><span>تاريخ الطلب: <strong>${escapeHtml(formatDate(order.created_at))}</strong></span></div>
      <div class="product-card-actions"><button type="button" data-view-order="${escapeHtml(order.id)}">عرض التفاصيل</button></div>
    </article>`).join('');
  }

  function itemRows(items) {
    if (!items.length) return '<tr><td colspan="4">لا توجد عناصر محفوظة لهذا الطلب.</td></tr>';
    return items.map((item) => `<tr>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${Number(item.quantity)}</td>
      <td>${money(item.unit_price)}</td>
      <td>${money(item.subtotal)}</td>
    </tr>`).join('');
  }

  async function openOrderDetails(order) {
    currentOrderId = order.id;
    const dialog = one('[data-order-dialog]');
    const host = one('[data-order-detail-content]');
    one('#order-detail-title').textContent = `الطلب ${order.id.slice(0, 8)}`;
    host.innerHTML = '<p class="order-detail-loading">جارٍ تحميل تفاصيل الطلب…</p>';
    if (!dialog.open) dialog.showModal();
    try {
      const { data, error } = await supabase.from('order_items')
        .select('id,order_id,product_name,quantity,unit_price,subtotal,created_at')
        .eq('order_id', order.id)
        .order('created_at');
      if (error) throw error;
      const items = data || [];
      const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      host.innerHTML = `<section class="order-detail-section" aria-labelledby="customer-order-info"><h3 id="customer-order-info">معلومات العميل</h3>
          <dl class="order-customer-grid"><div><dt>الاسم</dt><dd>${escapeHtml(order.customer_name)}</dd></div><div><dt>الهاتف</dt><dd><bdi dir="ltr">${escapeHtml(order.phone)}</bdi></dd></div>
          <div><dt>البريد الإلكتروني</dt><dd>غير متوفر في بيانات الطلب</dd></div><div><dt>العنوان</dt><dd>${escapeHtml(order.address)}</dd></div>
          <div class="order-notes"><dt>ملاحظات التوصيل</dt><dd>${escapeHtml(order.notes || 'لا توجد ملاحظات')}</dd></div><div><dt>تاريخ الطلب</dt><dd>${escapeHtml(formatDate(order.created_at))}</dd></div></dl>
        </section>
        <section class="order-detail-section" aria-labelledby="order-items-title"><h3 id="order-items-title">عناصر الطلب</h3>
          <div class="order-items-table-wrap"><table class="order-items-table"><thead><tr><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${itemRows(items)}</tbody></table></div>
        </section>
        <section class="order-detail-section order-total-section" aria-labelledby="order-totals-title"><h3 id="order-totals-title">الإجماليات</h3>
          <dl><div><dt>المجموع الفرعي للعناصر</dt><dd>${money(subtotal)}</dd></div><div><dt>رسوم التوصيل</dt><dd>غير متاحة في مخطط الطلبات</dd></div><div class="order-grand-total"><dt>الإجمالي المسجل للطلب</dt><dd>${money(order.total_amount)}</dd></div></dl>
        </section>
        <form class="order-status-form" data-order-status-form><label class="admin-field"><span>حالة الطلب</span><select name="status" data-order-status>${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}"${value === order.status ? ' selected' : ''}>${label}</option>`).join('')}</select></label><button class="admin-button" type="submit" data-save-order-status>حفظ الحالة</button></form>`;
      one('[data-order-status-form]').addEventListener('submit', (event) => updateOrderStatus(event, order));
    } catch {
      host.innerHTML = '<p class="admin-alert">تعذر تحميل عناصر الطلب. تحقق من صلاحيات قراءة order_items.</p>';
    }
  }

  async function updateOrderStatus(event, order) {
    event.preventDefault();
    const select = one('[data-order-status]');
    const nextStatus = select.value;
    if (!Object.hasOwn(STATUS_LABELS, nextStatus)) {
      showMessage('حالة الطلب المحددة غير مدعومة.', 'error');
      return;
    }
    if (nextStatus === order.status) {
      showMessage('حالة الطلب لم تتغير.', 'error');
      return;
    }
    if (!window.confirm(`هل تريد تغيير حالة الطلب إلى «${statusLabel(nextStatus)}»؟`)) return;
    const button = one('[data-save-order-status]');
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ…';
    try {
      const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id).select('id,status').single();
      if (error) throw error;
      const updated = orders.find((item) => item.id === order.id);
      if (updated) updated.status = nextStatus;
      showMessage('تم تحديث حالة الطلب.');
      renderOrders();
      const refreshed = orders.find((item) => item.id === order.id);
      if (refreshed && currentOrderId === order.id) await openOrderDetails(refreshed);
    } catch (error) {
      showMessage(error?.status === 401 || error?.status === 403 || error?.code === '42501'
        ? 'انتهت صلاحية الجلسة أو لا تملك صلاحية تحديث حالة الطلب.'
        : 'تعذر تحديث حالة الطلب. تحقق من سياسات قاعدة البيانات ثم حاول مرة أخرى.', 'error');
    } finally {
      const activeButton = one('[data-save-order-status]');
      if (activeButton) { activeButton.disabled = false; activeButton.textContent = 'حفظ الحالة'; }
    }
  }

  function bindEvents() {
    one('[data-order-search]').addEventListener('input', renderOrders);
    one('[data-status-filter]').addEventListener('change', renderOrders);
    one('[data-order-list]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-view-order]');
      if (!button) return;
      const order = orders.find((item) => item.id === button.dataset.viewOrder);
      if (order) openOrderDetails(order);
    });
    one('[data-close-order]').addEventListener('click', () => one('[data-order-dialog]').close());
    one('[data-order-dialog]').addEventListener('close', () => { currentOrderId = null; });
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
      await loadOrders();
    } catch {
      await window.BabAdminAuth.signOutQuietly();
      window.location.replace('login.html?reason=authorization-check');
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
