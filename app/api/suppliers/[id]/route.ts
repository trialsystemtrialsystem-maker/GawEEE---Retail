import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// Whitelisted, all optional: the previous version passed the raw request body
// to .update(), so a caller could overwrite columns like company_id.
const updateSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama supplier wajib diisi').max(255),
    contact_person: z.string().trim().max(255).nullable(),
    phone: z.string().trim().max(20).nullable(),
    email: z.string().trim().email('Email tidak valid').max(255).nullable().or(z.literal('')),
    address: z.string().trim().max(500).nullable(),
    city: z.string().trim().max(100).nullable(),
    payment_terms: z.number().int().min(0).max(365).nullable(),
    bank_name: z.string().trim().max(100).nullable(),
    bank_account_name: z.string().trim().max(255).nullable(),
    bank_account_number: z.string().trim().max(50).nullable(),
    tax_id: z.string().trim().max(50).nullable(),
    rating: z.number().min(0).max(5).nullable(),
    is_preferred: z.boolean(),
    status: z.enum(['active', 'inactive']),
  })
  .partial()

// PUT /api/suppliers/:id — see prd.md §4.5
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/suppliers/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const result = validate(updateSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  if (Object.keys(result.data).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('suppliers')
    .update({ ...result.data, email: result.data.email === '' ? null : result.data.email })
    .eq('id', id)
    .eq('company_id', auth.company_id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ supplier: data })
}
