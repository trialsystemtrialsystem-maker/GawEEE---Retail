// Parses pasted/uploaded stock CSV for Impor Stok. Accepts comma, semicolon or
// tab separated text (spreadsheet paste), with or without a header row, and
// Indonesian/plain number formats. Pure so it can be unit-tested.

export interface StockCsvRow {
  line: number
  sku: string
  quantity: number
}

export interface StockCsvResult {
  rows: StockCsvRow[]
  errors: { line: number; message: string }[]
}

function detectDelimiter(header: string): string {
  const counts = { '\t': header.split('\t').length, ';': header.split(';').length, ',': header.split(',').length }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as string
}

export function parseStockCsv(text: string, maxRows = 500): StockCsvResult {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '')
  const result: StockCsvResult = { rows: [], errors: [] }
  if (lines.length === 0) return result

  const delimiter = detectDelimiter(lines[0])
  const cells = (l: string) => l.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''))
  const first = cells(lines[0]).map((c) => c.toLowerCase())
  const looksLikeHeader = first.some((c) => ['sku', 'kode', 'produk'].includes(c)) || Number.isNaN(Number(first[1]?.replace(',', '.')))
  const skuCol = Math.max(0, first.findIndex((c) => ['sku', 'kode'].includes(c)))
  let qtyCol = first.findIndex((c) => ['qty', 'quantity', 'jumlah', 'stok', 'stock'].includes(c))
  if (qtyCol < 0) qtyCol = skuCol === 0 ? 1 : 0

  const start = looksLikeHeader ? 1 : 0
  const seen = new Set<string>()
  for (let i = start; i < lines.length; i++) {
    const lineNo = i + 1
    if (result.rows.length >= maxRows) {
      result.errors.push({ line: lineNo, message: `Maksimal ${maxRows} baris per impor` })
      break
    }
    const c = cells(lines[i])
    const sku = c[skuCol]
    const raw = c[qtyCol]
    if (!sku) {
      result.errors.push({ line: lineNo, message: 'SKU kosong' })
      continue
    }
    // '1.200' is a thousands separator, but '1.5' is a decimal (and so invalid here).
    const normalized = /^\d{1,3}(\.\d{3})+$/.test(raw ?? '') ? (raw as string).replace(/\./g, '') : (raw ?? '').replace(',', '.')
    const qty = Number(normalized)
    if (raw === undefined || raw === '' || !Number.isFinite(qty) || !Number.isInteger(qty)) {
      result.errors.push({ line: lineNo, message: `Jumlah tidak valid untuk ${sku}: "${raw ?? ''}"` })
      continue
    }
    if (seen.has(sku.toLowerCase())) {
      result.errors.push({ line: lineNo, message: `SKU ${sku} muncul lebih dari sekali` })
      continue
    }
    seen.add(sku.toLowerCase())
    result.rows.push({ line: lineNo, sku, quantity: qty })
  }
  return result
}
