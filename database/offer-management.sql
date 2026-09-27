-- Phase 6 migration for an existing Bab Al-Hara Supabase database.
-- Run admin-setup.sql first if public.admin_users does not exist.
-- Uses the existing public.offers table and product-images bucket.

ALTER TABLE public.offers
    ADD COLUMN IF NOT EXISTS old_price numeric(12, 2),
    ADD COLUMN IF NOT EXISTS offer_price numeric(12, 2),
    ADD COLUMN IF NOT EXISTS image_url text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.offers'::regclass
          AND conname = 'offers_valid_price_snapshot'
    ) THEN
        ALTER TABLE public.offers
            ADD CONSTRAINT offers_valid_price_snapshot CHECK (
                (old_price IS NULL OR old_price >= 0)
                AND (offer_price IS NULL OR offer_price >= 0)
                AND (old_price IS NULL OR offer_price IS NULL OR old_price >= offer_price)
            );
    END IF;
END $$;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.offers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.offers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.offers TO authenticated;

DROP POLICY IF EXISTS offers_read_active_current ON public.offers;
DROP POLICY IF EXISTS offers_admin_read_all ON public.offers;
DROP POLICY IF EXISTS offers_admin_insert ON public.offers;
DROP POLICY IF EXISTS offers_admin_update ON public.offers;
DROP POLICY IF EXISTS offers_admin_delete ON public.offers;

CREATE POLICY offers_read_active_current
    ON public.offers FOR SELECT TO anon, authenticated
    USING (
        is_active
        AND start_date <= now()
        AND (end_date IS NULL OR end_date > now())
    );
CREATE POLICY offers_admin_read_all
    ON public.offers FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY offers_admin_insert
    ON public.offers FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY offers_admin_update
    ON public.offers FOR UPDATE TO authenticated
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
CREATE POLICY offers_admin_delete
    ON public.offers FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );

-- Reuse product-images; public reads are allowed, writes only for active admins.
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
