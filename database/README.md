# Bab Al-Hara database foundation

## Tables

- `categories` groups products; deleting a category with products is restricted.
- `products` belongs to a category; offers refer to products.
- `orders` contains customer/order totals. `order_items` keeps product name and unit price snapshots so order history remains readable. Orders with items cannot be deleted; deleting a product preserves the item snapshot and clears its optional product reference.
- `store_settings` holds one future-managed store profile. No real business values are seeded.
- `admin_users` links a Supabase Auth UUID to an active-admin authorization row; it contains no passwords.

## Setup

1. Create or select the Supabase project and open **SQL Editor**.
2. Run `database/schema.sql` first. It creates tables, constraints, indexes, timestamp triggers, RLS policies, and the image bucket.
3. Optionally run `database/seed.sql` to add clearly marked Arabic demo categories, products, and offers. It adds no contact details or images.
4. To provision an administrator, create the Auth user manually in Supabase, then use the instructions in `database/admin-setup.sql` to add that user's UUID. For an existing Phase 3 database, run `database/admin-setup.sql` first.
5. For an existing database, run `database/product-management.sql` after `admin-setup.sql` to enable active-admin product CRUD and secure product-image writes. Fresh installs get these policies from `schema.sql`.
6. For an existing database, run `database/category-management.sql` after `admin-setup.sql` to enable active-admin category CRUD and ensure the shared image bucket policies are present. Fresh installs get category and image policies from `schema.sql`.
7. For an existing database, run `database/offer-management.sql` after `admin-setup.sql` to add offer price/image snapshots and active-admin offer CRUD policies. Fresh installs get the same columns and policies from `schema.sql`.
8. For an existing database, run `database/order-management.sql` after `admin-setup.sql` to enable active-admin order reads and status updates. It preserves any existing order INSERT permissions/policies. Fresh installs get the equivalent admin policies from `schema.sql`.
9. For an existing database, run `database/checkout.sql` after `order-management.sql` to install the validated order RPC and revoke direct customer order inserts. Fresh installs get the same function and grants from `schema.sql`.
10. For an existing database, run `database/settings-management.sql` after `admin-setup.sql` to enable public settings reads and active-admin-only settings insert/update. Fresh installs get the same settings policies from `schema.sql`.

The schema targets a fresh Supabase project with the standard `anon`, `authenticated`, `storage` roles/schema, and storage tables available. The `product-images` bucket is public for image delivery, limited to JPEG/PNG/WebP and 5 MB per object. The schema and `product-management.sql` migration allow image insert/update/delete only for authenticated active administrators; public image reads remain enabled.

## Frontend configuration

`../js/supabase-config.example.js` shows the browser configuration shape. The project URL and **public anon/publishable key** belong in the ignored local file `../js/supabase-config.js`; never commit a service-role/secret key or place one in browser code. These public settings are visible to site visitors, so RLS is the security boundary. See `../DEPLOYMENT.md` for production setup and static hosting notes.

Customer pages use the configured public anon/publishable key to read active catalog data and public store settings. Anonymous/public roles cannot read orders or order items. Customers submit orders through the validated `submit_customer_order` database function from `database/checkout.sql`; it derives prices and product snapshots in Postgres. Active administrators can read orders and update order status through RLS.

`admin_users` has RLS enabled. Authenticated users can select only their own active row; browser roles cannot insert, update, or delete admin records. Manage authorization rows only from the Supabase Dashboard/SQL Editor as the project owner. Disable public sign-ups and provision admin users manually. The dashboard checks active-admin membership, and category, product, offer, order-status, plus image mutations are also protected by server-enforced RLS policies. Other future CRUD features need their own server-enforced policies.

Product mutation policies check active `admin_users` membership in Postgres. `order_items.product_id` uses `ON DELETE SET NULL` while keeping product-name and unit-price snapshots, so product deletion preserves historical order lines. Product-image storage remains public-read; insert/update/delete are restricted by RLS to active admins.
