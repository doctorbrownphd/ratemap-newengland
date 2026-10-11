import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ExtractedBill, ComparisonLine } from '../types'
import { PLANS, PLAN_BY_ID } from '../data/plans'
import { reconcileBillPDF, checkHealth, API_BASE } from '../api/client'
import { fuzzyMatchUtility, findBestPlan, buildComparison } from '../engine/reconciliation'

export type Step = 'upload' | 'review' | 'reconcile'

export function useReconciliation() {
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedBill | null>(null)
  const [serverOk, setServerOk] = useState<boolean | null>(null)

  // Editable overrides (initialized from extraction)
  const [utility, setUtility] = useState('')
  const [state, setState] = useState('')
  const [rateCode, setRateCode] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [usageTotal, setUsageTotal] = useState('')
  const [usagePeak, setUsagePeak] = useState('')
  const [usageOffPeak, setUsageOffPeak] = useState('')
  const [supplyAmt, setSupplyAmt] = useState('')
  const [supplyRate, setSupplyRate] = useState('')
  const [deliveryAmt, setDeliveryAmt] = useState('')
  const [deliveryRate, setDeliveryRate] = useState('')
  const [customerCharge, setCustomerCharge] = useState('')
  const [demandCharge, setDemandCharge] = useState('')
  const [demandKw, setDemandKw] = useState('')
  const [totalBilled, setTotalBilled] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('')

  // Check server health on mount
  useEffect(() => {
    checkHealth().then(setServerOk)
  }, [])

  // Auto-match plan when utility/state/rateCode change
  useEffect(() => {
    if (!utility) return
    const match = findBestPlan(utility, rateCode || null, state)
    if (match) setSelectedPlanId(match.id)
  }, [utility, state, rateCode])

  const matchedUtilities = useMemo(() => {
    if (!utility) return []
    return fuzzyMatchUtility(utility)
  }, [utility])

  const matchedPlan = selectedPlanId ? PLAN_BY_ID[selectedPlanId] : null

  // Build the working bill object from editable fields
  const workingBill = useMemo((): ExtractedBill | null => {
    if (!extracted) return null
    return {
      utility,
      state,
      rateCode: rateCode || null,
      billingPeriod: { start: periodStart, end: periodEnd },
      usage: {
        total: parseFloat(usageTotal) || 0,
        peak: usagePeak ? parseFloat(usagePeak) : null,
        offPeak: usageOffPeak ? parseFloat(usageOffPeak) : null,
      },
      charges: {
        supply: {
          amount: parseFloat(supplyAmt) || 0,
          rate: parseFloat(supplyRate) || 0,
          kwh: parseFloat(usageTotal) || 0,
        },
        delivery: {
          amount: parseFloat(deliveryAmt) || 0,
          rate: parseFloat(deliveryRate) || 0,
          kwh: parseFloat(usageTotal) || 0,
        },
        customerCharge: parseFloat(customerCharge) || 0,
        demandCharge: demandCharge ? parseFloat(demandCharge) : null,
        demandKw: demandKw ? parseFloat(demandKw) : null,
        otherCharges: extracted.charges.otherCharges,
        totalBilled: parseFloat(totalBilled) || 0,
      },
      confidence: extracted.confidence,
    }
  }, [extracted, utility, state, rateCode, periodStart, periodEnd, usageTotal, usagePeak, usageOffPeak, supplyAmt, supplyRate, deliveryAmt, deliveryRate, customerCharge, demandCharge, demandKw, totalBilled])

  const comparison = useMemo((): ComparisonLine[] | null => {
    if (!workingBill || !matchedPlan) return null
    return buildComparison(workingBill, matchedPlan)
  }, [workingBill, matchedPlan])

  const handleUpload = useCallback(async (b64: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await reconcileBillPDF(b64)
      if (data.error) {
        setError(data.error)
        return
      }
      const ex = data.extracted
      setExtracted(ex)
      // Populate editable fields
      setUtility(ex.utility || '')
      setState(ex.state || '')
      setRateCode(ex.rateCode || '')
      setPeriodStart(ex.billingPeriod?.start || '')
      setPeriodEnd(ex.billingPeriod?.end || '')
      setUsageTotal(String(ex.usage?.total ?? ''))
      setUsagePeak(ex.usage?.peak != null ? String(ex.usage.peak) : '')
      setUsageOffPeak(ex.usage?.offPeak != null ? String(ex.usage.offPeak) : '')
      setSupplyAmt(String(ex.charges?.supply?.amount ?? ''))
      setSupplyRate(String(ex.charges?.supply?.rate ?? ''))
      setDeliveryAmt(String(ex.charges?.delivery?.amount ?? ''))
      setDeliveryRate(String(ex.charges?.delivery?.rate ?? ''))
      setCustomerCharge(String(ex.charges?.customerCharge ?? ''))
      setDemandCharge(ex.charges?.demandCharge != null ? String(ex.charges.demandCharge) : '')
      setDemandKw(ex.charges?.demandKw != null ? String(ex.charges.demandKw) : '')
      setTotalBilled(String(ex.charges?.totalBilled ?? ''))
      setStep('review')
    } catch (e) {
      setError(`Failed to connect to extraction server at ${API_BASE}. Is cli/server.py running?`)
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleReconcile = useCallback(() => {
    setStep('reconcile')
  }, [])

  const handleReset = useCallback(() => {
    setStep('upload')
    setExtracted(null)
    setError(null)
    setSelectedPlanId('')
  }, [])

  // Available plans for the matched utility
  const plansForUtility = useMemo(() => {
    if (!utility) return PLANS
    const matched = matchedUtilities[0]
    if (!matched) return PLANS
    return PLANS.filter(p => p.utility === matched)
  }, [utility, matchedUtilities])

  return {
    // State
    step, loading, error, extracted, serverOk,
    utility, state, rateCode, periodStart, periodEnd,
    usageTotal, usagePeak, usageOffPeak,
    supplyAmt, supplyRate, deliveryAmt, deliveryRate,
    customerCharge, demandCharge, demandKw, totalBilled,
    selectedPlanId, matchedUtilities, matchedPlan, workingBill, comparison,
    plansForUtility,

    // Setters
    setStep,
    setUtility, setState, setRateCode,
    setPeriodStart, setPeriodEnd,
    setUsageTotal, setUsagePeak, setUsageOffPeak,
    setSupplyAmt, setSupplyRate, setDeliveryAmt, setDeliveryRate,
    setCustomerCharge, setDemandCharge, setDemandKw, setTotalBilled,
    setSelectedPlanId,

    // Actions
    handleUpload, handleReconcile, handleReset,
  }
}
