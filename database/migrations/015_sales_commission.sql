-- 015_sales_commission.sql
-- Adds a per-cashier commission rate, used by the Sales Dashboard's
-- "Commission per Cashier" report (commission = rate * that cashier's sales
-- total for the selected period). Nullable/defaults to 0 so existing staff
-- rows are unaffected until an owner sets a rate.

alter table staff_members add column commission_rate decimal(5,4) not null default 0;
