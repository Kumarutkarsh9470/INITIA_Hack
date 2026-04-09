/**
 * DEX.tsx — TEAMMATE B BUILDS THIS
 *
 * See the Builder Guide for full instructions and AI prompt.
 * Use ProfileDashboard.tsx as your reference for all patterns.
 *
 * Contract: PixelVaultDEX at ADDRESSES.PixelVaultDEX
 *
 * Key functions:
 *   Read: pools(gameId), getPrice(gameId)
 *   Write (via TBA): approve + swapPXLForGame / swapGameForPXL
 *   Bridge: openBridge() from InterwovenKit
 *
 * Remember: gameId is bytes32. Use DUNGEON_GAME_ID / HARVEST_GAME_ID from constants.
 */
import { Link } from 'react-router-dom'

export default function DEX() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">💱 DEX</h1>
        <p className="text-gray-400">
          This screen is waiting to be built. See the Builder Guide for the
          full spec and AI prompt.
        </p>
        <p className="text-gray-500 text-sm">
          Swap PXL ↔ game tokens · Pool info · Bridge button
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
