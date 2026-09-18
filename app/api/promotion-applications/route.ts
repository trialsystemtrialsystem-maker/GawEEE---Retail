import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/promotion-applications?promotion_id= — the actual transactions a
// promotion was applied to. See 063_loyalty_and_promotion_completion.sql.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const promotionId = request.nextUrl.searchParams.get('promotion_id')
  if (!promotionId) return NextResponse.json({ error: 'promotion_id wajib diisi' }, { status: 400 })

  const { data: promotion } = await auth.supabase.from('promotions').select('outlet_id').eq('id', promotionId).maybeSingle()
  if (!promotion || !canAccessOutlet(auth, promotion.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('promotion_applications')
    .select('id, discount_amount, created_at, invoices(invoice_number, total, order_status)')
    .eq('promotion_id', promotionId)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ applications: data })
}
