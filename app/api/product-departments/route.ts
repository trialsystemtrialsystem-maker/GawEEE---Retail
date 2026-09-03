import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, productDepartmentSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/product-departments
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await auth.supabase
    .from('product_departments')
    .select('*')
    .eq('company_id', auth.company_id)
    .order('sort_order')

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ departments: data })
}

// POST /api/product-departments — manager+ only.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(productDepartmentSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('product_departments')
    .insert({ ...result.data, company_id: auth.company_id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ department: data }, { status: 201 })
}
