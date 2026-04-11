import { useMemo } from 'react'
import { useInterwovenKit } from '@initia/interwovenkit-react'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID

/**
 * Checks whether InterwovenKit auto-sign is currently active for the app chain.
 * When enabled, transactions matching allowed typeUrls (MsgCall) sign automatically
 * without wallet popup. Users enable/disable auto-sign from the wallet drawer.
 *
 * To toggle: call openWallet() — the wallet drawer has an auto-sign section.
 */
export function useAutoSign() {
  const { autoSign, openWallet } = useInterwovenKit() as any

  // Check if auto-sign is active by testing with a dummy MsgCall
  const isSessionActive = useMemo(() => {
    if (!autoSign || typeof autoSign !== 'function') return false
    try {
      return autoSign(CHAIN_ID, [{ typeUrl: '/minievm.evm.v1.MsgCall' }])
    } catch {
      return false
    }
  }, [autoSign])

  return {
    grantSession: openWallet, // Opens wallet drawer where user can enable auto-sign
    isSessionActive,
    revokeSession: openWallet, // Opens wallet drawer where user can disable auto-sign
  }
}
