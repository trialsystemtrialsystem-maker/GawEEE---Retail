import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/products/:id/history — every purchase/selling price change (old ->
// new, by whom, when), newest first. Recorded by a DB trigger, so it covers
// edits, bulk changes and imports alike.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/products/[id]/history'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const { data, error } = await auth.supabase
    .from('product_price_changes')
    .select('id, old_purchase_price, new_purchase_price, old_selling_price, new_selling_price, changed_at, users:changed_by(full_name)')
    .eq('product_id', id)
    .eq('company_id', auth.company_id)
    .order('changed_at', { ascending: false })
    .limit(100)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  type Row = { id: string; old_purchase_price: number | null; new_purchase_price: number | null; old_selling_price: number | null; new_selling_price: number | null; changed_at: string; users: { full_name: string | null } | { full_name: string | null }[] | null }
  return NextResponse.json({
    changes: ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, changed_by_name: (Array.isArray(r.users) ? r.users[0] : r.users)?.full_name ?? null, users: undefined })),
  })
}
