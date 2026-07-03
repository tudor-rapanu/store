alter table "orders"
add column if not exists "payment_amount" integer,
add column if not exists "payment_currency" text not null default 'RON',
add column if not exists "currency_exchange_rate" integer;

update "orders"
set
  "payment_amount" = coalesce("payment_amount", "total_amount"),
  "payment_currency" = coalesce("payment_currency", 'RON')
where "payment_amount" is null or "payment_currency" is null;

create index if not exists "orders_payment_currency_idx"
on "orders" ("payment_currency");
