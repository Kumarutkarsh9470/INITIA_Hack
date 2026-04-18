import { useState, useEffect, useCallback } from 'react'
import { formatEther, parseEther, encodeFunctionData } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

type SwapDirection = 'pxlToGame' | 'gameToPxl'
type Tab = 'swap' | 'liquidity' | 'economics'
interface PoolInfo { reservePXL: bigint; reserveGame: bigint; price: bigint }
interface RegisteredGame { gameId: `0x${string}`; name: string; symbol: string; tokenAddress: `0x${string}`; assetCollection: `0x${string}` }

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

const TOKEN_COLORS: Record<string, string> = { PXL: 'text-brand-600', DNGN: 'text-violet-600', HRV: 'text-emerald-600', RACE: 'text-orange-600' }
const SLIPPAGE_BPS = 50n

export default function DEX() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, isPending } = useTBA()

  const [games, setGames] = useState<RegisteredGame[]>([])
  const [pxlBalance, setPxlBalance] = useState(0n)
  const [balances, setBalances] = useState<Record<string, bigint>>({})
  const [pools, setPools] = useState<Record<string, PoolInfo>>({})
  const [lpBalances, setLpBalances] = useState<Record<string, bigint>>({})
  const [ratings, setRatings] = useState<Record<string, bigint>>({})
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [direction, setDirection] = useState<SwapDirection>('pxlToGame')
  const [inputAmount, setInputAmount] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('swap')
  const [lpPxlAmount, setLpPxlAmount] = useState('')
  const [lpShareAmount, setLpShareAmount] = useState('')

  const selectedGame = games.find(g => g.symbol === selectedSymbol)
  const pool = selectedSymbol ? pools[selectedSymbol] ?? { reservePXL: 0n, reserveGame: 0n, price: 0n } : { reservePXL: 0n, reserveGame: 0n, price: 0n }
  const parsedIn = safeParse(inputAmount)
  const estimatedOut = direction === 'pxlToGame'
    ? ammEstimate(parsedIn, pool.reservePXL, pool.reserveGame)
    : ammEstimate(parsedIn, pool.reserveGame, pool.reservePXL)
  const minOut = estimatedOut === 0n ? 0n : estimatedOut - (estimatedOut * SLIPPAGE_BPS / 10000n)
  const inToken = direction === 'pxlToGame' ? 'PXL' : selectedSymbol
  const outToken = direction === 'pxlToGame' ? selectedSymbol : 'PXL'
  const inBalance = direction === 'pxlToGame' ? pxlBalance : (balances[selectedSymbol] ?? 0n)

  const fetchAll = useCallback(async () => {
    if (!tba) return
    setIsLoading(true)
    try {
      const countRaw = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameCount' })
      const count = Number(countRaw)
      const fetchedGames: RegisteredGame[] = []
      for (let i = 0; i < count; i++) {
        const gameId = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'gameIds', args: [BigInt(i)] }) as `0x${string}`
        const data = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'games', args: [gameId] }) as any
        if (data[8] === true) {
          fetchedGames.push({ gameId, name: data[3], symbol: data[4], tokenAddress: data[0], assetCollection: data[1] })
        }
      }
      setGames(fetchedGames)
      if (fetchedGames.length > 0 && !selectedSymbol) setSelectedSymbol(fetchedGames[0].symbol)

      const pxl = await publicClient.readContract({ address: contracts.pxlToken.address, abi: contracts.pxlToken.abi, functionName: 'balanceOf', args: [tba] }) as bigint
      setPxlBalance(pxl)

      const newBalances: Record<string, bigint> = {}
      const newPools: Record<string, PoolInfo> = {}
      const newLp: Record<string, bigint> = {}
      const newRatings: Record<string, bigint> = {}

      for (const game of fetchedGames) {
        const [bal, poolData, price, lp, rating] = await Promise.all([
          publicClient.readContract({ address: game.tokenAddress, abi: contracts.pxlToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
          publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'pools', args: [game.gameId] }),
          publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'getPrice', args: [game.gameId] }).catch(() => 0n) as Promise<bigint>,
          publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'lpShares', args: [game.gameId, tba] }).catch(() => 0n) as Promise<bigint>,
          publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameRating', args: [game.gameId] }).catch(() => 100n) as Promise<bigint>,
        ])
        const arr = poolData as unknown as [string, bigint, bigint, string, boolean, bigint]
        newBalances[game.symbol] = bal
        newPools[game.symbol] = { reservePXL: arr[1], reserveGame: arr[2], price }
        newLp[game.symbol] = lp
        newRatings[game.symbol] = rating
      }
      setBalances(newBalances); setPools(newPools); setLpBalances(newLp); setRatings(newRatings)
    } catch (err) {
      console.error('DEX fetch error:', err)
      toast.error('Failed to load DEX data')
    } finally { setIsLoading(false) }
  }, [tba, contracts, selectedSymbol])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleSwap() {
    if (!tba || parsedIn === 0n || !selectedGame) return
    if (parsedIn > inBalance) return toast.error(`Insufficient ${inToken} balance`)
    const tokenAddr = direction === 'pxlToGame' ? contracts.pxlToken.address : selectedGame.tokenAddress
    try {
      await execute(tokenAddr, 0n,
        encodeFunctionData({ abi: contracts.pxlToken.abi, functionName: 'approve', args: [contracts.pixelVaultDEX.address, parsedIn] }))
      const swapFn = direction === 'pxlToGame' ? 'swapPXLForGame' : 'swapGameForPXL'
      await execute(contracts.pixelVaultDEX.address, 0n,
        encodeFunctionData({ abi: contracts.pixelVaultDEX.abi, functionName: swapFn, args: [selectedGame.gameId, parsedIn, minOut] }))
      toast.success(`Swapped ${inputAmount} ${inToken} → ${fmt(estimatedOut)} ${outToken}`)
      setInputAmount(''); await fetchAll()
    } catch (err: any) { toast.error(err?.message ?? 'Swap failed') }
  }

  async function handleAddLiquidity() {
    if (!tba || !selectedGame) return
    const pxlAmt = safeParse(lpPxlAmount)
    if (pxlAmt === 0n) return toast.error('Enter PXL amount')
    const { reservePXL, reserveGame } = pool
    if (reservePXL === 0n) return toast.error('Pool not initialized')
    const gameAmtNeeded = (pxlAmt * reserveGame) / reservePXL
    const maxGameAmt = gameAmtNeeded + (gameAmtNeeded * SLIPPAGE_BPS / 10000n)
    try {
      await execute(contracts.pxlToken.address, 0n,
        encodeFunctionData({ abi: contracts.pxlToken.abi, functionName: 'approve', args: [contracts.pixelVaultDEX.address, pxlAmt] }))
      await execute(selectedGame.tokenAddress, 0n,
        encodeFunctionData({ abi: contracts.pxlToken.abi, functionName: 'approve', args: [contracts.pixelVaultDEX.address, maxGameAmt] }))
      await execute(contracts.pixelVaultDEX.address, 0n,
        encodeFunctionData({ abi: contracts.pixelVaultDEX.abi, functionName: 'addLiquidity', args: [selectedGame.gameId, pxlAmt, maxGameAmt] }))
      toast.success('Liquidity added!'); setLpPxlAmount(''); await fetchAll()
    } catch (err: any) { toast.error(err?.message ?? 'Add liquidity failed') }
  }

  async function handleRemoveLiquidity() {
    if (!tba || !selectedGame) return
    const shareAmt = safeParse(lpShareAmount)
    if (shareAmt === 0n) return toast.error('Enter share amount')
    try {
      await execute(contracts.pixelVaultDEX.address, 0n,
        encodeFunctionData({ abi: contracts.pixelVaultDEX.abi, functionName: 'removeLiquidity', args: [selectedGame.gameId, shareAmt] }))
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
          <p className="text-surface-500 text-sm mt-0.5">{games.length} game tokens · Swap · Liquidity</p>
        </div>
        <Link to="/bridge" className="btn-secondary text-sm px-3 py-1.5 inline-block">IBC Bridge</Link>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="card px-3 py-2 text-center">
          <p className="stat-label">PXL</p>
          <p className="text-sm font-semibold mt-0.5 text-brand-600">{fmt(pxlBalance)}</p>
        </div>
        {games.map(g => (
          <div key={g.symbol} className="card px-3 py-2 text-center">
            <p className="stat-label">{g.symbol}</p>
            <p className={`text-sm font-semibold mt-0.5 ${TOKEN_COLORS[g.symbol] ?? 'text-surface-700'}`}>{fmt(balances[g.symbol] ?? 0n)}</p>
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

      {/* Token selector — shared across tabs */}
      <div className="flex gap-2 flex-wrap">
        {games.map(g => (
          <button key={g.symbol} onClick={() => { setSelectedSymbol(g.symbol); setInputAmount('') }}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors
              ${selectedSymbol === g.symbol
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-surface-50 border-surface-200 text-surface-500 hover:text-surface-700'}`}>
            {g.symbol}
            <span className="ml-1.5 text-xs opacity-50">{g.name}</span>
          </button>
        ))}
      </div>

      {/* SWAP TAB */}
      {tab === 'swap' && selectedSymbol && (
        <div className="card p-5 space-y-4">
          {/* Direction */}
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <span className={`text-sm font-semibold ${TOKEN_COLORS[inToken] ?? 'text-surface-700'}`}>{inToken}</span>
            </div>
            <button onClick={() => { setDirection(d => d === 'pxlToGame' ? 'gameToPxl' : 'pxlToGame'); setInputAmount('') }}
              className="bg-surface-100 hover:bg-surface-200 border border-surface-200 rounded-full w-9 h-9 flex items-center justify-center text-surface-500 transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 5h14m-3-3 3 3-3 3M15 11H1m3-3-3 3 3 3"/>
              </svg>
            </button>
            <div className="flex-1 text-center">
              <span className={`text-sm font-semibold ${TOKEN_COLORS[outToken] ?? 'text-surface-700'}`}>{outToken}</span>
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
              <span className={`text-lg font-bold ${TOKEN_COLORS[outToken] ?? 'text-surface-700'}`}>
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
                  <span>1 {selectedSymbol} = {fmt(pool.price)} PXL</span>
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
      {tab === 'liquidity' && selectedSymbol && (
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="section-title text-sm">Add Liquidity</h3>
            <LpInput label="PXL Amount" value={lpPxlAmount} onChange={setLpPxlAmount} balance={pxlBalance} token="PXL" />
            {(() => {
              const pxlAmt = safeParse(lpPxlAmount)
              const { reservePXL, reserveGame } = pool
              const gameNeeded = reservePXL > 0n ? (pxlAmt * reserveGame) / reservePXL : 0n
              return pxlAmt > 0n && gameNeeded > 0n ? (
                <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm">
                  <span className="text-surface-500">{selectedSymbol} needed: </span>
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
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-sm">Remove Liquidity</h3>
              <span className="text-xs text-surface-400">
                LP shares: <span className="text-surface-700 font-mono">{fmt(lpBalances[selectedSymbol] ?? 0n)}</span>
              </span>
            </div>
            <LpInput label="LP Share Amount" value={lpShareAmount} onChange={setLpShareAmount}
              balance={lpBalances[selectedSymbol] ?? 0n} token="shares" />
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
          <div className="card p-4">
            <p className="stat-label text-center mb-3">Cross-Game Token Flow</p>
            <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
              {games.map((g, i) => (
                <div key={g.symbol} className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-lg border border-surface-200 font-medium ${TOKEN_COLORS[g.symbol] ?? 'text-surface-700'}`}>{g.symbol}</span>
                  {i < games.length - 1 && (
                    <>
                      <span className="text-surface-300">↔</span>
                      <span className="px-2 py-1 rounded-lg border border-surface-200 font-bold text-brand-600 text-xs">PXL</span>
                      <span className="text-surface-300">↔</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-surface-400 text-center mt-2">Every game token routes through PXL — enabling cross-game value transfer</p>
          </div>
          {games.map(g => (
            <div key={g.symbol} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-surface-700">{g.name} ({g.symbol})</span>
                <span className="text-xs text-surface-400">Rating: {(Number(ratings[g.symbol] ?? 100n) / 100).toFixed(1)}★</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pool Reserves */}
      <div className="card p-5 space-y-4">
        <h2 className="section-title text-sm">Pool Reserves — {games.length} Active Pools</h2>
        <div className="space-y-3">
          {games.map(g => {
            const p = pools[g.symbol] ?? { reservePXL: 0n, reserveGame: 0n, price: 0n }
            return (
              <div key={g.symbol} className="bg-surface-50 rounded-xl p-4 border border-surface-100 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-surface-700">PXL / {g.symbol}</p>
                  <span className="text-xs text-surface-400">{g.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="stat-label">PXL Reserve</p>
                    <p className="font-mono font-medium text-brand-600">{fmt(p.reservePXL)}</p>
                  </div>
                  <div>
                    <p className="stat-label">{g.symbol} Reserve</p>
                    <p className={`font-mono font-medium ${TOKEN_COLORS[g.symbol] ?? 'text-surface-700'}`}>{fmt(p.reserveGame)}</p>
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
