-- 029_fix_production_run.sql
-- Fixes a real bug in submit_production_run() (028_stock_production.sql):
-- `returns table (output_quantity int)` implicitly declares a plpgsql
-- variable named `output_quantity` in the function body, which collided
-- with `recipes.output_quantity` in the `select output_product_id,
-- output_quantity into ... from recipes` line — Postgres raised "column
-- reference \"output_quantity\" is ambiguous" on every call. Renaming the
-- output column to `produced_quantity` removes the collision. Found by
-- actually calling the function end-to-end (not just reading the SQL) —
-- confirmed create_recipe/create_production_run succeeded but /submit
-- failed with that exact error.

create or replace function submit_production_run(p_run_id uuid, p_submitted_by uuid)
returns table (produced_quantity int) as $$
declare
  v_outlet_id uuid;
  v_recipe_id uuid;
  v_batch_count int;
  v_status varchar;
  v_output_product uuid;
  v_output_qty int;
  v_ingredient record;
begin
  select outlet_id, recipe_id, batch_count, status into v_outlet_id, v_recipe_id, v_batch_count, v_status
    from production_runs where id = p_run_id for update;
  if v_outlet_id is null then
    raise exception 'Production run tidak ditemukan';
  end if;
  if v_status <> 'draft' then
    raise exception 'Production run ini sudah diselesaikan';
  end if;

  select output_product_id, output_quantity into v_output_product, v_output_qty from recipes where id = v_recipe_id;

  for v_ingredient in
    select ingredient_product_id, quantity from recipe_ingredients where recipe_id = v_recipe_id
  loop
    perform update_inventory(
      v_outlet_id, v_ingredient.ingredient_product_id, -(v_ingredient.quantity * v_batch_count),
      'production_consume', p_submitted_by, p_run_id, 'production_run', null, 'Konsumsi bahan produksi'
    );
  end loop;

  perform update_inventory(
    v_outlet_id, v_output_product, v_output_qty * v_batch_count,
    'production_output', p_submitted_by, p_run_id, 'production_run', null, 'Hasil produksi'
  );

  update production_runs set status = 'completed', completed_at = now() where id = p_run_id;

  return query select v_output_qty * v_batch_count;
end;
$$ language plpgsql;
