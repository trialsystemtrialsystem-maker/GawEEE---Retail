-- 062_sales_identification.sql
-- Two real "which specific X" identification gaps in the sales domain,
-- found while auditing what a genuinely complete ERP still needs:
--
-- 1. Coupon usage was only ever an aggregate counter (coupons.usage_count)
--    with no way to trace which specific invoice actually redeemed a given
--    coupon, or which coupon (if any) a given invoice used — no audit
--    trail. coupon_redemptions closes that: one row per redemption, linked
--    to both the coupon and the invoice it was used on.
--
-- 2. Invoices had no link to the cashier_shifts session they were made
--    during — shift close (app/api/cashier-shifts/[id]/close/route.ts)
--    approximates "sales during this shift" via a created_at time-range
--    query instead of an explicit relationship. The app currently only
--    allows one open shift per outlet at a time (documented "v1,
--    single-register assumption" in that route), so this isn't a live
--    correctness bug today — but it's an approximation standing in for a
--    real identifier, and the explicit FK becomes load-bearing the moment
--    that single-register assumption is ever relaxed. invoices.
--    cashier_shift_id makes shift reconciliation an exact join instead.

create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  discount_amount decimal(15,2) not null,
  redeemed_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_coupon_redemptions_coupon_id on coupon_redemptions(coupon_id);
create index idx_coupon_redemptions_invoice_id on coupon_redemptions(invoice_id);

alter table coupon_redemptions enable row level security;
create policy coupon_redemptions_select on coupon_redemptions for select using (user_can_access_outlet(outlet_id));
create policy coupon_redemptions_insert on coupon_redemptions for insert with check (user_can_access_outlet(outlet_id));

alter table invoices add column cashier_shift_id uuid references cashier_shifts(id) on delete set null;
create index idx_invoices_cashier_shift_id on invoices(cashier_shift_id);
