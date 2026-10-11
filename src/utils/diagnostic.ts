/** Confidence level to UI tone mapping. */
export function confidenceTone(c: string): 'ok' | 'warn' | 'bad' {
  return c === 'high' ? 'ok' : c === 'medium' ? 'warn' : 'bad'
}

/** Validation status to UI tone mapping. */
export function validationTone(status: string): 'ok' | 'warn' | 'bad' {
  return status === 'pass' ? 'ok' : status === 'warn' ? 'warn' : 'bad'
}

/** Delta magnitude to UI tone. */
export function deltaTone(delta: number): 'ok' | 'warn' | 'bad' {
  const abs = Math.abs(delta)
  if (abs <= 0.5) return 'ok'
  if (abs <= 5) return 'warn'
  return 'bad'
}

/** Delta magnitude to CSS color. */
export function deltaColor(delta: number): string {
  const abs = Math.abs(delta)
  if (abs <= 0.5) return 'var(--ok)'
  if (abs <= 5) return 'var(--warn)'
  return 'var(--bad)'
}

/** Delta magnitude to icon name. */
export function deltaIcon(delta: number): string {
  const abs = Math.abs(delta)
  if (abs <= 0.5) return 'check'
  return 'alert'
}

/** Suggest a likely reason for a reconciliation delta. */
export function suggestReason(label: string, delta: number): string | null {
  if (Math.abs(delta) <= 0.5) return null
  const lbl = label.toLowerCase()
  if (lbl.includes('delivery')) return 'Delivery delta may be due to riders, fees, or taxes not in our model'
  if (lbl.includes('supply')) return 'Supply delta may reflect a different effective date or seasonal rate'
  if (lbl.includes('customer')) return 'Customer charge may include taxes or local surcharges'
  if (lbl.includes('demand')) return 'Demand charge delta may be due to ratchet or power factor adjustment'
  if (lbl.includes('total')) return 'Total delta is the sum of component deltas plus any unlisted riders'
  return 'This charge may include components not captured in our rate model'
}
