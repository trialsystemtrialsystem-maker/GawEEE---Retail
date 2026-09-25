-- 066_inventory_costing_bins_serials.sql
-- Inventory depth: perpetual moving-average cost (per outlet+product), bin/rak
-- location, and a serial-number registry.
--
-- Design choices, kept deliberately non-invasive:
--  * update_inventory() keeps the SAME 11-parameter signature (see 037 for why
--    that matters) and only gains an avg-cost update block; every caller works
--    unchanged. Only receipts (purchase / transfer / production) with a unit
--    cost move the average; sales, returns, waste and adjustments never do.
--  * create_invoice() is NOT touched. A BEFORE INSERT trigger on invoice_items
--    replaces cost_of_goods_sold with avg_cost * quantity when an average exists,
--    otherwise the existing purchase_price-based value stands. Void reversals
--    and the sales journal (059) read that stored COGS, so they stay consistent.
-- Run in the Supabase SQL Editor (after 065).

alter table inventory add column if not exists avg_cost decimal(15,4);
alter table inventory add column if not exists bin_location varchar(50);

-- Weighted average of what was actually received, so history is not lost.
update inventory i
set avg_cost = s.avg
from (
  select outlet_id, product_id, sum(quantity_change * unit_cost) / sum(quantity_change) as avg
  from inventory_ledger
  where movement_type in ('purchase', 'transfer', 'production') and quantity_change > 0 and unit_cost > 0
  group by outlet_id, product_id
) s
where i.outlet_id = s.outlet_id and i.product_id = s.product_id and i.avg_cost is null;

create or replace function update_inventory(
  p_outlet_id uuid,
  p_product_id uuid,
  p_quantity_change int,
  p_movement_type varchar,
  p_recorded_by uuid,
  p_reference_id uuid default null,
  p_reference_type varchar default null,
  p_unit_cost decimal default null,
  p_notes text default null,
  p_batch_number varchar default null,
  p_expiry_date date default null
)
returns table (new_quantity_on_hand int) as $$
declare
  v_new_qty int;
  v_old_qty int;
  v_old_avg decimal;
  v_reorder_level int;
begin
  insert into inventory (outlet_id, product_id, quantity_on_hand)
  values (p_outlet_id, p_product_id, greatest(p_quantity_change, 0))
  on conflict (outlet_id, product_id) do update
    set quantity_on_hand = inventory.quantity_on_hand + p_quantity_change,
        updated_at = now()
  returning quantity_on_hand into v_new_qty;

  if v_new_qty < 0 then
    raise exception 'Insufficient stock for product % at outlet % (would go to %)',
      p_product_id, p_outlet_id, v_new_qty;
  end if;

  insert into inventory_ledger (
    outlet_id, product_id, movement_type, quantity_change,
    unit_cost, reference_type, reference_id, recorded_by, notes,
    batch_number, expiry_date
  ) values (
    p_outlet_id, p_product_id, p_movement_type, p_quantity_change,
    p_unit_cost, coalesce(p_reference_type, p_movement_type), p_reference_id, p_recorded_by, p_notes,
    p_batch_number, p_expiry_date
  );

  -- Moving average: only receipts priced above zero move it.
  if p_quantity_change > 0 and coalesce(p_unit_cost, 0) > 0 and p_movement_type in ('purchase', 'transfer', 'production') then
    v_old_qty := greatest(v_new_qty - p_quantity_change, 0);
    select coalesce(i.avg_cost, p.purchase_price, p_unit_cost)
      into v_old_avg
    from inventory i join products p on p.id = i.product_id
    where i.outlet_id = p_outlet_id and i.product_id = p_product_id;

    update inventory
      set avg_cost = round((v_old_qty * v_old_avg + p_quantity_change * p_unit_cost) / (v_old_qty + p_quantity_change), 4)
    where outlet_id = p_outlet_id and product_id = p_product_id;
  end if;

  select coalesce(inventory.reorder_level, p.reorder_level)
    into v_reorder_level
  from inventory
  join products p on p.id = inventory.product_id
  where inventory.outlet_id = p_outlet_id and inventory.product_id = p_product_id;

  update inventory
    set alert_status = case
      when v_new_qty <= 0 then 'out_of_stock'
      when v_new_qty <= coalesce(v_reorder_level, 0) then 'low_stock'
      else 'normal'
    end
  where outlet_id = p_outlet_id and product_id = p_product_id;

  return query select v_new_qty;
end;
$$ language plpgsql;

-- COGS at the moving-average cost. Falls back silently (never blocks a sale).
create or replace function apply_avg_cost_to_invoice_item() returns trigger
language plpgsql
as $$
declare
  v_avg decimal;
begin
  select i.avg_cost into v_avg
  from invoices v
  join inventory i on i.outlet_id = v.outlet_id and i.product_id = new.product_id
  where v.id = new.invoice_id;

  if v_avg is not null and v_avg > 0 then
    new.cost_of_goods_sold := round(v_avg * new.quantity, 2);
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_apply_avg_cost_to_invoice_item on invoice_items;
create trigger trg_apply_avg_cost_to_invoice_item before insert on invoice_items
  for each row execute function apply_avg_cost_to_invoice_item();

-- ---------------------------------------------------------- SERIAL NUMBERS
create table if not exists product_serials (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  serial_number varchar(100) not null,
  status varchar(15) not null default 'in_stock' check (status in ('in_stock', 'sold', 'returned', 'damaged')),
  received_on date not null default current_date,
  sold_on date,
  invoice_id uuid references invoices(id) on delete set null,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (product_id, serial_number)
);
create index if not exists idx_product_serials_outlet_status on product_serials(outlet_id, status);

alter table product_serials enable row level security;
create policy product_serials_select on product_serials for select using (user_can_access_outlet(outlet_id));
create policy product_serials_insert on product_serials for insert with check (user_can_access_outlet(outlet_id));
create policy product_serials_update on product_serials for update using (user_can_access_outlet(outlet_id));
create policy product_serials_delete on product_serials for delete using (user_can_access_outlet(outlet_id));
