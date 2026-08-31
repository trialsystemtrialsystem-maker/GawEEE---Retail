import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/coupons/redeem { outlet_id, code } — validates a coupon code
// (active, not expired, under its usage limit) and increments usage_count.
// Called by staff at checkout when a customer presents a coupon code.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const outletId = body.outlet_id as string | undefined
  const code = (body.code as string | undefined)?.trim().toUpperCase()
  if (!outletId || !code) return NextResponse.json({ error: 'outlet_id dan code wajib diisi' }, { status: 400 })
  if (!canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: coupon, error } = await auth.supabase
    .from('coupons')
    .select('*')
    .eq('outlet_id', outletId)
    .ilike('code', code)
    .single()

  if (error || !coupon) {
    return NextResponse.json({ error: 'Kode kupon tidak ditemukan' }, { status: 404 })
  }
  if (!coupon.is_active) return NextResponse.json({ error: 'Kupon tidak aktif' }, { status: 400 })
  if (coupon.expires_at && coupon.expires_at < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'Kupon sudah kadaluarsa' }, { status: 400 })
  }
  if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
    return NextResponse.json({ error: 'Kupon sudah mencapai batas penggunaan' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await auth.supabase
    .from('coupons')
    .update({ usage_count: coupon.usage_count + 1 })
    .eq('id', coupon.id)
    .select()
    .single()

  if (updateError) {
    const { status, message } = handleDatabaseError(updateError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ coupon: updated })
}
