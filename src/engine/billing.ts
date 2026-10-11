import type { RatePlan, PeriodRates, RateTier, BillResult, MonthBill, IntervalRecord } from '../types'
import { classify } from './periods'
import { isOffPeak } from './constants'

/**
 * Get the rates for a specific month, accounting for seasonal overrides.
 */
function ratesForMonth(plan: RatePlan, month: number): Record<string, PeriodRates> {
  if (plan.seasonalRates) {
    for (const season of plan.seasonalRates) {
      if (season.months.includes(month)) return season.rates
    }
  }
  return plan.rates
}

/**
 * Resolve a delivery rate that may be flat or tiered.
 * For tiered rates, applies the correct rate based on cumulative kWh within the month.
 */
function resolveDeliveryRate(delivery: number | RateTier[], cumulativeKwh: number): number {
  if (typeof delivery === 'number') return delivery
  // Tiered: find the applicable tier based on cumulative usage
  for (const tier of delivery) {
    if (tier.upTo === null || cumulativeKwh < tier.upTo) return tier.rate
  }
  // Fallback to last tier
  return delivery[delivery.length - 1].rate
}

/** Unweighted average retail rate across all periods. */
export function avgRetail(plan: RatePlan): number {
  const rs = Object.values(plan.rates)
  return rs.reduce((s, r) => {
    const delivRate = typeof r.delivery === 'number' ? r.delivery : r.delivery[0]?.rate ?? 0
    return s + r.supply + delivRate
  }, 0) / rs.length
}

export interface BillOptions {
  resolution?: 15 | 60
  supplyOverride?: number  // competitive supplier rate ($/kWh) — replaces default service supply
}

/* ── Pipeline helpers ──────────────────────────────────────── */

interface ClassifiedMonth {
  per: Record<string, number>
  importKwh: number
  exportKwh: number
  peakKw: number
}

/** Classify each interval in a month bucket into TOU periods and compute kWh/kW aggregates. */
function classifyIntervals(
  bucket: IntervalRecord[],
  plan: RatePlan,
  resolution: number,
): ClassifiedMonth {
  const intervalsPerHour = 60 / resolution
  const hoursPerInterval = resolution / 60

  const per: Record<string, number> = {}
  let importKwh = 0
  let exportKwh = 0
  let peakKw = 0

  for (const rec of bucket) {
    const hour = rec.timestamp.getHours() + rec.timestamp.getMinutes() / 60
    const offPeak = isOffPeak(rec.timestamp)

    const solarKwh = rec.solar || 0
    const grossKw = rec.kwh * intervalsPerHour
    const solarKw = solarKwh * intervalsPerHour
    const importKw = Math.max(0, grossKw - solarKw)
    const exportKw = Math.max(0, solarKw - grossKw)

    const k = classify(plan, hour, offPeak)
    per[k] = (per[k] || 0) + importKw * hoursPerInterval
    importKwh += importKw * hoursPerInterval
    exportKwh += exportKw * hoursPerInterval
    if (importKw > peakKw) peakKw = importKw
  }

  return { per, importKwh, exportKwh, peakKw }
}

/** Calculate supply and delivery charges for a classified month. */
function calculateCharges(
  per: Record<string, number>,
  monthRates: Record<string, PeriodRates>,
  supplyOverride?: number,
  supplyScheduleRate?: number | null,
): { supply: number; delivery: number } {
  let supply = 0
  let delivery = 0
  let cumulativeKwh = 0

  for (const [k, kwh] of Object.entries(per)) {
    const rt = monthRates[k] || monthRates.off || monthRates.flat
    if (rt) {
      const supplyRate = supplyOverride ?? supplyScheduleRate ?? rt.supply
      supply += kwh * supplyRate
      delivery += kwh * resolveDeliveryRate(rt.delivery, cumulativeKwh)
      cumulativeKwh += kwh
    }
  }

  return { supply, delivery }
}

/** Calculate billed demand with optional ratchet. */
function calculateDemand(
  peakKw: number,
  plan: RatePlan,
  monthlyPeaks: number[],
  monthIndex: number,
): number {
  if (!plan.hasDemand) return 0

  let billedDemand = peakKw
  if (plan.demandRatchet && monthIndex > 0) {
    const lookback = Math.min(monthIndex, plan.demandRatchet.lookbackMonths)
    const priorPeaks = monthlyPeaks.slice(Math.max(0, monthIndex - lookback), monthIndex)
    const maxPriorPeak = priorPeaks.reduce((max, p) => Math.max(max, p), 0)
    const ratchetFloor = maxPriorPeak * plan.demandRatchet.percent
    billedDemand = Math.max(peakKw, ratchetFloor)
  }

  return billedDemand * plan.demandRate
}

