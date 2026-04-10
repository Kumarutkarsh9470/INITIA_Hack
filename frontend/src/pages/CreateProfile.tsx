import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (!isLoading && hasProfile) {
      navigate('/profile', { replace: true })
    }
  }, [isLoading, hasProfile, navigate])

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
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full card p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-900 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
            PV
          </div>
          <h1 className="page-title text-2xl">Create Your Profile</h1>
          <p className="text-surface-500 text-sm mt-2 leading-relaxed">
            Mint your player identity NFT to create your Token Bound Account — a single wallet for all your game assets.
          </p>
        </div>

        {!initiaAddress ? (
          <button onClick={openConnect} className="btn-primary w-full">
            Connect Wallet First
          </button>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                maxLength={20}
                className="input-field"
              />
              <p className="text-surface-400 text-xs mt-1.5">3-20 characters</p>
            </div>

            <button
              onClick={handleMint}
              disabled={isMinting || isLoading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMinting ? 'Creating...' : 'Mint Profile NFT'}
            </button>
          </>
        )}

        <p className="text-surface-400 text-xs text-center">
          One-time action. One profile per wallet.
        </p>
      </div>
    </div>
  )
}
