-- 003_sales_invoicing.sql
-- Invoices, line items, and payment transactions

create table invoices (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  invoice_number varchar(50) not null,
  customer_name varchar(255),
  customer_phone varchar(20),
  cashier_id uuid not null references users(id),
  subtotal decimal(15,2) not null,
  discount_amount decimal(15,2) not null default 0,
  discount_type varchar(50), -- 'fixed', 'percentage'
  discount_reason text,
  discount_approved_by uuid references users(id),
  tax_amount decimal(15,2) not null,
  total decimal(15,2) not null,
  payment_status varchar(50) not null default 'pending', -- 'pending', 'partial', 'paid'
  order_status varchar(50) not null default 'completed', -- 'draft', 'completed', 'voided'
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references users(id),
  void_reason text,
  unique(outlet_id, invoice_number)
);

create index idx_invoices_outlet_id_created_at on invoices(outlet_id, created_at);
create index idx_invoices_payment_status on invoices(payment_status);

-- INVOICE ITEMS (Line Items)
create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null,
  unit_price decimal(15,2) not null, -- price at time of sale (snapshot)
  item_discount decimal(15,2) not null default 0,
  subtotal decimal(15,2) generated always as (quantity * unit_price - item_discount) stored,
  cost_of_goods_sold decimal(15,2),
  created_at timestamptz not null default now()
);

create index idx_invoice_items_invoice_id on invoice_items(invoice_id);

-- PAYMENT TRANSACTIONS
create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  payment_method varchar(50) not null, -- 'cash', 'e_wallet', 'bank_transfer', 'card'
  payment_provider varchar(100), -- 'doku_pay', 'ovo', 'bank_bca', etc
  amount decimal(15,2) not null,
  status varchar(50) not null, -- 'pending', 'processing', 'settled', 'failed', 'refunded'
  payment_gateway_reference_id varchar(255),
  payment_date timestamptz,
  settlement_date timestamptz,
  settlement_amount decimal(15,2),
  gateway_fee decimal(15,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);

create index idx_payment_transactions_invoice_id_status on payment_transactions(invoice_id, status);
create index idx_payment_transactions_gateway_ref on payment_transactions(payment_gateway_reference_id);

-- VIRTUAL ACCOUNTS (Bank VA, referenced by the bank webhook flow in prd.md §5.2)
create table virtual_accounts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  va_number varchar(50) not null unique,
  bank varchar(50) not null,
  amount_expected decimal(15,2) not null,
  status varchar(50) not null default 'active', -- 'active', 'paid', 'expired', 'cancelled'
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_virtual_accounts_invoice_id on virtual_accounts(invoice_id);

-- PAYMENT GATEWAY RECONCILIATION
create table payment_reconciliation (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  reconciliation_date date not null,
  payment_provider varchar(100),
  method varchar(50), -- 'e_wallet', 'bank_va', 'card'
  gateway_total_amount decimal(15,2) not null default 0,
  gaweee_recorded_amount decimal(15,2) not null default 0,
  variance decimal(15,2) generated always as (gateway_total_amount - gaweee_recorded_amount) stored,
  status varchar(50) not null default 'pending', -- 'pending', 'matched', 'variance_noted'
  variance_explanation text,
  reconciled_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_invoices_updated_at before update on invoices
  for each row execute function set_updated_at();
create trigger trg_payment_transactions_updated_at before update on payment_transactions
  for each row execute function set_updated_at();
create trigger trg_payment_reconciliation_updated_at before update on payment_reconciliation
  for each row execute function set_updated_at();
