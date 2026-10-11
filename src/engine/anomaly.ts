import type { IntervalSeries, IntervalRecord } from '../types'

/**
 * Anomaly detection for uploaded interval data.
 * Flags data quality issues and detects appliance signatures.
 * All statistical — no ML, fully deterministic.
 */

export interface Anomaly {
  type: 'gap' | 'duplicate' | 'spike' | 'zero-run' | 'negative' | 'unit-suspect' | 'dst' | 'ev-signature' | 'hp-signature' | 'solar-signature'
  severity: 'error' | 'warning' | 'info'
  message: string
  startIdx?: number
  endIdx?: number
  timestamp?: string
}

/**
 * Run all anomaly checks on an interval series.
 */
export function detectAnomalies(series: IntervalSeries): Anomaly[] {
  const anomalies: Anomaly[] = []
  const records = series.records
  if (records.length < 24) return anomalies

  anomalies.push(...detectGaps(records, series.resolution))
  anomalies.push(...detectDuplicates(records))
  anomalies.push(...detectSpikes(records, series.resolution))
  anomalies.push(...detectZeroRuns(records, series.resolution))
  anomalies.push(...detectNegatives(records))
  anomalies.push(...detectUnitErrors(records, series.resolution))
  anomalies.push(...detectDST(records))
  anomalies.push(...detectEVSignature(records, series.resolution))
  anomalies.push(...detectHeatPumpSignature(records, series.resolution))
  anomalies.push(...detectSolarSignature(records))

  return anomalies
}

/**
 * Detect gaps in the time series (missing intervals).
 */
function detectGaps(records: IntervalRecord[], resolution: number): Anomaly[] {
  const anomalies: Anomaly[] = []
  const expectedMs = resolution * 60 * 1000
  const tolerance = expectedMs * 0.5

  for (let i = 1; i < records.length; i++) {
    const delta = records[i].timestamp.getTime() - records[i - 1].timestamp.getTime()
    if (delta > expectedMs + tolerance) {
      const gapHours = (delta - expectedMs) / 3600000
      anomalies.push({
        type: 'gap',
        severity: gapHours > 24 ? 'error' : 'warning',
        message: `${gapHours.toFixed(1)}h gap between intervals`,
        startIdx: i - 1,
        endIdx: i,
        timestamp: records[i - 1].timestamp.toISOString(),
      })
    }
  }
  return anomalies
}

/**
 * Detect duplicate timestamps.
 */
function detectDuplicates(records: IntervalRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  const seen = new Set<number>()

  for (let i = 0; i < records.length; i++) {
    const ts = records[i].timestamp.getTime()
    if (seen.has(ts)) {
      anomalies.push({
        type: 'duplicate',
        severity: 'warning',
        message: 'Duplicate timestamp',
        startIdx: i,
        timestamp: records[i].timestamp.toISOString(),
      })
    }
    seen.add(ts)
  }
  return anomalies
}

/**
 * Detect extreme spikes (values > 5 standard deviations from mean).
 */
function detectSpikes(records: IntervalRecord[], resolution: number): Anomaly[] {
  const anomalies: Anomaly[] = []
  const values = records.map(r => r.kwh)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const stddev = Math.sqrt(variance)

  if (stddev === 0) return anomalies

  const threshold = mean + 5 * stddev
  const factor = resolution === 15 ? 4 : 1

  for (let i = 0; i < records.length; i++) {
    if (records[i].kwh > threshold) {
      anomalies.push({
        type: 'spike',
        severity: 'warning',
        message: `Extreme spike: ${(records[i].kwh * factor).toFixed(1)} kW (${(records[i].kwh / mean).toFixed(0)}× average)`,
        startIdx: i,
        timestamp: records[i].timestamp.toISOString(),
      })
    }
  }
  return anomalies
}

/**
 * Detect runs of zero consumption (meter offline?).
 */
function detectZeroRuns(records: IntervalRecord[], resolution: number): Anomaly[] {
  const anomalies: Anomaly[] = []
  const minRunHours = 6
  const minRunIntervals = (minRunHours * 60) / resolution

  let runStart = -1
  for (let i = 0; i < records.length; i++) {
    if (records[i].kwh === 0) {
      if (runStart === -1) runStart = i
    } else {
      if (runStart !== -1 && i - runStart >= minRunIntervals) {
        const hours = ((i - runStart) * resolution) / 60
        anomalies.push({
          type: 'zero-run',
          severity: hours > 24 ? 'error' : 'warning',
          message: `${hours.toFixed(0)}h of zero consumption (meter offline?)`,
          startIdx: runStart,
          endIdx: i - 1,
          timestamp: records[runStart].timestamp.toISOString(),
        })
      }
      runStart = -1
    }
  }
  return anomalies
}

/**
 * Detect negative consumption values (possible export mislabeled as negative).
 */
function detectNegatives(records: IntervalRecord[]): Anomaly[] {
  const negCount = records.filter(r => r.kwh < 0).length
  if (negCount === 0) return []

  const pct = (negCount / records.length * 100).toFixed(1)
  return [{
    type: 'negative',
    severity: 'warning',
    message: `${negCount} negative values (${pct}% of data) — possible solar export mislabeled as negative consumption`,
    startIdx: records.findIndex(r => r.kwh < 0),
  }]
}

/**
 * Detect likely Wh-vs-kWh unit error (values suspiciously large or small).
 */
