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

drop policy if exists "Public can read visible products" on "products";
create policy "Public can read visible products"
on "products"
for select
to anon, authenticated
using ("is_private" = false);

drop policy if exists "Public can read visible product variants" on "product_variants";
create policy "Public can read visible product variants"
on "product_variants"
for select
to anon, authenticated
using (
  exists (
    select 1
    from "products"
    where "products"."id" = "product_variants"."product_id"
    and "products"."is_private" = false
  )
);

drop policy if exists "Public can read categories" on "categories";
create policy "Public can read categories"
on "categories"
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read visible product categories" on "product_categories";
create policy "Public can read visible product categories"
on "product_categories"
for select
to anon, authenticated
using (
  exists (
    select 1
    from "products"
    where "products"."id" = "product_categories"."product_id"
    and "products"."is_private" = false
  )
);

drop policy if exists "Authenticated users can read own orders" on "orders";
create policy "Authenticated users can read own orders"
on "orders"
for select
to authenticated
using ("user_id" = auth.uid()::text);

drop policy if exists "Authenticated users can read own order items" on "order_items";
create policy "Authenticated users can read own order items"
on "order_items"
for select
to authenticated
using (
  exists (
    select 1
    from "orders"
    where "orders"."id" = "order_items"."order_id"
    and "orders"."user_id" = auth.uid()::text
  )
);

drop policy if exists "Public can read enabled shipping profiles" on "shipping_profiles";
create policy "Public can read enabled shipping profiles"
on "shipping_profiles"
for select
to anon, authenticated
using ("enabled" = true);

drop policy if exists "Public can read Sameday counties" on "sameday_counties";
create policy "Public can read Sameday counties"
on "sameday_counties"
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read Sameday cities" on "sameday_cities";
create policy "Public can read Sameday cities"
on "sameday_cities"
for select
to anon, authenticated
using (true);
