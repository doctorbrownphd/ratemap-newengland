import type { BillResult, RatePlan } from '../../types'
import { fmtUSD } from '../../utils/format'
import { StackBar } from '../../charts/StackBar'

export const COMP_META = [
  { key: 'supply' as const, label: 'Energy supply', color: '--c-energy' },
  { key: 'delivery' as const, label: 'Delivery', color: '--c-deliv' },
  { key: 'demand' as const, label: 'Demand charge', color: '--c-demand' },
  { key: 'fixed' as const, label: 'Customer charge', color: '--c-fixed' },
]

export function BillBreakdown({ bill, plan }: { bill: BillResult; plan: RatePlan }) {
  const segs = COMP_META.map(c => ({ label: c.label, color: c.color, value: bill[c.key] }))
  const hasCredit = bill.credit < -0.5

  return (
    <div className="flex flex-col gap-3.5">
      <StackBar segments={segs} height={28} />
      <div className="flex flex-col">
        {COMP_META.map(c => bill[c.key] > 0 && (
          <div key={c.key} className="flex items-center gap-2.5" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: `var(${c.color})` }} />
            <span className="text-xs flex-1" style={{ color: 'var(--ink-2)' }}>
              {c.label}
              {c.key === 'demand' && <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}> · {plan.demandRate.toFixed(2)}/kW</span>}
            </span>
            <span className="font-mono tnum text-xs font-medium" style={{ color: 'var(--ink)' }}>{fmtUSD(bill[c.key])}</span>
          </div>
        ))}
        {hasCredit && (
          <div className="flex items-center gap-2.5" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: 'var(--c-credit)' }} />
            <span className="text-xs flex-1" style={{ color: 'var(--ink-2)' }}>
              Net-metering credit <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>· {bill.exportKwh.toFixed(0)} kWh export</span>
            </span>
            <span className="font-mono tnum text-xs font-medium" style={{ color: 'var(--c-credit)' }}>{fmtUSD(bill.credit)}</span>
          </div>
        )}
        <div className="flex items-center gap-2.5 pt-3">
          <span className="text-[13px] font-semibold flex-1">Annual total</span>
          <span className="font-mono tnum text-[17px] font-semibold" style={{ color: 'var(--accent)' }}>{fmtUSD(bill.total)}</span>
        </div>
      </div>
    </div>
  )
}
