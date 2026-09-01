import { z } from 'zod'

export const signUpSchema = z
  .object({
    company_name: z.string().min(2, 'Nama toko minimal 2 karakter'),
    email: z.string().email('Email tidak valid'),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
      .regex(/[0-9]/, 'Password harus mengandung angka'),
    confirm_password: z.string(),
    phone: z.string().min(8, 'Nomor telepon tidak valid'),
    industry: z.enum(['frozen_food', 'minimarket', 'bakery', 'kelontong', 'other']),
    outlet_count: z.enum(['single', 'multi']),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Password tidak cocok',
    path: ['confirm_password'],
  })

export type SignUpInput = z.infer<typeof signUpSchema>

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
  remember_me: z.boolean().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>

export const invoiceItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  discount: z.number().min(0).optional(),
})

export const createInvoiceSchema = z.object({
  outlet_id: z.string().uuid(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'Keranjang tidak boleh kosong'),
  discount_amount: z.number().min(0).default(0),
  discount_reason: z.string().optional(),
  payment_method: z.enum(['cash', 'e_wallet', 'bank_transfer', 'card']),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>

export const inventoryAdjustSchema = z.object({
  outlet_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity_change: z.number().int().refine((n) => n !== 0, 'Perubahan tidak boleh 0'),
  reason: z.string().min(3, 'Alasan wajib diisi'),
  reference: z.string().optional(),
})

export type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>

export const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category_id: z.string().uuid().optional(),
  barcode: z.string().optional(),
  purchase_price: z.number().nonnegative(),
  selling_price: z.number().nonnegative(),
  unit_type: z.string().min(1),
  reorder_level: z.number().int().nonnegative(),
  reorder_quantity: z.number().int().nonnegative(),
  supplier_id: z.string().uuid().optional(),
})

export type ProductInput = z.infer<typeof productSchema>

export const supplierSchema = z.object({
  name: z.string().min(1, 'Nama supplier wajib diisi'),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  payment_terms: z.number().int().nonnegative().optional(),
  bank_account_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_name: z.string().optional(),
})

export type SupplierInput = z.infer<typeof supplierSchema>

export const purchaseOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_cost: z.number().nonnegative(),
})

export const createPurchaseOrderSchema = z.object({
  outlet_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  items: z.array(purchaseOrderItemSchema).min(1, 'PO harus memiliki minimal 1 item'),
  requested_delivery_date: z.string().optional(),
  notes: z.string().optional(),
})

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>

export const receivePurchaseOrderSchema = z.object({
  items: z.array(
    z.object({
      po_item_id: z.string().uuid(),
      quantity_received: z.number().int().nonnegative(),
    })
  ),
  delivery_date: z.string().optional(),
  notes: z.string().optional(),
})

export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>

export const accountSchema = z.object({
  outlet_id: z.string().uuid(),
  account_code: z.string().min(1, 'Kode akun wajib diisi'),
  account_name: z.string().min(1, 'Nama akun wajib diisi'),
  account_type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  description: z.string().optional(),
})

export type AccountInput = z.infer<typeof accountSchema>

export const journalEntryLineSchema = z
  .object({
    account_id: z.string().uuid(),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
    description: z.string().optional(),
  })
  .refine((l) => (l.debit > 0) !== (l.credit > 0), {
    message: 'Setiap baris harus memiliki debit ATAU kredit, tidak keduanya',
  })

export const createJournalEntrySchema = z.object({
  outlet_id: z.string().uuid(),
  entry_date: z.string().min(1, 'Tanggal wajib diisi'),
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  lines: z.array(journalEntryLineSchema).min(2, 'Jurnal minimal memiliki 2 baris'),
})

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>

export const createItemRequestSchema = z.object({
  outlet_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity_requested: z.number().int().positive(),
  reason: z.string().optional(),
})

export const decideItemRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'converted']),
})

export const purchaseReturnItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_cost: z.number().nonnegative(),
})

export const createPurchaseReturnSchema = z.object({
  outlet_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  po_id: z.string().uuid().optional(),
  return_date: z.string().min(1),
  reason: z.string().min(3, 'Alasan wajib diisi'),
  items: z.array(purchaseReturnItemSchema).min(1, 'Minimal 1 item'),
})

