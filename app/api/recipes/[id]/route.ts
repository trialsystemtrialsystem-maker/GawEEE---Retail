import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/recipes/:id — recipe + its ingredient list.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/recipes/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: recipe, error: recipeError } = await auth.supabase
    .from('recipes')
    .select('*, products!recipes_output_product_id_fkey(name)')
    .eq('id', id)
    .single()

  if (recipeError) {
    const { status, message } = handleDatabaseError(recipeError)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: ingredients, error: ingredientsError } = await auth.supabase
    .from('recipe_ingredients')
    .select('*, products(name)')
    .eq('recipe_id', id)

  if (ingredientsError) {
    const { status, message } = handleDatabaseError(ingredientsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ recipe, ingredients })
}
