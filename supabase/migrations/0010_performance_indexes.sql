create index if not exists "products_is_private_idx"
on "public"."products" ("is_private");

create index if not exists "products_created_at_idx"
on "public"."products" ("created_at");

create index if not exists "product_variants_product_id_idx"
on "public"."product_variants" ("product_id");

create index if not exists "product_categories_category_id_idx"
on "public"."product_categories" ("category_id");

create index if not exists "orders_user_id_created_at_idx"
on "public"."orders" ("user_id", "created_at");

create index if not exists "orders_created_at_idx"
on "public"."orders" ("created_at");

create index if not exists "orders_payment_status_idx"
on "public"."orders" ("payment_status");

create index if not exists "orders_fulfillment_status_idx"
on "public"."orders" ("fulfillment_status");

create index if not exists "orders_payment_method_idx"
on "public"."orders" ("payment_method");

create index if not exists "orders_customer_email_idx"
on "public"."orders" ("customer_email");

create index if not exists "orders_awb_number_idx"
on "public"."orders" ("awb_number");

create index if not exists "shipping_profiles_method_enabled_idx"
on "public"."shipping_profiles" ("method", "enabled");

create index if not exists "customer_profiles_email_idx"
on "public"."customer_profiles" ("email");

create index if not exists "order_items_order_id_idx"
on "public"."order_items" ("order_id");

create index if not exists "order_items_product_id_idx"
on "public"."order_items" ("product_id");

create index if not exists "order_items_variant_id_idx"
on "public"."order_items" ("variant_id");

create index if not exists "sameday_counties_name_idx"
on "public"."sameday_counties" ("name");

create index if not exists "sameday_cities_county_id_name_idx"
on "public"."sameday_cities" ("county_id", "name");

create index if not exists "sameday_cities_postal_code_idx"
on "public"."sameday_cities" ("postal_code");
