-- Phase 5 migration for an existing Bab Al-Hara Supabase database.
-- Uses the existing public.categories table and product-images bucket.
-- Run admin-setup.sql first if public.admin_users does not exist.

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Keep public category reads active-only; authenticated active admins can see all rows.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.categories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;

DROP POLICY IF EXISTS categories_admin_read_all ON public.categories;
DROP POLICY IF EXISTS categories_admin_insert ON public.categories;
DROP POLICY IF EXISTS categories_admin_update ON public.categories;
DROP POLICY IF EXISTS categories_admin_delete ON public.categories;

CREATE POLICY categories_admin_read_all
    ON public.categories FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY categories_admin_insert
    ON public.categories FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY categories_admin_update
    ON public.categories FOR UPDATE TO authenticated
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
CREATE POLICY categories_admin_delete
    ON public.categories FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );

-- The existing product-images bucket is public-read with active-admin-only writes
-- from the Phase 4C product-management migration; category images use that policy.
-- Repeat the same bucket-scoped policies here so this migration also provisions
-- category uploads on projects that have not yet applied the Phase 4C migration.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images', 'product-images', true, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_public_read
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'product-images');

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

-- The products.category_id foreign key uses ON DELETE RESTRICT, so PostgreSQL
-- rejects deletion if any product still references the category.
