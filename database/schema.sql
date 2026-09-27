-- Bab Al-Hara database foundation for Supabase (PostgreSQL).
-- Run in the Supabase SQL Editor on a fresh project.

CREATE TABLE public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(trim(name)) > 0),
    slug text NOT NULL UNIQUE CHECK (length(trim(slug)) > 0),
    description text,
    image_url text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (length(trim(name)) > 0),
    slug text NOT NULL UNIQUE CHECK (length(trim(slug)) > 0),
    description text,
    price numeric(12, 2) NOT NULL CHECK (price >= 0),
    old_price numeric(12, 2) CHECK (old_price IS NULL OR old_price >= 0),
    stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url text,
    is_active boolean NOT NULL DEFAULT true,
    is_featured boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (length(trim(title)) > 0),
    description text,
    discount_percentage numeric(5, 2) NOT NULL
        CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    old_price numeric(12, 2) CHECK (old_price IS NULL OR old_price >= 0),
    offer_price numeric(12, 2) CHECK (offer_price IS NULL OR offer_price >= 0),
    image_url text,
    start_date timestamptz NOT NULL DEFAULT now(),
    end_date timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT offers_valid_date_range CHECK (end_date IS NULL OR end_date > start_date),
    CONSTRAINT offers_valid_price_snapshot CHECK (
        (old_price IS NULL OR offer_price IS NULL OR old_price >= offer_price)
    )
);

CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name text NOT NULL CHECK (length(trim(customer_name)) > 0),
    phone text NOT NULL CHECK (length(trim(phone)) > 0),
    address text NOT NULL CHECK (length(trim(address)) > 0),
    notes text,
    total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_name text NOT NULL CHECK (length(trim(product_name)) > 0),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal numeric(12, 2) NOT NULL CHECK (subtotal >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_items_subtotal_matches_quantity
        CHECK (subtotal = round(quantity * unit_price, 2))
);

-- A boolean primary key with a true-only check keeps store configuration to one row.
CREATE TABLE public.store_settings (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    store_name text,
    store_description text,
    logo_url text,
    whatsapp text,
    phone text,
    phone_secondary text,
    address text,
    delivery_information text,
    payment_information text,
    instagram text,
    facebook text,
    tiktok text,
    live_name text,
    working_hours text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin authorization is separate from Supabase Auth credentials.
CREATE TABLE public.admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL CHECK (length(trim(email)) > 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Maintain updated_at automatically for mutable records.
CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER categories_set_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_set_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER offers_set_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orders_set_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER store_settings_set_updated_at
    BEFORE UPDATE ON public.store_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER admin_users_set_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for storefront filters, joins, and order management.
CREATE INDEX products_category_id_idx ON public.products(category_id);
CREATE INDEX products_is_active_idx ON public.products(is_active);
CREATE INDEX products_is_featured_idx ON public.products(is_featured);
CREATE INDEX offers_product_id_idx ON public.offers(product_id);
CREATE INDEX offers_is_active_idx ON public.offers(is_active);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_created_at_idx ON public.orders(created_at DESC);
CREATE INDEX order_items_order_id_idx ON public.order_items(order_id);
CREATE INDEX order_items_product_id_idx ON public.order_items(product_id);

-- Public storefront reads; admin catalog writes require active-admin RLS policies.
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.categories, public.products, public.offers,
    public.orders, public.order_items, public.store_settings, public.admin_users
    FROM anon, authenticated;
REVOKE ALL ON TABLE public.store_settings FROM PUBLIC;
REVOKE SELECT (id, store_name, store_description, logo_url, whatsapp, phone, address,
               phone_secondary, delivery_information, payment_information, instagram, facebook, tiktok,
               live_name, working_hours, updated_at)
    ON TABLE public.store_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC;
GRANT SELECT ON TABLE public.categories, public.products, public.offers TO anon, authenticated;
GRANT SELECT (id, store_name, store_description, logo_url, whatsapp, phone, address,
              phone_secondary, delivery_information, payment_information, instagram, facebook, tiktok,
              live_name, working_hours)
    ON TABLE public.store_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.store_settings TO authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;
REVOKE ALL ON TABLE public.orders, public.order_items FROM PUBLIC;
REVOKE SELECT ON TABLE public.orders, public.order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.orders, public.order_items TO authenticated;
REVOKE UPDATE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status) ON TABLE public.orders TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.categories FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.products FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.offers FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.offers TO authenticated;

CREATE POLICY categories_read_active
    ON public.categories FOR SELECT TO anon, authenticated
    USING (is_active);
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
CREATE POLICY products_read_active
    ON public.products FOR SELECT TO anon, authenticated
    USING (is_active);
CREATE POLICY products_admin_read_all
    ON public.products FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY products_admin_insert
    ON public.products FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY products_admin_update
    ON public.products FOR UPDATE TO authenticated
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
CREATE POLICY products_admin_delete
    ON public.products FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
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
CREATE POLICY orders_admin_read_all
    ON public.orders FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users AS admin
            WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
        )
    );
