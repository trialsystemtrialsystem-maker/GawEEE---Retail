-- 020_stocktake_functions.sql
-- Wires up stocktakes/stocktake_details (002_products_inventory.sql, unused
-- since) with an atomic submit function: applies every counted-vs-expected
-- variance to inventory via update_inventory() (recording each in
-- inventory_ledger) and marks the session completed, all-or-nothing —
-- mirrors the create_invoice()/void_invoice() pattern.

create or replace function submit_stocktake(p_stocktake_id uuid, p_submitted_by uuid)
returns table (total_variance_value decimal) as $$
declare
  v_outlet_id uuid;
  v_status varchar;
  v_detail record;
  v_total_variance decimal := 0;
  v_purchase_price decimal;
begin
  select outlet_id, status into v_outlet_id, v_status from stocktakes where id = p_stocktake_id for update;
  if v_outlet_id is null then
    raise exception 'Stocktake tidak ditemukan';
  end if;
  if v_status not in ('draft', 'in_progress') then
    raise exception 'Stocktake ini sudah diselesaikan';
  end if;

  for v_detail in
    select sd.product_id, sd.expected_quantity, sd.counted_quantity, sd.variance
    from stocktake_details sd
    where sd.stocktake_id = p_stocktake_id
  loop
    select purchase_price into v_purchase_price from products where id = v_detail.product_id;
    v_total_variance := v_total_variance + (v_detail.variance * coalesce(v_purchase_price, 0));

    if v_detail.variance <> 0 then
      perform update_inventory(
        v_outlet_id,
        v_detail.product_id,
        v_detail.variance,
        'stocktake',
        p_submitted_by,
        p_stocktake_id,
        'stocktake',
        v_purchase_price,
        'Penyesuaian hasil stok opname'
      );
    end if;
  end loop;

  update stocktakes
    set status = 'completed', actual_end_date = now(), total_variance_value = v_total_variance
    where id = p_stocktake_id;

  return query select v_total_variance;
end;
$$ language plpgsql;
