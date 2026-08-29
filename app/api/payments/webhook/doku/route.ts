import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/payments/webhook/doku — server-to-server callback. See prd.md §5.1.
// Uses the service-role client (no end-user session exists for a webhook
// call) and instead authenticates the *caller* via HMAC signature. Not yet
// reachable in practice: DOKU_SECRET_KEY isn't provisioned (todo.md Phase 4).
export async function POST(request: NextRequest) {
  const secret = process.env.DOKU_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: 'Doku Pay belum dikonfigurasi' }, { status: 501 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-signature') ?? ''

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  const signatureValid =
    signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as { order_id: string; status: 'COMPLETED' | 'FAILED'; amount: number }
  const admin = createAdminClient()

  const { data: payment } = await admin
    .from('payment_transactions')
    .select('*')
    .eq('payment_gateway_reference_id', body.order_id)
    .single()

  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  if (body.status === 'COMPLETED') {
    await admin
      .from('payment_transactions')
      .update({ status: 'settled', settlement_date: new Date().toISOString(), settlement_amount: body.amount })
      .eq('id', payment.id)
    await admin.from('invoices').update({ payment_status: 'paid' }).eq('id', payment.invoice_id)
  } else {
    await admin.from('payment_transactions').update({ status: 'failed' }).eq('id', payment.id)
  }

  return NextResponse.json({ status: 'received' })
}
