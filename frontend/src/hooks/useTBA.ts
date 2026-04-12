import { useState, useCallback } from 'react'
import { encodeFunctionData } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { ERC6551AccountABI, GasPaymasterABI } from '../lib/abis'
import { ADDRESSES } from '../lib/addresses'
import { usePlayerProfile } from './usePlayerProfile'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID

interface TBAActions {
  execute: (target: `0x${string}`, value: bigint, calldata: `0x${string}`) => Promise<any>
  executeViaPaymaster: (gameToken: `0x${string}`, maxGameTokens: bigint, target: `0x${string}`, calldata: `0x${string}`) => Promise<any>
  isPending: boolean
}

/**
 * Wraps any contract call in a TBA.execute() transaction.
 * Every game action goes through this hook.
 *
 * Usage:
 *   const { execute, executeViaPaymaster, isPending } = useTBA()
 *   const calldata = encodeFunctionData({ abi, functionName, args })
 *   await execute(contractAddress, 0n, calldata)
 *   // Or route through GasPaymaster:
 *   await executeViaPaymaster(gameTokenAddr, 5n * 10n**18n, contractAddress, calldata)
 */
export function useTBA(): TBAActions {
  const { initiaAddress, requestTxBlock } = useInterwovenKit()
  const { tba } = usePlayerProfile()
  const [isPending, setIsPending] = useState(false)

  const execute = useCallback(
    async (target: `0x${string}`, value: bigint, calldata: `0x${string}`): Promise<any> => {
      if (!initiaAddress || !tba) throw new Error('No profile or wallet')

      // Encode: tba.execute(target, value, calldata, 0)
      const data = encodeFunctionData({
        abi: ERC6551AccountABI,
        functionName: 'execute',
        args: [target, value, calldata, 0],
      })

      setIsPending(true)
      try {
        const result = await requestTxBlock({
          chainId: CHAIN_ID,
          messages: [
            {
              typeUrl: '/minievm.evm.v1.MsgCall',
              value: {
                sender: initiaAddress.toLowerCase(),
                contractAddr: tba,
                input: data,
                value: '0',
                accessList: [],
                authList: [],
              },
            },
          ],
        })
        return result
      } finally {
        setIsPending(false)
      }
    },
    [initiaAddress, tba, requestTxBlock],
  )

  const executeViaPaymaster = useCallback(
    async (gameToken: `0x${string}`, maxGameTokens: bigint, target: `0x${string}`, calldata: `0x${string}`): Promise<any> => {
      const paymasterCalldata = encodeFunctionData({
        abi: GasPaymasterABI,
        functionName: 'executeWithGameToken',
        args: [gameToken, maxGameTokens, target, calldata],
      })
      return execute(ADDRESSES.GasPaymaster as `0x${string}`, 0n, paymasterCalldata)
    },
    [execute],
  )

  return { execute, executeViaPaymaster, isPending }
}
