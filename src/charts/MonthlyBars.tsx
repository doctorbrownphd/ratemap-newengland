import { useState, useRef, useEffect } from 'react'
import type { MonthBill } from '../types'
import { MONTHS } from '../engine/constants'
import { cssVar, fmtUSD } from '../utils/format'

interface Props {
  months: MonthBill[]
  height?: number
}

export function MonthlyBars({ months, height = 170 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(620)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const pad = { l: 38, r: 8, t: 10, b: 22 }
  const iw = Math.max(120, w - pad.l - pad.r), ih = height - pad.t - pad.b
  const max = months.reduce((mx, m) => Math.max(mx, m.supply + m.delivery + m.demand + m.fixed), 0) * 1.08
  const bw = iw / 12 * 0.66, step = iw / 12
  const comp: [keyof MonthBill, string][] = [['supply', '--c-energy'], ['delivery', '--c-deliv'], ['demand', '--c-demand'], ['fixed', '--c-fixed']]
  const y = (v: number) => pad.t + ih - (v / max) * ih

  return (
    <div ref={wrapRef} className="w-full relative">
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} className="block" style={{ fontFamily: 'var(--font-mono)' }}
        onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f, k) => {
          const v = f * max
          return (
            <g key={k}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--ink-3)">{fmtUSD(v)}</text>
            </g>
          )
        })}
        {months.map((m, i) => {
          const cx = pad.l + step * i + step / 2
          let acc = 0
          return (
            <g key={i} onMouseEnter={() => setHover(i)} className="cursor-default">
              <rect x={cx - step / 2} y={pad.t} width={step} height={ih} fill="transparent" />
              {comp.map(([k, c]) => {
                const v = m[k] as number
                if (v <= 0) return null
                const yy = y(acc + v), hh = (v / max) * ih
                acc += v
                return <rect key={k} x={cx - bw / 2} y={yy} width={bw} height={hh} fill={cssVar(c)} opacity={hover == null || hover === i ? 1 : 0.45} />
              })}
              <text x={cx} y={height - 7} textAnchor="middle" fontSize="8.5" fill="var(--ink-3)">{MONTHS[i][0]}</text>
            </g>
          )
        })}
      </svg>
      {hover != null && (() => {
        const m = months[hover]
        const cx = pad.l + step * hover + step / 2
        return (
          <div
            className="absolute top-1 font-mono pointer-events-none whitespace-nowrap"
            style={{
              left: Math.min(w - 130, Math.max(4, cx - 60)),
              background: 'var(--ink)', color: 'var(--ink-inv)',
              padding: '5px 8px', borderRadius: 'var(--radius-sm)',
              fontSize: 10.5, boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ opacity: 0.6 }}>{MONTHS[hover]}</div>
            <div className="font-semibold">{fmtUSD(m.total)}</div>
          </div>
        )
      })()}
    </div>
  )
}
