import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { selectAll } from '@/lib/utils/fetchAll'
import { applyBulkChange, marginOf } from '@/lib/utils/pricing'

const schema = z.object({
  // Which products: explicit ids, or a whole category ('none' = uncategorised), or all active goods.
  product_ids: z.array(z.string().uuid()).max(2000).optional(),
  category_id: z.union([z.string().uuid(), z.literal('none')]).optional(),
  field: z.enum(['selling_price', 'purchase_price']).default('selling_price'),
  rule: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('percent'), value: z.number().min(-90).max(500) }),
    z.object({ mode: z.literal('amount'), value: z.number().min(-1e9).max(1e9) }),
    z.object({ mode: z.literal('margin'), value: z.number().min(0).max(95) }),
    z.object({ mode: z.literal('set'), value: z.number().min(0).max(1e12) }),
  ]),
  round: z.union([z.literal(0), z.literal(100), z.literal(500), z.literal(1000)]).default(0),
  dry_run: z.boolean().default(true),
})

// POST /api/products/bulk-price — one rule applied to many products, always
// previewable (dry_run defaults to TRUE so a stray call can never change prices).
// Applied changes go through ordinary updates, so the price-history trigger
// records each one. Prices that would end up below cost are flagged, not blocked.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { product_ids, category_id, field, rule, round, dry_run } = result.data
  if (!product_ids?.length && !category_id) return NextResponse.json({ error: 'Pilih produk atau kategori' }, { status: 400 })

  let q = auth.supabase.from('products').select('id, sku, name, purchase_price, selling_price').eq('company_id', auth.company_id).is('deleted_at', null).eq('product_type', 'goods')
  if (product_ids?.length) q = q.in('id', product_ids)
  if (category_id === 'none') q = q.is('category_id', null)
  else if (category_id) q = q.eq('category_id', category_id)
  const { data: products, error } = await selectAll(q)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const changes = (products ?? []).map((p) => {
    const next = applyBulkChange({ purchase_price: p.purchase_price, selling_price: p.selling_price }, rule, field, round)
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      old: { purchase_price: p.purchase_price, selling_price: p.selling_price },
      new: next,
      changed: next.purchase_price !== p.purchase_price || next.selling_price !== p.selling_price,
      below_cost: next.selling_price > 0 && next.selling_price < next.purchase_price,
      new_margin: marginOf(next.purchase_price, next.selling_price),
    }
  })
  const effective = changes.filter((c) => c.changed)
  const summary = { matched: changes.length, changed: effective.length, unchanged: changes.length - effective.length, below_cost: effective.filter((c) => c.below_cost).length }

  if (dry_run) return NextResponse.json({ dry_run: true, summary, changes: changes.slice(0, 200) })

  for (const c of effective) {
    const { error: updateError } = await auth.supabase.from('products').update(c.new).eq('id', c.id).eq('company_id', auth.company_id)
    if (updateError) {
      const { status, message } = handleDatabaseError(updateError)
      return NextResponse.json({ error: `Gagal di tengah perubahan massal (${c.sku}): ${message}`, summary }, { status })
    }
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    action_type: 'UPDATE',
    entity_type: 'product_bulk_price',
    entity_id: auth.company_id,
    new_values: { rule, field, round, changed: effective.length },
    status: 'success',
  })
  return NextResponse.json({ dry_run: false, summary })
}
