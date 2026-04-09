/**
 * DungeonDrops.tsx — TEAMMATE A BUILDS THIS
 *
 * See the Builder Guide for full instructions and AI prompt.
 * Use ProfileDashboard.tsx as your reference for all patterns.
 *
 * Contract: DungeonDrops at ADDRESSES.DungeonDrops
 * Token: DNGN at ADDRESSES.DungeonDropsToken
 * Items: ERC1155 at ADDRESSES.DungeonDropsAssets (IDs 1-3)
 *
 * Key functions:
 *   Read: totalRuns(), playerNonce(tba)
 *   Write (via TBA): enterDungeon()
 *   Event: DungeonEntered(player, itemId, roll)
 */
import { Link } from 'react-router-dom'

export default function DungeonDrops() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">⚔️ Dungeon Drops</h1>
        <p className="text-gray-400">
          This screen is waiting to be built. See the Builder Guide for the
          full spec and AI prompt.
        </p>
        <p className="text-gray-500 text-sm">
          Pay 10 DNGN → Roll for loot → Items land in your TBA
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
