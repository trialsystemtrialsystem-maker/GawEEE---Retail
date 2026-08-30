-- 017_bookings.sql
-- Pre-order & pickup scheduling — reframed from the reference mockup's
-- literal "laundry appointment" into something that fits retail (bakery
-- custom-cake pre-orders, bulk frozen-food reservations, etc.) while keeping
-- the same table shape: date, time, customer, item/service, staff, status.

create table bookings (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  customer_name varchar(255) not null,
  customer_phone varchar(20),
  item_description varchar(255) not null,
  staff_id uuid references staff_members(id),
  scheduled_date date not null,
  scheduled_start_time time not null,
  scheduled_end_time time,
  status varchar(50) not null default 'pending', -- 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_outlet_id_date on bookings(outlet_id, scheduled_date);

create trigger trg_bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

alter table bookings enable row level security;
create policy bookings_select on bookings
  for select using (user_can_access_outlet(outlet_id));
create policy bookings_insert on bookings
  for insert with check (user_can_access_outlet(outlet_id));
create policy bookings_update on bookings
  for update using (user_can_access_outlet(outlet_id));
