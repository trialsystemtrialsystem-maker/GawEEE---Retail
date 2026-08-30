-- 013_whatsapp.sql
-- WhatsApp message templates + broadcast log. Not connected to a real WhatsApp
-- Business API (no credentials/infra) — this stores templates and simulates
-- sending a broadcast (marks it 'sent' with a computed recipient count).

create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name varchar(255) not null,
  content text not null, -- may contain {nama}, {invoice}, {total} placeholders
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_whatsapp_templates_outlet_id on whatsapp_templates(outlet_id);

create table whatsapp_broadcasts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  template_id uuid not null references whatsapp_templates(id),
  target_note varchar(255) not null, -- free-text description of the audience, e.g. "Pelanggan minggu ini"
  status varchar(50) not null default 'draft', -- 'draft', 'sent'
  sent_count int not null default 0,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index idx_whatsapp_broadcasts_outlet_id on whatsapp_broadcasts(outlet_id);

create trigger trg_whatsapp_templates_updated_at before update on whatsapp_templates
  for each row execute function set_updated_at();

-- RLS: same outlet-scoped read/write shape used throughout 010_rls_policies.sql.
alter table whatsapp_templates enable row level security;
create policy whatsapp_templates_select on whatsapp_templates
  for select using (user_can_access_outlet(outlet_id));
create policy whatsapp_templates_insert on whatsapp_templates
  for insert with check (user_can_access_outlet(outlet_id));
create policy whatsapp_templates_update on whatsapp_templates
  for update using (user_can_access_outlet(outlet_id));
create policy whatsapp_templates_delete on whatsapp_templates
  for delete using (
    user_can_access_outlet(outlet_id) and current_user_role() in ('master_admin', 'outlet_manager')
  );

alter table whatsapp_broadcasts enable row level security;
create policy whatsapp_broadcasts_select on whatsapp_broadcasts
  for select using (user_can_access_outlet(outlet_id));
create policy whatsapp_broadcasts_insert on whatsapp_broadcasts
  for insert with check (user_can_access_outlet(outlet_id));
