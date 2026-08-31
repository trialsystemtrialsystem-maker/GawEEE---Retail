-- 023_stock_transfers.sql
-- Multi-outlet stock mutation. One workflow (request -> ship -> receive)
-- covers all 5 "Stock Mutation" menu items from the reference mockup as
-- different status-filtered views of the same table, rather than 5
-- separate half-duplicated tables:
--   Stock Request       = status 'requested'
--   Stock Must Sent     = status 'requested', viewed from the source outlet
--   Stock Transfer      = the ship action (requested -> in_transit)
--   Stock in Transit    = status 'in_transit'
--   Receive Stock Transfer = the receive action (in_transit -> completed)

create table stock_transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  source_outlet_id uuid not null references outlets(id),
  destination_outlet_id uuid not null references outlets(id),
  status varchar(50) not null default 'requested', -- 'requested', 'in_transit', 'completed', 'cancelled'
  notes text,
  requested_by uuid not null references users(id),
  shipped_by uuid references users(id),
  received_by uuid references users(id),
  shipped_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  check (source_outlet_id <> destination_outlet_id)
);

create index idx_stock_transfers_company_status on stock_transfers(company_id, status);
create index idx_stock_transfers_source on stock_transfers(source_outlet_id);
create index idx_stock_transfers_destination on stock_transfers(destination_outlet_id);

create table stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references stock_transfers(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null
);

create index idx_stock_transfer_items_transfer_id on stock_transfer_items(transfer_id);

-- Ships a requested transfer: deducts stock from the source outlet for
-- every line (fails the whole transfer if any line has insufficient stock,
-- same guarantee update_inventory() already gives create_invoice()).
create or replace function ship_stock_transfer(p_transfer_id uuid, p_shipped_by uuid)
returns table (shipped_at timestamptz) as $$
declare
  v_source uuid;
  v_status varchar;
  v_item record;
  v_shipped_at timestamptz;
begin
  select source_outlet_id, status into v_source, v_status from stock_transfers where id = p_transfer_id for update;
  if v_source is null then
    raise exception 'Stock transfer tidak ditemukan';
  end if;
  if v_status <> 'requested' then
    raise exception 'Stock transfer ini bukan status requested';
  end if;

  for v_item in select product_id, quantity from stock_transfer_items where transfer_id = p_transfer_id loop
    perform update_inventory(
      v_source, v_item.product_id, -v_item.quantity, 'transfer_out',
      p_shipped_by, p_transfer_id, 'stock_transfer', null, 'Mutasi stok keluar'
    );
  end loop;

  v_shipped_at := now();
  update stock_transfers set status = 'in_transit', shipped_by = p_shipped_by, shipped_at = v_shipped_at where id = p_transfer_id;

  return query select v_shipped_at;
end;
$$ language plpgsql;

-- Receives an in-transit transfer: adds stock to the destination outlet.
create or replace function receive_stock_transfer(p_transfer_id uuid, p_received_by uuid)
returns table (received_at timestamptz) as $$
declare
  v_destination uuid;
  v_status varchar;
  v_item record;
  v_received_at timestamptz;
begin
  select destination_outlet_id, status into v_destination, v_status from stock_transfers where id = p_transfer_id for update;
  if v_destination is null then
    raise exception 'Stock transfer tidak ditemukan';
  end if;
  if v_status <> 'in_transit' then
    raise exception 'Stock transfer ini belum dikirim';
  end if;

  for v_item in select product_id, quantity from stock_transfer_items where transfer_id = p_transfer_id loop
    perform update_inventory(
      v_destination, v_item.product_id, v_item.quantity, 'transfer_in',
      p_received_by, p_transfer_id, 'stock_transfer', null, 'Mutasi stok masuk'
    );
  end loop;

  v_received_at := now();
  update stock_transfers set status = 'completed', received_by = p_received_by, received_at = v_received_at where id = p_transfer_id;

  return query select v_received_at;
end;
$$ language plpgsql;

-- Stock transfers need every staff member to be able to see the *names* of
-- sibling outlets in their own company (to pick a source/destination), which
-- the original outlets_access policy (010_rls_policies.sql) doesn't allow —
-- it only lets a non-master_admin see their own outlet. Adds same-company
-- read access without touching write access (still master_admin-only via
-- the existing outlets_master_admin_manage policy).
create policy outlets_select_same_company on outlets
  for select using (company_id = current_user_company_id());

-- RLS: company-wide (not single-outlet-scoped, since a transfer spans two
-- outlets) — access requires belonging to the transfer's company AND being
-- able to access at least one of the two outlets involved.
alter table stock_transfers enable row level security;
create policy stock_transfers_access on stock_transfers
  for all using (
    company_id = current_user_company_id()
    and (user_can_access_outlet(source_outlet_id) or user_can_access_outlet(destination_outlet_id))
  );

alter table stock_transfer_items enable row level security;
create policy stock_transfer_items_access on stock_transfer_items
  for all using (
    exists (
      select 1 from stock_transfers st
      where st.id = transfer_id
        and st.company_id = current_user_company_id()
        and (user_can_access_outlet(st.source_outlet_id) or user_can_access_outlet(st.destination_outlet_id))
    )
  );
