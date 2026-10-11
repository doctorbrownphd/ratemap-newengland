import { useState, useCallback } from 'react'
import { Icon, Card, Btn } from '../../components'

/* ── Upload drop zone ──────────────────────────────────────── */

function DropZone({ onFile, loading }: { onFile: (b64: string) => void; loading: boolean }) {
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      // Strip "data:application/pdf;base64," prefix
      const b64 = result.split(',')[1] || result
      onFile(b64)
    }
    reader.readAsDataURL(file)
  }, [onFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') handleFile(file)
  }, [handleFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className="flex flex-col items-center justify-center gap-3 py-10 transition-all"
      style={{
        border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--line-strong)'}`,
        borderRadius: 'var(--radius-lg)',
        background: dragOver ? 'var(--accent-weak)' : 'var(--surface)',
        opacity: loading ? 0.5 : 1,
        pointerEvents: loading ? 'none' : 'auto',
      }}
    >
      <Icon name="doc" size={32} style={{ color: 'var(--ink-3)' }} />
      <div className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
        Drop a utility bill PDF here
      </div>
      <label className="cursor-pointer">
        <Btn kind="outline" size="sm" icon="download">
          Choose file
        </Btn>
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </label>
      <span className="font-mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
        PDF only. File is not stored.
      </span>
    </div>
  )
}

/* ── Upload step ───────────────────────────────────────────── */

export function ReconcileUpload({ onUpload, loading }: {
  onUpload: (b64: string) => void
  loading: boolean
}) {
  return (
    <Card pad={0}>
      <div className="flex items-center gap-2.5"
        style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
        <Icon name="doc" size={17} style={{ color: 'var(--accent)' }} />
        <div className="text-[13.5px] font-semibold">Upload utility bill</div>
      </div>
      <div style={{ padding: '16px' }}>
        <DropZone onFile={onUpload} loading={loading} />
      </div>
    </Card>
  )
}
