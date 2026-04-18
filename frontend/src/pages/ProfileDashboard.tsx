import { useState, useEffect, useCallback } from 'react'
import { formatEther } from 'viem'
import { Link } from 'react-router-dom'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { DUNGEON_ITEMS, HARVEST_ITEMS, COSMIC_ITEMS, BADGE_NAMES } from '../lib/constants'
import TradingAdvisor from '../components/TradingAdvisor'
import toast from 'react-hot-toast'

interface RegisteredGame { gameId: `0x${string}`; name: string; symbol: string; tokenAddress: `0x${string}`; assetCollection: `0x${string}` }

const KNOWN_ITEMS: Record<string, Record<number, string>> = {}
function registerKnownItems(collection: string, symbol: string) {
  const c = collection.toLowerCase()
  if (symbol === 'DNGN') KNOWN_ITEMS[c] = DUNGEON_ITEMS
  else if (symbol === 'HRV') KNOWN_ITEMS[c] = HARVEST_ITEMS
  else if (symbol === 'RACE') KNOWN_ITEMS[c] = COSMIC_ITEMS
}

export default function ProfileDashboard() {
  const { tokenId, tba, username, reputation } = usePlayerProfile()
  const contracts = useContracts()

  const [pxlBalance, setPxlBalance] = useState(0n)
  const [games, setGames] = useState<RegisteredGame[]>([])
  const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>({})
  const [allItems, setAllItems] = useState<{ name: string; count: bigint; game: string }[]>([])
  const [badges, setBadges] = useState<Record<number, bigint>>({})
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isClaiming, setIsClaiming] = useState(false)
  const [cosmosAddr, setCosmosAddr] = useState('')

  const fetchAll = useCallback(async () => {
    if (!tba) return
    setIsLoadingData(true)
    try {
      // Fetch registered games
      const countRaw = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameCount' })
      const count = Number(countRaw)
      const fetchedGames: RegisteredGame[] = []
      for (let i = 0; i < count; i++) {
        const gameId = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'gameIds', args: [BigInt(i)] }) as `0x${string}`
        const data = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'games', args: [gameId] }) as any
        if (data[8] === true) {
          const game: RegisteredGame = { gameId, name: data[3], symbol: data[4], tokenAddress: data[0], assetCollection: data[1] }
          fetchedGames.push(game)
          registerKnownItems(game.assetCollection, game.symbol)
        }
      }
      setGames(fetchedGames)

      // PXL balance
      const pxl = await publicClient.readContract({ address: contracts.pxlToken.address, abi: contracts.pxlToken.abi, functionName: 'balanceOf', args: [tba] }) as bigint
      setPxlBalance(pxl)

      // Game token balances
      const balances: Record<string, bigint> = {}
      for (const game of fetchedGames) {
        balances[game.symbol] = (await publicClient.readContract({ address: game.tokenAddress, abi: contracts.pxlToken.abi, functionName: 'balanceOf', args: [tba] })) as bigint
      }
      setTokenBalances(balances)

      // Items across all games
      const items: { name: string; count: bigint; game: string }[] = []
      const erc1155Abi = contracts.dungeonDropsAssets.abi
      for (const game of fetchedGames) {
        const knownMap = KNOWN_ITEMS[game.assetCollection.toLowerCase()] ?? {}
        const maxItem = Math.max(...Object.keys(knownMap).map(Number), 5)
        for (let id = 1; id <= maxItem; id++) {
          try {
            const bal = (await publicClient.readContract({ address: game.assetCollection, abi: erc1155Abi, functionName: 'balanceOf', args: [tba, BigInt(id)] })) as bigint
            items.push({ name: knownMap[id] ?? `Item #${id}`, count: bal, game: game.name })
          } catch { /* skip */ }
        }
      }
      setAllItems(items)

      // Badges
      const b: Record<number, bigint> = {}
      const badgeIds = Object.keys(BADGE_NAMES).map(Number)
      for (const id of badgeIds) {
        const bal = (await publicClient.readContract({ address: contracts.achievementBadge.address, abi: contracts.achievementBadge.abi, functionName: 'balanceOf', args: [tba, BigInt(id)] })) as bigint
        b[id] = bal
      }
      setBadges(b)

      // Cosmos address
      try {
        const cosAddr = await publicClient.readContract({ address: contracts.cosmoBridge.address, abi: contracts.cosmoBridge.abi, functionName: 'getCosmosAddress', args: [tba] })
        setCosmosAddr(cosAddr as string)
      } catch { /* precompile not available */ }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load some dashboard data')
    } finally {
      setIsLoadingData(false)
    }
  }, [tba, contracts])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const totalTokenValue = parseFloat(formatEther(pxlBalance)) + Object.values(tokenBalances).reduce((a, b) => a + parseFloat(formatEther(b)), 0)
  const totalItems = allItems.reduce((a, b) => a + Number(b.count), 0)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="page-title">{username}</h1>
        <p className="text-surface-500 text-sm mt-1">
          Profile #{tokenId.toString()} · <span className="font-mono">{tba ? truncate(tba) : '...'}</span>
        </p>
        {cosmosAddr && (
          <p className="text-surface-400 text-xs mt-1 font-mono">
            Cosmos: {cosmosAddr}
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Tokens', value: totalTokenValue.toFixed(2) },
          { label: 'Reputation', value: reputation.toString() },
          { label: 'Items Owned', value: totalItems.toString() },
          { label: 'Badges Earned', value: Object.values(badges).filter(b => b > 0n).length.toString() },
        ].map((stat, i) => (
          <div key={stat.label} className="card p-5 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="stat-label">{stat.label}</p>
            <p className="text-2xl font-bold text-surface-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Faucet claim banner — shown when any expected token balance is zero */}
      {!isLoadingData && (pxlBalance === 0n || Object.values(tokenBalances).some(b => b === 0n)) && tba && (
        <div className="card p-5 border-brand-200 bg-brand-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-surface-900">No tokens yet?</p>
            <p className="text-xs text-surface-500 mt-0.5">Claim free starter tokens — 10,000 PXL · 500 DNGN · 500 HRV · 500 RACE</p>
          </div>
          <button
            onClick={async () => {
              setIsClaiming(true)
              try {
                let res = await fetch('/api/faucet', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tba }),
                })
                // Retry once on failure
                if (!res.ok) {
                  await new Promise(r => setTimeout(r, 2000))
                  res = await fetch('/api/faucet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tba }),
                  })
                }
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Faucet failed')
                toast.success('Tokens submitted! Waiting for chain confirmation…')
                // Find a token that currently has zero balance to poll
                const zeroToken = games.find(g => (tokenBalances[g.symbol] ?? 0n) === 0n)
                const pollAddress = pxlBalance === 0n ? contracts.pxlToken.address : zeroToken?.tokenAddress ?? contracts.pxlToken.address
                const prevBal = pxlBalance === 0n ? 0n : (zeroToken ? (tokenBalances[zeroToken.symbol] ?? 0n) : pxlBalance)
                // Poll for balance changes — txs are submitted but may not be mined yet
                for (let attempt = 0; attempt < 18; attempt++) {
                  await new Promise(r => setTimeout(r, 5000))
                  try {
                    const bal = await publicClient.readContract({
                      address: pollAddress,
                      abi: contracts.pxlToken.abi,
                      functionName: 'balanceOf',
                      args: [tba],
                    }) as bigint
                    if (bal > prevBal) {
                      toast.success('Starter tokens received!')
                      await fetchAll()
                      return
                    }
                  } catch { /* retry */ }
                }
                // If we get here, polling timed out — reload as last resort
                toast('Tokens sent — refreshing page…', { icon: '⏳' })
                window.location.reload()
              } catch (err: any) {
                const msg = err?.message || 'Failed to claim tokens'
                toast.error(msg.length > 80 ? 'Failed to claim tokens — please try again' : msg)
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
            {games.map(g => (
              <TokenRow key={g.symbol} label={g.symbol} balance={tokenBalances[g.symbol] ?? 0n} desc={g.name} />
            ))}
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
            {allItems.filter(it => it.count > 0n).map((it, idx) => (
              <ItemCard key={idx} name={it.name} count={it.count} game={it.game} />
            ))}
            {allItems.every(it => it.count === 0n) && (
              <p className="col-span-full text-center text-surface-400 text-sm py-4">No items yet. Play games to earn items!</p>
            )}
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


