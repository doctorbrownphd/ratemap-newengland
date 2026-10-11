// ── Rate Plan ──────────────────────────────────────────────

export type PeriodStructure = 'flat' | 'tou-2' | 'tou-3'

export type CustomerClass = 'residential' | 'commercial'

export interface ExportCredit {
  type: 'netting-retail' | 'netting-reduced' | 'netting-two-rate' | 'buyback' | 'none'
  rate: number           // $/kWh — value of each exported kWh (for netting-retail, equals all-in retail)
  excessRate?: number    // $/kWh — for netting-two-rate: rate for monthly exports exceeding imports
  note?: string          // regulatory reference, e.g., "NH NM 2.0: supply + trans + 25% dist"
}

export interface RateTier {
  upTo: number | null  // kWh threshold (null = unlimited / final tier)
  rate: number         // $/kWh
}

export interface PeriodRates {
  supply: number              // $/kWh (flat supply rate)
  delivery: number | RateTier[] // $/kWh flat, or tiered array
}

export interface PeriodDefinition {
  hours: [number, number]  // [start, end) in 24h
  weekendsOff: boolean     // true = this period doesn't apply on weekends
}

export interface SeasonalRate {
  months: number[]                    // 0-indexed: 0=Jan, 11=Dec
  rates: Record<string, PeriodRates>  // same structure as the main rates field
}

export interface RatePlan {
  id: string
  utility: string            // compound: "Eversource NH"
  operatingCompany: string
  eiaId: string
  state: string
  name: string
  rateCode: string
  customerClass: CustomerClass
  periodStructure: PeriodStructure
  hasDemand: boolean
  effectiveDate: string      // ISO date
  periods: Record<string, PeriodDefinition>
  rates: Record<string, PeriodRates>
  seasonalRates?: SeasonalRate[]      // if present, overrides `rates` by month
  fixedCharge: number        // $/month
  demandRate: number         // $/kW (0 if no demand charge)
  demandRatchet?: { percent: number; lookbackMonths: number } // e.g., { percent: 0.80, lookbackMonths: 11 }
  exportCredit: ExportCredit
  effectiveThrough?: string   // ISO date — when the current rates expire
  supplySchedule?: { effectiveDate: string; rate: number }[]  // time-indexed supply rates, sorted oldest-first
  rateHistory?: { effectiveDate: string; rates: Record<string, PeriodRates> }[] // historical rate snapshots
  deliveryComponents?: { name: string; rate: number }[] // named line items that sum to the delivery rate — display only
  source: string
  sourceUrl?: string
  verifiedDate: string           // ISO date — when this data was last verified against the source
  confidence: 'high' | 'medium'  // high = parsed from official PDF; medium = web research / estimated
  obtainedVia: string            // how the data was obtained — e.g., "pdf-parse", "web-research", "api"
}

// ── TOU Classification ─────────────────────────────────────

export interface PeriodDef {
  key: string
  label: string
  color: string              // CSS variable name
  match: (hour: number, isWeekend: boolean) => boolean
}

export interface PeriodSegment {
  key: string
  label: string
  color: string
  start: number
  end: number
}

// ── Load Profiles ──────────────────────────────────────────

export interface Archetype {
  id: string
  label: string
  sub: string
  icon: string
  cls: CustomerClass
}

export interface IntervalPoint {
  i: number      // interval index
  h: number      // decimal hour
  gross: number  // gross consumption kW
  solar: number  // solar generation kW
  imp: number    // import (grid draw) kW
  exp: number    // export kW
  net: number    // net = gross - solar
}

export interface DayProfile {
  points: IntervalPoint[]
  temp: number
  irr: number
  peak: number
  kwh: number
  peakHour: number
  exportKwh: number
}

export interface IntervalRecord {
  timestamp: Date
  kwh: number
  solar?: number
}

// ── Interval Series ────────────────────────────────────────

export interface IntervalSeries {
  source: 'archetype' | 'csv' | 'greenbutton'
  resolution: 15 | 60  // minutes
  records: IntervalRecord[]
}

// ── Bill Result ────────────────────────────────────────────

export interface MonthBill {
  m: number
  supply: number
  delivery: number
  demand: number
  fixed: number
  credit: number
  total: number
  kwh: number
  exportKwh: number
  peak: number
  per: Record<string, number>  // kWh per period
}

export interface BillResult {
  planId: string
  profileId: string
  months: MonthBill[]
  total: number
  supply: number
  delivery: number
  demand: number
  fixed: number
  credit: number
  kwh: number
  exportKwh: number
  peak: number
  effRate: number
}

// ── Reconciliation / Bill Extraction ──────────────────────

export interface BillUsage {
  total: number
  peak: number | null
  offPeak: number | null
}

export interface SupplyCharge {
  amount: number
  rate: number
  kwh: number
}

export interface OtherCharge {
  name: string
  amount: number
}

export interface BillCharges {
  supply: SupplyCharge
  delivery: SupplyCharge
  customerCharge: number
  demandCharge: number | null
  demandKw: number | null
  otherCharges: OtherCharge[]
  totalBilled: number
}

export interface BillConfidence {
  utility: 'high' | 'medium' | 'low'
  usage: 'high' | 'medium' | 'low'
  supply: 'high' | 'medium' | 'low'
  delivery: 'high' | 'medium' | 'low'
  total: 'high' | 'medium' | 'low'
}

export interface ExtractedBill {
  utility: string
  state: string
  rateCode: string | null
  billingPeriod: { start: string; end: string }
  usage: BillUsage
  charges: BillCharges
  confidence: BillConfidence
}

export interface ComparisonLine {
  label: string
  billed: number
  calculated: number
  rate: string | null
}
