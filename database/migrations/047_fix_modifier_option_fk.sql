-- 047_fix_modifier_option_fk.sql
-- CRITICAL FIX: 043_product_modifiers.sql declared
-- product_modifier_options.linked_product_id as `references products(id)`
-- with no ON DELETE action, which defaults to NO ACTION/RESTRICT. Once any
-- modifier option links to a real product, that product can never be
-- deleted again — it fails with a foreign key violation instead of the
-- option just losing its price link (which is exactly what "no
-- linked_product_id" already means in this feature: an unpriced choice).
-- This silently broke the demo reseed route (which deletes and recreates
-- products on every reseed) the moment Batch A's own tests linked an
-- option to a real demo product.
--
-- Fix: drop and recreate the FK with ON DELETE SET NULL, matching the
-- column's own nullability and the feature's "unpriced when unset" meaning.
alter table product_modifier_options drop constraint product_modifier_options_linked_product_id_fkey;
alter table product_modifier_options add constraint product_modifier_options_linked_product_id_fkey
  foreign key (linked_product_id) references products(id) on delete set null;
