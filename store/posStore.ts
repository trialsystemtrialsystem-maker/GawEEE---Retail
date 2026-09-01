import { create } from 'zustand'
import { DEFAULT_TAX_RATE } from '@/lib/utils/constants'

export interface CartItem {
  product_id: string
  name: string
  sku: string
  unit_price: number
  quantity: number
  discount?: number // per-item discount passed through to create_invoice() — see Multi-UOM
  unit_label?: string // display only, e.g. "2 Dus" — cleared on merge if the unit differs
  unit_quantity?: number // display only, how many of unit_label
}

interface PosState {
  outletId: string | null
  items: CartItem[]
  discountAmount: number
  discountReason: string
  paymentMethod: 'cash' | 'e_wallet' | 'bank_transfer' | 'card'
  setOutlet: (outletId: string) => void
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
  incrementItem: (productId: string) => void
  decrementItem: (productId: string) => void
  removeItem: (productId: string) => void
  setDiscount: (amount: number, reason?: string) => void
  setPaymentMethod: (method: PosState['paymentMethod']) => void
  clearCart: () => void
  restoreCart: (items: CartItem[], discountAmount: number, discountReason: string) => void
  subtotal: () => number
  taxAmount: () => number
  total: () => number
}

export const usePosStore = create<PosState>((set, get) => ({
  outletId: null,
  items: [],
  discountAmount: 0,
  discountReason: '',
  paymentMethod: 'cash',

  setOutlet: (outletId) => set({ outletId }),

  addItem: (item, quantity = 1) =>
    set((state) => {
      const existing = state.items.find((i) => i.product_id === item.product_id)
      if (existing) {
        const sameUnit = existing.unit_label === item.unit_label
        return {
          items: state.items.map((i) =>
            i.product_id === item.product_id
              ? {
                  ...i,
                  ...item,
                  quantity: i.quantity + quantity,
                  discount: (i.discount ?? 0) + (item.discount ?? 0),
                  unit_quantity: sameUnit ? (i.unit_quantity ?? 0) + (item.unit_quantity ?? 0) : item.unit_quantity,
                }
              : i
          ),
        }
      }
      return { items: [...state.items, { ...item, quantity }] }
    }),

  incrementItem: (productId) =>
    set((state) => ({
      items: state.items.map((i) => (i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i)),
    })),

  decrementItem: (productId) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.product_id === productId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0),
    })),

  removeItem: (productId) =>
    set((state) => ({ items: state.items.filter((i) => i.product_id !== productId) })),

  setDiscount: (amount, reason = '') => set({ discountAmount: amount, discountReason: reason }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  clearCart: () => set({ items: [], discountAmount: 0, discountReason: '' }),

  restoreCart: (items, discountAmount, discountReason) => set({ items, discountAmount, discountReason }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),

  taxAmount: () => {
    const taxable = get().subtotal() - get().discountAmount
    return Math.max(0, Math.round(taxable * DEFAULT_TAX_RATE))
  },

  total: () => get().subtotal() - get().discountAmount + get().taxAmount(),
}))
