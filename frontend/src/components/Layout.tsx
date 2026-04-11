import { Link, useLocation } from 'react-router-dom'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useAutoSign } from '../hooks/useAutoSign'

const NAV_ITEMS = [
  { to: '/profile', label: 'Dashboard' },
  { to: '/games', label: 'Games' },
  { to: '/dex', label: 'DEX' },
  { to: '/marketplace', label: 'Market' },
  { to: '/sdk', label: 'SDK' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { openWallet } = useInterwovenKit()
  const { username, tba } = usePlayerProfile()
  const { isSessionActive, grantSession, revokeSession } = useAutoSign()

  const truncate = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-surface-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link to="/profile" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-surface-900 flex items-center justify-center text-xs font-bold text-white">
              PV
            </div>
            <span className="text-lg font-bold text-surface-900 hidden sm:inline">
              PixelVault
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'text-surface-900 font-semibold'
                      : 'text-surface-500 hover:text-surface-900'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {isSessionActive ? (
              <button
                onClick={revokeSession}
                title="Auto-sign is active — transactions sign without popups. Click to manage."
                className="hidden sm:flex items-center gap-1.5 text-emerald-600 text-xs font-medium hover:text-emerald-700 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auto-sign on
              </button>
            ) : (
              <button
                onClick={grantSession}
                title="Enable auto-sign to skip wallet popups for transactions"
                className="hidden sm:flex items-center gap-1.5 text-surface-400 text-xs font-medium hover:text-surface-600 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                Auto-sign
              </button>
            )}
            <button
              onClick={openWallet}
              className="flex items-center gap-2 bg-surface-100 hover:bg-surface-200 border border-surface-200 px-4 py-2 rounded-xl text-sm transition-all"
            >
              <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h.008M21 12v7.5m0-7.5H5.625c-.621 0-1.125.504-1.125 1.125v5.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V12zM3.375 7.5h16.5" />
              </svg>
              <span className="font-medium text-surface-700">
                {tba ? truncate(tba) : username || 'Wallet'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-surface-200 bg-white/95 backdrop-blur-xl px-1 py-2">
        {NAV_ITEMS.map(({ to, label }) => {
          const active = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                active
                  ? 'text-surface-900 font-semibold'
                  : 'text-surface-400'
              }`}
            >
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
