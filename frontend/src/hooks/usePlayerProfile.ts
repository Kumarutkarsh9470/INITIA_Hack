import { useState, useEffect, useCallback } from 'react'
import { encodeFunctionData } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { AccAddress } from '@initia/initia.js'
import { publicClient, useContracts } from './useContracts'
import { ADDRESSES } from '../lib/addresses'
import { PlayerProfileABI } from '../lib/abis'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID

interface PlayerProfileData {
  hasProfile: boolean
  tokenId: bigint
  tba: `0x${string}` | null
  username: string
  reputation: bigint
  isLoading: boolean
  refetch: () => void
  mint: (username: string) => Promise<void>
}

export function usePlayerProfile(): PlayerProfileData {
  const { initiaAddress, requestTxBlock } = useInterwovenKit()
  const contracts = useContracts()
  const [hasProfile, setHasProfile] = useState(false)
  const [tokenId, setTokenId] = useState(0n)
  const [tba, setTba] = useState<`0x${string}` | null>(null)
  const [username, setUsername] = useState('')
  const [reputation, setReputation] = useState(0n)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!initiaAddress) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const hex = AccAddress.toHex(initiaAddress)
      const ownerAddress = (hex.startsWith('0x') ? hex : `0x${hex}`) as `0x${string}`

      // Check if wallet has minted
      const minted = await publicClient.readContract({
        address: contracts.playerProfile.address,
        abi: contracts.playerProfile.abi,
        functionName: 'hasMinted',
        args: [ownerAddress],
      }) as boolean

      if (!minted) {
        setHasProfile(false)
        setIsLoading(false)
        return
      }

      setHasProfile(true)

      // Get token ID
      const tid = await publicClient.readContract({
        address: contracts.playerProfile.address,
        abi: contracts.playerProfile.abi,
        functionName: 'ownerToTokenId',
        args: [ownerAddress],
      }) as bigint
      setTokenId(tid)

      // Get username
      const name = await publicClient.readContract({
        address: contracts.playerProfile.address,
        abi: contracts.playerProfile.abi,
        functionName: 'usernames',
        args: [tid],
      }) as string
      setUsername(name)

      // Get TBA address from registry
      const chainId = await publicClient.getChainId()
      const tbaAddr = await publicClient.readContract({
        address: contracts.erc6551Registry.address,
        abi: contracts.erc6551Registry.abi,
        functionName: 'account',
        args: [
          ADDRESSES.ERC6551Account,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          BigInt(chainId),
          ADDRESSES.PlayerProfile,
          tid,
        ],
      }) as `0x${string}`
      setTba(tbaAddr)

      // Get reputation
      try {
        const rep = await publicClient.readContract({
          address: contracts.achievementBadge.address,
          abi: contracts.achievementBadge.abi,
          functionName: 'getReputation',
          args: [tbaAddr],
        }) as bigint
        setReputation(rep)
      } catch {
        setReputation(0n)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setIsLoading(false)
    }
  }, [initiaAddress, contracts])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const mint = useCallback(
    async (name: string) => {
      if (!initiaAddress) throw new Error('Wallet not connected')

      const data = encodeFunctionData({
        abi: PlayerProfileABI,
        functionName: 'mint',
        args: [name],
      })

      await requestTxBlock({
        chainId: CHAIN_ID,
        messages: [
          {
            typeUrl: '/minievm.evm.v1.MsgCall',
            value: {
              sender: initiaAddress.toLowerCase(),
              contractAddr: ADDRESSES.PlayerProfile,
              input: data,
              value: '0',
              accessList: [],
              authList: [],
            },
          },
        ],
      })

      // Refetch profile after mint
      await fetchProfile()
    },
    [initiaAddress, requestTxBlock, fetchProfile],
  )

  return {
    hasProfile,
    tokenId,
    tba,
    username,
    reputation,
    isLoading,
    refetch: fetchProfile,
    mint,
  }
}
