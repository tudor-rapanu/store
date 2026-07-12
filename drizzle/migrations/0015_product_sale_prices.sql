alter table "products"
  add column if not exists "sale_price" integer,
  add column if not exists "sale_enabled" boolean not null default false,
  add column if not exists "sale_starts_at" timestamp,
  add column if not exists "sale_ends_at" timestamp;

alter table "product_variants"
  add column if not exists "sale_price" integer,
  add column if not exists "sale_enabled" boolean not null default false,
  add column if not exists "sale_starts_at" timestamp,
  add column if not exists "sale_ends_at" timestamp;

create index if not exists "products_sale_enabled_idx"
  on "products" ("sale_enabled");

create index if not exists "product_variants_sale_enabled_idx"
  on "product_variants" ("sale_enabled");
