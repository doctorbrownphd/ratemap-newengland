const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787'

export { API_BASE }

export interface ReconcileResponse {
  extracted: import('../types').ExtractedBill
  textLength: number
  error?: string
}

export interface ExtractionResponse {
  plans: {
    plan: Record<string, unknown>
    evidence: Record<string, { value: string; source_quote: string; confidence: 'high' | 'medium' | 'low'; page?: number }>
    validation: { field: string; status: 'pass' | 'warn' | 'fail'; message: string }[]
  }[]
  source: string
  textLength: number
  error?: string
}

/** Extract tariff rate plans from a PDF URL. */
export async function extractTariff(url: string, rateCode?: string): Promise<ExtractionResponse> {
  const resp = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, rateCode }),
  })
  if (!resp.ok) throw new Error(await resp.text())
  return resp.json()
}

/** Extract bill data from a PDF (base64-encoded). */
export async function reconcileBillPDF(pdfBase64: string): Promise<ReconcileResponse> {
  const resp = await fetch(`${API_BASE}/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64 }),
  })
  if (!resp.ok) throw new Error(await resp.text())
  return resp.json()
}

/** Check whether the extraction server is reachable. */
export async function checkHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${API_BASE}/health`)
    return resp.ok
  } catch {
    return false
  }
}
