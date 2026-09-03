-- 042_notes_category.sql
-- Phase 13 Batch A item 2 — Notes Category List: a manager-curated list of
-- selectable notes (e.g. "tanpa MSG", "extra pedas") attachable to a cart
-- line. invoice_items never had a notes column (confirmed) — added here.
-- create_invoice() itself is untouched: notes are stamped onto the created
-- invoice_items rows via a non-atomic follow-up UPDATE from the API route,
-- the exact same pattern already used for Multi-UOM's sold_unit_label
-- (Phase 11) — cosmetic/informational only, never financially load-bearing.

create table note_presets (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  label varchar(100) not null,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_note_presets_outlet_id on note_presets(outlet_id);

alter table invoice_items add column notes text;

alter table note_presets enable row level security;
create policy note_presets_select on note_presets for select using (user_can_access_outlet(outlet_id));
create policy note_presets_insert on note_presets for insert with check (user_can_access_outlet(outlet_id));
create policy note_presets_update on note_presets for update using (user_can_access_outlet(outlet_id));
create policy note_presets_delete on note_presets for delete using (user_can_access_outlet(outlet_id));
