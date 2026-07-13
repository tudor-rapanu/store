create or replace function public.jwt_is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    public.role_is_admin(auth.jwt() -> 'app_metadata' ->> 'role')
    or exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'roles') = 'array'
          then auth.jwt() -> 'app_metadata' -> 'roles'
          else '[]'::jsonb
        end
      ) as role(value)
      where public.role_is_admin(role.value)
    );
$$;

grant execute on function public.jwt_is_admin() to anon, authenticated;

alter table "products" enable row level security;
alter table "product_variants" enable row level security;
alter table "categories" enable row level security;
alter table "product_categories" enable row level security;
alter table "orders" enable row level security;
alter table "order_items" enable row level security;
alter table "shipping_profiles" enable row level security;
alter table "shipping_provider_tokens" enable row level security;
alter table "sameday_counties" enable row level security;
alter table "sameday_cities" enable row level security;
alter table "customer_profiles" enable row level security;

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

drop policy if exists "Admin full access to customer profiles" on "customer_profiles";
create policy "Admin full access to customer profiles"
on "customer_profiles"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Clients view own orders, Admins view all" on "orders";
create policy "Clients view own orders, Admins view all"
on "orders"
for select
to authenticated
using (
  "user_id" = auth.uid()::text
  or public.jwt_is_admin()
);
