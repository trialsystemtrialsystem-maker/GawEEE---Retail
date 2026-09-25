import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, promotionSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { selectAll } from '@/lib/utils/fetchAll'

// GET /api/promotions?outlet_id= — used both by the settings page and by
// POS checkout (to list currently-active promotions a cashier can apply).
// Each row carries usage stats from promotion_applications (voided invoices
// excluded) so managers can see what a promotion actually cost.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('promotions')
    .select('*')
    .eq('outlet_id', outletId)
    .order('start_date', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: apps } = await selectAll(
    auth.supabase.from('promotion_applications').select('promotion_id, discount_amount, invoices(order_status)').eq('outlet_id', outletId)
  )
  const stats = new Map<string, { uses: number; total_discount: number }>()
  for (const a of (apps ?? []) as unknown as { promotion_id: string; discount_amount: number; invoices: { order_status: string } | null }[]) {
    if (a.invoices?.order_status === 'voided') continue
    const s = stats.get(a.promotion_id) ?? { uses: 0, total_discount: 0 }
    s.uses += 1
    s.total_discount += Number(a.discount_amount)
    stats.set(a.promotion_id, s)
  }

  return NextResponse.json({
    promotions: (data ?? []).map((p) => ({ ...p, uses: stats.get(p.id)?.uses ?? 0, total_discount: stats.get(p.id)?.total_discount ?? 0 })),
  })
}

// POST /api/promotions — manager+ only.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(promotionSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase.from('promotions').insert({ ...result.data, created_by: auth.id }).select().single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ promotion: data }, { status: 201 })
}
