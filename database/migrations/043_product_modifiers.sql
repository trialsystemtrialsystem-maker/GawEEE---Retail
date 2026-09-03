-- 043_product_modifiers.sql
-- Phase 13 Batch A item 3 — Extra Product (modifiers), e.g. "Level Pedas:
-- Sedang" or "Tambahan: Extra Keju". An option is either:
--   - a PRICED add-on (linked_product_id set) — selecting it adds that real
--     product as its own cart line via the existing addItem(), so pricing
--     flows through normal checkout with zero create_invoice() changes;
--   - an UNPRICED choice (linked_product_id null) — attaches a note to the
--     parent line via the note_presets/invoice_items.notes mechanism
--     (migration 042), also zero create_invoice() changes.
-- Groups/options are scoped through their product's company_id (products
-- are company-scoped, not outlet-scoped — same pattern as special_prices'
-- group-scoping and every other products-adjacent table in this codebase).

create table product_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name varchar(100) not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_product_modifier_groups_product_id on product_modifier_groups(product_id);

create table product_modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references product_modifier_groups(id) on delete cascade,
  label varchar(100) not null,
  linked_product_id uuid references products(id),
  sort_order int not null default 0
);

create index idx_product_modifier_options_group_id on product_modifier_options(group_id);

alter table product_modifier_groups enable row level security;
create policy product_modifier_groups_access on product_modifier_groups
  for all using (exists (select 1 from products p where p.id = product_id and p.company_id = current_user_company_id()));

alter table product_modifier_options enable row level security;
create policy product_modifier_options_access on product_modifier_options
  for all using (
    exists (
      select 1 from product_modifier_groups g
      join products p on p.id = g.product_id
      where g.id = group_id and p.company_id = current_user_company_id()
    )
  );
