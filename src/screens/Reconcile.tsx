import { Icon, Card } from '../components'
import { useReconciliation } from '../hooks/useReconciliation'
import type { Step } from '../hooks/useReconciliation'
import { ReconcileUpload } from './components/ReconcileUpload'
import { ReconcileReview } from './components/ReconcileReview'
import { ReconcileCompare } from './components/ReconcileCompare'

/* ── Main screen (thin router) ─────────────────────────────── */

export function ReconcileScreen() {
  const rc = useReconciliation()

  return (
    <div className="os-fade flex flex-col gap-5 max-w-4xl">
      {/* Server status */}
      {rc.serverOk === false && (
        <Card className="flex items-center gap-3">
          <Icon name="alert" size={18} style={{ color: 'var(--warn)' }} />
          <div className="text-sm">
            <span className="font-semibold" style={{ color: 'var(--warn)' }}>Server offline</span>
            <span style={{ color: 'var(--ink-2)' }}> -- start the extraction server: </span>
            <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>
              python cli/server.py
            </code>
          </div>
        </Card>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {(['upload', 'review', 'reconcile'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span style={{ color: 'var(--ink-3)' }}>--</span>}
            <span
              className="px-2.5 py-1 rounded-md"
              style={{
                background: rc.step === s ? 'var(--accent-weak)' : 'var(--surface-2)',
                color: rc.step === s ? 'var(--accent)' : 'var(--ink-3)',
                border: rc.step === s ? '1px solid var(--accent)' : '1px solid transparent',
              }}
            >
              {i + 1}. {s === 'upload' ? 'Upload' : s === 'review' ? 'Review' : 'Compare'}
            </span>
          </div>
        ))}
      </div>

      {/* Upload step */}
      {rc.step === 'upload' && (
        <ReconcileUpload onUpload={rc.handleUpload} loading={rc.loading} />
      )}

      {/* Loading */}
      {rc.loading && (
        <Card className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <div className="text-sm" style={{ color: 'var(--ink-2)' }}>
            Extracting bill data with LLM... this may take 15-30 seconds.
          </div>
        </Card>
      )}

      {/* Error */}
      {rc.error && (
        <Card className="flex items-start gap-3">
          <Icon name="alert" size={18} style={{ color: 'var(--bad)', flexShrink: 0, marginTop: 2 }} />
          <div className="text-sm" style={{ color: 'var(--bad)' }}>{rc.error}</div>
        </Card>
      )}

      {/* Review step */}
      {rc.step === 'review' && rc.extracted && (
        <ReconcileReview
          extracted={rc.extracted}
          utility={rc.utility} setUtility={rc.setUtility}
          state={rc.state} setState={rc.setState}
          rateCode={rc.rateCode} setRateCode={rc.setRateCode}
          periodStart={rc.periodStart} setPeriodStart={rc.setPeriodStart}
          periodEnd={rc.periodEnd} setPeriodEnd={rc.setPeriodEnd}
          usageTotal={rc.usageTotal} setUsageTotal={rc.setUsageTotal}
          usagePeak={rc.usagePeak} setUsagePeak={rc.setUsagePeak}
          usageOffPeak={rc.usageOffPeak} setUsageOffPeak={rc.setUsageOffPeak}
          supplyAmt={rc.supplyAmt} setSupplyAmt={rc.setSupplyAmt}
          supplyRate={rc.supplyRate} setSupplyRate={rc.setSupplyRate}
          deliveryAmt={rc.deliveryAmt} setDeliveryAmt={rc.setDeliveryAmt}
          deliveryRate={rc.deliveryRate} setDeliveryRate={rc.setDeliveryRate}
          customerCharge={rc.customerCharge} setCustomerCharge={rc.setCustomerCharge}
          demandCharge={rc.demandCharge} setDemandCharge={rc.setDemandCharge}
          demandKw={rc.demandKw} setDemandKw={rc.setDemandKw}
          totalBilled={rc.totalBilled} setTotalBilled={rc.setTotalBilled}
          selectedPlanId={rc.selectedPlanId} setSelectedPlanId={rc.setSelectedPlanId}
          matchedUtilities={rc.matchedUtilities}
          matchedPlan={rc.matchedPlan}
          plansForUtility={rc.plansForUtility}
          onReconcile={rc.handleReconcile}
          onReset={rc.handleReset}
        />
      )}

      {/* Compare step */}
      {rc.step === 'reconcile' && rc.workingBill && rc.matchedPlan && rc.comparison && (
        <ReconcileCompare
          workingBill={rc.workingBill}
          matchedPlan={rc.matchedPlan}
          comparison={rc.comparison}
          periodStart={rc.periodStart}
          periodEnd={rc.periodEnd}
          onBack={() => rc.setStep('review')}
          onReset={rc.handleReset}
        />
      )}
    </div>
  )
}

export default ReconcileScreen
