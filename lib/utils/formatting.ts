export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount)
  const sign = rounded < 0 ? '-' : ''
  const formatted = new Intl.NumberFormat('id-ID').format(Math.abs(rounded))
  return `${sign}Rp ${formatted}`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(d)} ${hours}:${minutes}`
}

export function formatPercent(fraction: number): string {
  const value = fraction * 100
  const rounded = Math.round(value * 100) / 100
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded}%`
}
