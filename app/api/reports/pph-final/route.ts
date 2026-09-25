import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveOutletScope } from '@/lib/utils/outletScope'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { computePphFinal, parsePphSettings } from '@/lib/utils/pphFinal'

// GET /api/reports/pph-final?year=&outlet_id= — PPh Final UMKM for one tax year:
// monthly gross turnover (subtotal minus discounts, i.e. excluding PPN; voided
// sales excluded), cumulative turnover, the part above the annual exemption, and
// the tax due. Settings (rate, exemption) live in companies.settings.tax.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope

  const year = /^\d{4}$/.test(searchParams.get('year') ?? '') ? (searchParams.get('year') as string) : new Date().toISOString().slice(0, 4)

  try {
    const [{ data: company }, invoices] = await Promise.all([
      auth.supabase.from('companies').select('settings').eq('id', auth.company_id).single(),
      fetchAllRows<{ created_at: string; subtotal: number; discount_amount: number }>((from, to) =>
        auth.supabase
          .from('invoices')
          .select('created_at, subtotal, discount_amount')
          .in('outlet_id', outletIds)
          .neq('order_status', 'voided')
          .gte('created_at', `${year}-01-01T00:00:00.000Z`)
          .lte('created_at', `${year}-12-31T23:59:59.999Z`)
          .order('created_at')
          .range(from, to) as unknown as PromiseLike<{ data: { created_at: string; subtotal: number; discount_amount: number }[] | null; error: { message: string } | null }>
      ),
    ])

    const settings = parsePphSettings(company?.settings)
    const byMonth = new Map<string, number>()
    for (let m = 1; m <= 12; m++) byMonth.set(`${year}-${String(m).padStart(2, '0')}`, 0)
    for (const inv of invoices) {
      const key = inv.created_at.slice(0, 7)
      byMonth.set(key, (byMonth.get(key) ?? 0) + inv.subtotal - inv.discount_amount)
    }

    const months = computePphFinal(Array.from(byMonth.entries()).map(([month, gross]) => ({ month, gross })), settings)
    return NextResponse.json({
      year,
      settings,
      months,
      totals: {
        gross_turnover: months.reduce((s, m) => s + m.gross_turnover, 0),
        taxable_turnover: months.reduce((s, m) => s + m.taxable_turnover, 0),
        tax_due: months.reduce((s, m) => s + m.tax_due, 0),
      },
    })
  } catch (e) {
    const { status, message } = handleDatabaseError(e as Parameters<typeof handleDatabaseError>[0])
    return NextResponse.json({ error: message }, { status })
  }
}
