import { useState, useEffect, useCallback, useMemo } from 'react'
import { formatEther, parseEther, encodeFunctionData } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import { DUNGEON_ITEMS, HARVEST_ITEMS, COSMIC_ITEMS } from '../lib/constants'
import toast from 'react-hot-toast'

type Listing = { id: bigint; seller: string; collection: string; itemId: bigint; amount: bigint; priceInPXL: bigint; gameId: string; active: boolean }
type InventoryItem = { collection: `0x${string}`; gameName: string; gameId: `0x${string}`; itemId: number; itemName: string; balance: bigint }
interface RegisteredGame { gameId: `0x${string}`; name: string; symbol: string; tokenAddress: `0x${string}`; assetCollection: `0x${string}` }

// Combined item name lookup per collection address (populated dynamically)
const KNOWN_ITEMS: Record<string, Record<number, string>> = {}
function registerKnownItems(collection: string, symbol: string) {
  const c = collection.toLowerCase()
  if (symbol === 'DNGN') KNOWN_ITEMS[c] = DUNGEON_ITEMS
  else if (symbol === 'HRV') KNOWN_ITEMS[c] = HARVEST_ITEMS
  else if (symbol === 'RACE') KNOWN_ITEMS[c] = COSMIC_ITEMS
}

function ammEstimate(amtIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amtIn === 0n) return 0n
  const amtInWithFee = amtIn * 997n
  return (amtInWithFee * reserveOut) / (reserveIn * 1000n + amtInWithFee)
}

