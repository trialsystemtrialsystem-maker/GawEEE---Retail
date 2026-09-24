-- 064_employee_history.sql
-- Employee 360 (todo.md Phase 33): kasbon (cash advances), daily incentives,
-- itemized payslip lines, and an employment-events timeline. Purely additive —
-- no existing table or function is changed except one new trigger on
-- staff_members that only ever INSERTs into the new staff_events table.
-- Run in the Supabase SQL Editor (after 063).

-- ---------------------------------------------------------------- KASBON
create table if not exists cash_advances (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  amount decimal(15,2) not null check (amount > 0),
  advance_date date not null default current_date,
  reason text not null,
  repay_per_period decimal(15,2) not null default 0 check (repay_per_period >= 0),
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'paid_out', 'repaid')),
  requested_by uuid references users(id),
  decided_by uuid references users(id),
  decided_at timestamptz,
  paid_out_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_cash_advances_staff on cash_advances(staff_id, advance_date desc);
create index if not exists idx_cash_advances_outlet_status on cash_advances(outlet_id, status);

create table if not exists cash_advance_repayments (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references cash_advances(id) on delete cascade,
  payslip_id uuid references payslips(id) on delete set null,
  amount decimal(15,2) not null check (amount > 0),
  repayment_date date not null default current_date,
  method varchar(20) not null default 'payroll' check (method in ('payroll', 'manual')),
  note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_cash_advance_repayments_advance on cash_advance_repayments(advance_id);

-- ------------------------------------------------------ INSENTIF HARIAN
create table if not exists incentive_rules (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(100) not null,
  metric varchar(30) not null check (metric in ('sales_target', 'transactions', 'attendance_bonus')),
  threshold decimal(15,2) not null default 0 check (threshold >= 0),
  amount decimal(15,2) not null check (amount >= 0),
  is_active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_incentive_rules_outlet on incentive_rules(outlet_id);

create table if not exists daily_incentives (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  incentive_date date not null,
  rule_id uuid references incentive_rules(id) on delete set null,
  rule_name varchar(100) not null,
  amount decimal(15,2) not null check (amount >= 0),
  basis jsonb not null default '{}',
  source varchar(10) not null default 'auto' check (source in ('auto', 'manual')),
  note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (staff_id, incentive_date, rule_id)
);
create index if not exists idx_daily_incentives_staff_date on daily_incentives(staff_id, incentive_date desc);

-- ------------------------------------------------- PAYSLIP LINE ITEMS
-- Itemized "why is this the amount" breakdown. payslips keeps its own
-- base_salary/commission_amount/deductions/net_pay so existing screens and
-- totals are unaffected; items are the explanation, written alongside.
create table if not exists payslip_items (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references payslips(id) on delete cascade,
  kind varchar(30) not null
    check (kind in ('base', 'commission', 'incentive', 'bonus', 'late_penalty', 'absence', 'kasbon', 'other_deduction')),
  label varchar(200) not null,
  amount decimal(15,2) not null check (amount >= 0), -- always positive; kind decides earning vs deduction
  basis jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_payslip_items_payslip on payslip_items(payslip_id);

-- ------------------------------------------------------ EMPLOYEE TIMELINE
create table if not exists staff_events (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  event_type varchar(30) not null
    check (event_type in ('hired', 'position_change', 'salary_change', 'contract_renewal', 'status_change', 'warning', 'note')),
  from_value jsonb,
  to_value jsonb,
  occurred_on date not null default current_date,
  note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_staff_events_staff on staff_events(staff_id, occurred_on desc);

-- Auto-log employment changes. SECURITY DEFINER so logging works regardless of
-- who edits; wrapped so a logging problem can never block editing a staff row.
create or replace function log_staff_events() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into staff_events (outlet_id, staff_id, event_type, to_value, occurred_on, created_by)
    values (new.outlet_id, new.id, 'hired', jsonb_build_object('position', new.position, 'salary', new.salary_amount), new.hire_date, auth.uid());
    return new;
  end if;

  if new.position is distinct from old.position then
    insert into staff_events (outlet_id, staff_id, event_type, from_value, to_value, created_by)
    values (new.outlet_id, new.id, 'position_change', to_jsonb(old.position), to_jsonb(new.position), auth.uid());
  end if;
  if new.salary_amount is distinct from old.salary_amount then
    insert into staff_events (outlet_id, staff_id, event_type, from_value, to_value, created_by)
    values (new.outlet_id, new.id, 'salary_change', to_jsonb(old.salary_amount), to_jsonb(new.salary_amount), auth.uid());
  end if;
  if new.status is distinct from old.status then
    insert into staff_events (outlet_id, staff_id, event_type, from_value, to_value, created_by)
    values (new.outlet_id, new.id, 'status_change', to_jsonb(old.status), to_jsonb(new.status), auth.uid());
  end if;
  if new.contract_end_date is distinct from old.contract_end_date or new.employment_status is distinct from old.employment_status then
    insert into staff_events (outlet_id, staff_id, event_type, from_value, to_value, created_by)
    values (new.outlet_id, new.id, 'contract_renewal',
      jsonb_build_object('employment_status', old.employment_status, 'contract_end_date', old.contract_end_date),
      jsonb_build_object('employment_status', new.employment_status, 'contract_end_date', new.contract_end_date), auth.uid());
  end if;
  return new;
exception when others then
  raise warning 'log_staff_events failed for staff %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_log_staff_events on staff_members;
create trigger trg_log_staff_events after insert or update on staff_members
  for each row execute function log_staff_events();

-- Backfill a "hired" event for existing staff so the timeline is never empty.
insert into staff_events (outlet_id, staff_id, event_type, to_value, occurred_on)
select s.outlet_id, s.id, 'hired', jsonb_build_object('position', s.position, 'salary', s.salary_amount), s.hire_date
from staff_members s
where not exists (select 1 from staff_events e where e.staff_id = s.id and e.event_type = 'hired');

-- ------------------------------------------------------------------- RLS
alter table cash_advances enable row level security;
create policy cash_advances_select on cash_advances for select using (user_can_access_outlet(outlet_id));
create policy cash_advances_insert on cash_advances for insert with check (user_can_access_outlet(outlet_id));
create policy cash_advances_update on cash_advances for update using (user_can_access_outlet(outlet_id));

alter table cash_advance_repayments enable row level security;
create policy cash_advance_repayments_select on cash_advance_repayments for select
  using (exists (select 1 from cash_advances a where a.id = advance_id and user_can_access_outlet(a.outlet_id)));
create policy cash_advance_repayments_insert on cash_advance_repayments for insert
  with check (exists (select 1 from cash_advances a where a.id = advance_id and user_can_access_outlet(a.outlet_id)));

alter table incentive_rules enable row level security;
create policy incentive_rules_select on incentive_rules for select using (user_can_access_outlet(outlet_id));
create policy incentive_rules_insert on incentive_rules for insert with check (user_can_access_outlet(outlet_id));
create policy incentive_rules_update on incentive_rules for update using (user_can_access_outlet(outlet_id));
create policy incentive_rules_delete on incentive_rules for delete using (user_can_access_outlet(outlet_id));

alter table daily_incentives enable row level security;
create policy daily_incentives_select on daily_incentives for select using (user_can_access_outlet(outlet_id));
create policy daily_incentives_insert on daily_incentives for insert with check (user_can_access_outlet(outlet_id));
create policy daily_incentives_update on daily_incentives for update using (user_can_access_outlet(outlet_id));
create policy daily_incentives_delete on daily_incentives for delete using (user_can_access_outlet(outlet_id));

alter table payslip_items enable row level security;
create policy payslip_items_select on payslip_items for select
  using (exists (select 1 from payslips p join payroll_runs r on r.id = p.payroll_run_id where p.id = payslip_id and user_can_access_outlet(r.outlet_id)));
create policy payslip_items_insert on payslip_items for insert
  with check (exists (select 1 from payslips p join payroll_runs r on r.id = p.payroll_run_id where p.id = payslip_id and user_can_access_outlet(r.outlet_id)));

alter table staff_events enable row level security;
create policy staff_events_select on staff_events for select using (user_can_access_outlet(outlet_id));
create policy staff_events_insert on staff_events for insert with check (user_can_access_outlet(outlet_id));
