import { useState, useEffect, useCallback } from 'react'
import { formatEther, parseEther, encodeFunctionData } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import toast from 'react-hot-toast'

const BLOCKS_REQUIRED = 100n

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
  const { execute, isPending } = useTBA()

  const [hrvBalance, setHrvBalance] = useState(0n)
  const [stakedAmount, setStakedAmount] = useState(0n)
  const [stakedAtBlock, setStakedAtBlock] = useState(0n)
  const [currentBlock, setCurrentBlock] = useState(0n)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [inputAmount, setInputAmount] = useState('')

  const blocksElapsed = stakedAmount > 0n && currentBlock > stakedAtBlock ? currentBlock - stakedAtBlock : 0n
  const progress = Number(blocksElapsed) / Number(BLOCKS_REQUIRED)
  const estimatedReward = calcReward(stakedAmount, blocksElapsed)
  const isStaking = stakedAmount > 0n
  const isReady = isStaking && blocksElapsed >= BLOCKS_REQUIRED

  const fetchData = useCallback(async () => {
    if (!tba) return
    try {
      const [balance, stakes, block] = await Promise.all([
        publicClient.readContract({ address: contracts.harvestFieldToken.address, abi: contracts.harvestFieldToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.harvestField.address, abi: contracts.harvestField.abi, functionName: 'stakes', args: [tba] }) as Promise<[bigint, bigint]>,
        publicClient.getBlockNumber(),
      ])
      setHrvBalance(balance)
      setStakedAmount(stakes[0])
      setStakedAtBlock(stakes[1])
      setCurrentBlock(block)
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

  async function handleStake() {
    if (!inputAmount || !tba) return
    let parsed: bigint
    try { parsed = parseEther(inputAmount) } catch { return toast.error('Invalid amount') }
    if (parsed <= 0n) return toast.error('Amount must be > 0')
    if (parsed > hrvBalance) return toast.error('Insufficient HRV balance')

    try {
      await execute(contracts.harvestFieldToken.address, 0n,
        encodeFunctionData({ abi: contracts.harvestFieldToken.abi, functionName: 'approve', args: [contracts.harvestField.address, parsed] }))
      await execute(contracts.harvestField.address, 0n,
        encodeFunctionData({ abi: contracts.harvestField.abi, functionName: 'stake', args: [parsed] }))
      toast.success('Staked successfully!')
      setInputAmount('')
      await fetchData()
    } catch (err: any) { toast.error(err?.message ?? 'Stake failed') }
  }

  async function handleHarvest() {
    if (!tba) return
    try {
      await execute(contracts.harvestField.address, 0n,
        encodeFunctionData({ abi: contracts.harvestField.abi, functionName: 'harvest', args: [] }))
      toast.success('Harvest complete!')
      await fetchData()
    } catch (err: any) { toast.error(err?.message ?? 'Harvest failed') }
  }

  async function handleUnstake() {
    if (!tba) return
    try {
      await execute(contracts.harvestField.address, 0n,
        encodeFunctionData({ abi: contracts.harvestField.abi, functionName: 'unstake', args: [] }))
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

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Harvest Field</h1>
          <p className="text-surface-500 text-sm mt-0.5">Stake HRV for 100 blocks to earn rewards</p>
          <p className="text-xs text-surface-400 mt-1 italic">Demo game — in production, this is a farming simulation with 3D fields. The staking/harvest contract calls are identical.</p>
        </div>
        <div className="card px-4 py-2 text-right">
          <p className="stat-label">Balance</p>
          <p className="text-sm font-bold text-surface-900">{fmt(hrvBalance)} HRV</p>
        </div>
      </div>

      {/* Not staking */}
      {!isStaking && (
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="section-title">Start Staking</h2>
            <p className="text-surface-500 text-sm mt-0.5">Lock HRV for 100 blocks and earn proportional rewards.</p>
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
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm">
              <p className="text-surface-500">
                Estimated reward after 100 blocks:{' '}
                <span className="text-surface-900 font-semibold">
                  {fmt(calcReward((() => { try { return parseEther(inputAmount) } catch { return 0n } })(), 100n))} HRV
                </span>
              </p>
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
              <p className="text-surface-500 text-sm">Wait for 100 blocks to pass.</p>
            </div>
            <ProgressRing pct={progress} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Staked" value={`${fmt(stakedAmount)} HRV`} />
            <StatBox label="Est. Reward" value={`${fmt(estimatedReward)} HRV`} highlight />
            <StatBox label="Staked at block" value={stakedAtBlock.toString()} mono />
            <StatBox label="Current block" value={currentBlock.toString()} mono />
          </div>
          <div>
            <div className="flex justify-between text-xs text-surface-500 mb-1">
              <span>Progress</span>
              <span>{Number(blocksElapsed)} / 100</span>
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
              <p className="text-surface-500 text-sm">100 blocks passed. Collect your rewards.</p>
            </div>
            <ProgressRing pct={1} />
          </div>
          <div className="bg-white border border-emerald-200 rounded-xl p-5 text-center">
            <p className="text-surface-400 text-sm mb-1">You will receive</p>
            <p className="text-4xl font-bold text-emerald-600">{fmt(estimatedReward)}</p>
            <p className="text-emerald-600/60 text-sm mt-0.5">HRV tokens</p>
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
        <p>2. Wait for 100 blocks (~8 min on Initia).</p>
        <p>3. Harvest to receive staked HRV plus rewards.</p>
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
