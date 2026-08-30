import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/purchase-orders/:id — PO detail with line items (not in the
// original prd.md §4.5 list, but needed by the receive-goods UI to know
// what's still outstanding per line).
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/purchase-orders/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data: po, error } = await auth.supabase.from('purchase_orders').select('*, suppliers(name)').eq('id', id).single()
  if (error || !po) return NextResponse.json({ error: 'Purchase order tidak ditemukan' }, { status: 404 })

  const { data: items } = await auth.supabase
    .from('po_items')
    .select('*, products(name, sku)')
    .eq('po_id', id)

  return NextResponse.json({ purchase_order: po, items: items ?? [] })
}

// PUT /api/purchase-orders/:id — update a draft PO. See prd.md §4.5.
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/purchase-orders/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()

  const { data, error } = await auth.supabase
    .from('purchase_orders')
    .update(body)
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ po: data })
}
