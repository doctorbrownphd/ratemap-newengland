import { useState } from 'react'
import type { RatePlan, BillResult } from '../types'
import { MONTHS } from '../engine'
import { buildPeriodDefs, structureLabel } from '../engine/periods'
import { PLAN_BY_ID } from '../data/plans'
import { fmtUSD, fmtKwh, fmtKw } from '../utils/format'
import { Icon, Card, Stat, Badge, Field, Select, Segmented, Btn } from '../components'
import { TOUClock } from '../charts/TOUClock'
import { PeriodBand } from '../charts/PeriodBand'
import { ComparisonBars } from '../charts/ComparisonBars'
import { MonthlyBars } from '../charts/MonthlyBars'
import { useCalculatorState } from '../hooks/useCalculatorState'
import { useIntervalData } from '../hooks/useIntervalData'
import { ProfilePicker, BillBreakdown, ElectrificationPanel, SensitivityPanel } from './components'

function PeriodLegend({ plan }: { plan: RatePlan }) {
  const defs = buildPeriodDefs(plan)
  return (
    <div className="flex gap-3.5 flex-wrap">
      {defs.map(d => {
        const rt = plan.rates[d.key]
        const delivRate = rt ? (typeof rt.delivery === 'number' ? rt.delivery : rt.delivery[0]?.rate ?? 0) : 0
        const tot = rt ? (rt.supply + delivRate) : null
        return (
          <span key={d.key} className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap" style={{ color: 'var(--ink-2)' }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `var(${d.color})` }} />
            {d.label}
            {tot != null && <span className="font-mono" style={{ color: 'var(--ink-3)' }}>{tot.toFixed(3)}/kWh</span>}
          </span>
        )
      })}
    </div>
  )
}

function buildClipboardSummary(bill: BillResult, plan: RatePlan, profileLabel: string): string {
  const lines = [
    `RateMap — Bill Estimate`,
    ``,
    `Utility: ${plan.utility}`,
    `Rate Plan: ${plan.rateCode} — ${plan.name}`,
    `Profile: ${profileLabel}`,
    ``,
    `Annual Bill: ${fmtUSD(bill.total)}`,
    `Effective Rate: ${(bill.effRate * 100).toFixed(1)} ¢/kWh`,
    `Annual Usage: ${fmtKwh(bill.kwh)}`,
    `Peak Demand: ${fmtKw(bill.peak)}`,
    ``,
    `Breakdown:`,
    `  Supply:   ${fmtUSD(bill.supply)}`,
    `  Delivery: ${fmtUSD(bill.delivery)}`,
    bill.demand > 0 ? `  Demand:   ${fmtUSD(bill.demand)}` : null,
    `  Fixed:    ${fmtUSD(bill.fixed)}`,
    bill.credit < -0.5 ? `  NM Credit: ${fmtUSD(bill.credit)}` : null,
    ``,
    `Effective: ${plan.effectiveDate} · Source: ${plan.source}`,
    `Estimate uses simplified net metering. Not a regulatory filing.`,
  ].filter(Boolean)
  return lines.join('\n')
}

