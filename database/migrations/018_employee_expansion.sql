-- 018_employee_expansion.sql
-- Fills out the Employee module (mockup images 6-12), scoped down from a full
-- HRIS to what's real and useful for a UMKM retailer, reusing staff_members/
-- attendance/cashier_shifts from 006_hr_ops.sql:
--   - payroll_runs / payslips: simple period-based payroll generation
--   - position_levels: master data for staff position (replaces free-text
--     `position` for structured reporting; `position` stays for backward compat)
--   - shifts / staff_schedules: shift definitions + weekly assignment
--   - staff_announcements: in-app announcement log (no real push notifications)
--   - expense_requests: minimal manual expense approval flow
--   - staff_members: + position_level_id, pin_code (quick cashier switching)
--   - outlets: + geofence columns (Radius Absensi)

alter table staff_members add column position_level_id uuid;
alter table staff_members add column pin_code varchar(6);

alter table outlets add column geofence_lat decimal(10,7);
alter table outlets add column geofence_lng decimal(10,7);
alter table outlets add column geofence_radius_m int;

create table position_levels (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(100) not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table staff_members
  add constraint fk_staff_members_position_level
  foreign key (position_level_id) references position_levels(id);

create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status varchar(50) not null default 'draft', -- 'draft', 'paid'
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references payroll_runs(id) on delete cascade,
  staff_id uuid not null references staff_members(id),
  base_salary decimal(15,2) not null default 0,
  commission_amount decimal(15,2) not null default 0,
  deductions decimal(15,2) not null default 0,
  net_pay decimal(15,2) generated always as (base_salary + commission_amount - deductions) stored,
  created_at timestamptz not null default now()
);

create index idx_payslips_payroll_run_id on payslips(payroll_run_id);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(100) not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

create table staff_schedules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_members(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  work_date date not null,
  created_at timestamptz not null default now(),
  unique(staff_id, work_date)
);

create index idx_staff_schedules_work_date on staff_schedules(work_date);

create table staff_announcements (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  message text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table expense_requests (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  description varchar(255) not null,
  amount decimal(15,2) not null,
  requested_by uuid not null references users(id),
  status varchar(50) not null default 'pending', -- 'pending', 'approved', 'rejected'
  approved_by uuid references users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS: same outlet-scoped shape used throughout 010_rls_policies.sql / later modules.
do $$
declare
  t text;
  new_tables text[] := array[
    'position_levels', 'payroll_runs', 'shifts', 'staff_announcements', 'expense_requests'
  ];
begin
  foreach t in array new_tables loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for select using (user_can_access_outlet(outlet_id));',
      t || '_select', t
    );
    execute format(
      'create policy %I on %I for insert with check (user_can_access_outlet(outlet_id));',
      t || '_insert', t
    );
    execute format(
      'create policy %I on %I for update using (user_can_access_outlet(outlet_id));',
      t || '_update', t
    );
  end loop;
end $$;

alter table payslips enable row level security;
create policy payslips_access on payslips
  for all using (
    exists (select 1 from payroll_runs pr where pr.id = payroll_run_id and user_can_access_outlet(pr.outlet_id))
  );

alter table staff_schedules enable row level security;
create policy staff_schedules_access on staff_schedules
  for all using (
    exists (select 1 from staff_members sm where sm.id = staff_id and user_can_access_outlet(sm.outlet_id))
  );
