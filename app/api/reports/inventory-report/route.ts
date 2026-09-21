import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveOutletScope } from '@/lib/utils/outletScope'

// GET /api/reports/inventory-report?outlet_id= — wraps v_inventory_valuation
// (already used by Phase 1's inventory-valuation logic) as its own report.
// A point-in-time snapshot (current stock), so no date range applies here —
// only the outlet scope (outlet_id=all sums every outlet in the company).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scopeResult = await resolveOutletScope(auth, request.nextUrl.searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope

  const { data, error } = await auth.supabase
    .from('v_inventory_valuation')
    .select('*')
    .in('outlet_id', outletIds)
    .order('retail_value', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const totals = (data ?? []).reduce(
    (acc, r) => ({
      cost_value: acc.cost_value + r.cost_value,
      retail_value: acc.retail_value + r.retail_value,
      potential_profit: acc.potential_profit + r.potential_profit,
    }),
    { cost_value: 0, retail_value: 0, potential_profit: 0 }
  )

  return NextResponse.json({ items: data, totals })
}
