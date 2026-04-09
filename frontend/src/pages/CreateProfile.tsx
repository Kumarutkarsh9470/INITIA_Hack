import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import toast from 'react-hot-toast'

export default function CreateProfile() {
  const { initiaAddress, openConnect } = useInterwovenKit()
  const { hasProfile, isLoading, mint } = usePlayerProfile()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [isMinting, setIsMinting] = useState(false)

  // Already has profile → redirect
  if (!isLoading && hasProfile) {
    navigate('/profile', { replace: true })
    return null
  }

  const handleMint = async () => {
    if (username.length < 3 || username.length > 20) {
      toast.error('Username must be 3-20 characters')
      return
    }

    setIsMinting(true)
    try {
      await mint(username)
      toast.success('Profile created!')
      navigate('/profile')
    } catch (error: any) {
      console.error('Mint error:', error)
      toast.error(error?.message?.slice(0, 100) || 'Failed to create profile')
    } finally {
      setIsMinting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl border border-gray-700 p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Create Your Profile</h1>
          <p className="text-gray-400 mt-2">
            Mint your player identity NFT. This creates your Token Bound Account (TBA)
            — a wallet that holds all your game assets.
          </p>
        </div>

        {!initiaAddress ? (
          <button
            onClick={openConnect}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Connect Wallet First
          </button>
        ) : (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="AliceGamer"
                maxLength={20}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-gray-500 text-xs mt-1">3-20 characters</p>
            </div>

            <button
              onClick={handleMint}
              disabled={isMinting || isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {isMinting ? 'Creating...' : 'Mint Profile NFT'}
            </button>
          </>
        )}

        <p className="text-gray-500 text-xs text-center">
          This is a one-time action. You can only mint one profile per wallet.
        </p>
      </div>
    </div>
  )
}
