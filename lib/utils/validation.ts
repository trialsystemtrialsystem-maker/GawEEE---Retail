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
