import React from 'react'

const paths: Record<string, string[]> = {
  bolt: ['M13 2 L3 14h8l-1 8 10-12h-8l1-8z'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  shield: ['M12 2 L3 7v5c0 5 4 9 9 11 5-2 9-6 9-11V7z'],
  sun: [
    'M12 17a5 5 0 100-10 5 5 0 000 10z',
    'M12 1v2', 'M12 21v2',
    'M4.2 4.2l1.4 1.4', 'M18.4 18.4l1.4 1.4',
    'M1 12h2', 'M21 12h2',
    'M4.2 19.8l1.4-1.4', 'M18.4 5.6l1.4-1.4',
  ],
  moon: ['M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'],
  copy: [
    'M20 8h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z',
    'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1',
  ],
  download: [
    'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
  ],
  chevron: ['M15 18l-6-6 6-6'],
  chevdown: ['M6 9l6 6 6-6'],
  car: [
    'M16 6l3 5v4h-2a3 3 0 01-6 0H9a3 3 0 01-6 0H1v-4l3-5z',
    'M6 15a1 1 0 100-2 1 1 0 000 2z',
    'M16 15a1 1 0 100-2 1 1 0 000 2z',
  ],
  solar: [
    'M12 2v4', 'M12 18v4',
    'M4.9 4.9l2.8 2.8', 'M16.3 16.3l2.8 2.8',
    'M2 12h4', 'M18 12h4',
    'M4.9 19.1l2.8-2.8', 'M16.3 7.7l2.8-2.8',
    'M8 12a4 4 0 108 0 4 4 0 00-8 0z',
  ],
  home: [
    'M3 12l9-8 9 8',
    'M5 10v8a2 2 0 002 2h10a2 2 0 002-2v-8',
  ],
  flame: ['M12 12c0-3 2.5-5 2.5-8-3 2-6 6-6 9 0 2.5 1.5 4 4 4s4-1.5 4-4c0 5-4.5 7-4.5 11'],
  battery: [
    'M17 6H7a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2z',
    'M22 11v2',
  ],
  book: [
    'M4 19.5A2.5 2.5 0 016.5 17H20',
    'M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5z',
  ],
  layers: [
    'M12 2L2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  check: ['M20 6L9 17l-5-5'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  dollar: [
    'M12 1v22',
    'M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  ],
  doc: [
    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
    'M14 2v6h6',
    'M16 13H8', 'M16 17H8', 'M10 9H8',
  ],
  search: [
    'M11 17a6 6 0 100-12 6 6 0 000 12z',
    'M21 21l-4.35-4.35',
  ],
  bell: [
    'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9',
    'M13.73 21a2 2 0 01-3.46 0',
  ],
  building: [
    'M3 21h18', 'M5 21V7l7-4 7 4v14',
    'M9 21v-4h6v4',
    'M9 9h1', 'M14 9h1', 'M9 13h1', 'M14 13h1',
  ],
  clock: [
    'M12 21a9 9 0 100-18 9 9 0 000 18z',
    'M12 7v5l3 3',
  ],
  plug: [
    'M12 22v-5', 'M9 17h6',
    'M7 2v5', 'M17 2v5',
    'M7 7a5 5 0 005 5 5 5 0 005-5',
  ],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  external: [
    'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6',
    'M15 3h6v6',
    'M10 14L21 3',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  alert: [
    'M12 8v4', 'M12 16h.01',
    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  ],
}

interface IconProps {
  name: string
  size?: number
  sw?: number
  style?: React.CSSProperties
  className?: string
}

const Icon: React.FC<IconProps> = ({ name, size = 24, sw = 1.6, style, className }) => {
  const d = paths[name]
  if (!d) return null

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  )
}

export default Icon
