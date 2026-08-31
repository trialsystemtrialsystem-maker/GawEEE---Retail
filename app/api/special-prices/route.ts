import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, specialPriceSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/special-prices?outlet_id=&group_id= — used both by the settings
// page (list all) and by POS checkout (look up a group's override prices).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const groupId = searchParams.get('group_id')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  let query = auth.supabase
    .from('special_prices')
    .select('*, customer_groups(name), products(name)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (groupId) query = query.eq('group_id', groupId)

  const { data, error } = await query
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ special_prices: data })
}

// POST /api/special-prices — manager+ only.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(specialPriceSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('special_prices')
    .upsert({ ...result.data, created_by: auth.id }, { onConflict: 'group_id,product_id' })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ special_price: data }, { status: 201 })
}
