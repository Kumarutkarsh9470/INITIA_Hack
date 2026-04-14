import { useState, useEffect, useCallback } from 'react'
import { formatEther, parseEther, encodeFunctionData } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import toast from 'react-hot-toast'

type BridgeToken = 'PXL' | 'DNGN' | 'HRV'

const TOKEN_INFO: Record<BridgeToken, { label: string; desc: string }> = {
  PXL: { label: 'PXL', desc: 'Platform Token' },
  DNGN: { label: 'DNGN', desc: 'Dungeon Drops' },
  HRV: { label: 'HRV', desc: 'Harvest Field' },
}

export default function Bridge() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, isPending } = useTBA()

  const [selectedToken, setSelectedToken] = useState<BridgeToken>('PXL')
  const [amount, setAmount] = useState('')
  const [receiver, setReceiver] = useState('')
  const [balances, setBalances] = useState<Record<BridgeToken, bigint>>({ PXL: 0n, DNGN: 0n, HRV: 0n })
  const [cosmosAddr, setCosmosAddr] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const tokenAddressMap: Record<BridgeToken, `0x${string}`> = {
    PXL: contracts.pxlToken.address,
    DNGN: contracts.dungeonDropsToken.address,
    HRV: contracts.harvestFieldToken.address,
  }

  // Fetch balances and cosmos address
  const fetchData = useCallback(async () => {
    if (!tba) return
    setIsLoading(true)
    try {
      const [pxl, dngn, hrv] = await Promise.all([
        publicClient.readContract({ address: contracts.pxlToken.address, abi: contracts.pxlToken.abi, functionName: 'balanceOf', args: [tba] }),
        publicClient.readContract({ address: contracts.dungeonDropsToken.address, abi: contracts.dungeonDropsToken.abi, functionName: 'balanceOf', args: [tba] }),
        publicClient.readContract({ address: contracts.harvestFieldToken.address, abi: contracts.harvestFieldToken.abi, functionName: 'balanceOf', args: [tba] }),
      ])
      setBalances({ PXL: pxl as bigint, DNGN: dngn as bigint, HRV: hrv as bigint })

      // Get Cosmos address for TBA
      try {
        const addr = await publicClient.readContract({
          address: contracts.cosmoBridge.address,
          abi: contracts.cosmoBridge.abi,
          functionName: 'getCosmosAddress',
          args: [tba],
        })
        setCosmosAddr(addr as string)
      } catch {
        setCosmosAddr('')
      }
    } catch (err) {
      console.error('Failed to fetch bridge data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [tba, contracts])

  useEffect(() => { fetchData() }, [fetchData])

  const parsedAmount = (() => {
    try { if (!amount || parseFloat(amount) <= 0) return 0n; return parseEther(amount) } catch { return 0n }
  })()

  const hasSufficientBalance = parsedAmount > 0n && parsedAmount <= balances[selectedToken]
  const isValidReceiver = receiver.startsWith('init1') && receiver.length >= 40

  const handleBridge = async () => {
    if (!tba || !hasSufficientBalance || !isValidReceiver) return

    try {
      // Step 1: Approve the CosmoBridge to spend tokens from TBA
      const approveData = encodeFunctionData({
        abi: contracts.pxlToken.abi,
        functionName: 'approve',
        args: [contracts.cosmoBridge.address, parsedAmount],
      })
      await execute(tokenAddressMap[selectedToken], 0n, approveData)

      // Step 2: Call bridgeTokenToL1
      const bridgeData = encodeFunctionData({
        abi: contracts.cosmoBridge.abi,
        functionName: 'bridgeTokenToL1',
        args: [tokenAddressMap[selectedToken], parsedAmount, receiver],
      })
      await execute(contracts.cosmoBridge.address, 0n, bridgeData)

      toast.success(`Bridged ${amount} ${selectedToken} to L1!`)
      setAmount('')
      fetchData()
    } catch (err: any) {
      console.error('Bridge failed:', err)
      toast.error(err?.message?.includes('user rejected') ? 'Transaction rejected' : 'Bridge failed — token may not be registered with Cosmos bank')
    }
  }

  const fmt = (val: bigint) => parseFloat(formatEther(val)).toFixed(2)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="page-title">IBC Bridge</h1>
        <p className="text-surface-500 text-sm mt-1">
          Bridge tokens from MiniEVM to Initia L1 via IBC
        </p>
      </div>

      {/* Cosmos Identity Card */}
      {cosmosAddr && (
        <div className="card p-5 border-brand-200 bg-brand-50/30">
          <p className="text-xs font-medium text-surface-500 mb-1">Your Cosmos Address (TBA)</p>
          <p className="font-mono text-sm text-surface-900 break-all">{cosmosAddr}</p>
        </div>
      )}

      {/* Bridge Card */}
      <div className="card p-6">
        <h2 className="section-title mb-5">Bridge Tokens to L1</h2>

        {/* Token selector */}
        <div className="mb-4">
          <label className="text-sm font-medium text-surface-600 mb-2 block">Select Token</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TOKEN_INFO) as BridgeToken[]).map((tk) => (
              <button
                key={tk}
                onClick={() => setSelectedToken(tk)}
                className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                  selectedToken === tk
                    ? 'border-surface-900 bg-surface-900 text-white'
                    : 'border-surface-200 bg-surface-50 text-surface-700 hover:bg-surface-100'
                }`}
              >
                <span className="block font-semibold">{TOKEN_INFO[tk].label}</span>
                <span className={`block text-xs mt-0.5 ${selectedToken === tk ? 'text-surface-300' : 'text-surface-400'}`}>
                  {isLoading ? '...' : fmt(balances[tk])}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <label className="text-sm font-medium text-surface-600 mb-2 block">Amount</label>
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.0"
              className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 text-lg font-medium text-surface-900 focus:ring-2 focus:ring-surface-300 focus:border-surface-300 outline-none"
            />
            <button
              onClick={() => setAmount(formatEther(balances[selectedToken]))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Receiver address */}
        <div className="mb-6">
          <label className="text-sm font-medium text-surface-600 mb-2 block">Receiver on L1</label>
          <input
            type="text"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value.trim())}
            placeholder="init1..."
            className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 text-sm font-mono text-surface-900 focus:ring-2 focus:ring-surface-300 focus:border-surface-300 outline-none"
          />
          {receiver && !isValidReceiver && (
            <p className="text-xs text-red-500 mt-1">Enter a valid Initia address starting with init1</p>
          )}
        </div>

        {/* Transfer details */}
        {parsedAmount > 0n && isValidReceiver && (
          <div className="bg-surface-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-500">Token</span>
              <span className="font-medium text-surface-900">{selectedToken}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Amount</span>
              <span className="font-medium text-surface-900">{amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Channel</span>
              <span className="font-mono text-surface-700">channel-0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Timeout</span>
              <span className="text-surface-700">10 minutes</span>
            </div>
          </div>
        )}

        {/* Bridge button */}
        <button
          onClick={handleBridge}
          disabled={isPending || !hasSufficientBalance || !isValidReceiver || parsedAmount === 0n}
          className="w-full btn-primary py-3.5 text-sm font-semibold disabled:opacity-50"
        >
          {isPending ? 'Bridging…' : !isValidReceiver ? 'Enter receiver address' : parsedAmount === 0n ? 'Enter amount' : !hasSufficientBalance ? 'Insufficient balance' : `Bridge ${amount} ${selectedToken} to L1`}
        </button>
      </div>

      {/* Info */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-surface-900">How IBC Bridge Works</h3>
        <div className="text-xs text-surface-500 space-y-2">
          <p>Tokens are bridged from your MiniEVM gaming wallet (TBA) to Initia L1 using IBC (Inter-Blockchain Communication).</p>
          <p>All game tokens (PXL, DNGN, HRV) are registered with the Cosmos bank module via the ERC20Registry precompile, making them bridgeable as native Cosmos assets.</p>
          <p>Transfers use <code className="text-surface-600 bg-surface-100 px-1 rounded">channel-0</code> with a 10-minute timeout. If the transfer fails, tokens are refunded automatically.</p>
        </div>
      </div>
    </div>
  )
}
