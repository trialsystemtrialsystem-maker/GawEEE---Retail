import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, stocktakeCountSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/stocktakes/:id — session + line items with product names.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/stocktakes/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: stocktake, error: stError } = await auth.supabase.from('stocktakes').select('*').eq('id', id).single()
  if (stError) {
    const { status, message } = handleDatabaseError(stError)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: details, error: detailsError } = await auth.supabase
    .from('stocktake_details')
    .select('*, products(name, sku)')
    .eq('stocktake_id', id)
    .order('created_at')

  if (detailsError) {
    const { status, message } = handleDatabaseError(detailsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ stocktake, details })
}

// PATCH /api/stocktakes/:id — bulk-update counted_quantity for line items
// (staff entering physical counts). Only allowed while the session is open.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/stocktakes/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  const result = validate(stocktakeCountSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: stocktake } = await auth.supabase.from('stocktakes').select('status').eq('id', id).single()
  if (stocktake?.status === 'completed' || stocktake?.status === 'approved') {
    return NextResponse.json({ error: 'Stocktake ini sudah diselesaikan' }, { status: 400 })
  }

  for (const c of result.data.counts) {
    const { error } = await auth.supabase
      .from('stocktake_details')
      .update({ counted_quantity: c.counted_quantity })
      .eq('id', c.detail_id)
      .eq('stocktake_id', id)
    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }
  }

  return NextResponse.json({ success: true })
}
