import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/coupon-redemptions?coupon_id= — the actual transactions a coupon
// was used on, not just its aggregate usage_count. See
// 062_sales_identification.sql.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const couponId = request.nextUrl.searchParams.get('coupon_id')
  if (!couponId) return NextResponse.json({ error: 'coupon_id wajib diisi' }, { status: 400 })

  const { data: coupon } = await auth.supabase.from('coupons').select('outlet_id').eq('id', couponId).maybeSingle()
  if (!coupon || !canAccessOutlet(auth, coupon.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('coupon_redemptions')
    .select('id, discount_amount, created_at, invoices(invoice_number, total, order_status)')
    .eq('coupon_id', couponId)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ redemptions: data })
}
