import { rowsToCsv } from '@/lib/utils/exportCsv'

describe('rowsToCsv', () => {
  it('returns an empty string for no rows', () => {
    expect(rowsToCsv([])).toBe('')
  })

  it('builds a header row from the first object\'s keys', () => {
    expect(rowsToCsv([{ name: 'Nugget', price: 25000 }])).toBe('name,price\r\nNugget,25000')
  })

  it('joins multiple rows with CRLF', () => {
    const csv = rowsToCsv([
      { name: 'Nugget', price: 25000 },
      { name: 'Sosis', price: 18000 },
    ])
    expect(csv).toBe('name,price\r\nNugget,25000\r\nSosis,18000')
  })

  it('quotes a value containing a comma', () => {
    expect(rowsToCsv([{ note: 'Beku, siap saji' }])).toBe('note\r\n"Beku, siap saji"')
  })

  it('quotes a value containing a newline', () => {
    expect(rowsToCsv([{ note: 'Baris satu\nBaris dua' }])).toBe('note\r\n"Baris satu\nBaris dua"')
  })

  it('quotes and doubles embedded quotes', () => {
    expect(rowsToCsv([{ note: 'Ukuran 12"' }])).toBe('note\r\n"Ukuran 12"""')
  })

  it('renders null/undefined as an empty field', () => {
    expect(rowsToCsv([{ note: null }, { note: undefined }])).toBe('note\r\n\r\n')
  })

  it('leaves a plain value unquoted', () => {
    expect(rowsToCsv([{ qty: 5 }])).toBe('qty\r\n5')
  })
})
