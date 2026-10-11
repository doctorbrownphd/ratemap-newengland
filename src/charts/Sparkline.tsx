interface Props {
  pts: number[]
  width?: number
  height?: number
  color?: string
}

export function Sparkline({ pts, width = 84, height = 26, color = 'var(--accent)' }: Props) {
  if (pts.length < 2) return null
  const max = Math.max(...pts), min = Math.min(0, ...pts)
  const x = (i: number) => (i / (pts.length - 1)) * width
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6)
  let d = ''
  pts.forEach((v, i) => d += (i ? 'L' : 'M') + `${x(i).toFixed(1)} ${y(v).toFixed(1)} `)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
