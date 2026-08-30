-- ============================================================
-- 001_core_tenancy.sql
-- ============================================================
-- 001_core_tenancy.sql
-- Companies, outlets, and users (tenant root + access control)

create extension if not exists pgcrypto;

-- COMPANIES (Tenant Root)
create table companies (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  tier varchar(50) not null, -- 'starter', 'professional', 'enterprise'
  subscription_status varchar(50) not null default 'trial', -- 'active', 'trial', 'suspended'
  subscription_start_date timestamptz not null default now(),
  subscription_end_date timestamptz,
  billing_email varchar(255) not null,
  billing_phone varchar(20),
  industry varchar(100), -- 'frozen_food', 'bakery', 'minimarket', etc
  country_code varchar(2) default 'ID',
  currency varchar(3) default 'IDR',
  tax_id varchar(50), -- NPWP
  tax_rate decimal(5,2) default 10.0, -- PPN %
  logo_url text,
  brand_color varchar(7) default '#1F2937',
  brand_secondary_color varchar(7) default '#3B82F6',
  timezone varchar(50) default 'Asia/Jakarta',
  settings jsonb not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- OUTLETS (Physical Locations)
create table outlets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name varchar(255) not null,
  address text not null,
  city varchar(100) not null,
  province varchar(100),
  postal_code varchar(10),
  phone varchar(20),
  manager_id uuid, -- FK to users added after users table exists
  bank_account_name varchar(255),
  bank_account_number varchar(50), -- encrypted at rest via Supabase; consider pgcrypto column encryption later
  bank_name varchar(100),
  tax_id varchar(50), -- NPWP outlet-specific
  business_hours jsonb, -- {mon: {open: "06:00", close: "22:00"}, ...}
  status varchar(50) not null default 'active', -- 'active', 'inactive', 'closed'
  opening_cash decimal(15,2) not null default 0,
  target_daily_revenue decimal(15,2),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_outlets_company_id on outlets(company_id);

-- USERS (Access Control) — id mirrors Supabase auth.users(id)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  outlet_id uuid references outlets(id), -- NULL for multi-outlet (master admin) access
  email varchar(255) not null unique,
  full_name varchar(255) not null,
  phone varchar(20),
  role varchar(50) not null, -- 'master_admin', 'outlet_manager', 'cashier', 'staff'
  permissions jsonb not null default '[]',
  status varchar(50) not null default 'active', -- 'active', 'inactive', 'suspended'
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_users_company_id on users(company_id);
create index idx_users_outlet_id on users(outlet_id);

alter table outlets
  add constraint fk_outlets_manager foreign key (manager_id) references users(id);

-- keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();
create trigger trg_outlets_updated_at before update on outlets
  for each row execute function set_updated_at();
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();


-- ============================================================
-- 002_products_inventory.sql
-- ============================================================
-- 002_products_inventory.sql
-- Suppliers, product catalog, and outlet-level inventory
--
-- Note: the source PRD had `inventory.cost_value`/`retail_value` and
-- `stocktake_details.variance_value` as GENERATED ALWAYS columns referencing
-- another table's column (products.purchase_price). Postgres generated
-- columns can only reference columns in the *same* row, so those are computed
-- here in v_inventory_valuation / at write-time instead (see 008_views.sql).

-- SUPPLIERS (created before products, which references it)
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name varchar(255) not null,
  contact_person varchar(255),
  phone varchar(20),
  email varchar(255),
  address text,
  city varchar(100),
  payment_terms int, -- days
  bank_account_name varchar(255),
  bank_account_number varchar(50),
  bank_name varchar(100),
  tax_id varchar(50),
  status varchar(50) not null default 'active',
  rating decimal(3,2),
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_suppliers_company_id on suppliers(company_id);

-- PRODUCT CATEGORIES
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name varchar(255) not null,
  description text,
  sort_order int,
  status varchar(50) not null default 'active',
  created_at timestamptz not null default now()
);

create index idx_product_categories_company_id on product_categories(company_id);

-- PRODUCTS (Master Product List — Company Level)
create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  category_id uuid references product_categories(id),
  sku varchar(100) not null,
  barcode varchar(100) unique,
  name varchar(255) not null,
  description text,
  brand varchar(100),
  manufacturer varchar(100),
  purchase_price decimal(15,2) not null,
  selling_price decimal(15,2) not null,
  unit_type varchar(50) not null, -- 'pcs', 'box', 'kg', 'liter', etc
  conversion_factor int not null default 1,
  base_unit varchar(50),
  markup_percentage decimal(5,2),
  tax_rate decimal(5,2),
  reorder_level int not null default 0,
  reorder_quantity int not null default 0,
  shelf_life_days int,
  supplier_id uuid references suppliers(id),
  is_active boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(company_id, sku)
);

create index idx_products_company_id_sku on products(company_id, sku);
create index idx_products_category_id on products(category_id);

-- INVENTORY (Outlet-Level Stock)
create table inventory (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity_on_hand int not null default 0,
  quantity_reserved int not null default 0,
  quantity_available int generated always as (quantity_on_hand - quantity_reserved) stored,
  last_count_date timestamptz,
  reorder_level int, -- outlet-specific override of products.reorder_level
  alert_status varchar(50) not null default 'normal', -- 'low_stock', 'overstock', 'expired'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, product_id)
);

create index idx_inventory_outlet_id_product_id on inventory(outlet_id, product_id);

-- INVENTORY LEDGER (Audit Trail for Stock Movements)
create table inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  movement_type varchar(50) not null, -- 'purchase', 'sales', 'adjustment', 'transfer', 'return', 'write_off'
  quantity_change int not null,
  unit_cost decimal(15,2),
  reference_type varchar(50), -- 'purchase_order', 'invoice', 'stocktake', 'manual'
  reference_id uuid,
  recorded_by uuid not null references users(id),
  notes text,
  batch_number varchar(100),
  expiry_date date,
  created_at timestamptz not null default now()
);

