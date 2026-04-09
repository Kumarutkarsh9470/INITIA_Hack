import { useState, useCallback } from 'react'
import { encodeFunctionData } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { ERC6551AccountABI } from '../lib/abis'
import { usePlayerProfile } from './usePlayerProfile'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID

interface TBAActions {
  execute: (target: `0x${string}`, value: bigint, calldata: `0x${string}`) => Promise<void>
  isPending: boolean
}

/**
 * Wraps any contract call in a TBA.execute() transaction.
 * Every game action goes through this hook.
 *
 * Usage:
 *   const { execute, isPending } = useTBA()
 *   const calldata = encodeFunctionData({ abi, functionName, args })
 *   await execute(contractAddress, 0n, calldata)
 */
export function useTBA(): TBAActions {
  const { initiaAddress, requestTxBlock } = useInterwovenKit()
  const { tba } = usePlayerProfile()
  const [isPending, setIsPending] = useState(false)

  const execute = useCallback(
    async (target: `0x${string}`, value: bigint, calldata: `0x${string}`) => {
      if (!initiaAddress || !tba) throw new Error('No profile or wallet')

      // Encode: tba.execute(target, value, calldata, 0)
      const data = encodeFunctionData({
        abi: ERC6551AccountABI,
        functionName: 'execute',
        args: [target, value, calldata, 0],
      })

      setIsPending(true)
      try {
        await requestTxBlock({
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
      } finally {
        setIsPending(false)
      }
    },
    [initiaAddress, tba, requestTxBlock],
  )

  return { execute, isPending }
}
