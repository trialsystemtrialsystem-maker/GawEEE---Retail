import { formatCurrency, formatDate, formatPercent, formatDateTime } from '@/lib/utils/formatting'

describe('Formatting utilities', () => {
  describe('formatCurrency', () => {
    it('formats numbers to IDR currency', () => {
      expect(formatCurrency(1000)).toBe('Rp 1.000')
      expect(formatCurrency(1234567)).toBe('Rp 1.234.567')
      expect(formatCurrency(0)).toBe('Rp 0')
    })

    it('handles negative numbers', () => {
      expect(formatCurrency(-1000)).toBe('-Rp 1.000')
    })

    it('handles decimals', () => {
      expect(formatCurrency(1234.56)).toBe('Rp 1.235') // rounds
    })
  })

  describe('formatDate', () => {
    it('formats date to DD/MM/YYYY', () => {
      const date = new Date(2024, 9, 14) // Oct 14, 2024
      expect(formatDate(date)).toBe('14/10/2024')
    })

    it('accepts an ISO string', () => {
      expect(formatDate('2024-01-05T00:00:00')).toBe('05/01/2024')
    })
  })

  describe('formatDateTime', () => {
    it('appends HH:MM after the date', () => {
      const date = new Date(2024, 9, 14, 8, 5)
      expect(formatDateTime(date)).toBe('14/10/2024 08:05')
    })
  })

  describe('formatPercent', () => {
    it('formats decimal to percentage', () => {
      expect(formatPercent(0.42)).toBe('42%')
      expect(formatPercent(0.1234)).toBe('12.34%')
    })
  })
})
