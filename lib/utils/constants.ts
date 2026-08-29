export const APP_NAME = 'GawEEE'

export const DEFAULT_TAX_RATE = 0.1 // 10% PPN

export const INDUSTRY_LABELS: Record<string, string> = {
  frozen_food: 'Toko Frozen Food',
  minimarket: 'Minimarket',
  bakery: 'Toko Kue/Bakery',
  kelontong: 'Toko Kelontong',
  other: 'Lainnya',
}

export const ROLE_LABELS: Record<string, string> = {
  master_admin: 'Master Admin',
  outlet_manager: 'Manajer Outlet',
  cashier: 'Kasir',
  staff: 'Staff',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Tunai',
  e_wallet: 'E-Wallet',
  bank_transfer: 'Transfer Bank',
  card: 'Kartu',
}

export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99000,
    description: 'Toko tunggal',
    features: ['1 toko', '3 pengguna', 'POS + Inventory', 'Basic Reports'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 199000,
    description: 'Multi-outlet ready',
    highlighted: true,
    features: ['Hingga 5 toko', 'Unlimited pengguna', 'Master Admin Panel', 'Advanced Reports'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    description: 'Custom scalability',
    features: ['Unlimited toko', 'Custom integration', 'Priority support', 'API access'],
  },
] as const
