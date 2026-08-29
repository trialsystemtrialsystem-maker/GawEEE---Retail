-- 006_hr_ops.sql
-- Staff, attendance, and cashier shift/cash reconciliation

create table staff_members (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  first_name varchar(100) not null,
  last_name varchar(100),
  email varchar(255),
  phone varchar(20),
  position varchar(100) not null, -- 'cashier', 'staff', 'supervisor'
  hire_date date not null,
  salary_amount decimal(15,2),
  salary_frequency varchar(50), -- 'monthly', 'daily'
  bank_account_name varchar(255),
  bank_account_number varchar(50),
  tax_id varchar(50),
  status varchar(50) not null default 'active',
  employment_status varchar(50), -- 'permanent', 'contract', 'casual'
  contract_end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_staff_members_outlet_id on staff_members(outlet_id);

-- ATTENDANCE
create table attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_members(id) on delete cascade,
  attendance_date date not null,
  clock_in_time timestamptz,
  clock_out_time timestamptz,
  status varchar(50) not null, -- 'present', 'absent', 'late', 'early_leave', 'half_day'
  notes text,
  created_at timestamptz not null default now(),
  unique(staff_id, attendance_date)
);

-- CASHIER SHIFTS & CASH RECONCILIATION
create table cashier_shifts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  staff_id uuid references staff_members(id),
  shift_date date not null,
  shift_start_time timestamptz,
  shift_end_time timestamptz,
  opening_cash decimal(15,2) not null,
  closing_cash decimal(15,2) not null,
  total_transactions decimal(15,2) not null default 0,
  expected_closing_cash decimal(15,2) generated always as (opening_cash + total_transactions) stored,
  cash_variance decimal(15,2) generated always as (closing_cash - (opening_cash + total_transactions)) stored,
  variance_percentage decimal(5,2),
  reconciled boolean not null default false,
  reconciled_by uuid references users(id),
  reconciliation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cashier_shifts_outlet_id_date on cashier_shifts(outlet_id, shift_date);

create trigger trg_staff_members_updated_at before update on staff_members
  for each row execute function set_updated_at();
create trigger trg_cashier_shifts_updated_at before update on cashier_shifts
  for each row execute function set_updated_at();
