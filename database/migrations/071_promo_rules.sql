-- 071_promo_rules.sql
-- Promotion / coupon rules: minimum purchase, maximum discount (cap for
-- percentage discounts), promotion usage limit + notes, coupon start date.
-- All additive with safe defaults, so existing promos/coupons behave as before.

alter table promotions add column if not exists min_purchase decimal(15,2) not null default 0;
alter table promotions add column if not exists max_discount decimal(15,2);
alter table promotions add column if not exists usage_limit int;
alter table promotions add column if not exists description text;

alter table coupons add column if not exists min_purchase decimal(15,2) not null default 0;
alter table coupons add column if not exists max_discount decimal(15,2);
alter table coupons add column if not exists starts_at date;
alter table coupons add column if not exists description text;
