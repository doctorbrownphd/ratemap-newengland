import { useState, useRef, useEffect } from 'react'
import type { BillResult } from '../types'
import { fmtUSD } from '../utils/format'

interface Props {
  results: BillResult[]
  planLabels: Record<string, { rateCode: string; structureLabel: string }>
  selectedId?: string
  onSelect?: (id: string) => void
  height?: number
}

export function ComparisonBars({ results, planLabels, selectedId, onSelect, height = 190 }: Props) {
  if (results.length === 0) return null
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(360)

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const max = results.reduce((m, r) => Math.max(m, r.total), 0) * 1.04
  const min = results.reduce((m, r) => Math.min(m, r.total), Infinity)
  const n = results.length
  const gap = 14, bw = Math.min(64, (w - (n - 1) * gap) / n)
  const baseY = height - 30

  return (
    <div ref={wrapRef} className="w-full">
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} className="block" style={{ fontFamily: 'var(--font-mono)' }}>
        {results.map((r, i) => {
          const info = planLabels[r.planId]
          if (!info) return null
          const cx = i * (bw + gap) + bw / 2 + (w - (n * bw + (n - 1) * gap)) / 2
          const h = (r.total / max) * (baseY - 14)
          const best = r.total === min, sel = r.planId === selectedId
          return (
            <g key={r.planId} className="cursor-pointer" onClick={() => onSelect?.(r.planId)}>
              <rect x={cx - bw / 2} y={baseY - h} width={bw} height={h} rx="3"
                fill={best ? 'var(--accent)' : 'var(--surface-3)'} opacity={sel ? 1 : (best ? 0.92 : 1)}
                stroke={sel ? 'var(--ink)' : 'none'} strokeWidth={sel ? 1.5 : 0} />
              <text x={cx} y={baseY - h - 6} textAnchor="middle" fontSize="11" fontWeight="600"
                fill={best ? 'var(--accent)' : 'var(--ink-2)'}>{fmtUSD(r.total)}</text>
              <text x={cx} y={baseY + 13} textAnchor="middle" fontSize="9.5" fill="var(--ink-2)" fontWeight={sel ? 600 : 400}>{info.rateCode}</text>
              <text x={cx} y={baseY + 24} textAnchor="middle" fontSize="8.5" fill="var(--ink-3)">{info.structureLabel.split(' ')[0]}</text>
              {best && <text x={cx} y={baseY - h - 19} textAnchor="middle" fontSize="8" fill="var(--accent)" style={{ letterSpacing: '0.06em' }}>BEST</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
