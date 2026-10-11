import React from 'react'
import Icon from './Icon'

/* ── Btn ────────────────────────────────────────────────────── */

interface BtnProps {
  children?: React.ReactNode
  kind?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  active?: boolean
  className?: string
  title?: string
}

const btnBase =
  'inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-150 cursor-pointer select-none whitespace-nowrap'

const btnKinds: Record<string, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-2 shadow-sm',
  secondary:
    'bg-surface-2 text-ink hover:bg-surface-3 border border-line',
  ghost:
    'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
  outline:
    'bg-transparent text-ink border border-line hover:bg-surface-2 hover:border-line-strong',
}

const btnSizes: Record<string, string> = {
  sm: 'text-xs px-2.5 py-1 rounded-[var(--radius-sm)]',
  md: 'text-sm px-3.5 py-1.5 rounded-[var(--radius)]',
  lg: 'text-sm px-5 py-2.5 rounded-[var(--radius)]',
}

export const Btn: React.FC<BtnProps> = ({
  children,
  kind = 'secondary',
  size = 'md',
  icon,
  onClick,
  active,
  className = '',
  title,
}) => {
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${btnBase} ${btnKinds[kind]} ${btnSizes[size]} ${
        active ? 'ring-2 ring-accent/40' : ''
      } ${className}`}
    >
      {icon && <Icon name={icon} size={iconSize} sw={1.8} />}
      {children}
    </button>
  )
}

/* ── Segmented ──────────────────────────────────────────────── */

type SegmentOption = string | { value: string; label: string; icon?: string }

interface SegmentedProps {
  options: SegmentOption[]
  value: string
  onChange: (v: string) => void
  size?: 'sm' | 'md'
}

export const Segmented: React.FC<SegmentedProps> = ({
  options,
  value,
  onChange,
  size = 'md',
}) => {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <div className="inline-flex items-center gap-0.5 rounded-[var(--radius)] bg-surface-2 p-0.5 border border-line">
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? opt : opt.label
        const icon = typeof opt === 'string' ? undefined : opt.icon
        const active = val === value

        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={`${pad} inline-flex items-center gap-1 rounded-[var(--radius-sm)] font-medium transition-colors duration-150 cursor-pointer select-none whitespace-nowrap ${
              active
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} sw={1.8} />}
            {label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Field ──────────────────────────────────────────────────── */

interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
  accent?: boolean
}

export const Field: React.FC<FieldProps> = ({ label, hint, children, accent }) => (
  <label className="flex flex-col gap-1">
    <span
      className={`text-xs font-semibold uppercase tracking-wider ${
        accent ? 'text-accent' : 'text-ink-3'
      }`}
    >
      {label}
    </span>
    {children}
    {hint && <span className="text-xs text-ink-3">{hint}</span>}
  </label>
)

/* ── Select ─────────────────────────────────────────────────── */

interface SelectProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

export const Select: React.FC<SelectProps> = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="appearance-none bg-surface border border-line rounded-[var(--radius)] px-3 py-1.5 text-sm text-ink font-medium cursor-pointer transition-colors hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
)

/* ── Badge ──────────────────────────────────────────────────── */

interface BadgeProps {
  children: React.ReactNode
  tone?: 'ok' | 'warn' | 'bad' | 'accent' | 'neutral'
  mono?: boolean
}

const badgeTones: Record<string, string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
  accent: 'bg-accent-weak text-accent',
  neutral: 'bg-surface-2 text-ink-2',
}

export const Badge: React.FC<BadgeProps> = ({ children, tone = 'neutral', mono }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-semibold ${
      badgeTones[tone]
    } ${mono ? 'font-mono' : ''}`}
  >
    {children}
  </span>
)

/* ── Stat ───────────────────────────────────────────────────── */

interface StatProps {
  label: string
  value: string | number
  unit?: string
  sub?: string
  color?: string
}

export const Stat: React.FC<StatProps> = ({ label, value, unit, sub, color }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
      {label}
    </span>
    <div className="flex items-baseline gap-1">
      <span
        className="text-xl font-bold tabular-nums tracking-tight"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      {unit && <span className="text-xs font-medium text-ink-3">{unit}</span>}
    </div>
    {sub && <span className="text-xs text-ink-3">{sub}</span>}
  </div>
)

/* ── Card ───────────────────────────────────────────────────── */

interface CardProps {
  children: React.ReactNode
  className?: string
  pad?: number
  hover?: boolean
  style?: React.CSSProperties
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  pad = 20,
  hover,
  style,
}) => (
  <div
    className={`bg-surface border border-line rounded-[var(--radius-lg)] shadow-sm ${
      hover ? 'transition-shadow duration-200 hover:shadow-md' : ''
    } ${className}`}
    style={{ padding: pad, ...style }}
  >
    {children}
  </div>
)
