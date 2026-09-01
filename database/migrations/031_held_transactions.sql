-- 031_held_transactions.sql
-- "Hold/Park Transaction" at POS — a cashier can suspend an in-progress
-- cart (customer forgot their wallet, checking something, etc.) and resume
-- it later, possibly from a different terminal since it's DB-backed rather
-- than only local component state.

create table held_transactions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  cashier_id uuid not null references users(id),
  cart_snapshot jsonb not null, -- CartItem[] from store/posStore.ts
  discount_amount decimal(15,2) not null default 0,
  discount_reason text,
  note varchar(255),
  created_at timestamptz not null default now()
);

create index idx_held_transactions_outlet_id on held_transactions(outlet_id);

alter table held_transactions enable row level security;
create policy held_transactions_select on held_transactions for select using (user_can_access_outlet(outlet_id));
create policy held_transactions_insert on held_transactions for insert with check (user_can_access_outlet(outlet_id));
create policy held_transactions_delete on held_transactions for delete using (user_can_access_outlet(outlet_id));
