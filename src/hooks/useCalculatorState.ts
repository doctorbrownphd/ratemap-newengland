import { useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ARCHETYPES } from '../engine'
import { PLAN_BY_ID, getUtilities, getPlansForUtility } from '../data/plans'

export function useCalculatorState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const utilities = getUtilities()

  // Read config from URL or use defaults
  const profileId = searchParams.get('profile') || 'ev'
  const utility = searchParams.get('utility') || utilities[0]
  const planId = searchParams.get('plan') || ''
  const month = parseInt(searchParams.get('month') || '0', 10)
  const dayType = (searchParams.get('day') || 'weekday') as 'weekday' | 'weekend'

  const profile = ARCHETYPES.find(p => p.id === profileId)
  const isCSV = profileId === 'csv'

  // For CSV uploads, default to residential; advisor can switch utility/plan manually
  const effectiveCls = isCSV ? 'residential' as const : (profile?.cls || 'residential' as const)

  const set = useCallback((patch: Record<string, string | number>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) {
        const paramMap: Record<string, string> = { profileId: 'profile', utility: 'utility', planId: 'plan', month: 'month', dayType: 'day' }
        next.set(paramMap[k] || k, String(v))
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const availablePlans = useMemo(
    () => getPlansForUtility(utility, effectiveCls),
    [utility, effectiveCls],
  )

  // Keep planId valid when utility/class changes
  const plan = PLAN_BY_ID[planId] || availablePlans[0]
  useEffect(() => {
    if (!availablePlans.some(p => p.id === planId) && availablePlans[0]) {
      set({ planId: availablePlans[0].id })
    }
  }, [availablePlans, planId, set])

  return {
    profileId,
    utility,
    planId,
    month,
    dayType,
    plan,
    profile,
    isCSV,
    effectiveCls,
    availablePlans,
    set,
    utilities,
    searchParams,
    setSearchParams,
  }
}