export const createStockTransferSchema = z.object({
  source_outlet_id: z.string().uuid(),
  destination_outlet_id: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().positive() })).min(1, 'Minimal 1 item'),
})

export const stockWasteSchema = z.object({
  outlet_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().min(3, 'Alasan wajib diisi'),
})

export const createPurchaseInvoiceSchema = z.object({
  po_id: z.string().uuid(),
  invoice_number: z.string().min(1, 'Nomor invoice wajib diisi'),
  invoice_date: z.string().min(1),
  due_date: z.string().min(1),
  subtotal: z.number().nonnegative(),
  tax_amount: z.number().nonnegative().default(0),
})

export const recordPurchasePaymentSchema = z.object({
  amount: z.number().positive('Nominal harus lebih dari 0'),
  payment_date: z.string().min(1),
  payment_method: z.enum(['cash', 'bank_transfer', 'check']),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
})

export const openCashierShiftSchema = z.object({
  outlet_id: z.string().uuid(),
  opening_cash: z.number().nonnegative(),
})

export const closeCashierShiftSchema = z.object({
  closing_cash: z.number().nonnegative(),
  reconciliation_notes: z.string().optional(),
})

export const productBundleSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().min(1, 'Nama paket wajib diisi'),
  bundle_price: z.number().positive('Harga paket harus lebih dari 0'),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(2, 'Paket minimal terdiri dari 2 produk'),
})

export const holdTransactionSchema = z.object({
  outlet_id: z.string().uuid(),
  cart_snapshot: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        name: z.string(),
        sku: z.string(),
        unit_price: z.number().nonnegative(),
        quantity: z.number().positive(),
      })
    )
    .min(1, 'Keranjang kosong'),
  discount_amount: z.number().nonnegative().default(0),
  discount_reason: z.string().optional(),
  note: z.string().max(255).optional(),
})

export const createStocktakeSchema = z.object({
  outlet_id: z.string().uuid(),
  scheduled_date: z.string().min(1),
  notes: z.string().optional(),
})

export const stocktakeCountSchema = z.object({
  counts: z.array(z.object({ detail_id: z.string().uuid(), counted_quantity: z.number().int().nonnegative() })).min(1),
})

export const customerSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().min(1, 'Nama pelanggan wajib diisi'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
  group_id: z.string().uuid().optional(),
  custom_fields: z.record(z.string(), z.string()).optional(),
})

export const customerGroupSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().min(1, 'Nama grup wajib diisi'),
  description: z.string().optional(),
})

export const specialPriceSchema = z.object({
  outlet_id: z.string().uuid(),
  group_id: z.string().uuid(),
  product_id: z.string().uuid(),
  price: z.number().nonnegative(),
})

export const customerFieldDefinitionSchema = z.object({
  outlet_id: z.string().uuid(),
  label: z.string().min(1, 'Label wajib diisi'),
})

export const customerCustomFieldsSchema = z.object({
  custom_fields: z.record(z.string(), z.string()),
})

export const recipeIngredientInputSchema = z.object({
  ingredient_product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
})

export const createRecipeSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().min(1, 'Nama resep wajib diisi'),
  output_product_id: z.string().uuid(),
  output_quantity: z.number().int().positive(),
  ingredients: z.array(recipeIngredientInputSchema).min(1, 'Minimal 1 bahan'),
})

export const createProductionRunSchema = z.object({
  outlet_id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  batch_count: z.number().int().positive(),
})

export const promotionSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().min(1, 'Nama promosi wajib diisi'),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().positive(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
})

export const couponSchema = z.object({
  outlet_id: z.string().uuid(),
  code: z.string().min(1, 'Kode kupon wajib diisi'),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().positive(),
  usage_limit: z.number().int().positive().optional(),
  expires_at: z.string().optional(),
})

export const loyaltyAdjustSchema = z.object({
  customer_id: z.string().uuid(),
  points_change: z.number().int().refine((n) => n !== 0, 'Jumlah poin tidak boleh 0'),
  reason: z.string().min(1, 'Alasan wajib diisi'),
})

export const loyaltySettingsSchema = z.object({
  loyalty_points_per_1000: z.number().int().nonnegative(),
  loyalty_rp_per_point: z.number().int().positive(),
})

export type CustomerInput = z.infer<typeof customerSchema>

