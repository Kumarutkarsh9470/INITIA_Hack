import { useInterwovenKit } from '@initia/interwovenkit-react'
import { useNavigate } from 'react-router-dom'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useEffect } from 'react'

export default function Landing() {
  const { initiaAddress, openConnect } = useInterwovenKit()
  const { hasProfile, isLoading } = usePlayerProfile()
  const navigate = useNavigate()

  // If already connected + has profile, go to dashboard
  useEffect(() => {
    if (initiaAddress && !isLoading && hasProfile) {
      navigate('/profile')
    }
  }, [initiaAddress, hasProfile, isLoading, navigate])

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h1 className="text-5xl font-bold text-white mb-2">PixelVault</h1>
          <p className="text-gray-400 text-lg">
            Cross-game player economy on Initia
          </p>
        </div>

        <div className="space-y-4 text-gray-300 text-sm">
          <p>One identity. One wallet. Every game.</p>
          <p>
            Mint your player profile, earn items across games, trade on the
            marketplace, and never worry about gas tokens.
          </p>
        </div>

        {!initiaAddress ? (
          <button
            onClick={openConnect}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Connect Wallet
          </button>
        ) : (
          <button
            onClick={() => navigate('/create-profile')}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Get Started
          </button>
        )}
      </div>
    </div>
  )
}
