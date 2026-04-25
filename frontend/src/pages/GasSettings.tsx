import { useState, useEffect } from 'react'
import { formatEther, parseAbiItem } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import toast from 'react-hot-toast'

interface RegisteredGame { gameId: `0x${string}`; name: string; symbol: string; tokenAddress: `0x${string}` }

type GasRecord = {
  txHash: string
  targetName: string
  tokenName: string
  tokensProvided: bigint
  pxlEquivalent: bigint
  success: boolean
  gasFeeAmount?: string
  gasFeeDenom?: string
}

export default function GasSettings() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()
  const [isLoading, setIsLoading] = useState(true)
  const [games, setGames] = useState<RegisteredGame[]>([])
  const [gasHistory, setGasHistory] = useState<GasRecord[]>([])
  const [rates, setRates] = useState<Record<string, bigint>>({})

  const fmtAmount = (value: bigint, maxDecimals = 4) => {
    const n = Number(formatEther(value))
    if (!Number.isFinite(n)) return formatEther(value)
    return n.toLocaleString(undefined, { maximumFractionDigits: maxDecimals })
  }

  const resolveCosmosFee = async (txHash: string): Promise<{ amount: string; denom: string } | null> => {
    try {
      const response = await fetch(`/api/gas-fee?txHash=${encodeURIComponent(txHash)}`)
      if (!response.ok) return null
      const data = await response.json()
      if (!data?.ok || !data?.fee?.amount || !data?.fee?.denom) return null
      return { amount: String(data.fee.amount), denom: String(data.fee.denom) }
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!tba) return
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch games from registry
        const countRaw = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameCount' })
        const count = Number(countRaw)
        const fetchedGames: RegisteredGame[] = []
        const tokenMap = new Map<string, string>() // address -> symbol
        for (let i = 0; i < count; i++) {
          const gameId = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'gameIds', args: [BigInt(i)] }) as `0x${string}`
          const data = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'games', args: [gameId] }) as any
          if (data[8] === true) {
            fetchedGames.push({ gameId, name: data[3], symbol: data[4], tokenAddress: data[0] })
            tokenMap.set(data[0].toLowerCase(), data[4])
          }
        }
        setGames(fetchedGames)

        // Fetch exchange rates for each game
        const newRates: Record<string, bigint> = {}
        for (const game of fetchedGames) {
          const rate = await publicClient.readContract({ address: contracts.dex.address, abi: contracts.dex.abi, functionName: 'getAmountIn', args: [game.gameId, 10n ** 18n] }).catch(() => 0n) as bigint
          newRates[game.symbol] = rate
        }
        setRates(newRates)

        // Gas history
        const logs = await publicClient.getLogs({
          address: contracts.gasPaymaster.address,
          event: parseAbiItem('event GasSponsored(address indexed playerTBA, address indexed gameToken, uint256 tokensProvided, uint256 pxlReceived, address target, bool success)'),
          args: { playerTBA: tba as `0x${string}` },
          fromBlock: 0n,
        })
        const records: GasRecord[] = logs.map((log: any) => ({
          txHash: log.transactionHash,
          targetName: (log.args.target as string)?.slice(0, 10) + '…',
          tokenName: tokenMap.get(log.args.gameToken?.toLowerCase()) ?? 'Unknown',
          tokensProvided: log.args.tokensProvided ?? 0n,
          pxlEquivalent: log.args.pxlReceived ?? 0n,
          success: log.args.success ?? false,
        }))
        const reversed = records.reverse()
        const withFees = await Promise.all(
          reversed.map(async (record) => {
            const fee = await resolveCosmosFee(record.txHash)
            if (!fee) return record
            return { ...record, gasFeeAmount: fee.amount, gasFeeDenom: fee.denom }
          })
        )
        setGasHistory(withFees)
      } catch (error) {
        console.error('Error fetching gas data:', error)
        toast.error('Failed to load gas data')
      } finally { setIsLoading(false) }
    }
    fetchData()
  }, [tba, contracts])

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="page-title">Gas Settings</h1>
        <p className="text-surface-500 text-sm mt-0.5">Pay gas with game tokens instead of native GAS via ERC-2771 meta-transactions</p>
      </div>

      {/* Active Status */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title">GasPaymaster Status</h2>
        <p className="text-xs text-surface-400">Supports {games.length} game tokens. Each game page has its own toggle.</p>
        <div className="space-y-2">
          {games.map(g => (
            <div key={g.symbol} className="flex items-center justify-between bg-surface-50 rounded-xl p-3 border border-surface-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-surface-700">{g.name}</span>
              </div>
              <span className="text-xs font-medium text-emerald-600">Pays gas in {g.symbol}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Exchange Rates */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title">Exchange Rates</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {games.map(g => (
            <div key={g.symbol} className="bg-surface-50 rounded-xl p-3 border border-surface-100 min-w-0">
              <p className="stat-label mb-1">1 PXL costs</p>
              <p className="font-bold text-surface-700 flex items-baseline gap-1 min-w-0 whitespace-nowrap">
                <span className="tabular-nums truncate">{rates[g.symbol] && rates[g.symbol] > 0n ? fmtAmount(rates[g.symbol]) : '—'}</span>
                <span className="text-xs font-semibold text-surface-600 shrink-0">{g.symbol}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Gas History */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title">Payment History</h2>
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface-100 rounded-xl" />)}
          </div>
        ) : gasHistory.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-surface-400 text-sm">No gas payments recorded yet.</p>
            <p className="text-surface-300 text-xs mt-1">Play a game with GasPaymaster enabled to see entries here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {gasHistory.map((record, idx) => (
              <div key={idx} className="flex items-center justify-between bg-surface-50 rounded-xl p-3 border border-surface-100">
                <div>
                  <p className="text-sm font-medium text-surface-900">
                    {record.targetName}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-md ${record.success ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                      {record.success ? 'OK' : 'Fail'}
                    </span>
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5 font-mono">{record.txHash.slice(0, 10)}…{record.txHash.slice(-6)}</p>
                </div>
                <div className="text-right min-w-0 max-w-[45%]">
                  <p className="text-sm font-semibold text-brand-600 flex items-baseline justify-end gap-1 min-w-0 whitespace-nowrap">
                    <span className="tabular-nums truncate">{fmtAmount(record.tokensProvided)}</span>
                    <span className="text-xs font-semibold shrink-0">{record.tokenName}</span>
                  </p>
                  <p className="text-xs text-surface-400 truncate">
                    Fee: {record.gasFeeAmount && record.gasFeeDenom ? `${record.gasFeeAmount} ${record.gasFeeDenom}` : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}