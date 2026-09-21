import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { earnLoyaltyPoints } from '@/lib/utils/loyalty'

// POST /api/payments/:payment_id/simulate-success — Phase 1 demo-only stand-in
// for the real Doku Pay / Bank VA webhook (todo.md Phase 4, blocked on real
// gateway credentials). Lets the POS UI walk through the full e-wallet/bank
// transfer flow today. Remove once app/api/payments/webhook/{doku,bank} are
// live against real sandbox credentials.
export async function POST(_request: Request, ctx: RouteContext<'/api/payments/[paymentId]/simulate-success'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { paymentId } = await ctx.params
  const { data: payment } = await auth.supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (!payment) return NextResponse.json({ error: 'Pembayaran tidak ditemukan' }, { status: 404 })

  // A manager can void a sale within 24h while its digital payment is still
  // pending (void_invoice(), see todo.md Phase 23's void-reversal follow-up)
  // — without this check, confirming that stale payment afterward would
  // flip a voided invoice's payment_status back to 'paid' and award loyalty
  // points for a sale that no longer exists.
  const { data: invoiceForVoidCheck } = await auth.supabase.from('invoices').select('order_status').eq('id', payment.invoice_id).maybeSingle()
  if (invoiceForVoidCheck?.order_status === 'voided') {
    return NextResponse.json({ error: 'Invoice ini sudah dibatalkan' }, { status: 409 })
  }

  await auth.supabase
    .from('payment_transactions')
    .update({ status: 'settled', settlement_date: new Date().toISOString(), settlement_amount: payment.amount })
    .eq('id', paymentId)

  await auth.supabase.from('invoices').update({ payment_status: 'paid' }).eq('id', payment.invoice_id)
  await earnLoyaltyPoints(auth.supabase, payment.invoice_id)

  return NextResponse.json({ status: 'settled' })
}
