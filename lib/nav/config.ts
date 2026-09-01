// Shared navigation config, split into a top bar (5 primary modules, per the
// reference mockup) + a "More" set for everything else. The sidebar reads
// the same data and shows whichever section's children match the current
// route, instead of a flat always-expanded list.

export interface NavChild {
  label: string
  href: string
}

export interface NavGroup {
  label: string
  icon: string
  items: NavChild[]
}

export interface NavItem {
  key: string
  label: string
  href: string
  icon: string
  children?: NavChild[]
  /** Nested accordion groups, used by Sales/Inventory (majoo-style mockups)
   * — every other section keeps the flat `children` list. */
  groups?: NavGroup[]
  /** Flat links rendered *after* the groups (e.g. Inventory's "Supplier
   * List", which sits below the accordion in the reference mockup). */
  trailingChildren?: NavChild[]
}

export const PRIMARY_NAV: NavItem[] = [
  {
    key: 'sales',
    label: 'Sales',
    href: '/dashboard',
    icon: '📊',
    children: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Laporan Harian', href: '/dashboard/reports/daily' },
    ],
    groups: [
      {
        label: 'Report',
        icon: '📋',
        items: [
          { label: 'Sales Report', href: '/dashboard/sales' },
          { label: 'Kitchen Report', href: '/dashboard/sales/reports/kitchen' },
          { label: 'Product Report', href: '/dashboard/sales/reports/product' },
          { label: 'Service Report', href: '/dashboard/sales/reports/service' },
          { label: 'Facility Report', href: '/dashboard/sales/reports/facility' },
          { label: 'Promo & Loyalty Report', href: '/dashboard/sales/reports/promo-loyalty' },
          { label: 'Tax Report', href: '/dashboard/financial/tax-report' },
          { label: 'Cashier Report', href: '/dashboard/sales/reports/cashier' },
          { label: 'Deposit Report', href: '/dashboard/sales/reports/deposit' },
          { label: 'Customer Summary Report', href: '/dashboard/sales/reports/customer-summary' },
          { label: 'Employee Report', href: '/dashboard/sales/reports/employee' },
          { label: 'Inventory Report', href: '/dashboard/sales/reports/inventory' },
          { label: 'Settlement Report', href: '/dashboard/sales/reports/settlement' },
        ],
      },
      {
        label: 'Report Analysis',
        icon: '📈',
        items: [
          { label: 'Product Peak Time', href: '/dashboard/sales/analysis/product-peak-time' },
          { label: 'Sales Peak Time', href: '/dashboard/sales/analysis/sales-peak-time' },
          { label: 'Stock Turnover', href: '/dashboard/sales/analysis/stock-turnover' },
          { label: 'Customer Satisfaction', href: '/dashboard/sales/analysis/customer-satisfaction' },
        ],
      },
      {
        label: 'Product',
        icon: '📦',
        items: [
          { label: 'Department List', href: '/dashboard/sales/product/departments' },
          { label: 'Category List', href: '/dashboard/inventory/products' },
          { label: 'Product List', href: '/dashboard/inventory' },
          { label: 'Service Products', href: '/dashboard/sales/product/service-products' },
          { label: 'Product Facility', href: '/dashboard/sales/product/facility' },
          { label: 'Extra Product', href: '/dashboard/sales/product/extra' },
          { label: 'Product Bundling', href: '/dashboard/sales/product/bundling' },
          { label: 'Deposits', href: '/dashboard/sales/product/deposits' },
          { label: 'Scheduling Recipe Changes', href: '/dashboard/sales/product/recipe-changes' },
          { label: 'Ojek Online Price List', href: '/dashboard/sales/product/ojol-price-list' },
          { label: 'Price Scheduler', href: '/dashboard/sales/product/price-scheduler' },
          { label: 'Time-Based Pricing', href: '/dashboard/sales/product/time-based-pricing' },
          { label: 'Print Barcode', href: '/dashboard/sales/product/print-barcode' },
          { label: 'Notes Category List', href: '/dashboard/sales/product/notes-category' },
          { label: 'Master Recipes', href: '/dashboard/sales/product/master-recipes' },
        ],
      },
      {
        label: 'Customer',
        icon: '👨‍👩‍👧',
        items: [
          { label: 'Customer List', href: '/dashboard/sales/customers' },
          { label: 'Customer Group', href: '/dashboard/sales/customers/groups' },
          { label: 'Special Pricing Group', href: '/dashboard/sales/customers/special-pricing' },
          { label: 'Customer Custom Fields', href: '/dashboard/sales/customers/custom-fields' },
          { label: 'Customer Data Setting', href: '/dashboard/sales/customers/settings' },
        ],
      },
      {
        label: 'Promotion',
        icon: '🏷️',
        items: [
          { label: 'Promotion', href: '/dashboard/sales/promotion' },
          { label: 'Coupon', href: '/dashboard/sales/promotion/coupon' },
          { label: 'Loyalty', href: '/dashboard/sales/promotion/loyalty' },
          { label: 'Point Reward', href: '/dashboard/sales/promotion/point-reward' },
        ],
      },
      {
        label: 'Commission',
        icon: '🤝',
        items: [{ label: 'Commission Group List', href: '/dashboard/sales/commission' }],
      },
      {
        label: 'Invoice',
        icon: '🧾',
        items: [
          { label: 'Sales Quotation List', href: '/dashboard/sales/documents/quotations' },
          { label: 'Sales Order List', href: '/dashboard/sales/documents/orders' },
          { label: 'Sales Delivery List', href: '/dashboard/sales/documents/deliveries' },
          { label: 'Invoice List', href: '/dashboard/sales/invoices' },
          { label: 'Sales Receipt', href: '/dashboard/sales/invoices' },
        ],
      },
      {
        label: 'Campaign',
        icon: '📣',
        items: [
          { label: 'Send Marketing Campaign', href: '/dashboard/sales/campaign/send' },
          { label: 'Buy Marketing Campaign', href: '/dashboard/sales/campaign/buy' },
        ],
      },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    href: '/dashboard/inventory',
    icon: '📦',
    children: [{ label: 'Ingredient List', href: '/dashboard/inventory' }],
    groups: [
      {
        label: 'Purchase Order (PO)',
        icon: '🧾',
        items: [
          { label: 'Item Request', href: '/dashboard/inventory/purchasing/item-request' },
          { label: 'Purchase Order (PO)', href: '/dashboard/suppliers/purchase-orders' },
          { label: 'Purchase Delivery', href: '/dashboard/inventory/purchasing/delivery' },
          { label: 'Purchase Invoice', href: '/dashboard/suppliers/invoices' },
          { label: 'Invoice Payment', href: '/dashboard/inventory/purchasing/invoice-payment' },
        ],
      },
      {
        label: 'Return',
        icon: '↩️',
        items: [
          { label: 'Purchase Return', href: '/dashboard/inventory/returns' },
          { label: 'Purchase Return Reconciliation', href: '/dashboard/inventory/returns/reconciliation' },
        ],
      },
      {
        label: 'Manage Stock',
        icon: '📦',
        items: [
          { label: 'Stock List', href: '/dashboard/inventory' },
          { label: 'Stock Opname', href: '/dashboard/inventory/stocktake' },
          { label: 'Stock Waste', href: '/dashboard/inventory/stock/waste' },
          { label: 'Laporan Kadaluarsa', href: '/dashboard/inventory/expiry' },
        ],
      },
      {
        label: 'Stock Production',
        icon: '🏭',
        items: [
          { label: 'Stock Production List', href: '/dashboard/inventory/production' },
          { label: 'Stock Production Template', href: '/dashboard/inventory/production/template' },
        ],
      },
      {
        label: 'Stock Mutation',
        icon: '🔀',
        items: [
          { label: 'Stock Request', href: '/dashboard/inventory/mutation/request' },
          { label: 'Stock Must Sent', href: '/dashboard/inventory/mutation/must-sent' },
          { label: 'Stock Transfer', href: '/dashboard/inventory/mutation/transfer' },
          { label: 'Receive Stock Transfer', href: '/dashboard/inventory/mutation/receive-transfer' },
          { label: 'Stock in Transit', href: '/dashboard/inventory/mutation/in-transit' },
        ],
      },
    ],
    trailingChildren: [{ label: 'Supplier List', href: '/dashboard/suppliers' }],
  },
  {
    key: 'employee',
    label: 'Employee',
    href: '/dashboard/staff',
    icon: '👥',
    children: [
      { label: 'Daftar Karyawan', href: '/dashboard/staff' },
      { label: 'Attendance', href: '/dashboard/staff/attendance' },
      { label: 'Buka/Tutup Kasir', href: '/dashboard/staff/cashier-shifts' },
      { label: 'Payroll', href: '/dashboard/staff/payroll' },
      { label: 'Hak Akses', href: '/dashboard/staff/access' },
      { label: 'Jadwal Kerja', href: '/dashboard/staff/schedule' },
      { label: 'Notifikasi', href: '/dashboard/staff/notifications' },
      { label: 'Persetujuan Pembelian', href: '/dashboard/staff/approvals/purchasing' },
      { label: 'Persetujuan Keuangan', href: '/dashboard/staff/approvals/finance' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting',
    href: '/dashboard/accounting',
    icon: '📒',
    children: [
      { label: 'Dashboard Akuntansi', href: '/dashboard/accounting' },
      { label: 'Chart of Accounts', href: '/dashboard/accounting/accounts' },
      { label: 'Jurnal Umum', href: '/dashboard/accounting/journal' },
      { label: 'Buku Besar', href: '/dashboard/accounting/ledger' },
      { label: 'Neraca', href: '/dashboard/accounting/balance-sheet' },
      { label: 'Laba Rugi', href: '/dashboard/accounting/profit-loss' },
    ],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    href: '/dashboard/whatsapp',
    icon: '💬',
  },
]

export const SECONDARY_NAV: NavItem[] = [
  {
    key: 'suppliers',
    label: 'Supplier',
    href: '/dashboard/suppliers',
    icon: '🏪',
    children: [
      { label: 'Daftar Supplier', href: '/dashboard/suppliers' },
      { label: 'Purchase Order', href: '/dashboard/suppliers/purchase-orders' },
      { label: 'Invoice Supplier', href: '/dashboard/suppliers/invoices' },
    ],
  },
  {
    key: 'financial',
    label: 'Keuangan',
    href: '/dashboard/financial',
    icon: '📈',
    children: [
      { label: 'Laporan Harian', href: '/dashboard/financial' },
      { label: 'P&L Statement', href: '/dashboard/financial/reports' },
      { label: 'Cash Position', href: '/dashboard/financial/cash-position' },
      { label: 'Tax Report', href: '/dashboard/financial/tax-report' },
    ],
  },
  {
    key: 'online-orders',
    label: 'Order Online',
    href: '/dashboard/online-orders',
    icon: '🛵',
  },
  {
    key: 'bookings',
    label: 'Booking',
    href: '/dashboard/bookings',
    icon: '📅',
  },
  {
    key: 'admin',
    label: 'Master Admin',
    href: '/dashboard/admin',
    icon: '🏬',
    children: [
      { label: 'Outlets', href: '/dashboard/admin/outlets' },
      { label: 'Users', href: '/dashboard/admin/users' },
      { label: 'Bulk Operations', href: '/dashboard/admin/bulk-operations' },
      { label: 'Audit Log', href: '/dashboard/admin/audit-log' },
    ],
  },
  {
    key: 'settings',
    label: 'Pengaturan',
    href: '/dashboard/settings',
    icon: '⚙️',
    children: [
      { label: 'Outlet Info', href: '/dashboard/settings' },
      { label: 'Metode Pembayaran', href: '/dashboard/settings/payment-methods' },
      { label: 'User Management', href: '/dashboard/settings/users' },
    ],
  },
]

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV]

/** The nav item whose section the current pathname falls under, longest
 * `href` match first so e.g. `/dashboard/sales/invoices` doesn't get
 * shadowed by the `/dashboard` (Sales) item matching every dashboard route. */
export function findActiveNavItem(pathname: string): NavItem | undefined {
  const matches = ALL_NAV.filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
  if (matches.length === 0) return undefined
  return matches.reduce((longest, item) => (item.href.length > longest.href.length ? item : longest))
}
