-- 038_staff_self_service_link.sql
-- Phase 12 — links a login (`users`) account to its HR roster row
-- (`staff_members`), so a logged-in cashier/staff member can find "my own"
-- attendance record for self-service clock-in/out (Absensi Harian) without
-- a manager doing it on their behalf. staff_members has never had this link
-- (it's a separate payroll/HR roster, not tied to auth) — see Phase 12 plan
-- for why this is the one self-service feature that reuses the existing
-- table instead of a parallel one keyed to users(id) directly.

alter table staff_members add column user_id uuid references users(id);
create index idx_staff_members_user_id on staff_members(user_id);

-- Best-effort backfill: match existing staff_members to users by email
-- within the same outlet. Safe no-op wherever there's no match.
update staff_members sm
set user_id = u.id
from users u
where sm.user_id is null
  and sm.email is not null
  and u.email = sm.email
  and u.outlet_id = sm.outlet_id;
