import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'
import { selectAll } from '@/lib/utils/fetchAll'

type InvoiceRow = {
  customer_name: string | null
  customer_phone: string | null
  total: number
  created_at: string
  order_status: string
}

// GET /api/reports/customer-summary?outlet_id=&start=&end= — per-customer
// spend, visit count, last visit within the selected range. Matches
// invoices to a known customer by phone (primary) then falls back to
// grouping by the raw name typed at checkout when no phone was captured —
// there's no FK from invoices to customers, so a walk-in sale with no phone
// can't be attributed to a specific customer record and is grouped under
// its name only.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope
  const { startIso, endIso } = resolveDateRange(searchParams, 36500, 36500) // customer summary is lifetime-by-default — a huge default window rather than a hardcoded "no filter" path, so the same start/end params still narrow it down when given

  const [invoicesRes, customersRes] = await Promise.all([
    selectAll(auth.supabase
      .from('invoices')
      .select('customer_name, customer_phone, total, created_at, order_status')
      .in('outlet_id', outletIds)
      .not('customer_name', 'is', null)
      .gte('created_at', startIso)
      .lte('created_at', endIso)),
    auth.supabase.from('customers').select('id, name, phone').in('outlet_id', outletIds),
  ])

  const invoices = ((invoicesRes.data ?? []) as InvoiceRow[]).filter((i) => i.order_status !== 'voided')
  const customerByPhone = new Map((customersRes.data ?? []).filter((c) => c.phone).map((c) => [c.phone, c]))

  type Entry = { key: string; customer_id: string | null; name: string; phone: string | null; total_spend: number; visit_count: number; last_visit: string }
  const byKey = new Map<string, Entry>()

  for (const inv of invoices) {
    const key = inv.customer_phone || `name:${inv.customer_name}`
    const matched = inv.customer_phone ? customerByPhone.get(inv.customer_phone) : undefined
    const entry =
      byKey.get(key) ??
      ({
        key,
        customer_id: matched?.id ?? null,
        name: matched?.name ?? inv.customer_name ?? 'Tanpa nama',
        phone: inv.customer_phone,
        total_spend: 0,
        visit_count: 0,
        last_visit: inv.created_at,
      } satisfies Entry)
    entry.total_spend += inv.total
    entry.visit_count += 1
    if (inv.created_at > entry.last_visit) entry.last_visit = inv.created_at
    byKey.set(key, entry)
  }

  const customers = Array.from(byKey.values()).sort((a, b) => b.total_spend - a.total_spend)

  return NextResponse.json({
    customers,
    topSpenders: customers.slice(0, 10).map((c) => ({ name: c.name, total_spend: c.total_spend })),
    matchNote: 'Pencocokan berbasis nomor telepon — pelanggan tanpa nomor telepon di transaksi dikelompokkan berdasarkan nama.',
  })
}
