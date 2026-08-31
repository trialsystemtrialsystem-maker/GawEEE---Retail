-- 025_special_pricing_custom_fields.sql
-- Special Pricing Group (a customer_group -> product price override) and
-- Customer Custom Fields (staff-defined field labels + a jsonb value bag on
-- customers — a lightweight editor, not a full generic form-builder).

create table special_prices (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  group_id uuid not null references customer_groups(id) on delete cascade,
  product_id uuid not null references products(id),
  price decimal(15,2) not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique(group_id, product_id)
);

create index idx_special_prices_outlet_id on special_prices(outlet_id);

create table customer_field_definitions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  label varchar(100) not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table customers add column custom_fields jsonb not null default '{}';

alter table special_prices enable row level security;
create policy special_prices_select on special_prices for select using (user_can_access_outlet(outlet_id));
create policy special_prices_insert on special_prices for insert with check (user_can_access_outlet(outlet_id));
create policy special_prices_update on special_prices for update using (user_can_access_outlet(outlet_id));

alter table customer_field_definitions enable row level security;
create policy customer_field_definitions_select on customer_field_definitions for select using (user_can_access_outlet(outlet_id));
create policy customer_field_definitions_insert on customer_field_definitions for insert with check (user_can_access_outlet(outlet_id));
