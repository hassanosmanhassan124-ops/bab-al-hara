# باب الحارة | Bab Al-Hara

Arabic RTL storefront for phones, electronics, and accessories. The project is a lightweight static website built with HTML5, CSS3, and vanilla JavaScript. Supabase supplies catalog/settings data, admin authentication, storage, and validated customer checkout. There is no custom backend server.

## Pages

- Customer: `index.html`, `products/`, `categories/`, `offers/`, `product/`, `wishlist/`, `cart/`, `order/`, `contact/`.
- Admin: `admin/login.html`, `admin/dashboard.html`, and the protected products, categories, offers, orders, and settings pages.
- Styles and scripts: `css/style.css`, `js/main.js`, `admin/css/admin.css`, and `admin/js/`.
- Supabase SQL: `database/schema.sql` for a fresh project; individual phase migrations for existing projects. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Architecture and security

The customer site reads active catalog entries and public store settings using the browser’s Supabase public anon/publishable key. Cart and wishlist state stay in localStorage. Customer order submission goes through the Postgres `submit_customer_order` function, which validates active products, stock, current prices, and quantities and records historical item snapshots. Customers do not receive broad order reads or edits.

Admin pages require Supabase Auth plus an active row in `public.admin_users`. RLS enforces catalog, offer, order, settings, and storage permissions in the database. Browser-side checks support the interface but are not the security boundary. Never put a service-role/secret key in frontend configuration.

## Setup

1. Set up Supabase using the steps in [DEPLOYMENT.md](DEPLOYMENT.md) and `database/README.md`.
2. Configure the ignored local file `js/supabase-config.js` using `js/supabase-config.example.js` as the shape. Use only the project URL and public anon/publishable key.
3. Serve the project root from a static host. The site uses relative page and asset paths and does not require client-side routing.

No GitHub Pages site or custom domain is configured in this workspace. The project is prepared for static hosting, but a repository/host and Supabase project must be connected by the owner before launch.

## Maintenance

Use the admin interface for routine store updates. Apply database migrations only after reviewing them and backing up production data. `database/seed.sql` is optional demo content and should not be run in production. `database/production-cleanup.sql` targets the exact demo seed signatures, skips products referenced by order history, never deletes orders, and is intentionally not run automatically.

See [ADMIN-GUIDE.md](ADMIN-GUIDE.md) for day-to-day operation and [DEPLOYMENT.md](DEPLOYMENT.md) for migrations, deployment, and access maintenance.
