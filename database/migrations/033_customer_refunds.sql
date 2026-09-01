-- 033_customer_refunds.sql
-- Customer Refund — a customer returns some items from a completed sale for
-- a refund. Distinct from Purchase Return (which returns stock to a
-- supplier) and from void_invoice() (which cancels the whole transaction):
-- a refund is partial-or-full, keeps the original invoice/payment intact,
-- and is recorded as its own entity so it doesn't retroactively rewrite the
-- original payment_transactions row.

create table customer_refunds (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  invoice_id uuid not null references invoices(id),
  refund_method varchar(50) not null, -- 'cash', 'e_wallet', 'bank_transfer'
  reason text not null,
  status varchar(50) not null default 'draft', -- 'draft', 'completed'
  total_amount decimal(15,2) not null default 0,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_customer_refunds_outlet_id on customer_refunds(outlet_id);
create index idx_customer_refunds_invoice_id on customer_refunds(invoice_id);

create table customer_refund_items (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references customer_refunds(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null,
  unit_price decimal(15,2) not null
);

create index idx_customer_refund_items_refund_id on customer_refund_items(refund_id);

-- Atomically restocks a draft refund's items (mirrors submit_purchase_return()
-- / submit_stocktake()'s draft -> completed pattern) and marks it completed.
-- Deliberately does NOT touch invoices/payment_transactions/void_invoice() —
-- the original sale record stays exactly as it was; the refund is its own
-- ledger entry.
create or replace function submit_customer_refund(p_refund_id uuid, p_submitted_by uuid)
returns table (total_amount decimal) as $$
declare
  v_outlet_id uuid;
  v_status varchar;
  v_item record;
  v_total decimal := 0;
begin
  select outlet_id, status into v_outlet_id, v_status from customer_refunds where id = p_refund_id for update;
  if v_outlet_id is null then
    raise exception 'Refund tidak ditemukan';
  end if;
  if v_status <> 'draft' then
    raise exception 'Refund ini sudah diproses';
  end if;

  for v_item in select product_id, quantity, unit_price from customer_refund_items where refund_id = p_refund_id loop
    perform update_inventory(
      v_outlet_id,
      v_item.product_id,
      v_item.quantity,
      'return',
      p_submitted_by,
      p_refund_id,
      'customer_refund',
      v_item.unit_price,
      'Retur dari pelanggan'
    );
    v_total := v_total + (v_item.quantity * v_item.unit_price);
  end loop;

  update customer_refunds set status = 'completed', total_amount = v_total where id = p_refund_id;

  return query select v_total;
end;
$$ language plpgsql;

alter table customer_refunds enable row level security;
create policy customer_refunds_select on customer_refunds for select using (user_can_access_outlet(outlet_id));
create policy customer_refunds_insert on customer_refunds for insert with check (user_can_access_outlet(outlet_id));
create policy customer_refunds_update on customer_refunds for update using (user_can_access_outlet(outlet_id));

alter table customer_refund_items enable row level security;
create policy customer_refund_items_access on customer_refund_items
  for all using (exists (select 1 from customer_refunds r where r.id = refund_id and user_can_access_outlet(r.outlet_id)));
