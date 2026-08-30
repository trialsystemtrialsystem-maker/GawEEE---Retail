-- 016_online_orders.sql
-- Manual-entry online order log: staff record orders received via WhatsApp/
-- Instagram/marketplace (no live channel integration exists) and track them
-- through a delivery-style status workflow.

create table online_orders (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  order_number varchar(50) not null,
  channel varchar(50) not null default 'other', -- 'whatsapp', 'instagram', 'marketplace', 'other'
  customer_name varchar(255) not null,
  customer_phone varchar(20),
  items jsonb not null default '[]', -- [{name, quantity, price}, ...] — free-form, not tied to product_id
  total_amount decimal(15,2) not null,
  status varchar(50) not null default 'incoming', -- 'incoming', 'on_process', 'on_delivery', 'completed', 'cancelled'
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, order_number)
);

create index idx_online_orders_outlet_id_status on online_orders(outlet_id, status);

create trigger trg_online_orders_updated_at before update on online_orders
  for each row execute function set_updated_at();

alter table online_orders enable row level security;
create policy online_orders_select on online_orders
  for select using (user_can_access_outlet(outlet_id));
create policy online_orders_insert on online_orders
  for insert with check (user_can_access_outlet(outlet_id));
create policy online_orders_update on online_orders
  for update using (user_can_access_outlet(outlet_id));
