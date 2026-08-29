import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/payments/:payment_id/status — see prd.md §4.4
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/payments/[paymentId]/status'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { paymentId } = await ctx.params
  const { data: payment, error } = await auth.supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (error || !payment) {
    return NextResponse.json({ error: 'Pembayaran tidak ditemukan' }, { status: 404 })
  }

  return NextResponse.json({
    payment_id: payment.id,
    status: payment.status,
    amount: payment.amount,
    settlement_amount: payment.settlement_amount,
    gateway_fee: payment.gateway_fee,
    settled_at: payment.settlement_date,
  })
}
