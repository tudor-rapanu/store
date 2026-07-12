alter table "orders"
add column if not exists "awb_label_url" text,
add column if not exists "awb_generated_at" timestamp,
add column if not exists "sameday_pickup_point_id" text,
add column if not exists "sameday_contact_person_id" text,
add column if not exists "sameday_service_id" text,
add column if not exists "sameday_package_type" text,
add column if not exists "sameday_awb_cost" integer,
add column if not exists "sameday_raw_response" jsonb;

create table if not exists "shipping_provider_tokens" (
  "provider" text primary key,
  "token" text not null,
  "expires_at" timestamp not null,
  "updated_at" timestamp not null default now()
);

create table if not exists "sameday_counties" (
  "id" integer primary key,
  "name" text not null,
  "raw_data" jsonb,
  "updated_at" timestamp not null default now()
);

create table if not exists "sameday_cities" (
  "id" integer primary key,
  "county_id" integer not null references "sameday_counties"("id"),
  "name" text not null,
  "postal_code" text,
  "raw_data" jsonb,
  "updated_at" timestamp not null default now()
);

create index if not exists "sameday_cities_county_id_idx"
on "sameday_cities" ("county_id");

create index if not exists "sameday_cities_name_idx"
on "sameday_cities" ("name");