create index idx_inventory_ledger_outlet_product on inventory_ledger(outlet_id, product_id);
create index idx_inventory_ledger_reference on inventory_ledger(reference_type, reference_id);

-- STOCKTAKE (Physical Inventory Counts)
create table stocktakes (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  scheduled_date date not null,
  actual_start_date timestamptz,
  actual_end_date timestamptz,
  created_by uuid not null references users(id),
  approved_by uuid references users(id),
  status varchar(50) not null default 'draft', -- 'draft', 'in_progress', 'completed', 'approved'
  variance_tolerance_percent decimal(5,2) not null default 2.0,
  total_variance_value decimal(15,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- STOCKTAKE DETAILS (Individual Product Counts)
create table stocktake_details (
  id uuid primary key default gen_random_uuid(),
  stocktake_id uuid not null references stocktakes(id) on delete cascade,
  product_id uuid not null references products(id),
  expected_quantity int not null,
  counted_quantity int not null,
  variance int generated always as (counted_quantity - expected_quantity) stored,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_stocktake_details_stocktake_id on stocktake_details(stocktake_id);

create trigger trg_suppliers_updated_at before update on suppliers
  for each row execute function set_updated_at();
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();
create trigger trg_inventory_updated_at before update on inventory
  for each row execute function set_updated_at();
create trigger trg_stocktakes_updated_at before update on stocktakes
  for each row execute function set_updated_at();


-- ============================================================
-- 003_sales_invoicing.sql
-- ============================================================
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


-- ============================================================
-- 004_purchasing.sql
-- ============================================================
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
  status varchar(50) not null default 'draft', -- 'draft', 'pending_approval', 'ordered', 'partial_received', 'received', 'cancelled'
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


-- ============================================================
-- 005_financial.sql
-- ============================================================
-- 005_financial.sql
-- Chart of accounts, double-entry journal, daily snapshots, AR/AP

create table chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  account_code varchar(20) not null,
  account_name varchar(255) not null,
  account_type varchar(50) not null, -- 'asset', 'liability', 'equity', 'income', 'expense'
  parent_account_id uuid references chart_of_accounts(id),
  is_header boolean not null default false,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, account_code)
);

-- JOURNAL ENTRIES (Double-Entry Bookkeeping)
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  entry_date date not null,
  entry_number varchar(50),
  description varchar(255) not null,
  source_type varchar(50), -- 'manual', 'sales', 'purchase', 'payment', 'adjustment'
  source_id uuid,
  created_by uuid not null references users(id),
  status varchar(50) not null default 'draft', -- 'draft', 'posted', 'reversed'
  posted_date timestamptz,
  reversed_date timestamptz,
  reversal_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, entry_number)
);

create index idx_journal_entries_outlet_id_date on journal_entries(outlet_id, entry_date);
create index idx_journal_entries_source on journal_entries(source_type, source_id);

-- JOURNAL ENTRY DETAILS (Line Items with Dr/Cr)
create table journal_entry_details (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references chart_of_accounts(id),
  debit decimal(15,2) not null default 0,
  credit decimal(15,2) not null default 0,
  description text,
  reference_id uuid
);

create index idx_journal_entry_details_entry_id on journal_entry_details(journal_entry_id);

-- DAILY FINANCIAL SNAPSHOT
create table daily_financial_summary (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  summary_date date not null,
  total_sales decimal(15,2) not null default 0,
  total_discount decimal(15,2) not null default 0,
  total_tax_collected decimal(15,2),
  total_cash_received decimal(15,2),
  total_e_wallet_received decimal(15,2),
  total_bank_transfer_pending decimal(15,2),
  total_invoices int,
  total_items_sold int,
  unique_customers int,
  cash_on_hand_opening decimal(15,2),
  cash_on_hand_closing decimal(15,2),
  cash_variance decimal(15,2),
  cost_of_goods_sold decimal(15,2),
  gross_profit decimal(15,2),
  gross_profit_margin decimal(5,2),
  operating_expenses decimal(15,2),
  net_profit decimal(15,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, summary_date)
);

create index idx_daily_financial_summary_outlet_date on daily_financial_summary(outlet_id, summary_date);

-- ACCOUNTS RECEIVABLE (Customer Outstanding)
create table accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  customer_name varchar(255),
  customer_phone varchar(20),
  total_invoices decimal(15,2) not null default 0,
  total_paid decimal(15,2) not null default 0,
  outstanding_amount decimal(15,2) generated always as (total_invoices - total_paid) stored,
  last_transaction_date date,
  days_outstanding int,
  aging_bucket varchar(50), -- 'current', '30', '60', '90', '120+'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ACCOUNTS PAYABLE (Supplier Outstanding)
create table accounts_payable (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  total_invoices decimal(15,2) not null default 0,
  total_paid decimal(15,2) not null default 0,
  outstanding_amount decimal(15,2) generated always as (total_invoices - total_paid) stored,
  due_date date,
  days_overdue int,
  aging_bucket varchar(50), -- 'current', '30', '60', '90', '120+'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, supplier_id)
);

create trigger trg_chart_of_accounts_updated_at before update on chart_of_accounts
  for each row execute function set_updated_at();
create trigger trg_journal_entries_updated_at before update on journal_entries
  for each row execute function set_updated_at();
create trigger trg_daily_financial_summary_updated_at before update on daily_financial_summary
  for each row execute function set_updated_at();
create trigger trg_accounts_receivable_updated_at before update on accounts_receivable
  for each row execute function set_updated_at();
create trigger trg_accounts_payable_updated_at before update on accounts_payable
  for each row execute function set_updated_at();


-- ============================================================
-- 006_hr_ops.sql
-- ============================================================
-- 006_hr_ops.sql
-- Staff, attendance, and cashier shift/cash reconciliation

