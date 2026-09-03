import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/product-modifiers — groups + nested options for the caller's
// company (RLS-scoped), optionally filtered to one product. Fetched once by
// the POS screen (small dataset) to build a product_id -> groups map, and by
// the manager editor for a single product.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const productId = request.nextUrl.searchParams.get('product_id')
  let query = auth.supabase
    .from('product_modifier_groups')
    .select('*, product_modifier_options(*, products(name, sku, selling_price))')
    .order('sort_order')
  if (productId) query = query.eq('product_id', productId)

  const { data, error } = await query

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ groups: data })
}
