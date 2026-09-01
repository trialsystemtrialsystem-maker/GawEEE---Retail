-- 034_product_units.sql
-- Multi-UOM ("Satuan Ganda") — a product can additionally be sold as a
-- larger unit (e.g. "Dus" = 24 pcs) at its own price, alongside its base
-- unit. create_invoice() needs zero changes: the POS API layer converts a
-- bulk-unit add into an ordinary base-unit quantity plus a per-item
-- discount (create_invoice() already supports both — see p_items'
-- `discount?` field in 012_create_invoice_function.sql) equal to the gap
-- between the product's normal price for that quantity and what the bulk
-- unit actually charges.
--
-- sold_unit_label/sold_unit_quantity are cosmetic/receipt-display only, not
-- financially load-bearing (the real charge is the base-quantity + discount
-- above) — filled by a follow-up UPDATE from the invoices API route after
-- create_invoice() returns, same non-atomic-follow-up trade-off already
-- used for PO receiving elsewhere in this codebase.

create table product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  unit_label varchar(50) not null,
  conversion_to_base int not null,
  unit_price decimal(15,2) not null,
  created_at timestamptz not null default now(),
  check (conversion_to_base > 1)
);

create index idx_product_units_product_id on product_units(product_id);

alter table product_units enable row level security;
create policy product_units_access on product_units
  for all using (exists (select 1 from products p where p.id = product_id and p.company_id = current_user_company_id()));

alter table invoice_items add column sold_unit_label varchar(50);
alter table invoice_items add column sold_unit_quantity int;
