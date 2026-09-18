import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/reports/accounts-receivable — customer aging report for unpaid
// sales (pay_later, and any e-wallet/bank sale still awaiting settlement).
// The standalone `accounts_receivable` table (005_financial.sql) was defined
// but never written to by anything, so this computes live from invoices
// instead — same choice already made for Accounts Payable above and
// Customer Summary Report. Matches to a known customer by phone (primary),
// falling back to grouping by the raw name typed at checkout when no phone
// was captured — there's no FK from invoices to customers (same disclosed
// limitation as Customer Summary Report).
const AGING_BUCKETS = ['0-30 hari', '31-60 hari', '61-90 hari', '90+ hari'] as const

function bucketFor(daysOutstanding: number): (typeof AGING_BUCKETS)[number] {
  if (daysOutstanding <= 30) return '0-30 hari'
  if (daysOutstanding <= 60) return '31-60 hari'
  if (daysOutstanding <= 90) return '61-90 hari'
  return '90+ hari'
}

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, customer_phone, total, payment_status, order_status, created_at')
    .eq('outlet_id', auth.outlet_id)
    .in('payment_status', ['pending', 'partial'])
    .neq('order_status', 'voided')
    .order('created_at', { ascending: true })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  type Row = { id: string; invoice_number: string; customer_name: string | null; customer_phone: string | null; total: number; created_at: string }
  const rows = data as unknown as Row[]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const invoiceRows = rows.map((inv) => {
    const createdDate = new Date(inv.created_at)
    createdDate.setHours(0, 0, 0, 0)
    const daysOutstanding = Math.max(0, Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)))
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name ?? 'Tanpa nama pelanggan',
      customer_phone: inv.customer_phone,
      total: inv.total,
      created_at: inv.created_at,
      days_outstanding: daysOutstanding,
      aging_bucket: bucketFor(daysOutstanding),
    }
  })

  type Entry = { key: string; name: string; phone: string | null; invoice_count: number; total_outstanding: number; max_days_outstanding: number }
  const byCustomerMap = new Map<string, Entry>()
  for (const r of invoiceRows) {
    const key = r.customer_phone || `name:${r.customer_name}`
    const entry = byCustomerMap.get(key) ?? { key, name: r.customer_name, phone: r.customer_phone, invoice_count: 0, total_outstanding: 0, max_days_outstanding: 0 }
    entry.invoice_count += 1
    entry.total_outstanding += r.total
    entry.max_days_outstanding = Math.max(entry.max_days_outstanding, r.days_outstanding)
    byCustomerMap.set(key, entry)
  }
  const byCustomer = Array.from(byCustomerMap.values()).sort((a, b) => b.total_outstanding - a.total_outstanding)

  const byBucketMap = new Map<string, number>(AGING_BUCKETS.map((b) => [b, 0]))
  for (const r of invoiceRows) byBucketMap.set(r.aging_bucket, (byBucketMap.get(r.aging_bucket) ?? 0) + r.total)
  const byBucket = AGING_BUCKETS.map((bucket) => ({ bucket, amount: byBucketMap.get(bucket) ?? 0 }))

  return NextResponse.json({
    invoices: invoiceRows,
    byCustomer,
    byBucket,
    note: 'Pencocokan berbasis nomor telepon — transaksi tanpa nomor telepon dikelompokkan berdasarkan nama yang diketik saat checkout.',
  })
}
