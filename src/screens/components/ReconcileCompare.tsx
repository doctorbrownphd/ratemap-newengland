import type { RatePlan, ExtractedBill, ComparisonLine } from '../../types'
import { Icon, Card, Badge, Btn, Stat } from '../../components'
import { fmtUSD } from '../../utils/format'
import { deltaColor, deltaIcon, deltaTone, suggestReason } from '../../utils/diagnostic'

/* ── Comparison table row ──────────────────────────────────── */

function ComparisonRow({ line, isTotal }: { line: ComparisonLine; isTotal: boolean }) {
  const delta = line.billed - line.calculated
  const isOtherCharge = line.calculated === 0 && !isTotal && line.label !== 'Customer charge'

  return (
    <div
      className={`grid items-center gap-2 py-2.5 ${isTotal ? 'pt-3' : ''}`}
      style={{
        gridTemplateColumns: '1fr 90px 90px 90px 28px',
        borderBottom: isTotal ? 'none' : '1px solid var(--line)',
        borderTop: isTotal ? '2px solid var(--line)' : 'none',
      }}
    >
      <div>
        <span className={`text-xs ${isTotal ? 'font-semibold text-sm' : ''}`} style={{ color: 'var(--ink)' }}>
          {line.label}
        </span>
        {line.rate && !isTotal && (
          <div className="font-mono text-[10px]" style={{ color: 'var(--ink-3)' }}>{line.rate}</div>
        )}
      </div>
      <span className={`font-mono text-xs text-right ${isTotal ? 'font-semibold text-sm' : ''}`} style={{ color: 'var(--ink)' }}>
        {fmtUSD(line.billed, 2)}
      </span>
      <span className={`font-mono text-xs text-right ${isTotal ? 'font-semibold text-sm' : ''}`} style={{ color: isOtherCharge ? 'var(--ink-3)' : 'var(--ink)' }}>
        {isOtherCharge ? '--' : fmtUSD(line.calculated, 2)}
      </span>
      <span
        className={`font-mono text-xs text-right font-medium ${isTotal ? 'text-sm' : ''}`}
        style={{ color: isOtherCharge ? 'var(--ink-3)' : deltaColor(delta) }}
      >
        {isOtherCharge ? '--' : `${delta >= 0 ? '+' : ''}${fmtUSD(delta, 2)}`}
      </span>
      <span className="flex justify-center">
        {!isOtherCharge && <Icon name={deltaIcon(delta)} size={14} style={{ color: deltaColor(delta) }} />}
      </span>
    </div>
  )
}

/* ── Compare step ──────────────────────────────────────────── */

export interface ReconcileCompareProps {
  workingBill: ExtractedBill
  matchedPlan: RatePlan
  comparison: ComparisonLine[]
  periodStart: string
  periodEnd: string
  onBack: () => void
  onReset: () => void
}

