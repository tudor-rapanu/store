# Production Readiness Checklist

Use this checklist before important deploys, payment tests, product drops, and expected traffic spikes.

## Deployment

- [ ] Docker build succeeds for `linux/amd64`.
- [ ] Cloud Run deploy succeeds.
- [ ] Required Cloud Run secrets and environment variables are configured.
- [ ] `NEXT_PUBLIC_SITE_URL` points to the correct production domain.
- [ ] Neon migrations are pushed with `npm run db:push`.
- [ ] Admin Neon Auth user has `role = "ADMIN"`.
- [ ] Admin user has logged out and back in after role changes.

## Payments

- [ ] Netopia card payment can be initiated.
- [ ] Netopia return URL sends the customer back to the site.
- [ ] Netopia webhook confirms successful payment.
- [ ] Paid orders change from pending to paid.
- [ ] Cart clears after successful card payment.
- [ ] Failed or abandoned payments stay visible as pending or failed as expected.
- [ ] Bank transfer order creation works.
- [ ] Customer order email is sent.
- [ ] Admin order email is sent.

## Orders

- [ ] Guest order link works with access token.
- [ ] Guest order view masks details where intended.
- [ ] Logged-in customer sees order history.
- [ ] Customer can request cancellation for eligible orders.
- [ ] Admin can update payment status.
- [ ] Admin can update fulfillment status.
- [ ] Admin can add order items only for new or processing orders.
- [ ] Admin can remove order items only where allowed.
- [ ] Order totals remain correct after admin item changes.

## Shipping

- [ ] Shipping profiles are configured for local delivery.
- [ ] Easybox shipping price is correct.
- [ ] Address shipping price is correct.
- [ ] Free shipping threshold is correct.
- [ ] Sameday county/city sync works.
- [ ] Checkout county selector loads from the database.
- [ ] Checkout city selector filters and selects correctly.
- [ ] Easybox/PUDO map loads.
- [ ] Easybox/PUDO location is stored on checkout.
- [ ] AWB generation works for address delivery.
- [ ] AWB generation works for Easybox/PUDO delivery.
- [ ] Personal dropoff option sends the expected Sameday payload.
- [ ] AWB label opens for admin.
- [ ] Tracking link is visible to customer.
- [ ] Tracking email is sent after AWB generation.

## Catalog

- [ ] Homepage loads latest product preview only.
- [ ] `/en/products` and `/ro/products` load the full paginated catalog.
- [ ] Category pages load paginated product lists.
- [ ] Product detail page loads title, description, variants, and gallery.
- [ ] Product image gallery arrows work.
- [ ] Product thumbnails use normalized image variants for new uploads.
- [ ] Private products are hidden from public catalog pages.
- [ ] Admin can create products.
- [ ] Admin can edit products.
- [ ] Admin can duplicate products.
- [ ] Admin can delete products where allowed.
- [ ] Admin can mark products private.
- [ ] Variant matrix generation avoids duplicate variants.
- [ ] Categories can be created, updated, and deleted by admin.
- [ ] Products can be added to and removed from categories.

## Security

- [ ] RLS migrations are applied in Neon.
- [ ] Admin RLS policy works with `role = "ADMIN"`.
- [ ] Public catalog RLS allows only non-private product reads.
- [ ] Customer profile RLS allows users to access only their own profile.
- [ ] Customer order RLS allows users to access only their own orders.
- [ ] `shipping_provider_tokens` has RLS enabled and no public browser-access policy.
- [ ] Upstash Redis rate limiting variables are configured.
- [ ] Netopia webhook secret is configured.
- [ ] Old leaked/test secrets are rotated.
- [ ] Supabase anon key is the only public Supabase key used in browser code.
- [ ] Service/database credentials are server-only.
- [ ] CSP has no unexpected production console blocks.
- [ ] Public endpoints reject invalid input.
- [ ] Admin endpoints reject non-admin users.

## Performance

- [ ] Product/category public pages are cached.
- [ ] Catalog cache invalidates after product/category changes.
- [ ] Catalog and category pages are paginated.
- [ ] Homepage avoids loading the full catalog.
- [ ] Product uploads generate `large`, `card`, and `thumb` image variants.
- [ ] Admin product list is paginated.
- [ ] Admin order list is paginated and filterable.
- [ ] Admin list queries select only required columns.
- [ ] Database connection limit is configured with `DATABASE_MAX_CONNECTIONS`.
- [ ] Cloud Run max instances and memory are reviewed before major drops.
- [ ] Spike traffic plan is documented.

## Monitoring

- [ ] Cloud Run logs are checked after deploy.
- [ ] Cloud Run error logs are reviewed after payment tests.
- [ ] Supabase database logs are checked after migrations.
- [ ] PostHog token and host are configured, or PostHog is disabled.
- [ ] Uptime check is configured.
- [ ] Backup and restore process is known.
- [ ] Manual rollback command or previous image tag is known.

## Legal And Compliance

- [ ] Footer legal links are visible on desktop.
- [ ] Footer legal links are visible on mobile.
- [ ] ANPC SAL link renders correctly.
- [ ] ANPC SOL link renders correctly.
- [ ] Netopia logo renders correctly.
- [ ] Cookie consent appears for new visitors.
- [ ] Cookie consent persists after acceptance.
- [ ] Terms page is present.
- [ ] Privacy policy page is present.
- [ ] Returns/refund policy page is present.
- [ ] Delivery policy page is present.

## Final Smoke Test

- [ ] Visit homepage.
- [ ] Visit full catalog.
- [ ] Visit category page.
- [ ] Visit product page.
- [ ] Add product to cart.
- [ ] Checkout as guest.
- [ ] Checkout as logged-in user.
- [ ] Complete card payment test.
- [ ] Create bank transfer order.
- [ ] Open admin orders page.
- [ ] Generate AWB for paid order.
- [ ] Open customer order page.
