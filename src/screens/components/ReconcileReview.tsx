import type { RatePlan, ExtractedBill } from '../../types'
import { Icon, Card, Badge, Btn, Stat } from '../../components'
import { fmtUSD } from '../../utils/format'
import { confidenceTone } from '../../utils/diagnostic'
import { PLANS } from '../../data/plans'

/* ── Editable extracted field ──────────────────────────────── */

function EditableField({ label, value, onChange, confidence, mono }: {
  label: string
  value: string | number
  onChange: (v: string) => void
  confidence?: 'high' | 'medium' | 'low'
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
      <span className="text-xs font-medium w-32 shrink-0" style={{ color: 'var(--ink-3)' }}>{label}</span>
      <input
        type="text"
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        className={`flex-1 bg-transparent border-none outline-none text-xs ${mono ? 'font-mono' : ''}`}
        style={{
          color: 'var(--ink)',
          borderBottom: '1px solid var(--line)',
          padding: '2px 4px',
        }}
      />
      {confidence && (
        <Badge tone={confidenceTone(confidence)} mono>{confidence}</Badge>
      )}
    </div>
  )
}

/* ── Review step ───────────────────────────────────────────── */

export interface ReconcileReviewProps {
  extracted: ExtractedBill
  utility: string; setUtility: (v: string) => void
  state: string; setState: (v: string) => void
  rateCode: string; setRateCode: (v: string) => void
  periodStart: string; setPeriodStart: (v: string) => void
  periodEnd: string; setPeriodEnd: (v: string) => void
  usageTotal: string; setUsageTotal: (v: string) => void
  usagePeak: string; setUsagePeak: (v: string) => void
  usageOffPeak: string; setUsageOffPeak: (v: string) => void
  supplyAmt: string; setSupplyAmt: (v: string) => void
  supplyRate: string; setSupplyRate: (v: string) => void
  deliveryAmt: string; setDeliveryAmt: (v: string) => void
  deliveryRate: string; setDeliveryRate: (v: string) => void
  customerCharge: string; setCustomerCharge: (v: string) => void
  demandCharge: string; setDemandCharge: (v: string) => void
  demandKw: string; setDemandKw: (v: string) => void
  totalBilled: string; setTotalBilled: (v: string) => void
  selectedPlanId: string; setSelectedPlanId: (v: string) => void
  matchedUtilities: string[]
  matchedPlan: RatePlan | null
  plansForUtility: RatePlan[]
  onReconcile: () => void
  onReset: () => void
}

