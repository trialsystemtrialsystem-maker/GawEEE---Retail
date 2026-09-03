-- 045_customer_reviews.sql
-- Phase 13 Batch B item 6 — Customer Satisfaction. No live review-collection
-- channel exists (confirmed) — this is a staff-entry log of feedback given
-- verbally or via WhatsApp, disclosed as such in the UI, same honesty
-- convention as the WhatsApp broadcast simulation and online-order log.

create table customer_reviews (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  customer_name varchar(255),
  customer_phone varchar(20),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_customer_reviews_outlet_id on customer_reviews(outlet_id);

alter table customer_reviews enable row level security;
create policy customer_reviews_select on customer_reviews for select using (user_can_access_outlet(outlet_id));
create policy customer_reviews_insert on customer_reviews for insert with check (user_can_access_outlet(outlet_id));
create policy customer_reviews_delete on customer_reviews for delete using (user_can_access_outlet(outlet_id));
