create table if not exists "size_guides" (
  "id" uuid primary key default gen_random_uuid(),
  "slug" text not null unique,
  "title" jsonb not null,
  "description" jsonb,
  "image_url" text,
  "columns" jsonb not null default '[]'::jsonb,
  "rows" jsonb not null default '[]'::jsonb,
  "enabled" boolean not null default true,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);

create index if not exists "size_guides_enabled_idx"
on "size_guides" ("enabled");

create index if not exists "size_guides_slug_idx"
on "size_guides" ("slug");

alter table "products"
add column if not exists "size_guide_id" uuid references "size_guides"("id") on delete set null;

create index if not exists "products_size_guide_id_idx"
on "products" ("size_guide_id");

alter table "size_guides" enable row level security;

drop policy if exists "Public can read enabled size guides" on "size_guides";
create policy "Public can read enabled size guides"
on "size_guides"
for select
to anon, authenticated
using ("enabled" = true);

drop policy if exists "Admin full access to size guides" on "size_guides";
create policy "Admin full access to size guides"
on "size_guides"
for all
to authenticated
using (upper(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'ADMIN')
with check (upper(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'ADMIN');
