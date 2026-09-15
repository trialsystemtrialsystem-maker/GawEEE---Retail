-- 056_fix_sales_document_items_fk.sql
-- Same bug class as 047/050: sales_quotation_items.product_id and
-- sales_order_items.product_id (052_sales_documents.sql) had no ON DELETE
-- action, so once any quotation/order line referenced a real product, that
-- product could never be deleted — broke the demo reseed route again
-- (found while investigating an "invoice_items_product_id_fkey" violation
-- during Batch J verification, which led to auditing every products(id)
-- reference added this phase).
--
-- Fix: ON DELETE CASCADE — a quotation/order line for a product that no
-- longer exists at all isn't actionable, so it should go with the product,
-- same resolution as product_modifier_groups.product_id.
alter table sales_quotation_items drop constraint sales_quotation_items_product_id_fkey;
alter table sales_quotation_items add constraint sales_quotation_items_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;

alter table sales_order_items drop constraint sales_order_items_product_id_fkey;
alter table sales_order_items add constraint sales_order_items_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;

-- Same bug, same migration file: sales_quotations.invoice_id and
-- sales_orders.invoice_id (nullable — set once "Convert to Invoice"/
-- "Fulfill" runs) also had no ON DELETE action, blocking deletion of the
-- resulting invoice. ON DELETE SET NULL here (not cascade): the quotation/
-- order document itself is a historical record independent of whether its
-- resulting invoice still exists.
alter table sales_quotations drop constraint sales_quotations_invoice_id_fkey;
alter table sales_quotations add constraint sales_quotations_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete set null;

alter table sales_orders drop constraint sales_orders_invoice_id_fkey;
alter table sales_orders add constraint sales_orders_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete set null;
