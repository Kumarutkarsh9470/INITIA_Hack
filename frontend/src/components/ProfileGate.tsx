import { Navigate } from 'react-router-dom'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { usePlayerProfile } from '../hooks/usePlayerProfile'

interface Props {
  children: React.ReactNode
}

/**
 * Route guard: redirects to /create-profile if the wallet hasn't minted a profile yet.
 * Redirects to / (landing) if wallet is not connected.
 * Wrap any page that requires a profile NFT.
 */
export function ProfileGate({ children }: Props) {
  const { initiaAddress } = useInterwovenKit()
  const { hasProfile, isLoading } = usePlayerProfile()

  if (!initiaAddress) {
    return <Navigate to="/" replace />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-gray-400 text-lg">Loading profile...</div>
      </div>
    )
  }

  if (!hasProfile) {
    return <Navigate to="/create-profile" replace />
  }

  return <>{children}</>
}
