import { Navigate } from 'react-router-dom'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { usePlayerProfile } from '../hooks/usePlayerProfile'

interface Props {
  children: React.ReactNode
}

/**
 * Route guard: redirects to /create-profile if the wallet hasn't minted a profile yet.
 * Redirects to / (landing) if wallet is not connected.
 * Shows error state if RPC is unreachable (instead of wrongly redirecting).
 */
export function ProfileGate({ children }: Props) {
  const { initiaAddress } = useInterwovenKit()
  const { hasProfile, isLoading, error, refetch } = usePlayerProfile()

  if (!initiaAddress) {
    return <Navigate to="/" replace />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-surface-300 border-t-surface-900 rounded-full animate-spin" />
          <p className="text-surface-500 text-sm">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50">
        <div className="max-w-sm w-full mx-4 card p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-surface-900">Network Error</h2>
          <p className="text-sm text-surface-500">{error}</p>
          <button
            onClick={refetch}
            className="btn-primary w-full"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!hasProfile) {
    return <Navigate to="/create-profile" replace />
  }

  return <>{children}</>
}
