import {
  signUpSchema,
  loginSchema,
  createInvoiceSchema,
  inventoryAdjustSchema,
  validate,
} from '@/lib/utils/validation'

describe('validation schemas', () => {
  describe('signUpSchema', () => {
    const base = {
      company_name: 'Toko ABC',
      email: 'owner@test.com',
      password: 'Password1',
      confirm_password: 'Password1',
      phone: '081234567890',
      industry: 'minimarket' as const,
      outlet_count: 'single' as const,
    }

    it('accepts a valid payload', () => {
      const result = validate(signUpSchema, base)
      expect(result.valid).toBe(true)
    })

    it('rejects mismatched passwords', () => {
      const result = validate(signUpSchema, { ...base, confirm_password: 'Different1' })
      expect(result.valid).toBe(false)
    })

    it('rejects a weak password', () => {
      const result = validate(signUpSchema, { ...base, password: 'weak', confirm_password: 'weak' })
      expect(result.valid).toBe(false)
    })

    it('rejects an invalid email', () => {
      const result = validate(signUpSchema, { ...base, email: 'not-an-email' })
      expect(result.valid).toBe(false)
    })
  })

  describe('loginSchema', () => {
    it('requires a non-empty password', () => {
      const result = loginSchema.safeParse({ email: 'a@b.com', password: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('createInvoiceSchema', () => {
    it('rejects an empty cart', () => {
      const result = validate(createInvoiceSchema, {
        outlet_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        items: [],
        payment_method: 'cash',
      })
      expect(result.valid).toBe(false)
    })

    it('accepts a valid cart', () => {
      const result = validate(createInvoiceSchema, {
        outlet_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        items: [{ product_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', quantity: 2 }],
        payment_method: 'cash',
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('inventoryAdjustSchema', () => {
    it('rejects a zero quantity change', () => {
      const result = validate(inventoryAdjustSchema, {
        outlet_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        product_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        quantity_change: 0,
        reason: 'stok opname',
      })
      expect(result.valid).toBe(false)
    })
  })
})
