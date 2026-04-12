import { useState, useEffect } from 'react'
import { formatEther, encodeFunctionData, decodeEventLog } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import { ADDRESSES } from '../lib/addresses'
import { DUNGEON_ENTRY_FEE } from '../lib/constants'
import toast from 'react-hot-toast'

const GAS_COST_DNGN = 5n * 10n ** 18n // 5 DNGN per run for gas

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

const ITEM_BONUSES: Record<number, { icon: string; label: string; bonus: string }> = {
  1: { icon: '⚔️', label: 'Common Sword', bonus: '+5% crit chance' },
  2: { icon: '🛡️', label: 'Rare Shield', bonus: '+10% defense, -1 DNGN fee' },
  3: { icon: '👑', label: 'Legendary Crown', bonus: '+25% loot quality, -3 DNGN fee' },
}

export default function DungeonDrops() {
  const { tba, refetch } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, executeViaPaymaster, isPending } = useTBA()

  const [dngnBalance, setDngnBalance] = useState(0n)
  const [totalRuns, setTotalRuns] = useState(0n)
  const [playerNonce, setPlayerNonce] = useState(0n)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [lootItemId, setLootItemId] = useState<number | null>(null)
  const [showLoot, setShowLoot] = useState(false)
  const [usePaymaster, setUsePaymaster] = useState(() => {
    try { return localStorage.getItem('pv-gas-dungeon') !== 'off' } catch { return true }
  })
  const [itemBalances, setItemBalances] = useState<Record<number, bigint>>({ 1: 0n, 2: 0n, 3: 0n })

  useEffect(() => {
    if (!tba) return
    const fetchAll = async () => {
      setIsLoadingData(true)
      try {
        const [dngn, runs, nonce, item1, item2, item3] = await Promise.all([
          publicClient.readContract({ address: contracts.dungeonDropsToken.address, abi: contracts.dungeonDropsToken.abi, functionName: 'balanceOf', args: [tba] }),
          publicClient.readContract({ address: contracts.dungeonDrops.address, abi: contracts.dungeonDrops.abi, functionName: 'totalRuns', args: [] }),
          publicClient.readContract({ address: contracts.dungeonDrops.address, abi: contracts.dungeonDrops.abi, functionName: 'playerNonce', args: [tba] }),
          publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }),
          publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }),
          publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }),
        ])
        setDngnBalance(dngn as bigint)
        setTotalRuns(runs as bigint)
        setPlayerNonce(nonce as bigint)
        setItemBalances({ 1: item1 as bigint, 2: item2 as bigint, 3: item3 as bigint })
      } catch (error) {
        console.error('Error fetching dungeon data:', error)
        toast.error('Failed to load dungeon data')
      } finally {
        setIsLoadingData(false)
      }
    }
    fetchAll()
  }, [tba, contracts])

  const togglePaymaster = () => {
    const next = !usePaymaster
    setUsePaymaster(next)
    try { localStorage.setItem('pv-gas-dungeon', next ? 'on' : 'off') } catch {}
  }

  const handleEnterDungeon = async () => {
    if (!tba) return
    setShowLoot(false)
    setLootItemId(null)
    try {
      // Step 1: Check allowance and approve DungeonDrops to pull DNGN from TBA (entry fee)
      const allowance = await publicClient.readContract({
        address: contracts.dungeonDropsToken.address,
        abi: contracts.dungeonDropsToken.abi,
        functionName: 'allowance',
        args: [tba, ADDRESSES.DungeonDrops],
      }) as bigint

      if (allowance < DUNGEON_ENTRY_FEE) {
        const approveData = encodeFunctionData({
          abi: contracts.dungeonDropsToken.abi,
          functionName: 'approve',
          args: [ADDRESSES.DungeonDrops, DUNGEON_ENTRY_FEE * 100n],
        })
        await execute(contracts.dungeonDropsToken.address, 0n, approveData)
      }

      const calldata = encodeFunctionData({ abi: contracts.dungeonDrops.abi, functionName: 'enterDungeon', args: [] })

      let receipt: any
      if (usePaymaster) {
        // Step 2a: Approve GasPaymaster to pull DNGN for gas
        const paymasterAllowance = await publicClient.readContract({
          address: contracts.dungeonDropsToken.address,
          abi: contracts.dungeonDropsToken.abi,
          functionName: 'allowance',
          args: [tba, ADDRESSES.GasPaymaster],
        }) as bigint

        if (paymasterAllowance < GAS_COST_DNGN) {
          const approvePaymaster = encodeFunctionData({
            abi: contracts.dungeonDropsToken.abi,
            functionName: 'approve',
            args: [ADDRESSES.GasPaymaster, GAS_COST_DNGN * 100n],
          })
          await execute(contracts.dungeonDropsToken.address, 0n, approvePaymaster)
        }

        // Step 3a: Enter dungeon via GasPaymaster
        receipt = await executeViaPaymaster(
          contracts.dungeonDropsToken.address,
          GAS_COST_DNGN,
          ADDRESSES.DungeonDrops as `0x${string}`,
          calldata,
        )
      } else {
        // Step 2b: Enter dungeon directly
        receipt = await execute(ADDRESSES.DungeonDrops, 0n, calldata)
      }

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
      const [newDngn, newRuns, newNonce, newItem1, newItem2, newItem3] = await Promise.all([
        publicClient.readContract({ address: contracts.dungeonDropsToken.address, abi: contracts.dungeonDropsToken.abi, functionName: 'balanceOf', args: [tba] }),
        publicClient.readContract({ address: contracts.dungeonDrops.address, abi: contracts.dungeonDrops.abi, functionName: 'totalRuns', args: [] }),
        publicClient.readContract({ address: contracts.dungeonDrops.address, abi: contracts.dungeonDrops.abi, functionName: 'playerNonce', args: [tba] }),
        publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }),
        publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }),
        publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }),
      ])
      setDngnBalance(newDngn as bigint)
      setTotalRuns(newRuns as bigint)
      setPlayerNonce(newNonce as bigint)
      setItemBalances({ 1: newItem1 as bigint, 2: newItem2 as bigint, 3: newItem3 as bigint })
    } catch (error) {
      console.error('Dungeon run failed:', error)
      toast.error('Dungeon run failed')
    }
  }

  const lootRarity = lootItemId ? ITEM_RARITY[lootItemId] : null
  const lootName = lootItemId ? DUNGEON_ITEM_NAMES[lootItemId] : null
  const heldItems = Object.entries(itemBalances).filter(([, bal]) => bal > 0n)
  const totalCost = usePaymaster ? DUNGEON_ENTRY_FEE + GAS_COST_DNGN : DUNGEON_ENTRY_FEE

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="page-title">Dungeon Drops</h1>
        <p className="text-surface-500 text-sm mt-1">Pay 10 DNGN to enter and roll for loot</p>
        <p className="text-xs text-surface-400 mt-1 italic">Demo game — in production, this logic runs inside a Unity/Unreal dungeon crawler. Same smart contract calls, visual gameplay on top.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <p className="stat-label">Balance</p>
          <p className="text-xl font-bold text-surface-900 mt-1">
            {isLoadingData ? '—' : parseFloat(formatEther(dngnBalance)).toFixed(1)}
          </p>
          <p className="text-xs text-surface-400">DNGN</p>
        </div>
        <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
          <p className="stat-label">Entry Fee</p>
          <p className="text-xl font-bold text-surface-900 mt-1">10</p>
          <p className="text-xs text-surface-400">DNGN{usePaymaster ? ' + 5 gas' : ''}</p>
        </div>
        <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <p className="stat-label">Your Runs</p>
          <p className="text-xl font-bold text-surface-900 mt-1">
            {isLoadingData ? '—' : playerNonce.toString()}
          </p>
          <p className="text-xs text-surface-400">of {totalRuns.toString()} total</p>
        </div>
      </div>

      {/* Gas Paymaster toggle */}
      <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-surface-700">Pay gas with DNGN</p>
            <p className="text-xs text-surface-400 mt-0.5">
              {usePaymaster
                ? 'GasPaymaster active — 5 DNGN covers gas via ERC-2771 meta-tx'
                : 'Using native GAS token for transaction fees'}
            </p>
          </div>
          <button
            onClick={togglePaymaster}
            className={`relative w-11 h-6 rounded-full transition-colors ${usePaymaster ? 'bg-brand-500' : 'bg-surface-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${usePaymaster ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Item Utility / Inventory */}
      {heldItems.length > 0 && (
        <div className="card p-5 space-y-3 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
          <h2 className="section-title">Your Equipment</h2>
          <p className="text-xs text-surface-400">Items in your inventory grant passive bonuses</p>
          <div className="space-y-2">
            {heldItems.map(([idStr, bal]) => {
              const id = Number(idStr)
              const info = ITEM_BONUSES[id]
              if (!info) return null
              return (
                <div key={id} className={`flex items-center justify-between rounded-xl p-3 border ${ITEM_RARITY[id]?.bg ?? 'bg-surface-50 border-surface-200'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{info.icon}</span>
                    <div>
                      <p className={`text-sm font-medium ${ITEM_RARITY[id]?.color ?? 'text-surface-700'}`}>{info.label}</p>
                      <p className="text-xs text-surface-500">{info.bonus}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-surface-400">×{bal.toString()}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-surface-300 italic">In production, bonuses are enforced on-chain via modifier checks.</p>
        </div>
      )}

      {/* Enter Dungeon */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Enter the Dungeon</h2>
            <p className="text-surface-500 text-sm mt-0.5">
              Drops one random item per run
              {usePaymaster && <span className="text-brand-500 ml-1">(via GasPaymaster)</span>}
            </p>
          </div>
          <button
            onClick={handleEnterDungeon}
            disabled={isPending || dngnBalance < totalCost}
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
