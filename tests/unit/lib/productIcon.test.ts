import { getProductIcon } from '@/lib/utils/productIcon'

describe('getProductIcon', () => {
  it('matches a keyword in the product name', () => {
    expect(getProductIcon({ name: 'Nugget Ayam 500gr' })).toBe('🍗')
    expect(getProductIcon({ name: 'Rendang Sapi Beku' })).toBe('🥩')
  })

  it('matches a keyword in the category name when the product name has none', () => {
    expect(getProductIcon({ name: 'Produk Spesial', categoryName: 'Seafood Beku' })).toBe('🦐')
  })

  it('is case-insensitive', () => {
    expect(getProductIcon({ name: 'AYAM GORENG' })).toBe('🍗')
  })

  it('falls back to the default icon when nothing matches', () => {
    expect(getProductIcon({ name: 'Barang Tanpa Kategori Jelas' })).toBe('📦')
  })

  it('checks rules in order, so an earlier rule wins on a name matching multiple', () => {
    // "Bakso Ikan" is explicitly listed under seafood (🦐), ahead of the
    // standalone "bakso" rule (🍡) later in ICON_RULES — first match wins.
    expect(getProductIcon({ name: 'Bakso Ikan 500gr' })).toBe('🦐')
  })

  it('handles a missing categoryName without throwing', () => {
    expect(getProductIcon({ name: 'Es Krim Coklat' })).toBe('🍦')
  })
})
