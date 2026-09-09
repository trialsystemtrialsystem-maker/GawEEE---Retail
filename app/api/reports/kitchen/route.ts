import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/reports/kitchen — today's service-line items, for the kanban board.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const { data, error } = await auth.supabase
    .from('invoice_items')
    .select('id, quantity, notes, prep_status, products(name), invoices!inner(invoice_number, created_at, outlet_id)')
    .eq('invoices.outlet_id', auth.outlet_id)
    .not('prep_status', 'is', null)
    .gte('invoices.created_at', start.toISOString())
    .order('created_at', { referencedTable: 'invoices', ascending: true })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ queue: data })
}
