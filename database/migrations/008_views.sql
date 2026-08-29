-- 008_views.sql
-- Reporting views

create view v_daily_sales_summary as
select
  i.outlet_id,
  date(i.created_at) as sale_date,
  count(distinct i.id) as transaction_count,
  count(distinct i.customer_phone) as unique_customers,
  coalesce(sum(ii.quantity), 0) as items_sold,
  sum(i.subtotal) as sales_before_discount,
  sum(i.discount_amount) as total_discounts,
  sum(i.tax_amount) as tax_collected,
  sum(i.total) as total_sales,
  coalesce(sum(ii.cost_of_goods_sold), 0) as cogs,
  (sum(i.total) - coalesce(sum(ii.cost_of_goods_sold), 0)) as gross_profit,
  round(100 * (sum(i.total) - coalesce(sum(ii.cost_of_goods_sold), 0)) / nullif(sum(i.total), 0), 2) as gross_margin_percent
from invoices i
left join invoice_items ii on i.id = ii.invoice_id
where i.order_status != 'voided'
group by i.outlet_id, date(i.created_at);

-- Inventory Valuation View
-- (computes cost_value / retail_value here rather than as generated columns
-- on `inventory`, since Postgres generated columns can't reference `products`.)
create view v_inventory_valuation as
select
  inv.outlet_id,
  inv.product_id,
  p.name,
  p.sku,
  inv.quantity_on_hand,
  inv.quantity_reserved,
  inv.quantity_available,
  p.purchase_price,
  p.selling_price,
  (inv.quantity_on_hand * p.purchase_price) as cost_value,
  (inv.quantity_on_hand * p.selling_price) as retail_value,
  (inv.quantity_on_hand * (p.selling_price - p.purchase_price)) as potential_profit
from inventory inv
join products p on inv.product_id = p.id
where inv.quantity_on_hand > 0;

-- Accounts Payable Aging
create view v_ap_aging as
select
  ap.outlet_id,
  ap.supplier_id,
  s.name as supplier_name,
  ap.outstanding_amount,
  case
    when ap.days_overdue <= 0 then 'Current'
    when ap.days_overdue <= 30 then '1-30 days'
    when ap.days_overdue <= 60 then '31-60 days'
    when ap.days_overdue <= 90 then '61-90 days'
    else '90+ days'
  end as aging_bucket,
  ap.due_date
from accounts_payable ap
join suppliers s on ap.supplier_id = s.id
where ap.outstanding_amount > 0;

-- Low Stock Alert View
create view v_low_stock_alerts as
select
  inv.outlet_id,
  inv.product_id,
  p.name,
  p.sku,
  inv.quantity_on_hand,
  p.reorder_level,
  p.reorder_quantity,
  (p.reorder_level - inv.quantity_on_hand) as shortage_qty,
  inv.alert_status
from inventory inv
join products p on inv.product_id = p.id
where inv.quantity_available <= coalesce(inv.reorder_level, p.reorder_level)
order by shortage_qty desc;
