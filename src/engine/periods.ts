import type { RatePlan, PeriodDef, PeriodSegment } from '../types'

// Build period matchers from a rate plan's period definitions
export function buildPeriodDefs(plan: RatePlan): PeriodDef[] {
  // Map period structure to colors
  const colorMap: Record<string, string> = {
    flat: '--p-flat',
    peak: '--p-peak',
    mid: '--p-mid',
    off: '--p-off',
    super: '--p-super',
  }
  const labelMap: Record<string, string> = {
    flat: 'All hours',
    peak: 'On-peak',
    mid: 'Mid-peak',
    off: 'Off-peak',
    super: 'Super off-peak',
  }

  const defs: PeriodDef[] = []
  // Sort periods so catch-all (hours [0,24]) comes last
  const entries = Object.entries(plan.periods).sort((a, b) => {
    const aIsCatchAll = a[1].hours[0] === 0 && a[1].hours[1] === 24
    const bIsCatchAll = b[1].hours[0] === 0 && b[1].hours[1] === 24
    if (aIsCatchAll && !bIsCatchAll) return 1
    if (!aIsCatchAll && bIsCatchAll) return -1
    return 0
  })

  for (const [key, def] of entries) {
    const [start, end] = def.hours
    defs.push({
      key,
      label: labelMap[key] || key,
      color: colorMap[key] || '--p-flat',
      match: (hour: number, isWeekend: boolean) => {
        if (def.weekendsOff && isWeekend) return false
        // Handle wrap-around (e.g., super off-peak 23:00-07:00)
        if (start > end) {
          return hour >= start || hour < end
        }
        // Catch-all period [0, 24]
        if (start === 0 && end === 24) return true
        return hour >= start && hour < end
      },
    })
  }
  return defs
}

// Cache period defs per plan ID to avoid rebuilding on every classify() call
const _defsCache = new Map<string, PeriodDef[]>()

function getDefsForPlan(plan: RatePlan): PeriodDef[] {
  const cached = _defsCache.get(plan.id)
  if (cached) return cached
  const defs = buildPeriodDefs(plan)
  _defsCache.set(plan.id, defs)
  return defs
}

export function classify(plan: RatePlan, hour: number, isWeekend: boolean): string {
  const defs = getDefsForPlan(plan)
  if (defs.length === 0) return 'flat'
  for (const d of defs) {
    if (d.match(hour, isWeekend)) return d.key
  }
  return defs[defs.length - 1].key
}

export function periodSegments(plan: RatePlan, isWeekend: boolean): PeriodSegment[] {
  const defs = buildPeriodDefs(plan)
  const byKey = Object.fromEntries(defs.map(d => [d.key, d]))
  const segs: PeriodSegment[] = []
  let cur: PeriodSegment | null = null
  // Use integer iteration to avoid floating-point drift with fractional step
  for (let i = 0; i < 96; i++) {
    const h = i * 0.25
    // +0.001 epsilon avoids boundary ambiguity at exact hour transitions
    const k = classify(plan, h + 0.001, isWeekend)
    if (!cur || cur.key !== k) {
      cur = { key: k, label: byKey[k].label, color: byKey[k].color, start: h, end: h + 0.25 }
      segs.push(cur)
    } else {
      cur.end = h + 0.25
    }
  }
  return segs
}

// Human-friendly label for period structure
export const STRUCTURE_LABELS: Record<string, string> = {
  'flat': 'Flat',
  'tou-2': 'TOU 2-period',
  'tou-3': 'TOU 3-period',
}

/** Get the all-in rate for each hour of a weekday (24 values). Used for catalog sparklines. */
export function getRateByHour(plan: RatePlan): number[] {
  const out: number[] = []
  for (let h = 0; h < 24; h++) {
    const k = classify(plan, h + 0.5, false)
    const rt = plan.rates[k] || plan.rates.flat || plan.rates.off
    const delivRate = rt ? (typeof rt.delivery === 'number' ? rt.delivery : rt.delivery[0]?.rate ?? 0) : 0
    out.push(rt ? rt.supply + delivRate : 0)
  }
  return out
}

export function structureLabel(plan: RatePlan): string {
  let label = STRUCTURE_LABELS[plan.periodStructure] || plan.periodStructure
  if (plan.hasDemand) label += ' + demand'
  return label
}
