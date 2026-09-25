import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'
import { fetchAllRows } from '@/lib/utils/fetchAll'

// GET /api/reports/tax-report?outlet_id=&start=&end= — PPN collected per
// invoice.tax_amount (already computed at sale time by create_invoice()),
// grouped by month, for the selected range (default: current calendar year,
// in UTC — resolveDateRange()'s boundaries are always UTC-safe, unlike the
// previous `now.getFullYear()` default here which read the local year).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope

  const currentYear = new Date().toISOString().slice(0, 4)
  const { startIso, endIso } = searchParams.get('start') && searchParams.get('end')
    ? resolveDateRange(searchParams)
    : resolveDateRange(new URLSearchParams({ start: `${currentYear}-01-01`, end: new Date().toISOString().slice(0, 10) }))

  // Paged: PostgREST silently caps a single request at 1000 rows, which would
  // under-report PPN for any busy year.
  let data: { created_at: string; subtotal: number; discount_amount: number; tax_amount: number; total: number }[]
  try {
    data = await fetchAllRows((from, to) =>
      auth.supabase
        .from('invoices')
        .select('created_at, subtotal, discount_amount, tax_amount, total')
        .in('outlet_id', outletIds)
        .neq('order_status', 'voided')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at')
        .range(from, to) as unknown as PromiseLike<{ data: typeof data | null; error: { message: string } | null }>
    )
  } catch (e) {
    const { status, message } = handleDatabaseError(e as Parameters<typeof handleDatabaseError>[0])
    return NextResponse.json({ error: message }, { status })
  }

  const byMonth = new Map<string, { month: string; taxable_sales: number; tax_collected: number; invoice_count: number }>()
  for (const inv of data) {
    const key = inv.created_at.slice(0, 7)
    const bucket = byMonth.get(key) ?? { month: key, taxable_sales: 0, tax_collected: 0, invoice_count: 0 }
    bucket.taxable_sales += inv.subtotal - inv.discount_amount
    bucket.tax_collected += inv.tax_amount
    bucket.invoice_count += 1
    byMonth.set(key, bucket)
  }

  const rows = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month))
  const totalTax = rows.reduce((s, r) => s + r.tax_collected, 0)
  const totalTaxableSales = rows.reduce((s, r) => s + r.taxable_sales, 0)

  return NextResponse.json({ rows, totalTax, totalTaxableSales })
}
