import type { IntervalSeries, IntervalRecord } from '../types'

/**
 * Parse a CSV file into an IntervalSeries.
 *
 * Supported formats:
 * 1. Single column: kWh values, one per row (8760 hourly or 35040 quarter-hour)
 *    - Assumes Jan 1 00:00 start, sequential intervals
 * 2. Two columns: timestamp, kWh
 *    - Timestamp formats: ISO 8601, MM/DD/YYYY HH:MM, YYYY-MM-DD HH:MM
 * 3. Header row is auto-detected and skipped
 */
export function parseCSV(text: string): IntervalSeries {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) throw new Error('CSV file is empty')

  // Detect delimiter
  const delim = lines[0].includes('\t') ? '\t' : ','

  // Parse first line to detect header
  const firstCells = lines[0].split(delim).map(s => s.trim().replace(/^"|"$/g, ''))
  const hasHeader = isNaN(parseFloat(firstCells[firstCells.length - 1]))
  const dataLines = hasHeader ? lines.slice(1) : lines

  if (dataLines.length === 0) throw new Error('CSV file has no data rows')

  // Detect format: single column (kWh only) vs multi-column (timestamp + kWh)
  const firstDataCells = dataLines[0].split(delim).map(s => s.trim().replace(/^"|"$/g, ''))
  const isSingleColumn = firstDataCells.length === 1 || (firstDataCells.length === 2 && !isNaN(parseFloat(firstDataCells[0])) && !isNaN(parseFloat(firstDataCells[1])))

  let records: IntervalRecord[]
  let resolution: 15 | 60

  if (isSingleColumn) {
    // Single column: just kWh values
    const values = dataLines.map((line, i) => {
      const v = parseFloat(line.split(delim)[0].trim().replace(/^"|"$/g, ''))
      if (isNaN(v)) throw new Error(`Invalid number on row ${i + (hasHeader ? 2 : 1)}: "${line}"`)
      return v
    })

    // Detect resolution from row count
    if (values.length >= 35000 && values.length <= 35136) {
      resolution = 15
    } else if (values.length >= 8700 && values.length <= 8784) {
      resolution = 60
    } else {
      throw new Error(`Expected ~8760 (hourly) or ~35040 (15-min) rows, got ${values.length}`)
    }

    // Generate timestamps starting Jan 1 00:00
    const year = new Date().getFullYear()
    const intervalMs = resolution * 60 * 1000
    const start = new Date(year, 0, 1, 0, 0, 0)
    records = values.map((kwh, i) => ({
      timestamp: new Date(start.getTime() + i * intervalMs),
      kwh,
    }))
  } else {
    // Multi-column: first column is timestamp, last numeric column is kWh
    records = dataLines.map((line, i) => {
      const cells = line.split(delim).map(s => s.trim().replace(/^"|"$/g, ''))
      const timestamp = parseTimestamp(cells[0])
      if (!timestamp) throw new Error(`Invalid timestamp on row ${i + (hasHeader ? 2 : 1)}: "${cells[0]}"`)

      // Find the kWh value — use the last numeric column
      let kwh = NaN
      for (let c = cells.length - 1; c >= 1; c--) {
        const v = parseFloat(cells[c])
        if (!isNaN(v)) { kwh = v; break }
      }
      if (isNaN(kwh)) throw new Error(`No numeric value found on row ${i + (hasHeader ? 2 : 1)}`)

      return { timestamp, kwh }
    })

    // Detect resolution from first two timestamps
    if (records.length >= 2) {
      const diffMin = (records[1].timestamp.getTime() - records[0].timestamp.getTime()) / 60000
      resolution = diffMin <= 20 ? 15 : 60
    } else {
      resolution = 60
    }
  }

  return { source: 'csv', resolution, records }
}

function parseTimestamp(s: string): Date | null {
  // Try ISO 8601 first
  const iso = new Date(s)
  if (!isNaN(iso.getTime()) && s.length > 6) return iso

  // Try MM/DD/YYYY HH:MM or MM/DD/YYYY HH:MM:SS
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (us) {
    return new Date(parseInt(us[3]), parseInt(us[1]) - 1, parseInt(us[2]), parseInt(us[4]), parseInt(us[5]), parseInt(us[6] || '0'))
  }

  // Try YYYY-MM-DD HH:MM
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (ymd) {
    return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]), parseInt(ymd[4]), parseInt(ymd[5]), parseInt(ymd[6] || '0'))
  }

  return null
}

/**
 * Summarize an uploaded interval series for display.
 */
export function summarizeCSV(series: IntervalSeries): {
  totalKwh: number
  peakKw: number
  days: number
  startDate: string
  endDate: string
} {
  const totalKwh = series.records.reduce((s, r) => s + r.kwh, 0)
  const factor = series.resolution === 15 ? 4 : 1 // kWh to kW conversion
  const peakKw = series.records.reduce((max, r) => Math.max(max, r.kwh * factor), 0)
  const days = Math.round(series.records.length / (series.resolution === 15 ? 96 : 24))
  const startDate = series.records[0]?.timestamp.toLocaleDateString() || ''
  const endDate = series.records[series.records.length - 1]?.timestamp.toLocaleDateString() || ''
  return { totalKwh, peakKw, days, startDate, endDate }
}
