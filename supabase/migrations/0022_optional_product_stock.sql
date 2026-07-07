alter table "products"
add column if not exists "track_stock" boolean not null default false,
add column if not exists "stock" integer not null default 0;

alter table "product_variants"
add column if not exists "track_stock" boolean not null default false;

alter table "orders"
add column if not exists "stock_reduced_at" timestamp;

create index if not exists "products_track_stock_idx"
on "products" ("track_stock");

create index if not exists "product_variants_track_stock_idx"
on "product_variants" ("track_stock");
