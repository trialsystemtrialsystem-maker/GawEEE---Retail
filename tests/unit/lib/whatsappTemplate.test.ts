import { placeholdersIn, renderTemplate, unknownPlaceholders, whatsappLink } from '@/lib/utils/whatsappTemplate'

describe('templates', () => {
  it('finds and validates placeholders', () => {
    expect(placeholdersIn('Halo {nama}, {toko} {Nama}')).toEqual(['nama', 'toko'])
    expect(unknownPlaceholders('Halo {nama} {nmaa}')).toEqual(['nmaa'])
  })
  it('renders known placeholders and leaves unknown ones visible', () => {
    expect(renderTemplate('Halo {nama}, pesanan {invoice} senilai {total}. {oops}', { nama: 'Budi', invoice: 'INV-1', total: 'Rp 50.000' })).toBe('Halo Budi, pesanan INV-1 senilai Rp 50.000. {oops}')
  })
  it('tidies the gap when a known placeholder has no value', () => {
    expect(renderTemplate('Halo {nama} , pesanan {invoice} siap.', { nama: 'Ani' })).toBe('Halo Ani, pesanan siap.')
  })
})

describe('whatsappLink', () => {
  it('normalizes Indonesian numbers and encodes the text', () => {
    expect(whatsappLink('0812-3456-7890', 'Halo & terima kasih')).toBe('https://wa.me/6281234567890?text=Halo%20%26%20terima%20kasih')
  })
  it('returns null for unusable numbers', () => {
    expect(whatsappLink('', 'x')).toBeNull()
    expect(whatsappLink('123', 'x')).toBeNull()
  })
})
