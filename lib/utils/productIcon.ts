// Maps a product to a representative emoji icon for quick visual scanning in
// the POS and inventory tables. Works for any tenant's catalog (not just the
// demo data) by matching category/product name keywords, with a generic
// fallback — since products don't have uploaded photos yet (image_url exists
// on the table but nothing currently uploads to it).

interface IconRule {
  keywords: string[]
  icon: string
}

const ICON_RULES: IconRule[] = [
  { keywords: ['ayam', 'unggas', 'bebek', 'chicken'], icon: '🍗' },
  { keywords: ['sapi', 'daging', 'beef', 'kambing', 'rendang'], icon: '🥩' },
  { keywords: ['udang', 'cumi', 'seafood', 'ikan', 'bakso ikan', 'dori', 'kepiting'], icon: '🦐' },
  { keywords: ['sayur', 'sayuran', 'kentang', 'jagung', 'edamame', 'wortel', 'brokoli'], icon: '🥦' },
  { keywords: ['dimsum', 'siomay', 'pizza', 'spring roll', 'siap saji', 'nugget', 'katsu'], icon: '🍕' },
  { keywords: ['es krim', 'ice cream', 'dessert', 'puding', 'waffle', 'cup'], icon: '🍦' },
  { keywords: ['bakso'], icon: '🍡' },
  { keywords: ['sosis', 'sausage'], icon: '🌭' },
  { keywords: ['minuman', 'jus', 'juice', 'air', 'soda', 'teh', 'kopi'], icon: '🥤' },
  { keywords: ['roti', 'bread', 'kue', 'cake', 'bakery'], icon: '🍞' },
  { keywords: ['susu', 'milk', 'keju', 'cheese', 'yogurt'], icon: '🧀' },
  { keywords: ['buah', 'fruit'], icon: '🍎' },
  { keywords: ['snack', 'keripik', 'chips'], icon: '🍿' },
]

const DEFAULT_ICON = '📦'

export function getProductIcon(product: { name: string; categoryName?: string | null }): string {
  const haystack = `${product.categoryName ?? ''} ${product.name}`.toLowerCase()
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.icon
    }
  }
  return DEFAULT_ICON
}
