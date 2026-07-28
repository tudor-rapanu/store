alter table "orders"
add column if not exists "checkout_idempotency_key" text;

alter table "orders"
add column if not exists "payment_url" text;

create unique index if not exists "orders_checkout_idempotency_key_uidx"
on "orders" ("checkout_idempotency_key")
where "checkout_idempotency_key" is not null;
