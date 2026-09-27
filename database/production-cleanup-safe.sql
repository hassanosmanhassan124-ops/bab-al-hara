-- SAFE, repeatable demo cleanup. REVIEW THIS SCRIPT BEFORE RUNNING.
-- It uses only the exact demo identities from production-cleanup.sql.
-- It never deletes orders, order_items, or store_settings.
-- Products referenced by order_items or by any offer left after demo-offer
-- cleanup are retained. No CASCADE clause is used.
-- Run this as a short, authorized maintenance transaction; locks serialize
-- the reference checks against checkout/admin writes.

BEGIN;

LOCK TABLE public.products, public.offers, public.categories,
           public.orders, public.order_items IN EXCLUSIVE MODE;

-- Exact demo offer identities copied from production-cleanup.sql.
CREATE TEMP TABLE cleanup_safe_demo_offers ON COMMIT DROP AS
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
SELECT o.id, o.product_id, o.title, p.slug AS product_slug
FROM public.offers AS o
JOIN public.products AS p ON p.id = o.product_id
JOIN demo_offers AS d
  ON p.slug = d.product_slug
 AND p.name = d.product_name
 AND p.description = d.product_description
 AND o.title = d.title
 AND o.description = d.offer_description;

-- Exact demo product identities copied from production-cleanup.sql.
CREATE TEMP TABLE cleanup_safe_demo_products ON COMMIT DROP AS
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
SELECT p.id, p.category_id, p.name, p.slug, p.description,
       p.price, p.stock_quantity, c.name AS category_name,
       EXISTS (
           SELECT 1 FROM public.order_items AS oi
           WHERE oi.product_id = p.id
       ) AS has_order_history,
       EXISTS (
           SELECT 1
           FROM public.offers AS o
           WHERE o.product_id = p.id
             AND NOT EXISTS (
                 SELECT 1 FROM cleanup_safe_demo_offers AS doomed
                 WHERE doomed.id = o.id
             )
       ) AS has_retained_offer
FROM public.products AS p
JOIN demo_products AS d
  ON p.slug = d.slug AND p.name = d.name AND p.description = d.description
LEFT JOIN public.categories AS c ON c.id = p.category_id;

CREATE TEMP TABLE cleanup_safe_product_plan ON COMMIT DROP AS
SELECT p.*,
       CASE
         WHEN p.has_order_history THEN 'PROTECTED BY ORDER HISTORY'
         WHEN p.has_retained_offer THEN 'KEEP — LINKED TO OFFER NOT BEING DELETED'
         ELSE 'DELETE CANDIDATE'
       END AS planned_action
FROM cleanup_safe_demo_products AS p;

-- Exact category identities copied from production-cleanup.sql.
CREATE TEMP TABLE cleanup_safe_category_plan ON COMMIT DROP AS
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
SELECT c.id, c.name, c.slug, c.description,
       CASE
         WHEN NOT EXISTS (
             SELECT 1
             FROM public.products AS p
             WHERE p.category_id = c.id
               AND NOT EXISTS (
                   SELECT 1
                   FROM cleanup_safe_product_plan AS product_plan
                   WHERE product_plan.id = p.id
                     AND product_plan.planned_action = 'DELETE CANDIDATE'
               )
         ) THEN 'DELETE CANDIDATE'
         ELSE 'KEEP — CATEGORY STILL HAS PRODUCTS'
       END AS planned_action
FROM public.categories AS c
JOIN demo_categories AS d
  ON c.slug = d.slug AND c.name = d.name AND c.description = d.description;

-- Preview result sets. These execute before any permanent-row deletion.
SELECT id, title, product_id, product_slug, 'DELETE CANDIDATE'::text AS planned_action
FROM cleanup_safe_demo_offers
ORDER BY title, id;

