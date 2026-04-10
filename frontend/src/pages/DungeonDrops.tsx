import { useState, useEffect } from 'react'
import { formatEther, encodeFunctionData, decodeEventLog } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import { ADDRESSES } from '../lib/addresses'
import { DUNGEON_ENTRY_FEE } from '../lib/constants'
import toast from 'react-hot-toast'

const DUNGEON_ITEM_NAMES: Record<number, string> = {
  1: 'Common Sword',
  2: 'Rare Shield',
  3: 'Legendary Crown',
}

const ITEM_RARITY: Record<number, { color: string; bg: string; label: string }> = {
  1: { color: 'text-surface-600', bg: 'bg-surface-100 border-surface-200', label: 'Common' },
  2: { color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200',       label: 'Rare' },
  3: { color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     label: 'Legendary' },
}

const DROP_RATES = [
  { itemId: 1, name: 'Common Sword',    pct: 60, color: 'bg-surface-400' },
  { itemId: 2, name: 'Rare Shield',     pct: 30, color: 'bg-blue-500' },
  { itemId: 3, name: 'Legendary Crown', pct: 10, color: 'bg-amber-500' },
]

export default function DungeonDrops() {
  const { tba, refetch } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, isPending } = useTBA()

  const [dngnBalance, setDngnBalance] = useState(0n)
  const [totalRuns, setTotalRuns] = useState(0n)
  const [playerNonce, setPlayerNonce] = useState(0n)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [lootItemId, setLootItemId] = useState<number | null>(null)
  const [showLoot, setShowLoot] = useState(false)

  useEffect(() => {
    if (!tba) return
    const fetchAll = async () => {
      setIsLoadingData(true)
      try {
        const [dngn, runs, nonce] = await Promise.all([
          publicClient.readContract({ address: contracts.dungeonDropsToken.address, abi: contracts.dungeonDropsToken.abi, functionName: 'balanceOf', args: [tba] }),
          publicClient.readContract({ address: contracts.dungeonDrops.address, abi: contracts.dungeonDrops.abi, functionName: 'totalRuns', args: [] }),
          publicClient.readContract({ address: contracts.dungeonDrops.address, abi: contracts.dungeonDrops.abi, functionName: 'playerNonce', args: [tba] }),
        ])
        setDngnBalance(dngn as bigint)
        setTotalRuns(runs as bigint)
        setPlayerNonce(nonce as bigint)
      } catch (error) {
        console.error('Error fetching dungeon data:', error)
        toast.error('Failed to load dungeon data')
      } finally {
        setIsLoadingData(false)
      }
    }
    fetchAll()
  }, [tba, contracts])

  const handleEnterDungeon = async () => {
    if (!tba) return
    setShowLoot(false)
    setLootItemId(null)
    try {
      const calldata = encodeFunctionData({ abi: contracts.dungeonDrops.abi, functionName: 'enterDungeon', args: [] })
      const receipt = await execute(ADDRESSES.DungeonDrops, 0n, calldata)

      let droppedItemId: number | null = null
      if (receipt?.logs) {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: contracts.dungeonDrops.abi, eventName: 'DungeonEntered', topics: log.topics, data: log.data }) as any
            if (decoded?.args && decoded.args.itemId !== undefined) {
              droppedItemId = Number(decoded.args.itemId)
              break
            }
          } catch {}
        }
      }

      if (droppedItemId !== null) {
        setLootItemId(droppedItemId)
        requestAnimationFrame(() => { requestAnimationFrame(() => setShowLoot(true)) })
        toast.success(`You found: ${DUNGEON_ITEM_NAMES[droppedItemId] ?? 'Unknown Item'}!`)
      } else {
        toast.success('Run complete!')
      }

      refetch()
      const [newDngn, newRuns, newNonce] = await Promise.all([
        publicClient.readContract({ address: contracts.dungeonDropsToken.address, abi: contracts.dungeonDropsToken.abi, functionName: 'balanceOf', args: [tba] }),
        publicClient.readContract({ address: contracts.dungeonDrops.address, abi: contracts.dungeonDrops.abi, functionName: 'totalRuns', args: [] }),
        publicClient.readContract({ address: contracts.dungeonDrops.address, abi: contracts.dungeonDrops.abi, functionName: 'playerNonce', args: [tba] }),
      ])
      setDngnBalance(newDngn as bigint)
      setTotalRuns(newRuns as bigint)
      setPlayerNonce(newNonce as bigint)
    } catch (error) {
      console.error('Dungeon run failed:', error)
      toast.error('Dungeon run failed')
    }
  }

  const lootRarity = lootItemId ? ITEM_RARITY[lootItemId] : null
  const lootName = lootItemId ? DUNGEON_ITEM_NAMES[lootItemId] : null

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="page-title">Dungeon Drops</h1>
        <p className="text-surface-500 text-sm mt-1">Pay 10 DNGN to enter and roll for loot</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="stat-label">Balance</p>
          <p className="text-xl font-bold text-surface-900 mt-1">
            {isLoadingData ? '—' : parseFloat(formatEther(dngnBalance)).toFixed(1)}
          </p>
          <p className="text-xs text-surface-400">DNGN</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Entry Fee</p>
          <p className="text-xl font-bold text-surface-900 mt-1">10</p>
          <p className="text-xs text-surface-400">DNGN</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Your Runs</p>
          <p className="text-xl font-bold text-surface-900 mt-1">
            {isLoadingData ? '—' : playerNonce.toString()}
          </p>
          <p className="text-xs text-surface-400">of {totalRuns.toString()} total</p>
        </div>
      </div>

      {/* Enter Dungeon */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Enter the Dungeon</h2>
            <p className="text-surface-500 text-sm mt-0.5">Drops one random item per run</p>
          </div>
          <button
            onClick={handleEnterDungeon}
            disabled={isPending || dngnBalance < DUNGEON_ENTRY_FEE}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Running…
              </span>
            ) : 'Enter Dungeon'}
          </button>
        </div>

        {/* Loot reveal */}
        {lootItemId !== null && (
          <div
            style={{
              transition: 'opacity 500ms ease, transform 500ms ease',
              opacity: showLoot ? 1 : 0,
              transform: showLoot ? 'translateY(0)' : 'translateY(12px)',
            }}
            className={`rounded-xl border p-5 text-center ${lootRarity?.bg ?? 'bg-surface-50 border-surface-200'}`}
          >
            <p className="text-surface-400 text-xs uppercase tracking-widest mb-1">Loot Drop</p>
            <p className={`text-2xl font-bold ${lootRarity?.color ?? 'text-surface-900'}`}>
              {lootName}
            </p>
            <p className={`text-xs mt-1 font-medium ${lootRarity?.color ?? 'text-surface-500'}`}>
              {lootRarity?.label}
            </p>
          </div>
        )}
      </div>

      {/* Drop rates */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Drop Rates</h2>
        <div className="space-y-3">
          {DROP_RATES.map((row) => (
            <div key={row.itemId} className="flex items-center gap-3">
              <span className="text-surface-700 w-36 text-sm font-medium">{row.name}</span>
              <div className="flex-1 bg-surface-100 rounded-full h-2 overflow-hidden">
                <div className={`${row.color} h-2 rounded-full`} style={{ width: `${row.pct}%` }} />
              </div>
              <span className="text-surface-500 text-sm w-10 text-right font-mono">{row.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
