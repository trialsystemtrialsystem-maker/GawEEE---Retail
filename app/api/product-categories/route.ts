import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, productCategorySchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/product-categories — no dedicated CRUD route existed for this
// table before (products.category_id has always pointed here, but
// categories themselves were only ever created via the demo seeder).
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await auth.supabase
    .from('product_categories')
    .select('*')
    .eq('company_id', auth.company_id)
    .order('name')

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ categories: data })
}

// POST /api/product-categories — manager+ only.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(productCategorySchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('product_categories')
    .insert({ ...result.data, company_id: auth.company_id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ category: data }, { status: 201 })
}
