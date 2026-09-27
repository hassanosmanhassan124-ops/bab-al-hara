# Bab Al-Hara deployment

The customer site and admin interface are static HTML, CSS, and vanilla JavaScript. Supabase provides the database, authentication, and public image storage. There is no server-side application to deploy.

## Before launch

1. Create a Supabase project and keep its project URL and public anon/publishable key available. The browser configuration is public by design; never use a service-role or secret key in this project.
2. In Supabase SQL Editor, run `database/schema.sql` on a **new, empty project**. It includes the tables, indexes, RLS policies, storage bucket, and validated checkout function.
3. For a new production store, skip `database/seed.sql`. That file creates demo catalog rows. `database/production-cleanup.sql` is optional cleanup for those exact seed records; review it and run it manually only if the demo seed was previously applied. It is not run by this project.
4. In Supabase Authentication, disable public sign-ups and manually create/invite the store owner’s admin Auth user. Follow the provisioning comments in `database/admin-setup.sql` to insert that user UUID and email into `public.admin_users` as the project owner. Never place an admin password in SQL or frontend code.
5. In `js/supabase-config.js`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the Supabase project URL and the public anon/publishable key. Do not commit this local config; it is excluded by `.gitignore`. `js/supabase-config.example.js` is the safe template.
6. Open `index.html` through a static web host to smoke-check the customer pages. Test admin login, active-admin access, catalog updates, image uploads, checkout, and order visibility against the configured Supabase project before announcing the site.

### Existing database migration order

Do not rerun `schema.sql` against an existing production database. Back up the project, compare its current schema, then apply the supplied migrations in SQL Editor:

1. `database/admin-setup.sql` only if `public.admin_users` is not already present.
2. `database/product-management.sql`
3. `database/category-management.sql`
4. `database/offer-management.sql`
5. `database/order-management.sql`
6. `database/checkout.sql` after order management.
7. `database/settings-management.sql`

These scripts establish the current active-admin RLS and storage policies. Confirm the resulting policies and bucket settings in Supabase after migration. The `product-images` bucket is public-read for image delivery; upload, update, and delete operations require an authenticated active admin.

## Static hosting / GitHub Pages

The project uses separate HTML pages and relative asset/navigation paths, so it is suitable for static hosting under a path prefix. The intended public pages are `index.html`, `products/`, `categories/`, `offers/`, `product/`, `wishlist/`, `cart/`, `order/`, and `contact/`. The admin login is `admin/login.html`; other admin pages are protected by the active-admin session check and RLS.

No Git remote, Pages workflow, or Pages configuration is present in this workspace, so no live deployment has been verified. To deploy on GitHub Pages:

1. Create/select the intended repository and place the contents of this project at the repository root, so `index.html` is the published root page. Do not publish a parent directory containing unrelated workspace files.
2. In the repository’s **Settings → Pages**, select a branch/root deployment if the files are at the root, or configure a GitHub Actions workflow to publish this project directory if it remains nested.
3. Supply the `SUPABASE_URL` and `SUPABASE_ANON_KEY` values to the published `js/supabase-config.js`. Since this is a static browser app, use GitHub Actions repository variables in a workflow to generate that file, or intentionally commit a configuration file containing only the public anon/publishable key. It is expected that visitors can read that public key; never use a service-role/secret key. `.gitignore` currently excludes the local config file.
4. Open the Pages URL and check nested pages, catalog reads, admin login, uploads, checkout, and order review against the intended Supabase project.

Confirm the published URL works with the relative asset/navigation paths before launch. GitHub Pages is static hosting; the database’s RLS policies remain the security boundary.

For a custom domain, attach the domain in the hosting provider’s Pages settings and apply the DNS records shown there. Verify HTTPS and the final site path after DNS propagation.

## Update and maintenance

- Keep the static project paths intact when publishing so nested pages resolve their CSS, JavaScript, and links.
- Make catalog and store-contact changes in the admin interface. Review active offers and product stock periodically.
- Apply later SQL migrations only after reviewing the matching phase migration and backing up production data.
- Keep demo seed data out of production. Do not run cleanup scripts without reviewing their exact predicates and current data first.
- Rotate admin access through Supabase Auth. Disable an administrator by setting their `admin_users.is_active` to false; this revokes protected admin operations through RLS.
- Never expose a service-role key, database password, or customer order data in a public repository, browser code, or deployment logs.

## Deployment status

This handover prepares the project for deployment. No host, domain, Supabase project, or Git remote was connected from this workspace, so deployment and live database checks remain to be completed by the owner.
