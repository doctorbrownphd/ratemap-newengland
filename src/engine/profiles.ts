import type { Archetype, DayProfile, IntervalPoint, IntervalRecord, IntervalSeries } from '../types'
import { MONTH_TEMP, MONTH_IRRAD, DAYS, isOffPeak } from './constants'

// ── Archetypes ─────────────────────────────────────────────

export const ARCHETYPES: Archetype[] = [
  { id: 'typical', label: 'Typical home',       sub: 'Oil heat · no DER',          icon: 'home',     cls: 'residential' },
  { id: 'ehp',     label: 'Electric-heat home', sub: 'Heat pump · winter peaks',   icon: 'flame',    cls: 'residential' },
  { id: 'ev',      label: 'EV household',       sub: 'Overnight + evening charge', icon: 'car',      cls: 'residential' },
  { id: 'solar',   label: 'Solar home',         sub: '8 kW rooftop · net metered', icon: 'solar',    cls: 'residential' },
  { id: 'biz',     label: 'Small business',     sub: 'Café · weekday daytime',     icon: 'building', cls: 'commercial' },
]

// ── Seeded RNG & Helpers ───────────────────────────────────

function rng(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

function bump(h: number, c: number, w: number): number {
  const x = (h - c) / w
  return Math.exp(-0.5 * x * x)
}

// ── Day Profile Generation ─────────────────────────────────

export function profileDay(pid: string, month: number, dayType: 'weekday' | 'weekend'): DayProfile {
  const we = dayType === 'weekend'
  const temp = MONTH_TEMP[month]
  const irr = MONTH_IRRAD[month]
  const hdd = clamp((60 - temp) / 60, 0, 1)
  const cdd = clamp((temp - 72) / 28, 0, 1)
  const r = rng(hashStr(pid + month + dayType))
  const pts: IntervalPoint[] = []

  for (let i = 0; i < 96; i++) {
    const h = i * 0.25
    let gross = 0
    let solar = 0

    const base = 0.30 * (0.92 + 0.16 * Math.sin((h / 24) * 6.283 + 1))
    const behav =
      (we ? 0.85 : 1.0) *
      (0.5 * bump(h, we ? 8.5 : 7.0, 1.4) +
        0.95 * bump(h, 18.7, 2.2) +
        0.22 * bump(h, 12.8, 1.7))

    if (pid === 'typical') {
      const heat = 0.22 * hdd * (1.6 * bump(h, 6.5, 2.4) + 2.0 * bump(h, 19, 3.0) + 0.6)
      const cool = cdd * 1.1 * bump(h, 16.5, 3.0)
      gross = base + behav + heat + cool
    } else if (pid === 'ehp') {
      let heat = 0.92 * hdd * (1.7 * bump(h, 6.0, 2.5) + 2.2 * bump(h, 19, 3.2) + 0.9)
      if (temp < 18) heat *= 1.32
      const cool = cdd * 1.4 * bump(h, 16.5, 3.0)
      gross = 0.34 + base * 0.4 + behav + heat + cool
    } else if (pid === 'ev') {
      const heat = 0.22 * hdd * (1.6 * bump(h, 6.5, 2.4) + 2.0 * bump(h, 19, 3.0) + 0.6)
      const ev = h >= 23 || h < 5 ? 7.0 : 0
      gross = base + behav + heat + ev
    } else if (pid === 'solar') {
      const heat = 0.22 * hdd * (1.6 * bump(h, 6.5, 2.4) + 2.0 * bump(h, 19, 3.0) + 0.6)
      gross = base + behav + heat
      solar = h > 6.5 && h < 19 ? 7.6 * irr * bump(h, 12.6, 3.0) : 0
    } else if (pid === 'biz') {
      const open = we ? 0 : h >= 6.5 && h < 18 ? 1 : 0
      const day = open * (5.6 + 1.8 * bump(h, 12, 3.5))
      const standby = 0.8 + 0.2 * Math.sin((h / 24) * 6.283)
      const cool = cdd * 2.2 * open * bump(h, 14, 3.5)
      gross = standby + day + cool
    }

    const noise = (r() - 0.5) * 0.12
    gross = Math.max(0.05, gross + noise)
    const imp = Math.max(0, gross - solar)
    const exp = Math.max(0, solar - gross)

    pts.push({
      i,
      h,
      gross: +gross.toFixed(3),
      solar: +solar.toFixed(3),
      imp: +imp.toFixed(3),
      exp: +exp.toFixed(3),
      net: +(gross - solar).toFixed(3),
    })
  }

  const peak = Math.max(...pts.map((p) => p.imp))
  const kwh = pts.reduce((s, p) => s + p.imp, 0) * 0.25

  return {
    points: pts,
    temp,
    irr,
    peak,
    kwh,
    peakHour: pts.reduce((a, p) => (p.imp > a.imp ? p : a)).h,
    exportKwh: pts.reduce((s, p) => s + p.exp, 0) * 0.25,
  }
}

// ── Full-Year Interval Series ──────────────────────────────

export function generateYear(pid: string, year: number = 2025): IntervalSeries {
  const records: IntervalRecord[] = []

  for (let month = 0; month < 12; month++) {
    const daysInMonth = DAYS[month]

    for (let day = 1; day <= daysInMonth; day++) {
      // Compute day of week (0=Sun, 6=Sat)
      const date = new Date(year, month, day)
      const dayType: 'weekday' | 'weekend' = isOffPeak(date) ? 'weekend' : 'weekday'

      const profile = profileDay(pid, month, dayType)

      for (const pt of profile.points) {
        const minuteOffset = pt.i * 15
        const timestamp = new Date(year, month, day, 0, minuteOffset)

        records.push({
          timestamp,
          kwh: pt.imp * 0.25, // 15-min interval: kW * 0.25h = kWh
          solar: pt.solar > 0 ? pt.solar * 0.25 : undefined,
        })
      }

    }
  }

  return {
    source: 'archetype',
    resolution: 15,
    records,
  }
}
