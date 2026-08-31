import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createPurchaseInvoiceSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/purchase-invoices?outlet_id= — invoices for POs at this outlet.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: pos } = await auth.supabase.from('purchase_orders').select('id').eq('outlet_id', outletId)
  const poIds = (pos ?? []).map((p) => p.id)
  if (poIds.length === 0) return NextResponse.json({ invoices: [] })

  const { data, error } = await auth.supabase
    .from('purchase_invoices')
    .select('*, purchase_orders(po_number), suppliers(name)')
    .in('po_id', poIds)
    .order('invoice_date', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ invoices: data })
}

// POST /api/purchase-invoices — manager+ only. Records a supplier invoice
// (the physical document) against a PO — invoice_number/subtotal/tax are
// what's printed on that document, not re-derived from po_items.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(createPurchaseInvoiceSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: po } = await auth.supabase.from('purchase_orders').select('outlet_id, supplier_id').eq('id', result.data.po_id).single()
  if (!po) return NextResponse.json({ error: 'Purchase order tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, po.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const total = result.data.subtotal + result.data.tax_amount

  const { data, error } = await auth.supabase
    .from('purchase_invoices')
    .insert({ ...result.data, supplier_id: po.supplier_id, total })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ invoice: data }, { status: 201 })
}
