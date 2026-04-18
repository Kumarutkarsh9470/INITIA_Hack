import { useState, useEffect } from 'react'
import { formatEther } from 'viem'
import { Link } from 'react-router-dom'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import toast from 'react-hot-toast'

type GameInfo = {
  id: string
  name: string
  developer: string
  totalVolume: bigint
  uniquePlayers: number
  rating: number
  active: boolean
}

export default function GameHub() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()

  const [games, setGames] = useState<GameInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!tba) return

    const fetchGames = async () => {
      setIsLoading(true)
      try {
        const countRaw = await publicClient.readContract({
          address: contracts.gameRegistry.address,
          abi: contracts.gameRegistry.abi,
          functionName: 'getGameCount',
        })
        const count = Number(countRaw)
        const fetchedGames: GameInfo[] = []

        for (let i = 0; i < count; i++) {
          const gameId = (await publicClient.readContract({
            address: contracts.gameRegistry.address,
            abi: contracts.gameRegistry.abi,
            functionName: 'gameIds',
            args: [BigInt(i)],
          })) as string

          const gameData = (await publicClient.readContract({
            address: contracts.gameRegistry.address,
            abi: contracts.gameRegistry.abi,
            functionName: 'games',
            args: [gameId],
          })) as any

          const ratingRaw = (await publicClient.readContract({
            address: contracts.gameRegistry.address,
            abi: contracts.gameRegistry.abi,
            functionName: 'getGameRating',
            args: [gameId],
          })) as bigint

          if (gameData[8] === true) {
            fetchedGames.push({
              id: gameId,
              name: gameData[3],
              developer: gameData[2],
              totalVolume: gameData[5],
              uniquePlayers: Number(gameData[6]),
              rating: Number(ratingRaw) / 100,
              active: gameData[8],
            })
          }
        }

        setGames(fetchedGames)
      } catch (error) {
        console.error('Error fetching game hub data:', error)
        toast.error('Failed to load Game Hub')
      } finally {
        setIsLoading(false)
      }
    }

    fetchGames()
  }, [tba, contracts])

  const getGameRoute = (name: string) => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes('dungeon')) return '/dungeon'
    if (lowerName.includes('harvest')) return '/harvest'
    if (lowerName.includes('cosmic')) return '/cosmic'
    return '/games'
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Game Registry</h1>
        <p className="text-surface-500 text-sm mt-1">
          {games.length} games connected to the shared PixelVault economy
        </p>
      </div>

      {/* Protocol Stats */}
      {!isLoading && games.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card px-4 py-3 text-center">
            <p className="stat-label">Registered Games</p>
            <p className="text-xl font-bold text-surface-900">{games.length}</p>
          </div>
          <div className="card px-4 py-3 text-center">
            <p className="stat-label">Total Players</p>
            <p className="text-xl font-bold text-surface-900">{games.reduce((a, g) => a + g.uniquePlayers, 0)}</p>
          </div>
          <div className="card px-4 py-3 text-center">
            <p className="stat-label">Total Volume</p>
            <p className="text-xl font-bold text-surface-900">{parseFloat(formatEther(games.reduce((a, g) => a + g.totalVolume, 0n))).toFixed(0)} PXL</p>
          </div>
          <div className="card px-4 py-3 text-center">
            <p className="stat-label">Shared Infra</p>
            <p className="text-xl font-bold text-surface-900">DEX · Market · Gas</p>
          </div>
        </div>
      )}

      {/* Cross-game economy flow */}
      <div className="card p-5">
        <p className="stat-label text-center mb-3">How It Works</p>
        <div className="flex items-center justify-center gap-2 text-xs flex-wrap">
          <span className="px-2.5 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 font-medium">Game registers</span>
          <span className="text-surface-300">→</span>
          <span className="px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-medium">Gets token + items</span>
          <span className="text-surface-300">→</span>
          <span className="px-2.5 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 font-medium">DEX pool auto-created</span>
          <span className="text-surface-300">→</span>
          <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">Cross-game trade</span>
        </div>
        <p className="text-xs text-surface-400 text-center mt-2">Every game connects to the same DEX, Marketplace, Gas Paymaster, and Achievement system</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">{games.length} games available</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse h-24 bg-surface-100 rounded-xl" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-surface-400">No active games found in the registry.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game, i) => (
              <div
                key={game.id}
                className="flex items-center justify-between bg-surface-50 rounded-xl px-5 py-4 border border-surface-100 hover:border-surface-300 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-200 flex items-center justify-center text-sm font-bold text-surface-600">
                    {game.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-surface-900">{game.name}</p>
                    <p className="text-surface-400 text-xs mt-0.5">
                      {game.uniquePlayers} players · {parseFloat(formatEther(game.totalVolume)).toFixed(1)} PXL volume
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={`text-sm ${star <= game.rating ? 'text-amber-400' : 'text-surface-200'}`}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    to={getGameRoute(game.name)}
                    className="btn-primary text-sm py-2 px-5"
                  >
                    Play
                  </Link>
                </div>
              </div>
            ))}

            {/* Coming Soon card */}
            <div className="flex items-center justify-between bg-surface-50/60 rounded-xl px-5 py-4 border border-dashed border-surface-300">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-surface-100 border border-dashed border-surface-300 flex items-center justify-center text-sm text-surface-400">
                  +
                </div>
                <div>
                  <p className="font-semibold text-surface-500">Your Game Here</p>
                  <p className="text-surface-400 text-xs mt-0.5">
                    Register via GameRegistry to join the ecosystem
                  </p>
                </div>
              </div>
              <Link to="/how-it-works" className="text-sm text-brand-600 hover:text-brand-700 font-medium py-2 px-5">
                Learn More →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}