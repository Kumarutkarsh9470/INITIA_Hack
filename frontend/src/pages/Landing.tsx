import { useInterwovenKit } from '@initia/interwovenkit-react'
import { useNavigate } from 'react-router-dom'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useEffect } from 'react'

const FEATURES = [
  {
    title: 'Player Identity (TBA)',
    desc: 'Mint an NFT profile with a Token Bound Account — one smart-contract wallet for all games.',
    icon: '🎭',
    accent: 'from-violet-500/10 to-violet-500/5',
    border: 'hover:border-violet-300',
  },
  {
    title: 'Cross-Game Economy',
    desc: 'Items and tokens earned in any game live in your TBA. Trade freely on the shared marketplace.',
    icon: '🔗',
    accent: 'from-blue-500/10 to-blue-500/5',
    border: 'hover:border-blue-300',
  },
  {
    title: 'IBC Token Bridge',
    desc: 'Bridge PXL, DNGN, HRV tokens to Initia L1 via IBC. Tokens are registered with the Cosmos bank module.',
    icon: '🌉',
    accent: 'from-cyan-500/10 to-cyan-500/5',
    border: 'hover:border-cyan-300',
  },
  {
    title: 'Gas Abstraction',
    desc: 'Pay gas with any game token — the Paymaster auto-swaps behind the scenes via the DEX.',
    icon: '⛽',
    accent: 'from-amber-500/10 to-amber-500/5',
    border: 'hover:border-amber-300',
  },
  {
    title: 'Cosmos Identity',
    desc: 'Each player wallet has a Cosmos (init1...) address alongside EVM. View your cross-chain identity.',
    icon: '🌐',
    accent: 'from-emerald-500/10 to-emerald-500/5',
    border: 'hover:border-emerald-300',
  },
  {
    title: 'On-Chain Achievements',
    desc: 'Earn soulbound badges per game. Your reputation score grows as you play across the ecosystem.',
    icon: '🏆',
    accent: 'from-rose-500/10 to-rose-500/5',
    border: 'hover:border-rose-300',
  },
]

const ARCH_STEPS = [
  { label: 'Player NFT', icon: '🎮' },
  { label: 'TBA Wallet', icon: '💎' },
  { label: 'Game Tokens', icon: '🪙' },
  { label: 'DEX', icon: '📊' },
  { label: 'IBC Bridge', icon: '🌉' },
  { label: 'Marketplace', icon: '🏪' },
]

const STATS = [
  { label: 'Contracts', value: '19' },
  { label: 'Game Tokens', value: '3+' },
  { label: 'Token Standards', value: '4' },
  { label: 'Chain', value: 'MiniEVM' },
]

