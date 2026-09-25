import { parseStockCsv } from '@/lib/utils/stockCsv'

describe('parseStockCsv', () => {
  it('reads a headed comma CSV', () => {
    const r = parseStockCsv('sku,qty\nA-1,10\nB-2,5')
    expect(r.errors).toEqual([])
    expect(r.rows).toEqual([{ line: 2, sku: 'A-1', quantity: 10 }, { line: 3, sku: 'B-2', quantity: 5 }])
  })
  it('reads a headerless spreadsheet paste (tab separated)', () => {
    const r = parseStockCsv('A-1\t10\nB-2\t0')
    expect(r.rows.map((x) => x.quantity)).toEqual([10, 0])
  })
  it('handles semicolons, column order swaps, and thousands separators', () => {
    const r = parseStockCsv('Jumlah;SKU\n1.200;A-1')
    expect(r.rows).toEqual([{ line: 2, sku: 'A-1', quantity: 1200 }])
  })
  it('reports bad quantities, blanks and duplicates per line', () => {
    const r = parseStockCsv('sku,qty\nA-1,abc\n,5\nA-2,3\nA-2,4\nA-3,1.5')
    expect(r.rows).toEqual([{ line: 4, sku: 'A-2', quantity: 3 }])
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 5, 6])
  })
  it('caps the number of rows', () => {
    const text = 'sku,qty\n' + Array.from({ length: 6 }, (_, i) => `S${i},1`).join('\n')
    const r = parseStockCsv(text, 3)
    expect(r.rows).toHaveLength(3)
    expect(r.errors.at(-1)?.message).toMatch(/Maksimal 3/)
  })
  it('returns nothing for empty input', () => {
    expect(parseStockCsv('   \n')).toEqual({ rows: [], errors: [] })
  })
})
