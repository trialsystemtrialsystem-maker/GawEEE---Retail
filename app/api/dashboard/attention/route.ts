import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'

export interface AttentionItem {
  key: string
  label: string
  count: number
  detail?: string
  severity: 'critical' | 'warning' | 'info'
  href: string
}

// GET /api/dashboard/attention?outlet_id= — "Perlu Perhatian": everything at this
// outlet that is waiting on a person, as cheap head-counts (approvals, overdue
// money, stock trouble, today's schedule…). Only counts the caller's role may
// act on are included; each item deep-links to where it is handled.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const isManager = ['outlet_manager', 'master_admin'].includes(auth.role)
  const today = new Date().toISOString().slice(0, 10)
  const day = 86_400_000
  const before30 = new Date(Date.now() - 30 * day).toISOString()
  const in30 = new Date(Date.now() + 30 * day).toISOString().slice(0, 10)
  const sb = auth.supabase

  // Loosely typed on purpose: these are plain head-counts over many tables.
  type Counter = { eq: (c: string, v: unknown) => Counter; neq: (c: string, v: unknown) => Counter; in: (c: string, v: unknown[]) => Counter; lt: (c: string, v: unknown) => Counter; lte: (c: string, v: unknown) => Counter; gte: (c: string, v: unknown) => Counter; not: (c: string, op: string, v: unknown) => Counter } & PromiseLike<{ count: number | null }>
  const loose = sb as unknown as { from: (t: string) => { select: (cols: string, o: { count: 'exact'; head: true }) => Counter } }
  const head = (table: string) => loose.from(table).select('id', { count: 'exact', head: true })
  const q = (p: Counter) => p

  const [incomingOrders, bookingsToday, pendingBookings, poApproval, poOverdue, leave, expenses, kasbon, outOfStock, lowStock, overdueAr, overdueAp, docs, drafts] = await Promise.all([
    q(head('online_orders').eq('outlet_id', outletId).eq('status', 'incoming')),
    q(head('bookings').eq('outlet_id', outletId).eq('scheduled_date', today).in('status', ['pending', 'confirmed', 'in_progress'])),
    q(head('bookings').eq('outlet_id', outletId).eq('status', 'pending').gte('scheduled_date', today)),
    isManager ? q(head('purchase_orders').eq('outlet_id', outletId).eq('status', 'pending_approval')) : Promise.resolve({ count: 0 }),
    isManager ? q(head('purchase_orders').eq('outlet_id', outletId).in('status', ['ordered', 'partial_received']).lt('requested_delivery_date', today)) : Promise.resolve({ count: 0 }),
    isManager ? q(head('leave_requests').eq('outlet_id', outletId).eq('status', 'pending')) : Promise.resolve({ count: 0 }),
    isManager ? q(head('expense_requests').eq('outlet_id', outletId).eq('status', 'pending')) : Promise.resolve({ count: 0 }),
    isManager ? q(head('cash_advances').eq('outlet_id', outletId).eq('status', 'pending')) : Promise.resolve({ count: 0 }),
    q(head('inventory').eq('outlet_id', outletId).eq('alert_status', 'out_of_stock')),
    q(head('inventory').eq('outlet_id', outletId).eq('alert_status', 'low_stock')),
    isManager ? q(head('invoices').eq('outlet_id', outletId).in('payment_status', ['pending', 'partial']).neq('order_status', 'voided').lt('created_at', before30)) : Promise.resolve({ count: 0 }),
    isManager ? q(loose.from('purchase_invoices').select('id, purchase_orders!inner(outlet_id)', { count: 'exact', head: true }).eq('purchase_orders.outlet_id', outletId).neq('payment_status', 'paid').lt('due_date', today)) : Promise.resolve({ count: 0 }),
    isManager ? q(head('employee_documents').eq('outlet_id', outletId).not('expires_on', 'is', null).lte('expires_on', in30)) : Promise.resolve({ count: 0 }),
    isManager ? q(head('journal_entries').eq('outlet_id', outletId).eq('status', 'draft')) : Promise.resolve({ count: 0 }),
  ])

  const n = (r: { count: number | null }) => r.count ?? 0
  const all: AttentionItem[] = [
    { key: 'online_incoming', label: 'Pesanan online menunggu diproses', count: n(incomingOrders), severity: 'critical', href: '/dashboard/online-orders' },
    { key: 'ar_overdue', label: 'Piutang pelanggan lebih dari 30 hari', count: n(overdueAr), severity: 'critical', href: '/dashboard/accounting/accounts-receivable' },
    { key: 'ap_overdue', label: 'Tagihan supplier lewat jatuh tempo', count: n(overdueAp), severity: 'critical', href: '/dashboard/accounting/accounts-payable' },
    { key: 'out_of_stock', label: 'Produk stok habis', count: n(outOfStock), severity: 'critical', href: '/dashboard/inventory?status=out_of_stock' },
    { key: 'po_approval', label: 'PO menunggu persetujuan', count: n(poApproval), severity: 'warning', href: '/dashboard/suppliers/purchase-orders' },
    { key: 'leave', label: 'Pengajuan izin/cuti menunggu', count: n(leave), severity: 'warning', href: '/dashboard/staff/approvals/leave' },
    { key: 'expense', label: 'Pengajuan biaya menunggu', count: n(expenses), severity: 'warning', href: '/dashboard/staff/approvals/finance' },
    { key: 'kasbon', label: 'Pengajuan kasbon menunggu', count: n(kasbon), severity: 'warning', href: '/dashboard/staff' },
    { key: 'po_overdue', label: 'PO terlambat dari jadwal kirim', count: n(poOverdue), severity: 'warning', href: '/dashboard/suppliers/purchase-orders' },
    { key: 'low_stock', label: 'Produk stok rendah', count: n(lowStock), severity: 'warning', href: '/dashboard/inventory/reorder', detail: 'Lihat rekomendasi pemesanan' },
    { key: 'bookings_pending', label: 'Booking menunggu konfirmasi', count: n(pendingBookings), severity: 'warning', href: '/dashboard/bookings' },
    { key: 'docs', label: 'Dokumen karyawan akan/telah kedaluwarsa', count: n(docs), severity: 'warning', href: '/dashboard/staff/reports' },
    { key: 'drafts', label: 'Jurnal draft belum diposting', count: n(drafts), severity: 'info', href: '/dashboard/accounting/journal' },
    { key: 'bookings_today', label: 'Booking hari ini', count: n(bookingsToday), severity: 'info', href: '/dashboard/bookings' },
  ]
  const items = all.filter((i) => i.count > 0)

  const order = { critical: 0, warning: 1, info: 2 }
  items.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count)
  return NextResponse.json({ items })
}