export default function Landing() {
  const { initiaAddress, openConnect } = useInterwovenKit()
  const { hasProfile, isLoading } = usePlayerProfile()
  const navigate = useNavigate()

  useEffect(() => {
    if (initiaAddress && !isLoading && hasProfile) {
      navigate('/profile')
    }
  }, [initiaAddress, hasProfile, isLoading, navigate])

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-surface-200/60 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
              PV
            </div>
            <span className="text-lg font-bold text-surface-900">PixelVault</span>
          </div>
          <button
            onClick={initiaAddress ? () => navigate('/create-profile') : openConnect}
            className="bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.97] shadow-md hover:shadow-lg"
          >
            {initiaAddress ? 'Enter App' : 'Connect Wallet'}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 hero-mesh" />
        <div className="absolute inset-0 bg-grid opacity-40" />

        {/* Floating decorative elements */}
        <div className="absolute top-20 left-[10%] w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400/20 to-violet-400/20 blur-sm animate-float" />
        <div className="absolute top-40 right-[15%] w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 blur-sm animate-float-slow" />
        <div className="absolute bottom-20 left-[20%] w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400/15 to-rose-400/15 blur-sm animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-32 right-[35%] w-8 h-8 rounded-full bg-gradient-to-br from-violet-400/15 to-pink-400/15 blur-sm animate-float-slow" style={{ animationDelay: '1s' }} />

        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur border border-surface-200/60 text-surface-600 text-xs font-medium px-4 py-2 rounded-full mb-8 shadow-sm animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live on Initia MiniEVM
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <span className="text-surface-900">One Economy.</span>
            <br />
            <span className="text-gradient bg-gradient-to-r from-brand-600 via-violet-600 to-emerald-500">
              Every Game.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-surface-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            Open gaming infrastructure on Initia. Any game registers, gets tokens, items, DEX liquidity,
            marketplace access, and gas abstraction — automatically.
          </p>

          <div className="flex items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            {!initiaAddress ? (
              <button onClick={openConnect} className="bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-semibold text-base px-8 py-4 rounded-xl transition-all duration-200 active:scale-[0.97] shadow-lg hover:shadow-xl">
                Connect Wallet
                <svg className="w-4 h-4 inline ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            ) : (
              <button onClick={() => navigate('/create-profile')} className="bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-semibold text-base px-8 py-4 rounded-xl transition-all duration-200 active:scale-[0.97] shadow-lg hover:shadow-xl">
                Create Profile
                <svg className="w-4 h-4 inline ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mt-16 max-w-lg mx-auto animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-surface-900">{s.value}</p>
                <p className="text-xs text-surface-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture flow */}
      <section className="max-w-4xl mx-auto px-6 mb-20 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
        <div className="card p-8 glow-ring">
          <p className="stat-label text-center mb-6">Architecture Flow</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {ARCH_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <span className="bg-gradient-to-br from-surface-50 to-surface-100 border border-surface-200 px-4 py-2.5 rounded-xl text-sm font-medium text-surface-700 flex items-center gap-2 hover:shadow-sm transition-all">
                  <span>{step.icon}</span>
                  {step.label}
                </span>
                {i < ARCH_STEPS.length - 1 && (
                  <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center text-surface-900 mb-2">Protocol Features</h2>
        <p className="text-center text-surface-500 mb-10 text-sm">
          ERC-721 identity · ERC-6551 TBA · ERC-1155 items · AMM DEX · IBC Bridge · Cosmos Bank
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`card-hover p-6 animate-fade-in-up bg-gradient-to-br ${f.accent} ${f.border}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-2xl mb-3 block">{f.icon}</span>
              <h3 className="font-semibold text-surface-900 mb-2">{f.title}</h3>
              <p className="text-surface-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Games preview */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center text-surface-900 mb-2">Live Games</h2>
        <p className="text-center text-surface-500 mb-10 text-sm">
          Three demo games demonstrating the shared infrastructure
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="rounded-2xl overflow-hidden border border-surface-200 hover:shadow-lg transition-all duration-300 group">
            <div className="dungeon-gradient p-8 text-center">
              <span className="text-5xl block mb-3">⚔️</span>
              <h3 className="text-white font-bold text-xl">Dungeon Drops</h3>
              <p className="text-white/60 text-sm mt-1">Loot-based dungeon crawler</p>
            </div>
            <div className="p-5 bg-white">
              <p className="text-surface-500 text-sm">Pay DNGN to enter dungeons, roll for rare items. Gas paid via Paymaster.</p>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border border-surface-200 hover:shadow-lg transition-all duration-300 group">
            <div className="harvest-gradient p-8 text-center">
              <span className="text-5xl block mb-3">🌾</span>
              <h3 className="text-white font-bold text-xl">Harvest Field</h3>
              <p className="text-white/60 text-sm mt-1">Farming & staking simulator</p>
            </div>
            <div className="p-5 bg-white">
              <p className="text-surface-500 text-sm">Stake HRV tokens, wait for harvest cycle, collect seasonal yield.</p>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border border-surface-200 hover:shadow-lg transition-all duration-300 group">
            <div className="bg-gradient-to-br from-orange-600 to-red-600 p-8 text-center">
              <span className="text-5xl block mb-3">🏎️</span>
              <h3 className="text-white font-bold text-xl">Cosmic Racer</h3>
              <p className="text-white/60 text-sm mt-1">Racing game (3rd-party demo)</p>
            </div>
            <div className="p-5 bg-white">
              <p className="text-surface-500 text-sm">Registered via <code className="text-xs bg-surface-100 px-1 rounded">registerGameWithFee()</code> — proving permissionless onboarding.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 py-8 text-center">
        <p className="text-surface-400 text-xs">PixelVault — Built for Initia Hackathon</p>
        <p className="text-surface-300 text-[10px] mt-1">19 smart contracts · MiniEVM · IBC · ERC-6551 · Permissionless game registration</p>
      </footer>
    </div>
  )
}
