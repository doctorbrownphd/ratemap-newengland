import { useState, useMemo, useCallback } from 'react'
import type { RatePlan, IntervalSeries, BillResult, DayProfile, PeriodSegment } from '../types'
import { profileDay, generateYear } from '../engine'
import { calculateBill, type BillOptions } from '../engine/billing'
import { summarizeCSV } from '../engine/csv'
import { detectAnomalies, type Anomaly } from '../engine/anomaly'
import { periodSegments, structureLabel } from '../engine/periods'

export function useIntervalData(
  profileId: string,
  plan: RatePlan | null,
  availablePlans: RatePlan[],
  month: number,
  dayType: 'weekday' | 'weekend',
  isCSV: boolean,
  searchParams: URLSearchParams,
  setSearchParams: (fn: (prev: URLSearchParams) => URLSearchParams, opts?: { replace?: boolean }) => void,
) {
  // CSV upload state (not in URL — file data can't be serialized to a query param)
  const [csvData, setCsvData] = useState<IntervalSeries | null>(null)
  const csvInfo = useMemo(() => csvData ? summarizeCSV(csvData) : null, [csvData])
  const anomalies: Anomaly[] = useMemo(() => csvData ? detectAnomalies(csvData) : [], [csvData])

  const handleCSVUpload = useCallback((series: IntervalSeries) => {
    setCsvData(series)
    const next = new URLSearchParams(searchParams)
    next.set('profile', 'csv')
    setSearchParams(() => next, { replace: true })
  }, [searchParams, setSearchParams])

  // Competitive supplier override from URL
  const supplyOverrideRaw = searchParams.get('supplier')
  const supplyOverride = supplyOverrideRaw ? parseFloat(supplyOverrideRaw) : undefined

  const intervals = useMemo(() => {
    if (isCSV && csvData) return csvData
    return generateYear(profileId)
  }, [profileId, isCSV, csvData])

  const billOpts: BillOptions = useMemo(() => ({
    resolution: intervals.resolution,
    supplyOverride: supplyOverride && !isNaN(supplyOverride) ? supplyOverride : undefined,
  }), [intervals.resolution, supplyOverride])

  const bill: BillResult | null = useMemo(() => {
    if (!plan) return null
    return calculateBill(plan, intervals.records, profileId, billOpts)
  }, [plan, intervals, profileId, billOpts])

  const vizProfileId = isCSV ? 'typical' : profileId
  const day: DayProfile = useMemo(() => profileDay(vizProfileId, month, dayType), [vizProfileId, month, dayType])

  const periods: PeriodSegment[] = useMemo(() => plan ? periodSegments(plan, dayType === 'weekend') : [], [plan, dayType])

  const planLabels = useMemo(() => {
    const out: Record<string, { rateCode: string; structureLabel: string }> = {}
    for (const p of availablePlans) {
      out[p.id] = { rateCode: p.rateCode, structureLabel: structureLabel(p) }
    }
    return out
  }, [availablePlans])

  const comparison: BillResult[] = useMemo(() => {
    return availablePlans.map(p => calculateBill(p, intervals.records, profileId, billOpts)).sort((a, b) => a.total - b.total)
  }, [availablePlans, intervals, profileId, billOpts])

  return {
    bill,
    day,
    periods,
    comparison,
    intervals,
    csvInfo,
    planLabels,
    handleCSVUpload,
    supplyOverride,
    anomalies,
  }
}