/** Calculate export credit for net-metered or buyback generation. */
function calculateExportCredit(
  exportKwh: number,
  importKwh: number,
  plan: RatePlan,
): number {
  if (exportKwh <= 0 || plan.exportCredit.type === 'none') return 0

  const ec = plan.exportCredit
  switch (ec.type) {
    case 'netting-retail':
    case 'netting-reduced':
      return -(exportKwh * ec.rate)
    case 'netting-two-rate': {
      const offsetKwh = Math.min(exportKwh, importKwh)
      const excessKwh = Math.max(0, exportKwh - importKwh)
      return -(offsetKwh * ec.rate + excessKwh * (ec.excessRate ?? 0))
    }
    case 'buyback':
      return -(exportKwh * ec.rate)
  }
  return 0
}

/** Build a per-month supply rate lookup from a plan's supplySchedule. */
function buildMonthlySupplyRates(plan: RatePlan): (number | null)[] | null {
  if (!plan.supplySchedule || plan.supplySchedule.length === 0) return null

  const monthSupplyRates: (number | null)[] = new Array(12).fill(null)
  const sorted = [...plan.supplySchedule].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
  const year = parseInt(plan.effectiveDate.slice(0, 4))

  for (let mi = 0; mi < 12; mi++) {
    const monthDate = `${year}-${String(mi + 1).padStart(2, '0')}-01`
    let rate: number | null = null
    for (const entry of sorted) {
      if (entry.effectiveDate <= monthDate) rate = entry.rate
    }
    monthSupplyRates[mi] = rate
  }

  return monthSupplyRates
}

/* ── Main entry point ──────────────────────────────────────── */

/**
 * Calculate a bill from a rate plan and an interval series.
 * Intervals can come from any source (archetype, CSV, Green Button).
 */
export function calculateBill(
  plan: RatePlan,
  intervals: IntervalRecord[],
  profileId: string = 'custom',
  resolutionOrOpts: 15 | 60 | BillOptions = 15,
): BillResult {
  const opts: BillOptions = typeof resolutionOrOpts === 'number'
    ? { resolution: resolutionOrOpts }
    : resolutionOrOpts
  const resolution = opts.resolution ?? 15
  const supplyOverride = opts.supplyOverride

  // Group intervals by month
  const monthBuckets: IntervalRecord[][] = Array.from({ length: 12 }, () => [])
  for (const rec of intervals) {
    monthBuckets[rec.timestamp.getMonth()].push(rec)
  }

  const monthSupplyRates = buildMonthlySupplyRates(plan)

  const months: MonthBill[] = []
  const tot = { supply: 0, delivery: 0, demand: 0, fixed: 0, credit: 0, kwh: 0, exportKwh: 0, peak: 0 }
  const monthlyPeaks: number[] = []

  for (let m = 0; m < 12; m++) {
    const bucket = monthBuckets[m]
    if (bucket.length === 0) {
      months.push({ m, supply: 0, delivery: 0, demand: 0, fixed: 0, credit: 0, total: 0, kwh: 0, exportKwh: 0, peak: 0, per: {} })
      monthlyPeaks.push(0)
      continue
    }

    const classified = classifyIntervals(bucket, plan, resolution)
    monthlyPeaks.push(classified.peakKw)

    const monthRates = ratesForMonth(plan, m)
    const { supply, delivery } = calculateCharges(
      classified.per, monthRates,
      supplyOverride, monthSupplyRates?.[m],
    )
    const demand = calculateDemand(classified.peakKw, plan, monthlyPeaks, m)
    const fixed = plan.fixedCharge
    const credit = calculateExportCredit(classified.exportKwh, classified.importKwh, plan)

    const total = supply + delivery + demand + fixed + credit
    months.push({ m, supply, delivery, demand, fixed, credit, total, kwh: classified.importKwh, exportKwh: classified.exportKwh, peak: classified.peakKw, per: classified.per })
    tot.supply += supply
    tot.delivery += delivery
    tot.demand += demand
    tot.fixed += fixed
    tot.credit += credit
    tot.kwh += classified.importKwh
    tot.exportKwh += classified.exportKwh
    tot.peak = Math.max(tot.peak, classified.peakKw)
  }

  const total = tot.supply + tot.delivery + tot.demand + tot.fixed + tot.credit
  return {
    planId: plan.id,
    profileId,
    months,
    total,
    ...tot,
    effRate: tot.kwh > 0 ? total / tot.kwh : 0,
  }
}