CREATE POLICY orders_admin_update_status
    ON public.orders FOR UPDATE TO authenticated
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
CREATE POLICY order_items_admin_read_related
    ON public.order_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders AS customer_order
            WHERE customer_order.id = order_items.order_id
              AND EXISTS (
                  SELECT 1 FROM public.admin_users AS admin
                  WHERE admin.user_id = (SELECT auth.uid()) AND admin.is_active
              )
        )
    );
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
CREATE POLICY admin_users_read_own_active
    ON public.admin_users FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND is_active);

-- Customer checkout is exposed only through this server-side validated RPC.
-- Direct customer SELECT/INSERT/UPDATE/DELETE grants on orders remain revoked.
REVOKE INSERT ON TABLE public.orders, public.order_items FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, customer_name, phone, address, notes, total_amount, status, created_at, updated_at)
    ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, order_id, product_id, product_name, quantity, unit_price, subtotal, created_at)
    ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.submit_customer_order(
    p_customer_name text,
    p_phone text,
    p_address text,
    p_notes text,
    p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_name text := btrim(coalesce(p_customer_name, ''));
    v_phone text := btrim(coalesce(p_phone, ''));
    v_address text := btrim(coalesce(p_address, ''));
    v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
    v_item record;
    v_product public.products%ROWTYPE;
    v_order_id uuid;
    v_total numeric(12, 2) := 0;
    v_verified_items jsonb := '[]'::jsonb;
    v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
    IF v_name = '' OR length(v_name) > 200
       OR v_phone = '' OR length(v_phone) > 50
       OR v_address = '' OR length(v_address) > 1000
       OR length(coalesce(v_notes, '')) > 2000 THEN
        RAISE EXCEPTION USING MESSAGE = 'INVALID_CUSTOMER_DETAILS', ERRCODE = '22023';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION USING MESSAGE = 'INVALID_CART', ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
        RAISE EXCEPTION USING MESSAGE = 'INVALID_CART', ERRCODE = '22023';
    END IF;
    FOR v_item IN
        SELECT parsed.product_id, parsed.quantity
        FROM jsonb_to_recordset(p_items) AS parsed(product_id uuid, quantity integer)
        ORDER BY parsed.product_id
    LOOP
        IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity < 1 THEN
            RAISE EXCEPTION USING MESSAGE = 'INVALID_CART_ITEM', ERRCODE = '22023';
        END IF;
        IF v_item.product_id = ANY(v_seen) THEN
            RAISE EXCEPTION USING MESSAGE = 'DUPLICATE_CART_ITEM', ERRCODE = '22023';
        END IF;
        v_seen := array_append(v_seen, v_item.product_id);
        SELECT product.* INTO v_product
        FROM public.products AS product
        WHERE product.id = v_item.product_id AND product.is_active = true
        FOR UPDATE;
        IF NOT FOUND OR v_item.quantity > v_product.stock_quantity THEN
            RAISE EXCEPTION USING MESSAGE = 'PRODUCT_UNAVAILABLE_OR_STOCK_CHANGED', ERRCODE = 'P0001';
        END IF;
        v_total := v_total + (v_product.price * v_item.quantity);
        v_verified_items := v_verified_items || jsonb_build_array(jsonb_build_object(
            'product_id', v_product.id, 'product_name', v_product.name,
            'quantity', v_item.quantity, 'unit_price', v_product.price,
            'subtotal', round(v_product.price * v_item.quantity, 2)
        ));
    END LOOP;
    INSERT INTO public.orders (customer_name, phone, address, notes, total_amount)
    VALUES (v_name, v_phone, v_address, v_notes, v_total)
    RETURNING id INTO v_order_id;
    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
    SELECT v_order_id, verified.product_id, verified.product_name,
           verified.quantity, verified.unit_price, verified.subtotal
    FROM jsonb_to_recordset(v_verified_items) AS verified(
        product_id uuid, product_name text, quantity integer, unit_price numeric, subtotal numeric
    );
    RETURN v_order_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_customer_order(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_customer_order(text, text, text, text, jsonb) TO anon, authenticated;

-- Customers have no direct order table grants or read/update/delete policies.
-- New customer orders are created only through submit_customer_order above;
-- admins retain the read and status-update policies defined earlier.

-- Public image delivery; anonymous/authenticated uploads remain disallowed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY product_images_public_read
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'product-images');
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
