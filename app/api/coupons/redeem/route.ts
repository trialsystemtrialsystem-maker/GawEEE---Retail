import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { promoDiscount } from '@/lib/utils/promoRules'

// POST /api/coupons/redeem { outlet_id, code, subtotal } — VALIDATES a coupon
// code at cart-build time (active, started, not expired, under its usage
// limit, minimum purchase met) and returns the discount it grants. It does
// NOT consume a use: usage_count is incremented by POST /api/invoices when a
// sale actually completes (and decremented again on void), so a coupon typed
// into a cart that is later abandoned is not burned.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const outletId = body.outlet_id as string | undefined
  const code = (body.code as string | undefined)?.trim().toUpperCase()
  const subtotal = Number(body.subtotal) || 0
  if (!outletId || !code) return NextResponse.json({ error: 'outlet_id dan code wajib diisi' }, { status: 400 })
  if (!canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: coupon, error } = await auth.supabase.from('coupons').select('*').eq('outlet_id', outletId).ilike('code', code).single()

  if (error || !coupon) {
    return NextResponse.json({ error: 'Kode kupon tidak ditemukan' }, { status: 404 })
  }
  const today = new Date().toISOString().slice(0, 10)
  if (!coupon.is_active) return NextResponse.json({ error: 'Kupon tidak aktif' }, { status: 400 })
  if (coupon.starts_at && coupon.starts_at > today) return NextResponse.json({ error: 'Kupon belum berlaku' }, { status: 400 })
  if (coupon.expires_at && coupon.expires_at < today) return NextResponse.json({ error: 'Kupon sudah kadaluarsa' }, { status: 400 })
  if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
    return NextResponse.json({ error: 'Kupon sudah mencapai batas penggunaan' }, { status: 400 })
  }

  const outcome = promoDiscount(coupon, subtotal)
  if (!outcome.ok) return NextResponse.json({ error: outcome.reason }, { status: 400 })

  return NextResponse.json({ coupon, amount: outcome.amount })
}