create table staff_members (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  first_name varchar(100) not null,
  last_name varchar(100),
  email varchar(255),
  phone varchar(20),
  position varchar(100) not null, -- 'cashier', 'staff', 'supervisor'
  hire_date date not null,
  salary_amount decimal(15,2),
  salary_frequency varchar(50), -- 'monthly', 'daily'
  bank_account_name varchar(255),
  bank_account_number varchar(50),
  tax_id varchar(50),
  status varchar(50) not null default 'active',
  employment_status varchar(50), -- 'permanent', 'contract', 'casual'
  contract_end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_staff_members_outlet_id on staff_members(outlet_id);

-- ATTENDANCE
create table attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_members(id) on delete cascade,
  attendance_date date not null,
  clock_in_time timestamptz,
  clock_out_time timestamptz,
  status varchar(50) not null, -- 'present', 'absent', 'late', 'early_leave', 'half_day'
  notes text,
  created_at timestamptz not null default now(),
  unique(staff_id, attendance_date)
);

-- CASHIER SHIFTS & CASH RECONCILIATION
create table cashier_shifts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  staff_id uuid references staff_members(id),
  shift_date date not null,
  shift_start_time timestamptz,
  shift_end_time timestamptz,
  opening_cash decimal(15,2) not null,
  closing_cash decimal(15,2) not null,
  total_transactions decimal(15,2) not null default 0,
  expected_closing_cash decimal(15,2) generated always as (opening_cash + total_transactions) stored,
  cash_variance decimal(15,2) generated always as (closing_cash - (opening_cash + total_transactions)) stored,
  variance_percentage decimal(5,2),
  reconciled boolean not null default false,
  reconciled_by uuid references users(id),
  reconciliation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cashier_shifts_outlet_id_date on cashier_shifts(outlet_id, shift_date);

create trigger trg_staff_members_updated_at before update on staff_members
  for each row execute function set_updated_at();
create trigger trg_cashier_shifts_updated_at before update on cashier_shifts
  for each row execute function set_updated_at();


-- ============================================================
-- 007_audit_compliance.sql
-- ============================================================
-- 007_audit_compliance.sql
-- Immutable audit log, system alerts, bulk admin operations

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  company_id uuid not null references companies(id) on delete cascade,
  outlet_id uuid references outlets(id),
  action_type varchar(50) not null, -- 'CREATE', 'UPDATE', 'DELETE', 'VOID', 'EXPORT'
  entity_type varchar(50) not null, -- 'invoice', 'product', 'user', 'settings'
  entity_id uuid not null,
  old_values jsonb,
  new_values jsonb,
  ip_address varchar(45),
  user_agent text,
  reason_for_action text,
  status varchar(50), -- 'success', 'failed'
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_audit_log_user_id_created_at on audit_log(user_id, created_at);
create index idx_audit_log_entity_type_entity_id on audit_log(entity_type, entity_id);
create index idx_audit_log_company_id on audit_log(company_id);

-- SYSTEM ALERTS (Low Stock, Pending Payments, etc)
create table system_alerts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  alert_type varchar(50) not null, -- 'low_stock', 'overstock', 'payment_pending', 'cash_variance', 'payment_failed'
  severity varchar(50) not null default 'info', -- 'info', 'warning', 'critical'
  title varchar(255) not null,
  description text,
  reference_entity_type varchar(50), -- 'product', 'invoice', 'payment'
  reference_entity_id uuid,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_system_alerts_outlet_id_resolved on system_alerts(outlet_id, is_resolved);

-- BULK ADMIN OPERATIONS (Multi-outlet)
create table bulk_admin_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  admin_id uuid not null references users(id),
  operation_type varchar(50) not null, -- 'price_update', 'product_add', 'promo_creation'
  outlets_affected jsonb not null, -- array of outlet_ids, or ["all"]
  operation_description text,
  parameters jsonb,
  scheduled_for timestamptz,
  status varchar(50) not null default 'draft', -- 'draft', 'scheduled', 'executing', 'completed', 'failed', 'rolled_back'
  execution_start_time timestamptz,
  execution_end_time timestamptz,
  success_count int,
  failed_count int,
  error_log jsonb,
  rollback_available boolean not null default true,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bulk_admin_operations_company_id on bulk_admin_operations(company_id);

create trigger trg_system_alerts_updated_at before update on system_alerts
  for each row execute function set_updated_at();
create trigger trg_bulk_admin_operations_updated_at before update on bulk_admin_operations
  for each row execute function set_updated_at();


-- ============================================================
-- 008_views.sql
-- ============================================================
-- 008_views.sql
-- Reporting views

create view v_daily_sales_summary as
select
  i.outlet_id,
  date(i.created_at) as sale_date,
  count(distinct i.id) as transaction_count,
  count(distinct i.customer_phone) as unique_customers,
  coalesce(sum(ii.quantity), 0) as items_sold,
  sum(i.subtotal) as sales_before_discount,
  sum(i.discount_amount) as total_discounts,
  sum(i.tax_amount) as tax_collected,
  sum(i.total) as total_sales,
  coalesce(sum(ii.cost_of_goods_sold), 0) as cogs,
  (sum(i.total) - coalesce(sum(ii.cost_of_goods_sold), 0)) as gross_profit,
  round(100 * (sum(i.total) - coalesce(sum(ii.cost_of_goods_sold), 0)) / nullif(sum(i.total), 0), 2) as gross_margin_percent
from invoices i
left join invoice_items ii on i.id = ii.invoice_id
where i.order_status != 'voided'
group by i.outlet_id, date(i.created_at);

