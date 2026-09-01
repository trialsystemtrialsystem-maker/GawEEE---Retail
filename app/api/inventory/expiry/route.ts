import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/inventory/expiry?outlet_id= — lists received batches that carry
// an expiry_date (captured at PO receiving — see Phase 11 plan item 11).
// Deliberately NOT remaining-quantity-per-batch (that needs full lot
// tracking, out of scope) — just visibility into what was received and
// when it expires, ordered soonest-first.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('inventory_ledger')
    .select('id, product_id, batch_number, expiry_date, quantity_change, created_at, products(name, sku)')
    .eq('outlet_id', outletId)
    .not('expiry_date', 'is', null)
    .order('expiry_date', { ascending: true })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ batches: data })
}
