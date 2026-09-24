-- 065_accounting_depth_and_hr_records.sql
-- Accounting depth (tutup buku/periode akuntansi, aset tetap + penyusutan,
-- anggaran) and HR records (dokumen karyawan, penilaian kinerja).
-- Additive: new tables plus ONE new trigger on journal_entries that only
-- blocks NEW postings dated inside a period an owner has explicitly closed.
-- Run in the Supabase SQL Editor (after 064).

-- ------------------------------------------------------ PERIODE AKUNTANSI
create table if not exists fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status varchar(10) not null default 'open' check (status in ('open', 'closed')),
  closing_entry_id uuid references journal_entries(id) on delete set null,
  closed_by uuid references users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index if not exists idx_fiscal_periods_outlet on fiscal_periods(outlet_id, period_start);

-- A closed period is locked: no new draft/posted entry may be dated inside it.
-- (Marking an existing entry 'reversed' is still allowed — the mirror entry is
-- dated today, outside the closed period.) Callers that post best-effort, such
-- as the sales triggers, swallow the error, so a late sale never breaks POS.
create or replace function block_closed_period_journal() returns trigger
language plpgsql
as $$
begin
  if new.status = 'reversed' then
    return new;
  end if;
  if exists (
    select 1 from fiscal_periods p
    where p.outlet_id = new.outlet_id and p.status = 'closed'
      and new.entry_date between p.period_start and p.period_end
      and new.source_type is distinct from 'closing'
  ) then
    raise exception 'Periode akuntansi untuk tanggal % sudah ditutup. Buka kembali periode untuk mengubah jurnal.', new.entry_date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_closed_period_journal on journal_entries;
create trigger trg_block_closed_period_journal before insert or update of status, entry_date on journal_entries
  for each row execute function block_closed_period_journal();

-- ------------------------------------------------------------ ASET TETAP
create table if not exists fixed_assets (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(200) not null,
  category varchar(100),
  acquisition_date date not null,
  cost decimal(15,2) not null check (cost > 0),
  salvage_value decimal(15,2) not null default 0 check (salvage_value >= 0),
  useful_life_months int not null check (useful_life_months > 0),
  status varchar(15) not null default 'active' check (status in ('active', 'disposed')),
  disposed_on date,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  check (salvage_value < cost)
);
create index if not exists idx_fixed_assets_outlet on fixed_assets(outlet_id, status);

create table if not exists asset_depreciations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references fixed_assets(id) on delete cascade,
  period_month date not null, -- first day of the month depreciated
  amount decimal(15,2) not null check (amount > 0),
  journal_entry_id uuid references journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (asset_id, period_month)
);

-- --------------------------------------------------------------- ANGGARAN
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  account_id uuid not null references chart_of_accounts(id) on delete cascade,
  period_month date not null, -- first day of the month
  amount decimal(15,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (outlet_id, account_id, period_month)
);

-- ----------------------------------------------------- DOKUMEN KARYAWAN
create table if not exists employee_documents (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  doc_type varchar(30) not null
    check (doc_type in ('ktp', 'npwp', 'bpjs', 'kontrak', 'ijazah', 'sertifikat', 'surat_peringatan', 'lainnya')),
  title varchar(200) not null,
  doc_number varchar(100),
  issued_on date,
  expires_on date,
  file_url text,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_employee_documents_staff on employee_documents(staff_id);
create index if not exists idx_employee_documents_expiry on employee_documents(outlet_id, expires_on);

-- -------------------------------------------------------- PENILAIAN KINERJA
create table if not exists performance_reviews (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  review_date date not null default current_date,
  period_label varchar(60) not null,
  overall_score int not null check (overall_score between 1 and 5),
  ratings jsonb not null default '{}', -- { kedisiplinan: 4, kualitas_kerja: 5, ... }
  strengths text,
  improvements text,
  reviewer_id uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_performance_reviews_staff on performance_reviews(staff_id, review_date desc);

-- ------------------------------------------------------------------- RLS
alter table fiscal_periods enable row level security;
create policy fiscal_periods_select on fiscal_periods for select using (user_can_access_outlet(outlet_id));
create policy fiscal_periods_insert on fiscal_periods for insert with check (user_can_access_outlet(outlet_id));
create policy fiscal_periods_update on fiscal_periods for update using (user_can_access_outlet(outlet_id));
create policy fiscal_periods_delete on fiscal_periods for delete using (user_can_access_outlet(outlet_id));

alter table fixed_assets enable row level security;
create policy fixed_assets_select on fixed_assets for select using (user_can_access_outlet(outlet_id));
create policy fixed_assets_insert on fixed_assets for insert with check (user_can_access_outlet(outlet_id));
create policy fixed_assets_update on fixed_assets for update using (user_can_access_outlet(outlet_id));

alter table asset_depreciations enable row level security;
create policy asset_depreciations_select on asset_depreciations for select
  using (exists (select 1 from fixed_assets a where a.id = asset_id and user_can_access_outlet(a.outlet_id)));
create policy asset_depreciations_insert on asset_depreciations for insert
  with check (exists (select 1 from fixed_assets a where a.id = asset_id and user_can_access_outlet(a.outlet_id)));

alter table budgets enable row level security;
create policy budgets_select on budgets for select using (user_can_access_outlet(outlet_id));
create policy budgets_insert on budgets for insert with check (user_can_access_outlet(outlet_id));
create policy budgets_update on budgets for update using (user_can_access_outlet(outlet_id));
create policy budgets_delete on budgets for delete using (user_can_access_outlet(outlet_id));

alter table employee_documents enable row level security;
create policy employee_documents_select on employee_documents for select using (user_can_access_outlet(outlet_id));
create policy employee_documents_insert on employee_documents for insert with check (user_can_access_outlet(outlet_id));
create policy employee_documents_update on employee_documents for update using (user_can_access_outlet(outlet_id));
create policy employee_documents_delete on employee_documents for delete using (user_can_access_outlet(outlet_id));

alter table performance_reviews enable row level security;
create policy performance_reviews_select on performance_reviews for select using (user_can_access_outlet(outlet_id));
create policy performance_reviews_insert on performance_reviews for insert with check (user_can_access_outlet(outlet_id));
create policy performance_reviews_update on performance_reviews for update using (user_can_access_outlet(outlet_id));
create policy performance_reviews_delete on performance_reviews for delete using (user_can_access_outlet(outlet_id));
