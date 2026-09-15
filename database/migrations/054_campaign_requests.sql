-- 054_campaign_requests.sql
-- Phase 13 Batch I — Buy Marketing Campaign. Mirrors expense_requests'
-- exact submit/approve/reject shape. Scoped down and honestly labeled in
-- the UI: an internal budget tracker & approval log, not connected to any
-- ad-platform API — same disclosure convention as the WhatsApp broadcast
-- simulation.

create table campaign_requests (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  campaign_name varchar(255) not null,
  platform varchar(20) not null check (platform in ('meta', 'google', 'tiktok', 'other')),
  budget_amount decimal(15,2) not null,
  notes text,
  requested_by uuid not null references users(id),
  status varchar(20) not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  approved_by uuid references users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_campaign_requests_outlet_id on campaign_requests(outlet_id);

alter table campaign_requests enable row level security;
create policy campaign_requests_select on campaign_requests for select using (user_can_access_outlet(outlet_id));
create policy campaign_requests_insert on campaign_requests for insert with check (user_can_access_outlet(outlet_id));
create policy campaign_requests_update on campaign_requests for update using (user_can_access_outlet(outlet_id));
