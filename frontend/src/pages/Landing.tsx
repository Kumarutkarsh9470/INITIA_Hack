import { useInterwovenKit } from '@initia/interwovenkit-react'
import { useNavigate } from 'react-router-dom'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useEffect } from 'react'

const FEATURES = [
  {
    title: 'Player Identity (TBA)',
    desc: 'Mint an NFT profile with a Token Bound Account — one smart-contract wallet for all games.',
  },
  {
    title: 'Cross-Game Economy',
    desc: 'Items and tokens earned in any game live in your TBA. Trade freely on the shared marketplace.',
  },
  {
    title: 'IBC Token Bridge',
    desc: 'Bridge PXL, DNGN, HRV tokens to Initia L1 via IBC. Tokens are registered with the Cosmos bank module through ERC20Registry.',
  },
  {
    title: 'Gas Abstraction',
    desc: 'Pay gas with any game token — the Paymaster auto-swaps behind the scenes via the DEX.',
  },
  {
    title: 'Cosmos Identity',
    desc: 'Each player wallet has a Cosmos (init1...) address alongside EVM. View your cross-chain identity on the dashboard.',
  },
  {
    title: 'On-Chain Achievements',
    desc: 'Earn soulbound badges per game. Your reputation score grows as you play across the ecosystem.',
  },
]

const ARCH_STEPS = [
  'Player NFT',
  'TBA Wallet',
  'Game Tokens',
  'DEX',
  'IBC Bridge',
  'Marketplace',
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
      <header className="border-b border-surface-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-surface-900 flex items-center justify-center text-xs font-bold text-white">
              PV
            </div>
            <span className="text-lg font-bold text-surface-900">PixelVault</span>
          </div>
          <button
            onClick={initiaAddress ? () => navigate('/create-profile') : openConnect}
            className="btn-primary text-sm py-2.5"
          >
            {initiaAddress ? 'Enter App' : 'Connect Wallet'}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="badge bg-surface-100 text-surface-600 mb-6 mx-auto w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Built on Initia MiniEVM
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-surface-900 mb-5">
          Cross-Game Player
          <br />
          Economy Infrastructure
        </h1>

        <p className="text-lg text-surface-500 max-w-xl mx-auto mb-10 leading-relaxed">
          One identity. One wallet. Every game. Earn items, trade on a shared marketplace,
          and never worry about gas tokens.
        </p>

        <div className="flex items-center justify-center gap-4">
          {!initiaAddress ? (
            <button onClick={openConnect} className="btn-primary text-base px-8 py-4">
              Connect Wallet
              <svg className="w-4 h-4 inline ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          ) : (
            <button onClick={() => navigate('/create-profile')} className="btn-primary text-base px-8 py-4">
              Create Profile
              <svg className="w-4 h-4 inline ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {/* Architecture flow */}
      <section className="max-w-4xl mx-auto px-6 mb-20">
        <div className="card p-8">
          <p className="stat-label text-center mb-6">Architecture</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {ARCH_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="bg-surface-100 border border-surface-200 px-4 py-2 rounded-lg text-sm font-medium text-surface-700">
                  {step}
                </span>
                {i < ARCH_STEPS.length - 1 && (
                  <svg className="w-4 h-4 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          ERC-721 identity + ERC-6551 TBA + ERC-1155 items + AMM DEX + IBC Bridge + Cosmos Bank
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="card-hover p-6 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
              <h3 className="font-semibold text-surface-900 mb-2">{f.title}</h3>
              <p className="text-surface-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 py-6 text-center text-surface-400 text-xs">
        PixelVault — Built for Initia Hackathon
      </footer>
    </div>
  )
}
