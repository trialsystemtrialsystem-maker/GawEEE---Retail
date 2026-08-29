import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/payments/webhook/bank — bank VA transfer callback. See prd.md §5.2.
// Not yet reachable in practice: BANK_VA_SECRET isn't provisioned (todo.md Phase 4).
export async function POST(request: NextRequest) {
  const secret = process.env.BANK_VA_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Bank VA belum dikonfigurasi' }, { status: 501 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-bank-signature') ?? ''

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  const signatureValid =
    signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as { virtual_account: string; amount_received: number }
  const admin = createAdminClient()

  const { data: va } = await admin
    .from('virtual_accounts')
    .select('*, invoices(id, total)')
    .eq('va_number', body.virtual_account)
    .single()

  if (!va) return NextResponse.json({ error: 'Virtual account not found' }, { status: 404 })

  const invoice = (va as unknown as { invoices: { id: string; total: number } }).invoices

  if (body.amount_received >= invoice.total) {
    await admin
      .from('payment_transactions')
      .update({ status: 'settled', settlement_date: new Date().toISOString(), settlement_amount: body.amount_received })
      .eq('invoice_id', va.invoice_id)
    await admin.from('invoices').update({ payment_status: 'paid' }).eq('id', va.invoice_id)
    await admin.from('virtual_accounts').update({ status: 'paid' }).eq('id', va.id)
  } else {
    await admin
      .from('payment_transactions')
      .update({ status: 'processing', settlement_amount: body.amount_received })
      .eq('invoice_id', va.invoice_id)
  }

  return NextResponse.json({ status: 'received' })
}
