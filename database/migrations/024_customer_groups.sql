-- 024_customer_groups.sql
-- Customer Group (Sales > Customer menu) + a group_id link on the existing
-- customers table (019_customers.sql). Also lays the groundwork Special
-- Pricing Group (a later Phase 10 item) needs — a price override always
-- targets a customer_group, never an individual customer.

create table customer_groups (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(100) not null,
  description text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_customer_groups_outlet_id on customer_groups(outlet_id);

alter table customers add column group_id uuid references customer_groups(id);

alter table customer_groups enable row level security;
create policy customer_groups_select on customer_groups for select using (user_can_access_outlet(outlet_id));
create policy customer_groups_insert on customer_groups for insert with check (user_can_access_outlet(outlet_id));
create policy customer_groups_update on customer_groups for update using (user_can_access_outlet(outlet_id));
