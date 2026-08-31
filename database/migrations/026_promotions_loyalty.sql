-- 026_promotions_loyalty.sql
-- Promotion, Coupon, and Loyalty/Point Reward — scoped down per the plan:
-- staff apply these manually at checkout (this migration/API just exposes
-- the data), no automatic discount-rules engine or POS auto-apply.

create table promotions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(255) not null,
  discount_type varchar(20) not null, -- 'percentage', 'fixed'
  discount_value decimal(15,2) not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_promotions_outlet_id on promotions(outlet_id);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  code varchar(50) not null,
  discount_type varchar(20) not null, -- 'percentage', 'fixed'
  discount_value decimal(15,2) not null,
  usage_limit int,
  usage_count int not null default 0,
  expires_at date,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique(outlet_id, code)
);

create index idx_coupons_outlet_id on coupons(outlet_id);

-- Loyalty config lives directly on outlets (two small settings, not worth a
-- separate table): earn `loyalty_points_per_1000` points per Rp1,000 spent,
-- redeem 1 point for `loyalty_rp_per_point` Rupiah off.
alter table outlets add column loyalty_points_per_1000 int not null default 1;
alter table outlets add column loyalty_rp_per_point int not null default 100;

create table loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  points_change int not null,
  reason text not null,
  recorded_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_loyalty_ledger_customer_id on loyalty_ledger(customer_id);

alter table promotions enable row level security;
create policy promotions_select on promotions for select using (user_can_access_outlet(outlet_id));
create policy promotions_insert on promotions for insert with check (user_can_access_outlet(outlet_id));
create policy promotions_update on promotions for update using (user_can_access_outlet(outlet_id));

alter table coupons enable row level security;
create policy coupons_select on coupons for select using (user_can_access_outlet(outlet_id));
create policy coupons_insert on coupons for insert with check (user_can_access_outlet(outlet_id));
create policy coupons_update on coupons for update using (user_can_access_outlet(outlet_id));

alter table loyalty_ledger enable row level security;
create policy loyalty_ledger_access on loyalty_ledger
  for all using (
    exists (select 1 from customers c where c.id = customer_id and user_can_access_outlet(c.outlet_id))
  );
