import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/payments/initiate — see prd.md §4.4. Doku Pay / Bank VA credentials
// aren't wired up yet (see todo.md Phase 4), so e-wallet/bank_transfer return
// a mock QR/VA payload instead of calling the real gateway. Cash is already
// settled by create_invoice(), so this just returns its existing status.
//
// Accepts `payments: [{payment_method, amount}, ...]` — one row per line, so
// a sale split across methods (e.g. partly cash, partly QRIS) inserts one
// payment_transactions row per line instead of forcing the whole invoice
// onto a single method (Phase 11 plan item 9). Scoped down deliberately: at
// most one non-cash line per checkout, since each pending method needs its
// own QR/VA confirmation step in the POS UI — a real cashier splitting a
// sale across two *different* digital wallets in one transaction is not a
// realistic case worth the added UI complexity here.
interface PaymentLine {
  payment_method: 'cash' | 'e_wallet' | 'bank_transfer' | 'card'
  amount: number
}
interface PaymentLineResult {
  payment_method: string
  payment_id: string
  status: 'completed' | 'pending'
  cash_received?: number
  change?: number
  qr_code_data?: string
  qr_code_image_url?: string | null
  payment_url?: string | null
  virtual_account_id?: string
  virtual_account_number?: string
  account_name?: string
  bank_code?: string
  expires_in?: number
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { invoice_id, payments } = body as { invoice_id: string; payments: PaymentLine[] }

  if (!invoice_id || !Array.isArray(payments) || payments.length === 0) {
    return NextResponse.json({ error: 'invoice_id dan payments wajib diisi' }, { status: 400 })
  }
  for (const line of payments) {
    if (!line.payment_method || typeof line.amount !== 'number' || line.amount <= 0) {
      return NextResponse.json({ error: 'Setiap baris pembayaran wajib punya payment_method dan amount > 0' }, { status: 400 })
    }
  }
  const nonCashLines = payments.filter((p) => p.payment_method !== 'cash')
  if (nonCashLines.length > 1) {
    return NextResponse.json({ error: 'Split pembayaran hanya mendukung maksimal 1 metode non-tunai' }, { status: 400 })
  }

  const { data: invoice } = await auth.supabase.from('invoices').select('*').eq('id', invoice_id).single()
  if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  if (Math.round(totalPaid) !== Math.round(invoice.total)) {
    return NextResponse.json({ error: `Total pembayaran (${totalPaid}) tidak sama dengan total invoice (${invoice.total})` }, { status: 400 })
  }

  const results: PaymentLineResult[] = []

  for (const line of payments) {
    if (line.payment_method === 'cash') {
      const { data: payment, error } = await auth.supabase
        .from('payment_transactions')
        .insert({
          invoice_id,
          payment_method: 'cash',
          amount: line.amount,
          status: 'settled',
          payment_date: new Date().toISOString(),
          settlement_date: new Date().toISOString(),
          settlement_amount: line.amount,
        })
        .select('id')
        .single()
      if (error) {
        const { status, message } = handleDatabaseError(error)
        return NextResponse.json({ error: message }, { status })
      }
      results.push({ payment_method: 'cash', payment_id: payment!.id, status: 'completed', cash_received: line.amount, change: 0 })
      continue
    }

    if (line.payment_method === 'e_wallet') {
      const { data: payment, error } = await auth.supabase
        .from('payment_transactions')
        .insert({
          invoice_id,
          payment_method: 'e_wallet',
          payment_provider: 'doku_pay_mock',
          amount: line.amount,
          status: 'pending',
          payment_gateway_reference_id: invoice.invoice_number,
        })
        .select('id')
        .single()
      if (error) {
        const { status, message } = handleDatabaseError(error)
        return NextResponse.json({ error: message }, { status })
      }
      results.push({
        payment_method: 'e_wallet',
        payment_id: payment!.id,
        status: 'pending',
        qr_code_data: `MOCK-QR:${invoice.invoice_number}:${line.amount}`,
        qr_code_image_url: null,
        payment_url: null,
        expires_in: 300,
      })
      continue
    }

    if (line.payment_method === 'bank_transfer') {
      const vaNumber = `${invoice.outlet_id.slice(0, 4).toUpperCase()}${invoice.invoice_number.slice(-6)}${Math.floor(
        Math.random() * 10
      )}`
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const { data: va } = await auth.supabase
        .from('virtual_accounts')
        .insert({ invoice_id, va_number: vaNumber, bank: 'BCA', amount_expected: line.amount, expires_at: expiresAt })
        .select('id')
        .single()

      const { data: payment, error } = await auth.supabase
        .from('payment_transactions')
        .insert({
          invoice_id,
          payment_method: 'bank_transfer',
          payment_provider: 'bank_va_mock',
          amount: line.amount,
          status: 'pending',
          payment_gateway_reference_id: vaNumber,
        })
        .select('id')
        .single()
      if (error) {
        const { status, message } = handleDatabaseError(error)
        return NextResponse.json({ error: message }, { status })
      }
      results.push({
        payment_method: 'bank_transfer',
        payment_id: payment!.id,
        status: 'pending',
        virtual_account_id: va?.id,
        virtual_account_number: vaNumber,
        account_name: 'PT Berkah Purnama Sewu',
        bank_code: 'BCA',
        expires_in: 86400,
      })
      continue
    }

    return NextResponse.json({ error: 'Metode pembayaran belum didukung' }, { status: 400 })
  }

  return NextResponse.json({ payments: results })
}
