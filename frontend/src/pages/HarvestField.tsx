import { useState, useEffect, useCallback } from 'react'
import { formatEther, parseEther, encodeFunctionData } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { ADDRESSES } from '../lib/addresses'
import { HARVEST_GAME_ID } from '../lib/constants'
import toast from 'react-hot-toast'

const BLOCKS_REQUIRED = 20n

function calcReward(amount: bigint, blocksElapsed: bigint): bigint {
  if (amount === 0n || blocksElapsed <= 0n) return 0n
  return (amount * 10_000_000_000_000_000n * blocksElapsed) / 1_000_000_000_000_000_000n
}

function fmt(val: bigint, decimals = 4): string {
  return parseFloat(formatEther(val)).toFixed(decimals)
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(pct, 1))
  return (
    <svg width={80} height={80} viewBox="0 0 88 88" className="shrink-0">
      <circle cx={44} cy={44} r={r} fill="none" stroke="#e9ecef" strokeWidth={8} />
      <circle
        cx={44} cy={44} r={r} fill="none"
        stroke={pct >= 1 ? '#16a34a' : '#4c6ef5'}
        strokeWidth={8} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
      />
      <text x={44} y={49} textAnchor="middle" fill={pct >= 1 ? '#16a34a' : '#4c6ef5'}
        fontSize={14} fontWeight="bold" fontFamily="monospace">
        {Math.min(Math.round(pct * 100), 100)}%
      </text>
    </svg>
  )
}