SELECT id, name, slug, price, stock_quantity AS stock, category_name AS category,
       CASE
         WHEN has_order_history THEN 'PROTECTED BY ORDER HISTORY'
         WHEN has_retained_offer THEN 'KEEP — LINKED TO OFFER NOT BEING DELETED'
         ELSE 'DELETE CANDIDATE'
       END AS planned_action
FROM cleanup_safe_product_plan
ORDER BY planned_action, name, id;

SELECT id, name, slug, description, planned_action
FROM cleanup_safe_category_plan
ORDER BY planned_action, name, id;

-- Record actual deleted IDs in transaction-scoped temporary tables for the
-- final result. Each deletion is constrained to the exact reviewed plan.
CREATE TEMP TABLE cleanup_safe_deleted_offers (id uuid PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE cleanup_safe_deleted_products (id uuid PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE cleanup_safe_deleted_categories (id uuid PRIMARY KEY) ON COMMIT DROP;

WITH deleted AS (
    DELETE FROM public.offers AS o
    USING cleanup_safe_demo_offers AS planned
    WHERE o.id = planned.id
    RETURNING o.id
)
INSERT INTO cleanup_safe_deleted_offers (id)
SELECT id FROM deleted;

WITH deleted AS (
    DELETE FROM public.products AS p
    USING cleanup_safe_product_plan AS planned
    WHERE p.id = planned.id
      AND planned.planned_action = 'DELETE CANDIDATE'
      AND NOT EXISTS (
          SELECT 1 FROM public.order_items AS oi
          WHERE oi.product_id = p.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.offers AS o
          WHERE o.product_id = p.id
      )
    RETURNING p.id
)
INSERT INTO cleanup_safe_deleted_products (id)
SELECT id FROM deleted;

WITH deleted AS (
    DELETE FROM public.categories AS c
    USING cleanup_safe_category_plan AS planned
    WHERE c.id = planned.id
      AND planned.planned_action = 'DELETE CANDIDATE'
      AND NOT EXISTS (
          SELECT 1 FROM public.products AS p
          WHERE p.category_id = c.id
      )
    RETURNING c.id
)
INSERT INTO cleanup_safe_deleted_categories (id)
SELECT id FROM deleted;

-- Final outcome visible to the operator. Protected and retained products are
-- reported explicitly; rows deleted in this transaction are shown as DELETED.
SELECT 'OFFER'::text AS record_type, d.title AS name, d.id,
       CASE WHEN gone.id IS NOT NULL THEN 'DELETED' ELSE 'NOT DELETED' END AS outcome,
       d.product_id, NULL::numeric AS price, NULL::integer AS stock,
       NULL::text AS category, NULL::text AS details
FROM cleanup_safe_demo_offers AS d
LEFT JOIN cleanup_safe_deleted_offers AS gone ON gone.id = d.id
UNION ALL
SELECT 'PRODUCT', p.name, p.id,
       CASE
         WHEN gone.id IS NOT NULL THEN 'DELETED'
         WHEN p.has_order_history THEN 'PROTECTED BY ORDER HISTORY'
         WHEN p.has_retained_offer THEN 'KEPT — LINKED TO OFFER NOT BEING DELETED'
         ELSE 'KEPT — DELETION GUARD DID NOT PASS'
       END,
       NULL::uuid, p.price, p.stock_quantity, p.category_name,
       p.slug
FROM cleanup_safe_product_plan AS p
LEFT JOIN cleanup_safe_deleted_products AS gone ON gone.id = p.id
UNION ALL
SELECT 'CATEGORY', c.name, c.id,
       CASE WHEN gone.id IS NOT NULL THEN 'DELETED' ELSE 'KEPT — CATEGORY STILL HAS PRODUCTS' END,
       NULL::uuid, NULL::numeric, NULL::integer, NULL::text, c.slug || ' — ' || c.description
FROM cleanup_safe_category_plan AS c
LEFT JOIN cleanup_safe_deleted_categories AS gone ON gone.id = c.id
ORDER BY record_type, outcome, name, id;

COMMIT;
