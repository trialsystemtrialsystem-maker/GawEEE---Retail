// Shared sample data for tests — mirrors database/seed/seed.sql and
// roadmap.md §6.5.

export const FIXTURE_USER_CASHIER = {
  id: 'user-cashier-1',
  email: 'cashier@test.com',
  password: 'password123',
  role: 'cashier' as const,
  full_name: 'John Doe',
  outlet_id: 'outlet-1',
}

export const FIXTURE_USER_MANAGER = {
  id: 'user-manager-1',
  email: 'manager@test.com',
  password: 'password123',
  role: 'outlet_manager' as const,
  full_name: 'Jane Smith',
  outlet_id: 'outlet-1',
}

export const FIXTURE_COMPANY = {
  id: 'company-1',
  name: 'Test Store',
  tier: 'starter' as const,
  industry: 'minimarket',
}

export const FIXTURE_OUTLET = {
  id: 'outlet-1',
  company_id: 'company-1',
  name: 'Toko ABC - Jakarta',
  address: 'Jl. Merdeka 123, Jakarta',
}

export const FIXTURE_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Indomie Goreng',
    sku: 'INDO001',
    barcode: '1234567890123',
    purchase_price: 2500,
    selling_price: 3500,
    reorder_level: 50,
  },
  {
    id: 'prod-2',
    name: 'Aqua 600ml',
    sku: 'AQUA001',
    barcode: '0987654321098',
    purchase_price: 3000,
    selling_price: 4500,
    reorder_level: 100,
  },
]

export const FIXTURE_INVENTORY = [
  { outlet_id: 'outlet-1', product_id: 'prod-1', quantity_on_hand: 200 },
  { outlet_id: 'outlet-1', product_id: 'prod-2', quantity_on_hand: 150 },
]
