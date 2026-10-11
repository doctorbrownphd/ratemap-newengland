import type { RatePlan } from '../../types'

// Auto-discover all plan JSON files at build time
const planModules = import.meta.glob<RatePlan>('./*.json', { eager: true, import: 'default' })

function validatePlan(data: unknown, path: string): RatePlan {
  const p = data as Record<string, unknown>
  const required = ['id', 'utility', 'state', 'rateCode', 'customerClass', 'periodStructure', 'rates', 'fixedCharge', 'exportCredit']
  for (const field of required) {
    if (!(field in p)) {
      throw new Error(`Rate plan ${path} missing required field: ${field}`)
    }
  }
  return data as RatePlan
}

export const PLANS: RatePlan[] = Object.entries(planModules)
  .map(([path, data]) => validatePlan(data, path))
  .sort((a, b) => {
    // Sort by utility then rate code for stable ordering
    const uCmp = a.utility.localeCompare(b.utility)
    return uCmp !== 0 ? uCmp : a.rateCode.localeCompare(b.rateCode)
  })

export const PLAN_BY_ID: Record<string, RatePlan> = Object.fromEntries(
  PLANS.map((p) => [p.id, p]),
)

/** Unique utility names, sorted alphabetically. */
export function getUtilities(): string[] {
  return [...new Set(PLANS.map((p) => p.utility))].sort()
}

/** Plans for a given utility, optionally filtered by customer class. */
export function getPlansForUtility(
  utility: string,
  customerClass?: string,
): RatePlan[] {
  return PLANS.filter(
    (p) =>
      p.utility === utility &&
      (customerClass == null || p.customerClass === customerClass),
  )
}