export function CalculatorScreen() {
  const {
    profileId, utility, month, dayType,
    plan, profile, isCSV, effectiveCls,
    availablePlans, set, utilities,
    searchParams, setSearchParams,
  } = useCalculatorState()

  const {
    bill, day, periods, comparison,
    csvInfo, planLabels, handleCSVUpload, supplyOverride, anomalies,
  } = useIntervalData(profileId, plan, availablePlans, month, dayType, isCSV, searchParams, setSearchParams)

  const [copied, setCopied] = useState(false)

  // All hooks must be above this early return
  if (!plan || !bill) return <div className="p-8 text-center" style={{ color: 'var(--ink-3)' }}>No rate plans available</div>

  const best = comparison[0]
  const saveVsWorst = comparison.length > 1 ? comparison[comparison.length - 1].total - best.total : 0
  const thisVsBest = bill.total - best.total
  const handleCopy = () => {
    navigator.clipboard.writeText(buildClipboardSummary(bill, plan, (profile?.label || 'CSV data')))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const handleShareUrl = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="os-fade flex flex-col lg:grid gap-4.5 items-start" style={{ gridTemplateColumns: '340px 1fr' }}>
      {/* Config panel */}
      <div className="lg:sticky top-4">
        <Card pad={18}>
          <div className="flex flex-col gap-4.5">
            <div className="flex items-center gap-2.5">
              <Icon name="bolt" size={17} style={{ color: 'var(--accent)' }} />
              <div className="text-[13.5px] font-semibold">Inputs</div>
              <Badge tone="accent">v0.1</Badge>
            </div>

            <div>
              <label className="font-mono text-[10.5px] tracking-wider uppercase font-medium block mb-2" style={{ color: 'var(--ink-3)' }}>Load profile</label>
              <ProfilePicker value={profileId} onChange={v => set({ profileId: v })} onCSVUpload={handleCSVUpload} csvInfo={csvInfo} />
            </div>

            <Field label="Utility">
              <Select value={utility} onChange={v => set({ utility: v })} options={utilities.map(u => ({ value: u, label: u }))} />
            </Field>

            <Field label="Rate plan" hint={`${availablePlans.length} on file`}>
              <Select value={plan.id} onChange={v => set({ planId: v })}
                options={availablePlans.map(p => ({ value: p.id, label: `${p.rateCode} · ${structureLabel(p)}` }))} />
            </Field>

            <Field label="Supply rate" hint={supplyOverride ? `Override: ${(supplyOverride * 100).toFixed(2)}¢/kWh` : 'Default service'}>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1" style={{ background: 'var(--surface-2)', border: `1px solid ${supplyOverride ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
                  <input
                    type="number"
                    step="0.001"
                    placeholder={plan.rates[Object.keys(plan.rates)[0]]?.supply.toFixed(4)}
                    value={searchParams.get('supplier') || ''}
                    onChange={e => {
                      set(e.target.value ? { supplier: e.target.value } : {})
                      if (!e.target.value) {
                        const next = new URLSearchParams(searchParams)
                        next.delete('supplier')
                        setSearchParams(() => next, { replace: true })
                      }
                    }}
                    className="font-mono text-xs font-medium w-full bg-transparent border-none outline-none"
                    style={{ color: 'var(--ink)' }}
                    aria-label="Competitive supplier rate"
                  />
                  <span className="font-mono text-[10px] whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>$/kWh</span>
                </div>
                {supplyOverride && (
                  <button
                    type="button"
                    onClick={() => { const next = new URLSearchParams(searchParams); next.delete('supplier'); setSearchParams(() => next, { replace: true }) }}
                    className="text-xs cursor-pointer"
                    style={{ color: 'var(--ink-3)' }}
                    title="Reset to default service"
                  >
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
              {(() => {
                const defaultSupply = plan.rates[Object.keys(plan.rates)[0]]?.supply ?? 0
                const aggRange: Record<string, string> = {
                  MA: '13–15¢ (aggregation typical)',
                  NH: '14–15¢ (community power, incl. renewables)',
                  CT: '10–13¢ (short-term supplier)',
                  ME: '11–13¢ (short-term supplier)',
                  RI: '12–14¢ (aggregation, incl. renewables)',
                  VT: 'bundled utility — no retail choice',
                }
                return (
                  <div className="font-mono text-[9.5px] mt-1 leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                    Default: {(defaultSupply * 100).toFixed(1)}¢ · {aggRange[plan.state] || ''}
                  </div>
                )
              })()}
            </Field>

            <Field label="Representative day" hint={`${MONTHS[month]} · ${dayType}`} accent>
              <div className="grid grid-cols-12 gap-0.5 mb-2">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => set({ month: i })}
                    aria-label={MONTHS[i]}
                    className="cursor-pointer transition-all font-mono text-[10.5px]"
                    style={{
                      padding: '5px 0',
                      border: `1px solid ${month === i ? 'var(--accent)' : 'var(--line)'}`,
                      background: month === i ? 'var(--accent)' : 'var(--surface)',
                      color: month === i ? 'var(--accent-ink)' : 'var(--ink-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: month === i ? 600 : 400,
                    }}
                  >{m[0]}</button>
                ))}
              </div>
              <Segmented value={dayType} onChange={v => set({ dayType: v })}
                options={[{ value: 'weekday', label: 'Weekday' }, { value: 'weekend', label: 'Weekend' }]} size="sm" />
            </Field>

            <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
              <Btn kind="ghost" size="sm" icon="copy" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy summary'}</Btn>
              <Btn kind="ghost" size="sm" icon="external" onClick={handleShareUrl}>Share URL</Btn>
            </div>
          </div>
        </Card>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-3.5">
        {/* TOU Clock hero — only for multi-period plans */}
        {periods.length > 1 && (
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div className="flex items-center justify-between flex-wrap gap-2.5" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <div className="flex items-center gap-2.5">
                <Icon name="clock" size={18} style={{ color: 'var(--accent)' }} />
                <div>
                  <div className="text-[13.5px] font-semibold">{(profile?.label || 'CSV data')} · {MONTHS[month]} {dayType}</div>
                  <div className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>{plan.utility} {plan.rateCode} · load vs rate periods</div>
                </div>
              </div>
              <PeriodLegend plan={plan} />
            </div>
            <div className="p-3.5">
              <TOUClock periods={periods} day={day} label={plan.rateCode} size={330} />
            </div>
          </Card>
        )}

        {/* Period Band — load profile chart (always shown) */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div className="flex items-center justify-between flex-wrap gap-2.5" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <div className="flex items-center gap-2.5">
              <Icon name={periods.length > 1 ? 'layers' : 'clock'} size={18} style={{ color: 'var(--accent)' }} />
              <div>
                <div className="text-[13.5px] font-semibold">{(profile?.label || 'CSV data')} · {MONTHS[month]} {dayType}</div>
                <div className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>{plan.utility} {plan.rateCode} · {periods.length > 1 ? 'load by period' : 'daily load profile'}</div>
              </div>
            </div>
            <PeriodLegend plan={plan} />
          </div>
          <div className="p-3.5 pb-2">
            <PeriodBand periods={periods} day={day} height={periods.length > 1 ? 210 : 240} />
          </div>
        </Card>

        {/* Data quality alerts — shown when CSV/GB data has anomalies */}
        {anomalies.length > 0 && (
          <Card pad={14}>
            <div className="flex items-center gap-2 mb-2">
              <Icon name="alert" size={16} style={{ color: 'var(--warn)' }} />
              <span className="text-xs font-semibold">Data quality ({anomalies.length} {anomalies.length === 1 ? 'issue' : 'issues'})</span>
            </div>
            <div className="flex flex-col gap-1">
              {anomalies.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs" style={{ color: a.severity === 'error' ? 'var(--bad)' : a.severity === 'warning' ? 'var(--warn)' : 'var(--ink-2)' }}>
                  <Badge tone={a.severity === 'error' ? 'bad' : a.severity === 'warning' ? 'warn' : 'accent'}>{a.type}</Badge>
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Stats row */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
          <Card pad={14}><Stat label="Annual bill" value={fmtUSD(bill.total)} sub={`${fmtUSD(bill.total / 12)}/mo avg`} color="var(--accent)" /></Card>
          <Card pad={14}><Stat label="Effective rate" value={(bill.effRate * 100).toFixed(1)} unit="¢/kWh" sub="all-in, blended" /></Card>
          <Card pad={14}><Stat label="Annual usage" value={(bill.kwh / 1000).toFixed(1)} unit="MWh" sub={`${bill.kwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh import`} /></Card>
          <Card pad={14}>
            {plan.hasDemand
              ? <Stat label="Billed demand" value={bill.peak.toFixed(1)} unit="kW" sub={`${plan.demandRate.toFixed(2)}/kW charge`} color="var(--c-demand)" />
              : <Stat label="Peak draw" value={bill.peak.toFixed(1)} unit="kW" sub={effectiveCls === 'residential' ? 'no demand charge' : ''} />}
          </Card>
        </div>

        {/* Bill breakdown + comparison */}
        <div className="grid gap-3.5 items-start grid-cols-1 md:grid-cols-2">
          <Card pad={18}>
            <div className="flex items-center gap-2.5 mb-3.5">
              <Icon name="dollar" size={17} style={{ color: 'var(--accent)' }} />
              <div className="text-[13.5px] font-semibold">Bill composition</div>
              <Badge tone="neutral">{structureLabel(plan)}</Badge>
            </div>
            <BillBreakdown bill={bill} plan={plan} />
          </Card>

          <Card pad={18}>
            <div className="flex items-center justify-between gap-2.5 mb-1">
              <div className="flex items-center gap-2.5">
                <Icon name="layers" size={17} style={{ color: 'var(--accent)' }} />
                <div className="text-[13.5px] font-semibold">Same usage, every plan</div>
              </div>
              <Badge tone={thisVsBest < 1 ? 'ok' : 'warn'}>{thisVsBest < 1 ? 'on best plan' : `${fmtUSD(thisVsBest)}/yr above best`}</Badge>
            </div>
            <div className="font-mono text-[10.5px] mb-3" style={{ color: 'var(--ink-3)' }}>{plan.utility} · {(profile?.label || 'CSV data')} · click a bar to switch</div>
            <ComparisonBars results={comparison} planLabels={planLabels} selectedId={plan.id} onSelect={id => set({ planId: id })} height={196} />
            {comparison.length > 1 && (
              <div className="mt-3 pt-3 text-xs leading-relaxed" style={{ borderTop: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                Choosing <strong style={{ color: 'var(--ink)' }}>{PLAN_BY_ID[best.planId]?.rateCode}</strong> over this utility's costliest option saves
                <strong style={{ color: 'var(--accent)' }}> {fmtUSD(saveVsWorst)}/yr</strong> for a {(profile?.label || 'CSV data').toLowerCase()}.
              </div>
            )}
          </Card>
        </div>

        {/* Monthly bars */}
        <Card pad={18}>
          <div className="flex items-center justify-between gap-2.5 mb-1">
            <div className="flex items-center gap-2.5">
              <Icon name="layers" size={16} style={{ color: 'var(--accent)' }} />
              <div className="text-[13.5px] font-semibold">Monthly bill</div>
            </div>
            <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>12 mo · stacked by component</span>
          </div>
          <div className="mt-2.5">
            <MonthlyBars months={bill.months} height={170} />
          </div>
        </Card>

        {/* Break-even / sensitivity analysis */}
        <SensitivityPanel
          bill={bill}
          plan={plan}
          comparison={comparison}
          profileId={profileId}
          gasSpend={parseFloat(searchParams.get('gas') || '') || undefined}
        />

        {/* Electrification comparison — shows when heat pump profile is selected */}
        {profileId === 'ehp' && (
          <ElectrificationPanel bill={bill} plan={plan} searchParams={searchParams} setSearchParams={setSearchParams} />
        )}

        <div className="text-[10.5px] font-mono text-center pb-4" style={{ color: 'var(--ink-3)' }}>
          Estimate uses simplified net metering. Archetype profiles are illustrative, not predictive.
        </div>
      </div>
    </div>
  )
}
