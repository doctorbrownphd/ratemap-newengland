import type { RatePlan, IntervalRecord, ExtractedBill, ComparisonLine } from '../types'
import { calculateBill } from './billing'
import { PLANS } from '../data/plans'
import { fmtUSD } from '../utils/format'

/** Build interval records for a single billing period with flat usage distribution. */
export function buildBillIntervals(
  startDate: string,
  endDate: string,
  totalKwh: number,
): IntervalRecord[] {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (86400000)))
  const intervalsPerDay = 96 // 15-min intervals
  const totalIntervals = days * intervalsPerDay
  const kwhPerInterval = totalKwh / totalIntervals

  const records: IntervalRecord[] = []
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < intervalsPerDay; i++) {
      const ts = new Date(start.getTime() + d * 86400000 + i * 15 * 60000)
      records.push({ timestamp: ts, kwh: kwhPerInterval })
    }
  }
  return records
}

/** Build a line-by-line comparison between a billed amount and our calculated amount. */
export function buildComparison(
  bill: ExtractedBill,
  plan: RatePlan,
): ComparisonLine[] {
  const intervals = buildBillIntervals(
    bill.billingPeriod.start,
    bill.billingPeriod.end,
    bill.usage.total,
  )
  const result = calculateBill(plan, intervals, 'reconcile', 15)

  const supply = result.supply
  const delivery = result.delivery
  const fixed = result.fixed
  const demand = result.demand

  const lines: ComparisonLine[] = []

  // Supply
  const supplyRate = bill.charges.supply.rate
    ? `${(bill.charges.supply.rate * 100).toFixed(3)}c/kWh x ${bill.usage.total} kWh`
    : null
  lines.push({ label: 'Supply', billed: bill.charges.supply.amount, calculated: supply, rate: supplyRate })

  // Delivery
  const delivRate = bill.charges.delivery.rate
    ? `${(bill.charges.delivery.rate * 100).toFixed(3)}c/kWh x ${bill.usage.total} kWh`
    : null
  lines.push({ label: 'Delivery', billed: bill.charges.delivery.amount, calculated: delivery, rate: delivRate })

  // Customer charge
  lines.push({ label: 'Customer charge', billed: bill.charges.customerCharge, calculated: fixed, rate: `$${plan.fixedCharge.toFixed(2)}/mo` })

  // Demand
  if (bill.charges.demandCharge != null && bill.charges.demandCharge > 0) {
    lines.push({ label: 'Demand charge', billed: bill.charges.demandCharge, calculated: demand, rate: bill.charges.demandKw ? `${bill.charges.demandKw} kW x $${plan.demandRate.toFixed(2)}` : null })
  }

  // Other charges (billed only, no calculated equivalent)
  for (const oc of bill.charges.otherCharges) {
    lines.push({ label: oc.name, billed: oc.amount, calculated: 0, rate: null })
  }

  // Total
  const calcTotal = supply + delivery + fixed + demand
  lines.push({ label: 'Total', billed: bill.charges.totalBilled, calculated: calcTotal, rate: null })

  return lines
}

/** Fuzzy match a utility name against the plan catalog. Returns matching utility names ranked by score. */
export function fuzzyMatchUtility(name: string): string[] {
  const lower = name.toLowerCase()
  const tokens = lower.split(/[\s-]+/)
  const scored = PLANS.map(p => {
    const pLower = p.utility.toLowerCase()
    let score = 0
    if (pLower === lower) score += 100
    for (const tok of tokens) {
      if (pLower.includes(tok)) score += 10
    }
    // Abbreviation matching
    if (lower.startsWith('ever') && pLower.includes('eversource')) score += 15
    if (lower.includes('unitil') && pLower.includes('unitil')) score += 15
    if (lower.includes('national grid') && pLower.includes('national grid')) score += 15
    if (lower.includes('liberty') && pLower.includes('liberty')) score += 15
    if (lower.includes('ui') && pLower.includes('united illuminating')) score += 15
    if (lower.includes('green mountain') && pLower.includes('green mountain')) score += 15
    if (lower.includes('versant') && pLower.includes('versant')) score += 15
    if (lower.includes('cmp') && pLower.includes('cmp')) score += 15
    return { plan: p, score }
  })
  const unique = new Map<string, number>()
  for (const { plan, score } of scored) {
    const prev = unique.get(plan.utility) ?? 0
    if (score > prev) unique.set(plan.utility, score)
  }
  return [...unique.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([u]) => u)
}

/** Find the best matching plan for a utility + rateCode + state. */
export function findBestPlan(
  utility: string,
  rateCode: string | null,
  state: string,
): RatePlan | null {
  // Exact utility match first
  let candidates = PLANS.filter(p => p.utility === utility)
  if (candidates.length === 0) {
    // Fuzzy: match by state
    candidates = PLANS.filter(p => p.state === state)
  }
  if (candidates.length === 0) return PLANS[0] ?? null

  // Narrow by rate code if present
  if (rateCode) {
    const rcLower = rateCode.toLowerCase().replace(/[-\s]/g, '')
    const rcMatch = candidates.find(p =>
      p.rateCode.toLowerCase().replace(/[-\s]/g, '') === rcLower,
    )
    if (rcMatch) return rcMatch
    // Partial match
    const partial = candidates.find(p =>
      p.rateCode.toLowerCase().includes(rcLower) || rcLower.includes(p.rateCode.toLowerCase()),
    )
    if (partial) return partial
  }
  // Return first residential plan, or first plan
  return candidates.find(p => p.customerClass === 'residential') ?? candidates[0]
}

// Re-export fmtUSD for convenience (used only by reconciliation display code)
export { fmtUSD }
