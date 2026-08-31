-- 028_stock_production.sql
-- Stock Production + Master Recipes — genuinely fits the bakery vertical
-- (prd.md lists bakery as a target industry): turning raw ingredients into
-- finished goods. "Master Recipes" (recipe definitions) and "Stock
-- Production Template" from the mockup are the same concept — a template
-- *is* a recipe — folded into one `recipes` table rather than two.

create table recipes (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(255) not null,
  output_product_id uuid not null references products(id),
  output_quantity int not null, -- how many units of output_product one batch produces
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_recipes_outlet_id on recipes(outlet_id);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_product_id uuid not null references products(id),
  quantity int not null -- consumed per one batch
);

create index idx_recipe_ingredients_recipe_id on recipe_ingredients(recipe_id);

create table production_runs (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  recipe_id uuid not null references recipes(id),
  batch_count int not null,
  status varchar(50) not null default 'draft', -- 'draft', 'completed'
  produced_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_production_runs_outlet_id on production_runs(outlet_id);

-- Atomically consumes every ingredient (batch_count x recipe quantity) and
-- adds the finished-good output — fails the whole run if any ingredient
-- has insufficient stock (same guarantee update_inventory() already gives
-- create_invoice()/ship_stock_transfer()).
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

alter table recipes enable row level security;
create policy recipes_select on recipes for select using (user_can_access_outlet(outlet_id));
create policy recipes_insert on recipes for insert with check (user_can_access_outlet(outlet_id));
create policy recipes_update on recipes for update using (user_can_access_outlet(outlet_id));

alter table recipe_ingredients enable row level security;
create policy recipe_ingredients_access on recipe_ingredients
  for all using (exists (select 1 from recipes r where r.id = recipe_id and user_can_access_outlet(r.outlet_id)));

alter table production_runs enable row level security;
create policy production_runs_select on production_runs for select using (user_can_access_outlet(outlet_id));
create policy production_runs_insert on production_runs for insert with check (user_can_access_outlet(outlet_id));
create policy production_runs_update on production_runs for update using (user_can_access_outlet(outlet_id));