-- Inventory Valuation View
-- (computes cost_value / retail_value here rather than as generated columns
-- on `inventory`, since Postgres generated columns can't reference `products`.)
create view v_inventory_valuation as
select
  inv.outlet_id,
  inv.product_id,
  p.name,
  p.sku,
  inv.quantity_on_hand,
  inv.quantity_reserved,
  inv.quantity_available,
  p.purchase_price,
  p.selling_price,
  (inv.quantity_on_hand * p.purchase_price) as cost_value,
  (inv.quantity_on_hand * p.selling_price) as retail_value,
  (inv.quantity_on_hand * (p.selling_price - p.purchase_price)) as potential_profit
from inventory inv
join products p on inv.product_id = p.id
where inv.quantity_on_hand > 0;

-- Accounts Payable Aging
create view v_ap_aging as
select
  ap.outlet_id,
  ap.supplier_id,
  s.name as supplier_name,
  ap.outstanding_amount,
  case
    when ap.days_overdue <= 0 then 'Current'
    when ap.days_overdue <= 30 then '1-30 days'
    when ap.days_overdue <= 60 then '31-60 days'
    when ap.days_overdue <= 90 then '61-90 days'
    else '90+ days'
  end as aging_bucket,
  ap.due_date
from accounts_payable ap
join suppliers s on ap.supplier_id = s.id
where ap.outstanding_amount > 0;

-- Low Stock Alert View
create view v_low_stock_alerts as
select
  inv.outlet_id,
  inv.product_id,
  p.name,
  p.sku,
  inv.quantity_on_hand,
  p.reorder_level,
  p.reorder_quantity,
  (p.reorder_level - inv.quantity_on_hand) as shortage_qty,
  inv.alert_status
from inventory inv
join products p on inv.product_id = p.id
where inv.quantity_available <= coalesce(inv.reorder_level, p.reorder_level)
order by shortage_qty desc;


-- ============================================================
-- 009_functions.sql
-- ============================================================
-- 009_functions.sql
-- update_inventory(): atomically adjusts stock and records the movement in
-- inventory_ledger. Referenced from app/api/invoices (sales), PO receiving,
-- and manual adjustments. Runs with the caller's privileges (SECURITY INVOKER,
-- the default) so RLS on `inventory`/`inventory_ledger` still applies.

create or replace function update_inventory(
  p_outlet_id uuid,
  p_product_id uuid,
  p_quantity_change int,
  p_movement_type varchar,
  p_recorded_by uuid,
  p_reference_id uuid default null,
  p_reference_type varchar default null,
  p_unit_cost decimal default null,
  p_notes text default null
)
returns table (new_quantity_on_hand int) as $$
declare
  v_new_qty int;
  v_reorder_level int;
begin
  insert into inventory (outlet_id, product_id, quantity_on_hand)
  values (p_outlet_id, p_product_id, greatest(p_quantity_change, 0))
  on conflict (outlet_id, product_id) do update
    set quantity_on_hand = inventory.quantity_on_hand + p_quantity_change,
        updated_at = now()
  returning quantity_on_hand into v_new_qty;

  if v_new_qty < 0 then
    raise exception 'Insufficient stock for product % at outlet % (would go to %)',
      p_product_id, p_outlet_id, v_new_qty;
  end if;

  insert into inventory_ledger (
    outlet_id, product_id, movement_type, quantity_change,
    unit_cost, reference_type, reference_id, recorded_by, notes
  ) values (
    p_outlet_id, p_product_id, p_movement_type, p_quantity_change,
    p_unit_cost, coalesce(p_reference_type, p_movement_type), p_reference_id, p_recorded_by, p_notes
  );

  select coalesce(inventory.reorder_level, p.reorder_level)
    into v_reorder_level
  from inventory
  join products p on p.id = inventory.product_id
  where inventory.outlet_id = p_outlet_id and inventory.product_id = p_product_id;

  update inventory
    set alert_status = case
      when v_new_qty <= 0 then 'out_of_stock'
      when v_new_qty <= coalesce(v_reorder_level, 0) then 'low_stock'
      else 'normal'
    end
  where outlet_id = p_outlet_id and product_id = p_product_id;

  return query select v_new_qty;
end;
$$ language plpgsql;


-- ============================================================
-- 010_rls_policies.sql
-- ============================================================
-- 010_rls_policies.sql
-- Row-Level Security: tenant isolation (company_id / outlet_id) + role gating.
--
-- Design note: policies here enforce the hard security boundary (a user can
-- never read/write another company's or another outlet's rows). Finer
-- business rules from prd.md §6.1 (void requires manager approval, invoices
-- immutable after 24h, etc.) are enforced in the API route layer on top of
-- this, since they depend on request context (reason, approval chain) that
-- doesn't map cleanly onto a row-level policy.
--
-- Helper functions are SECURITY DEFINER + STABLE so they can read `users`
-- (which itself has RLS enabled) without recursive policy evaluation.

create or replace function current_user_role()
returns varchar
language sql
security definer
stable
set search_path = public
as $$
  select role from users where id = auth.uid();
$$;

create or replace function current_user_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id from users where id = auth.uid();
$$;

create or replace function current_user_outlet_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select outlet_id from users where id = auth.uid();
$$;

