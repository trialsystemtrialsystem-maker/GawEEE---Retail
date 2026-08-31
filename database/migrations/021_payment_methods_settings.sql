-- 021_payment_methods_settings.sql
-- Per-outlet toggle for which payment methods the POS offers. Defaults to
-- all methods enabled (matches current behavior — cash/e_wallet/bank_transfer
-- always shown) so no existing outlet's checkout changes until an owner
-- opts to narrow it.

alter table outlets add column enabled_payment_methods text[] not null default array['cash', 'e_wallet', 'bank_transfer'];
