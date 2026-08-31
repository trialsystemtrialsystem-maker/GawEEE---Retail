-- 027_campaign_targeting.sql
-- "Send Marketing Campaign" (Sales > Campaign) reuses the WhatsApp broadcast
-- table/logic (013_whatsapp.sql) rather than a new one — a campaign here is
-- just a broadcast optionally targeted at a customer_groups segment instead
-- of "all customers with a phone on file".

alter table whatsapp_broadcasts add column customer_group_id uuid references customer_groups(id);
