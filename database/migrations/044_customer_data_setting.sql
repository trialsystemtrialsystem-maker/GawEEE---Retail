-- 044_customer_data_setting.sql
-- Phase 13 Batch B item 4 — Customer Data Setting. Two additive pieces:
--   - customer_field_definitions gets is_required (was add-only, no
--     update/delete path) + update/delete RLS so the manager UI can edit and
--     remove a custom field definition, not just create one.
--   - a new outlet-level customer_module_settings row (require phone at
--     checkout, default walk-in group) — genuinely distinct from Customer
--     Custom Fields (which defines per-customer data columns): this is
--     module-wide behavior, not a data schema.

alter table customer_field_definitions add column is_required boolean not null default false;

create policy customer_field_definitions_update on customer_field_definitions for update using (user_can_access_outlet(outlet_id));
create policy customer_field_definitions_delete on customer_field_definitions for delete using (user_can_access_outlet(outlet_id));

create table customer_module_settings (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  require_phone_on_checkout boolean not null default false,
  default_group_id uuid references customer_groups(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table customer_module_settings enable row level security;
create policy customer_module_settings_access on customer_module_settings
  for all using (user_can_access_outlet(outlet_id));
