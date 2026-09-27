-- Seed the supplied contact details only when the singleton is absent.
-- Uses established columns only; never adds columns or overwrites saved settings.
INSERT INTO public.store_settings (
    id, store_name, phone, address, tiktok
)
VALUES (
    true,
    'Bab Alhara Egypt',
    '01200001193',
    'القاهرة، المهندسين، 50 شارع شهاب',
    'https://www.tiktok.com/@babalharaeg'
)
ON CONFLICT (id) DO NOTHING;