export default function HarvestField() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, executeViaPaymaster, isPending } = useTBA()
  const { gasCostTokens: GAS_COST_HRV, formatted: gasFeeDisplay } = useGasEstimate(HARVEST_GAME_ID)

  const [hrvBalance, setHrvBalance] = useState(0n)
  const [stakedAmount, setStakedAmount] = useState(0n)
  const [stakedAtBlock, setStakedAtBlock] = useState(0n)
  const [currentBlock, setCurrentBlock] = useState(0n)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [inputAmount, setInputAmount] = useState('')
  const [usePaymaster, setUsePaymaster] = useState(() => {
    try { return localStorage.getItem('pv-gas-harvest') !== 'off' } catch { return true }
  })
  const [harvestItemBalance, setHarvestItemBalance] = useState(0n)

  const blocksElapsed = stakedAmount > 0n && currentBlock > stakedAtBlock ? currentBlock - stakedAtBlock : 0n
  const progress = Number(blocksElapsed) / Number(BLOCKS_REQUIRED)
  const estimatedReward = calcReward(stakedAmount, blocksElapsed)
  const isStaking = stakedAmount > 0n
  const isReady = isStaking && blocksElapsed >= BLOCKS_REQUIRED

  const togglePaymaster = () => {
    const next = !usePaymaster
    setUsePaymaster(next)
    try { localStorage.setItem('pv-gas-harvest', next ? 'on' : 'off') } catch {}
  }

  const fetchData = useCallback(async () => {
    if (!tba) return
    try {
      const [balance, stakes, block, seasonalItem] = await Promise.all([
        publicClient.readContract({ address: contracts.harvestFieldToken.address, abi: contracts.harvestFieldToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.harvestField.address, abi: contracts.harvestField.abi, functionName: 'stakes', args: [tba] }) as Promise<[bigint, bigint]>,
        publicClient.getBlockNumber(),
        publicClient.readContract({ address: contracts.harvestFieldAssets.address, abi: contracts.harvestFieldAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }) as Promise<bigint>,
      ])
      setHrvBalance(balance)
      setStakedAmount(stakes[0])
      setStakedAtBlock(stakes[1])
      setCurrentBlock(block)
      setHarvestItemBalance(seasonalItem)
    } catch (err) {
      console.error('HarvestField fetch error:', err)
      toast.error('Failed to load harvest data')
    } finally {
      setIsLoadingData(false)
    }
  }, [tba, contracts])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!isStaking) return
    const id = setInterval(async () => {
      try { setCurrentBlock(await publicClient.getBlockNumber()) } catch {}
    }, 5000)
    return () => clearInterval(id)
  }, [isStaking])

  async function ensurePaymasterApproval() {
    if (!usePaymaster || !tba) return
    const paymasterAllowance = await publicClient.readContract({
      address: contracts.harvestFieldToken.address,
      abi: contracts.harvestFieldToken.abi,
      functionName: 'allowance',
      args: [tba, ADDRESSES.GasPaymaster],
    }) as bigint
    if (paymasterAllowance < GAS_COST_HRV) {
      const approvePaymaster = encodeFunctionData({
        abi: contracts.harvestFieldToken.abi,
        functionName: 'approve',
        args: [ADDRESSES.GasPaymaster, GAS_COST_HRV * 100n],
      })
      await execute(contracts.harvestFieldToken.address, 0n, approvePaymaster)
    }
  }

  async function executeAction(target: `0x${string}`, calldata: `0x${string}`) {
    if (usePaymaster) {
      await ensurePaymasterApproval()
      return executeViaPaymaster(
        contracts.harvestFieldToken.address,
        GAS_COST_HRV,
        target,
        calldata,
      )
    }
    return execute(target, 0n, calldata)
  }

  async function handleStake() {
    if (!inputAmount || !tba) return
    let parsed: bigint
    try { parsed = parseEther(inputAmount) } catch { return toast.error('Invalid amount') }
    if (parsed <= 0n) return toast.error('Amount must be > 0')
    if (parsed > hrvBalance) return toast.error('Insufficient HRV balance')

    try {
      await execute(contracts.harvestFieldToken.address, 0n,
        encodeFunctionData({ abi: contracts.harvestFieldToken.abi, functionName: 'approve', args: [contracts.harvestField.address, parsed] }))
      const stakeCalldata = encodeFunctionData({ abi: contracts.harvestField.abi, functionName: 'stake', args: [parsed] })
      await executeAction(contracts.harvestField.address, stakeCalldata)
      toast.success('Staked successfully!')
      setInputAmount('')
      await fetchData()
    } catch (err: any) { toast.error(err?.message ?? 'Stake failed') }
  }

  async function handleHarvest() {
    if (!tba) return
    try {
      const harvestCalldata = encodeFunctionData({ abi: contracts.harvestField.abi, functionName: 'harvest', args: [] })
      await executeAction(contracts.harvestField.address, harvestCalldata)
      toast.success('Harvest complete!')
      await fetchData()
    } catch (err: any) { toast.error(err?.message ?? 'Harvest failed') }
  }

  async function handleUnstake() {
    if (!tba) return
    try {
      const unstakeCalldata = encodeFunctionData({ abi: contracts.harvestField.abi, functionName: 'unstake', args: [] })
      await executeAction(contracts.harvestField.address, unstakeCalldata)
      toast.success('Unstaked successfully')
      await fetchData()
    } catch (err: any) { toast.error(err?.message ?? 'Unstake failed') }
  }

  if (isLoadingData) {
    return (
      <div className="space-y-4 max-w-lg animate-pulse">
        <div className="h-8 bg-surface-200 rounded w-1/3" />
        <div className="h-40 bg-surface-100 rounded-xl" />
      </div>
    )
  }

  const rewardMultiplier = harvestItemBalance > 0n ? 1.15 : 1.0
  const adjustedReward = harvestItemBalance > 0n
    ? estimatedReward + (estimatedReward * 15n / 100n)
    : estimatedReward

  const insufficientForGas = usePaymaster && hrvBalance < GAS_COST_HRV && stakedAmount === 0n

  return (
    <div className="space-y-6 max-w-lg">
      {/* Farming-themed header */}
      <div className="harvest-gradient rounded-2xl p-6 text-white animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌾</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Harvest Field</h1>
              <p className="text-white/60 text-sm">Stake HRV for 20 blocks to earn rewards</p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-right">
            <p className="text-white/50 text-[10px] uppercase tracking-wider">Balance</p>
            <p className="text-sm font-bold text-white">{fmt(hrvBalance)} HRV</p>
          </div>
        </div>
      </div>

      {/* Gas Paymaster toggle */}
      <div className="card p-4 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-surface-700">Pay gas with HRV</p>
            <p className="text-xs text-surface-400 mt-0.5">
              {usePaymaster
                ? `Gas fee: ~${gasFeeDisplay} HRV`
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
        {insufficientForGas && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            You need at least ~{gasFeeDisplay} HRV for gas fees. Toggle off to use native GAS, or get more HRV from the DEX.
          </p>
        )}
      </div>

      {/* Item Utility - Seasonal Harvest Item */}
      {harvestItemBalance > 0n && (
        <div className="card p-5 space-y-3 animate-fade-in-up border-emerald-200 bg-emerald-50/30">
          <h2 className="section-title">Active Bonus</h2>
          <div className="flex items-center justify-between rounded-xl p-3 bg-white border border-emerald-200">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🌾</span>
              <div>
                <p className="text-sm font-medium text-emerald-700">Seasonal Harvest Bundle</p>
                <p className="text-xs text-emerald-600">+15% staking reward multiplier</p>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-500">×{harvestItemBalance.toString()}</span>
          </div>
        </div>
      )}

      {/* Not staking */}
      {!isStaking && (
        <div className="card p-6 space-y-5 animate-fade-in-up">
          <div>
            <h2 className="section-title">Start Staking</h2>
            <p className="text-surface-500 text-sm mt-0.5">
              Lock HRV for 20 blocks and earn proportional rewards.
              {usePaymaster && <span className="text-brand-500 ml-1">(via GasPaymaster)</span>}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500 uppercase tracking-wider block mb-1.5">Amount</label>
            <div className="relative">
              <input type="number" min="0" step="any" placeholder="0.00" value={inputAmount}
                onChange={e => setInputAmount(e.target.value)} className="input-field pr-24" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button onClick={() => setInputAmount(formatEther(hrvBalance))}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium">MAX</button>
                <span className="text-surface-400 text-sm">HRV</span>
              </div>
            </div>
          </div>
          {inputAmount && parseFloat(inputAmount) > 0 && (
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm space-y-1">
              <p className="text-surface-500">
                Base reward after 20 blocks:{' '}
                <span className="text-surface-900 font-semibold">
                  {fmt(calcReward((() => { try { return parseEther(inputAmount) } catch { return 0n } })(), 20n))} HRV
                </span>
              </p>
              {harvestItemBalance > 0n && (
                <p className="text-emerald-600 text-xs">
                  🌾 +15% bonus → {fmt(calcReward((() => { try { return parseEther(inputAmount) } catch { return 0n } })(), 20n) + calcReward((() => { try { return parseEther(inputAmount) } catch { return 0n } })(), 20n) * 15n / 100n)} HRV
                </p>
              )}
            </div>
          )}
          <button onClick={handleStake} disabled={isPending || !inputAmount || parseFloat(inputAmount) <= 0}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
            {isPending ? 'Processing…' : 'Stake HRV'}
          </button>
        </div>
      )}

      {/* Staking / waiting */}
      {isStaking && !isReady && (
        <div className="card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="section-title">Growing…</h2>
              <p className="text-surface-500 text-sm">Wait for 20 blocks to pass.</p>
            </div>
            <ProgressRing pct={progress} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Staked" value={`${fmt(stakedAmount)} HRV`} />
            <StatBox label="Est. Reward" value={`${fmt(adjustedReward)} HRV`} highlight />
            <StatBox label="Staked at block" value={stakedAtBlock.toString()} mono />
            <StatBox label="Current block" value={currentBlock.toString()} mono />
          </div>
          {harvestItemBalance > 0n && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-700 text-center">
              🌾 Seasonal Bundle active — earning {(rewardMultiplier * 100 - 100).toFixed(0)}% bonus rewards
            </div>
          )}
          <div>
            <div className="flex justify-between text-xs text-surface-500 mb-1">
              <span>Progress</span>
              <span>{Number(blocksElapsed)} / 20</span>
            </div>
            <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(progress * 100, 100)}%` }} />
            </div>
          </div>
          <div className="flex gap-3">
            <button disabled className="btn-secondary flex-1 opacity-50 cursor-not-allowed">Harvest (not ready)</button>
            <button onClick={handleUnstake} disabled={isPending}
              className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
              {isPending ? '…' : 'Unstake'}
            </button>
          </div>
          <p className="text-xs text-surface-400 text-center">Unstaking early forfeits rewards.</p>
        </div>
      )}

      {/* Ready to harvest */}
      {isStaking && isReady && (
        <div className="card p-6 space-y-5 border-emerald-200 bg-emerald-50/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <span className="text-emerald-600">✓</span> Ready to Harvest
              </h2>
              <p className="text-surface-500 text-sm">20 blocks passed. Collect your rewards.</p>
            </div>
            <ProgressRing pct={1} />
          </div>
          <div className="bg-white border border-emerald-200 rounded-xl p-5 text-center">
            <p className="text-surface-400 text-sm mb-1">You will receive</p>
            <p className="text-4xl font-bold text-emerald-600">{fmt(adjustedReward)}</p>
            <p className="text-emerald-600/60 text-sm mt-0.5">HRV tokens</p>
            {harvestItemBalance > 0n && (
              <p className="text-emerald-500 text-xs mt-1">🌾 Includes +15% seasonal bonus</p>
            )}
            <p className="text-surface-400 text-xs mt-2">
              Staked {fmt(stakedAmount)} HRV · {Number(blocksElapsed)} blocks
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleHarvest} disabled={isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
              {isPending ? 'Harvesting…' : 'Harvest'}
            </button>
            <button onClick={handleUnstake} disabled={isPending}
              className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
              Unstake
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="card p-5 text-sm text-surface-500 space-y-1.5">
        <p className="font-medium text-surface-700">How it works</p>
        <p>1. Approve & stake any amount of HRV.</p>
        <p>2. Wait for 20 blocks.</p>
        <p>3. Harvest to receive staked HRV plus rewards.</p>
        {harvestItemBalance > 0n && (
          <p className="text-emerald-600">🌾 Your Seasonal Harvest Bundle grants +15% bonus rewards!</p>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
      <p className="stat-label mb-1">{label}</p>
      <p className={`font-semibold text-sm ${highlight ? 'text-brand-600' : 'text-surface-900'} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
