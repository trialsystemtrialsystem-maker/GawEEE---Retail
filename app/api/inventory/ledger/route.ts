import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { handleDatabaseError } from '@/lib/utils/errors'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { runningBalances } from '@/lib/utils/inventoryAnalytics'

type Row = {
  id: string
  product_id: string
  movement_type: string
  quantity_change: number
  unit_cost: number | null
  reference_type: string | null
  notes: string | null
  batch_number: string | null
  expiry_date: string | null
  created_at: string
  products: { name: string; sku: string } | { name: string; sku: string }[] | null
  users: { full_name: string | null } | { full_name: string | null }[] | null
}

// GET /api/inventory/ledger?outlet_id=&product_id=&start=&end=&type= — kartu
// stok. With a product_id each row carries the running balance (derived from
// the current stock backwards, so it is right even if history predates the
// counter); without one it is the outlet-wide movement log.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const productId = searchParams.get('product_id')
  const type = searchParams.get('type')
  const { startIso, endIso } = resolveDateRange(searchParams, 30, 3650)

  try {
    // For the running balance we need every movement AFTER the window start up
    // to now (newest first); the window filter is applied afterwards.
    const all = await fetchAllRows<Row>((from, to) => {
      let q = auth.supabase
        .from('inventory_ledger')
        .select('id, product_id, movement_type, quantity_change, unit_cost, reference_type, notes, batch_number, expiry_date, created_at, products(name, sku), users:recorded_by(full_name)')
        .eq('outlet_id', outletId)
        .gte('created_at', startIso)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
      if (productId) q = q.eq('product_id', productId)
      return q as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
    }, 1000, 10)

    let rows: (Row & { balance?: number })[] = all
    if (productId) {
      const { data: inv } = await auth.supabase.from('inventory').select('quantity_on_hand').eq('outlet_id', outletId).eq('product_id', productId).maybeSingle()
      rows = runningBalances(all, inv?.quantity_on_hand ?? 0)
    }

    const inWindow = rows.filter((r) => r.created_at <= endIso && (!type || r.movement_type === type))
    const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v)
    const entries = inWindow.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      product_name: one(r.products)?.name ?? '-',
      sku: one(r.products)?.sku ?? '',
      movement_type: r.movement_type,
      quantity_change: r.quantity_change,
      unit_cost: r.unit_cost,
      value: r.unit_cost !== null ? Math.abs(r.quantity_change) * r.unit_cost : null,
      reference_type: r.reference_type,
      notes: r.notes,
      batch_number: r.batch_number,
      expiry_date: r.expiry_date,
      created_at: r.created_at,
      recorded_by: one(r.users)?.full_name ?? null,
      balance: r.balance ?? null,
    }))

    return NextResponse.json({
      entries,
      total_in: entries.filter((e) => e.quantity_change > 0).reduce((s, e) => s + e.quantity_change, 0),
      total_out: entries.filter((e) => e.quantity_change < 0).reduce((s, e) => s + -e.quantity_change, 0),
    })
  } catch (e) {
    const { status, message } = handleDatabaseError(e as Parameters<typeof handleDatabaseError>[0])
    return NextResponse.json({ error: message }, { status })
  }
}