-- True if the current user may read/write rows belonging to `p_outlet_id`:
-- their own outlet, or (for master_admin) any outlet in their company.
create or replace function user_can_access_outlet(p_outlet_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    p_outlet_id = current_user_outlet_id()
    or (
      current_user_role() = 'master_admin'
      and exists (
        select 1 from outlets o
        where o.id = p_outlet_id and o.company_id = current_user_company_id()
      )
    );
$$;

-- ============ COMPANIES ============
alter table companies enable row level security;

create policy companies_select on companies
  for select using (id = current_user_company_id());

-- ============ USERS ============
alter table users enable row level security;

create policy users_select_same_company on users
  for select using (company_id = current_user_company_id());

create policy users_update_self on users
  for update using (id = auth.uid());

create policy users_master_admin_manage on users
  for all using (
    current_user_role() = 'master_admin'
    and company_id = current_user_company_id()
  );

-- ============ OUTLETS ============
alter table outlets enable row level security;

create policy outlets_access on outlets
  for select using (user_can_access_outlet(id));

create policy outlets_master_admin_manage on outlets
  for all using (
    current_user_role() = 'master_admin'
    and company_id = current_user_company_id()
  );

-- ============ PRODUCTS / CATEGORIES / SUPPLIERS (company-scoped) ============
alter table products enable row level security;
alter table product_categories enable row level security;
alter table suppliers enable row level security;

create policy products_company_access on products
  for all using (company_id = current_user_company_id());

create policy product_categories_company_access on product_categories
  for all using (company_id = current_user_company_id());

create policy suppliers_company_access on suppliers
  for all using (company_id = current_user_company_id());

-- ============ OUTLET-SCOPED OPERATIONAL TABLES ============
-- Same read/write shape for every table keyed directly by outlet_id.
do $$
declare
  t text;
  outlet_scoped_tables text[] := array[
    'inventory', 'inventory_ledger', 'stocktakes',
    'invoices', 'payment_reconciliation',
    'purchase_orders', 'chart_of_accounts', 'journal_entries',
    'daily_financial_summary', 'accounts_receivable', 'accounts_payable',
    'staff_members', 'cashier_shifts', 'system_alerts'
  ];
begin
  foreach t in array outlet_scoped_tables loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for select using (user_can_access_outlet(outlet_id));',
      t || '_select', t
    );
    execute format(
      'create policy %I on %I for insert with check (user_can_access_outlet(outlet_id));',
      t || '_insert', t
    );
    execute format(
      'create policy %I on %I for update using (user_can_access_outlet(outlet_id));',
      t || '_update', t
    );
    execute format(
      'create policy %I on %I for delete using (
         user_can_access_outlet(outlet_id) and current_user_role() in (''master_admin'', ''outlet_manager'')
       );',
      t || '_delete', t
    );
  end loop;
end $$;

-- ============ TABLES SCOPED VIA A PARENT FOREIGN KEY ============
-- These don't carry outlet_id directly; gate them through their parent row.
alter table invoice_items enable row level security;
create policy invoice_items_access on invoice_items
  for all using (
    exists (select 1 from invoices i where i.id = invoice_id and user_can_access_outlet(i.outlet_id))
  );

alter table payment_transactions enable row level security;
create policy payment_transactions_access on payment_transactions
  for all using (
    exists (select 1 from invoices i where i.id = invoice_id and user_can_access_outlet(i.outlet_id))
  );

alter table virtual_accounts enable row level security;
create policy virtual_accounts_access on virtual_accounts
  for all using (
    exists (select 1 from invoices i where i.id = invoice_id and user_can_access_outlet(i.outlet_id))
  );

alter table po_items enable row level security;
create policy po_items_access on po_items
  for all using (
    exists (select 1 from purchase_orders po where po.id = po_id and user_can_access_outlet(po.outlet_id))
  );

alter table purchase_invoices enable row level security;
create policy purchase_invoices_access on purchase_invoices
  for all using (
    exists (select 1 from purchase_orders po where po.id = po_id and user_can_access_outlet(po.outlet_id))
  );

alter table purchase_payments enable row level security;
create policy purchase_payments_access on purchase_payments
  for all using (
    exists (
      select 1 from purchase_invoices pi
      join purchase_orders po on po.id = pi.po_id
      where pi.id = purchase_invoice_id and user_can_access_outlet(po.outlet_id)
    )
  );

alter table journal_entry_details enable row level security;
create policy journal_entry_details_access on journal_entry_details
  for all using (
    exists (
      select 1 from journal_entries je
      where je.id = journal_entry_id and user_can_access_outlet(je.outlet_id)
    )
  );

alter table stocktake_details enable row level security;
create policy stocktake_details_access on stocktake_details
  for all using (
    exists (
      select 1 from stocktakes s
      where s.id = stocktake_id and user_can_access_outlet(s.outlet_id)
    )
  );

alter table attendance enable row level security;
create policy attendance_access on attendance
  for all using (
    exists (
      select 1 from staff_members sm
      where sm.id = staff_id and user_can_access_outlet(sm.outlet_id)
    )
  );

-- ============ COMPANY-WIDE ADMIN TABLES ============
alter table audit_log enable row level security;
create policy audit_log_company_access on audit_log
  for select using (company_id = current_user_company_id());
create policy audit_log_insert on audit_log
  for insert with check (company_id = current_user_company_id());

alter table bulk_admin_operations enable row level security;
create policy bulk_admin_operations_master_admin on bulk_admin_operations
  for all using (
    company_id = current_user_company_id() and current_user_role() = 'master_admin'
  );


