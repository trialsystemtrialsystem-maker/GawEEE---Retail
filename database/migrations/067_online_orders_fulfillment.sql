-- 067_online_orders_fulfillment.sql
-- Online Orders v2: an order now leaves a real trail. Moving it to "diproses"
-- creates a real invoice (stock deducted, revenue + journals via create_invoice),
-- so channel sales finally show up in sales/finance reports; cancelling voids it.
-- Additive columns only. Run in the Supabase SQL Editor (after 066).

alter table online_orders add column if not exists invoice_id uuid references invoices(id) on delete set null;
alter table online_orders add column if not exists payment_method varchar(20) not null default 'bank_transfer'
  check (payment_method in ('cash', 'bank_transfer', 'e_wallet', 'cod'));
alter table online_orders add column if not exists payment_status varchar(10) not null default 'unpaid'
  check (payment_status in ('unpaid', 'paid'));
alter table online_orders add column if not exists shipping_fee decimal(15,2) not null default 0 check (shipping_fee >= 0);
alter table online_orders add column if not exists external_ref varchar(100);
alter table online_orders add column if not exists delivery_address text;
alter table online_orders add column if not exists courier varchar(60);
alter table online_orders add column if not exists tracking_number varchar(100);
alter table online_orders add column if not exists cancel_reason text;

create index if not exists idx_online_orders_invoice on online_orders(invoice_id);
