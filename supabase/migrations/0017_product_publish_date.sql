alter table "products"
  add column if not exists "publish_at" timestamp;

create index if not exists "products_publish_at_idx"
  on "products" ("publish_at");
