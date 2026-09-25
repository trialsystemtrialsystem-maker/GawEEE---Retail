import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveOutletScope } from '@/lib/utils/outletScope'
import { selectAll } from '@/lib/utils/fetchAll'

// GET /api/reports/customer-segmentation — RFM (Recency/Frequency/Monetary)
// customer segmentation, a standard enterprise CRM/sales-analytics tool
// (Salesforce, HubSpot, SAP CX all ship a version of this) for answering
// "which customers actually matter and what should we do about each one" —
// a level up from Customer Summary Report's raw totals. Matches invoices to
// a customer by phone (primary key here — same disclosed limitation as
// every other report joining invoices to customers, there's no FK) and only
// scores customers who have at least one matched purchase; a phone-less
// walk-in has nothing to segment.
type InvoiceRow = { customer_phone: string | null; total: number; created_at: string }

const SEGMENT_INFO: Record<string, { label: string; action: string }> = {
  champions: { label: 'Pelanggan Utama', action: 'Prioritaskan — program loyalitas eksklusif, minta ulasan/referral.' },
  loyal: { label: 'Pelanggan Setia', action: 'Pertahankan — upsell produk baru, ucapkan terima kasih secara personal.' },
  potential: { label: 'Potensial', action: 'Dorong belanja lagi — tawarkan promo produk pelengkap.' },
  new: { label: 'Pelanggan Baru', action: 'Sambut — pastikan pengalaman pertama baik, tawarkan insentif kunjungan kedua.' },
  at_risk: { label: 'Berisiko', action: 'Hubungi segera — dulu sering & besar belanjanya, sekarang mulai sepi.' },
  cant_lose: { label: 'Jangan Sampai Hilang', action: 'Prioritas tertinggi untuk win-back — dulu pelanggan bernilai tinggi, lama tidak kembali.' },
  hibernating: { label: 'Tidak Aktif', action: 'Kampanye win-back murah, atau biarkan — nilai historisnya rendah.' },
  attention: { label: 'Perlu Perhatian', action: 'Pantau — belum masuk kategori jelas, cek tren pada kunjungan berikutnya.' },
}

function scoreQuintile(rank: number, count: number): number {
  if (count <= 1) return 3
  const pct = rank / (count - 1) // 0 (best rank) .. 1 (worst rank)
  return Math.max(1, 5 - Math.floor(pct * 5))
}

function segment(r: number, f: number, m: number): string {
  if (r >= 4 && f >= 4) return 'champions'
  if (r >= 3 && f >= 3) return 'loyal'
  if (r >= 4 && f <= 2) return f === 1 ? 'new' : 'potential'
  if (r <= 2 && f >= 4) return 'cant_lose'
  if (r <= 2 && f >= 3) return 'at_risk'
  if (r <= 2 && f <= 2 && m <= 2) return 'hibernating'
  return 'attention'
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scopeResult = await resolveOutletScope(auth, request.nextUrl.searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope

  const [invoicesRes, customersRes] = await Promise.all([
    selectAll(auth.supabase
      .from('invoices')
      .select('customer_phone, total, created_at')
      .in('outlet_id', outletIds)
      .neq('order_status', 'voided')
      .not('customer_phone', 'is', null)),
    auth.supabase.from('customers').select('id, name, phone').in('outlet_id', outletIds),
  ])

  if (invoicesRes.error) {
    const { status, message } = handleDatabaseError(invoicesRes.error)
    return NextResponse.json({ error: message }, { status })
  }

  const customerByPhone = new Map((customersRes.data ?? []).filter((c) => c.phone).map((c) => [c.phone as string, c]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  type Agg = { phone: string; name: string; frequency: number; monetary: number; lastPurchase: Date }
  const byPhone = new Map<string, Agg>()
  for (const inv of (invoicesRes.data ?? []) as InvoiceRow[]) {
    if (!inv.customer_phone) continue
    const customer = customerByPhone.get(inv.customer_phone)
    if (!customer) continue // only segment matched registered customers — a phone typed at checkout with no matching record isn't a real CRM entity
    const purchaseDate = new Date(inv.created_at)
    const entry = byPhone.get(inv.customer_phone) ?? { phone: inv.customer_phone, name: customer.name, frequency: 0, monetary: 0, lastPurchase: purchaseDate }
    entry.frequency += 1
    entry.monetary += inv.total
    if (purchaseDate > entry.lastPurchase) entry.lastPurchase = purchaseDate
    byPhone.set(inv.customer_phone, entry)
  }

  const customers = Array.from(byPhone.values()).map((c) => ({
    ...c,
    recencyDays: Math.floor((today.getTime() - c.lastPurchase.getTime()) / (1000 * 60 * 60 * 24)),
  }))

  // Quintile-rank each metric independently (best-scoring direction differs:
  // fewer recency days is better, more frequency/monetary is better).
  // scoreQuintile treats rank 0 as "best" uniformly, so each sort has to put
  // the best customer at index 0 — ascending for recency (fewest days since
  // last purchase is best) but *descending* for frequency/monetary (more
  // purchases/spend is best, the opposite direction).
  const byRecencyAsc = [...customers].sort((a, b) => a.recencyDays - b.recencyDays)
  const byFrequencyDesc = [...customers].sort((a, b) => b.frequency - a.frequency)
  const byMonetaryDesc = [...customers].sort((a, b) => b.monetary - a.monetary)
  const recencyRank = new Map(byRecencyAsc.map((c, i) => [c.phone, i]))
  const frequencyRank = new Map(byFrequencyDesc.map((c, i) => [c.phone, i]))
  const monetaryRank = new Map(byMonetaryDesc.map((c, i) => [c.phone, i]))
  const n = customers.length

  const scored = customers.map((c) => {
    const rScore = scoreQuintile(recencyRank.get(c.phone)!, n)
    const fScore = scoreQuintile(frequencyRank.get(c.phone)!, n)
    const mScore = scoreQuintile(monetaryRank.get(c.phone)!, n)
    const segmentKey = segment(rScore, fScore, mScore)
    return {
      name: c.name,
      phone: c.phone,
      recency_days: c.recencyDays,
      frequency: c.frequency,
      monetary: c.monetary,
      r_score: rScore,
      f_score: fScore,
      m_score: mScore,
      segment: segmentKey,
      segment_label: SEGMENT_INFO[segmentKey].label,
      segment_action: SEGMENT_INFO[segmentKey].action,
    }
  })

  scored.sort((a, b) => b.monetary - a.monetary)

  const bySegment = Object.keys(SEGMENT_INFO).map((key) => {
    const inSegment = scored.filter((c) => c.segment === key)
    return {
      segment: key,
      label: SEGMENT_INFO[key].label,
      action: SEGMENT_INFO[key].action,
      customer_count: inSegment.length,
      total_monetary: inSegment.reduce((s, c) => s + c.monetary, 0),
    }
  })

  return NextResponse.json({
    customers: scored,
    bySegment,
    note: 'Pencocokan berbasis nomor telepon — hanya pelanggan terdaftar dengan riwayat transaksi bernomor telepon yang disertakan.',
  })
}
