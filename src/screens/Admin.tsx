import { useState, useEffect, useCallback } from 'react'
import { Icon, Card, Badge, Btn, Stat } from '../components'
import { extractTariff, checkHealth } from '../api/client'
import type { ExtractionResponse } from '../api/client'
import { confidenceTone, validationTone } from '../utils/diagnostic'

/* ── Types for extraction API response ────────────────────── */

type ValidationResult = ExtractionResponse['plans'][number]['validation'][number]

type EvidenceEntry = ExtractionResponse['plans'][number]['evidence'][string]

type ExtractedPlan = ExtractionResponse['plans'][number]

function downloadJson(plan: Record<string, unknown>, filename: string) {
  const blob = new Blob([JSON.stringify(plan, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ── Validation summary row ──────────────────────────────── */

function ValidationSummary({ results }: { results: ValidationResult[] }) {
  const pass = results.filter(r => r.status === 'pass').length
  const warn = results.filter(r => r.status === 'warn').length
  const fail = results.filter(r => r.status === 'fail').length

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge tone="ok">{pass} pass</Badge>
      {warn > 0 && <Badge tone="warn">{warn} warn</Badge>}
      {fail > 0 && <Badge tone="bad">{fail} fail</Badge>}
    </div>
  )
}

/* ── Individual field row in plan card ────────────────────── */

function FieldRow({ label, value, evidence }: {
  label: string
  value: unknown
  evidence?: EvidenceEntry
}) {
  const display = value === null || value === undefined
    ? '\u2014'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)

  return (
    <div className="flex flex-col gap-0.5 py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>{label}</span>
        {evidence && (
          <Badge tone={confidenceTone(evidence.confidence)} mono>
            {evidence.confidence}{evidence.page != null ? ` p${evidence.page}` : ''}
          </Badge>
        )}
      </div>
      <span className="text-xs font-mono break-all" style={{ color: 'var(--ink)' }}>{display}</span>
      {evidence?.source_quote && (
        <span className="text-[10px] italic leading-snug mt-0.5" style={{ color: 'var(--ink-3)' }}>
          &ldquo;{evidence.source_quote}&rdquo;
        </span>
      )}
    </div>
  )
}

/* ── Plan result card ─────────────────────────────────────── */

function PlanCard({ result, index }: { result: ExtractedPlan; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const plan = result.plan
  const planId = (plan.id as string) || `plan-${index}`

  // Key fields to always show
  const keyFields = ['id', 'utility', 'operatingCompany', 'state', 'name', 'rateCode',
    'customerClass', 'periodStructure', 'effectiveDate', 'fixedCharge', 'demandRate',
    'hasDemand', 'rates', 'exportCredit', 'source']

  const allFields = Object.keys(plan)
  const extraFields = allFields.filter(f => !keyFields.includes(f))

  // Validation issues (non-pass)
  const issues = result.validation.filter(v => v.status !== 'pass')

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2"
        style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
        <div className="flex items-center gap-2">
          <Icon name="doc" size={16} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold">{(plan.utility as string) || 'Unknown utility'}</span>
          <Badge tone="accent">{(plan.rateCode as string) || '?'}</Badge>
        </div>
        <ValidationSummary results={result.validation} />
      </div>

      <div className="flex flex-col" style={{ padding: '12px 16px' }}>
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
          <Stat label="Customer charge" value={`$${Number(plan.fixedCharge ?? 0).toFixed(2)}`} sub="per month" />
          <Stat label="Structure" value={(plan.periodStructure as string) || '?'} />
          <Stat label="Class" value={(plan.customerClass as string) || '?'} />
          <Stat label="Effective" value={(plan.effectiveDate as string) || '?'} />
        </div>

        {/* Key fields */}
        {keyFields.map(f => {
          if (plan[f] === undefined) return null
          return <FieldRow key={f} label={f} value={plan[f]} evidence={result.evidence[f]} />
        })}

        {/* Expandable extra fields */}
        {extraFields.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs font-medium mt-2 mb-1 cursor-pointer"
              style={{ color: 'var(--accent)', background: 'none', border: 'none', padding: 0 }}
            >
              <Icon name={expanded ? 'chevdown' : 'chevron'} size={12} style={{ transform: expanded ? undefined : 'rotate(0deg)' }} />
              {expanded ? 'Hide' : 'Show'} {extraFields.length} more fields
            </button>
            {expanded && extraFields.map(f => (
              <FieldRow key={f} label={f} value={plan[f]} evidence={result.evidence[f]} />
            ))}
          </>
        )}

        {/* Validation issues */}
        {issues.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="font-mono text-[10px] tracking-wider uppercase mb-2" style={{ color: 'var(--ink-3)' }}>Validation issues</div>
            <div className="flex flex-col gap-1">
              {issues.map((v, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge tone={validationTone(v.status)}>{v.status}</Badge>
                  <span>
                    <span className="font-mono font-medium" style={{ color: 'var(--ink-2)' }}>{v.field}</span>
                    <span style={{ color: 'var(--ink-3)' }}> &mdash; {v.message}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <Btn kind="primary" size="sm" icon="download"
            onClick={() => downloadJson(plan, `${planId}.json`)}>
            Download JSON
          </Btn>
          <Btn kind="ghost" size="sm" icon="copy"
            onClick={() => { navigator.clipboard.writeText(JSON.stringify(plan, null, 2)) }}>
            Copy
          </Btn>
        </div>
      </div>
    </Card>
  )
}

/* ── Admin screen ─────────────────────────────────────────── */

export function AdminScreen() {
  const [url, setUrl] = useState('')
  const [rateCode, setRateCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractionResponse | null>(null)
  const [serverOk, setServerOk] = useState<boolean | null>(null)

  // Check server health on mount
  useEffect(() => {
    checkHealth().then(setServerOk)
  }, [])

  const handleExtract = useCallback(async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await extractTariff(url.trim(), rateCode.trim() || undefined)
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch (e) {
      setError(`Failed to connect to extraction server. Is cli/server.py running?`)
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [url, rateCode])

  return (
    <div className="os-fade flex flex-col gap-5 max-w-4xl">
      {/* Server status */}
      {serverOk === false && (
        <Card className="flex items-center gap-3">
          <Icon name="alert" size={18} style={{ color: 'var(--warn)' }} />
          <div className="text-sm">
            <span className="font-semibold" style={{ color: 'var(--warn)' }}>Server offline</span>
            <span style={{ color: 'var(--ink-2)' }}> &mdash; start the extraction server: </span>
            <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>
              python cli/server.py
            </code>
          </div>
        </Card>
      )}

      {/* Input form */}
      <Card pad={0}>
        <div className="flex items-center gap-2.5"
          style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <Icon name="layers" size={17} style={{ color: 'var(--accent)' }} />
          <div className="text-[13.5px] font-semibold">Extract rate plans from tariff PDF</div>
        </div>
        <div className="flex flex-col gap-3" style={{ padding: '16px' }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
              PDF URL
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://unitil.com/.../NH-Residential-Electric-Rates.pdf"
              className="w-full bg-surface border border-line rounded-[var(--radius)] px-3 py-2 text-sm font-mono text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
              onKeyDown={e => { if (e.key === 'Enter' && !loading) handleExtract() }}
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                Rate code filter <span className="font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={rateCode}
                onChange={e => setRateCode(e.target.value)}
                placeholder="e.g. R-1"
                className="bg-surface border border-line rounded-[var(--radius)] px-3 py-2 text-sm font-mono text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
                style={{ width: 160 }}
              />
            </div>
            <Btn kind="primary" size="lg" icon="bolt" onClick={handleExtract}
              className={loading ? 'opacity-60 pointer-events-none' : ''}>
              {loading ? 'Extracting...' : 'Extract'}
            </Btn>
          </div>
        </div>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <div className="text-sm" style={{ color: 'var(--ink-2)' }}>
            Downloading PDF, extracting text, calling LLM... this may take 30-60 seconds.
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="flex items-start gap-3">
          <Icon name="alert" size={18} style={{ color: 'var(--bad)', flexShrink: 0, marginTop: 2 }} />
          <div className="text-sm" style={{ color: 'var(--bad)' }}>{error}</div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <Stat label="Plans extracted" value={result.plans.length} />
            <Stat label="Source text" value={`${(result.textLength / 1000).toFixed(1)}k`} unit="chars" />
            <Stat label="Source" value={new URL(result.source).hostname} />
          </div>

          <div className="flex flex-col gap-4">
            {result.plans.map((p, i) => (
              <PlanCard key={i} result={p} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
