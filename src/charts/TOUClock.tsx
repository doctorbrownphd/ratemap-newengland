import { useState } from 'react'
import type { DayProfile, PeriodSegment } from '../types'
import { cssVar, fmtHour } from '../utils/format'

interface Props {
  periods: PeriodSegment[]
  day: DayProfile
  label?: string
  size?: number
}

export function TOUClock({ periods, day, label, size = 300 }: Props) {
  const pad = 20 // padding so hour labels don't clip
  const full = size + pad * 2
  const segs = periods
  const cx = full / 2, cy = full / 2
  const rOut = size * 0.46, rIn = size * 0.355
  const loadOut = rIn - 6, loadIn = size * 0.13
  const [hover, setHover] = useState<number | null>(null)

  const ang = (h: number) => (h / 24) * 2 * Math.PI - Math.PI / 2
  const polar = (r: number, h: number): [number, number] => [cx + r * Math.cos(ang(h)), cy + r * Math.sin(ang(h))]

  function ringArc(r1: number, r2: number, h1: number, h2: number) {
    const [x1, y1] = polar(r2, h1), [x2, y2] = polar(r2, h2)
    const [x3, y3] = polar(r1, h2), [x4, y4] = polar(r1, h1)
    const large = (h2 - h1) > 12 ? 1 : 0
    return `M${x1} ${y1} A${r2} ${r2} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 ${large} 0 ${x4} ${y4} Z`
  }

  const pts = day.points
  const maxLoad = pts.reduce((max, p) => Math.max(max, p.imp), 1) * 1.05
  const loadR = (v: number) => loadIn + (v / maxLoad) * (loadOut - loadIn)

  let area = ''
  pts.forEach((p, i) => {
    const [x, y] = polar(loadR(p.imp), p.h)
    area += (i ? 'L' : 'M') + `${x.toFixed(1)} ${y.toFixed(1)} `
  })
  for (let i = pts.length - 1; i >= 0; i--) {
    const [x, y] = polar(loadIn, pts[i].h)
    area += `L${x.toFixed(1)} ${y.toFixed(1)} `
  }
  area += 'Z'

  const hp = hover != null ? pts[hover] : null

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const mx = (e.clientX - r.left) * (full / r.width) - cx
    const my = (e.clientY - r.top) * (full / r.height) - cy
    let a = Math.atan2(my, mx) + Math.PI / 2
    if (a < 0) a += 2 * Math.PI
    const h = (a / (2 * Math.PI)) * 24
    setHover(Math.max(0, Math.min(95, Math.round(h / 24 * 95))))
  }

  return (
    <div className="relative w-full flex justify-center">
      <svg
        viewBox={`0 0 ${full} ${full}`}
        width={full}
        height={full}
        className="max-w-full"
        style={{ fontFamily: 'var(--font-mono)' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {segs.map((s, i) => {
          // For flat rates (single segment covering 24h), use accent color for visibility
          const isFlat = segs.length === 1 && s.end - s.start >= 23.5
          const fillColor = isFlat ? 'var(--accent)' : cssVar(s.color)
          const fillOpacity = isFlat ? 0.18 : 0.9
          return <path key={i} d={ringArc(rIn, rOut, s.start, s.end)} fill={fillColor} opacity={fillOpacity} stroke={isFlat ? 'var(--accent)' : 'none'} strokeWidth={isFlat ? 1.5 : 0} />
        })}
        {Array.from({ length: 24 }).map((_, h) => {
          const [x1, y1] = polar(rIn - 2, h)
          const [x2, y2] = polar(rIn - (h % 6 === 0 ? 9 : 5), h)
          return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-strong)" strokeWidth={h % 6 === 0 ? 1.4 : 0.8} />
        })}
        {[0, 6, 12, 18].map(h => {
          const [x, y] = polar(rOut + 12, h)
          return <text key={h} x={x} y={y + 3} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)">{String(h).padStart(2, '0')}</text>
        })}
        <path d={area} fill="var(--accent)" opacity="0.16" />
        <path d={area} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
        {hp && (() => {
          const [x, y] = polar(loadR(hp.imp), hp.h)
          const [lx, ly] = polar(loadIn, hp.h)
          return (
            <g>
              <line x1={lx} y1={ly} x2={x} y2={y} stroke="var(--ink)" strokeWidth="1" />
              <circle cx={x} cy={y} r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
            </g>
          )
        })()}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{hp ? fmtHour(hp.h) : '24-hour'}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--ink)" style={{ fontFamily: 'var(--font-mono)' }}>
          {hp ? hp.imp.toFixed(2) : ''}<tspan fontSize="10" fill="var(--ink-3)">{hp ? ' kW' : ''}</tspan>
        </text>
        {!hp && label && <text x={cx} y={cy + 13} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)">{label}</text>}
      </svg>
    </div>
  )
}
