import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/purchase-orders/:id/receipts — every goods receipt booked against
// the PO, straight from the stock ledger (so it can never disagree with stock).
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/purchase-orders/[id]/receipts'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const { data, error } = await auth.supabase
    .from('inventory_ledger')
    .select('id, quantity_change, unit_cost, batch_number, expiry_date, created_at, products(name, sku), users:recorded_by(full_name)')
    .eq('reference_type', 'purchase_order')
    .eq('reference_id', id)
    .order('created_at', { ascending: false })
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  type Row = { id: string; quantity_change: number; unit_cost: number | null; batch_number: string | null; expiry_date: string | null; created_at: string; products: { name: string; sku: string } | { name: string; sku: string }[] | null; users: { full_name: string | null } | { full_name: string | null }[] | null }
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v)
  return NextResponse.json({
    receipts: ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      quantity: r.quantity_change,
      unit_cost: r.unit_cost,
      batch_number: r.batch_number,
      expiry_date: r.expiry_date,
      received_at: r.created_at,
      product_name: one(r.products)?.name ?? '-',
      sku: one(r.products)?.sku ?? '',
      received_by: one(r.users)?.full_name ?? null,
    })),
  })
}
