import { useState, useEffect, useCallback, useRef } from 'react'
import { encodeFunctionData } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { AccAddress } from '@initia/initia.js'
import { publicClient, useContracts } from './useContracts'
import { ADDRESSES } from '../lib/addresses'
import { PlayerProfileABI } from '../lib/abis'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID || 'trying'

// --- localStorage profile cache ---
const CACHE_KEY = 'pv-profile-cache'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

interface CachedProfile {
  address: string
  hasProfile: boolean
  tokenId: string
  tba: string | null
  username: string
  reputation: string
  ts: number
}

function loadCache(address: string): CachedProfile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c: CachedProfile = JSON.parse(raw)
    if (c.address?.toLowerCase() !== address.toLowerCase()) return null
    if (Date.now() - c.ts > CACHE_TTL) return null
    return c
  } catch { return null }
}

function saveCache(data: Omit<CachedProfile, 'ts'>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
  } catch { /* quota exceeded, ignore */ }
}

interface PlayerProfileData {
  hasProfile: boolean
  tokenId: bigint
  tba: `0x${string}` | null
  username: string
  reputation: bigint
  isLoading: boolean
  error: string | null
  refetch: () => void
  mint: (username: string) => Promise<void>
}

export function usePlayerProfile(): PlayerProfileData {
  const { initiaAddress, requestTxBlock } = useInterwovenKit()
  const contracts = useContracts()

  // Derive EVM address once
  const evmAddress = initiaAddress
    ? (() => {
        const hex = AccAddress.toHex(initiaAddress)
        return (hex.startsWith('0x') ? hex : `0x${hex}`) as `0x${string}`
      })()
    : null

  // Seed initial state from cache (prevents flash of "Create Profile")
  const cached = evmAddress ? loadCache(evmAddress) : null

  const [hasProfile, setHasProfile] = useState(cached?.hasProfile ?? false)
  const [tokenId, setTokenId] = useState(cached ? BigInt(cached.tokenId) : 0n)
  const [tba, setTba] = useState<`0x${string}` | null>(
    (cached?.tba as `0x${string}` | null) ?? null,
  )
  const [username, setUsername] = useState(cached?.username ?? '')
  const [reputation, setReputation] = useState(cached ? BigInt(cached.reputation) : 0n)
  const [isLoading, setIsLoading] = useState(!cached) // if we have cache, not loading
  const [error, setError] = useState<string | null>(null)
  const retryRef = useRef(0)

  const fetchProfile = useCallback(async () => {
    if (!initiaAddress || !evmAddress) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Check if wallet has minted
      const minted = await publicClient.readContract({
        address: contracts.playerProfile.address,
        abi: contracts.playerProfile.abi,
        functionName: 'hasMinted',
        args: [evmAddress],
      }) as boolean

      if (!minted) {
        setHasProfile(false)
        saveCache({ address: evmAddress, hasProfile: false, tokenId: '0', tba: null, username: '', reputation: '0' })
        setIsLoading(false)
        retryRef.current = 0
        return
      }

      setHasProfile(true)

      // Get token ID
      const tid = await publicClient.readContract({
        address: contracts.playerProfile.address,
        abi: contracts.playerProfile.abi,
        functionName: 'ownerToTokenId',
        args: [evmAddress],
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
      let rep = 0n
      try {
        rep = await publicClient.readContract({
          address: contracts.achievementBadge.address,
          abi: contracts.achievementBadge.abi,
          functionName: 'getReputation',
          args: [tbaAddr],
        }) as bigint
      } catch { /* no badges yet */ }
      setReputation(rep)

      // Persist to cache
      saveCache({
        address: evmAddress,
        hasProfile: true,
        tokenId: tid.toString(),
        tba: tbaAddr,
        username: name,
        reputation: rep.toString(),
      })
      retryRef.current = 0
    } catch (err) {
      console.error('Error fetching profile:', err)
      // If we have cached profile data, keep using it instead of showing error
      if (cached?.hasProfile) {
        // RPC is down but we know user has a profile — silently use cache
        setHasProfile(true)
        console.warn('RPC unreachable, using cached profile')
      } else {
        setError('Unable to connect to the network. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [initiaAddress, evmAddress, contracts, cached?.hasProfile])

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

      // Refetch profile after mint to get TBA address
      await fetchProfile()

      // Auto-fund TBA with starter tokens via faucet API
      try {
        // Read the TBA from the chain directly (fetchProfile already populated state,
        // but we read again to get the value synchronously for this closure)
        const chainId = await publicClient.getChainId()
        const hex = AccAddress.toHex(initiaAddress)
        const ownerAddr = (hex.startsWith('0x') ? hex : `0x${hex}`) as `0x${string}`
        const tid = await publicClient.readContract({
          address: contracts.playerProfile.address,
          abi: contracts.playerProfile.abi,
          functionName: 'ownerToTokenId',
          args: [ownerAddr],
        }) as bigint
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
        const faucetRes = await fetch('/api/faucet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tba: tbaAddr }),
        })
        if (!faucetRes.ok) {
          const errBody = await faucetRes.json().catch(() => ({}))
          console.warn('Auto-faucet returned error:', faucetRes.status, errBody)
          // Retry once after a short delay
          await new Promise(r => setTimeout(r, 2000))
          const retry = await fetch('/api/faucet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tba: tbaAddr }),
          })
          if (!retry.ok) {
            console.error('Auto-faucet retry also failed — user can claim from Dashboard')
          }
        }
      } catch (faucetErr) {
        console.warn('Auto-faucet failed (tokens can be claimed from Dashboard):', faucetErr)
      }
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
    error,
    refetch: fetchProfile,
    mint,
  }
}
