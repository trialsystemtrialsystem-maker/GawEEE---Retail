import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/payments/initiate — see prd.md §4.4. Doku Pay / Bank VA credentials
// aren't wired up yet (see todo.md Phase 4), so e-wallet/bank_transfer return
// a mock QR/VA payload instead of calling the real gateway. Cash is already
// settled by create_invoice(), so this just returns its existing status.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { invoice_id, payment_method, amount } = body as {
    invoice_id: string
    payment_method: 'cash' | 'e_wallet' | 'bank_transfer' | 'card'
    amount: number
  }

  if (!invoice_id || !payment_method || typeof amount !== 'number') {
    return NextResponse.json({ error: 'invoice_id, payment_method, amount wajib diisi' }, { status: 400 })
  }

  const { data: invoice } = await auth.supabase.from('invoices').select('*').eq('id', invoice_id).single()
  if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })

  if (payment_method === 'cash') {
    const { data: payment } = await auth.supabase
      .from('payment_transactions')
      .insert({
        invoice_id,
        payment_method: 'cash',
        amount,
        status: 'settled',
        payment_date: new Date().toISOString(),
        settlement_date: new Date().toISOString(),
        settlement_amount: amount,
      })
      .select('id')
      .single()

    return NextResponse.json({
      payment_id: payment?.id ?? invoice_id,
      status: 'completed',
      cash_received: amount,
      change: 0,
    })
  }

  if (payment_method === 'e_wallet') {
    const { data: payment, error } = await auth.supabase
      .from('payment_transactions')
      .insert({
        invoice_id,
        payment_method: 'e_wallet',
        payment_provider: 'doku_pay_mock',
        amount,
        status: 'pending',
        payment_gateway_reference_id: invoice.invoice_number,
      })
      .select('id')
      .single()

    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    return NextResponse.json({
      payment_id: payment!.id,
      qr_code_data: `MOCK-QR:${invoice.invoice_number}:${amount}`,
      qr_code_image_url: null,
      payment_url: null,
      expires_in: 300,
    })
  }

  if (payment_method === 'bank_transfer') {
    const vaNumber = `${invoice.outlet_id.slice(0, 4).toUpperCase()}${invoice.invoice_number.slice(-6)}${Math.floor(
      Math.random() * 10
    )}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: va } = await auth.supabase
      .from('virtual_accounts')
      .insert({ invoice_id, va_number: vaNumber, bank: 'BCA', amount_expected: amount, expires_at: expiresAt })
      .select('id')
      .single()

    const { data: payment, error } = await auth.supabase
      .from('payment_transactions')
      .insert({
        invoice_id,
        payment_method: 'bank_transfer',
        payment_provider: 'bank_va_mock',
        amount,
        status: 'pending',
        payment_gateway_reference_id: vaNumber,
      })
      .select('id')
      .single()

    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    return NextResponse.json({
      payment_id: payment!.id,
      virtual_account_id: va?.id,
      virtual_account_number: vaNumber,
      account_name: 'PT Berkah Purnama Sewu',
      bank_code: 'BCA',
      expires_in: 86400,
    })
  }

  return NextResponse.json({ error: 'Metode pembayaran belum didukung' }, { status: 400 })
}
