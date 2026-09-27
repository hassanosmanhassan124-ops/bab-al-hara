-- Optional, clearly marked demo data. No business contact details or images included.
INSERT INTO public.categories (name, slug, description)
VALUES
    ('الهواتف الذكية', 'smartphones', 'فئة تجريبية للهواتف الذكية.'),
    ('اللابتوبات', 'laptops', 'فئة تجريبية للحواسيب المحمولة.'),
    ('الأجهزة اللوحية', 'tablets', 'فئة تجريبية للأجهزة اللوحية.'),
    ('الإكسسوارات', 'accessories', 'فئة تجريبية للإكسسوارات.'),
    ('الإلكترونيات', 'electronics', 'فئة تجريبية للإلكترونيات.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products
    (category_id, name, slug, description, price, old_price, stock_quantity, is_active, is_featured)
SELECT c.id, demo.name, demo.slug, 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.',
       demo.price, demo.old_price, 0, true, demo.is_featured
FROM (VALUES
    ('smartphones', 'هاتف ذكي تجريبي', 'demo-smartphone', 2499.00::numeric, 2899.00::numeric, true),
    ('laptops', 'حاسوب محمول تجريبي', 'demo-laptop', 4299.00::numeric, NULL::numeric, true),
    ('tablets', 'جهاز لوحي تجريبي', 'demo-tablet', 1599.00::numeric, 1799.00::numeric, true),
    ('accessories', 'سماعات لاسلكية تجريبية', 'demo-headphones', 349.00::numeric, NULL::numeric, false),
    ('electronics', 'ساعة ذكية تجريبية', 'demo-smart-watch', 699.00::numeric, 799.00::numeric, false)
) AS demo(category_slug, name, slug, price, old_price, is_featured)
JOIN public.categories AS c ON c.slug = demo.category_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.offers
    (product_id, title, description, discount_percentage, start_date, end_date, is_active)
SELECT p.id, demo.title, 'عرض تجريبي فقط.', demo.discount_percentage,
       now(), now() + interval '14 days', true
FROM (VALUES
    ('demo-smartphone', 'خصم تجريبي على هاتف ذكي', 13.80::numeric),
    ('demo-tablet', 'خصم تجريبي على جهاز لوحي', 11.12::numeric),
    ('demo-smart-watch', 'خصم تجريبي على ساعة ذكية', 12.52::numeric)
) AS demo(product_slug, title, discount_percentage)
JOIN public.products AS p ON p.slug = demo.product_slug
WHERE NOT EXISTS (
    SELECT 1 FROM public.offers AS existing
    WHERE existing.product_id = p.id AND existing.title = demo.title
);
