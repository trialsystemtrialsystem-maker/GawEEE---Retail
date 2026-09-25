import { parseCsvTable, parseNumber } from '@/lib/utils/csvTable'

describe('parseCsvTable', () => {
  it('reads headers case-insensitively and rows by name', () => {
    const t = parseCsvTable('SKU,Nama,Harga\nA-1,Kopi,15000\nB-2,Teh,10000')
    expect(t.headers).toEqual(['sku', 'nama', 'harga'])
    expect(t.rows[1]).toEqual({ line: 3, values: { sku: 'B-2', nama: 'Teh', harga: '10000' } })
  })
  it('handles semicolons, tabs, quotes with delimiters, CRLF and blank lines', () => {
    expect(parseCsvTable('a;b\r\n1;2\r\n\r\n3;4').rows.map((r) => r.values)).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }])
    expect(parseCsvTable('a\tb\n1\t2').rows[0].values).toEqual({ a: '1', b: '2' })
    expect(parseCsvTable('nama,catatan\n"Kopi, susu","dia bilang ""ok"""').rows[0].values).toEqual({ nama: 'Kopi, susu', catatan: 'dia bilang "ok"' })
  })
  it('pads short rows and caps the row count', () => {
    expect(parseCsvTable('a,b,c\n1').rows[0].values).toEqual({ a: '1', b: '', c: '' })
    expect(parseCsvTable('a\n1\n2\n3', 2).rows).toHaveLength(2)
  })
  it('returns nothing for empty input', () => {
    expect(parseCsvTable('  \n')).toEqual({ headers: [], rows: [] })
  })
})

describe('parseNumber', () => {
  it('reads Indonesian and plain formats', () => {
    expect(parseNumber('1.500.000')).toBe(1500000)
    expect(parseNumber('1500000')).toBe(1500000)
    expect(parseNumber('1.500,50')).toBe(1500.5)
    expect(parseNumber('2,5')).toBe(2.5)
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
  })
})
