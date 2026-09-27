-- READ-ONLY preview for production-cleanup.sql.
-- This query mirrors its exact demo identity checks and execution order:
-- offers first, eligible products second, then unused demo categories.
-- It performs SELECTs only; it does not modify or lock any table.
-- Run only in a Supabase SQL Editor session that is authorized to read
-- order_items. Do not weaken RLS or use a service_role key for this preview.

WITH
demo_offers(product_slug, product_name, product_description, title, offer_description) AS (
    VALUES
      ('demo-smartphone', 'هاتف ذكي تجريبي', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.', 'خصم تجريبي على هاتف ذكي', 'عرض تجريبي فقط.'),
      ('demo-tablet', 'جهاز لوحي تجريبي', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.', 'خصم تجريبي على جهاز لوحي', 'عرض تجريبي فقط.'),
      ('demo-smart-watch', 'ساعة ذكية تجريبية', 'بيانات منتج تجريبية — تستبدل بتفاصيل المنتج الفعلية.', 'خصم تجريبي على ساعة ذكية', 'عرض تجريبي فقط.'),
      ('demo-v2-iphone-15-pro', 'iPhone 15 Pro', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.', 'عرض تجريبي على iPhone 15 Pro', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.'),
      ('demo-v2-samsung-galaxy-s24', 'Samsung Galaxy S24', 'هاتف تجريبي للمعاينة فقط، بسعة تخزين 256 جيجابايت.', 'عرض تجريبي على Samsung Galaxy S24', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.'),
      ('demo-v2-airpods-pro', 'AirPods Pro', 'سماعات لاسلكية تجريبية للمعاينة فقط؛ الصورة توضيحية.', 'عرض تجريبي على AirPods Pro', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.'),
      ('demo-v2-usbc-fast-charger-30w', 'شاحن USB-C سريع 30W', 'شاحن تجريبي للمعاينة فقط؛ الصورة تعرض شاحنين بقدرة 30 واط.', 'عرض تجريبي على شاحن USB-C سريع', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.'),
      ('demo-v2-power-bank-20000mah', 'باور بانك 20000mAh', 'بطارية متنقلة تجريبية للمعاينة فقط؛ السعة في الاسم لغرض العرض.', 'عرض تجريبي على الباور بانك', 'عرض تجريبي للمعاينة فقط — ليس عرضاً تجارياً حقيقياً.')
),
demo_products(slug, name, description) AS (
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
),
demo_categories(slug, name, description) AS (
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
),
matched_demo_offers AS (
    SELECT o.id, o.product_id, o.title, p.slug AS product_slug
    FROM public.offers AS o
    JOIN public.products AS p ON p.id = o.product_id
    JOIN demo_offers AS d
      ON p.slug = d.product_slug
     AND p.name = d.product_name
     AND p.description = d.product_description
     AND o.title = d.title
     AND o.description = d.offer_description
),
matched_demo_products AS (
    SELECT p.id, p.category_id, p.name, p.slug, p.description, p.price,
           p.stock_quantity, c.name AS category_name,
           EXISTS (
               SELECT 1 FROM public.order_items AS oi
               WHERE oi.product_id = p.id
           ) AS has_order_history,
           EXISTS (
               SELECT 1 FROM public.offers AS o
               WHERE o.product_id = p.id
                 AND NOT EXISTS (
                     SELECT 1 FROM matched_demo_offers AS doomed
                     WHERE doomed.id = o.id
                 )
           ) AS has_offer_retained
    FROM public.products AS p
    JOIN demo_products AS d
      ON p.slug = d.slug AND p.name = d.name AND p.description = d.description
    LEFT JOIN public.categories AS c ON c.id = p.category_id
),
product_preview AS (
    SELECT p.*,
           CASE
             WHEN p.has_order_history THEN 'PROTECTED'
             WHEN p.has_offer_retained THEN 'KEEP'
             ELSE 'DELETE CANDIDATE'
           END AS disposition,
           CASE
             WHEN p.has_order_history THEN 'PROTECTED BY ORDER HISTORY'
             WHEN p.has_offer_retained THEN 'KEEP — linked to an offer not matched for deletion'
             ELSE 'Matches cleanup identity; no order item or retained offer found'
           END AS reason
    FROM matched_demo_products AS p
),
category_preview AS (
    SELECT c.id, c.name, c.slug, c.description,
           CASE
             WHEN NOT EXISTS (
                 SELECT 1 FROM public.products AS p
                 WHERE p.category_id = c.id
                   AND NOT EXISTS (
                       SELECT 1 FROM product_preview AS pp
                       WHERE pp.id = p.id
                         AND pp.disposition = 'DELETE CANDIDATE'
                   )
             ) THEN 'DELETE CANDIDATE'
             ELSE 'KEEP'
           END AS disposition
    FROM public.categories AS c
    JOIN demo_categories AS d
      ON c.slug = d.slug AND c.name = d.name AND c.description = d.description
),
offer_preview AS (
    SELECT o.id, o.title, o.product_id, p.slug AS product_slug,
           CASE WHEN m.id IS NOT NULL THEN 'DELETE CANDIDATE' ELSE 'KEEP' END AS disposition,
           CASE WHEN m.id IS NOT NULL THEN 'Exact offer and product identity match'
                ELSE 'Not matched by cleanup identity'
           END AS reason
    FROM public.offers AS o
    LEFT JOIN matched_demo_offers AS m ON m.id = o.id
    LEFT JOIN public.products AS p ON p.id = o.product_id
)
SELECT 'CATEGORY'::text AS record_type, cp.disposition,
       cp.id, cp.name, cp.slug, cp.description,
       NULL::numeric AS price, NULL::integer AS stock,
       NULL::text AS category, NULL::uuid AS product_id,
       NULL::text AS order_history_status, NULL::text AS reason
FROM category_preview AS cp
UNION ALL
SELECT 'PRODUCT', pp.disposition,
       pp.id, pp.name, pp.slug, pp.description,
       pp.price, pp.stock_quantity AS stock,
       pp.category_name AS category, NULL::uuid AS product_id,
       CASE WHEN pp.has_order_history THEN 'PROTECTED BY ORDER HISTORY' ELSE 'NO ORDER ITEM FOUND' END,
       pp.reason
FROM product_preview AS pp
UNION ALL
SELECT 'OFFER', op.disposition,
       op.id, op.title AS name, op.product_slug AS slug, NULL::text AS description,
       NULL::numeric AS price, NULL::integer AS stock,
       NULL::text AS category, op.product_id,
       NULL::text AS order_history_status, op.reason
FROM offer_preview AS op
ORDER BY record_type, disposition, name, id;
