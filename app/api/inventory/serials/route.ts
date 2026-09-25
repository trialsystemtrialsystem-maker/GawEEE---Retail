import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const STATUSES = ['in_stock', 'sold', 'returned', 'damaged'] as const

const createSchema = z.object({
  outlet_id: z.string().uuid(),
  product_id: z.string().uuid(),
  serials: z.array(z.string().trim().min(1).max(100)).min(1, 'Isi minimal satu nomor seri').max(200),
  notes: z.string().trim().max(300).optional(),
})
const patchSchema = z.object({ id: z.string().uuid(), status: z.enum(STATUSES), notes: z.string().trim().max(300).optional() })

// GET /api/inventory/serials?outlet_id=&product_id=&status=&search=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  let q = auth.supabase
    .from('product_serials')
    .select('id, product_id, serial_number, status, received_on, sold_on, notes, products(name, sku)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })
    .limit(500)
  const productId = searchParams.get('product_id')
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim()
  if (productId) q = q.eq('product_id', productId)
  if (status && (STATUSES as readonly string[]).includes(status)) q = q.eq('status', status as (typeof STATUSES)[number])
  if (search) q = q.ilike('serial_number', `%${search.replace(/[%,]/g, '')}%`)

  const { data, error } = await q
  if (error) {
    const { status: s, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: s })
  }
  type Row = { id: string; product_id: string; serial_number: string; status: string; received_on: string; sold_on: string | null; notes: string | null; products: { name: string; sku: string } | { name: string; sku: string }[] | null }
  return NextResponse.json({
    serials: ((data ?? []) as unknown as Row[]).map((r) => {
      const p = Array.isArray(r.products) ? r.products[0] : r.products
      return { ...r, product_name: p?.name ?? '-', sku: p?.sku ?? '', products: undefined }
    }),
  })
}

// POST /api/inventory/serials — register serial numbers for a product. The
// registry is a traceability record (which unit, where, sold or not); it does
// not change the stock count, which stays with purchases/adjustments.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'inventory.adjust'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(createSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { outlet_id, product_id, serials, notes } = result.data
  if (!canAccessOutlet(auth, outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const unique = Array.from(new Set(serials))
  const { data: existing } = await auth.supabase.from('product_serials').select('serial_number').eq('product_id', product_id).in('serial_number', unique)
  const taken = new Set((existing ?? []).map((e) => e.serial_number))
  const fresh = unique.filter((s) => !taken.has(s))
  if (fresh.length > 0) {
    const { error } = await auth.supabase.from('product_serials').insert(fresh.map((serial_number) => ({ outlet_id, product_id, serial_number, notes: notes ?? null, created_by: auth.id })))
    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }
  }
  return NextResponse.json({ created: fresh.length, duplicates: Array.from(taken) }, { status: 201 })
}

// PATCH /api/inventory/serials { id, status, notes? } — move a unit through
// in_stock / sold / returned / damaged.
export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'inventory.adjust'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(patchSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { id, status, notes } = result.data

  const { data: row } = await auth.supabase.from('product_serials').select('outlet_id').eq('id', id).single()
  if (!row || !canAccessOutlet(auth, row.outlet_id)) return NextResponse.json({ error: 'Nomor seri tidak ditemukan' }, { status: 404 })

  const { error } = await auth.supabase
    .from('product_serials')
    .update({ status, sold_on: status === 'sold' ? new Date().toISOString().slice(0, 10) : null, ...(notes !== undefined ? { notes } : {}) })
    .eq('id', id)
  if (error) {
    const { status: s, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: s })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/inventory/serials?id= — remove a mistaken registration (only
// while still in stock).
export async function DELETE(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'inventory.adjust'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })

  const { data: row } = await auth.supabase.from('product_serials').select('outlet_id, status').eq('id', id).single()
  if (!row || !canAccessOutlet(auth, row.outlet_id)) return NextResponse.json({ error: 'Nomor seri tidak ditemukan' }, { status: 404 })
  if (row.status !== 'in_stock') return NextResponse.json({ error: 'Hanya nomor seri berstatus tersedia yang bisa dihapus' }, { status: 409 })

  const { error } = await auth.supabase.from('product_serials').delete().eq('id', id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ ok: true })
}
