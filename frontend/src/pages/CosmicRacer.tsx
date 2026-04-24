import { useState, useEffect, useCallback } from 'react'
import { formatEther, encodeFunctionData } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { ADDRESSES } from '../lib/addresses'
import { COSMIC_ENTRY_FEE, COSMIC_GAME_ID } from '../lib/constants'
import { resolveReward, TIER_THRESHOLDS, type RewardTier } from '../lib/ScoreResolver'
import RacerGame from '../components/RacerGame'
import toast from 'react-hot-toast'

const COSMIC_ITEM_NAMES: Record<number, string> = {
  1: 'Speed Boost',
  2: 'Nitro Tank',
  3: 'Turbo Engine',
}

const ITEM_RARITY: Record<number, { color: string; bg: string; label: string }> = {
  1: { color: 'text-cyan-600',   bg: 'bg-cyan-50 border-cyan-200',     label: 'Common' },
  2: { color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', label: 'Rare' },
  3: { color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',   label: 'Legendary' },
}

const DROP_RATES = [
  { itemId: 1, name: 'Speed Boost',  pct: 60, color: 'bg-cyan-500' },
  { itemId: 2, name: 'Nitro Tank',   pct: 30, color: 'bg-purple-500' },
  { itemId: 3, name: 'Turbo Engine', pct: 10, color: 'bg-amber-500' },
]

const ITEM_BONUSES: Record<number, { icon: string; label: string; bonus: string }> = {
  1: { icon: '⚡', label: 'Speed Boost',  bonus: '+10% race speed' },
  2: { icon: '🛢️', label: 'Nitro Tank',   bonus: '+20% nitro duration' },
  3: { icon: '🔧', label: 'Turbo Engine', bonus: '+30% top speed, -2 RACE fee' },
}

const TIER_ICONS: Record<string, string> = {
  gold: '🏆', silver: '🥈', bronze: '🥉', none: '💀',
}
const TIER_BG: Record<string, string> = {
  gold: 'bg-amber-50 border-amber-200',
  silver: 'bg-surface-50 border-surface-200',
  bronze: 'bg-orange-50 border-orange-200',
  none: 'bg-red-50 border-red-200',
}

export default function CosmicRacer() {
  const { tba, refetch } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, executeViaPaymaster, isPending } = useTBA()
  const { gasCostTokens: GAS_COST_RACE, formatted: gasFeeDisplay } = useGasEstimate(COSMIC_GAME_ID)

  const [raceBalance, setRaceBalance] = useState(0n)
  const [totalRaces, setTotalRaces] = useState(0n)
  const [playerNonce, setPlayerNonce] = useState(0n)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [usePaymaster, setUsePaymaster] = useState(() => {
    try { return localStorage.getItem('pv-gas-cosmic') !== 'off' } catch { return true }
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
      const [race, races, nonce, item1, item2, item3] = await Promise.all([
        publicClient.readContract({ address: contracts.cosmicRacerToken.address, abi: contracts.cosmicRacerToken.abi, functionName: 'balanceOf', args: [tba] }),
        publicClient.readContract({ address: contracts.cosmicRacer.address, abi: contracts.cosmicRacer.abi, functionName: 'totalRaces', args: [] }),
        publicClient.readContract({ address: contracts.cosmicRacer.address, abi: contracts.cosmicRacer.abi, functionName: 'playerNonce', args: [tba] }),
        publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }),
        publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }),
        publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }),
      ])
      setRaceBalance(race as bigint)
      setTotalRaces(races as bigint)
      setPlayerNonce(nonce as bigint)
      setItemBalances({ 1: item1 as bigint, 2: item2 as bigint, 3: item3 as bigint })
    } catch (error) {
      console.error('Error fetching cosmic data:', error)
      toast.error('Failed to load race data')
    } finally {
      setIsLoadingData(false)
    }
  }, [tba, contracts])

  useEffect(() => { fetchAll() }, [fetchAll])

  const togglePaymaster = () => {
    const next = !usePaymaster
    setUsePaymaster(next)
    try { localStorage.setItem('pv-gas-cosmic', next ? 'on' : 'off') } catch {}
  }

  const handleRaceComplete = useCallback((score: number) => {
    setGameScore(score)
    setPhase('results')
  }, [])

  const handleRaceCancel = useCallback(() => {
    setPhase('idle')
    setGameScore(0)
  }, [])

  // Single race roll
  const runSingleRace = async (): Promise<number | null> => {
    if (!tba) return null

    const allowance = await publicClient.readContract({
      address: contracts.cosmicRacerToken.address,
      abi: contracts.cosmicRacerToken.abi,
      functionName: 'allowance',
      args: [tba, ADDRESSES.CosmicRacer],
    }) as bigint

    if (allowance < COSMIC_ENTRY_FEE) {
      const approveData = encodeFunctionData({
        abi: contracts.cosmicRacerToken.abi,
        functionName: 'approve',
        args: [ADDRESSES.CosmicRacer, COSMIC_ENTRY_FEE * 100n],
      })
      await execute(contracts.cosmicRacerToken.address, 0n, approveData)
    }

    const calldata = encodeFunctionData({ abi: contracts.cosmicRacer.abi, functionName: 'race', args: [] })

    // Snapshot item balances before the race
    const [pre1, pre2, pre3] = await Promise.all([
      publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }) as Promise<bigint>,
      publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }) as Promise<bigint>,
      publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }) as Promise<bigint>,
    ])

    let receipt: any
    if (usePaymaster && GAS_COST_RACE > 0n) {
      const paymasterAllowance = await publicClient.readContract({
        address: contracts.cosmicRacerToken.address,
        abi: contracts.cosmicRacerToken.abi,
        functionName: 'allowance',
        args: [tba, ADDRESSES.GasPaymaster],
      }) as bigint

      if (paymasterAllowance < GAS_COST_RACE) {
        const approvePaymaster = encodeFunctionData({
          abi: contracts.cosmicRacerToken.abi,
          functionName: 'approve',
          args: [ADDRESSES.GasPaymaster, GAS_COST_RACE * 100n],
        })
        await execute(contracts.cosmicRacerToken.address, 0n, approvePaymaster)
      }

      receipt = await executeViaPaymaster(
        contracts.cosmicRacerToken.address,
        GAS_COST_RACE,
        ADDRESSES.CosmicRacer as `0x${string}`,
        calldata,
      )
    } else {
      receipt = await execute(ADDRESSES.CosmicRacer, 0n, calldata)
    }

    // Detect which item was minted via balance diff
    const [post1, post2, post3] = await Promise.all([
      publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }) as Promise<bigint>,
      publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }) as Promise<bigint>,
      publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }) as Promise<bigint>,
    ])
    if (post1 > pre1) return 1
    if (post2 > pre2) return 2
    if (post3 > pre3) return 3
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
        toast.loading(`Race attempt ${i + 1}/${tier.rolls}...`, { id: 'race-roll' })
        const itemId = await runSingleRace()
        if (itemId !== null) drops.push(itemId)
      }
      toast.dismiss('race-roll')
      setLootDrops(drops)
      setPhase('loot')
      requestAnimationFrame(() => { requestAnimationFrame(() => setShowLoot(true)) })

      if (drops.length > 0) {
        const names = drops.map(id => COSMIC_ITEM_NAMES[id] ?? 'Unknown').join(', ')
        toast.success(`Loot earned: ${names}`)
      } else {
        toast.success('Race complete!')
      }

      refetch()
      fetchAll()
    } catch (error) {
      toast.dismiss('race-roll')
      console.error('Race claim failed:', error)
      toast.error('Race failed — any completed runs were saved')
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
  const effectivePaymaster = usePaymaster && GAS_COST_RACE > 0n
  const totalCost = effectivePaymaster ? COSMIC_ENTRY_FEE + GAS_COST_RACE : COSMIC_ENTRY_FEE

  return (
    <div className="space-y-6 max-w-lg">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white animate-fade-in-up" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)' }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🚀</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cosmic Racer</h1>
            <p className="text-white/60 text-sm">
              {phase === 'playing' ? 'Dodge obstacles to earn race rewards!'
                : phase === 'results' ? 'Race finished — claim your prize!'
                : phase === 'claiming' ? 'Processing your race...'
                : phase === 'loot' ? 'Your loot awaits!'
                : 'Dodge, race, earn upgrades'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <p className="stat-label">Balance</p>
          <p className="text-xl font-bold text-surface-900 mt-1">
            {isLoadingData ? '—' : parseFloat(formatEther(raceBalance)).toFixed(1)}
          </p>
          <p className="text-xs text-surface-400">RACE</p>
        </div>
        <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
          <p className="stat-label">Entry Fee</p>
          <p className="text-xl font-bold text-surface-900 mt-1">10</p>
          <p className="text-xs text-surface-400">RACE{effectivePaymaster ? ` + ${gasFeeDisplay} gas` : ''} / roll</p>
        </div>
        <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <p className="stat-label">Your Races</p>
          <p className="text-xl font-bold text-surface-900 mt-1">
            {isLoadingData ? '—' : playerNonce.toString()}
          </p>
          <p className="text-xs text-surface-400">of {totalRaces.toString()} total</p>
        </div>
      </div>

      {/* Gas Paymaster toggle */}
      {(phase === 'idle' || phase === 'results') && (
        <div className="card p-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-700">Pay gas with RACE</p>
              <p className="text-xs text-surface-400 mt-0.5">
                {usePaymaster
                  ? `Gas fee: ~${gasFeeDisplay} RACE`
                  : 'Using native GAS token for transaction fees'}
              </p>
            </div>
            <button
              onClick={togglePaymaster}
              className={`relative w-11 h-6 rounded-full transition-colors ${usePaymaster ? 'bg-indigo-500' : 'bg-surface-300'}`}
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
              <h2 className="section-title">Your Upgrades</h2>
              <p className="text-xs text-surface-400">Earned items grant passive racing bonuses</p>
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
                      <span className="text-xs font-mono text-surface-400">x{bal.toString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card p-6 space-y-4 animate-fade-in-up">
            <div>
              <h2 className="section-title">Enter the Race</h2>
              <p className="text-surface-500 text-sm mt-1">
                Dodge obstacles in the cosmic lane — higher scores earn more race rolls and better loot!
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
              disabled={raceBalance < totalCost}
              className="w-full btn-primary py-3.5 text-sm font-semibold disabled:opacity-50"
            >
              {raceBalance < totalCost
                ? `Need at least ${parseFloat(formatEther(totalCost)).toFixed(0)} RACE`
                : 'Start Race'}
            </button>
          </div>
        </>
      )}

      {/* PHASE: PLAYING */}
      {phase === 'playing' && (
        <div className="card p-5 animate-fade-in-up">
          <RacerGame onComplete={handleRaceComplete} onCancel={handleRaceCancel} />
        </div>
      )}

      {/* PHASE: RESULTS — inline reward confirm (no DNGN references) */}
      {phase === 'results' && (() => {
        const tier = resolveReward(gameScore)
        const totalCostPerRoll = effectivePaymaster ? COSMIC_ENTRY_FEE + GAS_COST_RACE : COSMIC_ENTRY_FEE
        const totalCostAll = totalCostPerRoll * BigInt(tier.rolls)
        const canAfford = raceBalance >= totalCostAll
        const icon = TIER_ICONS[tier.tier]
        const bg = TIER_BG[tier.tier]

        return (
          <div className="space-y-4 animate-fade-in-up">
            <div className={`rounded-xl border p-6 text-center ${bg}`}>
              <p className="text-4xl mb-2">{icon}</p>
              <p className={`text-3xl font-bold ${tier.color}`}>{tier.label}</p>
              <p className="text-surface-500 text-sm mt-1">Distance: {gameScore.toLocaleString()}</p>
            </div>

            {tier.rolls > 0 ? (
              <div className="card p-5 space-y-3">
                <h3 className="section-title">Race Reward</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-500">Race rolls earned</span>
                    <span className="font-bold text-surface-900">{tier.rolls}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Cost per roll</span>
                    <span className="font-medium text-surface-700">
                      {parseFloat(formatEther(COSMIC_ENTRY_FEE)).toFixed(0)} RACE
                      {effectivePaymaster && <span className="text-indigo-500"> + {gasFeeDisplay} gas</span>}
                    </span>
                  </div>
                  <div className="border-t border-surface-100 pt-2 flex justify-between">
                    <span className="text-surface-500 font-medium">Total cost</span>
                    <span className="font-bold text-surface-900">
                      {parseFloat(formatEther(totalCostAll)).toFixed(0)} RACE
                    </span>
                  </div>
                  {!canAfford && (
                    <p className="text-xs text-red-500 mt-1">
                      Insufficient RACE (you have {parseFloat(formatEther(raceBalance)).toFixed(1)})
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-surface-100">
                  <p className="text-xs text-surface-400 mb-2">Tier thresholds</p>
                  <div className="space-y-1">
                    {TIER_THRESHOLDS.map(t => (
                      <div key={t.tier} className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${gameScore >= t.minScore ? 'bg-green-500' : 'bg-surface-200'}`} />
                        <span className={gameScore >= t.minScore ? 'text-surface-700 font-medium' : 'text-surface-400'}>
                          {t.label} — {t.minScore}+ pts — {t.rolls} roll{t.rolls > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-5 text-center">
                <p className="text-surface-500 text-sm">
                  Score at least <span className="font-bold">500</span> distance to earn race rolls.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleBackToIdle} className="flex-1 btn-secondary py-3 text-sm font-semibold">
                {tier.rolls > 0 ? 'Skip Reward' : 'Back'}
              </button>
              {tier.rolls > 0 && (
                <button
                  onClick={() => handleClaimReward(tier)}
                  disabled={!canAfford}
                  className="flex-1 btn-primary py-3 text-sm font-semibold disabled:opacity-50"
                >
                  Claim {tier.rolls} Roll{tier.rolls > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* PHASE: CLAIMING */}
      {phase === 'claiming' && (
        <div className="card p-8 text-center animate-fade-in-up">
          <svg className="animate-spin h-10 w-10 mx-auto text-surface-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-surface-700 font-medium">Racing...</p>
          <p className="text-surface-400 text-sm mt-1">
            Processing {resolveReward(gameScore).rolls} race roll{resolveReward(gameScore).rolls > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* PHASE: LOOT */}
      {phase === 'loot' && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="card p-6">
            <p className="text-surface-400 text-xs uppercase tracking-widest mb-3 text-center">🚀 Race Loot</p>
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
                      {COSMIC_ITEM_NAMES[itemId] ?? 'Unknown'}
                    </p>
                    <p className={`text-sm mt-0.5 font-medium ${rarity?.color ?? 'text-surface-500'}`}>
                      {rarity?.label}
                    </p>
                  </div>
                )
              })}
            </div>
            {lootDrops.length === 0 && (
              <p className="text-surface-500 text-sm text-center">No items dropped this race.</p>
            )}
          </div>
          <button onClick={handleBackToIdle} className="w-full btn-primary py-3 text-sm font-semibold">
            Race Again
          </button>
        </div>
      )}

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
        <p className="text-xs text-surface-400 mt-3">
          Same drop rates for every roll — earn more rolls with higher distance scores!
        </p>
      </div>
    </div>
  )
}