export function ReconcileCompare({
  workingBill, matchedPlan, comparison,
  periodStart, periodEnd,
  onBack, onReset,
}: ReconcileCompareProps) {
  return (
    <>
      {/* Stats row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
        <Card pad={14}>
          <Stat label="Utility" value={workingBill.utility} sub={workingBill.state} />
        </Card>
        <Card pad={14}>
          <Stat label="Usage" value={`${workingBill.usage.total.toLocaleString()}`} unit="kWh" sub={`${periodStart} to ${periodEnd}`} />
        </Card>
        <Card pad={14}>
          <Stat label="Billed" value={fmtUSD(workingBill.charges.totalBilled, 2)} sub="amount due" color="var(--accent)" />
        </Card>
        <Card pad={14}>
          <Stat
            label="Delta"
            value={fmtUSD(workingBill.charges.totalBilled - (comparison.find(l => l.label === 'Total')?.calculated ?? 0), 2)}
            sub="billed - calculated"
            color={deltaColor(workingBill.charges.totalBilled - (comparison.find(l => l.label === 'Total')?.calculated ?? 0))}
          />
        </Card>
      </div>

      {/* Comparison table */}
      <Card pad={0}>
        <div className="flex items-center gap-2.5"
          style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <Icon name="check" size={17} style={{ color: 'var(--accent)' }} />
          <div className="text-[13.5px] font-semibold">Line-by-line reconciliation</div>
          <Badge tone="accent">{matchedPlan.rateCode}</Badge>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          {/* Header */}
          <div
            className="grid items-center gap-2 py-2"
            style={{
              gridTemplateColumns: '1fr 90px 90px 90px 28px',
              borderBottom: '2px solid var(--line)',
            }}
          >
            <span className="font-mono text-[10px] tracking-wider uppercase font-medium" style={{ color: 'var(--ink-3)' }}>Charge</span>
            <span className="font-mono text-[10px] tracking-wider uppercase font-medium text-right" style={{ color: 'var(--ink-3)' }}>Billed</span>
            <span className="font-mono text-[10px] tracking-wider uppercase font-medium text-right" style={{ color: 'var(--ink-3)' }}>Calculated</span>
            <span className="font-mono text-[10px] tracking-wider uppercase font-medium text-right" style={{ color: 'var(--ink-3)' }}>Delta</span>
            <span />
          </div>
          {/* Rows */}
          {comparison.map((line, i) => (
            <ComparisonRow key={i} line={line} isTotal={line.label === 'Total'} />
          ))}
        </div>
      </Card>

      {/* Delta analysis */}
      {comparison.filter(l => Math.abs(l.billed - l.calculated) > 0.5 && l.label !== 'Total').length > 0 && (
        <Card pad={0}>
          <div className="flex items-center gap-2.5"
            style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
            <Icon name="alert" size={17} style={{ color: 'var(--warn)' }} />
            <div className="text-[13.5px] font-semibold">Delta analysis</div>
          </div>
          <div className="flex flex-col gap-2" style={{ padding: '16px' }}>
            {comparison
              .filter(l => l.label !== 'Total')
              .map((line, i) => {
                const delta = line.billed - line.calculated
                const reason = suggestReason(line.label, delta)
                if (!reason) return null
                return (
                  <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--ink-2)' }}>
                    <Badge tone={deltaTone(delta)}>{line.label}</Badge>
                    <span>{reason} ({delta >= 0 ? '+' : ''}{fmtUSD(delta, 2)})</span>
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* Rate detail */}
      <Card pad={0}>
        <div className="flex items-center gap-2.5"
          style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <Icon name="dollar" size={17} style={{ color: 'var(--accent)' }} />
          <div className="text-[13.5px] font-semibold">Rates used in calculation</div>
        </div>
        <div className="flex flex-col gap-1.5" style={{ padding: '16px' }}>
          {Object.entries(matchedPlan.rates).map(([period, rates]) => {
            const delivRate = typeof rates.delivery === 'number' ? rates.delivery : rates.delivery[0]?.rate ?? 0
            return (
              <div key={period} className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ink-3)' }}>
                  {period}
                </span>
                <div className="flex gap-4 text-xs font-mono" style={{ color: 'var(--ink-2)' }}>
                  <span>Supply: {(rates.supply * 100).toFixed(3)}c/kWh</span>
                  <span>Delivery: {(delivRate * 100).toFixed(3)}c/kWh</span>
                  <span>All-in: {((rates.supply + delivRate) * 100).toFixed(3)}c/kWh</span>
                </div>
              </div>
            )
          })}
          <div className="text-xs font-mono mt-1" style={{ color: 'var(--ink-3)' }}>
            Customer charge: ${matchedPlan.fixedCharge.toFixed(2)}/mo
            {matchedPlan.hasDemand ? ` | Demand: $${matchedPlan.demandRate.toFixed(2)}/kW` : ''}
          </div>
          {matchedPlan.deliveryComponents && matchedPlan.deliveryComponents.length > 0 && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
              <div className="font-mono text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                Delivery components
              </div>
              {matchedPlan.deliveryComponents.map((dc, i) => (
                <div key={i} className="flex justify-between text-xs font-mono" style={{ color: 'var(--ink-2)' }}>
                  <span>{dc.name}</span>
                  <span>{(dc.rate * 100).toFixed(3)}c/kWh</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Btn kind="ghost" size="md" icon="chevron" onClick={onBack}>
          Back to review
        </Btn>
        <Btn kind="ghost" size="md" icon="x" onClick={onReset}>
          Start over
        </Btn>
      </div>

      <div className="text-[10.5px] font-mono text-center pb-4" style={{ color: 'var(--ink-3)' }}>
        Calculated values use our rate model and may not include all riders, taxes, or seasonal adjustments.
      </div>
    </>
  )
}
