import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/customers/:id/loyalty — point balance + ledger history.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/customers/[id]/loyalty'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data, error } = await auth.supabase
    .from('loyalty_ledger')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const balance = (data ?? []).reduce((s, r) => s + r.points_change, 0)
  return NextResponse.json({ ledger: data, balance })
}
