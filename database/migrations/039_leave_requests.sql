-- 039_leave_requests.sql
-- Pengajuan Izin/Sakit/Libur — mirrors expense_requests
-- (018_employee_expansion.sql) exactly: self-service submit, manager+
-- decide. Keyed to users(id) directly (not staff_members), same
-- convention expense_requests already uses, so it works for any logged-in
-- account without needing the staff_members link migration 038 added.

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  leave_type varchar(50) not null, -- 'izin', 'sakit', 'libur'
  start_date date not null,
  end_date date not null,
  reason text not null,
  status varchar(50) not null default 'pending', -- 'pending', 'approved', 'rejected'
  requested_by uuid not null references users(id),
  decided_by uuid references users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_leave_requests_outlet_id_status on leave_requests(outlet_id, status);

alter table leave_requests enable row level security;
create policy leave_requests_select on leave_requests for select using (user_can_access_outlet(outlet_id));
create policy leave_requests_insert on leave_requests for insert with check (user_can_access_outlet(outlet_id));
create policy leave_requests_update on leave_requests for update using (user_can_access_outlet(outlet_id));
