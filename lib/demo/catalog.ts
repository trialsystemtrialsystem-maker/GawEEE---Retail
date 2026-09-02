// Static catalog for the "Coba Demo" seeder (app/api/demo/seed/route.ts) —
// a realistic frozen-food UMKM product line, used to generate 3 months of
// synthetic transaction history that exercises every module in the app.

export const DEMO_COMPANY_NAME = 'Toko Frozen Fresh Demo'
export const DEMO_EMAIL = 'demo@gaweee.app'
export const DEMO_PASSWORD = 'DemoGawEEE2026!'

// Second demo login, same tenant/outlet as DEMO_EMAIL but role='cashier' —
// used by the "Coba DEMO POS System Instan" landing button (Phase 12) so a
// visitor lands straight in the Cashier Portal instead of the full admin
// dashboard.
export const DEMO_CASHIER_EMAIL = 'kasir-demo@gaweee.app'
export const DEMO_CASHIER_PASSWORD = 'DemoKasirGawEEE2026!'
export const DEMO_CASHIER_NAME = 'Kasir Demo'

export const DEMO_CATEGORIES = [
  'Ayam & Unggas Beku',
  'Daging Beku',
  'Seafood Beku',
  'Sayuran Beku',
  'Makanan Siap Saji',
  'Es Krim & Dessert',
] as const

export interface DemoProduct {
  category: (typeof DEMO_CATEGORIES)[number]
  name: string
  purchasePrice: number
  sellingPrice: number
  unitType: string
  reorderLevel: number
  reorderQuantity: number
  startingStock: number
  popularity: number // relative sales weight, 1 (rare) - 5 (bestseller)
}

