import { useCallback } from 'react'
import type { IntervalSeries } from '../../types'
import { ARCHETYPES } from '../../engine'
import { parseCSV } from '../../engine/csv'
import { parseGreenButton, isGreenButtonXML } from '../../engine/greenbutton'
import { Icon } from '../../components'

interface ProfilePickerProps {
  value: string
  onChange: (v: string) => void
  onCSVUpload: (series: IntervalSeries) => void
  csvInfo: { totalKwh: number; peakKw: number; days: number } | null
}

export function ProfilePicker({ value, onChange, onCSVUpload, csvInfo }: ProfilePickerProps) {
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const series = isGreenButtonXML(text) ? parseGreenButton(text) : parseCSV(text)
        onCSVUpload(series)
      } catch (err) {
        alert(`Parse error: ${(err as Error).message}`)
      }
    }
    reader.onerror = () => alert('Failed to read file')
    reader.readAsText(file)
  }, [onCSVUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const isCSV = value === 'csv'

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: '1fr' }}>
      {ARCHETYPES.map(p => {
        const on = p.id === value
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            aria-label={p.label}
            className="flex items-center gap-2.5 w-full text-left cursor-pointer transition-all"
            style={{
              padding: '9px 11px',
              background: on ? 'var(--accent-weak)' : 'var(--surface)',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span className="flex" style={{ color: on ? 'var(--accent)' : 'var(--ink-3)' }}>
              <Icon name={p.icon} size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>{p.label}</span>
              <span className="block font-mono text-[10px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: 'var(--ink-3)' }}>{p.sub}</span>
            </span>
          </button>
        )
      })}
      {/* CSV upload */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="flex items-center gap-2.5 w-full text-left cursor-pointer transition-all"
        style={{
          padding: '9px 11px',
          background: isCSV ? 'var(--accent-weak)' : 'var(--surface)',
          border: `1px dashed ${isCSV ? 'var(--accent)' : 'var(--line-strong)'}`,
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <span className="flex" style={{ color: isCSV ? 'var(--accent)' : 'var(--ink-3)' }}>
          <Icon name="download" size={18} />
        </span>
        <label className="min-w-0 cursor-pointer flex-1">
          <span className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
            {csvInfo ? 'Data loaded' : 'Upload interval data'}
          </span>
          <span className="block font-mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
            {csvInfo
              ? `${Math.round(csvInfo.totalKwh).toLocaleString()} kWh · ${csvInfo.days}d · ${csvInfo.peakKw.toFixed(1)} kW peak`
              : 'Drop file · CSV or Green Button XML'}
          </span>
          <input
            type="file"
            accept=".csv,.txt,.xml"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </label>
      </div>
    </div>
  )
}
