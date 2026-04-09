/**
 * ProfileDashboard.tsx — THE REFERENCE SCREEN
 *
 * Every other page in the app follows the same patterns used here.
 * When building a new screen, open this file side-by-side and copy the
 * patterns: imports, hooks, readContract calls, Tailwind classes, etc.
 */
import { useState, useEffect } from 'react'
import { formatEther } from 'viem'
import { useNavigate, Link } from 'react-router-dom'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useAutoSign } from '../hooks/useAutoSign'
import { ADDRESSES } from '../lib/addresses'
import { DUNGEON_ITEMS, HARVEST_ITEMS, BADGE_NAMES } from '../lib/constants'
import toast from 'react-hot-toast'

export default function ProfileDashboard() {
  const navigate = useNavigate()
  const { openWallet } = useInterwovenKit()
  const { tokenId, tba, username, reputation, refetch } = usePlayerProfile()
  const { isSessionActive, grantSession, revokeSession } = useAutoSign()
  const contracts = useContracts()

  // ---------- Token balances ----------
  const [pxlBalance, setPxlBalance] = useState(0n)
  const [dngnBalance, setDngnBalance] = useState(0n)
  const [hrvBalance, setHrvBalance] = useState(0n)

  // ---------- Item balances (ERC1155) ----------
  const [dungeonItems, setDungeonItems] = useState<Record<number, bigint>>({})
  const [harvestItems, setHarvestItems] = useState<Record<number, bigint>>({})

  // ---------- Badges ----------
  const [badges, setBadges] = useState<Record<number, bigint>>({})

  // ---------- Loading ----------
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    if (!tba) return

    const fetchAll = async () => {
      setIsLoadingData(true)
      try {
        // --- ERC20 balances ---
        const [pxl, dngn, hrv] = await Promise.all([
          publicClient.readContract({
            address: contracts.pxlToken.address,
            abi: contracts.pxlToken.abi,
            functionName: 'balanceOf',
            args: [tba],
          }),
          publicClient.readContract({
            address: contracts.dungeonDropsToken.address,
            abi: contracts.dungeonDropsToken.abi,
            functionName: 'balanceOf',
            args: [tba],
          }),
          publicClient.readContract({
            address: contracts.harvestFieldToken.address,
            abi: contracts.harvestFieldToken.abi,
            functionName: 'balanceOf',
            args: [tba],
          }),
        ])
        setPxlBalance(pxl as bigint)
        setDngnBalance(dngn as bigint)
        setHrvBalance(hrv as bigint)

        // --- ERC1155 item balances (dungeon items 1-3) ---
        const dItems: Record<number, bigint> = {}
        for (const id of [1, 2, 3]) {
          const bal = (await publicClient.readContract({
            address: contracts.dungeonDropsAssets.address,
            abi: contracts.dungeonDropsAssets.abi,
            functionName: 'balanceOf',
            args: [tba, BigInt(id)],
          })) as bigint
          dItems[id] = bal
        }
        setDungeonItems(dItems)

        // --- ERC1155 item balances (harvest item 1) ---
        const hItems: Record<number, bigint> = {}
        const hBal = (await publicClient.readContract({
          address: contracts.harvestFieldAssets.address,
          abi: contracts.harvestFieldAssets.abi,
          functionName: 'balanceOf',
          args: [tba, 1n],
        })) as bigint
        hItems[1] = hBal
        setHarvestItems(hItems)

        // --- Badge balances (badge IDs 1-2) ---
        const b: Record<number, bigint> = {}
        for (const id of [1, 2]) {
          const bal = (await publicClient.readContract({
            address: contracts.achievementBadge.address,
            abi: contracts.achievementBadge.abi,
            functionName: 'balanceOf',
            args: [tba, BigInt(id)],
          })) as bigint
          b[id] = bal
        }
        setBadges(b)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        toast.error('Failed to load some dashboard data')
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchAll()
  }, [tba, contracts])

  const truncate = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{username}</h1>
            <p className="text-gray-400 text-sm">
              Profile #{tokenId.toString()} · TBA:{' '}
              <span className="font-mono">{tba ? truncate(tba) : '...'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-sign indicator */}
            {isSessionActive ? (
              <button
                onClick={revokeSession}
                className="bg-green-600/20 text-green-400 border border-green-600/30 px-3 py-1 rounded-full text-sm"
              >
                Auto-sign ON
              </button>
            ) : (
              <button
                onClick={grantSession}
                className="bg-gray-700 text-gray-300 border border-gray-600 px-3 py-1 rounded-full text-sm hover:bg-gray-600"
              >
                Enable Auto-sign
              </button>
            )}
            <button
              onClick={openWallet}
              className="bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-sm hover:bg-gray-600"
            >
              Wallet
            </button>
          </div>
        </div>

        {/* ---- Reputation ---- */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-2">Reputation</h2>
          <p className="text-4xl font-bold text-indigo-400">
            {reputation.toString()} pts
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Earned from badges and unique game participation
          </p>
        </div>

        {/* ---- Token Balances ---- */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Token Balances</h2>
          {isLoadingData ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-700 rounded w-1/3" />
              <div className="h-4 bg-gray-700 rounded w-1/4" />
              <div className="h-4 bg-gray-700 rounded w-1/3" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <TokenCard label="PXL" balance={pxlBalance} />
              <TokenCard label="DNGN" balance={dngnBalance} />
              <TokenCard label="HRV" balance={hrvBalance} />
            </div>
          )}
        </div>

        {/* ---- Items ---- */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Inventory</h2>
          {isLoadingData ? (
            <div className="animate-pulse h-16 bg-gray-700 rounded" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(DUNGEON_ITEMS).map(([id, name]) => (
                <ItemCard
                  key={`d-${id}`}
                  name={name}
                  count={dungeonItems[Number(id)] ?? 0n}
                  game="Dungeon"
                />
              ))}
              {Object.entries(HARVEST_ITEMS).map(([id, name]) => (
                <ItemCard
                  key={`h-${id}`}
                  name={name}
                  count={harvestItems[Number(id)] ?? 0n}
                  game="Harvest"
                />
              ))}
            </div>
          )}
        </div>

        {/* ---- Badges ---- */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Badges</h2>
          {isLoadingData ? (
            <div className="animate-pulse h-12 bg-gray-700 rounded" />
          ) : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(BADGE_NAMES).map(([id, name]) => {
                const earned = (badges[Number(id)] ?? 0n) > 0n
                return (
                  <div
                    key={id}
                    className={`px-4 py-2 rounded-lg border text-sm ${
                      earned
                        ? 'bg-yellow-600/20 border-yellow-600/40 text-yellow-300'
                        : 'bg-gray-700/50 border-gray-600 text-gray-500'
                    }`}
                  >
                    {earned ? '★ ' : '☆ '}
                    {name}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ---- Quick Nav ---- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <NavButton to="/dungeon" label="Dungeon Drops" emoji="⚔️" />
          <NavButton to="/harvest" label="Harvest Field" emoji="🌾" />
          <NavButton to="/dex" label="DEX" emoji="💱" />
          <NavButton to="/marketplace" label="Marketplace" emoji="🏪" />
          <NavButton to="/gas" label="Gas Settings" emoji="⛽" />
          <NavButton to="/games" label="Game Hub" emoji="🎮" />
        </div>
      </div>
    </div>
  )
}

// ---- Small helper components (kept in same file for simplicity) ----

function TokenCard({ label, balance }: { label: string; balance: bigint }) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-4 text-center">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-xl font-semibold mt-1">
        {parseFloat(formatEther(balance)).toFixed(2)}
      </p>
    </div>
  )
}

function ItemCard({
  name,
  count,
  game,
}: {
  name: string
  count: bigint
  game: string
}) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-3">
      <p className="text-sm font-medium">{name}</p>
      <p className="text-gray-400 text-xs">{game}</p>
      <p className="text-lg font-semibold mt-1">×{count.toString()}</p>
    </div>
  )
}

function NavButton({
  to,
  label,
  emoji,
}: {
  to: string
  label: string
  emoji: string
}) {
  return (
    <Link
      to={to}
      className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl p-4 text-center transition-colors"
    >
      <span className="text-2xl block mb-1">{emoji}</span>
      <span className="text-sm text-gray-300">{label}</span>
    </Link>
  )
}
