import { cssVar, fmtUSD } from '../utils/format'

interface Segment {
  label: string
  color: string
  value: number
}

interface Props {
  segments: Segment[]
  height?: number
  radius?: number
}

export function StackBar({ segments, height = 26, radius = 5 }: Props) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1

  return (
    <div className="flex w-full overflow-hidden" style={{ height, borderRadius: radius, background: 'var(--surface-2)' }}>
      {segments.filter(s => s.value > 0).map((s, i) => {
        const pct = (s.value / total) * 100
        return (
          <div
            key={i}
            title={`${s.label}: ${fmtUSD(s.value)}`}
            style={{
              width: `${pct}%`,
              height: '100%',
              background: cssVar(s.color),
              borderRight: i < segments.length - 1 ? '1px solid var(--surface)' : 'none',
            }}
          />
        )
      })}
    </div>
  )
}
