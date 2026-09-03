-- 041_product_departments.sql
-- Phase 13 Batch A item 1 — Department List: a grouping level ABOVE the
-- existing single-level product_categories (confirmed no parent/department
-- concept existed anywhere in the schema). Purely additive: a new table +
-- one nullable FK column, existing category/product behavior unaffected.

create table product_departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name varchar(255) not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table product_categories add column department_id uuid references product_departments(id);

alter table product_departments enable row level security;
create policy product_departments_access on product_departments
  for all using (company_id = current_user_company_id());
