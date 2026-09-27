-- Idempotent Phase 10 migration for the existing store_settings singleton.
-- The boolean primary key plus CHECK (id) permits only the single id=true row.
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.store_settings FROM PUBLIC, anon, authenticated;
-- Grant only existing columns from the established public-settings allowlist.
-- This also tolerates older store_settings table versions safely.
DO $column_grants$
DECLARE
    revoke_columns text;
    public_columns text;
BEGIN
    SELECT string_agg(format('%I', actual.column_name), ', ' ORDER BY actual.ordinal_position)
      INTO revoke_columns
      FROM information_schema.columns AS actual
     WHERE actual.table_schema = 'public'
       AND actual.table_name = 'store_settings';

    SELECT string_agg(format('%I', allowed.column_name), ', ' ORDER BY allowed.ordinality)
      INTO public_columns
      FROM unnest(ARRAY[
          'id', 'store_name', 'store_description', 'logo_url', 'whatsapp', 'phone',
          'address', 'delivery_information', 'payment_information', 'instagram',
          'facebook', 'tiktok', 'working_hours'
      ]) WITH ORDINALITY AS allowed(column_name, ordinality)
      JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
       AND actual.table_name = 'store_settings'
       AND actual.column_name = allowed.column_name;

    IF revoke_columns IS NOT NULL THEN
        EXECUTE format(
            'REVOKE SELECT (%s) ON TABLE public.store_settings FROM PUBLIC, anon, authenticated',
            revoke_columns
        );
    END IF;
    IF public_columns IS NOT NULL THEN
        EXECUTE format(
            'GRANT SELECT (%s) ON TABLE public.store_settings TO anon, authenticated',
            public_columns
        );
    END IF;
END;
$column_grants$;
GRANT INSERT, UPDATE ON TABLE public.store_settings TO authenticated;

-- Remove any legacy permissive policies before applying the active-admin rules.
DO $migration$
DECLARE
    existing_policy record;
BEGIN
    FOR existing_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'store_settings'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.store_settings', existing_policy.policyname);
    END LOOP;
END;
$migration$;

CREATE POLICY store_settings_read_public
    ON public.store_settings FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY store_settings_admin_insert
    ON public.store_settings FOR INSERT TO authenticated
    WITH CHECK (
        id = true
        AND EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );

CREATE POLICY store_settings_admin_update
    ON public.store_settings FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    )
    WITH CHECK (
        id = true
        AND EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
