create table if not exists "discounts" (
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "code" text unique,
  "kind" text not null default 'automatic',
  "type" text not null,
  "scope" text not null default 'storewide',
  "value" integer not null,
  "enabled" boolean not null default true,
  "starts_at" timestamp,
  "expires_at" timestamp,
  "product_id" uuid references "products"("id") on delete cascade,
  "category_id" uuid references "categories"("id") on delete cascade,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now(),
  constraint "discounts_kind_check" check ("kind" in ('automatic', 'voucher')),
  constraint "discounts_type_check" check ("type" in ('percentage', 'fixed')),
  constraint "discounts_scope_check" check ("scope" in ('storewide', 'category', 'product')),
  constraint "discounts_value_check" check ("value" > 0),
  constraint "discounts_voucher_code_check" check (
    ("kind" = 'automatic' and "code" is null)
    or ("kind" = 'voucher' and "code" is not null)
  )
);

create index if not exists "discounts_kind_enabled_idx"
on "discounts" ("kind", "enabled");

create index if not exists "discounts_code_idx"
on "discounts" ("code");

create index if not exists "discounts_product_id_idx"
on "discounts" ("product_id");

create index if not exists "discounts_category_id_idx"
on "discounts" ("category_id");

create table if not exists "discount_usages" (
  "id" uuid primary key default gen_random_uuid(),
  "discount_id" uuid not null references "discounts"("id") on delete cascade,
  "order_id" uuid references "orders"("id") on delete cascade,
  "user_id" text,
  "email" text not null,
  "created_at" timestamp not null default now()
);

create index if not exists "discount_usages_discount_email_idx"
on "discount_usages" ("discount_id", "email");

create index if not exists "discount_usages_discount_user_idx"
on "discount_usages" ("discount_id", "user_id");

alter table "orders"
add column if not exists "discount_amount" integer not null default 0,
add column if not exists "discount_snapshot" jsonb;

alter table "discounts" enable row level security;
alter table "discount_usages" enable row level security;

drop policy if exists "Admin full access for discounts" on "discounts";
create policy "Admin full access for discounts"
on "discounts"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

drop policy if exists "Admin full access for discount_usages" on "discount_usages";
create policy "Admin full access for discount_usages"
on "discount_usages"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());
