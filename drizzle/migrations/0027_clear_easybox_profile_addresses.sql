update "customer_profiles"
set
  "address" = '{}'::jsonb,
  "preferred_shipping_method" = 'address',
  "updated_at" = now()
where lower(coalesce("address" ->> 'street', '')) like 'easybox:%'
   or lower(coalesce("address" ->> 'street', '')) like '%easybox%id:%';
