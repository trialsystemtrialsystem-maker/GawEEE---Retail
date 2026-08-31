import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createRecipeSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/recipes?outlet_id=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('recipes')
    .select('*, products!recipes_output_product_id_fkey(name)')
    .eq('outlet_id', outletId)
    .order('name')

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ recipes: data })
}

// POST /api/recipes — manager+ only. Creates a recipe with its ingredient
// list (sequential inserts, same low-stakes trade-off as PO creation — this
// is a definition, not yet a stock movement).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(createRecipeSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { ingredients, ...recipeFields } = result.data

  const { data: recipe, error } = await auth.supabase
    .from('recipes')
    .insert({ ...recipeFields, created_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const { error: ingredientsError } = await auth.supabase
    .from('recipe_ingredients')
    .insert(ingredients.map((i) => ({ ...i, recipe_id: recipe.id })))

  if (ingredientsError) {
    const { status, message } = handleDatabaseError(ingredientsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ recipe }, { status: 201 })
}
