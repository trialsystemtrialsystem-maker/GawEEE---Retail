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
