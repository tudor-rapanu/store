create table if not exists "store_settings" (
  "key" text primary key,
  "value" jsonb not null default '{}'::jsonb,
  "updated_at" timestamp not null default now()
);

alter table "store_settings" enable row level security;

drop policy if exists "Admin full access for store_settings" on "store_settings";
create policy "Admin full access for store_settings"
on "store_settings"
for all
to authenticated
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

insert into "shipping_profiles" (
  "id",
  "name",
  "method",
  "price",
  "free_shipping_threshold",
  "enabled",
  "updated_at"
)
values (
  'international_posta_romana',
  'Posta Romana International',
  'international',
  7500,
  999999999,
  true,
  now()
)
on conflict ("id") do nothing;

insert into "store_settings" ("key", "value", "updated_at")
values ('currency', '{"ronToEurRate": 0.2}'::jsonb, now())
on conflict ("key") do nothing;
