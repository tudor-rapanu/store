create table if not exists "product_detail_blocks" (
  "id" uuid primary key default gen_random_uuid(),
  "product_id" uuid not null references "products"("id") on delete cascade,
  "icon" text not null,
  "label" jsonb not null,
  "value" jsonb not null,
  "sort_order" integer not null default 0,
  "enabled" boolean not null default true,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);

create index if not exists "product_detail_blocks_product_id_sort_idx"
on "product_detail_blocks" ("product_id", "sort_order");

create index if not exists "product_detail_blocks_enabled_idx"
on "product_detail_blocks" ("enabled");

alter table "product_detail_blocks" enable row level security;

drop policy if exists "Public can read visible product detail blocks" on "product_detail_blocks";
create policy "Public can read visible product detail blocks"
on "product_detail_blocks"
for select
to anon, authenticated
using (
  "enabled" = true
  and exists (
    select 1
    from "products"
    where "products"."id" = "product_detail_blocks"."product_id"
    and "products"."is_private" = false
  )
);

drop policy if exists "Admin full access to product detail blocks" on "product_detail_blocks";
create policy "Admin full access to product detail blocks"
on "product_detail_blocks"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());