-- ============================================================
-- 011_register_function.sql
-- ============================================================
-- 011_register_function.sql
-- Atomically provisions a company + its first outlet + the owning user row,
-- called from app/api/auth/register with the service-role client right after
-- Supabase Auth creates the auth.users row (which has no session/company yet,
-- so normal RLS-scoped inserts wouldn't be authorized).

create or replace function provision_company_and_owner(
  p_user_id uuid,
  p_email varchar,
  p_full_name varchar,
  p_phone varchar,
  p_company_name varchar,
  p_tier varchar,
  p_industry varchar
)
returns table (company_id uuid, outlet_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_outlet_id uuid;
begin
  insert into companies (name, tier, billing_email, billing_phone, industry)
  values (p_company_name, p_tier, p_email, p_phone, p_industry)
  returning id into v_company_id;

  insert into outlets (company_id, name, address, city)
  values (v_company_id, p_company_name || ' - Outlet Utama', '-', '-')
  returning id into v_outlet_id;

  insert into users (id, company_id, outlet_id, email, full_name, phone, role)
  values (p_user_id, v_company_id, v_outlet_id, p_email, p_full_name, p_phone, 'master_admin');

  return query select v_company_id, v_outlet_id;
end;
$$;


-- ============================================================
-- 012_create_invoice_function.sql
-- ============================================================
-- 012_create_invoice_function.sql
-- create_invoice(): the core POS transaction. Runs as one atomic function
-- call (all-or-nothing) instead of the sequential REST calls sketched in
-- prd.md's app/api/invoices/route.ts example, which had no rollback path if
-- e.g. invoice_items insert succeeded but inventory deduction failed.
--
-- Validates stock for every line (locking each inventory row with
-- `for update`) before writing anything, then creates the invoice + items and
-- deducts inventory via update_inventory() (009_functions.sql) for each line.
-- SECURITY INVOKER (the default) so RLS still applies as the calling user.

create or replace function create_invoice(
  p_outlet_id uuid,
  p_cashier_id uuid,
  p_items jsonb, -- [{product_id, quantity, discount?}, ...]
  p_payment_method varchar,
  p_customer_name varchar default null,
  p_customer_phone varchar default null,
  p_discount_amount decimal default 0,
  p_discount_reason text default null
)
returns table (invoice_id uuid, invoice_number varchar, total decimal, payment_status varchar)
language plpgsql
as $$
declare
  v_invoice_id uuid;
  v_invoice_number varchar;
  v_subtotal decimal := 0;
  v_tax_rate decimal;
  v_tax_amount decimal;
  v_total decimal;
  v_item jsonb;
  v_product products%rowtype;
  v_available int;
  v_qty int;
  v_item_discount decimal;
  v_cogs decimal;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang tidak boleh kosong';
  end if;

  -- Pass 1: lock every affected inventory row and validate stock before
  -- writing anything, so a failure partway through never leaves the cart
  -- half-deducted.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select p.* into v_product from products p where p.id = (v_item ->> 'product_id')::uuid;
    if v_product.id is null then
      raise exception 'Produk % tidak ditemukan', v_item ->> 'product_id';
    end if;

    v_qty := (v_item ->> 'quantity')::int;

    select quantity_available into v_available
    from inventory
    where outlet_id = p_outlet_id and product_id = v_product.id
    for update;

    if v_available is null or v_available < v_qty then
      raise exception 'Stok tidak cukup untuk produk %', v_product.name;
    end if;
  end loop;

  -- Pass 2: compute totals
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select p.* into v_product from products p where p.id = (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    v_item_discount := coalesce((v_item ->> 'discount')::decimal, 0);
    v_subtotal := v_subtotal + (v_product.selling_price * v_qty - v_item_discount);
  end loop;

  select c.tax_rate into v_tax_rate
  from companies c join outlets o on o.company_id = c.id
  where o.id = p_outlet_id;
  v_tax_rate := coalesce(v_tax_rate, 10.0) / 100;
  v_tax_amount := round((v_subtotal - p_discount_amount) * v_tax_rate, 2);
  v_total := v_subtotal - p_discount_amount + v_tax_amount;

  v_invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(floor(random() * 100000)::text, 5, '0');

  insert into invoices (
    outlet_id, invoice_number, customer_name, customer_phone, cashier_id,
    subtotal, discount_amount, discount_reason, tax_amount, total, payment_status
  ) values (
    p_outlet_id, v_invoice_number, p_customer_name, p_customer_phone, p_cashier_id,
    v_subtotal, p_discount_amount, p_discount_reason, v_tax_amount, v_total,
    case when p_payment_method = 'cash' then 'paid' else 'pending' end
  )
  returning id into v_invoice_id;

  -- Pass 3: write line items + deduct inventory
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select p.* into v_product from products p where p.id = (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    v_item_discount := coalesce((v_item ->> 'discount')::decimal, 0);
    v_cogs := v_product.purchase_price * v_qty;

    insert into invoice_items (invoice_id, product_id, quantity, unit_price, item_discount, cost_of_goods_sold)
    values (v_invoice_id, v_product.id, v_qty, v_product.selling_price, v_item_discount, v_cogs);

    perform update_inventory(
      p_outlet_id => p_outlet_id,
      p_product_id => v_product.id,
      p_quantity_change => -v_qty,
      p_movement_type => 'sales',
      p_recorded_by => p_cashier_id,
      p_reference_id => v_invoice_id,
      p_reference_type => 'invoice'
    );
  end loop;

  return query
    select v_invoice_id, v_invoice_number, v_total, i.payment_status
    from invoices i where i.id = v_invoice_id;
end;
$$;

-- Manager+ void, within 24h, restores stock. See prd.md §4.3.
create or replace function void_invoice(
  p_invoice_id uuid,
  p_voided_by uuid,
  p_reason text
)
returns table (voided_at timestamptz, stock_returned int)
language plpgsql
as $$
declare
  v_invoice invoices%rowtype;
  v_item invoice_items%rowtype;
  v_stock_returned int := 0;
begin
  select * into v_invoice from invoices where id = p_invoice_id for update;
  if v_invoice.id is null then
    raise exception 'Invoice tidak ditemukan';
  end if;
  if v_invoice.order_status = 'voided' then
    raise exception 'Invoice sudah dibatalkan sebelumnya';
  end if;
  if now() - v_invoice.created_at > interval '24 hours' then
    raise exception 'Invoice hanya bisa dibatalkan dalam 24 jam setelah dibuat';
  end if;

  for v_item in select * from invoice_items where invoice_id = p_invoice_id loop
    perform update_inventory(
      p_outlet_id => v_invoice.outlet_id,
      p_product_id => v_item.product_id,
      p_quantity_change => v_item.quantity,
      p_movement_type => 'return',
      p_recorded_by => p_voided_by,
      p_reference_id => p_invoice_id,
      p_reference_type => 'invoice_void'
    );
    v_stock_returned := v_stock_returned + v_item.quantity;
  end loop;

  update invoices
    set order_status = 'voided',
        voided_at = now(),
        voided_by = p_voided_by,
        void_reason = p_reason
    where id = p_invoice_id;

  update payment_transactions
    set status = 'refunded', updated_at = now()
    where invoice_id = p_invoice_id and status = 'settled';

  return query select now(), v_stock_returned;
end;
$$;




-- ============================================================
-- 013_whatsapp.sql
-- ============================================================

-- 013_whatsapp.sql
-- WhatsApp message templates + broadcast log. Not connected to a real WhatsApp
-- Business API (no credentials/infra) — this stores templates and simulates
-- sending a broadcast (marks it 'sent' with a computed recipient count).

create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(255) not null,
  content text not null, -- may contain {nama}, {invoice}, {total} placeholders
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_whatsapp_templates_outlet_id on whatsapp_templates(outlet_id);

create table whatsapp_broadcasts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  template_id uuid not null references whatsapp_templates(id),
  target_note varchar(255) not null, -- free-text description of the audience, e.g. "Pelanggan minggu ini"
  status varchar(50) not null default 'draft', -- 'draft', 'sent'
  sent_count int not null default 0,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index idx_whatsapp_broadcasts_outlet_id on whatsapp_broadcasts(outlet_id);

create trigger trg_whatsapp_templates_updated_at before update on whatsapp_templates
  for each row execute function set_updated_at();

-- RLS: same outlet-scoped read/write shape used throughout 010_rls_policies.sql.
alter table whatsapp_templates enable row level security;
create policy whatsapp_templates_select on whatsapp_templates
  for select using (user_can_access_outlet(outlet_id));
create policy whatsapp_templates_insert on whatsapp_templates
  for insert with check (user_can_access_outlet(outlet_id));
create policy whatsapp_templates_update on whatsapp_templates
  for update using (user_can_access_outlet(outlet_id));
create policy whatsapp_templates_delete on whatsapp_templates
  for delete using (
    user_can_access_outlet(outlet_id) and current_user_role() in ('master_admin', 'outlet_manager')
  );

alter table whatsapp_broadcasts enable row level security;
create policy whatsapp_broadcasts_select on whatsapp_broadcasts
  for select using (user_can_access_outlet(outlet_id));
create policy whatsapp_broadcasts_insert on whatsapp_broadcasts
  for insert with check (user_can_access_outlet(outlet_id));


-- ============================================================
-- 014_accounting_functions.sql
-- ============================================================

-- 014_accounting_functions.sql
-- Wires up the chart_of_accounts / journal_entries / journal_entry_details
-- schema from 005_financial.sql (previously unused by any API/UI) with:
--   1. create_journal_entry() — atomic (single-transaction) creation of a
--      draft entry + its line items, validating each line has exactly one of
--      debit/credit and that the whole entry balances, mirroring the
--      create_invoice() pattern in 012.
--   2. post_journal_entry() — atomically re-validates balance and flips a
--      draft entry to 'posted' (locks the row to avoid a concurrent post).
--   3. A default Indonesian-retail chart of accounts seeded into every new
--      outlet via provision_company_and_owner(), and backfilled onto outlets
--      that already exist (idempotent — safe to re-run).

create or replace function create_journal_entry(
  p_outlet_id uuid,
  p_created_by uuid,
  p_entry_date date,
  p_description varchar,
  p_lines jsonb, -- [{account_id, debit, credit, description?}, ...]
  p_source_type varchar default 'manual',
  p_source_id uuid default null
)
returns table (journal_entry_id uuid)
language plpgsql
as $$
declare
  v_entry_id uuid;
  v_line jsonb;
  v_debit decimal;
  v_credit decimal;
  v_total_debit decimal := 0;
  v_total_credit decimal := 0;
begin
  if jsonb_array_length(p_lines) < 2 then
    raise exception 'Jurnal minimal memiliki 2 baris (debit dan kredit)';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_debit := coalesce((v_line->>'debit')::decimal, 0);
    v_credit := coalesce((v_line->>'credit')::decimal, 0);
    if v_debit > 0 and v_credit > 0 then
      raise exception 'Satu baris jurnal tidak boleh memiliki debit dan kredit sekaligus';
    end if;
    if v_debit = 0 and v_credit = 0 then
      raise exception 'Setiap baris jurnal harus memiliki nilai debit atau kredit';
    end if;
    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  end loop;

  if v_total_debit <> v_total_credit then
    raise exception 'Jurnal tidak seimbang: debit % , kredit %', v_total_debit, v_total_credit;
  end if;

  insert into journal_entries (outlet_id, entry_date, description, source_type, source_id, created_by, status)
  values (p_outlet_id, p_entry_date, p_description, p_source_type, p_source_id, p_created_by, 'draft')
  returning id into v_entry_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into journal_entry_details (journal_entry_id, account_id, debit, credit, description)
    values (
      v_entry_id,
      (v_line->>'account_id')::uuid,
      coalesce((v_line->>'debit')::decimal, 0),
      coalesce((v_line->>'credit')::decimal, 0),
      v_line->>'description'
    );
  end loop;

  return query select v_entry_id;
end;
$$;

create or replace function post_journal_entry(p_entry_id uuid)
returns table (posted_date timestamptz)
language plpgsql
as $$
declare
  v_status varchar;
  v_debit decimal;
  v_credit decimal;
  v_posted_date timestamptz;
begin
  select status into v_status from journal_entries where id = p_entry_id for update;
  if v_status is null then
    raise exception 'Jurnal tidak ditemukan';
  end if;
  if v_status <> 'draft' then
    raise exception 'Hanya jurnal berstatus draft yang bisa diposting';
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_debit, v_credit
  from journal_entry_details
  where journal_entry_id = p_entry_id;

  if v_debit = 0 and v_credit = 0 then
    raise exception 'Jurnal tidak memiliki baris debit/kredit';
  end if;
  if v_debit <> v_credit then
    raise exception 'Jurnal tidak seimbang: debit % , kredit %', v_debit, v_credit;
  end if;

  v_posted_date := now();
  update journal_entries set status = 'posted', posted_date = v_posted_date where id = p_entry_id;

  return query select v_posted_date;
end;
$$;

-- Seed a default COA on every newly-provisioned outlet.
create or replace function provision_company_and_owner(
  p_user_id uuid,
  p_email varchar,
  p_full_name varchar,
  p_phone varchar,
  p_company_name varchar,
  p_tier varchar,
  p_industry varchar
)
returns table (company_id uuid, outlet_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_outlet_id uuid;
begin
  insert into companies (name, tier, billing_email, billing_phone, industry)
  values (p_company_name, p_tier, p_email, p_phone, p_industry)
  returning id into v_company_id;

  insert into outlets (company_id, name, address, city)
  values (v_company_id, p_company_name || ' - Outlet Utama', '-', '-')
  returning id into v_outlet_id;

  insert into users (id, company_id, outlet_id, email, full_name, phone, role)
  values (p_user_id, v_company_id, v_outlet_id, p_email, p_full_name, p_phone, 'master_admin');

  insert into chart_of_accounts (outlet_id, account_code, account_name, account_type) values
    (v_outlet_id, '1000', 'Kas', 'asset'),
    (v_outlet_id, '1010', 'Bank', 'asset'),
    (v_outlet_id, '1100', 'Piutang Usaha', 'asset'),
    (v_outlet_id, '1200', 'Persediaan Barang Dagang', 'asset'),
    (v_outlet_id, '2000', 'Utang Usaha', 'liability'),
    (v_outlet_id, '2100', 'Utang Pajak', 'liability'),
    (v_outlet_id, '3000', 'Modal Pemilik', 'equity'),
    (v_outlet_id, '3100', 'Laba Ditahan', 'equity'),
    (v_outlet_id, '4000', 'Pendapatan Penjualan', 'income'),
    (v_outlet_id, '4100', 'Pendapatan Lain-lain', 'income'),
    (v_outlet_id, '5000', 'Harga Pokok Penjualan', 'expense'),
    (v_outlet_id, '5100', 'Beban Gaji', 'expense'),
    (v_outlet_id, '5200', 'Beban Operasional', 'expense'),
    (v_outlet_id, '5300', 'Beban Sewa', 'expense');

  return query select v_company_id, v_outlet_id;
end;
$$;

-- Backfill the same default COA onto outlets that already exist (idempotent:
-- only inserts codes an outlet doesn't already have).
insert into chart_of_accounts (outlet_id, account_code, account_name, account_type)
select o.id, v.code, v.name, v.type
from outlets o
cross join (values
  ('1000', 'Kas', 'asset'),
  ('1010', 'Bank', 'asset'),
  ('1100', 'Piutang Usaha', 'asset'),
  ('1200', 'Persediaan Barang Dagang', 'asset'),
  ('2000', 'Utang Usaha', 'liability'),
  ('2100', 'Utang Pajak', 'liability'),
  ('3000', 'Modal Pemilik', 'equity'),
  ('3100', 'Laba Ditahan', 'equity'),
  ('4000', 'Pendapatan Penjualan', 'income'),
  ('4100', 'Pendapatan Lain-lain', 'income'),
  ('5000', 'Harga Pokok Penjualan', 'expense'),
  ('5100', 'Beban Gaji', 'expense'),
  ('5200', 'Beban Operasional', 'expense'),
  ('5300', 'Beban Sewa', 'expense')
) as v(code, name, type)
where not exists (
  select 1 from chart_of_accounts c where c.outlet_id = o.id and c.account_code = v.code
);


-- ============================================================
-- 015_sales_commission.sql
-- ============================================================

-- 015_sales_commission.sql
-- Adds a per-cashier commission rate, used by the Sales Dashboard's
-- "Commission per Cashier" report (commission = rate * that cashier's sales
-- total for the selected period). Nullable/defaults to 0 so existing staff
-- rows are unaffected until an owner sets a rate.

alter table staff_members add column commission_rate decimal(5,4) not null default 0;


-- ============================================================
-- 016_online_orders.sql
-- ============================================================

-- 016_online_orders.sql
-- Manual-entry online order log: staff record orders received via WhatsApp/
-- Instagram/marketplace (no live channel integration exists) and track them
-- through a delivery-style status workflow.

create table online_orders (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  order_number varchar(50) not null,
  channel varchar(50) not null default 'other', -- 'whatsapp', 'instagram', 'marketplace', 'other'
  customer_name varchar(255) not null,
  customer_phone varchar(20),
  items jsonb not null default '[]', -- [{name, quantity, price}, ...] — free-form, not tied to product_id
  total_amount decimal(15,2) not null,
  status varchar(50) not null default 'incoming', -- 'incoming', 'on_process', 'on_delivery', 'completed', 'cancelled'
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, order_number)
);

create index idx_online_orders_outlet_id_status on online_orders(outlet_id, status);

create trigger trg_online_orders_updated_at before update on online_orders
  for each row execute function set_updated_at();

alter table online_orders enable row level security;
create policy online_orders_select on online_orders
  for select using (user_can_access_outlet(outlet_id));
create policy online_orders_insert on online_orders
  for insert with check (user_can_access_outlet(outlet_id));
create policy online_orders_update on online_orders
  for update using (user_can_access_outlet(outlet_id));


-- ============================================================
-- 017_bookings.sql
-- ============================================================

-- 017_bookings.sql
-- Pre-order & pickup scheduling — reframed from the reference mockup's
-- literal "laundry appointment" into something that fits retail (bakery
-- custom-cake pre-orders, bulk frozen-food reservations, etc.) while keeping
-- the same table shape: date, time, customer, item/service, staff, status.

create table bookings (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  customer_name varchar(255) not null,
  customer_phone varchar(20),
  item_description varchar(255) not null,
  staff_id uuid references staff_members(id),
  scheduled_date date not null,
  scheduled_start_time time not null,
  scheduled_end_time time,
  status varchar(50) not null default 'pending', -- 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_outlet_id_date on bookings(outlet_id, scheduled_date);

create trigger trg_bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

alter table bookings enable row level security;
create policy bookings_select on bookings
  for select using (user_can_access_outlet(outlet_id));
create policy bookings_insert on bookings
  for insert with check (user_can_access_outlet(outlet_id));
create policy bookings_update on bookings
  for update using (user_can_access_outlet(outlet_id));
