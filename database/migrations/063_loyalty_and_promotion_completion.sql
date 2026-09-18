-- 063_loyalty_and_promotion_completion.sql
-- Two more gaps found auditing "identification" completeness for sales,
-- bigger than the ones migration 062 closed: these two features were never
-- actually wired into a real sale at all, not just missing an audit trail.
--
-- 1. Loyalty points were 100% manual (POST /api/loyalty/adjust, a staff
--    member typing in an adjustment) despite outlets.loyalty_points_per_1000/
--    loyalty_rp_per_point existing specifically to configure automatic
--    earning — a customer spending real money never actually earned a
--    point. loyalty_ledger.invoice_id lets an auto-earned entry (added in
--    application code, see app/api/invoices and the payment settlement
--    routes) point back at the specific sale that earned it.
--
-- 2. `promotions` (distinct from coupons) had ZERO path from "manager
--    defines a promotion" to "a sale actually uses it" — GET /api/promotions
--    is only ever called by PromotionManager (the definition CRUD UI); grep
--    confirms no other component reads it, so despite that route's own
--    comment claiming it's "used by... POS checkout," the POS never actually
--    applied one. promotion_applications is the same shape as
--    coupon_redemptions (062_sales_identification.sql) for the same reason:
--    an audit trail linking a specific application of a promotion to the
--    invoice it discounted.

alter table loyalty_ledger add column invoice_id uuid references invoices(id) on delete set null;
create index idx_loyalty_ledger_invoice_id on loyalty_ledger(invoice_id);

create table promotion_applications (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references promotions(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  discount_amount decimal(15,2) not null,
  applied_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_promotion_applications_promotion_id on promotion_applications(promotion_id);
create index idx_promotion_applications_invoice_id on promotion_applications(invoice_id);

alter table promotion_applications enable row level security;
create policy promotion_applications_select on promotion_applications for select using (user_can_access_outlet(outlet_id));
create policy promotion_applications_insert on promotion_applications for insert with check (user_can_access_outlet(outlet_id));
