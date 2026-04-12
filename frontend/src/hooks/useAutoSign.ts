import { useCallback } from 'react'
import { useInterwovenKit } from '@initia/interwovenkit-react'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID

/**
 * Auto-sign hook using InterwovenKit's real autoSign API.
 *
 * autoSign (from useInterwovenKit) returns:
 *   { enable(chainId), disable(chainId), isEnabledByChain, isLoading }
 *
 * enable() opens a drawer page where the user confirms auto-sign setup
 * (creates a derived wallet + feegrant on-chain).
 * disable() revokes the feegrant.
 *
 * Requires a working Cosmos REST API for account lookups.
 */
export function useAutoSign() {
  const { autoSign } = useInterwovenKit() as any

  const isEnabled = autoSign?.isEnabledByChain?.[CHAIN_ID] ?? false
  const isLoading = autoSign?.isLoading ?? false

  const enable = useCallback(async () => {
    if (!autoSign?.enable) return
    try {
      await autoSign.enable(CHAIN_ID)
    } catch (e: any) {
      // User cancelled — not an error
      if (e?.message?.includes('cancelled')) return
      console.error('Auto-sign enable failed:', e)
    }
  }, [autoSign])

  const disable = useCallback(async () => {
    if (!autoSign?.disable) return
    try {
      await autoSign.disable(CHAIN_ID)
    } catch (e: any) {
      console.error('Auto-sign disable failed:', e)
    }
  }, [autoSign])

  return { isEnabled, isLoading, enable, disable }
}
