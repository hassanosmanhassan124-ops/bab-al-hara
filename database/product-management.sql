-- Phase 4C migration for an existing project.
-- Run admin-setup.sql first if public.admin_users does not exist.

-- Customers keep active-product reads. Only active admin_users records can mutate products.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;

DROP POLICY IF EXISTS products_admin_read_all ON public.products;
DROP POLICY IF EXISTS products_admin_insert ON public.products;
DROP POLICY IF EXISTS products_admin_update ON public.products;
DROP POLICY IF EXISTS products_admin_delete ON public.products;

CREATE POLICY products_admin_read_all
    ON public.products FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY products_admin_insert
    ON public.products FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY products_admin_update
    ON public.products FOR UPDATE TO authenticated
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
CREATE POLICY products_admin_delete
    ON public.products FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );

-- Storage is public-read through the existing product_images_public_read policy.
-- No write policy applies to anon; authenticated writes are gated by active admin membership.
DROP POLICY IF EXISTS product_images_admin_insert ON storage.objects;
DROP POLICY IF EXISTS product_images_admin_update ON storage.objects;
DROP POLICY IF EXISTS product_images_admin_delete ON storage.objects;

CREATE POLICY product_images_admin_insert
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'product-images'
        AND EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY product_images_admin_update
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'product-images'
        AND EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    )
    WITH CHECK (
        bucket_id = 'product-images'
        AND EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY product_images_admin_delete
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'product-images'
        AND EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );

REVOKE INSERT, UPDATE, DELETE ON TABLE storage.objects FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE storage.objects TO authenticated;
