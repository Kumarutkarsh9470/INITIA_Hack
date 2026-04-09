/**
 * HarvestField.tsx — TEAMMATE A or B BUILDS THIS
 *
 * See the Builder Guide for full instructions and AI prompt.
 * Use ProfileDashboard.tsx as your reference for all patterns.
 *
 * Contract: HarvestField at ADDRESSES.HarvestField
 * Token: HRV at ADDRESSES.HarvestFieldToken
 * Items: ERC1155 at ADDRESSES.HarvestFieldAssets (ID 1)
 *
 * Key functions:
 *   Read: stakes(tba) → [amount, stakedAtBlock]
 *   Write (via TBA): stake(amount), harvest(), unstake()
 *   3 UI states: no stake, staking (progress bar), ready to harvest
 */
import { Link } from 'react-router-dom'

export default function HarvestField() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">🌾 Harvest Field</h1>
        <p className="text-gray-400">
          This screen is waiting to be built. See the Builder Guide for the
          full spec and AI prompt.
        </p>
        <p className="text-gray-500 text-sm">
          Stake HRV → Wait 100 blocks → Harvest reward + seasonal item
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
