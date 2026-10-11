import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Icon, Logo } from './components'
import { CalculatorScreen } from './screens/Calculator'
import { CatalogScreen } from './screens/Catalog'

const LazyAdmin = lazy(() => import('./screens/Admin').then(m => ({ default: m.AdminScreen })))
const ReconcileScreen = lazy(() => import('./screens/Reconcile'))

const NAV: { path: string; label: string; icon: string }[] = [
  { path: '/calculator', label: 'Calculator', icon: 'bolt' },
  { path: '/catalog', label: 'Catalog', icon: 'grid' },
  { path: '/reconcile', label: 'Reconcile', icon: 'check' },
  ...(import.meta.env.DEV ? [{ path: '/admin', label: 'Admin', icon: 'layers' }] : []),
]

function TopBar({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center gap-3 sm:gap-6">
        <Logo size={24} />
        <nav className="flex gap-1" aria-label="Main navigation">
          {NAV.map(n => (
            <NavLink
              key={n.path}
              to={n.path}
              className={() =>
                `flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--accent-weak)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--ink-2)',
                border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
              })}
            >
              <Icon name={n.icon} size={14} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden md:inline font-mono text-[10px] tracking-wider uppercase px-2 py-1 rounded" style={{ color: 'var(--ink-3)', background: 'var(--surface-2)' }}>
          New England Rate Explorer
        </span>
        <button
          onClick={() => setDark(!dark)}
          className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer transition-all"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon name={dark ? 'sun' : 'moon'} size={16} />
        </button>
      </div>
    </header>
  )
}

function PageHead({ path }: { path: string }) {
  const info: Record<string, { title: string; desc: string }> = {
    '/calculator': {
      title: 'Rate calculator',
      desc: 'Model any New England rate plan against realistic load profiles. Compare plans, decompose bills, visualize TOU periods.',
    },
    '/catalog': {
      title: 'Rate-plan catalog',
      desc: 'Browse the seed dataset of New England utility rate structures. Inspect charges, periods, and source filings.',
    },
    '/admin': {
      title: 'Rate extraction',
      desc: 'Extract rate plans from tariff PDFs using LLM-assisted parsing with human verification.',
    },
    '/reconcile': {
      title: 'Bill reconciliation',
      desc: 'Upload a utility bill to verify charges against our rate data. Line-by-line comparison with delta analysis.',
    },
  }
  const { title, desc } = info[path] || info['/calculator']
  return (
    <div className="py-6">
      <h1 className="text-xl font-semibold mb-1">{title}</h1>
      <p className="text-sm" style={{ color: 'var(--ink-2)' }}>{desc}</p>
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem('ratemap-dark')
      if (stored !== null) return stored === 'true'
    } catch { /* private browsing */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('ratemap-dark', String(dark))
  }, [dark])

  return (
    <div className="min-h-screen">
      <TopBar dark={dark} setDark={setDark} />
      <main className="max-w-7xl mx-auto px-4">
        <Routes>
          <Route path="/calculator" element={<><PageHead path="/calculator" /><CalculatorScreen /></>} />
          <Route path="/catalog" element={<><PageHead path="/catalog" /><CatalogScreen /></>} />
          <Route path="/admin" element={<Suspense fallback={null}><PageHead path="/admin" /><LazyAdmin /></Suspense>} />
          <Route path="/reconcile" element={<Suspense fallback={null}><PageHead path="/reconcile" /><ReconcileScreen /></Suspense>} />
          <Route path="*" element={<Navigate to="/calculator" replace />} />
        </Routes>
      </main>
    </div>
  )
}
