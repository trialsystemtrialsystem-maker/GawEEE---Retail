-- 019_customers.sql
-- A real customer directory (distinct from the free-text customer_name/phone
-- already on invoices) — the Sales > Customer > "Customer List" menu item
-- from the reference mockup. Starts empty; not auto-populated from invoice
-- customer_name strings since those are free-text and not a reliable match
-- key (typos, "Bu Siti" vs "Siti", walk-in customers with no name, etc).

create table customers (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(255) not null,
  phone varchar(20),
  email varchar(255),
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customers_outlet_id on customers(outlet_id);

create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();

alter table customers enable row level security;
create policy customers_select on customers
  for select using (user_can_access_outlet(outlet_id));
create policy customers_insert on customers
  for insert with check (user_can_access_outlet(outlet_id));
create policy customers_update on customers
  for update using (user_can_access_outlet(outlet_id));
