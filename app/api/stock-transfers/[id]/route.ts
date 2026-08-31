import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/stock-transfers/:id — transfer + its line items.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/stock-transfers/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: transfer, error: transferError } = await auth.supabase
    .from('stock_transfers')
    .select('*, source:outlets!stock_transfers_source_outlet_id_fkey(name), destination:outlets!stock_transfers_destination_outlet_id_fkey(name)')
    .eq('id', id)
    .single()

  if (transferError) {
    const { status, message } = handleDatabaseError(transferError)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: items, error: itemsError } = await auth.supabase
    .from('stock_transfer_items')
    .select('*, products(name)')
    .eq('transfer_id', id)

  if (itemsError) {
    const { status, message } = handleDatabaseError(itemsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ transfer, items })
}
