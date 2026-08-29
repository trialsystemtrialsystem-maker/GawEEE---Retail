-- 007_audit_compliance.sql
-- Immutable audit log, system alerts, bulk admin operations

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  company_id uuid not null references companies(id) on delete cascade,
  outlet_id uuid references outlets(id),
  action_type varchar(50) not null, -- 'CREATE', 'UPDATE', 'DELETE', 'VOID', 'EXPORT'
  entity_type varchar(50) not null, -- 'invoice', 'product', 'user', 'settings'
  entity_id uuid not null,
  old_values jsonb,
  new_values jsonb,
  ip_address varchar(45),
  user_agent text,
  reason_for_action text,
  status varchar(50), -- 'success', 'failed'
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_audit_log_user_id_created_at on audit_log(user_id, created_at);
create index idx_audit_log_entity_type_entity_id on audit_log(entity_type, entity_id);
create index idx_audit_log_company_id on audit_log(company_id);

-- SYSTEM ALERTS (Low Stock, Pending Payments, etc)
create table system_alerts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  alert_type varchar(50) not null, -- 'low_stock', 'overstock', 'payment_pending', 'cash_variance', 'payment_failed'
  severity varchar(50) not null default 'info', -- 'info', 'warning', 'critical'
  title varchar(255) not null,
  description text,
  reference_entity_type varchar(50), -- 'product', 'invoice', 'payment'
  reference_entity_id uuid,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_system_alerts_outlet_id_resolved on system_alerts(outlet_id, is_resolved);

-- BULK ADMIN OPERATIONS (Multi-outlet)
create table bulk_admin_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  admin_id uuid not null references users(id),
  operation_type varchar(50) not null, -- 'price_update', 'product_add', 'promo_creation'
  outlets_affected jsonb not null, -- array of outlet_ids, or ["all"]
  operation_description text,
  parameters jsonb,
  scheduled_for timestamptz,
  status varchar(50) not null default 'draft', -- 'draft', 'scheduled', 'executing', 'completed', 'failed', 'rolled_back'
  execution_start_time timestamptz,
  execution_end_time timestamptz,
  success_count int,
  failed_count int,
  error_log jsonb,
  rollback_available boolean not null default true,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bulk_admin_operations_company_id on bulk_admin_operations(company_id);

create trigger trg_system_alerts_updated_at before update on system_alerts
  for each row execute function set_updated_at();
create trigger trg_bulk_admin_operations_updated_at before update on bulk_admin_operations
  for each row execute function set_updated_at();
