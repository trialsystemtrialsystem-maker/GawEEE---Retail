import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/reports/accounts-payable — supplier aging report. The standalone
// `accounts_payable` table (005_financial.sql) was defined but never written
// to by anything, so this computes live from purchase_invoices/
// purchase_payments instead of relying on a snapshot nobody refreshes — same
// choice already made for Purchase Return Reconciliation and Customer
// Summary Report.
const AGING_BUCKETS = ['Belum jatuh tempo', '1-30 hari', '31-60 hari', '61-90 hari', '90+ hari'] as const

function bucketFor(daysOverdue: number): (typeof AGING_BUCKETS)[number] {
  if (daysOverdue <= 0) return 'Belum jatuh tempo'
  if (daysOverdue <= 30) return '1-30 hari'
  if (daysOverdue <= 60) return '31-60 hari'
  if (daysOverdue <= 90) return '61-90 hari'
  return '90+ hari'
}

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const { data: pos } = await auth.supabase.from('purchase_orders').select('id').eq('outlet_id', auth.outlet_id)
  const poIds = (pos ?? []).map((p) => p.id)
  if (poIds.length === 0) return NextResponse.json({ invoices: [], bySupplier: [], byBucket: [] })

  const { data: invoices, error } = await auth.supabase
    .from('purchase_invoices')
    .select('id, invoice_number, invoice_date, due_date, total, payment_status, supplier_id, suppliers(name), purchase_payments(amount)')
    .in('po_id', poIds)
    .neq('payment_status', 'paid')
    .order('due_date', { ascending: true })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  type Row = {
    id: string
    invoice_number: string
    invoice_date: string
    due_date: string
    total: number
    supplier_id: string
    suppliers: { name: string } | null
    purchase_payments: { amount: number }[]
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const invoiceRows = (invoices as unknown as Row[])
    .map((inv) => {
      const paid = inv.purchase_payments.reduce((s, p) => s + p.amount, 0)
      const outstanding = Math.max(0, inv.total - paid)
      const dueDate = new Date(inv.due_date)
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        supplier_name: inv.suppliers?.name ?? '-',
        supplier_id: inv.supplier_id,
        total: inv.total,
        paid,
        outstanding,
        days_overdue: Math.max(0, daysOverdue),
        aging_bucket: bucketFor(daysOverdue),
      }
    })
    .filter((r) => r.outstanding > 0)

  const bySupplierMap = new Map<string, { supplier_id: string; supplier_name: string; invoice_count: number; total_outstanding: number; max_days_overdue: number }>()
  for (const r of invoiceRows) {
    const entry = bySupplierMap.get(r.supplier_id) ?? { supplier_id: r.supplier_id, supplier_name: r.supplier_name, invoice_count: 0, total_outstanding: 0, max_days_overdue: 0 }
    entry.invoice_count += 1
    entry.total_outstanding += r.outstanding
    entry.max_days_overdue = Math.max(entry.max_days_overdue, r.days_overdue)
    bySupplierMap.set(r.supplier_id, entry)
  }
  const bySupplier = Array.from(bySupplierMap.values()).sort((a, b) => b.total_outstanding - a.total_outstanding)

  const byBucketMap = new Map<string, number>(AGING_BUCKETS.map((b) => [b, 0]))
  for (const r of invoiceRows) byBucketMap.set(r.aging_bucket, (byBucketMap.get(r.aging_bucket) ?? 0) + r.outstanding)
  const byBucket = AGING_BUCKETS.map((bucket) => ({ bucket, amount: byBucketMap.get(bucket) ?? 0 }))

  return NextResponse.json({ invoices: invoiceRows, bySupplier, byBucket })
}
