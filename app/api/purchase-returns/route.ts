import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createPurchaseReturnSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/purchase-returns?outlet_id=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('purchase_returns')
    .select('*, suppliers(name)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ returns: data })
}

// POST /api/purchase-returns — manager+ only. Creates a draft return with
// its line items (mirrors the journal-entry creation shape) — not yet
// applied to inventory until /submit.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(createPurchaseReturnSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { items, ...returnFields } = result.data

  const { data: purchaseReturn, error } = await auth.supabase
    .from('purchase_returns')
    .insert({ ...returnFields, created_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const { error: itemsError } = await auth.supabase
    .from('purchase_return_items')
    .insert(items.map((i) => ({ ...i, return_id: purchaseReturn.id })))

  if (itemsError) {
    const { status, message } = handleDatabaseError(itemsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ purchase_return: purchaseReturn }, { status: 201 })
}
