// Feature flags for Master Admin > Menu & Fitur (todo.md Phase 32 batch 4).
// Stored at companies.settings.features as { [nav key]: boolean }; a missing
// key means enabled, so nothing changes until an owner switches a module off.
// Flags hide menu entries only — API routes are untouched (stated in the UI).
import type { NavItem } from '@/lib/nav/config'

export interface FeatureDef {
  key: string
  label: string
  description: string
}

// Keys match NavItem.key. Sales, Master Admin and Pengaturan are never
// switchable: turning them off would lock the owner out of the way back.
export const FEATURES: FeatureDef[] = [
  { key: 'inventory', label: 'Inventory', description: 'Stok, produk, resep, purchase order.' },
  { key: 'employee', label: 'Employee', description: 'Karyawan, absensi, payroll, insentif, kasbon.' },
  { key: 'accounting', label: 'Accounting', description: 'Jurnal, buku besar, neraca, laba rugi, AR/AP.' },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Pesan dan kampanye WhatsApp.' },
  { key: 'suppliers', label: 'Suppliers', description: 'Daftar dan pengelolaan supplier.' },
  { key: 'financial', label: 'Keuangan', description: 'Laporan harian, posisi kas, pajak.' },
  { key: 'online-orders', label: 'Online Orders', description: 'Pesanan dari kanal online.' },
  { key: 'bookings', label: 'Bookings', description: 'Reservasi layanan dan fasilitas.' },
]

export type FeatureFlags = Record<string, boolean>

export function isFeatureEnabled(flags: FeatureFlags | undefined, key: string): boolean {
  return flags?.[key] !== false
}

/** Hides switched-off modules. The owner (master_admin) still sees them, marked
 * `disabled`, so they can find their way back to turn them on again. */
export function applyFeatureFlags(items: NavItem[], flags: FeatureFlags | undefined, isMaster: boolean): (NavItem & { disabled?: boolean })[] {
  return items.flatMap((item) => {
    if (isFeatureEnabled(flags, item.key)) return [item]
    return isMaster ? [{ ...item, disabled: true }] : []
  })
}
