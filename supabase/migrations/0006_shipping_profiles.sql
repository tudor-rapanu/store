alter table "orders"
add column if not exists "subtotal_amount" integer not null default 0,
add column if not exists "shipping_amount" integer not null default 0;

update "orders"
set "subtotal_amount" = "total_amount"
where "subtotal_amount" = 0;

create table if not exists "shipping_profiles" (
  "id" text primary key,
  "name" text not null,
  "method" text not null,
  "price" integer not null,
  "free_shipping_threshold" integer not null default 15000,
  "enabled" boolean not null default true,
  "updated_at" timestamp not null default now()
);

insert into "shipping_profiles" (
  "id",
  "name",
  "method",
  "price",
  "free_shipping_threshold",
  "enabled"
) values
  ('local_easybox', 'Easybox / PUDO', 'easybox', 1500, 15000, true),
  ('local_address', 'Home Address', 'address', 2500, 15000, true)
on conflict ("id") do nothing;
