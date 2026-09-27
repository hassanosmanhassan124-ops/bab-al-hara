-- Idempotent Phase 9 checkout migration for an existing Bab Al-Hara database.
-- Run after schema.sql / order-management.sql. It stops before changing anything
-- if the live table shape or order-management RLS prerequisites are incompatible.
BEGIN;

DO $preflight$
DECLARE
    incompatible_columns text;
    orders_rls_enabled boolean;
    order_items_rls_enabled boolean;
    expected_function oid;
    actual_return_type oid;
    actual_argument_names text[];
    actual_default_count integer;
BEGIN
    IF to_regclass('public.products') IS NULL
       OR to_regclass('public.orders') IS NULL
       OR to_regclass('public.order_items') IS NULL THEN
        RAISE EXCEPTION 'Checkout migration stopped: expected public.products, public.orders, and public.order_items tables must already exist. Run the compatible schema/table migrations first.';
    END IF;

    SELECT string_agg(format('%I.%I expected %s', required.table_name, required.column_name, required.udt_name), ', ')
      INTO incompatible_columns
      FROM (VALUES
          ('products', 'id', 'uuid'),
          ('products', 'name', 'text'),
          ('products', 'price', 'numeric'),
          ('products', 'stock_quantity', 'int4'),
          ('products', 'is_active', 'bool'),
          ('orders', 'id', 'uuid'),
          ('orders', 'customer_name', 'text'),
          ('orders', 'phone', 'text'),
          ('orders', 'address', 'text'),
          ('orders', 'notes', 'text'),
          ('orders', 'total_amount', 'numeric'),
          ('order_items', 'order_id', 'uuid'),
          ('order_items', 'product_id', 'uuid'),
          ('order_items', 'product_name', 'text'),
          ('order_items', 'quantity', 'int4'),
          ('order_items', 'unit_price', 'numeric'),
          ('order_items', 'subtotal', 'numeric')
      ) AS required(table_name, column_name, udt_name)
      LEFT JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
       AND actual.udt_name = required.udt_name
     WHERE actual.column_name IS NULL;

    IF incompatible_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Checkout migration stopped: live order/catalog columns are missing or have incompatible types: %. No order data was changed.', incompatible_columns;
    END IF;

    SELECT relrowsecurity INTO orders_rls_enabled
      FROM pg_class WHERE oid = 'public.orders'::regclass;
    SELECT relrowsecurity INTO order_items_rls_enabled
      FROM pg_class WHERE oid = 'public.order_items'::regclass;
    IF NOT coalesce(orders_rls_enabled, false)
       OR NOT coalesce(order_items_rls_enabled, false)
       OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.orders'::regclass AND polname = 'orders_admin_read_all')
       OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.orders'::regclass AND polname = 'orders_admin_update_status')
       OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.order_items'::regclass AND polname = 'order_items_admin_read_related') THEN
        RAISE EXCEPTION 'Checkout migration stopped: order RLS and active-admin read policies are not installed. Run database/order-management.sql first.';
    END IF;

    expected_function := to_regprocedure('public.submit_customer_order(text,text,text,text,jsonb)');
    IF expected_function IS NOT NULL THEN
        SELECT prorettype, proargnames, pronargdefaults
          INTO actual_return_type, actual_argument_names, actual_default_count
          FROM pg_proc WHERE oid = expected_function;
        IF actual_return_type <> 'uuid'::regtype
           OR actual_argument_names[1:5] IS DISTINCT FROM ARRAY[
               'p_customer_name', 'p_phone', 'p_address', 'p_notes', 'p_items'
           ]::text[]
           OR actual_default_count <> 0 THEN
            -- CREATE OR REPLACE cannot change a function's return type or input
            -- argument names. Drop only this exact signature, without CASCADE;
            -- dependent objects make PostgreSQL abort and roll back safely.
            EXECUTE 'DROP FUNCTION public.submit_customer_order(text,text,text,text,jsonb)';
        END IF;
    ELSIF EXISTS (
        SELECT 1 FROM pg_proc AS proc
        JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
        WHERE namespace.nspname = 'public' AND proc.proname = 'submit_customer_order'
    ) THEN
        RAISE EXCEPTION 'Checkout migration stopped: another submit_customer_order signature already exists. It was not duplicated or changed; inspect the live RPC signature first.';
    END IF;
END;
$preflight$;

-- Preserve authenticated active-admin SELECT/status-update access through RLS,
-- while customers and PUBLIC cannot read or mutate order rows directly.
REVOKE SELECT ON TABLE public.orders, public.order_items FROM PUBLIC, anon, authenticated;
REVOKE SELECT (id, customer_name, phone, address, notes, total_amount, status, created_at, updated_at)
    ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE SELECT (id, order_id, product_id, product_name, quantity, unit_price, subtotal, created_at)
    ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.orders, public.order_items TO authenticated;
REVOKE UPDATE, DELETE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, customer_name, phone, address, notes, total_amount, status, created_at, updated_at)
    ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status) ON TABLE public.orders TO authenticated;
REVOKE UPDATE, DELETE ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, order_id, product_id, product_name, quantity, unit_price, subtotal, created_at)
    ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
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
            'product_id', v_product.id,
            'product_name', v_product.name,
            'quantity', v_item.quantity,
            'unit_price', v_product.price,
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
        product_id uuid,
        product_name text,
        quantity integer,
        unit_price numeric,
        subtotal numeric
    );

    RETURN v_order_id;
END;
$function$;

-- Postgres grants EXECUTE to PUBLIC on new functions by default; remove that default
-- and explicitly allow only the storefront roles to use this constrained RPC.
REVOKE ALL ON FUNCTION public.submit_customer_order(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_customer_order(text, text, text, text, jsonb) TO anon, authenticated;

-- Refresh PostgREST's function cache so the customer RPC is discoverable now.
NOTIFY pgrst, 'reload schema';
COMMIT;
