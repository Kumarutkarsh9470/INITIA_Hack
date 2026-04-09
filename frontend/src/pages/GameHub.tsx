/**
 * GameHub.tsx — whoever finishes first builds this
 *
 * See the Builder Guide for full instructions and AI prompt.
 * Use ProfileDashboard.tsx as your reference for all patterns.
 *
 * Contract: GameRegistry at ADDRESSES.GameRegistry
 *
 * Key functions:
 *   Read: getGameCount(), gameIds(index), games(gameId), getGameRating(gameId)
 *   UI: game cards with name, star rating, volume, player count, play button
 */
import { Link } from 'react-router-dom'

export default function GameHub() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">🎮 Game Hub</h1>
        <p className="text-gray-400">
          This screen is waiting to be built. See the Builder Guide for the
          full spec and AI prompt.
        </p>
        <p className="text-gray-500 text-sm">
          Game directory · Ratings · Volume · Player counts
        </p>
        <Link
          to="/profile"
          className="inline-block mt-4 text-indigo-400 hover:text-indigo-300"
        >
          ← Back to Profile
        </Link>
      </div>
    </div>
  )
}
