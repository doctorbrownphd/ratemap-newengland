import type { BillResult, RatePlan } from '../../types'
import { PLAN_BY_ID } from '../../data/plans'
import { fmtUSD } from '../../utils/format'
import { Card, Stat, Icon } from '../../components'

interface SensitivityPanelProps {
  bill: BillResult
  plan: RatePlan
  comparison: BillResult[]
  profileId: string
  gasSpend?: number
}

/** Break-even / sensitivity analysis panel — context-aware insights for every profile. */
export function SensitivityPanel({ bill, plan, comparison, profileId, gasSpend }: SensitivityPanelProps) {
  const insights: { label: string; value: string; sub: string; color?: string }[] = []

  // ── Plan comparison insight (all profiles) ───────────────
  if (comparison.length > 1) {
    const best = comparison[0]
    const bestPlan = PLAN_BY_ID[best.planId]
    const savings = bill.total - best.total

    if (bestPlan && savings > 1) {
      insights.push({
        label: `Switch to ${bestPlan.rateCode}`,
        value: fmtUSD(savings),
        sub: `saved per year vs ${plan.rateCode}`,
        color: 'var(--ok)',
      })
    }

    // Break-even usage: find where current plan cost equals best plan cost
    // Approximate by scaling — if best plan is cheaper at current usage,
    // find usage multiplier where they cross
    if (bestPlan && best.planId !== bill.planId && best.effRate !== bill.effRate) {
      // linear approx: total ≈ fixed + effRate * kwh
      // plan A = fixedA + rA * kwh, plan B = fixedB + rB * kwh
      // break-even: fixedA + rA * kwh = fixedB + rB * kwh
      // kwh = (fixedB - fixedA) / (rA - rB)
      const fixedA = bill.fixed
      const fixedB = best.fixed
      const rA = bill.effRate
      const rB = best.effRate

      if (rA !== rB) {
        const breakEvenKwh = (fixedB - fixedA) / (rA - rB)
        if (breakEvenKwh > 0 && breakEvenKwh < bill.kwh * 5) {
          insights.push({
            label: `Break-even usage`,
            value: `${Math.round(breakEvenKwh).toLocaleString()}`,
            sub: `kWh/yr — ${bestPlan.rateCode} wins above this`,
          })
        }
      }
    }
  }

  // ── EV profile: off-peak charging analysis ───────────────
  if (profileId === 'ev') {
    // Find a flat-rate plan for this utility to compare against
    const flatPlan = comparison.find(c => {
      const p = PLAN_BY_ID[c.planId]
      return p && p.periodStructure === 'flat'
    })
    const touPlan = comparison.find(c => {
      const p = PLAN_BY_ID[c.planId]
      return p && p.periodStructure !== 'flat'
    })

    if (flatPlan && touPlan && flatPlan.planId !== touPlan.planId) {
      const evSavings = flatPlan.total - touPlan.total
      if (evSavings > 0) {
        insights.push({
          label: 'Off-peak charging saves',
          value: fmtUSD(evSavings),
          sub: `per year vs flat-rate equivalent`,
          color: 'var(--ok)',
        })
      }

      // TOU break-even: what % of EV charging must be off-peak?
      // At 100% off-peak we get full savings; at 0% off-peak TOU is worse
      // Linear interpolation: break-even % = flatTotal / (flatTotal + touSavings) ... simplified
      // More precisely: if TOU bill at current off-peak % = touPlan.total,
      // and flat bill = flatPlan.total, then TOU wins when off-peak% > threshold
      // Since EV profile puts ~100% overnight, the threshold is where costs cross.
      // Approximate: threshold = 1 - (evSavings / flatPlan.total)
      const threshold = Math.max(0, Math.min(100, (1 - evSavings / flatPlan.total) * 100))
      if (threshold > 5 && threshold < 95) {
        insights.push({
          label: 'TOU break-even',
          value: `${Math.round(threshold)}%`,
          sub: 'of EV charging must be off-peak',
        })
      }
    }
  }

  // ── Solar profile: payback analysis ──────────────────────
  if (profileId === 'solar') {
    const exportRate = plan.exportCredit.rate
    const annualExportCredit = Math.abs(bill.credit)
    // Total savings = avoided import cost + export credit
    // For net-metered solar, bill.total reflects net cost after credits
    // Since we're using the same plan, the savings are embedded in the credit
    const annualSavings = annualExportCredit > 0
      ? annualExportCredit + (bill.exportKwh > 0 ? bill.exportKwh * bill.effRate : 0)
      : 0

    // Use a more robust savings estimate: solar generation displaces grid purchase
    // The bill already accounts for this via net metering — savings = what bill would be without solar - current bill
    // Approximate: savings ≈ |credit| + (solarKwh - exportKwh) * effRate
    // where (solarKwh - exportKwh) = self-consumed solar
    const systemCost = 24000 // 8 kW * $3/W typical installed cost

    if (annualSavings > 0) {
      const paybackYears = systemCost / annualSavings
      if (paybackYears > 0 && paybackYears < 50) {
        insights.push({
          label: 'Simple payback',
          value: paybackYears.toFixed(1),
          sub: `years on 8 kW system (~$24k)`,
          color: paybackYears < 10 ? 'var(--ok)' : undefined,
        })
      }
    }

    if (exportRate > 0) {
      insights.push({
        label: 'Net export credit',
        value: fmtUSD(annualExportCredit),
        sub: `per year at ${(exportRate * 100).toFixed(1)}c/kWh`,
      })
    }
  }

  // ── Heat pump profile: gas break-even ────────────────────
  if (profileId === 'ehp') {
    const gasCustomerCharge = 16.76 * 12 // typical NH gas customer charge annually

    // Break-even gas price: switching saves money if gas costs more than this
    // Total electric cost = bill.total
    // Total gas cost = gasSpend + gasCustomerCharge (both eliminated by switching)
    // Break-even: bill.total = gasBreakEven + gasCustomerCharge
    // gasBreakEven = bill.total - gasCustomerCharge (annual gas commodity spend where switching is neutral)
    const gasBreakEven = bill.total - gasCustomerCharge
    if (gasBreakEven > 0) {
      insights.push({
        label: 'Break-even gas price',
        value: fmtUSD(gasBreakEven),
        sub: `per year — switching saves above this`,
        color: 'var(--accent)',
      })
    }

    // Effective cost per displaced therm
    // Heat pump COP ~3.4 → uses ~29.3 kWh per therm-equivalent
    // Annual therms displaced ≈ bill.kwh / 29.3
    // Cost per displaced therm = bill.total / (bill.kwh / 29.3)
    const thermsDisplaced = bill.kwh / 29.3
    if (thermsDisplaced > 0) {
      const costPerTherm = bill.total / thermsDisplaced
      insights.push({
        label: 'Cost per displaced therm',
        value: `$${costPerTherm.toFixed(2)}`,
        sub: `in electricity at current rates`,
      })
    }

    // If gas spend is entered, show actual savings/cost
    if (gasSpend && gasSpend > 0) {
      const totalGasCost = gasSpend + gasCustomerCharge
      const netSavings = totalGasCost - bill.total
      insights.push({
        label: netSavings > 0 ? 'Annual savings' : 'Additional cost',
        value: fmtUSD(Math.abs(netSavings)),
        sub: netSavings > 0
          ? `vs $${gasSpend.toLocaleString()}/yr gas + customer charge`
          : `above current gas spend`,
        color: netSavings > 0 ? 'var(--ok)' : 'var(--bad)',
      })
    }
  }

  // Don't render if there's nothing to show
  if (insights.length === 0) return null

  return (
    <Card pad={18}>
      <div className="flex items-center gap-2.5 mb-3">
        <Icon name="layers" size={17} style={{ color: 'var(--accent)' }} />
        <div className="text-[13.5px] font-semibold">Break-even analysis</div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        {insights.map((ins, i) => (
          <Card key={i} pad={14}>
            <Stat
              label={ins.label}
              value={ins.value}
              sub={ins.sub}
              color={ins.color}
            />
          </Card>
        ))}
      </div>
    </Card>
  )
}
