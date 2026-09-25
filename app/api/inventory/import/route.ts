import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { postStockValueJournal } from '@/lib/utils/journalPosting'

const schema = z.object({
  outlet_id: z.string().uuid(),
  // 'set': the file holds the counted/opening quantity; 'add': the file holds the change.
  mode: z.enum(['set', 'add']),
  reason: z.string().trim().min(3, 'Alasan wajib diisi').max(200),
  dry_run: z.boolean().default(false),
  rows: z.array(z.object({ sku: z.string().trim().min(1), quantity: z.number().int() })).min(1, 'Tidak ada baris untuk diimpor').max(500),
})

type Result = { sku: string; name: string | null; before: number; after: number; delta: number; status: 'ok' | 'unchanged' | 'unknown_sku' | 'invalid'; message?: string }

// POST /api/inventory/import — bulk opening stock / stock correction from a
// spreadsheet. `dry_run` returns exactly what would change without touching
// anything, so the owner can review before applying. Applied rows go through
// update_inventory() (one 'adjustment' ledger row each, so they show on the
// kartu stok) and their total value is journaled once.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'inventory.adjust'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const parsed = validate(schema, await request.json())
  if (!parsed.valid) return NextResponse.json({ error: parsed.errors }, { status: 400 })
  const { outlet_id, mode, reason, dry_run, rows } = parsed.data
  if (!canAccessOutlet(auth, outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data: products, error: pError } = await auth.supabase
    .from('products')
    .select('id, sku, name, purchase_price')
    .eq('company_id', auth.company_id)
    .is('deleted_at', null)
    .in('sku', rows.map((r) => r.sku))
  if (pError) {
    const { status, message } = handleDatabaseError(pError)
    return NextResponse.json({ error: message }, { status })
  }
  const bySku = new Map((products ?? []).map((p) => [p.sku.toLowerCase(), p]))
  const { data: stock } = await auth.supabase
    .from('inventory')
    .select('product_id, quantity_on_hand, avg_cost')
    .eq('outlet_id', outlet_id)
    .in('product_id', (products ?? []).map((p) => p.id))
  const onHand = new Map((stock ?? []).map((s) => [s.product_id, s.quantity_on_hand]))
  const avgCost = new Map((stock ?? []).map((s) => [s.product_id, s.avg_cost]))

  const results: Result[] = []
  const plan: { productId: string; delta: number; price: number }[] = []
  for (const r of rows) {
    const p = bySku.get(r.sku.toLowerCase())
    if (!p) {
      results.push({ sku: r.sku, name: null, before: 0, after: 0, delta: 0, status: 'unknown_sku', message: 'SKU tidak ditemukan' })
      continue
    }
    const before = onHand.get(p.id) ?? 0
    const after = mode === 'set' ? r.quantity : before + r.quantity
    if (after < 0) {
      results.push({ sku: r.sku, name: p.name, before, after, delta: 0, status: 'invalid', message: 'Hasil stok tidak boleh negatif' })
      continue
    }
    const delta = after - before
    if (delta === 0) {
      results.push({ sku: r.sku, name: p.name, before, after, delta: 0, status: 'unchanged' })
      continue
    }
    results.push({ sku: r.sku, name: p.name, before, after, delta, status: 'ok' })
    plan.push({ productId: p.id, delta, price: avgCost.get(p.id) ?? p.purchase_price ?? 0 })
  }

  const summary = {
    ok: results.filter((r) => r.status === 'ok').length,
    unchanged: results.filter((r) => r.status === 'unchanged').length,
    problems: results.filter((r) => r.status === 'unknown_sku' || r.status === 'invalid').length,
    value_change: plan.reduce((s, x) => s + x.delta * x.price, 0),
  }
  if (dry_run) return NextResponse.json({ dry_run: true, results, summary })

  // All-or-nothing on validation: refuse to apply a file that has problems, so
  // a half-imported sheet can never happen silently.
  if (summary.problems > 0) return NextResponse.json({ error: 'Perbaiki baris bermasalah sebelum mengimpor', results, summary }, { status: 400 })

  for (const step of plan) {
    const { error } = await auth.supabase.rpc('update_inventory', {
      p_outlet_id: outlet_id,
      p_product_id: step.productId,
      p_quantity_change: step.delta,
      p_movement_type: 'adjustment',
      p_recorded_by: auth.authUserId,
      p_reference_type: 'import',
      p_unit_cost: step.price,
      p_notes: `Impor stok: ${reason}`,
    })
    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: `Gagal di tengah impor: ${message}`, results, summary }, { status })
    }
  }

  await postStockValueJournal(auth.supabase, {
    outletId: outlet_id,
    createdBy: auth.id,
    date: new Date().toISOString().slice(0, 10),
    description: `Impor stok: ${reason}`,
    sourceType: 'stock_import',
    sourceId: crypto.randomUUID(),
    value: summary.value_change,
  })

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    outlet_id,
    action_type: 'UPDATE',
    entity_type: 'inventory_import',
    entity_id: outlet_id,
    new_values: { mode, applied: summary.ok, value_change: summary.value_change },
    reason_for_action: reason,
    status: 'success',
  })

  return NextResponse.json({ dry_run: false, results, summary })
}
