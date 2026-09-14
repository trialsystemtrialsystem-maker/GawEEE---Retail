import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/reports/purchase-return-reconciliation — per supplier invoice:
// invoice total vs. linked-returns total vs. amount already paid, i.e.
// "berapa yang masih harus dibayar setelah retur."
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const { data: pos } = await auth.supabase.from('purchase_orders').select('id').eq('outlet_id', auth.outlet_id)
  const poIds = (pos ?? []).map((p) => p.id)
  if (poIds.length === 0) return NextResponse.json({ invoices: [] })

  const { data: invoices, error } = await auth.supabase
    .from('purchase_invoices')
    .select('id, invoice_number, invoice_date, total, payment_status, suppliers(name), purchase_payments(amount), purchase_returns(total_amount, status)')
    .in('po_id', poIds)
    .order('invoice_date', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  type Row = {
    id: string
    invoice_number: string
    invoice_date: string
    total: number
    payment_status: string
    suppliers: { name: string } | null
    purchase_payments: { amount: number }[]
    purchase_returns: { total_amount: number; status: string }[]
  }

  const result = (invoices as unknown as Row[]).map((inv) => {
    const paid = inv.purchase_payments.reduce((s, p) => s + p.amount, 0)
    const returned = inv.purchase_returns.filter((r) => r.status === 'completed').reduce((s, r) => s + r.total_amount, 0)
    const netPayable = Math.max(0, inv.total - returned)
    const remaining = Math.max(0, netPayable - paid)
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      supplier_name: inv.suppliers?.name ?? '-',
      total: inv.total,
      returned,
      net_payable: netPayable,
      paid,
      remaining,
    }
  })

  return NextResponse.json({ invoices: result })
}
