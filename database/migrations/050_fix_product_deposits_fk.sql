-- 050_fix_product_deposits_fk.sql
-- Same bug class as 047: product_deposits.product_id referenced products(id)
-- with no ON DELETE action (defaults to RESTRICT), so once any deposit
-- existed for a product, that product could never be deleted — broke the
-- demo reseed route again (found while regression-testing Batch E's
-- create_invoice()/void_invoice() change, which required a hard product
-- reseed to test cleanly).
--
-- In real usage products are only ever soft-deleted (is_active=false, see
-- DELETE /api/products/:id) so this constraint never bites a real merchant
-- — only the demo seed route's hard delete-and-recreate hits it. Fix:
-- ON DELETE CASCADE — a deposit for a product that no longer exists at all
-- isn't actionable (nothing to fulfill), so it should go with the product,
-- same resolution as product_modifier_groups.product_id.
alter table product_deposits drop constraint product_deposits_product_id_fkey;
alter table product_deposits add constraint product_deposits_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;
