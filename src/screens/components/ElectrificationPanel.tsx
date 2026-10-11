import type { BillResult, RatePlan } from '../../types'
import { fmtUSD } from '../../utils/format'
import { Card, Stat, Icon, Badge } from '../../components'

interface ElectrificationPanelProps {
  bill: BillResult
  plan: RatePlan
  searchParams: URLSearchParams
  setSearchParams: (fn: (prev: URLSearchParams) => URLSearchParams, opts?: { replace?: boolean }) => void
}

export function ElectrificationPanel({ bill, plan, searchParams, setSearchParams }: ElectrificationPanelProps) {
  const gasSpendRaw = searchParams.get('gas') || ''
  const gasSpend = parseFloat(gasSpendRaw) || 0
  const gasCustomerCharge = 16.76 * 12 // typical NH gas customer charge (Liberty)
  const totalGasSavings = gasSpend > 0 ? gasSpend + gasCustomerCharge - bill.total : 0

  return (
    <Card pad={18}>
      <div className="flex items-center gap-2.5 mb-3">
        <Icon name="flame" size={17} style={{ color: 'var(--warn)' }} />
        <div className="text-[13.5px] font-semibold">Electrification comparison</div>
        <Badge tone="neutral">gas → heat pump</Badge>
      </div>
      <div className="text-xs mb-4" style={{ color: 'var(--ink-2)' }}>
        Enter your customer's current annual gas heating spend to see the economics of switching to a heat pump.
      </div>
      <div className="flex gap-3 items-end mb-4">
        <div className="flex-1">
          <label className="font-mono text-[10px] tracking-wider uppercase font-medium block mb-1.5" style={{ color: 'var(--ink-3)' }}>
            Annual gas spend
          </label>
          <div className="flex items-center gap-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
            <span className="font-mono text-sm" style={{ color: 'var(--ink-3)' }}>$</span>
            <input
              type="number"
              placeholder="2,400"
              value={gasSpendRaw}
              onChange={e => {
                const next = new URLSearchParams(searchParams)
                if (e.target.value) next.set('gas', e.target.value)
                else next.delete('gas')
                setSearchParams(() => next, { replace: true })
              }}
              className="font-mono text-sm font-semibold w-full bg-transparent border-none outline-none"
              style={{ color: 'var(--ink)' }}
            />
            <span className="font-mono text-[10px] whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>/yr</span>
          </div>
        </div>
        <div className="flex-1">
          <Stat label="Heat pump electric cost" value={fmtUSD(bill.total)} sub={`${plan.rateCode} · ${fmtUSD(bill.total / 12)}/mo`} color="var(--accent)" />
        </div>
      </div>
      {gasSpend > 0 ? (
        <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--ink-2)' }}>Current gas heating</span>
            <span className="font-mono tnum text-xs font-medium" style={{ color: 'var(--warn)' }}>{fmtUSD(gasSpend)}/yr</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--ink-2)' }}>Gas customer charge eliminated</span>
            <span className="font-mono tnum text-xs font-medium" style={{ color: 'var(--ok)' }}>{fmtUSD(gasCustomerCharge)}/yr</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--ink-2)' }}>Heat pump electric cost</span>
            <span className="font-mono tnum text-xs font-medium" style={{ color: 'var(--accent)' }}>{fmtUSD(bill.total)}/yr</span>
          </div>
          <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--line)' }}>
            <span className="text-sm font-semibold">{totalGasSavings > 0 ? 'Annual savings' : 'Additional cost'}</span>
            <span className="font-mono tnum text-lg font-semibold" style={{ color: totalGasSavings > 0 ? 'var(--ok)' : 'var(--bad)' }}>
              {totalGasSavings > 0 ? fmtUSD(totalGasSavings) : fmtUSD(Math.abs(totalGasSavings))}
              <span className="text-xs font-normal" style={{ color: 'var(--ink-3)' }}>/yr</span>
            </span>
          </div>
          <div className="font-mono text-[9.5px] mt-1" style={{ color: 'var(--ink-3)' }}>
            Assumes gas service fully eliminated. Customer charge estimate based on typical NH gas utility ($16.76/mo).
          </div>
        </div>
      ) : (
        <div className="font-mono text-[10.5px] text-center py-3" style={{ color: 'var(--ink-3)' }}>
          Enter the customer's annual gas spend above to see the comparison.
        </div>
      )}
    </Card>
  )
}
