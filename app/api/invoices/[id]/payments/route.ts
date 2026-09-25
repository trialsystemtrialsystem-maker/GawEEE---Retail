import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { postJournal } from '@/lib/utils/journalPosting'

const schema = z.object({
  payment_method: z.enum(['cash', 'bank_transfer', 'e_wallet', 'card']),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  note: z.string().trim().max(200).optional(),
})

// POST /api/invoices/:id/payments — collect (part of) what a customer still
// owes on a pay-later / partly-paid invoice. Records a settled
// payment_transactions row, journals it (Dr Kas or Bank / Cr Piutang Usaha)
// and moves the invoice pending -> partial -> paid. It always steps through
// 'partial' before 'paid' on purpose: the settlement trigger in 059 books a
// FULL-total settlement journal on pending -> paid, which would double-count
// with the per-payment journal written here.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/invoices/[id]/payments'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { payment_method, amount, note } = result.data

  const { data: invoice } = await auth.supabase.from('invoices').select('id, outlet_id, invoice_number, total, payment_status, order_status').eq('id', id).single()
  if (!invoice || !canAccessOutlet(auth, invoice.outlet_id)) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
  if (invoice.order_status === 'voided') return NextResponse.json({ error: 'Invoice ini sudah dibatalkan' }, { status: 409 })
  if (invoice.payment_status === 'paid') return NextResponse.json({ error: 'Invoice ini sudah lunas' }, { status: 409 })

  const { data: settled } = await auth.supabase.from('payment_transactions').select('amount').eq('invoice_id', id).eq('status', 'settled')
  const paid = (settled ?? []).reduce((s, p) => s + p.amount, 0)
  const balance = Math.round((invoice.total - paid) * 100) / 100
  if (balance <= 0) return NextResponse.json({ error: 'Tidak ada sisa tagihan' }, { status: 409 })
  if (amount > balance + 0.005) return NextResponse.json({ error: `Nominal melebihi sisa tagihan (${balance})` }, { status: 400 })

  const nowIso = new Date().toISOString()
  const { data: payment, error } = await auth.supabase
    .from('payment_transactions')
    .insert({ invoice_id: id, payment_method, amount, status: 'settled', payment_date: nowIso, settlement_date: nowIso, settlement_amount: amount, notes: note ? `Pelunasan piutang: ${note}` : 'Pelunasan piutang' })
    .select('id')
    .single()
  if (error || !payment) {
    const { status, message } = handleDatabaseError(error ?? { message: 'Gagal mencatat pembayaran' })
    return NextResponse.json({ error: message }, { status })
  }

  const remaining = Math.round((balance - amount) * 100) / 100
  if (invoice.payment_status === 'pending') await auth.supabase.from('invoices').update({ payment_status: 'partial' }).eq('id', id)
  if (remaining <= 0.005) await auth.supabase.from('invoices').update({ payment_status: 'paid' }).eq('id', id)

  await postJournal(auth.supabase, {
    outletId: invoice.outlet_id,
    createdBy: auth.id,
    date: nowIso.slice(0, 10),
    description: `Pelunasan piutang ${invoice.invoice_number}`,
    // Booked as 'sales' against the invoice so voiding the invoice reverses every
    // instalment too (the void trigger reverses all posted sales entries of an invoice).
    sourceType: 'sales',
    sourceId: id,
    allowMultiple: true,
    lines: [
      { code: payment_method === 'cash' ? '1000' : '1010', debit: amount },
      { code: '1100', credit: amount },
    ],
  })

  return NextResponse.json({ payment_id: payment.id, remaining: Math.max(0, remaining), payment_status: remaining <= 0.005 ? 'paid' : 'partial' }, { status: 201 })
}
