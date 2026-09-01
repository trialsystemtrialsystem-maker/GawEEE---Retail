import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, productBundleSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/product-bundles?outlet_id= — active bundles with their component
// products (name/sku/selling_price), so the POS "quick-add bundle" action
// has everything it needs to add each line to the cart and compute the
// bundle-vs-components discount client-side.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('product_bundles')
    .select('*, product_bundle_items(id, product_id, quantity, products(name, sku, selling_price))')
    .eq('outlet_id', outletId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ bundles: data })
}

// POST /api/product-bundles — create a bundle (draft is skipped; a bundle
// is immediately active once saved, matching how simple this feature is).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(productBundleSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: bundle, error: bundleError } = await auth.supabase
    .from('product_bundles')
    .insert({
      outlet_id: result.data.outlet_id,
      name: result.data.name,
      bundle_price: result.data.bundle_price,
      created_by: auth.id,
    })
    .select()
    .single()

  if (bundleError) {
    const { status, message } = handleDatabaseError(bundleError)
    return NextResponse.json({ error: message }, { status })
  }

  const { error: itemsError } = await auth.supabase.from('product_bundle_items').insert(
    result.data.items.map((item) => ({
      bundle_id: bundle.id,
      product_id: item.product_id,
      quantity: item.quantity,
    }))
  )

  if (itemsError) {
    await auth.supabase.from('product_bundles').delete().eq('id', bundle.id)
    const { status, message } = handleDatabaseError(itemsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ bundle }, { status: 201 })
}
