import type { IntervalSeries, IntervalRecord } from '../types'

/**
 * Parse a Green Button XML (ESPI/NAESB) file into an IntervalSeries.
 *
 * Green Button XML uses Atom feed format with:
 * - <entry> elements containing <content> with <IntervalBlock>
 * - Each <IntervalBlock> contains multiple <IntervalReading>
 * - Each <IntervalReading> has:
 *   - <timePeriod><start> (Unix epoch seconds)
 *   - <timePeriod><duration> (seconds, typically 900 or 3600)
 *   - <value> (Wh — watt-hours, NOT kWh)
 *
 * The powerOfTenMultiplier in ReadingType scales the value:
 *   actual Wh = value * 10^powerOfTenMultiplier
 *   Default assumption: values are in Wh (multiplier = 0)
 */
export function parseGreenButton(xml: string): IntervalSeries {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid XML: ' + parseError.textContent?.slice(0, 100))

  // Detect the power-of-ten multiplier from ReadingType if present
  let multiplier = 0
  const potNode = doc.querySelector('powerOfTenMultiplier')
  if (potNode?.textContent) {
    multiplier = parseInt(potNode.textContent, 10)
    if (isNaN(multiplier)) multiplier = 0
  }
  const scale = Math.pow(10, multiplier)

  // Extract all IntervalReadings
  const readings = doc.querySelectorAll('IntervalReading')
  if (readings.length === 0) {
    // Try namespace-aware query (some GB files use ns: prefixes)
    const altReadings = doc.getElementsByTagNameNS('*', 'IntervalReading')
    if (altReadings.length === 0) {
      throw new Error('No IntervalReading elements found in Green Button XML')
    }
    return parseReadings(altReadings, scale)
  }

  return parseReadings(readings, scale)
}

function parseReadings(readings: NodeListOf<Element> | HTMLCollectionOf<Element>, scale: number): IntervalSeries {
  const records: IntervalRecord[] = []
  let detectedDuration = 0

  for (let i = 0; i < readings.length; i++) {
    const reading = readings[i]

    // Extract start time
    const startEl = reading.querySelector('start') ||
      reading.getElementsByTagNameNS('*', 'start')[0]
    const durationEl = reading.querySelector('duration') ||
      reading.getElementsByTagNameNS('*', 'duration')[0]
    const valueEl = reading.querySelector('value') ||
      reading.getElementsByTagNameNS('*', 'value')[0]

    if (!startEl?.textContent || !valueEl?.textContent) continue

    const startEpoch = parseInt(startEl.textContent, 10)
    const duration = durationEl?.textContent ? parseInt(durationEl.textContent, 10) : 3600
    const rawValue = parseInt(valueEl.textContent, 10)

    if (isNaN(startEpoch) || isNaN(rawValue)) continue

    // Convert Wh to kWh: value * scale / 1000
    const kwh = (rawValue * scale) / 1000

    const timestamp = new Date(startEpoch * 1000)
    records.push({ timestamp, kwh })

    if (detectedDuration === 0) detectedDuration = duration
  }

  if (records.length === 0) throw new Error('No valid interval readings found in Green Button XML')

  // Sort by timestamp
  records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  // Detect resolution from duration (seconds to minutes)
  const resolution: 15 | 60 = detectedDuration <= 1200 ? 15 : 60

  return { source: 'greenbutton', resolution, records }
}

/**
 * Detect whether a file is Green Button XML (vs CSV).
 */
export function isGreenButtonXML(text: string): boolean {
  const trimmed = text.trim().slice(0, 500)
  return trimmed.startsWith('<?xml') || trimmed.includes('<feed') || trimmed.includes('IntervalBlock') || trimmed.includes('IntervalReading')
}
