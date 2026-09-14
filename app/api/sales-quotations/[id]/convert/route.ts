import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/sales-quotations/[id]/convert — accepted quotation -> real
// invoice via the existing create_invoice() RPC. The quoted unit_price is
// honored via the same per-item discount mechanism already used for
// Time-Based Pricing (discount = current catalog price - quoted price,
// only ever a discount, never a markup — create_invoice() has no markup
// path). Sequential and non-atomic with the status update afterward, same
// accepted trade-off as PO receiving.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: quotationRaw, error: quotationError } = await auth.supabase
    .from('sales_quotations')
    .select('*, sales_quotation_items(product_id, quantity, unit_price)')
    .eq('id', id)
    .single()

  if (quotationError || !quotationRaw) {
    return NextResponse.json({ error: 'Quotation tidak ditemukan' }, { status: 404 })
  }
  const quotation = quotationRaw as unknown as {
    outlet_id: string
    status: string
    invoice_id: string | null
    customer_name: string
    customer_phone: string | null
    sales_quotation_items: { product_id: string; quantity: number; unit_price: number }[]
  }
  if (quotation.status !== 'accepted') {
    return NextResponse.json({ error: 'Hanya quotation berstatus accepted yang bisa dikonversi' }, { status: 400 })
  }
  if (quotation.invoice_id) {
    return NextResponse.json({ error: 'Quotation ini sudah dikonversi menjadi invoice' }, { status: 400 })
  }

  const productIds = quotation.sales_quotation_items.map((i: { product_id: string }) => i.product_id)
  const { data: products } = await auth.supabase.from('products').select('id, selling_price').in('id', productIds)
  const priceByProduct = new Map((products ?? []).map((p) => [p.id, p.selling_price]))

  const items = quotation.sales_quotation_items.map((line: { product_id: string; quantity: number; unit_price: number }) => {
    const catalogPrice = priceByProduct.get(line.product_id) ?? line.unit_price
    const discountPerUnit = Math.max(0, catalogPrice - line.unit_price)
    return { product_id: line.product_id, quantity: line.quantity, discount: discountPerUnit > 0 ? discountPerUnit * line.quantity : undefined }
  })

  const { data: invoiceResult, error: invoiceError } = await auth.supabase
    .rpc('create_invoice', {
      p_outlet_id: quotation.outlet_id,
      p_cashier_id: auth.authUserId,
      p_items: items,
      p_payment_method: 'pay_later',
      p_customer_name: quotation.customer_name,
      p_customer_phone: quotation.customer_phone,
    })
    .single()

  if (invoiceError) {
    const { status, message } = handleDatabaseError(invoiceError)
    return NextResponse.json({ error: message }, { status })
  }

  await auth.supabase.from('sales_quotations').update({ invoice_id: invoiceResult!.invoice_id }).eq('id', id)

  return NextResponse.json({ invoice_id: invoiceResult!.invoice_id, invoice_number: invoiceResult!.invoice_number })
}
