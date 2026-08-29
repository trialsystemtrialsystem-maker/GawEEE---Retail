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
