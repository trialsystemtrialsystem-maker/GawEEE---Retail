-- 004_purchasing.sql
-- Purchase orders, receiving, and supplier invoices/payments
-- Note: the source PRD used `order_date DATE DEFAULT TODAY()`; Postgres has no
-- TODAY() function, the correct default is CURRENT_DATE.

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  po_number varchar(50) not null,
  order_date date not null default current_date,
  requested_delivery_date date,
  actual_delivery_date date,
  status varchar(50) not null default 'draft', -- 'draft', 'ordered', 'partial_received', 'received', 'cancelled'
  subtotal decimal(15,2),
  tax_amount decimal(15,2),
  total decimal(15,2),
  created_by uuid not null references users(id),
  approved_by uuid references users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, po_number)
);

create index idx_purchase_orders_outlet_id_status on purchase_orders(outlet_id, status);

-- PO ITEMS
create table po_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity_ordered int not null,
  quantity_received int not null default 0,
  quantity_remaining int generated always as (quantity_ordered - quantity_received) stored,
  unit_cost decimal(15,2) not null,
  subtotal decimal(15,2) generated always as (quantity_ordered * unit_cost) stored,
  line_notes text,
  created_at timestamptz not null default now()
);

create index idx_po_items_po_id on po_items(po_id);

-- PURCHASE INVOICES (From Supplier)
create table purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id),
  supplier_id uuid not null references suppliers(id),
  invoice_number varchar(50) not null,
  invoice_date date not null,
  due_date date not null,
  subtotal decimal(15,2),
  tax_amount decimal(15,2),
  total decimal(15,2),
  payment_status varchar(50) not null default 'unpaid', -- 'unpaid', 'partial', 'paid'
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_purchase_invoices_supplier_id on purchase_invoices(supplier_id);
create index idx_purchase_invoices_payment_status on purchase_invoices(payment_status);

-- PURCHASE PAYMENTS
create table purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references purchase_invoices(id) on delete cascade,
  payment_date date not null,
  amount decimal(15,2) not null,
  payment_method varchar(50), -- 'cash', 'bank_transfer', 'check'
  reference_number varchar(100),
  notes text,
  recorded_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_purchase_payments_invoice_id on purchase_payments(purchase_invoice_id);

create trigger trg_purchase_orders_updated_at before update on purchase_orders
  for each row execute function set_updated_at();
create trigger trg_purchase_invoices_updated_at before update on purchase_invoices
  for each row execute function set_updated_at();
