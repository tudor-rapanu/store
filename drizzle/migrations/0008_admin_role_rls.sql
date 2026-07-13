create or replace function public.jwt_is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(upper(auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN', false);
$$;

grant execute on function public.jwt_is_admin() to anon, authenticated;

drop policy if exists "Admin full access to products" on "products";
create policy "Admin full access to products"
on "products"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admin full access to product variants" on "product_variants";
create policy "Admin full access to product variants"
on "product_variants"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admin full access to categories" on "categories";
create policy "Admin full access to categories"
on "categories"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admin full access to product categories" on "product_categories";
create policy "Admin full access to product categories"
on "product_categories"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admin full access to orders" on "orders";
create policy "Admin full access to orders"
on "orders"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admin full access to order items" on "order_items";
create policy "Admin full access to order items"
on "order_items"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admin full access to shipping profiles" on "shipping_profiles";
create policy "Admin full access to shipping profiles"
on "shipping_profiles"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admin full access to Sameday counties" on "sameday_counties";
create policy "Admin full access to Sameday counties"
on "sameday_counties"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admin full access to Sameday cities" on "sameday_cities";
create policy "Admin full access to Sameday cities"
on "sameday_cities"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admins can view own role-protected order items" on "order_items";

drop policy if exists "Clients view own orders, Admins view all" on "orders";
create policy "Clients view own orders, Admins view all"
on "orders"
for select
to authenticated
using (
  "user_id" = auth.uid()::text
  or public.jwt_is_admin()
);
