import { useState, useEffect, useCallback } from 'react'
import { formatEther } from 'viem'
import { publicClient } from './useContracts'
import { PixelVaultDEXABI } from '../lib/abis'
import { ADDRESSES } from '../lib/addresses'

const POLL_INTERVAL = 30_000 // 30s
const GAS_BUFFER = 115n // 15% buffer (divide by 100)
// Typical gas units for a game action via paymaster (measured from on-chain)
const ESTIMATED_GAS_UNITS = 250_000n

interface GasEstimate {
  /** Estimated gas cost in game tokens (with 15% buffer + DEX fee) */
  gasCostTokens: bigint
  /** Gas price in wei */
  gasPrice: bigint
  /** Whether the estimate is still loading */
  isLoading: boolean
  /** Human-readable gas cost string */
  formatted: string
  /** Force a refresh */
  refresh: () => void
}

/**
 * Estimates dynamic gas cost in game tokens for a given game.
 * Queries current gas price, estimates total cost in native, converts
 * through DEX (getAmountIn) with 0.3% DEX fee + 15% safety buffer.
 */
export function useGasEstimate(gameId: `0x${string}` | undefined): GasEstimate {
  const [gasCostTokens, setGasCostTokens] = useState(5n * 10n ** 18n) // default fallback 5 tokens
  const [gasPrice, setGasPrice] = useState(0n)
  const [isLoading, setIsLoading] = useState(true)

  const estimate = useCallback(async () => {
    if (!gameId) return
    try {
      // 1. Get current gas price from the network
      const currentGasPrice = await publicClient.getGasPrice()
      setGasPrice(currentGasPrice)

      // 2. Compute estimated native gas cost
      const nativeGasCost = currentGasPrice * ESTIMATED_GAS_UNITS

      // 3. Convert native gas cost to game tokens via DEX
      // GasPaymaster swaps game tokens → PXL → pays gas.
      // We need: how many game tokens to get `nativeGasCost` worth of PXL.
      // On Initia MiniEVM, native gas is effectively PXL-denominated.
      // getAmountIn(gameId, pxlAmountOut) returns gameTokens needed.
      if (nativeGasCost === 0n) {
        setGasCostTokens(0n)
        return
      }

      const gameTokensNeeded = (await publicClient.readContract({
        address: ADDRESSES.PixelVaultDEX as `0x${string}`,
        abi: PixelVaultDEXABI,
        functionName: 'getAmountIn',
        args: [gameId, nativeGasCost],
      })) as bigint

      // 4. Add 15% safety buffer
      const withBuffer = (gameTokensNeeded * GAS_BUFFER) / 100n

      setGasCostTokens(withBuffer)
    } catch (err) {
      // Fallback: keep previous estimate (or default 5 tokens)
      console.warn('Gas estimate failed, using fallback:', err)
    } finally {
      setIsLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    estimate()
    const id = setInterval(estimate, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [estimate])

  const formatted = parseFloat(formatEther(gasCostTokens)).toFixed(2)

  return { gasCostTokens, gasPrice, isLoading, formatted, refresh: estimate }
}