// Starting stock is sized for ~90 days of simulated sales plus scheduled
// restocks (see route.ts) to comfortably outlast the period — except the two
// products flagged below, which are deliberately kept lean with no dedicated
// restock so they end up low/out-of-stock "today", demonstrating the
// low-stock alert path.
export const DEMO_PRODUCTS: DemoProduct[] = [
  // Ayam & Unggas Beku
  { category: 'Ayam & Unggas Beku', name: 'Ayam Fillet Beku 1kg', purchasePrice: 28000, sellingPrice: 38000, unitType: 'pack', reorderLevel: 40, reorderQuantity: 100, startingStock: 500, popularity: 5 },
  { category: 'Ayam & Unggas Beku', name: 'Nugget Ayam 500gr', purchasePrice: 18000, sellingPrice: 25000, unitType: 'pack', reorderLevel: 50, reorderQuantity: 120, startingStock: 600, popularity: 5 },
  { category: 'Ayam & Unggas Beku', name: 'Sosis Ayam 500gr', purchasePrice: 15000, sellingPrice: 22000, unitType: 'pack', reorderLevel: 40, reorderQuantity: 100, startingStock: 550, popularity: 4 },
  { category: 'Ayam & Unggas Beku', name: 'Chicken Katsu 500gr', purchasePrice: 22000, sellingPrice: 32000, unitType: 'pack', reorderLevel: 30, reorderQuantity: 80, startingStock: 420, popularity: 3 },

  // Daging Beku
  { category: 'Daging Beku', name: 'Bakso Sapi Premium 500gr', purchasePrice: 25000, sellingPrice: 35000, unitType: 'pack', reorderLevel: 40, reorderQuantity: 100, startingStock: 530, popularity: 5 },
  { category: 'Daging Beku', name: 'Daging Giling Sapi 1kg', purchasePrice: 65000, sellingPrice: 85000, unitType: 'pack', reorderLevel: 20, reorderQuantity: 50, startingStock: 250, popularity: 3 },
  { category: 'Daging Beku', name: 'Sosis Sapi 500gr', purchasePrice: 20000, sellingPrice: 28000, unitType: 'pack', reorderLevel: 30, reorderQuantity: 80, startingStock: 390, popularity: 3 },
  { category: 'Daging Beku', name: 'Rendang Beku 500gr', purchasePrice: 30000, sellingPrice: 42000, unitType: 'pack', reorderLevel: 25, reorderQuantity: 60, startingStock: 70, popularity: 4 }, // intentionally lean stock -> demonstrates low-stock alert

  // Seafood Beku
  { category: 'Seafood Beku', name: 'Udang Windu Beku 500gr', purchasePrice: 45000, sellingPrice: 62000, unitType: 'pack', reorderLevel: 30, reorderQuantity: 60, startingStock: 55, popularity: 5 }, // intentionally lean stock -> demonstrates low-stock alert
  { category: 'Seafood Beku', name: 'Cumi Beku 500gr', purchasePrice: 35000, sellingPrice: 48000, unitType: 'pack', reorderLevel: 25, reorderQuantity: 60, startingStock: 300, popularity: 3 },
  { category: 'Seafood Beku', name: 'Ikan Dori Fillet 1kg', purchasePrice: 40000, sellingPrice: 55000, unitType: 'pack', reorderLevel: 20, reorderQuantity: 50, startingStock: 260, popularity: 3 },
  { category: 'Seafood Beku', name: 'Bakso Ikan 500gr', purchasePrice: 18000, sellingPrice: 26000, unitType: 'pack', reorderLevel: 35, reorderQuantity: 80, startingStock: 450, popularity: 4 },

  // Sayuran Beku
  { category: 'Sayuran Beku', name: 'Kentang Goreng Beku 1kg', purchasePrice: 20000, sellingPrice: 28000, unitType: 'pack', reorderLevel: 40, reorderQuantity: 100, startingStock: 580, popularity: 5 },
  { category: 'Sayuran Beku', name: 'Sayur Sop Beku 500gr', purchasePrice: 10000, sellingPrice: 15000, unitType: 'pack', reorderLevel: 40, reorderQuantity: 100, startingStock: 500, popularity: 2 },
  { category: 'Sayuran Beku', name: 'Edamame Beku 500gr', purchasePrice: 15000, sellingPrice: 22000, unitType: 'pack', reorderLevel: 30, reorderQuantity: 70, startingStock: 360, popularity: 3 },
  { category: 'Sayuran Beku', name: 'Jagung Manis Beku 500gr', purchasePrice: 8000, sellingPrice: 13000, unitType: 'pack', reorderLevel: 30, reorderQuantity: 70, startingStock: 390, popularity: 2 },

  // Makanan Siap Saji
  { category: 'Makanan Siap Saji', name: 'Dimsum Ayam Isi 10', purchasePrice: 28000, sellingPrice: 40000, unitType: 'pack', reorderLevel: 30, reorderQuantity: 70, startingStock: 360, popularity: 4 },
  { category: 'Makanan Siap Saji', name: 'Siomay Ikan Isi 10', purchasePrice: 24000, sellingPrice: 35000, unitType: 'pack', reorderLevel: 30, reorderQuantity: 70, startingStock: 330, popularity: 3 },
  { category: 'Makanan Siap Saji', name: 'Pizza Beku 25cm', purchasePrice: 32000, sellingPrice: 48000, unitType: 'pcs', reorderLevel: 20, reorderQuantity: 50, startingStock: 240, popularity: 3 },
  { category: 'Makanan Siap Saji', name: 'Spring Roll Beku 500gr', purchasePrice: 20000, sellingPrice: 30000, unitType: 'pack', reorderLevel: 25, reorderQuantity: 60, startingStock: 280, popularity: 2 },

  // Es Krim & Dessert
  { category: 'Es Krim & Dessert', name: 'Es Krim Vanilla 1L', purchasePrice: 25000, sellingPrice: 38000, unitType: 'tub', reorderLevel: 25, reorderQuantity: 60, startingStock: 300, popularity: 4 },
  { category: 'Es Krim & Dessert', name: 'Es Krim Coklat 1L', purchasePrice: 25000, sellingPrice: 38000, unitType: 'tub', reorderLevel: 25, reorderQuantity: 60, startingStock: 300, popularity: 4 },
  { category: 'Es Krim & Dessert', name: 'Puding Coklat Cup 6pcs', purchasePrice: 15000, sellingPrice: 24000, unitType: 'pack', reorderLevel: 30, reorderQuantity: 70, startingStock: 360, popularity: 2 },
  { category: 'Es Krim & Dessert', name: 'Waffle Beku 6pcs', purchasePrice: 18000, sellingPrice: 28000, unitType: 'pack', reorderLevel: 25, reorderQuantity: 60, startingStock: 260, popularity: 2 },
]

export const DEMO_SUPPLIERS = [
  { name: 'PT Sumber Beku Nusantara', contact_person: 'Hendra Wijaya', phone: '081234500001', payment_terms: 30 },
  { name: 'CV Frozen Food Sejahtera', contact_person: 'Rina Kartika', phone: '081234500002', payment_terms: 14 },
  { name: 'PT Cold Chain Indonesia', contact_person: 'Ahmad Fauzi', phone: '081234500003', payment_terms: 30 },
  { name: 'UD Mitra Dingin', contact_person: 'Siti Nurhaliza', phone: '081234500004', payment_terms: 7 },
]

export const DEMO_CUSTOMER_NAMES = [
  'Budi Santoso', 'Siti Aminah', 'Andi Wijaya', 'Dewi Lestari', 'Rudi Hartono',
  'Maya Sari', 'Eko Prasetyo', 'Fitri Handayani', 'Joko Susilo', 'Wati Rahayu',
]
