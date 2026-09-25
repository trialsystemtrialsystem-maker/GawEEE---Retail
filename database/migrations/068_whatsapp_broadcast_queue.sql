-- 068_whatsapp_broadcast_queue.sql
-- WhatsApp broadcasts were marked "sent" without anything being sent (there is
-- no WhatsApp Business API integration). This makes them honest: a broadcast
-- becomes a per-recipient QUEUE of personalised messages with click-to-send
-- links; each recipient is marked sent/skipped by the operator, so sent_count
-- reflects real sends. Also adds a customer opt-out so promotions respect
-- people who asked not to receive them. Run in the Supabase SQL Editor (after 067).

alter table customers add column if not exists whatsapp_opt_out boolean not null default false;

create table if not exists whatsapp_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references whatsapp_broadcasts(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  name varchar(255) not null,
  phone varchar(30) not null,
  message text not null,
  status varchar(10) not null default 'pending' check (status in ('pending', 'sent', 'skipped')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_wa_recipients_broadcast on whatsapp_broadcast_recipients(broadcast_id, status);

alter table whatsapp_broadcast_recipients enable row level security;
create policy wa_recipients_select on whatsapp_broadcast_recipients for select using (user_can_access_outlet(outlet_id));
create policy wa_recipients_insert on whatsapp_broadcast_recipients for insert with check (user_can_access_outlet(outlet_id));
create policy wa_recipients_update on whatsapp_broadcast_recipients for update using (user_can_access_outlet(outlet_id));
create policy wa_recipients_delete on whatsapp_broadcast_recipients for delete using (user_can_access_outlet(outlet_id));
