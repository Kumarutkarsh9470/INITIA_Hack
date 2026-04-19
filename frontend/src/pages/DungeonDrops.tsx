import { useState, useEffect, useCallback } from 'react'
import { formatEther, encodeFunctionData } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { ADDRESSES } from '../lib/addresses'
import { DUNGEON_ENTRY_FEE } from '../lib/constants'
import { DUNGEON_GAME_ID } from '../lib/constants'
import { resolveReward, type RewardTier } from '../lib/ScoreResolver'
import PuzzleGame from '../components/PuzzleGame'
import RewardConfirm from '../components/RewardConfirm'
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

const ITEM_BONUSES: Record<number, { icon: string; label: string; bonus: string }> = {
  1: { icon: '⚔️', label: 'Common Sword', bonus: '+5% crit chance' },
  2: { icon: '🛡️', label: 'Rare Shield', bonus: '+10% defense, -1 DNGN fee' },
  3: { icon: '👑', label: 'Legendary Crown', bonus: '+25% loot quality, -3 DNGN fee' },
}

export default function DungeonDrops() {
  const { tba, refetch } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, executeViaPaymaster, isPending } = useTBA()
  const { gasCostTokens: GAS_COST_DNGN, formatted: gasFeeDisplay } = useGasEstimate(DUNGEON_GAME_ID)

  const [dngnBalance, setDngnBalance] = useState(0n)
  const [totalRuns, setTotalRuns] = useState(0n)
  const [playerNonce, setPlayerNonce] = useState(0n)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [usePaymaster, setUsePaymaster] = useState(() => {
    try { return localStorage.getItem('pv-gas-dungeon') !== 'off' } catch { return true }
  })
  const [itemBalances, setItemBalances] = useState<Record<number, bigint>>({ 1: 0n, 2: 0n, 3: 0n })

  // Game phase state
  const [phase, setPhase] = useState<'idle' | 'playing' | 'results' | 'claiming' | 'loot'>('idle')
  const [gameScore, setGameScore] = useState(0)
  const [lootDrops, setLootDrops] = useState<number[]>([])
  const [showLoot, setShowLoot] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!tba) return
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
  }, [tba, contracts])

  useEffect(() => { fetchAll() }, [fetchAll])

  const togglePaymaster = () => {
    const next = !usePaymaster
    setUsePaymaster(next)
    try { localStorage.setItem('pv-gas-dungeon', next ? 'on' : 'off') } catch {}
  }

  const handlePuzzleComplete = useCallback((score: number) => {
    setGameScore(score)
    setPhase('results')
  }, [])

  const handlePuzzleCancel = useCallback(() => {
    setPhase('idle')
    setGameScore(0)
  }, [])

  // Single dungeon roll — returns item id or null
  const runSingleDungeon = async (): Promise<number | null> => {
    if (!tba) return null

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

    // Snapshot item balances before the roll
    const beforeBalances = await Promise.all([
      publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }),
      publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }),
      publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }),
    ]) as [bigint, bigint, bigint]

    if (usePaymaster && GAS_COST_DNGN > 0n) {
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

      await executeViaPaymaster(
        contracts.dungeonDropsToken.address,
        GAS_COST_DNGN,
        ADDRESSES.DungeonDrops as `0x${string}`,
        calldata,
      )
    } else {
      await execute(ADDRESSES.DungeonDrops, 0n, calldata)
    }

    // Compare balances after the roll to detect which item was minted
    const afterBalances = await Promise.all([
      publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }),
      publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }),
      publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }),
    ]) as [bigint, bigint, bigint]

    for (let i = 0; i < 3; i++) {
      if (afterBalances[i] > beforeBalances[i]) return i + 1
    }
    return null
  }

  // Claim: run N rolls sequentially
  const handleClaimReward = async (tier: RewardTier) => {
    setPhase('claiming')
    setLootDrops([])
    setShowLoot(false)

    const drops: number[] = []
    try {
      for (let i = 0; i < tier.rolls; i++) {
        toast.loading(`Rolling dungeon ${i + 1}/${tier.rolls}...`, { id: 'dungeon-roll' })
        const itemId = await runSingleDungeon()
        if (itemId !== null) drops.push(itemId)
      }
      toast.dismiss('dungeon-roll')
      setLootDrops(drops)
      setPhase('loot')
      requestAnimationFrame(() => { requestAnimationFrame(() => setShowLoot(true)) })

      if (drops.length > 0) {
        const names = drops.map(id => DUNGEON_ITEM_NAMES[id] ?? 'Unknown').join(', ')
        toast.success(`Loot earned: ${names}`)
      } else {
        toast.success('Dungeon runs complete!')
      }

      refetch()
      fetchAll()
    } catch (error) {
      toast.dismiss('dungeon-roll')
      console.error('Dungeon claim failed:', error)
      toast.error('Dungeon run failed — any completed rolls were saved')
      if (drops.length > 0) {
        setLootDrops(drops)
        setPhase('loot')
        requestAnimationFrame(() => { requestAnimationFrame(() => setShowLoot(true)) })
      } else {
        setPhase('idle')
      }
      fetchAll()
    }
  }

  const handleBackToIdle = () => {
    setPhase('idle')
    setGameScore(0)
    setLootDrops([])
    setShowLoot(false)
  }

  const heldItems = Object.entries(itemBalances).filter(([, bal]) => bal > 0n)
  const effectivePaymaster = usePaymaster && GAS_COST_DNGN > 0n
  const totalCost = effectivePaymaster ? DUNGEON_ENTRY_FEE + GAS_COST_DNGN : DUNGEON_ENTRY_FEE

  return (
    <div className="space-y-6 max-w-lg">
      {/* Dungeon-themed header */}
      <div className="dungeon-gradient rounded-2xl p-6 text-white animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">⚔️</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dungeon Drops</h1>
            <p className="text-white/60 text-sm">
              {phase === 'playing' ? 'Match gems to earn dungeon rolls!'
                : phase === 'results' ? 'Puzzle complete — claim your reward!'
                : phase === 'claiming' ? 'Entering the dungeon...'
                : phase === 'loot' ? 'Your loot awaits!'
                : 'Solve the puzzle, earn your loot'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats — always visible */}
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
          <p className="text-xs text-surface-400">DNGN{effectivePaymaster ? ` + ${gasFeeDisplay} gas` : ''} / roll</p>
        </div>
        <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <p className="stat-label">Your Runs</p>
          <p className="text-xl font-bold text-surface-900 mt-1">
            {isLoadingData ? '—' : playerNonce.toString()}
          </p>
          <p className="text-xs text-surface-400">of {totalRuns.toString()} total</p>
        </div>
      </div>

      {/* Gas Paymaster toggle — idle & results only */}
      {(phase === 'idle' || phase === 'results') && (
        <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-700">Pay gas with DNGN</p>
              <p className="text-xs text-surface-400 mt-0.5">
                {usePaymaster
                  ? `Gas fee: ~${gasFeeDisplay} DNGN`
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
      )}

      {/* PHASE: IDLE */}
      {phase === 'idle' && (
        <>
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
            </div>
          )}

          <div className="card p-6 space-y-4 animate-fade-in-up">
            <div>
              <h2 className="section-title">Enter the Dungeon</h2>
              <p className="text-surface-500 text-sm mt-1">
                Complete the gem puzzle to earn dungeon rolls. Higher scores = more rolls = more loot!
              </p>
            </div>
            <div className="bg-surface-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">Bronze (500+ pts)</span>
                <span className="font-medium text-orange-700">1 roll</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Silver (1500+ pts)</span>
                <span className="font-medium text-surface-500">2 rolls</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Gold (3000+ pts)</span>
                <span className="font-medium text-amber-500">3 rolls</span>
              </div>
            </div>
            <button
              onClick={() => setPhase('playing')}
              disabled={dngnBalance < totalCost}
              className="w-full btn-primary py-3.5 text-sm font-semibold disabled:opacity-50"
            >
              {dngnBalance < totalCost
                ? `Need at least ${parseFloat(formatEther(totalCost)).toFixed(0)} DNGN`
                : 'Start Puzzle'}
            </button>
          </div>
        </>
      )}

      {/* PHASE: PLAYING */}
      {phase === 'playing' && (
        <div className="card p-5 animate-fade-in-up">
          <PuzzleGame onComplete={handlePuzzleComplete} onCancel={handlePuzzleCancel} />
        </div>
      )}

      {/* PHASE: RESULTS */}
      {phase === 'results' && (
        <RewardConfirm
          score={gameScore}
          entryFee={DUNGEON_ENTRY_FEE}
          dngnBalance={dngnBalance}
          usePaymaster={usePaymaster}
          gasCost={GAS_COST_DNGN}
          onConfirm={handleClaimReward}
          onCancel={handleBackToIdle}
          isPending={false}
        />
      )}

      {/* PHASE: CLAIMING */}
      {phase === 'claiming' && (
        <div className="card p-8 text-center animate-fade-in-up">
          <svg className="animate-spin h-10 w-10 mx-auto text-surface-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-surface-700 font-medium">Entering the dungeon...</p>
          <p className="text-surface-400 text-sm mt-1">
            Processing {resolveReward(gameScore).rolls} dungeon roll{resolveReward(gameScore).rolls > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* PHASE: LOOT */}
      {phase === 'loot' && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="card p-6">
            <p className="text-surface-400 text-xs uppercase tracking-widest mb-3 text-center">⚡ Loot Drops</p>
            <div className="space-y-3">
              {lootDrops.map((itemId, i) => {
                const rarity = ITEM_RARITY[itemId]
                return (
                  <div
                    key={i}
                    style={{
                      transition: 'opacity 500ms ease, transform 500ms ease',
                      transitionDelay: `${i * 200}ms`,
                      opacity: showLoot ? 1 : 0,
                      transform: showLoot ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.95)',
                    }}
                    className={`rounded-xl border p-5 text-center ${rarity?.bg ?? 'bg-surface-50 border-surface-200'}`}
                  >
                    <p className="text-xs text-surface-400 mb-1">Roll {i + 1}</p>
                    <p className={`text-2xl font-bold ${rarity?.color ?? 'text-surface-900'}`}>
                      {DUNGEON_ITEM_NAMES[itemId] ?? 'Unknown'}
                    </p>
                    <p className={`text-sm mt-0.5 font-medium ${rarity?.color ?? 'text-surface-500'}`}>
                      {rarity?.label}
                    </p>
                  </div>
                )
              })}
            </div>
            {lootDrops.length === 0 && (
              <p className="text-surface-500 text-sm text-center">No items dropped this run.</p>
            )}
          </div>
          <button
            onClick={handleBackToIdle}
            className="w-full btn-primary py-3 text-sm font-semibold"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Drop rates — always visible */}
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
        <p className="text-xs text-surface-400 mt-3">
          Same drop rates for every roll — earn more rolls with higher puzzle scores!
        </p>
      </div>
    </div>
  )
}
