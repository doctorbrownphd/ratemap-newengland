import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RatePlan } from '../types'
import { buildPeriodDefs, periodSegments, structureLabel, getRateByHour } from '../engine/periods'
import { PLANS, PLAN_BY_ID, getUtilities } from '../data/plans'
import { Icon, Card, Stat, Badge, Select, Btn } from '../components'
import { Sparkline } from '../charts/Sparkline'

function freshness(verifiedDate: string): { tone: 'ok' | 'warn' | 'bad'; label: string } {
  const now = new Date()
  const verified = new Date(verifiedDate)
  const days = Math.floor((now.getTime() - verified.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 30) return { tone: 'ok', label: `Verified ${days}d ago` }
  if (days < 90) return { tone: 'warn', label: `Verified ${days}d ago` }
  return { tone: 'bad', label: `Stale · ${days}d ago` }
}

function PeriodStrip({ plan, dayType = 'weekday', height = 22 }: { plan: RatePlan; dayType?: string; height?: number }) {
  const segs = periodSegments(plan, dayType === 'weekend')
  return (
    <div>
      <div className="flex w-full overflow-hidden" style={{ height, borderRadius: 4, border: '1px solid var(--line)' }}>
        {segs.map((s, i) => (
          <div key={i} title={`${s.label} ${String(Math.round(s.start)).padStart(2, '0')}–${String(Math.round(s.end)).padStart(2, '0')}`}
            style={{ width: `${(s.end - s.start) / 24 * 100}%`, background: `var(${s.color})`, opacity: 0.85 }} />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[9px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>
    </div>
  )
}

function RateInspector({ plan }: { plan: RatePlan }) {
  const navigate = useNavigate()
  const defs = buildPeriodDefs(plan)
  const periods = Object.entries(plan.rates)

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '15px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-sm font-semibold">{plan.utility}</span>
          <Badge tone="accent">{plan.rateCode}</Badge>
        </div>
        <div className="text-xs mb-2.5" style={{ color: 'var(--ink-2)' }}>{plan.name}</div>
        <div className="flex gap-1.5 flex-wrap">
          <Badge tone="neutral">{plan.state}</Badge>
          <Badge tone="neutral">{plan.customerClass}</Badge>
          <Badge tone="neutral">{structureLabel(plan)}</Badge>
        </div>
      </div>

      <div className="flex flex-col gap-4" style={{ padding: '14px 16px' }}>
        <div>
          <div className="font-mono text-[10px] tracking-wider uppercase mb-2" style={{ color: 'var(--ink-3)' }}>Period clock · weekday</div>
          <PeriodStrip plan={plan} />
        </div>

        <div>
          <div className="font-mono text-[10px] tracking-wider uppercase mb-1.5" style={{ color: 'var(--ink-3)' }}>Energy charges · $/kWh</div>
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Period', 'Supply', 'Delivery', 'All-in'].map((h, i) => (
                  <th key={h} className="font-mono font-medium tracking-wider uppercase text-[9.5px]"
                    style={{ textAlign: i ? 'right' : 'left', padding: '4px 0', color: 'var(--ink-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(([k, v]) => {
                const d = defs.find(p => p.key === k)
                if (!d) return null
                return (
                  <tr key={k} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 0' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm" style={{ background: `var(${d.color})` }} />{d.label}
                      </span>
                    </td>
                    <td className="font-mono tnum text-right" style={{ color: 'var(--ink-2)' }}>{v.supply.toFixed(4)}</td>
                    <td className="font-mono tnum text-right" style={{ color: 'var(--ink-2)' }}>{(typeof v.delivery === 'number' ? v.delivery : v.delivery[0]?.rate ?? 0).toFixed(4)}</td>
                    <td className="font-mono tnum text-right font-semibold" style={{ color: 'var(--ink)' }}>{(v.supply + (typeof v.delivery === 'number' ? v.delivery : v.delivery[0]?.rate ?? 0)).toFixed(4)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {plan.deliveryComponents && (
          <div>
            <div className="font-mono text-[10px] tracking-wider uppercase mb-1.5" style={{ color: 'var(--ink-3)' }}>Delivery components · $/kWh</div>
            <div className="flex flex-col">
              {plan.deliveryComponents.map((c, i) => (
                <div key={i} className="flex items-center justify-between" style={{ padding: '3px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <span className="text-xs" style={{ color: 'var(--ink-2)' }}>{c.name}</span>
                  <span className="font-mono tnum text-xs" style={{ color: c.rate < 0 ? 'var(--ok)' : 'var(--ink-2)' }}>{c.rate < 0 ? '\u2212' : ''}{Math.abs(c.rate).toFixed(4)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--line)' }}>
                <span className="text-xs font-semibold">Total delivery</span>
                <span className="font-mono tnum text-xs font-semibold">{plan.deliveryComponents.reduce((s, c) => s + c.rate, 0).toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Customer charge" value={`$${plan.fixedCharge.toFixed(2)}`} sub="per month" />
          {plan.hasDemand
            ? <Stat label="Demand charge" value={`$${plan.demandRate.toFixed(2)}`} sub="per kW / mo" color="var(--c-demand)" />
            : <Stat label="Export credit" value={plan.exportCredit.type === 'none' ? '—' : plan.exportCredit.type} sub={plan.exportCredit.rate > 0 ? `${(plan.exportCredit.rate * 100).toFixed(1)}¢/kWh` : ''} />}
        </div>

        {plan.rateHistory && plan.rateHistory.length > 0 && (() => {
          const firstPeriodKey = Object.keys(plan.rates)[0]
          const currentSupply = plan.rates[firstPeriodKey]?.supply ?? 0
          const points = [
            ...plan.rateHistory.map(h => ({
              date: h.effectiveDate,
              rate: h.rates[firstPeriodKey]?.supply ?? 0,
            })),
            { date: plan.effectiveDate, rate: currentSupply },
          ]
          const rates = points.map(p => p.rate)
          const max = Math.max(...rates), min = Math.min(...rates)
          const range = max - min || 0.01
          const w = 200, h = 48, pad = 2
          const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2)
          const y = (v: number) => pad + (1 - (v - min) / range) * (h - pad * 2)
          let d = ''
          points.forEach((p, i) => d += (i ? 'L' : 'M') + `${x(i).toFixed(1)} ${y(p.rate).toFixed(1)} `)
          const delta = currentSupply - (plan.rateHistory[0]?.rates[firstPeriodKey]?.supply ?? currentSupply)
          const pctChange = plan.rateHistory[0]?.rates[firstPeriodKey]?.supply
            ? ((delta / plan.rateHistory[0].rates[firstPeriodKey].supply) * 100).toFixed(1)
            : '0'
          return (
            <div className="pt-3" style={{ borderTop: '1px solid var(--line)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] tracking-wider uppercase" style={{ color: 'var(--ink-3)' }}>Supply rate trend</span>
                <Badge tone={delta > 0 ? 'bad' : delta < 0 ? 'ok' : 'neutral'}>
                  {delta > 0 ? '+' : ''}{pctChange}% since {points[0].date.slice(0, 7)}
                </Badge>
              </div>
              <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="block">
                <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                {points.map((p, i) => (
                  <circle key={i} cx={x(i)} cy={y(p.rate)} r="2.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1" />
                ))}
              </svg>
              <div className="flex justify-between font-mono text-[9px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                {points.map((p, i) => (
                  <span key={i}>{(p.rate * 100).toFixed(1)}¢</span>
                ))}
              </div>
            </div>
          )
        })()}

        <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>{plan.source}</span>
            {plan.sourceUrl && (
              <a href={plan.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[10.5px] inline-flex items-center gap-1 cursor-pointer" style={{ color: 'var(--accent)' }}>
                tariff sheet<Icon name="external" size={11} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(() => { const f = freshness(plan.verifiedDate); return <Badge tone={f.tone}>{f.label}</Badge> })()}
            <Badge tone={plan.confidence === 'high' ? 'ok' : 'neutral'}>{plan.confidence}</Badge>
          </div>
          <div className="font-mono text-[9.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
            {plan.obtainedVia}
          </div>
        </div>

        <Btn kind="primary" size="sm" icon="bolt"
          onClick={() => navigate(`/calculator?plan=${plan.id}&profile=typical&utility=${encodeURIComponent(plan.utility)}`)}>
          Model this plan
        </Btn>
      </div>
    </Card>
  )
}

export function CatalogScreen() {
  const [sel, setSel] = useState('evnh-rtou')
  const [fState, setFState] = useState('all')
  const [fUtil, setFUtil] = useState('all')
  const [fCls, setFCls] = useState('all')
  const [fStruct, setFStruct] = useState('all')

  const utilities = getUtilities()

  const rows = useMemo(() => PLANS.filter(p =>
    (fState === 'all' || p.state === fState) &&
    (fUtil === 'all' || p.utility === fUtil) &&
    (fCls === 'all' || p.customerClass === fCls) &&
    (fStruct === 'all' || p.periodStructure === fStruct),
  ), [fState, fUtil, fCls, fStruct])

  const selPlan = PLAN_BY_ID[sel] || PLANS[0]

  return (
    <div className="os-fade flex flex-col lg:grid gap-4.5 items-start" style={{ gridTemplateColumns: '1fr 360px' }}>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2.5">
            <Icon name="grid" size={17} style={{ color: 'var(--accent)' }} />
            <div className="text-[13.5px] font-semibold whitespace-nowrap">Rate-plan catalog</div>
          </div>
          <span className="font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>{rows.length} / {PLANS.length} plans · {utilities.length} utilities</span>
        </div>

        {/* Filters */}
        <div className="flex gap-2.5 flex-wrap" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <Select value={fState} onChange={setFState} options={[{ value: 'all', label: 'All states' }, { value: 'CT', label: 'Connecticut' }, { value: 'MA', label: 'Massachusetts' }, { value: 'ME', label: 'Maine' }, { value: 'NH', label: 'New Hampshire' }, { value: 'RI', label: 'Rhode Island' }, { value: 'VT', label: 'Vermont' }]} />
          <Select value={fUtil} onChange={setFUtil} options={[{ value: 'all', label: 'All utilities' }, ...utilities.map(u => ({ value: u, label: u }))]} />
          <Select value={fCls} onChange={setFCls} options={[{ value: 'all', label: 'All classes' }, { value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }]} />
          <Select value={fStruct} onChange={setFStruct} options={[{ value: 'all', label: 'All structures' }, { value: 'flat', label: 'Flat' }, { value: 'tou-2', label: 'TOU' }, { value: 'tou-3', label: 'EV / 3-period' }]} />
        </div>

        {/* Table */}
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="sticky top-0 z-10" style={{ background: 'var(--surface)', boxShadow: '0 1px 0 var(--line)' }}>
                {['Utility', 'Rate', 'Class', 'Structure', 'Day rate', 'Effective'].map((h, i) => (
                  <th key={h} className="font-mono font-medium tracking-wider uppercase text-[10px] whitespace-nowrap"
                    style={{ textAlign: i === 4 ? 'right' : 'left', padding: '9px 16px', color: 'var(--ink-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const on = r.id === sel
                return (
                  <tr key={r.id} onClick={() => setSel(r.id)}
                    tabIndex={0}
                    role="row"
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(r.id) } }}
                    className="cursor-pointer"
                    style={{ borderTop: '1px solid var(--line)', background: on ? 'var(--accent-weak)' : 'transparent' }}>
                    <td style={{ padding: '9px 16px' }}>
                      <div className="font-medium">{r.utility}</div>
                      <div className="font-mono text-[10px]" style={{ color: 'var(--ink-3)' }}>{r.operatingCompany} · {r.state}</div>
                    </td>
                    <td style={{ padding: '9px 16px' }}>
                      <Badge tone={on ? 'accent' : 'neutral'}>{r.rateCode}</Badge>
                    </td>
                    <td style={{ padding: '9px 16px', color: 'var(--ink-2)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name={r.customerClass === 'commercial' ? 'building' : 'home'} size={13} style={{ color: 'var(--ink-3)' }} />
                        {r.customerClass === 'commercial' ? 'C&I' : 'Res'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap" style={{ padding: '9px 16px', color: 'var(--ink-2)' }}>{structureLabel(r)}</td>
                    <td style={{ padding: '6px 16px', textAlign: 'right' }}>
                      <div className="flex justify-end">
                        <Sparkline pts={getRateByHour(r)} color={on ? 'var(--accent)' : 'var(--ink-3)'} />
                      </div>
                    </td>
                    <td className="font-mono whitespace-nowrap text-[11px]" style={{ padding: '9px 16px', color: 'var(--ink-3)' }}>{r.effectiveDate}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inspector sidebar */}
      <div className="lg:sticky top-4 flex flex-col gap-3.5">
        <RateInspector plan={selPlan} />
      </div>
    </div>
  )
}
