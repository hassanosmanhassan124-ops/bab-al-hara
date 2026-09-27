-- Optional production cleanup for rows matching the exact demo seeds in
-- seed.sql and demo-products.sql. Review before running; this file is never
-- executed automatically. It does not modify Store Settings, orders, or
-- order_items. Products referenced by any order_items row are retained.
--
-- The exclusive locks serialize cleanup against product checkout/admin writes
-- so a checkout cannot add an order_item while a demo product is being tested
-- for historical references. Keep this maintenance transaction short.
BEGIN;

LOCK TABLE public.products, public.offers, public.categories,
           public.orders, public.order_items IN EXCLUSIVE MODE;

-- Remove only the three exact offers from seed.sql and five exact offers from
-- demo-products.sql. The product identity and demo description must also match.
WITH demo_offers(product_slug, product_name, product_description, title, offer_description) AS (
    VALUES
      ('demo-smartphone', 'هاتف ذكي تجريبي', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.', 'خصم تجريبي على هاتف ذكي', 'عرض تجريبي فقط.'),
      ('demo-tablet', 'جهاز لوحي تجريبي', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.', 'خصم تجريبي على جهاز لوحي', 'عرض تجريبي فقط.'),
      ('demo-smart-watch', 'ساعة ذكية تجريبية', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.', 'خصم تجريبي على ساعة ذكية', 'عرض تجريبي فقط.'),
      ('demo-v2-iphone-15-pro', 'iPhone 15 Pro', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.', 'عرض تجريبي على iPhone 15 Pro', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.'),
      ('demo-v2-samsung-galaxy-s24', 'Samsung Galaxy S24', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.', 'عرض تجريبي على Samsung Galaxy S24', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.'),
      ('demo-v2-airpods-pro', 'AirPods Pro', 'سماعات لاسلكية تجريبية للمعاينة فقط؛ الصورة توضيحية.', 'عرض تجريبي على AirPods Pro', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.'),
      ('demo-v2-usbc-fast-charger-30w', 'شاحن USB-C سريع 30W', 'شاحن تجريبي للمعاينة فقط؛ الصورة تعرض شاحنين بقدرة 30 واط.', 'عرض تجريبي على شاحن USB-C سريع', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.'),
      ('demo-v2-power-bank-20000mah', 'باور بانك 20000mAh', 'بطارية متنقلة تجريبية للمعاينة فقط؛ السعة في الاسم لغرض العرض.', 'عرض تجريبي على الباور بانك', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.')
)
DELETE FROM public.offers AS offer
USING public.products AS product, demo_offers AS demo
WHERE offer.product_id = product.id
  AND product.slug = demo.product_slug
  AND product.name = demo.product_name
  AND product.description = demo.product_description
  AND offer.title = demo.title
  AND offer.description = demo.offer_description;

-- Delete only the five old seed products and twelve v2 demo products. Any
-- product used by an order item or any remaining offer is preserved.
WITH demo_products(slug, name, description) AS (
    VALUES
      ('demo-smartphone', 'هاتف ذكي تجريبي', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.'),
      ('demo-laptop', 'حاسوب محمول تجريبي', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.'),
      ('demo-tablet', 'جهاز لوحي تجريبي', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.'),
      ('demo-headphones', 'سماعات لاسلكية تجريبية', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.'),
      ('demo-smart-watch', 'ساعة ذكية تجريبية', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.'),
      ('demo-v2-iphone-15-pro', 'iPhone 15 Pro', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.'),
      ('demo-v2-iphone-14', 'iPhone 14', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 128 جيجابايت.'),
      ('demo-v2-samsung-galaxy-s24', 'Samsung Galaxy S24', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.'),
      ('demo-v2-samsung-galaxy-a55', 'Samsung Galaxy A55', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.'),
      ('demo-v2-xiaomi-redmi-note-13', 'Xiaomi Redmi Note 13', 'هاتف من فئة Redmi Note؛ الصورة توضيحية تجريبية وليست صورة المخزون الفعلي.'),
      ('demo-v2-ipad-10th-generation', 'iPad الجيل العاشر', 'جهاز لوحي تجريبي للمعاينة فقط، بسعة تخزين 64 جيجابايت.'),
      ('demo-v2-samsung-galaxy-tab-a9', 'Samsung Galaxy Tab A9', 'جهاز لوحي تجريبي للمعاينة فقط، بسعة تخزين 128 جيجابايت.'),
      ('demo-v2-apple-watch-series', 'Apple Watch Series', 'ساعة ذكية تجريبية للمعاينة فقط؛ الطراز المعروض توضيحي.'),
      ('demo-v2-airpods-pro', 'AirPods Pro', 'سماعات لاسلكية تجريبية للمعاينة فقط؛ الصورة توضيحية.'),
      ('demo-v2-wireless-headphones', 'سماعة رأس لاسلكية', 'سماعة رأس لاسلكية تجريبية للمعاينة فقط، مع عزل للضوضاء.'),
      ('demo-v2-usbc-fast-charger-30w', 'شاحن USB-C سريع 30W', 'شاحن تجريبي للمعاينة فقط؛ الصورة تعرض شاحنين بقدرة 30 واط.'),
      ('demo-v2-power-bank-20000mah', 'باور بانك 20000mAh', 'بطارية متنقلة تجريبية للمعاينة فقط؛ السعة في الاسم لغرض العرض.')
)
DELETE FROM public.products AS product
USING demo_products AS demo
WHERE product.slug = demo.slug
  AND product.name = demo.name
  AND product.description = demo.description
  AND NOT EXISTS (
      SELECT 1
      FROM public.order_items AS item
      WHERE item.product_id = product.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.offers AS offer
      WHERE offer.product_id = product.id
  );

-- The seed files overlap on smartphones, tablets, and accessories. Accept only
-- the exact demo descriptions from either seed, and only when the category is
-- unused. A conflicting real category is left untouched by ON CONFLICT seeds.
WITH demo_categories(slug, name, description) AS (
    VALUES
      ('smartphones', 'الهواتف الذكية', 'فئة تجريبية للهواتف الذكية.'),
      ('smartphones', 'الهواتف الذكية', 'هواتف ذكية — تصنيف تجريبي للمعاينة.'),
      ('laptops', 'اللابتوبات', 'فئة تجريبية للحواسيب المحمولة.'),
      ('tablets', 'الأجهزة اللوحية', 'فئة تجريبية للأجهزة اللوحية.'),
      ('tablets', 'الأجهزة اللوحية', 'أجهزة لوحية — تصنيف تجريبي للمعاينة.'),
      ('accessories', 'الإكسسوارات', 'فئة تجريبية للإكسسوارات.'),
      ('accessories', 'الإكسسوارات', 'ملحقات الهواتف — تصنيف تجريبي للمعاينة.'),
      ('electronics', 'الإلكترونيات', 'فئة تجريبية للإلكترونيات.'),
      ('iphones', 'آيفون', 'هواتف iPhone — تصنيف تجريبي للمعاينة.'),
      ('samsung', 'سامسونج', 'هواتف وأجهزة Samsung — تصنيف تجريبي للمعاينة.'),
      ('audio', 'الصوتيات', 'سماعات وأجهزة صوتية — تصنيف تجريبي للمعاينة.'),
      ('smart-watches', 'الساعات الذكية', 'ساعات ذكية — تصنيف تجريبي للمعاينة.')
)
DELETE FROM public.categories AS category
USING demo_categories AS demo
WHERE category.slug = demo.slug
  AND category.name = demo.name
  AND category.description = demo.description
  AND NOT EXISTS (
      SELECT 1
      FROM public.products AS product
      WHERE product.category_id = category.id
  );

COMMIT;
