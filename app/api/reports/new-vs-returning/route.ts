import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveOutletScope } from '@/lib/utils/outletScope'

// GET /api/reports/new-vs-returning?months=6 — new vs. returning customer
// revenue/count per month, a standard KPI on every enterprise sales
// dashboard (Shopify Analytics, Square, Amplitude) for telling growth-via-
// acquisition apart from growth-via-retention. A customer's very first
// purchase EVER (not just within the report window) decides which month
// they count as "new" in — every other purchase of theirs, in any month,
// counts as "returning" — so this needs full purchase history per phone,
// not just the windowed slice.
type InvoiceRow = { customer_phone: string | null; total: number; created_at: string }

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scopeResult = await resolveOutletScope(auth, request.nextUrl.searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope
  const months = Math.min(Number(request.nextUrl.searchParams.get('months') ?? '6'), 24)

  const { data, error } = await auth.supabase
    .from('invoices')
    .select('customer_phone, total, created_at')
    .in('outlet_id', outletIds)
    .neq('order_status', 'voided')
    .not('customer_phone', 'is', null)
    .order('created_at', { ascending: true })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const rows = data as unknown as InvoiceRow[]

  // First-ever purchase month per phone, across ALL history (not windowed).
  const firstPurchaseMonth = new Map<string, string>()
  for (const inv of rows) {
    const phone = inv.customer_phone!
    const month = inv.created_at.slice(0, 7)
    const existing = firstPurchaseMonth.get(phone)
    if (!existing || month < existing) firstPurchaseMonth.set(phone, month)
  }

  // UTC-safe month-window construction — see todo.md Phase 27/28 for the
  // local-timezone version of this bug (new Date(y, m, 1) + .getFullYear()/
  // .getMonth() are local-time, which can add/drop a month boundary versus
  // the UTC calendar months invoices.created_at is actually grouped by).
  const nowUtcYear = Number(new Date().toISOString().slice(0, 4))
  const nowUtcMonth = Number(new Date().toISOString().slice(5, 7)) - 1 // 0-indexed, matching Date.UTC's month arg
  const windowMonths: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(nowUtcYear, nowUtcMonth - i, 1))
    windowMonths.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  type Bucket = { month: string; new_customers: Set<string>; returning_customers: Set<string>; new_revenue: number; returning_revenue: number }
  const buckets = new Map<string, Bucket>(windowMonths.map((m) => [m, { month: m, new_customers: new Set(), returning_customers: new Set(), new_revenue: 0, returning_revenue: 0 }]))

  for (const inv of rows) {
    const phone = inv.customer_phone!
    const month = inv.created_at.slice(0, 7)
    const bucket = buckets.get(month)
    if (!bucket) continue // outside the requested window
    const isNewThisMonth = firstPurchaseMonth.get(phone) === month
    if (isNewThisMonth) {
      bucket.new_customers.add(phone)
      bucket.new_revenue += inv.total
    } else {
      bucket.returning_customers.add(phone)
      bucket.returning_revenue += inv.total
    }
  }

  const series = windowMonths.map((m) => {
    const b = buckets.get(m)!
    return {
      month: m,
      new_customer_count: b.new_customers.size,
      returning_customer_count: b.returning_customers.size,
      new_revenue: b.new_revenue,
      returning_revenue: b.returning_revenue,
    }
  })

  const totalNew = series.reduce((s, m) => s + m.new_customer_count, 0)
  const totalReturning = series.reduce((s, m) => s + m.returning_customer_count, 0)
  const totalRevenue = series.reduce((s, m) => s + m.new_revenue + m.returning_revenue, 0)
  const returningRevenue = series.reduce((s, m) => s + m.returning_revenue, 0)

  return NextResponse.json({
    series,
    summary: {
      total_new_customers: totalNew,
      total_returning_transactions: totalReturning,
      returning_revenue_pct: totalRevenue > 0 ? (returningRevenue / totalRevenue) * 100 : 0,
    },
    note: 'Pencocokan berbasis nomor telepon — transaksi tanpa nomor telepon tidak disertakan. "Baru" ditentukan dari pembelian pertama pelanggan tersebut sepanjang riwayat, bukan hanya dalam periode yang ditampilkan.',
  })
}
