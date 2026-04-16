import { useState, useEffect, useCallback } from 'react'
import { formatEther, parseEther, encodeFunctionData } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import { GAME_IDS, DUNGEON_ITEMS, DUNGEON_EXPECTED_COST, DUNGEON_DROP_RATES } from '../lib/constants'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

type GameToken = 'DNGN' | 'HRV'
type SwapDirection = 'pxlToGame' | 'gameToPxl'
type Tab = 'swap' | 'liquidity' | 'economics'

interface PoolInfo { reservePXL: bigint; reserveGame: bigint; price: bigint }

function fmt(val: bigint, decimals = 4): string {
  return parseFloat(formatEther(val)).toFixed(decimals)
}
function safeParse(s: string): bigint {
  try { if (!s || parseFloat(s) <= 0) return 0n; return parseEther(s) } catch { return 0n }
}
function ammEstimate(amtIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amtIn === 0n) return 0n
  const amtInWithFee = amtIn * 997n
  return (amtInWithFee * reserveOut) / (reserveIn * 1000n + amtInWithFee)
}

const TOKEN_COLORS: Record<string, string> = { PXL: 'text-brand-600', DNGN: 'text-violet-600', HRV: 'text-emerald-600' }
const SLIPPAGE_BPS = 50n

export default function DEX() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, isPending } = useTBA()

  const [pxlBalance, setPxlBalance] = useState(0n)
  const [dngnBalance, setDngnBalance] = useState(0n)
  const [hrvBalance, setHrvBalance] = useState(0n)
  const [pools, setPools] = useState<Record<GameToken, PoolInfo>>({
    DNGN: { reservePXL: 0n, reserveGame: 0n, price: 0n },
    HRV: { reservePXL: 0n, reserveGame: 0n, price: 0n },
  })
  const [lpBalances, setLpBalances] = useState<Record<GameToken, bigint>>({ DNGN: 0n, HRV: 0n })
  const [ratings, setRatings] = useState<Record<GameToken, bigint>>({ DNGN: 100n, HRV: 100n })
  const [selectedGame, setSelectedGame] = useState<GameToken>('DNGN')
  const [direction, setDirection] = useState<SwapDirection>('pxlToGame')
  const [inputAmount, setInputAmount] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('swap')
  const [lpPxlAmount, setLpPxlAmount] = useState('')
  const [lpGameAmount, setLpGameAmount] = useState('')
  const [lpShareAmount, setLpShareAmount] = useState('')

  const pool = pools[selectedGame]
  const parsedIn = safeParse(inputAmount)
  const estimatedOut = direction === 'pxlToGame'
    ? ammEstimate(parsedIn, pool.reservePXL, pool.reserveGame)
    : ammEstimate(parsedIn, pool.reserveGame, pool.reservePXL)
  const minOut = estimatedOut === 0n ? 0n : estimatedOut - (estimatedOut * SLIPPAGE_BPS / 10000n)
  const inToken = direction === 'pxlToGame' ? 'PXL' : selectedGame
  const outToken = direction === 'pxlToGame' ? selectedGame : 'PXL'
  const inBalance = direction === 'pxlToGame' ? pxlBalance : selectedGame === 'DNGN' ? dngnBalance : hrvBalance

  const fetchAll = useCallback(async () => {
    if (!tba) return
    setIsLoading(true)
    try {
      const [pxl, dngn, hrv] = await Promise.all([
        publicClient.readContract({ address: contracts.pxlToken.address, abi: contracts.pxlToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.dungeonDropsToken.address, abi: contracts.dungeonDropsToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.harvestFieldToken.address, abi: contracts.harvestFieldToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
      ])
      setPxlBalance(pxl); setDngnBalance(dngn); setHrvBalance(hrv)
      const fetchPool = async (game: GameToken): Promise<PoolInfo> => {
        const gameId = GAME_IDS[game]
        const [poolData, price] = await Promise.all([
          publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'pools', args: [gameId] }),
          publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'getPrice', args: [gameId] }) as Promise<bigint>,
        ])
        const arr = poolData as unknown as [string, bigint, bigint, string, boolean, bigint]
        return { reservePXL: arr[1], reserveGame: arr[2], price }
      }
      const [dngnPool, hrvPool] = await Promise.all([fetchPool('DNGN'), fetchPool('HRV')])
      setPools({ DNGN: dngnPool, HRV: hrvPool })
      const [dngnLp, hrvLp] = await Promise.all([
        publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'lpShares', args: [GAME_IDS.DNGN, tba] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'lpShares', args: [GAME_IDS.HRV, tba] }) as Promise<bigint>,
      ])
      setLpBalances({ DNGN: dngnLp, HRV: hrvLp })
      // Fetch game ratings
      const [dngnRating, hrvRating] = await Promise.all([
        publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameRating', args: [GAME_IDS.DUNGEON] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameRating', args: [GAME_IDS.HARVEST] }) as Promise<bigint>,
      ])
      setRatings({ DNGN: dngnRating, HRV: hrvRating })
    } catch (err) {
      console.error('DEX fetch error:', err)
      toast.error('Failed to load DEX data')
    } finally { setIsLoading(false) }
  }, [tba, contracts])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleSwap() {
    if (!tba || parsedIn === 0n) return
    if (parsedIn > inBalance) return toast.error(`Insufficient ${inToken} balance`)
    const gameId = GAME_IDS[selectedGame]
    const inTokenContract = direction === 'pxlToGame' ? contracts.pxlToken : selectedGame === 'DNGN' ? contracts.dungeonDropsToken : contracts.harvestFieldToken
    try {
      await execute(inTokenContract.address, 0n,
        encodeFunctionData({ abi: inTokenContract.abi, functionName: 'approve', args: [contracts.pixelVaultDEX.address, parsedIn] }))
      const swapFn = direction === 'pxlToGame' ? 'swapPXLForGame' : 'swapGameForPXL'
      await execute(contracts.pixelVaultDEX.address, 0n,
        encodeFunctionData({ abi: contracts.pixelVaultDEX.abi, functionName: swapFn, args: [gameId, parsedIn, minOut] }))
      toast.success(`Swapped ${inputAmount} ${inToken} → ${fmt(estimatedOut)} ${outToken}`)
      setInputAmount(''); await fetchAll()
    } catch (err: any) { toast.error(err?.message ?? 'Swap failed') }
  }

  async function handleAddLiquidity() {
    if (!tba) return
    const pxlAmt = safeParse(lpPxlAmount)
    if (pxlAmt === 0n) return toast.error('Enter PXL amount')
    const { reservePXL, reserveGame } = pools[selectedGame]
    if (reservePXL === 0n) return toast.error('Pool not initialized')
    // Contract calculates: gameAmount = (pxlAmount * reserveGame) / reservePXL
    const gameAmtNeeded = (pxlAmt * reserveGame) / reservePXL
    // Add 0.5% slippage buffer for maxGameAmount
    const maxGameAmt = gameAmtNeeded + (gameAmtNeeded * SLIPPAGE_BPS / 10000n)
    const gameId = GAME_IDS[selectedGame]
    const gameTokenContract = selectedGame === 'DNGN' ? contracts.dungeonDropsToken : contracts.harvestFieldToken
    try {
      await execute(contracts.pxlToken.address, 0n,
        encodeFunctionData({ abi: contracts.pxlToken.abi, functionName: 'approve', args: [contracts.pixelVaultDEX.address, pxlAmt] }))
      await execute(gameTokenContract.address, 0n,
        encodeFunctionData({ abi: gameTokenContract.abi, functionName: 'approve', args: [contracts.pixelVaultDEX.address, maxGameAmt] }))
      await execute(contracts.pixelVaultDEX.address, 0n,
        encodeFunctionData({ abi: contracts.pixelVaultDEX.abi, functionName: 'addLiquidity', args: [gameId, pxlAmt, maxGameAmt] }))
      toast.success('Liquidity added!'); setLpPxlAmount(''); await fetchAll()
    } catch (err: any) { toast.error(err?.message ?? 'Add liquidity failed') }
  }

  async function handleRemoveLiquidity() {
    if (!tba) return
    const shareAmt = safeParse(lpShareAmount)
    if (shareAmt === 0n) return toast.error('Enter share amount')
    const gameId = GAME_IDS[selectedGame]
    try {
      await execute(contracts.pixelVaultDEX.address, 0n,
        encodeFunctionData({ abi: contracts.pixelVaultDEX.abi, functionName: 'removeLiquidity', args: [gameId, shareAmt] }))
      toast.success('Liquidity removed!'); setLpShareAmount(''); await fetchAll()
    } catch (err: any) { toast.error(err?.message ?? 'Remove liquidity failed') }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-lg animate-pulse">
        <div className="h-8 bg-surface-200 rounded w-1/3" />
        <div className="h-64 bg-surface-100 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">PixelVault DEX</h1>
          <p className="text-surface-500 text-sm mt-0.5">Swap tokens · Add liquidity · Bridge</p>
        </div>
        <Link to="/bridge"
          className="btn-secondary text-sm px-3 py-1.5 inline-block">
          IBC Bridge
        </Link>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'PXL', val: pxlBalance, color: 'text-brand-600' },
          { label: 'DNGN', val: dngnBalance, color: 'text-violet-600' },
          { label: 'HRV', val: hrvBalance, color: 'text-emerald-600' },
        ].map(({ label, val, color }) => (
          <div key={label} className="card px-3 py-2 text-center">
            <p className="stat-label">{label}</p>
            <p className={`text-sm font-semibold mt-0.5 ${color}`}>{fmt(val)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-100 rounded-xl p-1 gap-1">
        {(['swap', 'liquidity', 'economics'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors
              ${tab === t ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
            {t === 'swap' ? 'Swap' : t === 'liquidity' ? 'Liquidity' : 'Economics'}
          </button>
        ))}
      </div>

      {/* SWAP TAB */}
      {tab === 'swap' && (
        <div className="card p-5 space-y-4">
          {/* Token pair selector */}
          <div className="flex gap-2">
            {(['DNGN', 'HRV'] as GameToken[]).map(g => (
              <button key={g} onClick={() => { setSelectedGame(g); setInputAmount('') }}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${selectedGame === g
                    ? 'bg-brand-50 border-brand-200 text-brand-700'
                    : 'bg-surface-50 border-surface-200 text-surface-500 hover:text-surface-700'}`}>
                {g}
              </button>
            ))}
          </div>

          {/* Direction */}
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <span className={`text-sm font-semibold ${TOKEN_COLORS[inToken]}`}>{inToken}</span>
            </div>
            <button onClick={() => { setDirection(d => d === 'pxlToGame' ? 'gameToPxl' : 'pxlToGame'); setInputAmount('') }}
              className="bg-surface-100 hover:bg-surface-200 border border-surface-200 rounded-full w-9 h-9 flex items-center justify-center text-surface-500 transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 5h14m-3-3 3 3-3 3M15 11H1m3-3-3 3 3 3"/>
              </svg>
            </button>
            <div className="flex-1 text-center">
              <span className={`text-sm font-semibold ${TOKEN_COLORS[outToken]}`}>{outToken}</span>
            </div>
          </div>

          {/* Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-surface-500 uppercase tracking-wider">You pay</label>
              <span className="text-xs text-surface-400">Balance: {fmt(inBalance)} {inToken}</span>
            </div>
            <div className="relative">
              <input type="number" min="0" step="any" placeholder="0.00" value={inputAmount}
                onChange={e => setInputAmount(e.target.value)} className="input-field pr-24" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button onClick={() => setInputAmount(formatEther(inBalance))}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium">MAX</button>
                <span className="text-surface-400 text-sm">{inToken}</span>
              </div>
            </div>
          </div>

          {/* Output */}
          <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-surface-500 text-sm">You receive (est.)</span>
              <span className={`text-lg font-bold ${TOKEN_COLORS[outToken]}`}>
                {parsedIn > 0n ? fmt(estimatedOut) : '—'} {outToken}
              </span>
            </div>
            {parsedIn > 0n && estimatedOut > 0n && (
              <>
                <div className="flex justify-between text-xs text-surface-400">
                  <span>Min. received (0.5% slippage)</span>
                  <span>{fmt(minOut)} {outToken}</span>
                </div>
                <div className="flex justify-between text-xs text-surface-400">
                  <span>Spot price</span>
                  <span>1 {selectedGame} = {fmt(pool.price)} PXL</span>
                </div>
              </>
            )}
          </div>

          <button onClick={handleSwap}
            disabled={isPending || parsedIn === 0n || parsedIn > inBalance}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
            {isPending ? 'Processing…' : parsedIn > inBalance ? `Insufficient ${inToken}` : `Swap ${inToken} → ${outToken}`}
          </button>
        </div>
      )}

      {/* LIQUIDITY TAB */}
      {tab === 'liquidity' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['DNGN', 'HRV'] as GameToken[]).map(g => (
              <button key={g} onClick={() => setSelectedGame(g)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${selectedGame === g
                    ? 'bg-brand-50 border-brand-200 text-brand-700'
                    : 'bg-surface-50 border-surface-200 text-surface-500 hover:text-surface-700'}`}>
                {g}
              </button>
            ))}
          </div>

          {/* Add */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title text-sm">Add Liquidity</h3>
            <LpInput label="PXL Amount" value={lpPxlAmount} onChange={setLpPxlAmount} balance={pxlBalance} token="PXL" />
            {(() => {
              const pxlAmt = safeParse(lpPxlAmount)
              const { reservePXL, reserveGame } = pools[selectedGame]
              const gameNeeded = reservePXL > 0n ? (pxlAmt * reserveGame) / reservePXL : 0n
              return pxlAmt > 0n && gameNeeded > 0n ? (
                <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm">
                  <span className="text-surface-500">{selectedGame} needed: </span>
                  <span className="font-semibold">{fmt(gameNeeded)}</span>
                  <span className="text-surface-400 text-xs ml-1">(auto-calculated from pool ratio)</span>
                </div>
              ) : null
            })()}
            <button onClick={handleAddLiquidity} disabled={isPending}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
              {isPending ? 'Processing…' : 'Add Liquidity'}
            </button>
          </div>

          {/* Remove */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-sm">Remove Liquidity</h3>
              <span className="text-xs text-surface-400">
                LP shares: <span className="text-surface-700 font-mono">{fmt(lpBalances[selectedGame])}</span>
              </span>
            </div>
            <LpInput label="LP Share Amount" value={lpShareAmount} onChange={setLpShareAmount}
              balance={lpBalances[selectedGame]} token="shares" />
            <button onClick={handleRemoveLiquidity} disabled={isPending}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
              {isPending ? 'Processing…' : 'Remove Liquidity'}
            </button>
          </div>
        </div>
      )}

      {/* ECONOMICS TAB */}
      {tab === 'economics' && (
        <div className="space-y-4">
          {/* Item price table */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-sm">Item Floor Prices</h3>
              <span className="text-xs text-surface-400">Rating: {(Number(ratings.DNGN) / 100).toFixed(1)}★</span>
            </div>
            <div className="space-y-2">
              {([1, 2, 3] as const).map(itemId => {
                const costDNGN = DUNGEON_EXPECTED_COST[itemId]
                const dropRate = DUNGEON_DROP_RATES[itemId]
                const { reservePXL, reserveGame } = pools.DNGN
                const basePXL = (reservePXL > 0n && reserveGame > 0n)
                  ? ammEstimate(costDNGN, reserveGame, reservePXL) : 0n
                const floorPXL = basePXL * ratings.DNGN / 100n
                return (
                  <div key={itemId} className="flex items-center justify-between bg-surface-50 rounded-xl px-4 py-3 border border-surface-100">
                    <div>
                      <p className="text-sm font-semibold text-surface-800">{DUNGEON_ITEMS[itemId]}</p>
                      <p className="text-xs text-surface-400">{dropRate}% drop · {parseFloat(formatEther(costDNGN)).toFixed(1)} DNGN cost</p>
                    </div>
                    <p className="text-sm font-bold font-mono text-surface-900">
                      {floorPXL > 0n ? parseFloat(formatEther(floorPXL)).toFixed(2) : '—'} <span className="text-surface-400 font-normal">PXL</span>
                    </p>
                  </div>
                )
              })}
              {/* Harvest item */}
              <div className="flex items-center justify-between bg-surface-50 rounded-xl px-4 py-3 border border-surface-100">
                <div>
                  <p className="text-sm font-semibold text-surface-800">Seasonal Harvest Item</p>
                  <p className="text-xs text-surface-400">Guaranteed · Staking byproduct</p>
                </div>
                <p className="text-sm font-bold font-mono text-surface-900">
                  {(() => {
                    const { reservePXL, reserveGame } = pools.HRV
                    if (reservePXL === 0n || reserveGame === 0n) return '—'
                    const basePXL = ammEstimate(1000000000000000000n, reserveGame, reservePXL)
                    return parseFloat(formatEther(basePXL * ratings.HRV / 100n)).toFixed(2)
                  })()} <span className="text-surface-400 font-normal">PXL</span>
                </p>
              </div>
            </div>
          </div>

          {/* Cross-game flow — visual only */}
          <div className="card p-4">
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="px-3 py-1.5 rounded-lg border border-surface-200 font-medium text-surface-700">DNGN Items</span>
              <span className="text-surface-300">→</span>
              <span className="px-3 py-1.5 rounded-lg border border-surface-200 font-bold text-surface-900">PXL</span>
              <span className="text-surface-300">→</span>
              <span className="px-3 py-1.5 rounded-lg border border-surface-200 font-medium text-surface-700">HRV Items</span>
            </div>
          </div>
        </div>
      )}

      {/* Pool Reserves */}
      <div className="card p-5 space-y-4">
        <h2 className="section-title text-sm">Pool Reserves</h2>
        <div className="space-y-3">
          {(['DNGN', 'HRV'] as GameToken[]).map(g => {
            const p = pools[g]
            return (
              <div key={g} className="bg-surface-50 rounded-xl p-4 border border-surface-100 space-y-2">
                <p className="text-sm font-semibold text-surface-700">PXL / {g}</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="stat-label">PXL Reserve</p>
                    <p className="font-mono font-medium text-brand-600">{fmt(p.reservePXL)}</p>
                  </div>
                  <div>
                    <p className="stat-label">{g} Reserve</p>
                    <p className={`font-mono font-medium ${TOKEN_COLORS[g]}`}>{fmt(p.reserveGame)}</p>
                  </div>
                  <div>
                    <p className="stat-label">Spot Price</p>
                    <p className="font-mono font-medium text-surface-700">{fmt(p.price, 6)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function LpInput({ label, value, onChange, balance, token }: {
  label: string; value: string; onChange: (v: string) => void; balance?: bigint; token: string
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs font-medium text-surface-500 uppercase tracking-wider">{label}</label>
        {balance !== undefined && (
          <span className="text-xs text-surface-400">Balance: {fmt(balance)} {token}</span>
        )}
      </div>
      <div className="relative">
        <input type="number" min="0" step="any" placeholder="0.00" value={value}
          onChange={e => onChange(e.target.value)} className="input-field pr-20 text-sm" />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {balance !== undefined && (
            <button onClick={() => onChange(formatEther(balance))}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium">MAX</button>
          )}
          <span className="text-sm font-medium text-surface-500">{token}</span>
        </div>
      </div>
    </div>
  )
}
