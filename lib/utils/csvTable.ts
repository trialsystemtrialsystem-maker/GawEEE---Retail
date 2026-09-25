// Small, dependency-free CSV/TSV reader for imports: header row -> objects.
// Handles comma / semicolon / tab, quoted cells with embedded delimiters and
// doubled quotes, CRLF, and drops fully blank lines. Header names are
// lower-cased and trimmed, so "SKU", " sku " and "Sku" all read as `sku`.

function detectDelimiter(line: string): string {
  const counts: [string, number][] = [
    ['\t', line.split('\t').length],
    [';', line.split(';').length],
    [',', line.split(',').length],
  ]
  return counts.sort((a, b) => b[1] - a[1])[0][0]
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

export interface CsvTable {
  headers: string[]
  rows: { line: number; values: Record<string, string> }[]
}

export function parseCsvTable(text: string, maxRows = 1000): CsvTable {
  const lines = text.replace(/\r/g, '').split('\n')
  const firstIdx = lines.findIndex((l) => l.trim() !== '')
  if (firstIdx < 0) return { headers: [], rows: [] }
  const delimiter = detectDelimiter(lines[firstIdx])
  const headers = splitLine(lines[firstIdx], delimiter).map((h) => h.toLowerCase())
  const rows: CsvTable['rows'] = []
  for (let i = firstIdx + 1; i < lines.length && rows.length < maxRows; i++) {
    if (lines[i].trim() === '') continue
    const cells = splitLine(lines[i], delimiter)
    rows.push({ line: i + 1, values: Object.fromEntries(headers.map((h, idx) => [h, cells[idx] ?? ''])) })
  }
  return { headers, rows }
}

/** '1.500.000' / '1500000' / '1500,50' -> number; NaN when not numeric. */
export function parseNumber(raw: string): number {
  const t = raw.trim()
  if (t === '') return NaN
  const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(',', '.')
  return Number(normalized)
}
