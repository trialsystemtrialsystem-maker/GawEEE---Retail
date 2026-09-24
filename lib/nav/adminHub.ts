// Single source of truth for the Master Admin area (todo.md Phase 32). Master
// Admin is a configuration-only space: it never lists transactions, and every
// link stays under /dashboard/admin so editing something never throws the
// owner into the Sales / Inventory / Accounting modules. Screens that already
// exist elsewhere are re-exported at an admin path (app/dashboard/admin/**).

export interface AdminHubItem {
  href: string
  icon: string
  label: string
  description: string
}

export interface AdminHubSection {
  title: string
  items: AdminHubItem[]
}

export const ADMIN_HUB_SECTIONS: AdminHubSection[] = [
  {
    title: 'Pengaturan Sistem',
    items: [
      { href: '/dashboard/admin/system', icon: '🛠️', label: 'Identitas & Pajak', description: 'Nama bisnis, NPWP, tarif PPN, dan teks struk.' },
      { href: '/dashboard/admin/features', icon: '🧩', label: 'Menu & Fitur', description: 'Aktifkan atau sembunyikan modul sesuai kebutuhan bisnis.' },
      { href: '/dashboard/admin/access', icon: '🔐', label: 'Hak Akses & Peran', description: 'Atur izin tiap peran.' },
      { href: '/dashboard/admin/payroll-rules', icon: '💼', label: 'Aturan Penggajian', description: 'Potongan terlambat, lembur, tunjangan, BPJS/pajak, jatah cuti.' },
      { href: '/dashboard/admin/payment-methods', icon: '💳', label: 'Metode Pembayaran', description: 'Aktifkan atau nonaktifkan metode pembayaran per outlet.' },
    ],
  },
  {
    title: 'Organisasi',
    items: [
      { href: '/dashboard/admin/outlets', icon: '🏬', label: 'Outlets', description: 'Tambah, aktifkan/nonaktifkan, dan kelola data outlet.' },
      { href: '/dashboard/admin/outlet-info', icon: '⚙️', label: 'Info Outlet', description: 'Nama, alamat, target penjualan, dan lokasi absensi.' },
      { href: '/dashboard/admin/users', icon: '👤', label: 'Users', description: 'Undang pengguna, atur peran, reset password.' },
    ],
  },
  {
    title: 'Data Master',
    items: [
      { href: '/dashboard/admin/master-data', icon: '🗄️', label: 'Semua Data Master', description: 'Produk, kategori, pelanggan, supplier, akun, dan data referensi lainnya.' },
    ],
  },
  {
    title: 'Operasional & Audit',
    items: [
      { href: '/dashboard/admin/bulk-operations', icon: '🧰', label: 'Bulk Operations', description: 'Ubah banyak data sekaligus.' },
      { href: '/dashboard/admin/audit-log', icon: '📜', label: 'Audit Log', description: 'Riwayat perubahan penting di sistem.' },
    ],
  },
]

export const MASTER_DATA_SECTIONS: AdminHubSection[] = [
  {
    title: 'Produk & Katalog',
    items: [
      { href: '/dashboard/admin/data/departments', icon: '🗂️', label: 'Departemen', description: 'Kelompok besar produk.' },
      { href: '/dashboard/admin/data/categories', icon: '🏷️', label: 'Kategori', description: 'Kategori produk.' },
      { href: '/dashboard/admin/data/products', icon: '📦', label: 'Produk & Bahan', description: 'Daftar produk, bahan, dan stok.' },
      { href: '/dashboard/admin/data/recipes', icon: '🍳', label: 'Master Resep', description: 'Resep dan komposisi bahan.' },
      { href: '/dashboard/admin/data/bundling', icon: '🎁', label: 'Bundling', description: 'Paket produk.' },
      { href: '/dashboard/admin/data/extra', icon: '➕', label: 'Extra Produk', description: 'Tambahan/topping.' },
      { href: '/dashboard/admin/data/notes-category', icon: '📝', label: 'Kategori Catatan', description: 'Catatan pesanan yang bisa dipilih.' },
    ],
  },
  {
    title: 'Pelanggan & Pemasok',
    items: [
      { href: '/dashboard/admin/data/customer-groups', icon: '👥', label: 'Grup Pelanggan', description: 'Kelompok pelanggan.' },
      { href: '/dashboard/admin/data/special-pricing', icon: '💲', label: 'Harga Khusus', description: 'Grup harga khusus pelanggan.' },
      { href: '/dashboard/admin/data/custom-fields', icon: '🧩', label: 'Kolom Kustom Pelanggan', description: 'Tambah kolom data pelanggan sendiri.' },
      { href: '/dashboard/admin/data/suppliers', icon: '🚚', label: 'Supplier', description: 'Daftar dan data supplier.' },
    ],
  },
  {
    title: 'Keuangan',
    items: [{ href: '/dashboard/admin/data/chart-of-accounts', icon: '📒', label: 'Chart of Accounts', description: 'Daftar akun untuk jurnal dan laporan.' }],
  },
]
