-- 032_product_bundles.sql
-- Product Bundling ("Paket Hemat") — a fixed set of products sold together
-- at a set bundle price. POS gets a "quick-add bundle" action that adds
-- every component to the cart at once; the gap between the components'
-- normal total and the bundle price is applied via the invoice's existing
-- discount_amount/discount_reason fields (already wired end-to-end through
-- create_invoice()), so create_invoice() itself needs no changes.

create table product_bundles (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(255) not null,
  bundle_price decimal(15,2) not null,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_product_bundles_outlet_id on product_bundles(outlet_id);

create table product_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references product_bundles(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null default 1
);

create index idx_product_bundle_items_bundle_id on product_bundle_items(bundle_id);

alter table product_bundles enable row level security;
create policy product_bundles_select on product_bundles for select using (user_can_access_outlet(outlet_id));
create policy product_bundles_insert on product_bundles for insert with check (user_can_access_outlet(outlet_id));
create policy product_bundles_update on product_bundles for update using (user_can_access_outlet(outlet_id));

alter table product_bundle_items enable row level security;
create policy product_bundle_items_access on product_bundle_items
  for all using (exists (select 1 from product_bundles b where b.id = bundle_id and user_can_access_outlet(b.outlet_id)));
