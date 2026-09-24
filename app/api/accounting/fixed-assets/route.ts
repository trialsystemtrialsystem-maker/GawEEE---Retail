import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { postJournal } from '@/lib/utils/journalPosting'
import { bookValue } from '@/lib/utils/depreciation'

const createSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().trim().min(2, 'Nama aset wajib diisi').max(200),
  category: z.string().trim().max(100).optional(),
  acquisition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cost: z.number().positive('Harga perolehan harus lebih dari 0'),
  salvage_value: z.number().min(0).default(0),
  useful_life_months: z.number().int().min(1).max(600),
  // How it was paid; 'none' records the asset without a purchase journal
  // (e.g. opening balance already booked elsewhere).
  pay_from: z.enum(['cash', 'bank', 'none']).default('none'),
  notes: z.string().trim().max(500).optional(),
})

// GET /api/accounting/fixed-assets?outlet_id= — register with accumulated
// depreciation and book value per asset.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data: assets, error } = await auth.supabase.from('fixed_assets').select('*').eq('outlet_id', outletId).order('acquisition_date', { ascending: false })
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  const ids = (assets ?? []).map((a) => a.id)
  const accumulated = new Map<string, number>()
  if (ids.length) {
    const { data: deps } = await auth.supabase.from('asset_depreciations').select('asset_id, amount').in('asset_id', ids)
    for (const d of deps ?? []) accumulated.set(d.asset_id, (accumulated.get(d.asset_id) ?? 0) + d.amount)
  }
  return NextResponse.json({
    assets: (assets ?? []).map((a) => ({ ...a, accumulated_depreciation: accumulated.get(a.id) ?? 0, book_value: bookValue(a, accumulated.get(a.id) ?? 0) })),
  })
}

// POST /api/accounting/fixed-assets — register an asset; optionally books the
// purchase (Dr Aset Tetap 1500 / Cr Kas 1000 or Bank 1010).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'journal.post'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(createSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { pay_from, ...input } = result.data
  if (!canAccessOutlet(auth, input.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  if (input.salvage_value >= input.cost) return NextResponse.json({ error: 'Nilai sisa harus lebih kecil dari harga perolehan' }, { status: 400 })

  const { data: asset, error } = await auth.supabase.from('fixed_assets').insert({ ...input, created_by: auth.id }).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  if (pay_from !== 'none') {
    await postJournal(auth.supabase, {
      outletId: input.outlet_id,
      createdBy: auth.id,
      date: input.acquisition_date,
      description: `Pembelian aset tetap: ${input.name}`,
      sourceType: 'asset_purchase',
      sourceId: asset.id,
      lines: [
        { code: '1500', debit: input.cost },
        { code: pay_from === 'cash' ? '1000' : '1010', credit: input.cost },
      ],
    })
  }
  return NextResponse.json({ asset }, { status: 201 })
}