export function ReconcileReview(props: ReconcileReviewProps) {
  const {
    extracted,
    utility, setUtility, state, setState, rateCode, setRateCode,
    periodStart, setPeriodStart, periodEnd, setPeriodEnd,
    usageTotal, setUsageTotal, usagePeak, setUsagePeak, usageOffPeak, setUsageOffPeak,
    supplyAmt, setSupplyAmt, supplyRate, setSupplyRate,
    deliveryAmt, setDeliveryAmt, deliveryRate, setDeliveryRate,
    customerCharge, setCustomerCharge,
    demandCharge, setDemandCharge, demandKw, setDemandKw,
    totalBilled, setTotalBilled,
    selectedPlanId, setSelectedPlanId,
    matchedUtilities, matchedPlan, plansForUtility,
    onReconcile, onReset,
  } = props

  return (
    <>
      {/* Bill info */}
      <Card pad={0}>
        <div className="flex items-center gap-2.5"
          style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <Icon name="doc" size={17} style={{ color: 'var(--accent)' }} />
          <div className="text-[13.5px] font-semibold">Extracted bill fields</div>
          <Badge tone="accent">editable</Badge>
        </div>
        <div className="flex flex-col" style={{ padding: '8px 16px 16px' }}>
          <div className="font-mono text-[10px] tracking-wider uppercase mt-3 mb-1 font-medium" style={{ color: 'var(--ink-3)' }}>
            Account info
          </div>
          <EditableField label="Utility" value={utility} onChange={setUtility} confidence={extracted.confidence.utility} />
          <EditableField label="State" value={state} onChange={setState} />
          <EditableField label="Rate code" value={rateCode} onChange={setRateCode} />
          <EditableField label="Period start" value={periodStart} onChange={setPeriodStart} mono />
          <EditableField label="Period end" value={periodEnd} onChange={setPeriodEnd} mono />

          <div className="font-mono text-[10px] tracking-wider uppercase mt-4 mb-1 font-medium" style={{ color: 'var(--ink-3)' }}>
            Usage
          </div>
          <EditableField label="Total kWh" value={usageTotal} onChange={setUsageTotal} confidence={extracted.confidence.usage} mono />
          {usagePeak && <EditableField label="Peak kWh" value={usagePeak} onChange={setUsagePeak} mono />}
          {usageOffPeak && <EditableField label="Off-peak kWh" value={usageOffPeak} onChange={setUsageOffPeak} mono />}

          <div className="font-mono text-[10px] tracking-wider uppercase mt-4 mb-1 font-medium" style={{ color: 'var(--ink-3)' }}>
            Charges
          </div>
          <EditableField label="Supply ($)" value={supplyAmt} onChange={setSupplyAmt} confidence={extracted.confidence.supply} mono />
          <EditableField label="Supply rate ($/kWh)" value={supplyRate} onChange={setSupplyRate} mono />
          <EditableField label="Delivery ($)" value={deliveryAmt} onChange={setDeliveryAmt} confidence={extracted.confidence.delivery} mono />
          <EditableField label="Delivery rate ($/kWh)" value={deliveryRate} onChange={setDeliveryRate} mono />
          <EditableField label="Customer charge ($)" value={customerCharge} onChange={setCustomerCharge} mono />
          {(demandCharge || demandKw) && (
            <>
              <EditableField label="Demand charge ($)" value={demandCharge} onChange={setDemandCharge} mono />
              <EditableField label="Demand (kW)" value={demandKw} onChange={setDemandKw} mono />
            </>
          )}
          <EditableField label="Total billed ($)" value={totalBilled} onChange={setTotalBilled} confidence={extracted.confidence.total} mono />

          {/* Other charges */}
          {extracted.charges.otherCharges.length > 0 && (
            <>
              <div className="font-mono text-[10px] tracking-wider uppercase mt-4 mb-1 font-medium" style={{ color: 'var(--ink-3)' }}>
                Other charges (read-only)
              </div>
              {extracted.charges.otherCharges.map((oc, i) => (
                <div key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
                  <span className="text-xs w-32 shrink-0" style={{ color: 'var(--ink-3)' }}>{oc.name}</span>
                  <span className="font-mono text-xs" style={{ color: 'var(--ink)' }}>{fmtUSD(oc.amount, 2)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      {/* Plan matching */}
      <Card pad={0}>
        <div className="flex items-center gap-2.5"
          style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <Icon name="layers" size={17} style={{ color: 'var(--accent)' }} />
          <div className="text-[13.5px] font-semibold">Matched rate plan</div>
        </div>
        <div className="flex flex-col gap-3" style={{ padding: '16px' }}>
          {matchedUtilities.length > 0 && (
            <div className="text-xs" style={{ color: 'var(--ink-2)' }}>
              Matched utilities: {matchedUtilities.slice(0, 3).map((u, i) => (
                <Badge key={i} tone={i === 0 ? 'accent' : 'neutral'}>{u}</Badge>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
              Rate plan
            </label>
            <select
              value={selectedPlanId}
              onChange={e => setSelectedPlanId(e.target.value)}
              className="appearance-none bg-surface border border-line rounded-[var(--radius)] px-3 py-1.5 text-sm text-ink font-medium cursor-pointer transition-colors hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {(plansForUtility.length > 0 ? plansForUtility : PLANS).map(p => (
                <option key={p.id} value={p.id}>{p.utility} -- {p.rateCode} -- {p.name}</option>
              ))}
            </select>
          </div>
          {matchedPlan && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Rate code" value={matchedPlan.rateCode} />
              <Stat label="Structure" value={matchedPlan.periodStructure} />
              <Stat label="Customer charge" value={`$${matchedPlan.fixedCharge.toFixed(2)}`} />
              <Stat label="Effective" value={matchedPlan.effectiveDate} />
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Btn kind="primary" size="lg" icon="check" onClick={onReconcile}>
          Run reconciliation
        </Btn>
        <Btn kind="ghost" size="lg" icon="x" onClick={onReset}>
          Start over
        </Btn>
      </div>
    </>
  )
}
