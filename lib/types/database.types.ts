// Hand-written types for the Phase 1 schema (database/migrations/001-011).
// Once a real Supabase project exists, replace this file with the generated
// one: `supabase gen types typescript --project-id <id> > lib/types/database.types.ts`
// The shape (Tables/Views/Functions with Row/Insert/Update/Relationships)
// matches that generator's output so callers don't need to change.

export type UserRole = 'master_admin' | 'outlet_manager' | 'cashier' | 'staff'
export type PaymentMethod = 'cash' | 'e_wallet' | 'bank_transfer' | 'card'
export type PaymentStatus = 'pending' | 'processing' | 'settled' | 'failed' | 'refunded'
export type InvoicePaymentStatus = 'pending' | 'partial' | 'paid'
export type InvoiceOrderStatus = 'draft' | 'completed' | 'voided'

export type Company = {
  id: string
  name: string
  tier: 'starter' | 'professional' | 'enterprise'
  subscription_status: 'active' | 'trial' | 'suspended'
  subscription_start_date: string
  subscription_end_date: string | null
  billing_email: string
  billing_phone: string | null
  industry: string | null
  country_code: string
  currency: string
  tax_id: string | null
  tax_rate: number
  logo_url: string | null
  brand_color: string
  brand_secondary_color: string
  timezone: string
  settings: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Outlet = {
  id: string
  company_id: string
  name: string
  address: string
  city: string
  province: string | null
  postal_code: string | null
  phone: string | null
  manager_id: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  bank_name: string | null
  tax_id: string | null
  business_hours: Record<string, { open: string; close: string }> | null
  status: 'active' | 'inactive' | 'closed'
  opening_cash: number
  target_daily_revenue: number | null
  settings: Record<string, unknown>
  geofence_lat: number | null
  geofence_lng: number | null
  geofence_radius_m: number | null
  enabled_payment_methods: string[]
  loyalty_points_per_1000: number
  loyalty_rp_per_point: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type AppUser = {
  id: string
  company_id: string
  outlet_id: string | null
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  permissions: string[]
  status: 'active' | 'inactive' | 'suspended'
  last_login_at: string | null
  password_changed_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ProductCategory = {
  id: string
  company_id: string
  name: string
  description: string | null
  sort_order: number | null
  status: string
  department_id: string | null
  created_at: string
}

export type ProductDepartment = {
  id: string
  company_id: string
  name: string
  sort_order: number
  created_at: string
}

export type Product = {
  id: string
  company_id: string
  category_id: string | null
  sku: string
  barcode: string | null
  name: string
  description: string | null
  brand: string | null
  manufacturer: string | null
  purchase_price: number
  selling_price: number
  unit_type: string
  conversion_factor: number
  base_unit: string | null
  markup_percentage: number | null
  tax_rate: number | null
  reorder_level: number
  reorder_quantity: number
  shelf_life_days: number | null
  supplier_id: string | null
  is_active: boolean
  image_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Inventory = {
  id: string
  outlet_id: string
  product_id: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  last_count_date: string | null
  reorder_level: number | null
  alert_status: 'normal' | 'low_stock' | 'overstock' | 'out_of_stock' | 'expired'
  created_at: string
  updated_at: string
}

export type InventoryLedgerEntry = {
  id: string
  outlet_id: string
  product_id: string
  movement_type: string
  quantity_change: number
  unit_cost: number | null
  reference_type: string | null
  reference_id: string | null
  recorded_by: string
  notes: string | null
  batch_number: string | null
  expiry_date: string | null
  created_at: string
}

export type Invoice = {
  id: string
  outlet_id: string
  invoice_number: string
  customer_name: string | null
  customer_phone: string | null
  cashier_id: string
  subtotal: number
  discount_amount: number
  discount_type: 'fixed' | 'percentage' | null
  discount_reason: string | null
  discount_approved_by: string | null
  tax_amount: number
  total: number
  payment_status: InvoicePaymentStatus
  order_status: InvoiceOrderStatus
  notes: string | null
  created_at: string
  updated_at: string
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
}

export type InvoiceItem = {
  id: string
  invoice_id: string
  product_id: string
  quantity: number
  unit_price: number
  item_discount: number
  subtotal: number
  cost_of_goods_sold: number | null
  sold_unit_label: string | null
  sold_unit_quantity: number | null
  notes: string | null
  created_at: string
}

export type PaymentTransaction = {
  id: string
  invoice_id: string
  payment_method: PaymentMethod
  payment_provider: string | null
  amount: number
  status: PaymentStatus
  payment_gateway_reference_id: string | null
  payment_date: string | null
  settlement_date: string | null
  settlement_amount: number | null
  gateway_fee: number | null
  notes: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

export type VirtualAccount = {
  id: string
  invoice_id: string
  va_number: string
  bank: string
  amount_expected: number
  status: 'active' | 'paid' | 'expired' | 'cancelled'
  expires_at: string
  created_at: string
}

export type Supplier = {
  id: string
  company_id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  payment_terms: number | null
  bank_account_name: string | null
  bank_account_number: string | null
  bank_name: string | null
  tax_id: string | null
  status: 'active' | 'inactive'
  rating: number | null
  is_preferred: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type PurchaseOrder = {
  id: string
  outlet_id: string
  supplier_id: string
  po_number: string
  order_date: string
  requested_delivery_date: string | null
  actual_delivery_date: string | null
  status: 'draft' | 'pending_approval' | 'ordered' | 'partial_received' | 'received' | 'cancelled'
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  created_by: string
  approved_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type PurchaseOrderItem = {
  id: string
  po_id: string
  product_id: string
  quantity_ordered: number
  quantity_received: number
  quantity_remaining: number
  unit_cost: number
  subtotal: number
  line_notes: string | null
  created_at: string
}

export type PurchaseInvoice = {
  id: string
  po_id: string
  supplier_id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  payment_status: 'unpaid' | 'partial' | 'paid'
  notes: string | null
  created_at: string
  updated_at: string
}

export type PurchasePayment = {
  id: string
  purchase_invoice_id: string
  payment_date: string
  amount: number
  payment_method: string | null
  reference_number: string | null
  notes: string | null
  recorded_by: string
  created_at: string
}

export type DailyFinancialSummary = {
  id: string
  outlet_id: string
  summary_date: string
  total_sales: number
  total_discount: number
  total_tax_collected: number | null
  total_cash_received: number | null
  total_e_wallet_received: number | null
  total_bank_transfer_pending: number | null
  total_invoices: number | null
  total_items_sold: number | null
  unique_customers: number | null
  cash_on_hand_opening: number | null
  cash_on_hand_closing: number | null
  cash_variance: number | null
  cost_of_goods_sold: number | null
  gross_profit: number | null
  gross_profit_margin: number | null
  operating_expenses: number | null
  net_profit: number | null
  created_at: string
  updated_at: string
}

export type AuditLogEntry = {
  id: string
  user_id: string
  company_id: string
  outlet_id: string | null
  action_type: string
  entity_type: string
  entity_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  reason_for_action: string | null
  status: string | null
  error_message: string | null
  created_at: string
}

export type SystemAlert = {
  id: string
  outlet_id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string | null
  reference_entity_type: string | null
  reference_entity_id: string | null
  is_resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
}

export type BulkAdminOperation = {
  id: string
  company_id: string
  admin_id: string
  operation_type: string
  outlets_affected: string[]
  operation_description: string | null
  parameters: Record<string, unknown> | null
  scheduled_for: string | null
  status: string
  execution_start_time: string | null
  execution_end_time: string | null
  success_count: number | null
  failed_count: number | null
  error_log: Record<string, unknown> | null
  rollback_available: boolean
  rolled_back_at: string | null
  created_at: string
  updated_at: string
}

// ---- reporting views ----

export type LowStockAlertView = {
  outlet_id: string
  product_id: string
  name: string
  sku: string
  quantity_on_hand: number
  reorder_level: number
  reorder_quantity: number
  shortage_qty: number
  alert_status: string
}

export type StaffMember = {
  id: string
  outlet_id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  position: string
  hire_date: string
  salary_amount: number | null
  salary_frequency: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  tax_id: string | null
  status: string
  employment_status: string | null
  contract_end_date: string | null
  notes: string | null
  commission_rate: number
  position_level_id: string | null
  pin_code: string | null
  user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type PositionLevel = {
  id: string
  outlet_id: string
  name: string
  sort_order: number
  created_at: string
}

export type PayrollRun = {
  id: string
  outlet_id: string
  period_start: string
  period_end: string
  status: 'draft' | 'paid'
  created_by: string
  created_at: string
  paid_at: string | null
}

export type Payslip = {
  id: string
  payroll_run_id: string
  staff_id: string
  base_salary: number
  commission_amount: number
  deductions: number
  net_pay: number
  created_at: string
}

export type Shift = {
  id: string
  outlet_id: string
  name: string
  start_time: string
  end_time: string
  created_at: string
}

export type StaffSchedule = {
  id: string
  staff_id: string
  shift_id: string
  work_date: string
  created_at: string
}

export type StaffAnnouncement = {
  id: string
  outlet_id: string
  message: string
  created_by: string
  created_at: string
}

export type ExpenseRequest = {
  id: string
  outlet_id: string
  description: string
  amount: number
  requested_by: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  decided_at: string | null
  paid_at: string | null
  payment_method: string | null
  created_at: string
}

export type Attendance = {
  id: string
  staff_id: string
  attendance_date: string
  clock_in_time: string | null
  clock_out_time: string | null
  status: string
  notes: string | null
  created_at: string
}

export type ChartOfAccount = {
  id: string
  outlet_id: string
  account_code: string
  account_name: string
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  parent_account_id: string | null
  is_header: boolean
  is_active: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export type JournalEntry = {
  id: string
  outlet_id: string
  entry_date: string
  entry_number: string | null
  description: string
  source_type: string | null
  source_id: string | null
  created_by: string
  status: 'draft' | 'posted' | 'reversed'
  posted_date: string | null
  reversed_date: string | null
  reversal_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type JournalEntryDetail = {
  id: string
  journal_entry_id: string
  account_id: string
  debit: number
  credit: number
  description: string | null
  reference_id: string | null
}

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export type Booking = {
  id: string
  outlet_id: string
  customer_name: string
  customer_phone: string | null
  item_description: string
  staff_id: string | null
  scheduled_date: string
  scheduled_start_time: string
  scheduled_end_time: string | null
  status: BookingStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type ItemRequest = {
  id: string
  outlet_id: string
  product_id: string
  quantity_requested: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'converted'
  requested_by: string
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export type PurchaseReturn = {
  id: string
  outlet_id: string
  supplier_id: string
  po_id: string | null
  return_date: string
  reason: string
  status: 'draft' | 'completed'
  total_amount: number
  created_by: string
  created_at: string
}

export type PurchaseReturnItem = {
  id: string
  return_id: string
  product_id: string
  quantity: number
  unit_cost: number
}

export type StockTransfer = {
  id: string
  company_id: string
  source_outlet_id: string
  destination_outlet_id: string
  status: 'requested' | 'in_transit' | 'completed' | 'cancelled'
  notes: string | null
  requested_by: string
  shipped_by: string | null
  received_by: string | null
  shipped_at: string | null
  received_at: string | null
  created_at: string
}

export type StockTransferItem = {
  id: string
  transfer_id: string
  product_id: string
  quantity: number
}

export type CashierShift = {
  id: string
  outlet_id: string
  staff_id: string | null
  shift_date: string
  shift_start_time: string | null
  shift_end_time: string | null
  opening_cash: number
  closing_cash: number | null
  total_transactions: number
  expected_closing_cash: number | null
  cash_variance: number | null
  variance_percentage: number | null
  reconciled: boolean
  reconciled_by: string | null
  reconciliation_notes: string | null
  status: 'open' | 'closed'
  opened_by: string | null
  created_at: string
  updated_at: string
}

export type HeldTransaction = {
  id: string
  outlet_id: string
  cashier_id: string
  cart_snapshot: { product_id: string; name: string; sku: string; unit_price: number; quantity: number }[]
  discount_amount: number
  discount_reason: string | null
  note: string | null
  created_at: string
}

export type ProductBundle = {
  id: string
  outlet_id: string
  name: string
  bundle_price: number
  is_active: boolean
  created_by: string
  created_at: string
}

export type ProductBundleItem = {
  id: string
  bundle_id: string
  product_id: string
  quantity: number
}

export type CustomerRefund = {
  id: string
  outlet_id: string
  invoice_id: string
  refund_method: string
  reason: string
  status: 'draft' | 'completed'
  total_amount: number
  created_by: string
  created_at: string
}

export type CustomerRefundItem = {
  id: string
  refund_id: string
  product_id: string
  quantity: number
  unit_price: number
}

export type ProductUnit = {
  id: string
  product_id: string
  unit_label: string
  conversion_to_base: number
  unit_price: number
  created_at: string
}

export type LeaveRequest = {
  id: string
  outlet_id: string
  leave_type: 'izin' | 'sakit' | 'libur'
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requested_by: string
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export type ChecklistItem = {
  id: string
  outlet_id: string
  label: string
  category: 'opening' | 'closing'
  sort_order: number
  is_active: boolean
  created_by: string
  created_at: string
}

export type ChecklistCompletion = {
  id: string
  outlet_id: string
  item_id: string
  completed_by: string
  shift_date: string
  completed_at: string
  note: string | null
}

export type NotePreset = {
  id: string
  outlet_id: string
  label: string
  is_active: boolean
  created_by: string
  created_at: string
}

export type ProductModifierGroup = {
  id: string
  product_id: string
  name: string
  sort_order: number
  created_at: string
}

export type ProductModifierOption = {
  id: string
  group_id: string
  label: string
  linked_product_id: string | null
  sort_order: number
}

export type Stocktake = {
  id: string
  outlet_id: string
  scheduled_date: string
  actual_start_date: string | null
  actual_end_date: string | null
  created_by: string
  approved_by: string | null
  status: 'draft' | 'in_progress' | 'completed' | 'approved'
  variance_tolerance_percent: number
  total_variance_value: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type StocktakeDetail = {
  id: string
  stocktake_id: string
  product_id: string
  expected_quantity: number
  counted_quantity: number
  variance: number
  notes: string | null
  created_at: string
}

export type Customer = {
  id: string
  outlet_id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  group_id: string | null
  custom_fields: Record<string, string>
  created_by: string
  created_at: string
  updated_at: string
}

export type CustomerGroup = {
  id: string
  outlet_id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
}

export type SpecialPrice = {
  id: string
  outlet_id: string
  group_id: string
  product_id: string
  price: number
  created_by: string
  created_at: string
}

export type PriceSchedule = {
  id: string
  product_id: string
  new_price: number
  effective_date: string
  applied: boolean
  created_by: string
  created_at: string
}

export type TimeBasedPrice = {
  id: string
  product_id: string
  price: number
  day_of_week: number | null
  start_time: string
  end_time: string
  is_active: boolean
  created_by: string
  created_at: string
}

export type ChannelPrice = {
  id: string
  product_id: string
  channel: 'gofood' | 'grabfood' | 'shopeefood' | 'other'
  price: number
  created_by: string
  created_at: string
}

export type Recipe = {
  id: string
  outlet_id: string
  name: string
  output_product_id: string
  output_quantity: number
  created_by: string
  created_at: string
}

export type RecipeIngredient = {
  id: string
  recipe_id: string
  ingredient_product_id: string
  quantity: number
}

export type ProductionRun = {
  id: string
  outlet_id: string
  recipe_id: string
  batch_count: number
  status: 'draft' | 'completed'
  produced_by: string
  created_at: string
  completed_at: string | null
}

export type Promotion = {
  id: string
  outlet_id: string
  name: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  start_date: string
  end_date: string
  is_active: boolean
  created_by: string
  created_at: string
}

export type Coupon = {
  id: string
  outlet_id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  usage_limit: number | null
  usage_count: number
  expires_at: string | null
  is_active: boolean
  created_by: string
  created_at: string
}

export type LoyaltyLedgerEntry = {
  id: string
  customer_id: string
  points_change: number
  reason: string
  recorded_by: string
  created_at: string
}

export type CustomerFieldDefinition = {
  id: string
  outlet_id: string
  label: string
  sort_order: number
  is_required: boolean
  created_at: string
}

export type CustomerModuleSettings = {
  outlet_id: string
  require_phone_on_checkout: boolean
  default_group_id: string | null
  updated_at: string
}

export type CustomerReview = {
  id: string
  outlet_id: string
  invoice_id: string | null
  customer_name: string | null
  customer_phone: string | null
  rating: number
  comment: string | null
  created_by: string
  created_at: string
}

export type OnlineOrderStatus = 'incoming' | 'on_process' | 'on_delivery' | 'completed' | 'cancelled'

export type OnlineOrder = {
  id: string
  outlet_id: string
  order_number: string
  channel: string
  customer_name: string
  customer_phone: string | null
  items: { name: string; quantity: number; price: number }[]
  total_amount: number
  status: OnlineOrderStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type WhatsappTemplate = {
  id: string
  outlet_id: string
  name: string
  content: string
  created_by: string
  created_at: string
  updated_at: string
}

export type WhatsappBroadcast = {
  id: string
  outlet_id: string
  template_id: string
  target_note: string
  status: string
  sent_count: number
  created_by: string
  created_at: string
  sent_at: string | null
  customer_group_id: string | null
}

export type DailySalesSummaryView = {
  outlet_id: string
  sale_date: string
  transaction_count: number
  unique_customers: number
  items_sold: number
  sales_before_discount: number
  total_discounts: number
  tax_collected: number
  total_sales: number
  cogs: number
  gross_profit: number
  gross_margin_percent: number | null
}

export type InventoryValuationView = {
  outlet_id: string
  product_id: string
  name: string
  sku: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  purchase_price: number
  selling_price: number
  cost_value: number
  retail_value: number
  potential_profit: number
}

// Helper so every table entry gets a consistent shape without repeating
// `Insert`/`Update`/`Relationships` boilerplate.
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }
type View<Row> = { Row: Row; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      companies: Table<Company>
      outlets: Table<Outlet>
      users: Table<AppUser>
      product_categories: Table<ProductCategory>
      product_departments: Table<ProductDepartment>
      note_presets: Table<NotePreset>
      product_modifier_groups: Table<ProductModifierGroup>
      product_modifier_options: Table<ProductModifierOption>
      products: Table<Product>
      inventory: Table<Inventory>
      inventory_ledger: Table<InventoryLedgerEntry>
      invoices: Table<Invoice>
      invoice_items: Table<InvoiceItem>
      payment_transactions: Table<PaymentTransaction>
      virtual_accounts: Table<VirtualAccount>
      suppliers: Table<Supplier>
      purchase_orders: Table<PurchaseOrder>
      po_items: Table<PurchaseOrderItem>
      purchase_invoices: Table<PurchaseInvoice>
      purchase_payments: Table<PurchasePayment>
      daily_financial_summary: Table<DailyFinancialSummary>
      audit_log: Table<AuditLogEntry>
      system_alerts: Table<SystemAlert>
      bulk_admin_operations: Table<BulkAdminOperation>
      bookings: Table<Booking>
      customers: Table<Customer>
      customer_groups: Table<CustomerGroup>
      special_prices: Table<SpecialPrice>
      customer_field_definitions: Table<CustomerFieldDefinition>
      customer_module_settings: Table<CustomerModuleSettings>
      customer_reviews: Table<CustomerReview>
      price_schedules: Table<PriceSchedule>
      time_based_prices: Table<TimeBasedPrice>
      channel_prices: Table<ChannelPrice>
      recipes: Table<Recipe>
      recipe_ingredients: Table<RecipeIngredient>
      production_runs: Table<ProductionRun>
      promotions: Table<Promotion>
      coupons: Table<Coupon>
      loyalty_ledger: Table<LoyaltyLedgerEntry>
      cashier_shifts: Table<CashierShift>
      held_transactions: Table<HeldTransaction>
      product_bundles: Table<ProductBundle>
      product_bundle_items: Table<ProductBundleItem>
      customer_refunds: Table<CustomerRefund>
      customer_refund_items: Table<CustomerRefundItem>
      product_units: Table<ProductUnit>
      leave_requests: Table<LeaveRequest>
      checklist_items: Table<ChecklistItem>
      checklist_completions: Table<ChecklistCompletion>
      stocktakes: Table<Stocktake>
      stocktake_details: Table<StocktakeDetail>
      item_requests: Table<ItemRequest>
      purchase_returns: Table<PurchaseReturn>
      purchase_return_items: Table<PurchaseReturnItem>
      stock_transfers: Table<StockTransfer>
      stock_transfer_items: Table<StockTransferItem>
      online_orders: Table<OnlineOrder>
      whatsapp_templates: Table<WhatsappTemplate>
      whatsapp_broadcasts: Table<WhatsappBroadcast>
      staff_members: Table<StaffMember>
      attendance: Table<Attendance>
      position_levels: Table<PositionLevel>
      payroll_runs: Table<PayrollRun>
      payslips: Table<Payslip>
      shifts: Table<Shift>
      staff_schedules: Table<StaffSchedule>
      staff_announcements: Table<StaffAnnouncement>
      expense_requests: Table<ExpenseRequest>
      chart_of_accounts: Table<ChartOfAccount>
      journal_entries: Table<JournalEntry>
      journal_entry_details: Table<JournalEntryDetail>
    }
    Views: {
      v_low_stock_alerts: View<LowStockAlertView>
      v_daily_sales_summary: View<DailySalesSummaryView>
      v_inventory_valuation: View<InventoryValuationView>
    }
    Functions: {
      provision_company_and_owner: {
        Args: {
          p_user_id: string
          p_email: string
          p_full_name: string
          p_phone: string
          p_company_name: string
          p_tier: string
          p_industry: string
        }
        Returns: { company_id: string; outlet_id: string }[]
      }
      create_invoice: {
        Args: {
          p_outlet_id: string
          p_cashier_id: string
          p_items: { product_id: string; quantity: number; discount?: number }[]
          p_payment_method: string
          p_customer_name?: string | null
          p_customer_phone?: string | null
          p_discount_amount?: number
          p_discount_reason?: string | null
        }
        Returns: { invoice_id: string; invoice_number: string; total: number; payment_status: string }[]
      }
      void_invoice: {
        Args: { p_invoice_id: string; p_voided_by: string; p_reason: string }
        Returns: { voided_at: string; stock_returned: number }[]
      }
      update_inventory: {
        Args: {
          p_outlet_id: string
          p_product_id: string
          p_quantity_change: number
          p_movement_type: string
          p_recorded_by: string
          p_reference_id?: string | null
          p_reference_type?: string
          p_unit_cost?: number
          p_notes?: string
          p_batch_number?: string
          p_expiry_date?: string
        }
        Returns: { new_quantity_on_hand: number }[]
      }
      create_journal_entry: {
        Args: {
          p_outlet_id: string
          p_created_by: string
          p_entry_date: string
          p_description: string
          p_lines: { account_id: string; debit?: number; credit?: number; description?: string | null }[]
          p_source_type?: string
          p_source_id?: string | null
        }
        Returns: { journal_entry_id: string }[]
      }
      submit_stocktake: {
        Args: { p_stocktake_id: string; p_submitted_by: string }
        Returns: { total_variance_value: number }[]
      }
      submit_production_run: {
        Args: { p_run_id: string; p_submitted_by: string }
        Returns: { produced_quantity: number }[]
      }
      submit_purchase_return: {
        Args: { p_return_id: string; p_submitted_by: string }
        Returns: { total_amount: number }[]
      }
      submit_customer_refund: {
        Args: { p_refund_id: string; p_submitted_by: string }
        Returns: { total_amount: number }[]
      }
      ship_stock_transfer: {
        Args: { p_transfer_id: string; p_shipped_by: string }
        Returns: { shipped_at: string }[]
      }
      receive_stock_transfer: {
        Args: { p_transfer_id: string; p_received_by: string }
        Returns: { received_at: string }[]
      }
      post_journal_entry: {
        Args: { p_entry_id: string }
        Returns: { posted_date: string }[]
      }
    }
  }
}
