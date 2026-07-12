alter table "products"
add column if not exists "is_digital" boolean not null default false;

create index if not exists "products_is_digital_idx"
on "products" ("is_digital");

create table if not exists "digital_product_files" (
  "id" uuid primary key default gen_random_uuid(),
  "product_id" uuid not null references "products"("id") on delete cascade,
  "file_name" text not null,
  "storage_key" text not null,
  "content_type" text not null,
  "file_size" integer not null,
  "created_at" timestamp not null default now()
);

create index if not exists "digital_product_files_product_id_idx"
on "digital_product_files" ("product_id");

alter table "digital_product_files" enable row level security;

drop policy if exists "Admin full access for digital_product_files" on "digital_product_files";
create policy "Admin full access for digital_product_files"
on "digital_product_files"
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN');
