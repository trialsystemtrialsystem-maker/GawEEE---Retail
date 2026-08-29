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
