-- Phase 7 migration for an existing Bab Al-Hara Supabase database.
-- Run admin-setup.sql first if public.admin_users does not exist.
-- This migration intentionally leaves existing INSERT grants and policies untouched
-- so a separately configured customer order-creation flow is not disabled.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Never expose order/customer data to anon or PUBLIC. Authenticated reads are
-- further limited by RLS to active administrators.
REVOKE SELECT ON TABLE public.orders, public.order_items FROM PUBLIC, anon, authenticated;
REVOKE SELECT (id, customer_name, phone, address, notes, total_amount, status, created_at, updated_at)
    ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE SELECT (id, order_id, product_id, product_name, quantity, unit_price, subtotal, created_at)
    ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.orders, public.order_items TO authenticated;

-- Admins may change status only. Do not grant updates to customer, total, or item data.
REVOKE UPDATE, DELETE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, customer_name, phone, address, notes, total_amount, status, created_at, updated_at)
    ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status) ON TABLE public.orders TO authenticated;
REVOKE UPDATE, DELETE ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, order_id, product_id, product_name, quantity, unit_price, subtotal, created_at)
    ON TABLE public.order_items FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS orders_admin_read_all ON public.orders;
DROP POLICY IF EXISTS orders_admin_update_status ON public.orders;
DROP POLICY IF EXISTS order_items_admin_read_related ON public.order_items;

CREATE POLICY orders_admin_read_all
    ON public.orders FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY orders_admin_update_status
    ON public.orders FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY order_items_admin_read_related
    ON public.order_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders AS customer_order
            WHERE customer_order.id = order_items.order_id
              AND EXISTS (
                  SELECT 1 FROM public.admin_users AS admin
                  WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
              )
        )
    );
