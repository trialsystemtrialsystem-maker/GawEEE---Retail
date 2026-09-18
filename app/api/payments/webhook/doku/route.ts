import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { earnLoyaltyPoints } from '@/lib/utils/loyalty'

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
    await earnLoyaltyPoints(admin, payment.invoice_id)
  } else {
    await admin.from('payment_transactions').update({ status: 'failed' }).eq('id', payment.id)

    // system_alerts (006_hr_ops.sql) was defined with 'payment_failed' as one
    // of its documented alert_type values but nothing ever actually inserted
    // one — GET /api/notifications already reads and renders unresolved
    // alerts generically, this was just missing the write side.
    const { data: invoice } = await admin.from('invoices').select('outlet_id, invoice_number, total').eq('id', payment.invoice_id).maybeSingle()
    if (invoice) {
      await admin.from('system_alerts').insert({
        outlet_id: invoice.outlet_id,
        alert_type: 'payment_failed',
        severity: 'warning',
        title: `Pembayaran e-wallet gagal — ${invoice.invoice_number}`,
        description: `Doku Pay melaporkan status gagal untuk invoice senilai Rp${invoice.total.toLocaleString('id-ID')}.`,
        reference_entity_type: 'payment',
        reference_entity_id: payment.id,
      })
    }
  }

  return NextResponse.json({ status: 'received' })
}
