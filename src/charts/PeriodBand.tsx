import { useState, useRef, useEffect } from 'react'
import type { DayProfile, PeriodSegment } from '../types'
import { cssVar, fmtHour } from '../utils/format'

interface Props {
  periods: PeriodSegment[]
  day: DayProfile
  height?: number
}

export function PeriodBand({ periods, day, height = 200 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const pad = { l: 40, r: 14, t: 12, b: 24 }
  const iw = Math.max(120, w - pad.l - pad.r), ih = height - pad.t - pad.b
  const segs = periods
  const pts = day.points
  const maxLoad = pts.reduce((max, p) => Math.max(max, p.imp, p.gross), 1) * 1.08
  const x = (h: number) => pad.l + (h / 24) * iw
  const y = (v: number) => pad.t + ih - (v / maxLoad) * ih

  let line = ''
  pts.forEach((p, i) => { line += (i ? 'L' : 'M') + `${x(p.h).toFixed(1)} ${y(p.imp).toFixed(1)} ` })
  const area = line + `L${x(pts[pts.length - 1].h).toFixed(1)} ${y(0)} L${x(0)} ${y(0)} Z`
  const hasSolar = pts.some(p => p.solar > 0.05)
  let gloss = ''
  if (hasSolar) pts.forEach((p, i) => { gloss += (i ? 'L' : 'M') + `${x(p.h).toFixed(1)} ${y(p.gross).toFixed(1)} ` })

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) * (w / r.width)
    setHover(Math.max(0, Math.min(95, Math.round((px - pad.l) / iw * 95))))
  }

  const hp = hover != null ? pts[hover] : null
  const hpKey = hp ? (segs.find(s => hp.h >= s.start && hp.h < s.end)?.key ?? segs[segs.length - 1]?.key ?? null) : null
  const yTicks = 3

  return (
    <div ref={wrapRef} className="w-full relative">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        className="block"
        style={{ fontFamily: 'var(--font-mono)' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {segs.map((s, i) => (
          <rect key={i} x={x(s.start)} y={pad.t} width={x(s.end) - x(s.start)} height={ih} fill={cssVar(s.color)} opacity="0.14" />
        ))}
        {segs.filter(s => s.end - s.start > 1.2).map((s, i) => (
          <text key={'l' + i} x={(x(s.start) + x(s.end)) / 2} y={pad.t + 11} textAnchor="middle" fontSize="8.5"
            fill={cssVar(s.color)} opacity="0.95" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</text>
        ))}
        {Array.from({ length: yTicks + 1 }).map((_, k) => {
          const v = (k / yTicks) * maxLoad
          return (
            <g key={k}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
              <text x={pad.l - 7} y={y(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">{v.toFixed(0)}</text>
            </g>
          )
        })}
        {[0, 6, 12, 18, 24].map(h => (
          <text key={h} x={x(h)} y={height - 7} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)">{String(h).padStart(2, '0')}</text>
        ))}
        {hasSolar && <path d={gloss} fill="none" stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />}
        <path d={area} fill="var(--accent)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
        {hp && (
          <g>
            <line x1={x(hp.h)} x2={x(hp.h)} y1={pad.t} y2={pad.t + ih} stroke="var(--ink)" strokeWidth="1" />
            <circle cx={x(hp.h)} cy={y(hp.imp)} r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {hp && (
        <div
          className="absolute top-1.5 font-mono pointer-events-none whitespace-nowrap"
          style={{
            left: Math.min(w - 150, Math.max(8, x(hp.h) + 8)),
            background: 'var(--ink)', color: 'var(--ink-inv)',
            padding: '6px 9px', borderRadius: 'var(--radius-sm)',
            fontSize: 11, boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ opacity: 0.6, fontSize: 10 }}>{fmtHour(hp.h)} · {hpKey}</div>
          <div className="font-semibold">{hp.imp.toFixed(2)} kW import</div>
          {hp.exp > 0.05 && <div style={{ color: 'var(--p-super)' }}>{hp.exp.toFixed(2)} kW export</div>}
        </div>
      )}
    </div>
  )
}
