import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { selectAll } from '@/lib/utils/fetchAll'

const rowSchema = z.object({
  sku: z.string().trim().min(1, 'SKU kosong').max(100),
  name: z.string().trim().max(255).optional(),
  category: z.string().trim().max(255).optional(),
  barcode: z.string().trim().max(100).optional(),
  purchase_price: z.number().min(0).max(1e12).optional(),
  selling_price: z.number().min(0).max(1e12).optional(),
  unit_type: z.string().trim().max(50).optional(),
  reorder_level: z.number().int().min(0).max(1e7).optional(),
})
const schema = z.object({ rows: z.array(rowSchema).min(1, 'Tidak ada baris').max(1000), create_categories: z.boolean().default(true), dry_run: z.boolean().default(true) })

type Result = { sku: string; action: 'create' | 'update' | 'unchanged' | 'error'; changes?: string[]; message?: string }

// POST /api/products/import — bulk add / update products from a spreadsheet,
// matched on SKU (case-insensitive). New SKUs need name, purchase and selling
// price; existing SKUs only change the columns present. Categories are matched
// by name (created when allowed). dry_run defaults to TRUE and a file with any
// error row is refused, so an import is all-or-nothing on validation.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const parsed = validate(schema, await request.json())
  if (!parsed.valid) return NextResponse.json({ error: parsed.errors }, { status: 400 })
  const { rows, create_categories, dry_run } = parsed.data

  const [{ data: products }, { data: categories }] = await Promise.all([
    selectAll(auth.supabase.from('products').select('id, sku, name, barcode, category_id, purchase_price, selling_price, unit_type, reorder_level').eq('company_id', auth.company_id).is('deleted_at', null)),
    auth.supabase.from('product_categories').select('id, name').eq('company_id', auth.company_id),
  ])
  const bySku = new Map((products ?? []).map((p) => [p.sku.toLowerCase(), p]))
  const catByName = new Map((categories ?? []).map((c) => [c.name.toLowerCase(), c.id]))
  const seen = new Set<string>()
  const newCategories = new Set<string>()

  const results: Result[] = []
  const plan: { kind: 'create' | 'update'; id?: string; data: Record<string, unknown>; category?: string }[] = []
  for (const r of rows) {
    const key = r.sku.toLowerCase()
    if (seen.has(key)) {
      results.push({ sku: r.sku, action: 'error', message: 'SKU muncul lebih dari sekali di file' })
      continue
    }
    seen.add(key)
    const existing = bySku.get(key)

    let category_id: string | undefined
    if (r.category) {
      category_id = catByName.get(r.category.toLowerCase())
      if (!category_id) {
        if (!create_categories) {
          results.push({ sku: r.sku, action: 'error', message: `Kategori "${r.category}" tidak ada` })
          continue
        }
        newCategories.add(r.category)
      }
    }

    if (!existing) {
      if (!r.name || r.purchase_price === undefined || r.selling_price === undefined) {
        results.push({ sku: r.sku, action: 'error', message: 'Produk baru wajib punya nama, harga beli, dan harga jual' })
        continue
      }
      plan.push({ kind: 'create', category: r.category, data: { sku: r.sku, name: r.name, barcode: r.barcode || null, purchase_price: r.purchase_price, selling_price: r.selling_price, unit_type: r.unit_type || 'pcs', reorder_level: r.reorder_level ?? 0, reorder_quantity: 0, ...(category_id ? { category_id } : {}) } })
      results.push({ sku: r.sku, action: 'create' })
      continue
    }

    const data: Record<string, unknown> = {}
    const changes: string[] = []
    const set = (col: string, next: unknown, prev: unknown, label: string) => {
      if (next !== undefined && next !== prev) {
        data[col] = next
        changes.push(`${label}: ${prev ?? '-'} → ${next}`)
      }
    }
    set('name', r.name || undefined, existing.name, 'nama')
    set('barcode', r.barcode || undefined, existing.barcode, 'barcode')
    set('purchase_price', r.purchase_price, existing.purchase_price, 'harga beli')
    set('selling_price', r.selling_price, existing.selling_price, 'harga jual')
    set('unit_type', r.unit_type || undefined, existing.unit_type, 'satuan')
    set('reorder_level', r.reorder_level, existing.reorder_level, 'titik pesan')
    if (r.category && category_id !== existing.category_id) {
      changes.push(`kategori: → ${r.category}`)
      if (category_id) data.category_id = category_id
    }
    if (changes.length === 0) results.push({ sku: r.sku, action: 'unchanged' })
    else {
      plan.push({ kind: 'update', id: existing.id, data, category: category_id ? undefined : r.category })
      results.push({ sku: r.sku, action: 'update', changes })
    }
  }

  const summary = {
    create: results.filter((r) => r.action === 'create').length,
    update: results.filter((r) => r.action === 'update').length,
    unchanged: results.filter((r) => r.action === 'unchanged').length,
    errors: results.filter((r) => r.action === 'error').length,
    new_categories: newCategories.size,
  }
  if (dry_run) return NextResponse.json({ dry_run: true, summary, results })
  if (summary.errors > 0) return NextResponse.json({ error: 'Perbaiki baris bermasalah sebelum mengimpor', summary, results }, { status: 400 })

  for (const name of newCategories) {
    const { data: created, error } = await auth.supabase.from('product_categories').insert({ company_id: auth.company_id, name }).select('id').single()
    if (error || !created) {
      const { status, message } = handleDatabaseError(error ?? { message: 'Gagal membuat kategori' })
      return NextResponse.json({ error: `Gagal membuat kategori "${name}": ${message}` }, { status })
    }
    catByName.set(name.toLowerCase(), created.id)
  }

  for (const step of plan) {
    const catId = step.category ? catByName.get(step.category.toLowerCase()) : undefined
    const data = { ...step.data, ...(catId ? { category_id: catId } : {}) }
    const { error } =
      step.kind === 'create'
        ? await auth.supabase.from('products').insert({ ...(data as { sku: string; name: string; purchase_price: number; selling_price: number; unit_type: string; reorder_level: number; reorder_quantity: number }), company_id: auth.company_id })
        : await auth.supabase.from('products').update(data).eq('id', step.id as string).eq('company_id', auth.company_id)
    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: `Gagal di tengah impor: ${message}`, summary, results }, { status })
    }
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    action_type: 'UPDATE',
    entity_type: 'product_import',
    entity_id: auth.company_id,
    new_values: summary,
    status: 'success',
  })
  return NextResponse.json({ dry_run: false, summary, results })
}
