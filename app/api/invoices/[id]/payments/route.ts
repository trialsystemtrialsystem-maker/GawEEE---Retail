import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { recordInvoicePayment } from '@/lib/server/invoicePayments'

const schema = z.object({
  payment_method: z.enum(['cash', 'bank_transfer', 'e_wallet', 'card']),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  note: z.string().trim().max(200).optional(),
})

// POST /api/invoices/:id/payments — collect (part of) what a customer still
// owes on a pay-later / partly-paid invoice. The mechanics (settled payment row,
// pending -> partial -> paid, Dr Kas/Bank / Cr Piutang journal) live in
// lib/server/invoicePayments.ts so online-order fulfilment books money the same way.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/invoices/[id]/payments'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: invoice } = await auth.supabase.from('invoices').select('outlet_id').eq('id', id).single()
  if (!invoice || !canAccessOutlet(auth, invoice.outlet_id)) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })

  const r = await recordInvoicePayment(auth, { invoiceId: id, method: result.data.payment_method, amount: result.data.amount, note: result.data.note })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ payment_id: r.payment_id, remaining: r.remaining, payment_status: r.payment_status }, { status: 201 })
}
