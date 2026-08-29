-- 002_products_inventory.sql
-- Suppliers, product catalog, and outlet-level inventory
--
-- Note: the source PRD had `inventory.cost_value`/`retail_value` and
-- `stocktake_details.variance_value` as GENERATED ALWAYS columns referencing
-- another table's column (products.purchase_price). Postgres generated
-- columns can only reference columns in the *same* row, so those are computed
-- here in v_inventory_valuation / at write-time instead (see 008_views.sql).

-- SUPPLIERS (created before products, which references it)
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name varchar(255) not null,
  contact_person varchar(255),
  phone varchar(20),
  email varchar(255),
  address text,
  city varchar(100),
  payment_terms int, -- days
  bank_account_name varchar(255),
  bank_account_number varchar(50),
  bank_name varchar(100),
  tax_id varchar(50),
  status varchar(50) not null default 'active',
  rating decimal(3,2),
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_suppliers_company_id on suppliers(company_id);

-- PRODUCT CATEGORIES
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name varchar(255) not null,
  description text,
  sort_order int,
  status varchar(50) not null default 'active',
  created_at timestamptz not null default now()
);

create index idx_product_categories_company_id on product_categories(company_id);

-- PRODUCTS (Master Product List — Company Level)
create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  category_id uuid references product_categories(id),
  sku varchar(100) not null,
  barcode varchar(100) unique,
  name varchar(255) not null,
  description text,
  brand varchar(100),
  manufacturer varchar(100),
  purchase_price decimal(15,2) not null,
  selling_price decimal(15,2) not null,
  unit_type varchar(50) not null, -- 'pcs', 'box', 'kg', 'liter', etc
  conversion_factor int not null default 1,
  base_unit varchar(50),
  markup_percentage decimal(5,2),
  tax_rate decimal(5,2),
  reorder_level int not null default 0,
  reorder_quantity int not null default 0,
  shelf_life_days int,
  supplier_id uuid references suppliers(id),
  is_active boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(company_id, sku)
);

create index idx_products_company_id_sku on products(company_id, sku);
create index idx_products_category_id on products(category_id);

-- INVENTORY (Outlet-Level Stock)
create table inventory (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity_on_hand int not null default 0,
  quantity_reserved int not null default 0,
  quantity_available int generated always as (quantity_on_hand - quantity_reserved) stored,
  last_count_date timestamptz,
  reorder_level int, -- outlet-specific override of products.reorder_level
  alert_status varchar(50) not null default 'normal', -- 'low_stock', 'overstock', 'expired'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, product_id)
);

create index idx_inventory_outlet_id_product_id on inventory(outlet_id, product_id);

-- INVENTORY LEDGER (Audit Trail for Stock Movements)
create table inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  movement_type varchar(50) not null, -- 'purchase', 'sales', 'adjustment', 'transfer', 'return', 'write_off'
  quantity_change int not null,
  unit_cost decimal(15,2),
  reference_type varchar(50), -- 'purchase_order', 'invoice', 'stocktake', 'manual'
  reference_id uuid,
  recorded_by uuid not null references users(id),
  notes text,
  batch_number varchar(100),
  expiry_date date,
  created_at timestamptz not null default now()
);

create index idx_inventory_ledger_outlet_product on inventory_ledger(outlet_id, product_id);
create index idx_inventory_ledger_reference on inventory_ledger(reference_type, reference_id);

-- STOCKTAKE (Physical Inventory Counts)
create table stocktakes (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  scheduled_date date not null,
  actual_start_date timestamptz,
  actual_end_date timestamptz,
  created_by uuid not null references users(id),
  approved_by uuid references users(id),
  status varchar(50) not null default 'draft', -- 'draft', 'in_progress', 'completed', 'approved'
  variance_tolerance_percent decimal(5,2) not null default 2.0,
  total_variance_value decimal(15,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- STOCKTAKE DETAILS (Individual Product Counts)
create table stocktake_details (
  id uuid primary key default gen_random_uuid(),
  stocktake_id uuid not null references stocktakes(id) on delete cascade,
  product_id uuid not null references products(id),
  expected_quantity int not null,
  counted_quantity int not null,
  variance int generated always as (counted_quantity - expected_quantity) stored,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_stocktake_details_stocktake_id on stocktake_details(stocktake_id);

create trigger trg_suppliers_updated_at before update on suppliers
  for each row execute function set_updated_at();
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();
create trigger trg_inventory_updated_at before update on inventory
  for each row execute function set_updated_at();
create trigger trg_stocktakes_updated_at before update on stocktakes
  for each row execute function set_updated_at();
