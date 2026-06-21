alter table "products"
add column if not exists "is_private" boolean not null default false;
