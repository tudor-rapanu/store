alter table "products"
  add column if not exists "publish_revalidated_at" timestamp;
