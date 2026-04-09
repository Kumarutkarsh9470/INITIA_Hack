import { useState, useCallback } from 'react'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { usePlayerProfile } from './usePlayerProfile'

/**
 * Wraps InterwovenKit session key functionality.
 * When a session is active, transactions auto-sign without wallet popups.
 * Session is scoped to the TBA address and expires after 1 hour.
 */
export function useAutoSign() {
  const { requestSession, revokeSession: revokeKit } = useInterwovenKit() as any
  const { tba } = usePlayerProfile()
  const [isSessionActive, setIsSessionActive] = useState(false)

  const grantSession = useCallback(async () => {
    try {
      await requestSession?.()
      setIsSessionActive(true)
    } catch (error) {
      console.error('Failed to grant session:', error)
    }
  }, [requestSession])

  const revokeSession = useCallback(async () => {
    try {
      await revokeKit?.()
      setIsSessionActive(false)
    } catch (error) {
      console.error('Failed to revoke session:', error)
    }
  }, [revokeKit])

  return {
    grantSession,
    isSessionActive,
    revokeSession,
  }
}