export const staffMemberSchema = z.object({
  outlet_id: z.string().uuid(),
  first_name: z.string().min(1, 'Nama depan wajib diisi'),
  last_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  position: z.string().min(1, 'Jabatan wajib diisi'),
  position_level_id: z.string().uuid().optional(),
  hire_date: z.string().min(1, 'Tanggal masuk wajib diisi'),
  salary_amount: z.number().nonnegative().optional(),
  salary_frequency: z.enum(['monthly', 'daily']).optional(),
  employment_status: z.enum(['permanent', 'contract', 'casual']).optional(),
  commission_rate: z.number().min(0).max(1).optional(),
  pin_code: z.string().regex(/^\d{4,6}$/, 'PIN harus 4-6 digit angka').optional().or(z.literal('')),
})

export type StaffMemberInput = z.infer<typeof staffMemberSchema>

export const clockInSchema = z.object({ staff_id: z.string().uuid() })
export const clockOutSchema = z.object({ attendance_id: z.string().uuid() })

export const positionLevelSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().min(1, 'Nama level wajib diisi'),
  sort_order: z.number().int().nonnegative().default(0),
})

export const shiftSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().min(1, 'Nama shift wajib diisi'),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
})

export const staffScheduleSchema = z.object({
  staff_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  work_date: z.string().min(1),
})

export const staffAnnouncementSchema = z.object({
  outlet_id: z.string().uuid(),
  message: z.string().min(1, 'Pesan wajib diisi'),
})

export const generatePayrollRunSchema = z.object({
  outlet_id: z.string().uuid(),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
})

export const expenseRequestSchema = z.object({
  outlet_id: z.string().uuid(),
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  amount: z.number().positive('Nominal harus lebih dari 0'),
})

export const outletGeofenceSchema = z.object({
  geofence_lat: z.number().min(-90).max(90).optional(),
  geofence_lng: z.number().min(-180).max(180).optional(),
  geofence_radius_m: z.number().int().positive().optional(),
})

export const createBookingSchema = z.object({
  outlet_id: z.string().uuid(),
  customer_name: z.string().min(1, 'Nama pelanggan wajib diisi'),
  customer_phone: z.string().optional(),
  item_description: z.string().min(1, 'Deskripsi wajib diisi'),
  staff_id: z.string().uuid().optional(),
  scheduled_date: z.string().min(1, 'Tanggal wajib diisi'),
  scheduled_start_time: z.string().min(1, 'Jam wajib diisi'),
  scheduled_end_time: z.string().optional(),
  notes: z.string().optional(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

const BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const
export const bookingStatusSchema = z.object({ status: z.enum(BOOKING_STATUSES) })

export const onlineOrderItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
})

export const createOnlineOrderSchema = z.object({
  outlet_id: z.string().uuid(),
  channel: z.enum(['whatsapp', 'instagram', 'marketplace', 'other']),
  customer_name: z.string().min(1, 'Nama pelanggan wajib diisi'),
  customer_phone: z.string().optional(),
  items: z.array(onlineOrderItemSchema).min(1, 'Minimal 1 item'),
  notes: z.string().optional(),
})

export type CreateOnlineOrderInput = z.infer<typeof createOnlineOrderSchema>

const ONLINE_ORDER_STATUSES = ['incoming', 'on_process', 'on_delivery', 'completed', 'cancelled'] as const
export const onlineOrderStatusSchema = z.object({ status: z.enum(ONLINE_ORDER_STATUSES) })

export const whatsappTemplateSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().min(1, 'Nama template wajib diisi'),
  content: z.string().min(1, 'Isi pesan wajib diisi'),
})

export type WhatsappTemplateInput = z.infer<typeof whatsappTemplateSchema>

export const whatsappBroadcastSchema = z.object({
  outlet_id: z.string().uuid(),
  template_id: z.string().uuid(),
  target_note: z.string().min(1, 'Keterangan target wajib diisi'),
  customer_group_id: z.string().uuid().optional(),
})

export type WhatsappBroadcastInput = z.infer<typeof whatsappBroadcastSchema>

/** Runs a Zod schema and returns a `{ valid, data?, errors? }` shape that
 * matches the `validateXInput` helpers referenced throughout prd.md's API
 * route examples. */
export function validate<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input)
  if (result.success) {
    return { valid: true as const, data: result.data }
  }
  return { valid: false as const, errors: result.error.flatten() }
}
