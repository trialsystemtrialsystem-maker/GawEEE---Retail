-- 053_purchase_return_reconciliation.sql
-- Phase 13 Batch H item 21 — Purchase Return Reconciliation. Additive
-- nullable column linking a return back to the specific supplier invoice
-- it offsets (a return isn't always tied to one invoice, so nullable).

alter table purchase_returns add column purchase_invoice_id uuid references purchase_invoices(id) on delete set null;

create index idx_purchase_returns_purchase_invoice_id on purchase_returns(purchase_invoice_id);
