-- 040_checklist_activity.sql
-- Checklist Activity — an opening/closing duty checklist. checklist_items
-- is the manager-defined list (e.g. "Nyalakan freezer", "Hitung kas awal");
-- checklist_completions records who ticked which item off on which date —
-- one row per completion, deleting it un-ticks the item. Any cashier can
-- tick any item (this isn't an assignment/ownership system, just shared
-- shift duties), so completions carry who/when for visibility, not access
-- control beyond the outlet.

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  label varchar(255) not null,
  category varchar(50) not null default 'opening', -- 'opening', 'closing'
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_checklist_items_outlet_id on checklist_items(outlet_id);

create table checklist_completions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  item_id uuid not null references checklist_items(id) on delete cascade,
  completed_by uuid not null references users(id),
  shift_date date not null default current_date,
  completed_at timestamptz not null default now(),
  note text
);

create index idx_checklist_completions_outlet_date on checklist_completions(outlet_id, shift_date);

alter table checklist_items enable row level security;
create policy checklist_items_select on checklist_items for select using (user_can_access_outlet(outlet_id));
create policy checklist_items_insert on checklist_items for insert with check (user_can_access_outlet(outlet_id));
create policy checklist_items_update on checklist_items for update using (user_can_access_outlet(outlet_id));
create policy checklist_items_delete on checklist_items for delete using (user_can_access_outlet(outlet_id));

alter table checklist_completions enable row level security;
create policy checklist_completions_select on checklist_completions for select using (user_can_access_outlet(outlet_id));
create policy checklist_completions_insert on checklist_completions for insert with check (user_can_access_outlet(outlet_id));
create policy checklist_completions_delete on checklist_completions for delete using (user_can_access_outlet(outlet_id));
