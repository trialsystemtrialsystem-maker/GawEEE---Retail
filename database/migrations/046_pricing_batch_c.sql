-- 046_pricing_batch_c.sql
-- Phase 13 Batch C — Price Scheduler, Time-Based Pricing, Ojek Online Price
-- List. All company-scoped (products are company-scoped, not
-- outlet-scoped), matching the pattern used for departments/modifiers.

-- Item 7: Price Scheduler. No real cron exists in this app (confirmed) —
-- honestly scoped: due schedules (effective_date <= today AND NOT applied)
-- get applied via a check-on-page-load API call from the schedule list
-- page, updating products.selling_price directly and marking applied=true.
-- Disclosed in the UI as check-on-open, not a real-time cron.
create table price_schedules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  new_price decimal(15,2) not null,
  effective_date date not null,
  applied boolean not null default false,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_price_schedules_product_id on price_schedules(product_id);

alter table price_schedules enable row level security;
create policy price_schedules_access on price_schedules
  for all using (exists (select 1 from products p where p.id = product_id and p.company_id = current_user_company_id()));

-- Item 8: Time-Based Pricing. POS checks for an active time-window price at
-- add-time and, if lower than the catalog price, applies the gap as a
-- per-item discount (same trick as Bundling/Multi-UOM) — only ever
-- discounts, never marks up, so create_invoice() needs no changes.
create table time_based_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  price decimal(15,2) not null,
  day_of_week smallint, -- null = every day; 0=Sunday .. 6=Saturday
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_time_based_prices_product_id on time_based_prices(product_id);

alter table time_based_prices enable row level security;
create policy time_based_prices_access on time_based_prices
  for all using (exists (select 1 from products p where p.id = product_id and p.company_id = current_user_company_id()));

-- Item 9: Ojek Online Price List. Pure reference list for staff to consult
-- when manually keying a channel order into the existing online_orders log
-- (confirmed disconnected from product_id — no live integration exists or
-- is being added here) — no checkout wiring.
create table channel_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  channel varchar(20) not null check (channel in ('gofood', 'grabfood', 'shopeefood', 'other')),
  price decimal(15,2) not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique(product_id, channel)
);

create index idx_channel_prices_product_id on channel_prices(product_id);

alter table channel_prices enable row level security;
create policy channel_prices_access on channel_prices
  for all using (exists (select 1 from products p where p.id = product_id and p.company_id = current_user_company_id()));
