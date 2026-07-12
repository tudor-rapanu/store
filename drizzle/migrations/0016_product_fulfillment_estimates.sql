alter table "products"
  add column if not exists "production_min_days" integer not null default 1,
  add column if not exists "production_max_days" integer not null default 3,
  add column if not exists "preorder_enabled" boolean not null default false,
  add column if not exists "preorder_ship_date" timestamp;

alter table "orders"
  add column if not exists "estimated_shipping_start" timestamp,
  add column if not exists "estimated_shipping_end" timestamp;
