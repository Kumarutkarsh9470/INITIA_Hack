import { useState, useEffect } from 'react'
import { formatEther, parseAbiItem } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { GAME_IDS } from '../lib/constants'
import toast from 'react-hot-toast'

const getTokenName = (address: string, contracts: any) => {
  if (address.toLowerCase() === contracts.dungeonDropsToken.address.toLowerCase()) return 'DNGN'
  if (address.toLowerCase() === contracts.harvestFieldToken.address.toLowerCase()) return 'HRV'
  if (address.toLowerCase() === contracts.pxlToken.address.toLowerCase()) return 'PXL'
  return 'Unknown'
}
const getContractName = (address: string, contracts: any) => {
  if (address.toLowerCase() === contracts.marketplace.address.toLowerCase()) return 'Marketplace'
  if (address.toLowerCase() === contracts.dungeonDrops.address.toLowerCase()) return 'Dungeon Drops'
  if (address.toLowerCase() === contracts.harvestField.address.toLowerCase()) return 'Harvest Field'
  if (address.toLowerCase() === contracts.gameRegistry.address.toLowerCase()) return 'Game Registry'
  return 'Unknown'
}

type GasRecord = { txHash: string; targetName: string; tokenName: string; tokensProvided: bigint; pxlEquivalent: bigint; success: boolean }

export default function GasSettings() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()
  const [preferredToken, setPreferredToken] = useState<'DNGN' | 'HRV'>('DNGN')
  const [isLoading, setIsLoading] = useState(true)
  const [gasHistory, setGasHistory] = useState<GasRecord[]>([])
  const [rates, setRates] = useState<{ dngn: bigint; hrv: bigint }>({ dngn: 0n, hrv: 0n })

  useEffect(() => {
    if (!tba) return
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const dngnRate = await publicClient.readContract({ address: contracts.dex.address, abi: contracts.dex.abi, functionName: 'getAmountIn', args: [GAME_IDS.DUNGEON, 10n ** 18n] }).catch(() => 0n)
        const hrvRate = await publicClient.readContract({ address: contracts.dex.address, abi: contracts.dex.abi, functionName: 'getAmountIn', args: [GAME_IDS.HARVEST, 10n ** 18n] }).catch(() => 0n)
        setRates({ dngn: dngnRate as bigint, hrv: hrvRate as bigint })
        const logs = await publicClient.getLogs({
          address: contracts.gasPaymaster.address,
          event: parseAbiItem('event GasSponsored(address indexed playerTBA, address indexed gameToken, uint256 tokensProvided, uint256 pxlReceived, address target, bool success)'),
          args: { playerTBA: tba as `0x${string}` },
          fromBlock: 0n,
        })
        const records: GasRecord[] = logs.map((log: any) => ({
          txHash: log.transactionHash,
          targetName: getContractName(log.args.target, contracts),
          tokenName: getTokenName(log.args.gameToken, contracts),
          tokensProvided: log.args.tokensProvided ?? 0n,
          pxlEquivalent: log.args.pxlReceived ?? 0n,
          success: log.args.success ?? false,
        }))
        setGasHistory(records.reverse())
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
        <p className="text-surface-500 text-sm mt-0.5">Pay gas with game tokens instead of PXL</p>
      </div>

      {/* Preferred Token */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title">Preferred Gas Token</h2>
        <p className="text-sm text-surface-500">Choose which token the GasPaymaster uses for your transactions.</p>
        <div className="flex gap-2">
          {(['DNGN', 'HRV'] as const).map(token => (
            <button key={token} onClick={() => setPreferredToken(token)}
              className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors
                ${preferredToken === token
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-100 text-surface-500 hover:bg-surface-200'}`}>
              {token}
            </button>
          ))}
        </div>
      </div>

      {/* Exchange Rates */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title">Exchange Rates</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
            <p className="stat-label mb-1">DNGN → PXL</p>
            <p className="font-bold text-violet-600">{rates.dngn > 0n ? formatEther(rates.dngn) : '—'} PXL</p>
          </div>
          <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
            <p className="stat-label mb-1">HRV → PXL</p>
            <p className="font-bold text-emerald-600">{rates.hrv > 0n ? formatEther(rates.hrv) : '—'} PXL</p>
          </div>
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
            <p className="text-surface-300 text-xs mt-1">They will appear after interacting with PixelVault contracts.</p>
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
                <div className="text-right">
                  <p className="text-sm font-semibold text-brand-600">{formatEther(record.tokensProvided)} {record.tokenName}</p>
                  <p className="text-xs text-surface-400">≈ {formatEther(record.pxlEquivalent)} PXL</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}