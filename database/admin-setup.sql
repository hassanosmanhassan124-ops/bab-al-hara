-- Phase 4B migration for projects that have already run schema.sql before admin_users existed.
-- This migration adds authorization only. It creates no Auth users and stores no passwords.

CREATE TABLE IF NOT EXISTS public.admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL CHECK (length(trim(email)) > 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS admin_users_set_updated_at ON public.admin_users;
CREATE TRIGGER admin_users_set_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_users FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

DROP POLICY IF EXISTS admin_users_read_own_active ON public.admin_users;
CREATE POLICY admin_users_read_own_active
    ON public.admin_users FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND is_active);

-- Provisioning steps (perform through Supabase Dashboard, not the storefront):
-- 1. In Authentication > Users, create/invite the admin user manually.
-- 2. Copy that user's UUID and email from the user details.
-- 3. Replace the placeholders below, uncomment, and run as the project owner.
-- INSERT INTO public.admin_users (user_id, email, is_active)
-- VALUES ('<AUTH_USER_UUID>'::uuid, '<ADMIN_EMAIL>', true);
--
-- To disable an administrator later, run as the project owner:
-- UPDATE public.admin_users SET is_active = false WHERE user_id = '<AUTH_USER_UUID>'::uuid;
