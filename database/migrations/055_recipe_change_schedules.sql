-- 055_recipe_change_schedules.sql
-- Phase 13 Batch J — Scheduling Recipe Changes. Same check-on-page-load
-- apply pattern as Price Scheduler (item 7, migration 046) — no real cron
-- exists in this app (confirmed) — disclosed in the UI as check-on-open,
-- not a real-time cron.

create table recipe_change_schedules (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  new_ingredients jsonb not null, -- [{ingredient_product_id, quantity}, ...] snapshot
  effective_date date not null,
  applied boolean not null default false,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_recipe_change_schedules_recipe_id on recipe_change_schedules(recipe_id);

alter table recipe_change_schedules enable row level security;
create policy recipe_change_schedules_access on recipe_change_schedules
  for all using (exists (select 1 from recipes r where r.id = recipe_id and user_can_access_outlet(r.outlet_id)));
