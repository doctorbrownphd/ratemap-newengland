export function fmtUSD(v: number, dp: number = 0): string {
  const abs = Math.abs(v)
  const str = abs.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dp, maximumFractionDigits: dp })
  return v < 0 ? `−${str}` : str
}

export function fmtRate(v: number): string {
  return `$${v.toFixed(4)}`
}

export function fmtKwh(v: number): string {
  return v >= 1000
    ? `${(v / 1000).toFixed(1)} MWh`
    : `${Math.round(v)} kWh`
}

export function fmtKw(v: number): string {
  return `${v.toFixed(1)} kW`
}

export function fmtHour(h: number): string {
  let hh = Math.floor(h)
  let mm = Math.round((h - hh) * 60)
  if (mm === 60) { hh++; mm = 0; }
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}

export function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || `var(${name})`
}
