// Resolves who a WhatsApp broadcast goes to. Returns deduplicated recipients
// (by normalised phone) with the last-purchase details used to personalise the
// message, already excluding customers who opted out.
import type { AuthContext } from '@/lib/utils/auth-context'
import { selectAll } from '@/lib/utils/fetchAll'
import { normalizePhone } from '@/lib/utils/customerInsights'

export type Audience = { type: 'customers' | 'group' | 'recent_buyers' | 'lapsed'; group_id?: string; days?: number }

export interface Recipient {
  customer_id: string | null
  name: string
  phone: string
  last_invoice: string | null
  last_total: number | null
  last_at: string | null
}

export interface AudienceResult {
  recipients: Recipient[]
  opted_out: number
  capped: boolean
}

const MAX_RECIPIENTS = 1000

export async function resolveAudience(auth: AuthContext, outletId: string, audience: Audience): Promise<AudienceResult> {
  const optedOut = new Set<string>()
  const { data: optRows } = await auth.supabase.from('customers').select('phone').eq('outlet_id', outletId).eq('whatsapp_opt_out', true)
  for (const c of optRows ?? []) if (c.phone) optedOut.add(normalizePhone(c.phone))

  // Last purchase per phone (drives personalisation and the buyer audiences).
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString()
  const { data: invoices } = await selectAll(
    auth.supabase.from('invoices').select('invoice_number, customer_name, customer_phone, total, created_at').eq('outlet_id', outletId).neq('order_status', 'voided').not('customer_phone', 'is', null).gte('created_at', since).order('created_at', { ascending: false })
  )
  const lastByPhone = new Map<string, { name: string | null; invoice: string; total: number; at: string; phone: string }>()
  for (const i of invoices ?? []) {
    const key = normalizePhone(i.customer_phone)
    if (!key) continue
    const prev = lastByPhone.get(key)
    if (!prev || i.created_at > prev.at) lastByPhone.set(key, { name: i.customer_name, invoice: i.invoice_number, total: i.total, at: i.created_at, phone: i.customer_phone as string })
  }

  const picked = new Map<string, Recipient>()
  const add = (customer_id: string | null, name: string, phone: string) => {
    const key = normalizePhone(phone)
    if (!key || optedOut.has(key) || picked.has(key)) return
    const last = lastByPhone.get(key)
    picked.set(key, { customer_id, name, phone: key, last_invoice: last?.invoice ?? null, last_total: last?.total ?? null, last_at: last?.at ?? null })
  }

  if (audience.type === 'customers' || audience.type === 'group') {
    let q = auth.supabase.from('customers').select('id, name, phone').eq('outlet_id', outletId).not('phone', 'is', null)
    if (audience.type === 'group' && audience.group_id) q = q.eq('group_id', audience.group_id)
    const { data: customers } = await selectAll(q)
    for (const c of customers ?? []) add(c.id, c.name, c.phone as string)
  } else {
    const days = audience.days ?? (audience.type === 'lapsed' ? 60 : 30)
    const cutoff = Date.now() - days * 86_400_000
    for (const [key, last] of lastByPhone) {
      const recent = Date.parse(last.at) >= cutoff
      if ((audience.type === 'recent_buyers' && recent) || (audience.type === 'lapsed' && !recent)) add(null, last.name ?? 'Pelanggan', key)
    }
    // Attach registered-customer ids/names where the phone matches.
    const { data: customers } = await selectAll(auth.supabase.from('customers').select('id, name, phone').eq('outlet_id', outletId).not('phone', 'is', null))
    for (const c of customers ?? []) {
      const r = picked.get(normalizePhone(c.phone))
      if (r) {
        r.customer_id = c.id
        r.name = c.name
      }
    }
  }

  const all = Array.from(picked.values())
  return { recipients: all.slice(0, MAX_RECIPIENTS), opted_out: optedOut.size, capped: all.length > MAX_RECIPIENTS }
}
