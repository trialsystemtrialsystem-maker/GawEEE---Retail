-- 022_purchasing_extensions.sql
-- Item Request (internal "we need to restock X" request, converted into a
-- real PO manually — no auto-generation, keeps the existing PO creation
-- flow as the single source of truth for what a PO contains) and Purchase
-- Return (returning received PO stock back to a supplier).

create table item_requests (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity_requested int not null,
  reason text,
  status varchar(50) not null default 'pending', -- 'pending', 'approved', 'rejected', 'converted'
  requested_by uuid not null references users(id),
  decided_by uuid references users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_item_requests_outlet_id_status on item_requests(outlet_id, status);

create table purchase_returns (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  po_id uuid references purchase_orders(id),
  return_date date not null,
  reason text not null,
  status varchar(50) not null default 'draft', -- 'draft', 'completed'
  total_amount decimal(15,2) not null default 0,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_purchase_returns_outlet_id on purchase_returns(outlet_id);

create table purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references purchase_returns(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null,
  unit_cost decimal(15,2) not null
);

create index idx_purchase_return_items_return_id on purchase_return_items(return_id);

-- Atomically applies a draft return's line items to inventory (stock out,
-- movement_type='purchase_return') and marks it completed — mirrors
-- submit_stocktake()'s pattern. Not editable after this point, same as an
-- invoice or a posted journal entry.
create or replace function submit_purchase_return(p_return_id uuid, p_submitted_by uuid)
returns table (total_amount decimal) as $$
declare
  v_outlet_id uuid;
  v_status varchar;
  v_item record;
  v_total decimal := 0;
begin
  select outlet_id, status into v_outlet_id, v_status from purchase_returns where id = p_return_id for update;
  if v_outlet_id is null then
    raise exception 'Retur pembelian tidak ditemukan';
  end if;
  if v_status <> 'draft' then
    raise exception 'Retur ini sudah diselesaikan';
  end if;

  for v_item in select product_id, quantity, unit_cost from purchase_return_items where return_id = p_return_id loop
    perform update_inventory(
      v_outlet_id,
      v_item.product_id,
      -v_item.quantity,
      'purchase_return',
      p_submitted_by,
      p_return_id,
      'purchase_return',
      v_item.unit_cost,
      'Retur barang ke supplier'
    );
    v_total := v_total + (v_item.quantity * v_item.unit_cost);
  end loop;

  update purchase_returns set status = 'completed', total_amount = v_total where id = p_return_id;

  return query select v_total;
end;
$$ language plpgsql;

-- RLS: same outlet-scoped shape used throughout.
alter table item_requests enable row level security;
create policy item_requests_select on item_requests for select using (user_can_access_outlet(outlet_id));
create policy item_requests_insert on item_requests for insert with check (user_can_access_outlet(outlet_id));
create policy item_requests_update on item_requests for update using (user_can_access_outlet(outlet_id));

alter table purchase_returns enable row level security;
create policy purchase_returns_select on purchase_returns for select using (user_can_access_outlet(outlet_id));
create policy purchase_returns_insert on purchase_returns for insert with check (user_can_access_outlet(outlet_id));
create policy purchase_returns_update on purchase_returns for update using (user_can_access_outlet(outlet_id));

alter table purchase_return_items enable row level security;
create policy purchase_return_items_access on purchase_return_items
  for all using (
    exists (select 1 from purchase_returns pr where pr.id = return_id and user_can_access_outlet(pr.outlet_id))
  );
