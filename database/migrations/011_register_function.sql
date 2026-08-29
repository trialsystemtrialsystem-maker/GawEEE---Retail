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
