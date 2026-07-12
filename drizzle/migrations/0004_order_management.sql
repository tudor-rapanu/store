create extension if not exists "pgcrypto";

create sequence if not exists "orders_order_number_seq" start with 1001;

alter table "orders"
add column if not exists "order_number" integer,
add column if not exists "user_id" text,
add column if not exists "access_token" text,
add column if not exists "payment_method" text not null default 'card',
add column if not exists "payment_status" text not null default 'pending',
add column if not exists "fulfillment_status" text not null default 'new',
add column if not exists "shipping_method" text not null default 'address',
add column if not exists "awb_number" text,
add column if not exists "tracking_url" text,
add column if not exists "admin_notes" text,
add column if not exists "customer_notes" text,
add column if not exists "invoice_status" text not null default 'not_generated',
add column if not exists "invoice_number" text,
add column if not exists "invoice_url" text,
add column if not exists "fgo_invoice_id" text,
add column if not exists "cancel_requested_at" timestamp;

with numbered_orders as (
  select
    "id",
    row_number() over (order by "created_at", "id") + 1000 as "generated_order_number"
  from "orders"
  where "order_number" is null
)
update "orders"
set "order_number" = numbered_orders."generated_order_number"
from numbered_orders
where "orders"."id" = numbered_orders."id";

update "orders"
set "access_token" = encode("extensions"."gen_random_bytes"(32), 'hex')
where "access_token" is null;

select setval(
  'orders_order_number_seq',
  greatest(
    coalesce((select max("order_number") from "orders"), 1000),
    1000
  )
);

alter table "orders"
alter column "order_number" set default nextval('orders_order_number_seq'),
alter column "order_number" set not null,
alter column "access_token" set not null;

create unique index if not exists "orders_order_number_unique"
on "orders" ("order_number");

create unique index if not exists "orders_access_token_unique"
on "orders" ("access_token");

create index if not exists "orders_customer_email_idx"
on "orders" ("customer_email");

create index if not exists "orders_user_id_idx"
on "orders" ("user_id");

create index if not exists "orders_payment_status_idx"
on "orders" ("payment_status");

create index if not exists "orders_fulfillment_status_idx"
on "orders" ("fulfillment_status");

alter table "order_items"
add column if not exists "product_id" uuid;

update "order_items"
set "product_id" = "product_variants"."product_id"
from "product_variants"
where "order_items"."variant_id" = "product_variants"."id"
and "order_items"."product_id" is null;

alter table "order_items"
alter column "variant_id" drop not null;

delete from "order_items"
where "product_id" is null;

alter table "order_items"
alter column "product_id" set not null;

do $$
begin
  if not exists (
    select 1
    from "pg_constraint"
    where "conname" = 'order_items_product_id_products_id_fk'
  ) then
    alter table "order_items"
    add constraint "order_items_product_id_products_id_fk"
    foreign key ("product_id") references "public"."products"("id")
    on delete no action on update no action;
  end if;
end $$;