export default function Marketplace() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, isPending } = useTBA()

  const [activeTab, setActiveTab] = useState<'browse' | 'list'>('browse')
  const [gameFilter, setGameFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [games, setGames] = useState<RegisteredGame[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [listAmount, setListAmount] = useState('1')
  const [listPricePXL, setListPricePXL] = useState('')

  const fetchData = async () => {
    if (!tba) return
    setIsLoading(true)
    try {
      // Fetch registered games from GameRegistry
      const countRaw = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameCount' })
      const count = Number(countRaw)
      const fetchedGames: RegisteredGame[] = []
      for (let i = 0; i < count; i++) {
        const gameId = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'gameIds', args: [BigInt(i)] }) as `0x${string}`
        const data = await publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'games', args: [gameId] }) as any
        if (data[8] === true) {
          const game: RegisteredGame = { gameId, name: data[3], symbol: data[4], tokenAddress: data[0], assetCollection: data[1] }
          fetchedGames.push(game)
          registerKnownItems(game.assetCollection, game.symbol)
        }
      }
      setGames(fetchedGames)

      // Fetch marketplace listings
      const nextIdRaw = await publicClient.readContract({ address: contracts.marketplace.address, abi: contracts.marketplace.abi, functionName: 'nextListingId' })
      const nextId = Number(nextIdRaw)
      const fetchedListings: Listing[] = []
      for (let i = 0; i < nextId; i++) {
        const listing = (await publicClient.readContract({ address: contracts.marketplace.address, abi: contracts.marketplace.abi, functionName: 'listings', args: [BigInt(i)] })) as any
        if (listing[6] === true) {
          fetchedListings.push({ id: BigInt(i), seller: listing[0], collection: listing[1], itemId: listing[2], amount: listing[3], priceInPXL: listing[4], gameId: listing[5], active: listing[6] })
        }
      }
      setListings(fetchedListings)

      // Fetch inventory across all game asset collections (check items 1-5)
      const userInv: InventoryItem[] = []
      const erc1155Abi = contracts.dungeonDropsAssets.abi
      for (const game of fetchedGames) {
        const items = KNOWN_ITEMS[game.assetCollection.toLowerCase()] ?? {}
        const maxItem = Math.max(...Object.keys(items).map(Number), 5)
        for (let id = 1; id <= maxItem; id++) {
          try {
            const bal = (await publicClient.readContract({ address: game.assetCollection, abi: erc1155Abi, functionName: 'balanceOf', args: [tba, BigInt(id)] })) as bigint
            if (bal > 0n) {
              userInv.push({
                collection: game.assetCollection,
                gameName: game.name,
                gameId: game.gameId,
                itemId: id,
                itemName: items[id] ?? `Item #${id}`,
                balance: bal,
              })
            }
          } catch { /* item doesn't exist */ }
        }
      }
      setInventory(userInv)
    } catch (error) {
      console.error('Error fetching marketplace data:', error)
      toast.error('Failed to load marketplace data')
    } finally { setIsLoading(false) }
  }

  useEffect(() => { fetchData() }, [tba, contracts])

  // Build game lookup maps
  const gameByCollection = useMemo(() => {
    const m = new Map<string, RegisteredGame>()
    games.forEach(g => m.set(g.assetCollection.toLowerCase(), g))
    return m
  }, [games])
  const gameById = useMemo(() => {
    const m = new Map<string, RegisteredGame>()
    games.forEach(g => m.set(g.gameId, g))
    return m
  }, [games])

  const filteredListings = useMemo(() => {
    if (gameFilter === 'all') return listings
    return listings.filter(l => l.gameId === gameFilter)
  }, [listings, gameFilter])

  const handleBuy = async (listing: Listing, buyAmount?: bigint) => {
    if (!tba) return toast.error('Wallet not connected')
    const qty = buyAmount ?? listing.amount
    const totalCost = listing.priceInPXL * qty
    try {
      toast.loading('Approving PXL...', { id: 'buy-toast' })
      await execute(contracts.pxlToken.address, 0n,
        encodeFunctionData({ abi: contracts.pxlToken.abi, functionName: 'approve', args: [contracts.marketplace.address, totalCost] }))
      toast.loading('Purchasing item...', { id: 'buy-toast' })
      await execute(contracts.marketplace.address, 0n,
        encodeFunctionData({ abi: contracts.marketplace.abi, functionName: 'buyItem', args: [listing.id, qty, contracts.pxlToken.address, totalCost] }))
      toast.success('Purchase successful!', { id: 'buy-toast' })
      fetchData()
    } catch (error: any) {
      console.error('Buy failed:', error)
      const msg = error?.message?.includes('Reverted') ? 'Transaction reverted — you may not have enough PXL' : 'Transaction failed'
      toast.error(msg, { id: 'buy-toast' })
    }
  }

  const handleList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || !listAmount || !listPricePXL || !tba) return
    const amountToItems = BigInt(listAmount)
    const priceWei = parseEther(listPricePXL)
    if (amountToItems <= 0n || amountToItems > selectedItem.balance) return toast.error('Invalid amount')
    try {
      const isApproved = await publicClient.readContract({ address: selectedItem.collection as `0x${string}`, abi: contracts.dungeonDropsAssets.abi, functionName: 'isApprovedForAll', args: [tba, contracts.marketplace.address] })
      if (!isApproved) {
        toast.loading('Approving Asset Collection...', { id: 'list-toast' })
        await execute(selectedItem.collection, 0n,
          encodeFunctionData({ abi: contracts.dungeonDropsAssets.abi, functionName: 'setApprovalForAll', args: [contracts.marketplace.address, true] }))
      }
      toast.loading('Creating listing...', { id: 'list-toast' })
      await execute(contracts.marketplace.address, 0n,
        encodeFunctionData({ abi: contracts.marketplace.abi, functionName: 'listItem', args: [selectedItem.collection, BigInt(selectedItem.itemId), amountToItems, priceWei, selectedItem.gameId] }))
      toast.success('Item listed successfully!', { id: 'list-toast' })
      setSelectedItem(null); setListAmount('1'); setListPricePXL(''); fetchData()
    } catch (error) {
      console.error('Listing failed:', error)
      toast.error('Failed to list item', { id: 'list-toast' })
    }
  }

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`
  const getItemName = (collection: string, id: bigint) => {
    const items = KNOWN_ITEMS[collection.toLowerCase()]
    return items?.[Number(id)] ?? `Item #${id}`
  }
  const getGameName = (gameId: string) => {
    return gameById.get(gameId)?.name ?? 'Unknown Game'
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="page-title">Marketplace</h1>
        <p className="text-surface-500 text-sm mt-0.5">Buy and sell in-game items for PXL tokens</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-100 rounded-xl p-1 gap-1 max-w-xs">
        {(['browse', 'list'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors
              ${activeTab === t ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
            {t === 'browse' ? 'Browse' : 'Sell Items'}
          </button>
        ))}
      </div>

      {/* BROWSE TAB */}
      {activeTab === 'browse' && (
        <div>
          {/* Game Filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setGameFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
                ${gameFilter === 'all'
                  ? 'bg-brand-50 border-brand-200 text-brand-700'
                  : 'bg-surface-50 border-surface-200 text-surface-500 hover:text-surface-700'}`}>
              All Games
            </button>
            {games.map(g => (
              <button key={g.gameId} onClick={() => setGameFilter(g.gameId)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
                  ${gameFilter === g.gameId
                    ? 'bg-brand-50 border-brand-200 text-brand-700'
                    : 'bg-surface-50 border-surface-200 text-surface-500 hover:text-surface-700'}`}>
                {g.name}
                <span className="ml-1.5 text-xs opacity-60">
                  ({listings.filter(l => l.gameId === g.gameId).length})
                </span>
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-40 bg-surface-100 rounded-xl" />)}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-16 card">
              <p className="text-surface-400 text-sm">No active listings{gameFilter !== 'all' ? ' for this game' : ''}.</p>
              <p className="text-surface-300 text-xs mt-1">Play games to earn items, then list them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredListings.map((listing, i) => {
                return (
                <div key={listing.id.toString()} className="card-hover p-5 flex flex-col justify-between animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-surface-900">{getItemName(listing.collection, listing.itemId)}</h3>
                      <span className="badge">Qty: {listing.amount.toString()}</span>
                    </div>
                    <p className="text-sm text-surface-500">{getGameName(listing.gameId)}</p>
                    <p className="text-xs text-surface-400 mt-0.5">Seller: {truncate(listing.seller)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-100">
                    <div>
                      <p className="stat-label">Price per item</p>
                      <p className="font-bold text-brand-600">{formatEther(listing.priceInPXL)} PXL</p>
                      {listing.amount > 1n && (
                        <p className="text-xs text-surface-400">Total: {formatEther(listing.priceInPXL * listing.amount)} PXL</p>
                      )}
                    </div>
                    <button onClick={() => handleBuy(listing)}
                      disabled={isPending || listing.seller.toLowerCase() === tba?.toLowerCase()}
                      className="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {listing.seller.toLowerCase() === tba?.toLowerCase() ? 'Your Listing' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* LIST TAB */}
      {activeTab === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inventory */}
          <div className="card p-5">
            <h2 className="section-title mb-4">Your Inventory</h2>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-16 bg-surface-100 rounded-xl" />
                <div className="h-16 bg-surface-100 rounded-xl" />
              </div>
            ) : inventory.length === 0 ? (
              <p className="text-surface-400 text-sm py-8 text-center">No items to sell. Play games to earn items.</p>
            ) : (
              <div className="space-y-2">
                {inventory.map((item, idx) => (
                  <button key={idx} onClick={() => setSelectedItem(item)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors flex justify-between items-center
                      ${selectedItem?.itemId === item.itemId && selectedItem?.collection === item.collection
                        ? 'bg-brand-50 border-brand-200'
                        : 'bg-surface-50 border-surface-200 hover:bg-surface-100'}`}>
                    <div>
                      <p className="font-medium text-surface-900">{item.itemName}</p>
                      <p className="text-xs text-surface-400">{item.gameName}</p>
                    </div>
                    <span className="badge">Own: {item.balance.toString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Listing form */}
          <div className="card p-5">
            <h2 className="section-title mb-4">Create Listing</h2>
            {!selectedItem ? (
              <div className="flex items-center justify-center text-surface-400 text-sm py-16">
                Select an item from your inventory.
              </div>
            ) : (
              <form onSubmit={handleList} className="space-y-4">
                <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
                  <p className="stat-label">Selected Item</p>
                  <p className="font-semibold text-surface-900 text-lg">{selectedItem.itemName}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-surface-500 uppercase tracking-wider block mb-1">Quantity</label>
                  <input type="number" min="1" max={selectedItem.balance.toString()} value={listAmount}
                    onChange={e => setListAmount(e.target.value)} className="input-field" required />
                  <p className="text-xs text-surface-400 mt-1">Max: {selectedItem.balance.toString()}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-surface-500 uppercase tracking-wider block mb-1">Price Per Item (PXL)</label>
                  <input type="number" step="0.01" min="0" value={listPricePXL}
                    onChange={e => setListPricePXL(e.target.value)} className="input-field" placeholder="e.g. 50" required />
                </div>
                {listPricePXL && !isNaN(Number(listPricePXL)) && (
                  <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm space-y-1">
                    <div className="flex justify-between text-surface-500">
                      <span>Total ({listAmount}× {Number(listPricePXL).toFixed(2)})</span>
                      <span>{(Number(listPricePXL) * Number(listAmount)).toFixed(2)} PXL</span>
                    </div>
                    <div className="flex justify-between text-surface-500">
                      <span>Marketplace Fee (2.5%)</span>
                      <span>-{(Number(listPricePXL) * Number(listAmount) * 0.025).toFixed(2)} PXL</span>
                    </div>
                    <div className="flex justify-between font-semibold text-emerald-600">
                      <span>You Receive</span>
                      <span>{(Number(listPricePXL) * Number(listAmount) * 0.975).toFixed(2)} PXL</span>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={isPending || !listPricePXL}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                  {isPending ? 'Processing…' : 'List Item'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}