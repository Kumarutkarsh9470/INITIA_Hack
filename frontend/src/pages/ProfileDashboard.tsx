import { useState, useEffect } from 'react'
import { formatEther } from 'viem'
import { Link } from 'react-router-dom'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { DUNGEON_ITEMS, HARVEST_ITEMS, BADGE_NAMES } from '../lib/constants'
import TradingAdvisor from '../components/TradingAdvisor'
import toast from 'react-hot-toast'

export default function ProfileDashboard() {
  const { tokenId, tba, username, reputation } = usePlayerProfile()
  const contracts = useContracts()

  const [pxlBalance, setPxlBalance] = useState(0n)
  const [dngnBalance, setDngnBalance] = useState(0n)
  const [hrvBalance, setHrvBalance] = useState(0n)
  const [dungeonItems, setDungeonItems] = useState<Record<number, bigint>>({})
  const [harvestItems, setHarvestItems] = useState<Record<number, bigint>>({})
  const [badges, setBadges] = useState<Record<number, bigint>>({})
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isClaiming, setIsClaiming] = useState(false)

  useEffect(() => {
    if (!tba) return

    const fetchAll = async () => {
      setIsLoadingData(true)
      try {
        const [pxl, dngn, hrv] = await Promise.all([
          publicClient.readContract({
            address: contracts.pxlToken.address,
            abi: contracts.pxlToken.abi,
            functionName: 'balanceOf',
            args: [tba],
          }),
          publicClient.readContract({
            address: contracts.dungeonDropsToken.address,
            abi: contracts.dungeonDropsToken.abi,
            functionName: 'balanceOf',
            args: [tba],
          }),
          publicClient.readContract({
            address: contracts.harvestFieldToken.address,
            abi: contracts.harvestFieldToken.abi,
            functionName: 'balanceOf',
            args: [tba],
          }),
        ])
        setPxlBalance(pxl as bigint)
        setDngnBalance(dngn as bigint)
        setHrvBalance(hrv as bigint)

        const dItems: Record<number, bigint> = {}
        for (const id of [1, 2, 3]) {
          const bal = (await publicClient.readContract({
            address: contracts.dungeonDropsAssets.address,
            abi: contracts.dungeonDropsAssets.abi,
            functionName: 'balanceOf',
            args: [tba, BigInt(id)],
          })) as bigint
          dItems[id] = bal
        }
        setDungeonItems(dItems)

        const hItems: Record<number, bigint> = {}
        const hBal = (await publicClient.readContract({
          address: contracts.harvestFieldAssets.address,
          abi: contracts.harvestFieldAssets.abi,
          functionName: 'balanceOf',
          args: [tba, 1n],
        })) as bigint
        hItems[1] = hBal
        setHarvestItems(hItems)

        const b: Record<number, bigint> = {}
        for (const id of [1, 2]) {
          const bal = (await publicClient.readContract({
            address: contracts.achievementBadge.address,
            abi: contracts.achievementBadge.abi,
            functionName: 'balanceOf',
            args: [tba, BigInt(id)],
          })) as bigint
          b[id] = bal
        }
        setBadges(b)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        toast.error('Failed to load some dashboard data')
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchAll()
  }, [tba, contracts])

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const totalTokenValue = parseFloat(formatEther(pxlBalance)) + parseFloat(formatEther(dngnBalance)) + parseFloat(formatEther(hrvBalance))

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="page-title">{username}</h1>
        <p className="text-surface-500 text-sm mt-1">
          Profile #{tokenId.toString()} · <span className="font-mono">{tba ? truncate(tba) : '...'}</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Tokens', value: totalTokenValue.toFixed(2) },
          { label: 'Reputation', value: reputation.toString() },
          { label: 'Items Owned', value: Object.values(dungeonItems).reduce((a, b) => a + b, 0n).toString() },
          { label: 'Badges Earned', value: Object.values(badges).filter(b => b > 0n).length.toString() },
        ].map((stat, i) => (
          <div key={stat.label} className="card p-5 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="stat-label">{stat.label}</p>
            <p className="text-2xl font-bold text-surface-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Faucet claim banner — shown when all balances are zero */}
      {!isLoadingData && pxlBalance === 0n && dngnBalance === 0n && hrvBalance === 0n && tba && (
        <div className="card p-5 border-brand-200 bg-brand-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-surface-900">No tokens yet?</p>
            <p className="text-xs text-surface-500 mt-0.5">Claim free starter tokens — 10,000 PXL · 500 DNGN · 500 HRV</p>
          </div>
          <button
            onClick={async () => {
              setIsClaiming(true)
              try {
                const res = await fetch('/api/faucet', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tba }),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Faucet failed')
                toast.success('Starter tokens sent! Refreshing…')
                setTimeout(() => window.location.reload(), 2000)
              } catch (err: any) {
                toast.error(err?.message || 'Failed to claim tokens')
              } finally {
                setIsClaiming(false)
              }
            }}
            disabled={isClaiming}
            className="btn-primary px-5 py-2.5 text-sm whitespace-nowrap disabled:opacity-50"
          >
            {isClaiming ? 'Sending…' : 'Claim Starter Tokens'}
          </button>
        </div>
      )}

      {/* Token Balances */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">Balances</h2>
          <Link to="/dex" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            Trade on DEX →
          </Link>
        </div>
        {isLoadingData ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-14 bg-surface-100 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            <TokenRow label="PXL" balance={pxlBalance} desc="Platform Token" />
            <TokenRow label="DNGN" balance={dngnBalance} desc="Dungeon Drops" />
            <TokenRow label="HRV" balance={hrvBalance} desc="Harvest Field" />
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">Inventory</h2>
          <Link to="/marketplace" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            Marketplace →
          </Link>
        </div>
        {isLoadingData ? (
          <div className="animate-pulse h-20 bg-surface-100 rounded-xl" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(DUNGEON_ITEMS).map(([id, name]) => (
              <ItemCard key={`d-${id}`} name={name} count={dungeonItems[Number(id)] ?? 0n} game="Dungeon" />
            ))}
            {Object.entries(HARVEST_ITEMS).map(([id, name]) => (
              <ItemCard key={`h-${id}`} name={name} count={harvestItems[Number(id)] ?? 0n} game="Harvest" />
            ))}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="card p-6">
        <h2 className="section-title mb-5">Badges</h2>
        {isLoadingData ? (
          <div className="animate-pulse h-12 bg-surface-100 rounded-xl" />
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(BADGE_NAMES).map(([id, name]) => {
              const earned = (badges[Number(id)] ?? 0n) > 0n
              return (
                <div
                  key={id}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-medium ${
                    earned
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-surface-50 border-surface-200 text-surface-400'
                  }`}
                >
                  {earned ? '★ ' : '☆ '}{name}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* AI Trading Advisor */}
      <TradingAdvisor />

      {/* Quick Nav */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <NavButton to="/dungeon" label="Dungeon Drops" />
        <NavButton to="/harvest" label="Harvest Field" />
        <NavButton to="/dex" label="DEX" />
        <NavButton to="/marketplace" label="Marketplace" />
        <NavButton to="/gas" label="Gas Settings" />
        <NavButton to="/games" label="Game Hub" />
      </div>
    </div>
  )
}

function TokenRow({ label, balance, desc }: { label: string; balance: bigint; desc: string }) {
  return (
    <div className="flex items-center justify-between bg-surface-50 rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-surface-200 flex items-center justify-center text-xs font-bold text-surface-600">
          {label.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-surface-900 text-sm">{label}</p>
          <p className="text-surface-400 text-xs">{desc}</p>
        </div>
      </div>
      <p className="font-semibold text-surface-900">{parseFloat(formatEther(balance)).toFixed(2)}</p>
    </div>
  )
}

function ItemCard({ name, count, game }: { name: string; count: bigint; game: string }) {
  return (
    <div className="bg-surface-50 rounded-xl p-4 border border-surface-100">
      <p className="text-sm font-medium text-surface-900">{name}</p>
      <p className="text-surface-400 text-xs">{game}</p>
      <p className="text-lg font-bold text-surface-900 mt-1">×{count.toString()}</p>
    </div>
  )
}

function NavButton({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="card-hover p-4 text-center">
      <span className="text-sm font-medium text-surface-700">{label}</span>
    </Link>
  )
}
