-- 052_sales_documents.sql
-- Phase 13 Batch G — Sales Quotation List, Sales Order List, Sales Delivery
-- List. Mirrors purchase_orders/po_items' shape (header + line-items table,
-- status progression, unique per-outlet document number) for the quotation
-- and order documents. Unlike purchase_orders (which has no RLS at all in
-- this codebase), every new table here gets proper RLS, consistent with
-- every other table added this phase.
--
-- "Convert to Invoice" (quotations) / "Fulfill" (orders) reuse the existing
-- create_invoice() RPC directly — quoted/ordered unit_price is honored via
-- the same per-item discount mechanism already used for Time-Based Pricing
-- (discount = current catalog price - quoted price, never a markup),
-- sequential and non-atomic with the header status update, same accepted
-- trade-off as PO receiving.

create table sales_quotations (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  customer_name varchar(255) not null,
  customer_phone varchar(20),
  quotation_number varchar(50) not null,
  quotation_date date not null default current_date,
  valid_until date,
  status varchar(20) not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  invoice_id uuid references invoices(id),
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, quotation_number)
);

create index idx_sales_quotations_outlet_id_status on sales_quotations(outlet_id, status);

create table sales_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references sales_quotations(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null check (quantity > 0),
  unit_price decimal(15,2) not null,
  subtotal decimal(15,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create index idx_sales_quotation_items_quotation_id on sales_quotation_items(quotation_id);

create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  customer_name varchar(255) not null,
  customer_phone varchar(20),
  order_number varchar(50) not null,
  order_date date not null default current_date,
  quotation_id uuid references sales_quotations(id),
  status varchar(20) not null default 'draft' check (status in ('draft', 'confirmed', 'fulfilled', 'cancelled')),
  invoice_id uuid references invoices(id),
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, order_number)
);

create index idx_sales_orders_outlet_id_status on sales_orders(outlet_id, status);

create table sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sales_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null check (quantity > 0),
  unit_price decimal(15,2) not null,
  subtotal decimal(15,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create index idx_sales_order_items_order_id on sales_order_items(order_id);

-- Manual entry, no courier API (disclosed in the UI) — tracks outbound
-- delivery of a completed sale (any invoice, not only ones that came
-- through a Sales Order).
create table sales_deliveries (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  courier_name varchar(255),
  tracking_number varchar(100),
  status varchar(20) not null default 'preparing' check (status in ('preparing', 'shipped', 'delivered')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_sales_deliveries_invoice_id on sales_deliveries(invoice_id);

alter table sales_quotations enable row level security;
create policy sales_quotations_select on sales_quotations for select using (user_can_access_outlet(outlet_id));
create policy sales_quotations_insert on sales_quotations for insert with check (user_can_access_outlet(outlet_id));
create policy sales_quotations_update on sales_quotations for update using (user_can_access_outlet(outlet_id));

alter table sales_quotation_items enable row level security;
create policy sales_quotation_items_access on sales_quotation_items
  for all using (exists (select 1 from sales_quotations q where q.id = quotation_id and user_can_access_outlet(q.outlet_id)));

alter table sales_orders enable row level security;
create policy sales_orders_select on sales_orders for select using (user_can_access_outlet(outlet_id));
create policy sales_orders_insert on sales_orders for insert with check (user_can_access_outlet(outlet_id));
create policy sales_orders_update on sales_orders for update using (user_can_access_outlet(outlet_id));

alter table sales_order_items enable row level security;
create policy sales_order_items_access on sales_order_items
  for all using (exists (select 1 from sales_orders o where o.id = order_id and user_can_access_outlet(o.outlet_id)));

alter table sales_deliveries enable row level security;
create policy sales_deliveries_access on sales_deliveries
  for all using (exists (select 1 from invoices i where i.id = invoice_id and user_can_access_outlet(i.outlet_id)));
