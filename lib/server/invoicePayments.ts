// Records one payment against an unpaid/partly-paid invoice: a settled
// payment_transactions row, the invoice status step (pending -> partial ->
// paid) and the journal (Dr Kas/Bank, Cr Piutang Usaha). Shared by the invoice
// "Terima Pembayaran" endpoint and online-order fulfilment so both book money
// identically.
//
// It always steps through 'partial' before 'paid': the settlement trigger in
// 059 books a FULL-total journal on pending -> paid, which would double-count
// with the per-payment journal written here.
import type { AuthContext } from '@/lib/utils/auth-context'
import { postJournal } from '@/lib/utils/journalPosting'

export type PaymentMethod = 'cash' | 'bank_transfer' | 'e_wallet' | 'card'

export type RecordPaymentResult =
  | { ok: true; payment_id: string; remaining: number; payment_status: 'partial' | 'paid' }
  | { ok: false; status: number; error: string }

export async function recordInvoicePayment(
  auth: AuthContext,
  params: { invoiceId: string; method: PaymentMethod; amount: number; note?: string }
): Promise<RecordPaymentResult> {
  const { invoiceId, method, amount, note } = params
  const { data: invoice } = await auth.supabase.from('invoices').select('id, outlet_id, invoice_number, total, payment_status, order_status').eq('id', invoiceId).single()
  if (!invoice) return { ok: false, status: 404, error: 'Invoice tidak ditemukan' }
  if (invoice.order_status === 'voided') return { ok: false, status: 409, error: 'Invoice ini sudah dibatalkan' }
  if (invoice.payment_status === 'paid') return { ok: false, status: 409, error: 'Invoice ini sudah lunas' }

  const { data: settled } = await auth.supabase.from('payment_transactions').select('amount').eq('invoice_id', invoiceId).eq('status', 'settled')
  const paid = (settled ?? []).reduce((s, p) => s + p.amount, 0)
  const balance = Math.round((invoice.total - paid) * 100) / 100
  if (balance <= 0) return { ok: false, status: 409, error: 'Tidak ada sisa tagihan' }
  if (amount > balance + 0.005) return { ok: false, status: 400, error: `Nominal melebihi sisa tagihan (${balance})` }

  const nowIso = new Date().toISOString()
  const { data: payment, error } = await auth.supabase
    .from('payment_transactions')
    .insert({ invoice_id: invoiceId, payment_method: method, amount, status: 'settled', payment_date: nowIso, settlement_date: nowIso, settlement_amount: amount, notes: note ? `Pelunasan piutang: ${note}` : 'Pelunasan piutang' })
    .select('id')
    .single()
  if (error || !payment) return { ok: false, status: 500, error: error?.message ?? 'Gagal mencatat pembayaran' }

  const remaining = Math.round((balance - amount) * 100) / 100
  if (invoice.payment_status === 'pending') await auth.supabase.from('invoices').update({ payment_status: 'partial' }).eq('id', invoiceId)
  if (remaining <= 0.005) await auth.supabase.from('invoices').update({ payment_status: 'paid' }).eq('id', invoiceId)

  await postJournal(auth.supabase, {
    outletId: invoice.outlet_id,
    createdBy: auth.id,
    date: nowIso.slice(0, 10),
    description: `Pelunasan piutang ${invoice.invoice_number}`,
    // Booked as 'sales' against the invoice so voiding the invoice reverses every
    // instalment too (the void trigger reverses all posted sales entries of an invoice).
    sourceType: 'sales',
    sourceId: invoiceId,
    allowMultiple: true,
    lines: [
      { code: method === 'cash' ? '1000' : '1010', debit: amount },
      { code: '1100', credit: amount },
    ],
  })

  return { ok: true, payment_id: payment.id, remaining: Math.max(0, remaining), payment_status: remaining <= 0.005 ? 'paid' : 'partial' }
}
