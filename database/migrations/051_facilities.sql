-- 051_facilities.sql
-- Phase 13 Batch F — Product Facility + Facility Report. Extends the
-- existing Bookings module with a bookable resource entity (name, capacity)
-- rather than adding a separate booking system.

create table facilities (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(255) not null,
  capacity int,
  description text,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_facilities_outlet_id on facilities(outlet_id);

alter table bookings add column facility_id uuid references facilities(id) on delete set null;

alter table facilities enable row level security;
create policy facilities_select on facilities for select using (user_can_access_outlet(outlet_id));
create policy facilities_insert on facilities for insert with check (user_can_access_outlet(outlet_id));
create policy facilities_update on facilities for update using (user_can_access_outlet(outlet_id));
