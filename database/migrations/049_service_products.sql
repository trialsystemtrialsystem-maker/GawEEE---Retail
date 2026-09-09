-- 049_service_products.sql
-- Phase 13 Batch E item 12 — Service Products. The one deliberate
-- create_invoice()/void_invoice() change in this phase: a service has no
-- stock to check, deduct, or restore. Both functions keep their exact
-- existing parameter signatures (so `create or replace` genuinely replaces
-- them rather than creating a new overload — see the update_inventory
-- overload bug fixed in 037), and 'goods' (the default, i.e. every product
-- that exists today) keeps byte-for-byte unchanged behavior.

alter table products add column product_type varchar(20) not null default 'goods' check (product_type in ('goods', 'service'));

-- Item 14 (Kitchen Report): nullable, no default for 'goods' (irrelevant to
-- them); stamped to 'pending' for service lines via the same non-atomic
-- follow-up UPDATE pattern already used for sold_unit_label/notes.
alter table invoice_items add column prep_status varchar(20) check (prep_status in ('pending', 'preparing', 'ready'));

create or replace function create_invoice(
  p_outlet_id uuid,
  p_cashier_id uuid,
  p_items jsonb, -- [{product_id, quantity, discount?}, ...]
  p_payment_method varchar,
  p_customer_name varchar default null,
  p_customer_phone varchar default null,
  p_discount_amount decimal default 0,
  p_discount_reason text default null
)
returns table (invoice_id uuid, invoice_number varchar, total decimal, payment_status varchar)
language plpgsql
as $$
declare
  v_invoice_id uuid;
  v_invoice_number varchar;
  v_subtotal decimal := 0;
  v_tax_rate decimal;
  v_tax_amount decimal;
  v_total decimal;
  v_item jsonb;
  v_product products%rowtype;
  v_available int;
  v_qty int;
  v_item_discount decimal;
  v_cogs decimal;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang tidak boleh kosong';
  end if;

  -- Pass 1: lock every affected inventory row and validate stock before
  -- writing anything, so a failure partway through never leaves the cart
  -- half-deducted. Services have no stock, so skip entirely.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select p.* into v_product from products p where p.id = (v_item ->> 'product_id')::uuid;
    if v_product.id is null then
      raise exception 'Produk % tidak ditemukan', v_item ->> 'product_id';
    end if;

    if v_product.product_type = 'service' then
      continue;
    end if;

    v_qty := (v_item ->> 'quantity')::int;

    select quantity_available into v_available
    from inventory
    where outlet_id = p_outlet_id and product_id = v_product.id
    for update;

    if v_available is null or v_available < v_qty then
      raise exception 'Stok tidak cukup untuk produk %', v_product.name;
    end if;
  end loop;

  -- Pass 2: compute totals
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select p.* into v_product from products p where p.id = (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    v_item_discount := coalesce((v_item ->> 'discount')::decimal, 0);
    v_subtotal := v_subtotal + (v_product.selling_price * v_qty - v_item_discount);
  end loop;

  select c.tax_rate into v_tax_rate
  from companies c join outlets o on o.company_id = c.id
  where o.id = p_outlet_id;
  v_tax_rate := coalesce(v_tax_rate, 10.0) / 100;
  v_tax_amount := round((v_subtotal - p_discount_amount) * v_tax_rate, 2);
  v_total := v_subtotal - p_discount_amount + v_tax_amount;

  v_invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(floor(random() * 100000)::text, 5, '0');

  insert into invoices (
    outlet_id, invoice_number, customer_name, customer_phone, cashier_id,
    subtotal, discount_amount, discount_reason, tax_amount, total, payment_status
  ) values (
    p_outlet_id, v_invoice_number, p_customer_name, p_customer_phone, p_cashier_id,
    v_subtotal, p_discount_amount, p_discount_reason, v_tax_amount, v_total,
    case when p_payment_method = 'cash' then 'paid' else 'pending' end
  )
  returning id into v_invoice_id;

  -- Pass 3: write line items + deduct inventory (skip the deduction for services)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select p.* into v_product from products p where p.id = (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    v_item_discount := coalesce((v_item ->> 'discount')::decimal, 0);
    v_cogs := v_product.purchase_price * v_qty;

    insert into invoice_items (invoice_id, product_id, quantity, unit_price, item_discount, cost_of_goods_sold)
    values (v_invoice_id, v_product.id, v_qty, v_product.selling_price, v_item_discount, v_cogs);

    if v_product.product_type <> 'service' then
      perform update_inventory(
        p_outlet_id => p_outlet_id,
        p_product_id => v_product.id,
        p_quantity_change => -v_qty,
        p_movement_type => 'sales',
        p_recorded_by => p_cashier_id,
        p_reference_id => v_invoice_id,
        p_reference_type => 'invoice'
      );
    end if;
  end loop;

  return query
    select v_invoice_id, v_invoice_number, v_total, i.payment_status
    from invoices i where i.id = v_invoice_id;
end;
$$;

-- void_invoice: mirror the same guard — a voided service line never had
-- stock deducted, so it must not have stock "returned" either (that would
-- incorrectly inflate inventory for a product with no real stock concept).
create or replace function void_invoice(
  p_invoice_id uuid,
  p_voided_by uuid,
  p_reason text
)
returns table (voided_at timestamptz, stock_returned int)
language plpgsql
as $$
declare
  v_invoice invoices%rowtype;
  v_item invoice_items%rowtype;
  v_product products%rowtype;
  v_stock_returned int := 0;
begin
  select * into v_invoice from invoices where id = p_invoice_id for update;
  if v_invoice.id is null then
    raise exception 'Invoice tidak ditemukan';
  end if;
  if v_invoice.order_status = 'voided' then
    raise exception 'Invoice sudah dibatalkan sebelumnya';
  end if;
  if now() - v_invoice.created_at > interval '24 hours' then
    raise exception 'Invoice hanya bisa dibatalkan dalam 24 jam setelah dibuat';
  end if;

  for v_item in select * from invoice_items where invoice_id = p_invoice_id loop
    select p.* into v_product from products p where p.id = v_item.product_id;
    if v_product.product_type = 'service' then
      continue;
    end if;

    perform update_inventory(
      p_outlet_id => v_invoice.outlet_id,
      p_product_id => v_item.product_id,
      p_quantity_change => v_item.quantity,
      p_movement_type => 'return',
      p_recorded_by => p_voided_by,
      p_reference_id => p_invoice_id,
      p_reference_type => 'invoice_void'
    );
    v_stock_returned := v_stock_returned + v_item.quantity;
  end loop;

  update invoices
    set order_status = 'voided',
        voided_at = now(),
        voided_by = p_voided_by,
        void_reason = p_reason
    where id = p_invoice_id;

  update payment_transactions
    set status = 'refunded', updated_at = now()
    where invoice_id = p_invoice_id and status = 'settled';

  return query select now(), v_stock_returned;
end;
$$;
