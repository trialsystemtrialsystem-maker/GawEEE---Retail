import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'

// GET /api/reports/market-basket?days=90 — market basket / association-rule
// analysis ("customers who bought X also bought Y"), standard in enterprise
// retail (Oracle Retail, SAP, Amazon-style recommendations) for cross-
// merchandising and bundle decisions. Computes standard association-rule
// metrics per product pair from real invoice history:
//   support(A,B)    = P(A and B in the same basket)
//   confidence(A→B) = P(B in basket | A in basket)     — asymmetric
//   lift(A,B)       = confidence(A→B) / P(B)            — >1 means A makes
//                     B more likely than chance; the headline "worth
//                     bundling" signal, since a high co-occurrence count
//                     alone is often just two popular products.
// One query for all items in the window (joined to invoices for outlet/void
// filtering), grouped into baskets in memory, rather than N+1 per invoice.
type Row = { invoice_id: string; product_id: string; products: { name: string } | null }

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope
  const { startIso, endIso } = resolveDateRange(searchParams, 90, 365)

  const { data, error } = await auth.supabase
    .from('invoice_items')
    .select('invoice_id, product_id, products(name), invoices!inner(outlet_id, order_status, created_at)')
    .in('invoices.outlet_id', outletIds)
    .neq('invoices.order_status', 'voided')
    .gte('invoices.created_at', startIso)
    .lte('invoices.created_at', endIso)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const productNames = new Map<string, string>()
  const basketByInvoice = new Map<string, Set<string>>()
  for (const row of (data ?? []) as unknown as Row[]) {
    if (row.products?.name) productNames.set(row.product_id, row.products.name)
    const basket = basketByInvoice.get(row.invoice_id) ?? new Set<string>()
    basket.add(row.product_id)
    basketByInvoice.set(row.invoice_id, basket)
  }

  const totalBaskets = basketByInvoice.size
  const singleCount = new Map<string, number>()
  const pairCount = new Map<string, number>()

  for (const basket of basketByInvoice.values()) {
    const items = Array.from(basket)
    for (const p of items) singleCount.set(p, (singleCount.get(p) ?? 0) + 1)
    if (items.length < 2 || items.length > 15) continue // skip oversized baskets — not a real "pair" signal, just a big cart
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const [a, b] = items[i] < items[j] ? [items[i], items[j]] : [items[j], items[i]]
        const key = `${a}|${b}`
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
      }
    }
  }

  const pairs = Array.from(pairCount.entries())
    .map(([key, count]) => {
      const [a, b] = key.split('|')
      const countA = singleCount.get(a) ?? 0
      const countB = singleCount.get(b) ?? 0
      const support = totalBaskets > 0 ? count / totalBaskets : 0
      const confidenceAtoB = countA > 0 ? count / countA : 0
      const confidenceBtoA = countB > 0 ? count / countB : 0
      const probB = totalBaskets > 0 ? countB / totalBaskets : 0
      const lift = probB > 0 ? confidenceAtoB / probB : 0
      return {
        product_a: productNames.get(a) ?? '-',
        product_b: productNames.get(b) ?? '-',
        co_occurrence: count,
        support_pct: support * 100,
        confidence_a_to_b_pct: confidenceAtoB * 100,
        confidence_b_to_a_pct: confidenceBtoA * 100,
        lift: Number(lift.toFixed(2)),
      }
    })
    .filter((p) => p.co_occurrence >= 2) // a single coincidental pairing isn't a signal
    .sort((a, b) => b.lift - a.lift || b.co_occurrence - a.co_occurrence)
    .slice(0, 50)

  return NextResponse.json({
    pairs,
    total_baskets: totalBaskets,
    note: 'Lift > 1 berarti dua produk ini lebih sering dibeli bersamaan daripada kebetulan acak — kandidat kuat untuk bundling atau penempatan rak berdekatan. Pasangan dengan kemunculan bersama kurang dari 2 kali diabaikan.',
  })
}
