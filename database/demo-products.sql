-- Bab Al-Hara Egypt: additive, repeatable demo catalog for storefront previews.
-- DEMO ONLY: these are not real inventory or prices. This script never updates
-- or deletes existing catalog rows. Run in Supabase SQL Editor as database owner.
-- Product photos are public Wikimedia Commons Special:FilePath URLs; this is
-- temporary remote preview media (no Storage upload or policy change required).

BEGIN;

-- Reuse existing categories by slug. Missing demo categories are added only.
INSERT INTO public.categories (name, slug, description, is_active)
VALUES
    ('الهواتف الذكية', 'smartphones', 'هواتف ذكية — تصنيف تجريبي للمعاينة.', true),
    ('آيفون', 'iphones', 'هواتف iPhone — تصنيف تجريبي للمعاينة.', true),
    ('سامسونج', 'samsung', 'هواتف وأجهزة Samsung — تصنيف تجريبي للمعاينة.', true),
    ('الأجهزة اللوحية', 'tablets', 'أجهزة لوحية — تصنيف تجريبي للمعاينة.', true),
    ('الإكسسوارات', 'accessories', 'ملحقات الهواتف — تصنيف تجريبي للمعاينة.', true),
    ('الصوتيات', 'audio', 'سماعات وأجهزة صوتية — تصنيف تجريبي للمعاينة.', true),
    ('الساعات الذكية', 'smart-watches', 'ساعات ذكية — تصنيف تجريبي للمعاينة.', true)
ON CONFLICT (slug) DO NOTHING;

-- Fresh demo product slugs make this seed independent of the older seed.sql.
-- Prices are sample values and follow the storefront's existing currency display.
INSERT INTO public.products
    (category_id, name, slug, description, price, old_price, stock_quantity,
     image_url, is_active, is_featured)
SELECT c.id, d.name, d.slug, d.description, d.price, d.old_price, d.stock,
       d.image_url, true, d.is_featured
