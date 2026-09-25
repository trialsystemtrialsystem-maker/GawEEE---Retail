-- 070_product_price_history.sql
-- Automatic price history: every change to a product's purchase or selling price
-- is recorded (old -> new, who, when), whichever screen or import made it, so
-- margin changes can be audited and explained. The trigger only INSERTs into the
-- new table. Run in the Supabase SQL Editor (after 069).

create table if not exists product_price_changes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  old_purchase_price decimal(15,2),
  new_purchase_price decimal(15,2),
  old_selling_price decimal(15,2),
  new_selling_price decimal(15,2),
  changed_by uuid references users(id),
  changed_at timestamptz not null default now()
);
create index if not exists idx_product_price_changes_product on product_price_changes(product_id, changed_at desc);

create or replace function log_product_price_change() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.purchase_price is distinct from old.purchase_price or new.selling_price is distinct from old.selling_price then
    insert into product_price_changes (product_id, company_id, old_purchase_price, new_purchase_price, old_selling_price, new_selling_price, changed_by)
    values (new.id, new.company_id, old.purchase_price, new.purchase_price, old.selling_price, new.selling_price, auth.uid());
  end if;
  return new;
exception when others then
  raise warning 'log_product_price_change failed for product %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_log_product_price_change on products;
create trigger trg_log_product_price_change after update of purchase_price, selling_price on products
  for each row execute function log_product_price_change();

alter table product_price_changes enable row level security;
create policy product_price_changes_select on product_price_changes for select using (company_id = current_user_company_id());
