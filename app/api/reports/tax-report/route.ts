import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/reports/tax-report?outlet_id=&start=&end= — PPN collected per
// invoice.tax_amount (already computed at sale time by create_invoice()),
// grouped by month, for the selected range (default: current calendar year).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const now = new Date()
  const start = searchParams.get('start') ?? `${now.getFullYear()}-01-01`
  const end = searchParams.get('end') ?? now.toISOString().slice(0, 10)

  const { data, error } = await auth.supabase
    .from('invoices')
    .select('created_at, subtotal, discount_amount, tax_amount, total')
    .eq('outlet_id', outletId)
    .neq('order_status', 'voided')
    .gte('created_at', `${start}T00:00:00`)
    .lte('created_at', `${end}T23:59:59`)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const byMonth = new Map<string, { month: string; taxable_sales: number; tax_collected: number; invoice_count: number }>()
  for (const inv of data ?? []) {
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
