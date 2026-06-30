create table if not exists "customer_profiles" (
  "user_id" text primary key,
  "email" text not null,
  "first_name" text,
  "last_name" text,
  "phone" text,
  "address" jsonb not null default '{}'::jsonb,
  "preferred_shipping_method" text not null default 'address',
  "marketing_opt_in" boolean not null default false,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);

alter table "customer_profiles" enable row level security;

drop policy if exists "Customers can view own profile" on "customer_profiles";
create policy "Customers can view own profile"
on "customer_profiles"
for select
to authenticated
using ("user_id" = auth.uid()::text);

drop policy if exists "Customers can create own profile" on "customer_profiles";
create policy "Customers can create own profile"
on "customer_profiles"
for insert
to authenticated
with check ("user_id" = auth.uid()::text);

drop policy if exists "Customers can update own profile" on "customer_profiles";
create policy "Customers can update own profile"
on "customer_profiles"
for update
to authenticated
using ("user_id" = auth.uid()::text)
with check ("user_id" = auth.uid()::text);

drop policy if exists "Admin full access to customer profiles" on "customer_profiles";
create policy "Admin full access to customer profiles"
on "customer_profiles"
for all
to authenticated
using (upper(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'ADMIN')
with check (upper(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'ADMIN');
