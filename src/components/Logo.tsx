import React from 'react'

interface LogoProps {
  size?: number
}

const Logo: React.FC<LogoProps> = ({ size = 32 }) => {
  const wordmarkSize = size * 0.5
  const subtitleSize = size * 0.22

  return (
    <div className="flex items-center gap-2" style={{ gap: size * 0.25 }}>
      {/* Icon mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="7" fill="var(--accent)" />
        {/* Bar chart glyphs */}
        <rect x="7" y="18" width="4" height="8" rx="1" fill="var(--accent-ink)" opacity="0.9" />
        <rect x="14" y="12" width="4" height="14" rx="1" fill="var(--accent-ink)" opacity="0.9" />
        <rect x="21" y="8" width="4" height="18" rx="1" fill="var(--accent-ink)" opacity="0.9" />
      </svg>

      {/* Wordmark */}
      <div className="flex flex-col" style={{ gap: size * 0.02 }}>
        <span
          className="font-bold tracking-tight text-ink leading-none"
          style={{ fontSize: wordmarkSize, letterSpacing: '-0.02em' }}
        >
          RateMap
        </span>
        <span
          className="font-semibold uppercase tracking-widest text-ink-3 leading-none"
          style={{ fontSize: subtitleSize, letterSpacing: '0.08em' }}
        >
          New England Rate Explorer
        </span>
      </div>
    </div>
  )
}

export default Logo
