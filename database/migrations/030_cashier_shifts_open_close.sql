-- 030_cashier_shifts_open_close.sql
-- cashier_shifts (006_hr_ops.sql) has sat unused since Phase 1: its schema
-- assumed the whole shift row is written after the fact (closing_cash was
-- `not null`), which doesn't support the real "declare starting cash now,
-- reconcile at close" workflow every retail register needs. Relaxes that
-- and adds explicit status + who-opened tracking (staff_id is nullable and
-- not reliably linked to the logged-in user — see Phase 7's commission
-- note — so this adds a real users FK instead).

alter table cashier_shifts alter column closing_cash drop not null;
alter table cashier_shifts add column status varchar(50) not null default 'open'; -- 'open', 'closed'
alter table cashier_shifts add column opened_by uuid references users(id);
