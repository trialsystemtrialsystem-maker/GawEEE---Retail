-- 048_product_deposits.sql
-- Phase 13 Batch D — Product Deposits + Deposit Report. Outlet-scoped (a
-- deposit is a specific customer paying ahead for pickup at a specific
-- outlet, matching bookings'/customer_reviews' scoping, not products').
-- Fulfilling is a manual log-status change, not an automatic invoice
-- creation — the actual sale still goes through the normal POS separately
-- (same "tracking log, not deep checkout integration" scoping as Bookings).

create table product_deposits (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  customer_name varchar(255) not null,
  customer_phone varchar(20),
  product_id uuid not null references products(id),
  quantity int not null check (quantity > 0),
  deposit_amount decimal(15,2) not null,
  total_price decimal(15,2) not null,
  status varchar(20) not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_product_deposits_outlet_id on product_deposits(outlet_id);

alter table product_deposits enable row level security;
create policy product_deposits_select on product_deposits for select using (user_can_access_outlet(outlet_id));
create policy product_deposits_insert on product_deposits for insert with check (user_can_access_outlet(outlet_id));
create policy product_deposits_update on product_deposits for update using (user_can_access_outlet(outlet_id));
