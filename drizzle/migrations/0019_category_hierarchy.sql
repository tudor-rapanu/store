alter table "categories"
add column if not exists "parent_id" uuid references "categories"("id") on delete set null;

create index if not exists "categories_parent_id_idx"
on "categories" ("parent_id");