FROM (VALUES
    ('iphones', 'iPhone 15 Pro', 'demo-v2-iphone-15-pro', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.', 49999.00::numeric, NULL::numeric, 8, 'https://commons.wikimedia.org/wiki/Special:FilePath/IPhone_15_pro.png?width=900', true),
    ('iphones', 'iPhone 14', 'demo-v2-iphone-14', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 128 جيجابايت.', 29999.00::numeric, NULL::numeric, 11, 'https://commons.wikimedia.org/wiki/Special:FilePath/IPhone_14_20240225.jpg?width=900', true),
    ('samsung', 'Samsung Galaxy S24', 'demo-v2-samsung-galaxy-s24', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.', 36999.00::numeric, NULL::numeric, 7, 'https://commons.wikimedia.org/wiki/Special:FilePath/Samsung_Galaxy_S24.jpg?width=900', true),
    ('samsung', 'Samsung Galaxy A55', 'demo-v2-samsung-galaxy-a55', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.', 16999.00::numeric, 18999.00::numeric, 14, 'https://commons.wikimedia.org/wiki/Special:FilePath/Galaxy_A55.jpg?width=900', false),
    ('smartphones', 'Xiaomi Redmi Note 13', 'demo-v2-xiaomi-redmi-note-13', 'هاتف من فئة Redmi Note؛ الصورة توضيحية تجريبية وليست صورة المخزون الفعلي.', 9999.00::numeric, 10999.00::numeric, 18, 'https://commons.wikimedia.org/wiki/Special:FilePath/Xiaomi_Redmi_Note.JPG?width=900', true),
    ('tablets', 'iPad الجيل العاشر', 'demo-v2-ipad-10th-generation', 'جهاز لوحي تجريبي للمعاينة فقط، بسعة تخزين 64 جيجابايت.', 19999.00::numeric, NULL::numeric, 6, 'https://commons.wikimedia.org/wiki/Special:FilePath/IPad_10.png?width=900', true),
    ('tablets', 'Samsung Galaxy Tab A9', 'demo-v2-samsung-galaxy-tab-a9', 'جهاز لوحي تجريبي للمعاينة فقط، بسعة تخزين 128 جيجابايت.', 8999.00::numeric, 9999.00::numeric, 9, 'https://commons.wikimedia.org/wiki/Special:FilePath/20251110_181425_Samsung_Galaxy_Tab_A9_Front.jpg?width=900', false),
    ('smart-watches', 'Apple Watch Series', 'demo-v2-apple-watch-series', 'ساعة ذكية تجريبية للمعاينة فقط؛ الطراز المعروض توضيحي.', 14999.00::numeric, 16999.00::numeric, 5, 'https://commons.wikimedia.org/wiki/Special:FilePath/Apple_Watch.jpg?width=900', true),
    ('audio', 'AirPods Pro', 'demo-v2-airpods-pro', 'سماعات لاسلكية تجريبية للمعاينة فقط؛ الصورة توضيحية.', 14999.00::numeric, NULL::numeric, 12, 'https://commons.wikimedia.org/wiki/Special:FilePath/AirPod_pro.jpg?width=900', true),
    ('audio', 'سماعة رأس لاسلكية', 'demo-v2-wireless-headphones', 'سماعة رأس لاسلكية تجريبية للمعاينة فقط، مع عزل للضوضاء.', 4999.00::numeric, NULL::numeric, 10, 'https://commons.wikimedia.org/wiki/Special:FilePath/Earfun_wireless_black_headphones,_September_2024_10.jpg?width=900', false),
    ('accessories', 'شاحن USB-C سريع 30W', 'demo-v2-usbc-fast-charger-30w', 'شاحن تجريبي للمعاينة فقط؛ الصورة تعرض شاحنين بقدرة 30 واط.', 1099.00::numeric, NULL::numeric, 25, 'https://commons.wikimedia.org/wiki/Special:FilePath/Silicon_vs_GaN_30W_USB-C_chargers.jpg?width=900', false),
    ('accessories', 'باور بانك 20000mAh', 'demo-v2-power-bank-20000mah', 'بطارية متنقلة تجريبية للمعاينة فقط؛ السعة في الاسم لغرض العرض.', 1799.00::numeric, NULL::numeric, 20, 'https://commons.wikimedia.org/wiki/Special:FilePath/USB_power_bank.jpg?width=900', false)
) AS d(category_slug, name, slug, description, price, old_price, stock, image_url, is_featured)
JOIN public.categories AS c ON c.slug = d.category_slug
ON CONFLICT (slug) DO NOTHING;

-- Use the original offers columns only. Offer pages derive the discounted price
-- from products.price + discount_percentage when optional snapshots are absent.
-- No existing offer is replaced or disabled; product image is used as fallback.
INSERT INTO public.offers
    (product_id, title, description, discount_percentage,
     start_date, end_date, is_active)
SELECT p.id, d.title, 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.',
       d.discount_percentage, now(), now() + interval '30 days', true
FROM (VALUES
    ('demo-v2-iphone-15-pro', 'عرض تجريبي على iPhone 15 Pro', 14.00::numeric),
    ('demo-v2-samsung-galaxy-s24', 'عرض تجريبي على Samsung Galaxy S24', 18.92::numeric),
    ('demo-v2-airpods-pro', 'عرض تجريبي على AirPods Pro', 26.67::numeric),
    ('demo-v2-usbc-fast-charger-30w', 'عرض تجريبي على شاحن USB-C سريع', 31.85::numeric),
    ('demo-v2-power-bank-20000mah', 'عرض تجريبي على الباور بانك', 30.57::numeric)
) AS d(product_slug, title, discount_percentage)
JOIN public.products AS p ON p.slug = d.product_slug
WHERE NOT EXISTS (
    SELECT 1 FROM public.offers AS existing
    WHERE existing.product_id = p.id AND existing.title = d.title
);

COMMIT;
