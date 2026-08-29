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
