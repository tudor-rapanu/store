create or replace function public.jwt_is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  with claims as (
    select (select auth.jwt()) as jwt
  )
  select
    coalesce(upper(jwt -> 'app_metadata' ->> 'role') = 'ADMIN', false)
    or exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(jwt -> 'app_metadata' -> 'roles') = 'array'
          then jwt -> 'app_metadata' -> 'roles'
          else '[]'::jsonb
        end
      ) as role(value)
      where upper(role.value) = 'ADMIN'
    )
  from claims;
$$;

grant execute on function public.jwt_is_admin() to anon, authenticated;

drop policy if exists "Admin full access to products" on "products";
drop policy if exists "Public can read visible products" on "products";
create policy "Public and admins can read products"
on "products"
for select
to anon, authenticated
using ("is_private" = false or (select public.jwt_is_admin()));
create policy "Admins can insert products"
on "products"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update products"
on "products"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete products"
on "products"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to product variants" on "product_variants";
drop policy if exists "Public can read visible product variants" on "product_variants";
create policy "Public and admins can read product variants"
on "product_variants"
for select
to anon, authenticated
using (
  (select public.jwt_is_admin())
  or exists (
    select 1
    from "products"
    where "products"."id" = "product_variants"."product_id"
      and "products"."is_private" = false
  )
);
create policy "Admins can insert product variants"
on "product_variants"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update product variants"
on "product_variants"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete product variants"
on "product_variants"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to categories" on "categories";
drop policy if exists "Public can read categories" on "categories";
create policy "Public can read categories"
on "categories"
for select
to anon, authenticated
using (true);
create policy "Admins can insert categories"
on "categories"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update categories"
on "categories"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete categories"
on "categories"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to product categories" on "product_categories";
drop policy if exists "Public can read visible product categories" on "product_categories";
create policy "Public and admins can read product categories"
on "product_categories"
for select
to anon, authenticated
using (
  (select public.jwt_is_admin())
  or exists (
    select 1
    from "products"
    where "products"."id" = "product_categories"."product_id"
      and "products"."is_private" = false
  )
);
create policy "Admins can insert product categories"
on "product_categories"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update product categories"
on "product_categories"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete product categories"
on "product_categories"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to shipping profiles" on "shipping_profiles";
drop policy if exists "Public can read enabled shipping profiles" on "shipping_profiles";
create policy "Public and admins can read shipping profiles"
on "shipping_profiles"
for select
to anon, authenticated
using ("enabled" = true or (select public.jwt_is_admin()));
create policy "Admins can insert shipping profiles"
on "shipping_profiles"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update shipping profiles"
on "shipping_profiles"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete shipping profiles"
on "shipping_profiles"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to Sameday counties" on "sameday_counties";
drop policy if exists "Public can read Sameday counties" on "sameday_counties";
create policy "Public can read Sameday counties"
on "sameday_counties"
for select
to anon, authenticated
using (true);
create policy "Admins can insert Sameday counties"
on "sameday_counties"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update Sameday counties"
on "sameday_counties"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete Sameday counties"
on "sameday_counties"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to Sameday cities" on "sameday_cities";
drop policy if exists "Public can read Sameday cities" on "sameday_cities";
create policy "Public can read Sameday cities"
on "sameday_cities"
for select
to anon, authenticated
using (true);
create policy "Admins can insert Sameday cities"
on "sameday_cities"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update Sameday cities"
on "sameday_cities"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete Sameday cities"
on "sameday_cities"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to orders" on "orders";
drop policy if exists "Authenticated users can read own orders" on "orders";
drop policy if exists "Clients view own orders, Admins view all" on "orders";
create policy "Authenticated users can read permitted orders"
on "orders"
for select
to authenticated
using (
  "user_id" = (select auth.uid())::text
  or (select public.jwt_is_admin())
);
create policy "Admins can insert orders"
on "orders"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update orders"
on "orders"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete orders"
on "orders"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to order items" on "order_items";
drop policy if exists "Authenticated users can read own order items" on "order_items";
create policy "Authenticated users can read permitted order items"
on "order_items"
for select
to authenticated
using (
  (select public.jwt_is_admin())
  or exists (
    select 1
    from "orders"
    where "orders"."id" = "order_items"."order_id"
      and "orders"."user_id" = (select auth.uid())::text
  )
);
create policy "Admins can insert order items"
on "order_items"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update order items"
on "order_items"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete order items"
on "order_items"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to customer profiles" on "customer_profiles";
drop policy if exists "Customers can view own profile" on "customer_profiles";
drop policy if exists "Customers can create own profile" on "customer_profiles";
drop policy if exists "Customers can update own profile" on "customer_profiles";
create policy "Users and admins can read customer profiles"
on "customer_profiles"
for select
to authenticated
using (
  "user_id" = (select auth.uid())::text
  or (select public.jwt_is_admin())
);
create policy "Users and admins can insert customer profiles"
on "customer_profiles"
for insert
to authenticated
with check (
  "user_id" = (select auth.uid())::text
  or (select public.jwt_is_admin())
);
create policy "Users and admins can update customer profiles"
on "customer_profiles"
for update
to authenticated
using (
  "user_id" = (select auth.uid())::text
  or (select public.jwt_is_admin())
)
with check (
  "user_id" = (select auth.uid())::text
  or (select public.jwt_is_admin())
);
create policy "Admins can delete customer profiles"
on "customer_profiles"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access for store_settings" on "store_settings";
create policy "Admin full access for store_settings"
on "store_settings"
for all
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));

drop policy if exists "Admin full access for discounts" on "discounts";
create policy "Admin full access for discounts"
on "discounts"
for all
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));

drop policy if exists "Admin full access for discount_usages" on "discount_usages";
create policy "Admin full access for discount_usages"
on "discount_usages"
for all
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));

drop policy if exists "Admin full access for digital_product_files" on "digital_product_files";
create policy "Admin full access for digital_product_files"
on "digital_product_files"
for all
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to product detail blocks" on "product_detail_blocks";
drop policy if exists "Public can read visible product detail blocks" on "product_detail_blocks";
create policy "Public and admins can read product detail blocks"
on "product_detail_blocks"
for select
to anon, authenticated
using (
  (select public.jwt_is_admin())
  or (
    "enabled" = true
    and exists (
      select 1
      from "products"
      where "products"."id" = "product_detail_blocks"."product_id"
        and "products"."is_private" = false
    )
  )
);
create policy "Admins can insert product detail blocks"
on "product_detail_blocks"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update product detail blocks"
on "product_detail_blocks"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete product detail blocks"
on "product_detail_blocks"
for delete
to authenticated
using ((select public.jwt_is_admin()));

drop policy if exists "Admin full access to size guides" on "size_guides";
drop policy if exists "Public can read enabled size guides" on "size_guides";
create policy "Public and admins can read size guides"
on "size_guides"
for select
to anon, authenticated
using ("enabled" = true or (select public.jwt_is_admin()));
create policy "Admins can insert size guides"
on "size_guides"
for insert
to authenticated
with check ((select public.jwt_is_admin()));
create policy "Admins can update size guides"
on "size_guides"
for update
to authenticated
using ((select public.jwt_is_admin()))
with check ((select public.jwt_is_admin()));
create policy "Admins can delete size guides"
on "size_guides"
for delete
to authenticated
using ((select public.jwt_is_admin()));
