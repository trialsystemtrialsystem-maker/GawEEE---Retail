import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { canTransition } from '@/lib/utils/onlineOrders'
import { recordInvoicePayment } from '@/lib/server/invoicePayments'
import type { OnlineOrder } from '@/lib/types/database.types'

const schema = z.object({
  status: z.enum(['incoming', 'on_process', 'on_delivery', 'completed', 'cancelled']),
  // Cancelling asks for a reason; completing can confirm cash-on-delivery payment.
  reason: z.string().trim().max(200).optional(),
  paid: z.boolean().optional(),
  courier: z.string().trim().max(60).optional(),
  tracking_number: z.string().trim().max(100).optional(),
})

// PATCH /api/online-orders/:id/status — validates the transition, then does the
// business side of it:
//  * -> on_process : when every line is linked to a catalog product, creates the
//    real invoice through create_invoice() (stock deducted, revenue + journals),
//    honouring the ordered price as a discount (never a markup — same rule as
//    sales-order fulfilment). A prepaid order is settled right away. Lines that
//    are free text cannot be stocked, so the order moves on without an invoice
//    and says so.
//  * -> on_delivery: stores courier / tracking number.
//  * -> completed  : records the COD payment when the courier collected it.
//  * -> cancelled  : voids the invoice (stock returns) and stores the reason.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/online-orders/[id]/status'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { status: target, reason, paid, courier, tracking_number } = result.data

  const { id } = await ctx.params
  const { data: order, error: fetchError } = await auth.supabase.from('online_orders').select('*').eq('id', id).single()
  if (fetchError || !order) {
    const { status, message } = handleDatabaseError(fetchError ?? { message: 'Pesanan tidak ditemukan' })
    return NextResponse.json({ error: message }, { status })
  }

  if (!canTransition(order.status, target)) {
    return NextResponse.json({ error: `Tidak bisa mengubah status dari "${order.status}" ke "${target}"` }, { status: 400 })
  }

  const patch: Partial<OnlineOrder> = { status: target }
  let invoiceNote: string | null = null
  let invoiceId: string | null = order.invoice_id

  if (target === 'on_process' && !invoiceId) {
    const lines = order.items as { product_id?: string; name: string; quantity: number; price: number }[]
    if (lines.every((l) => l.product_id)) {
      const productIds = lines.map((l) => l.product_id as string)
      const { data: products } = await auth.supabase.from('products').select('id, selling_price').in('id', productIds)
      const priceOf = new Map((products ?? []).map((p) => [p.id, p.selling_price]))
      const items = lines.map((l) => {
        const catalog = priceOf.get(l.product_id as string) ?? l.price
        const perUnit = Math.max(0, catalog - l.price)
        return { product_id: l.product_id as string, quantity: l.quantity, discount: perUnit > 0 ? perUnit * l.quantity : undefined }
      })
      const { data: invoice, error: invoiceError } = await auth.supabase
        .rpc('create_invoice', { p_outlet_id: order.outlet_id, p_cashier_id: auth.authUserId, p_items: items, p_payment_method: 'pay_later', p_customer_name: order.customer_name, p_customer_phone: order.customer_phone })
        .single()
      if (invoiceError || !invoice) {
        const { status, message } = handleDatabaseError(invoiceError ?? { message: 'Gagal membuat invoice' })
        return NextResponse.json({ error: `Tidak bisa memproses pesanan: ${message}` }, { status: status === 500 ? 409 : status })
      }
      invoiceId = invoice.invoice_id
      patch.invoice_id = invoiceId
      if (order.payment_status === 'paid' && order.payment_method !== 'cod') {
        const method = order.payment_method === 'cash' ? 'cash' : order.payment_method === 'e_wallet' ? 'e_wallet' : 'bank_transfer'
        const { data: inv } = await auth.supabase.from('invoices').select('total').eq('id', invoiceId as string).single()
        if (inv) await recordInvoicePayment(auth, { invoiceId: invoiceId as string, method, amount: inv.total, note: `Pesanan online ${order.order_number}` })
      }
    } else {
      invoiceNote = 'Ada item tanpa produk katalog, jadi pesanan ini tidak masuk stok & laporan penjualan.'
    }
  }

  if (target === 'on_delivery') {
    if (courier !== undefined) patch.courier = courier
    if (tracking_number !== undefined) patch.tracking_number = tracking_number
  }

  if (target === 'completed' && paid && order.payment_status !== 'paid') {
    patch.payment_status = 'paid'
    if (invoiceId) {
      const { data: inv } = await auth.supabase.from('invoices').select('total, payment_status').eq('id', invoiceId).single()
      if (inv && inv.payment_status !== 'paid') {
        const method = order.payment_method === 'cod' || order.payment_method === 'cash' ? 'cash' : order.payment_method === 'e_wallet' ? 'e_wallet' : 'bank_transfer'
        const settled = await auth.supabase.from('payment_transactions').select('amount').eq('invoice_id', invoiceId).eq('status', 'settled')
        const balance = inv.total - (settled.data ?? []).reduce((s, p) => s + p.amount, 0)
        if (balance > 0) await recordInvoicePayment(auth, { invoiceId, method, amount: balance, note: `Pesanan online ${order.order_number}` })
      }
    }
  }

  if (target === 'cancelled') {
    if (invoiceId) {
      const { error: voidError } = await auth.supabase.rpc('void_invoice', { p_invoice_id: invoiceId, p_voided_by: auth.authUserId, p_reason: `Pesanan online ${order.order_number} dibatalkan${reason ? `: ${reason}` : ''}` }).single()
      if (voidError) {
        const { status, message } = handleDatabaseError(voidError)
        return NextResponse.json({ error: `Invoice pesanan tidak bisa dibatalkan: ${message}` }, { status: status === 500 ? 409 : status })
      }
    }
    patch.cancel_reason = reason ?? null
  }

  const { data, error } = await auth.supabase.from('online_orders').update(patch).eq('id', id).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ order: data, invoice_id: invoiceId, note: invoiceNote })
}
