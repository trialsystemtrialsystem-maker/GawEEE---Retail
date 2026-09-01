-- 035_expiry_batch_tracking.sql
-- Expiry/Batch Tracking — scoped down deliberately (see Phase 11 plan item
-- 11): NOT full FEFO (that would mean restructuring `inventory` from one
-- row per outlet+product into one row per batch, touching every
-- inventory-affecting function in the app — a project of its own). What
-- ships instead: capture batch_number/expiry_date when receiving a PO into
-- the columns inventory_ledger already had (002_products_inventory.sql)
-- but never populated, plus a report to see what's expiring. No auto-FEFO
-- deduction at sale time.
--
-- update_inventory() gets two new OPTIONAL trailing params with defaults —
-- purely additive, every existing call site (create_invoice, void_invoice,
-- stock transfers, production runs, purchase/customer returns) is
-- unaffected and keeps writing null for both, exactly as today.
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