function detectUnitErrors(records: IntervalRecord[], resolution: number): Anomaly[] {
  const factor = resolution === 15 ? 4 : 1
  const medianKw = sortedMedian(records.map(r => r.kwh * factor))

  if (medianKw > 100) {
    return [{
      type: 'unit-suspect',
      severity: 'error',
      message: `Median demand is ${medianKw.toFixed(0)} kW — data may be in Wh instead of kWh (divide by 1000)`,
    }]
  }
  if (medianKw > 0 && medianKw < 0.01) {
    return [{
      type: 'unit-suspect',
      severity: 'error',
      message: `Median demand is ${(medianKw * 1000).toFixed(1)} W — data may be in MWh instead of kWh (multiply by 1000)`,
    }]
  }
  return []
}

/**
 * Detect DST transition issues (spring forward / fall back).
 */
function detectDST(records: IntervalRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  for (let i = 1; i < records.length; i++) {
    const prevOffset = records[i - 1].timestamp.getTimezoneOffset()
    const currOffset = records[i].timestamp.getTimezoneOffset()
    if (prevOffset !== currOffset) {
      anomalies.push({
        type: 'dst',
        severity: 'info',
        message: `DST transition detected (UTC offset ${-prevOffset / 60}h → ${-currOffset / 60}h)`,
        startIdx: i,
        timestamp: records[i].timestamp.toISOString(),
      })
    }
  }
  return anomalies
}

/**
 * Detect EV charging signature: high overnight block loads (23:00-05:00).
 */
function detectEVSignature(records: IntervalRecord[], resolution: number): Anomaly[] {
  const factor = resolution === 15 ? 4 : 1
  const overnightRecords = records.filter(r => {
    const h = r.timestamp.getHours()
    return h >= 23 || h < 5
  })
  const dayRecords = records.filter(r => {
    const h = r.timestamp.getHours()
    return h >= 8 && h < 20
  })

  if (overnightRecords.length === 0 || dayRecords.length === 0) return []

  const overnightAvg = overnightRecords.reduce((s, r) => s + r.kwh, 0) / overnightRecords.length * factor
  const dayAvg = dayRecords.reduce((s, r) => s + r.kwh, 0) / dayRecords.length * factor

  // EV signature: overnight average is significantly higher than daytime AND above 3 kW
  if (overnightAvg > dayAvg * 1.5 && overnightAvg > 3) {
    return [{
      type: 'ev-signature',
      severity: 'info',
      message: `Probable EV charging detected: overnight avg ${overnightAvg.toFixed(1)} kW vs daytime ${dayAvg.toFixed(1)} kW — consider EV-specific rate plans`,
    }]
  }
  return []
}

/**
 * Detect heat pump signature: high correlation between cold months and electric consumption.
 */
function detectHeatPumpSignature(records: IntervalRecord[], _resolution: number): Anomaly[] {
  // Group by month, compare winter (Dec-Feb) to summer (Jun-Aug) consumption
  const monthlyKwh = new Array(12).fill(0)
  const monthlyCounts = new Array(12).fill(0)

  for (const r of records) {
    const m = r.timestamp.getMonth()
    monthlyKwh[m] += r.kwh
    monthlyCounts[m]++
  }

  const winterMonths = [11, 0, 1] // Dec, Jan, Feb
  const summerMonths = [5, 6, 7] // Jun, Jul, Aug

  const winterAvg = winterMonths.reduce((s, m) => s + (monthlyCounts[m] > 0 ? monthlyKwh[m] / monthlyCounts[m] : 0), 0) / 3
  const summerAvg = summerMonths.reduce((s, m) => s + (monthlyCounts[m] > 0 ? monthlyKwh[m] / monthlyCounts[m] : 0), 0) / 3

  if (summerAvg === 0) return []

  const ratio = winterAvg / summerAvg

  // Heat pump signature: winter consumption 2x+ summer
  if (ratio > 2.0) {
    return [{
      type: 'hp-signature',
      severity: 'info',
      message: `Probable electric heating: winter consumption ${ratio.toFixed(1)}× summer — consider heat pump rate plans`,
    }]
  }
  return []
}

/**
 * Detect solar generation signature: consistent midday dips or negative net values.
 */
function detectSolarSignature(records: IntervalRecord[]): Anomaly[] {
  const middayRecords = records.filter(r => {
    const h = r.timestamp.getHours()
    return h >= 10 && h < 15
  })
  const morningRecords = records.filter(r => {
    const h = r.timestamp.getHours()
    return h >= 6 && h < 9
  })

  if (middayRecords.length === 0 || morningRecords.length === 0) return []

  const middayAvg = middayRecords.reduce((s, r) => s + r.kwh, 0) / middayRecords.length
  const morningAvg = morningRecords.reduce((s, r) => s + r.kwh, 0) / morningRecords.length

  // Solar signature: midday consumption significantly lower than morning
  if (morningAvg > 0 && middayAvg < morningAvg * 0.5) {
    return [{
      type: 'solar-signature',
      severity: 'info',
      message: `Probable solar generation: midday consumption ${((1 - middayAvg / morningAvg) * 100).toFixed(0)}% below morning — exports may offset bills`,
    }]
  }

  // Also check for negative values during midday (clear solar export)
  const middayNegatives = middayRecords.filter(r => r.kwh < 0).length
  if (middayNegatives > middayRecords.length * 0.1) {
    return [{
      type: 'solar-signature',
      severity: 'info',
      message: `Solar export detected: ${((middayNegatives / middayRecords.length) * 100).toFixed(0)}% of midday intervals show negative consumption (export)`,
    }]
  }

  return []
}

function sortedMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
