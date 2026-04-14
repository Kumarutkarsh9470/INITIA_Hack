import { useState, useEffect, useCallback } from 'react'
import { formatEther, encodeFunctionData } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { useTBA } from '../hooks/useTBA'
import { DUNGEON_ITEMS, HARVEST_ITEMS, GAME_IDS } from '../lib/constants'
import { computeFloorPricePxlFloat, computeTradeRatio } from '../lib/pricing'
import toast from 'react-hot-toast'

type InventoryItem = { collection: `0x${string}`; gameName: string; itemId: number; itemName: string; balance: bigint }

interface BarterOffer {
  id: number
  offerer: string
  offeredCollection: string
  offeredItemId: number
  offeredAmount: number
  wantedCollection: string
  wantedItemId: number
  wantedAmount: number
  active: boolean
}

interface PoolData { reservePXL: bigint; reserveGame: bigint }

export default function BarterMarket() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()
  const { execute, isPending } = useTBA()

  // BarterMarket contract is not deployed — show a friendly message
  const isBarterAvailable = contracts.barterMarket.address !== '0x0000000000000000000000000000000000000000'

  const [tab, setTab] = useState<'browse' | 'create'>('browse')
  const [isLoading, setIsLoading] = useState(true)
  const [offers, setOffers] = useState<BarterOffer[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [pools, setPools] = useState<{ DNGN: PoolData; HRV: PoolData }>({
    DNGN: { reservePXL: 0n, reserveGame: 0n },
    HRV: { reservePXL: 0n, reserveGame: 0n },
  })
  const [ratings, setRatings] = useState<{ DNGN: bigint; HRV: bigint }>({ DNGN: 100n, HRV: 100n })

  // Create offer form state
  const [offerItem, setOfferItem] = useState<InventoryItem | null>(null)
  const [offerAmount, setOfferAmount] = useState('1')
  const [wantCollection, setWantCollection] = useState<'dungeon' | 'harvest'>('dungeon')
  const [wantItemId, setWantItemId] = useState('1')
  const [wantAmount, setWantAmount] = useState('1')

  const allItems: Record<string, Record<number, string>> = {
    dungeon: DUNGEON_ITEMS,
    harvest: HARVEST_ITEMS,
  }

  const getItemName = (collection: string, itemId: number): string => {
    const isDungeon = collection.toLowerCase() === contracts.dungeonDropsAssets.address.toLowerCase()
    const items = isDungeon ? DUNGEON_ITEMS : HARVEST_ITEMS
    return items[itemId] || `Item #${itemId}`
  }

  const getItemType = (collection: string): 'dungeon' | 'harvest' => {
    return collection.toLowerCase() === contracts.dungeonDropsAssets.address.toLowerCase() ? 'dungeon' : 'harvest'
  }

  const getFloorPrice = useCallback((collection: string, itemId: number): number => {
    const itemType = getItemType(collection)
    return computeFloorPricePxlFloat(
      itemType, itemId,
      pools.DNGN.reservePXL, pools.DNGN.reserveGame,
      pools.HRV.reservePXL, pools.HRV.reserveGame,
      ratings.DNGN, ratings.HRV,
    )
  }, [pools, ratings, contracts])

  const fetchData = useCallback(async () => {
    if (!tba || !isBarterAvailable) { setIsLoading(false); return }
    setIsLoading(true)
    try {
      // Fetch pools, ratings, inventory, and offers in parallel
      const fetchPool = async (gameId: `0x${string}`) => {
        const poolData = await publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'pools', args: [gameId] })
        const arr = poolData as unknown as [string, bigint, bigint, string, boolean, bigint]
        return { reservePXL: arr[1], reserveGame: arr[2] }
      }

      const [dngnPool, hrvPool, dngnRating, hrvRating, nextOfferId,
             sword, shield, crown, harvestItem] = await Promise.all([
        fetchPool(GAME_IDS.DUNGEON),
        fetchPool(GAME_IDS.HARVEST),
        publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameRating', args: [GAME_IDS.DUNGEON] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameRating', args: [GAME_IDS.HARVEST] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.barterMarket.address, abi: contracts.barterMarket.abi, functionName: 'nextOfferId' }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.harvestFieldAssets.address, abi: contracts.harvestFieldAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }) as Promise<bigint>,
      ])

      setPools({ DNGN: dngnPool, HRV: hrvPool })
      setRatings({ DNGN: dngnRating, HRV: hrvRating })

      // Build inventory
      const inv: InventoryItem[] = []
      if (sword > 0n) inv.push({ collection: contracts.dungeonDropsAssets.address, gameName: 'DungeonDrops', itemId: 1, itemName: 'Common Sword', balance: sword })
      if (shield > 0n) inv.push({ collection: contracts.dungeonDropsAssets.address, gameName: 'DungeonDrops', itemId: 2, itemName: 'Rare Shield', balance: shield })
      if (crown > 0n) inv.push({ collection: contracts.dungeonDropsAssets.address, gameName: 'DungeonDrops', itemId: 3, itemName: 'Legendary Crown', balance: crown })
      if (harvestItem > 0n) inv.push({ collection: contracts.harvestFieldAssets.address, gameName: 'HarvestField', itemId: 1, itemName: 'Seasonal Harvest Item', balance: harvestItem })
      setInventory(inv)

      // Fetch active barter offers
      const offerCount = Number(nextOfferId)
      const activeOffers: BarterOffer[] = []
      for (let i = 0; i < Math.min(offerCount, 50); i++) {
        const o = await publicClient.readContract({
          address: contracts.barterMarket.address,
          abi: contracts.barterMarket.abi,
          functionName: 'offers',
          args: [BigInt(i)],
        }) as any
        if (o[7]) { // active
          activeOffers.push({
            id: i,
            offerer: o[0],
            offeredCollection: o[1],
            offeredItemId: Number(o[2]),
            offeredAmount: Number(o[3]),
            wantedCollection: o[4],
            wantedItemId: Number(o[5]),
            wantedAmount: Number(o[6]),
            active: o[7],
          })
        }
      }
      setOffers(activeOffers)
    } catch (err) {
      console.error('Failed to fetch barter data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [tba, contracts])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Create offer ─────────────────────────────────────────────────────
  const handleCreateOffer = async () => {
    if (!offerItem || !tba) return

    const wantColl = wantCollection === 'dungeon'
      ? contracts.dungeonDropsAssets.address
      : contracts.harvestFieldAssets.address

    try {
      // Step 1: Approve the barter contract to transfer the offered items
      const approveData = encodeFunctionData({
        abi: contracts.dungeonDropsAssets.abi,
        functionName: 'setApprovalForAll',
        args: [contracts.barterMarket.address, true],
      })
      toast.loading('Approving items...', { id: 'barter' })
      await execute(offerItem.collection, 0n, approveData)

      // Step 2: Create the offer
      const createData = encodeFunctionData({
        abi: contracts.barterMarket.abi,
        functionName: 'createOffer',
        args: [
          offerItem.collection,
          BigInt(offerItem.itemId),
          BigInt(offerAmount),
          wantColl,
          BigInt(wantItemId),
          BigInt(wantAmount),
        ],
      })
      toast.loading('Creating barter offer...', { id: 'barter' })
      await execute(contracts.barterMarket.address, 0n, createData)
      toast.success('Barter offer created!', { id: 'barter' })
      setOfferItem(null)
      setOfferAmount('1')
      setWantAmount('1')
      setTab('browse')
      fetchData()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed to create offer', { id: 'barter' })
    }
  }

  // ── Fill offer ───────────────────────────────────────────────────────
  const handleFillOffer = async (offer: BarterOffer) => {
    if (!tba) return
    try {
      // Step 1: Approve the wanted items
      const approveData = encodeFunctionData({
        abi: contracts.dungeonDropsAssets.abi,
        functionName: 'setApprovalForAll',
        args: [contracts.barterMarket.address, true],
      })
      toast.loading('Approving items...', { id: 'barter-fill' })
      await execute(offer.wantedCollection as `0x${string}`, 0n, approveData)

      // Step 2: Fill it
      const fillData = encodeFunctionData({
        abi: contracts.barterMarket.abi,
        functionName: 'fillOffer',
        args: [BigInt(offer.id)],
      })
      toast.loading('Filling barter offer...', { id: 'barter-fill' })
      await execute(contracts.barterMarket.address, 0n, fillData)
      toast.success('Barter trade completed!', { id: 'barter-fill' })
      fetchData()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed to fill offer', { id: 'barter-fill' })
    }
  }

  // ── Cancel offer ─────────────────────────────────────────────────────
  const handleCancelOffer = async (offerId: number) => {
    try {
      const cancelData = encodeFunctionData({
        abi: contracts.barterMarket.abi,
        functionName: 'cancelOffer',
        args: [BigInt(offerId)],
      })
      toast.loading('Cancelling offer...', { id: 'barter-cancel' })
      await execute(contracts.barterMarket.address, 0n, cancelData)
      toast.success('Offer cancelled!', { id: 'barter-cancel' })
      fetchData()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Cancel failed', { id: 'barter-cancel' })
    }
  }

  // ── Fairness label for a barter offer ────────────────────────────────
  const getFairnessInfo = (offer: BarterOffer) => {
    const offerFloor = getFloorPrice(offer.offeredCollection, offer.offeredItemId) * offer.offeredAmount
    const wantFloor = getFloorPrice(offer.wantedCollection, offer.wantedItemId) * offer.wantedAmount
    const { fairness, surplusPxl } = computeTradeRatio(offerFloor, wantFloor)

    if (fairness === 'fair') return { label: 'Fair trade', color: 'text-green-600 bg-green-50 border-green-200', icon: '✓' }
    if (fairness === 'favors-offerer') return { label: `Offerer overpays by ${Math.abs(surplusPxl).toFixed(2)} PXL`, color: 'text-blue-600 bg-blue-50 border-blue-200', icon: '↑' }
    return { label: `You overpay by ${Math.abs(surplusPxl).toFixed(2)} PXL`, color: 'text-amber-600 bg-amber-50 border-amber-200', icon: '⚠' }
  }

  // ── Helper to get the collection address for wanted side ─────────────
  const wantCollAddress = wantCollection === 'dungeon'
    ? contracts.dungeonDropsAssets.address
    : contracts.harvestFieldAssets.address

  // ── Compute preview for create form ──────────────────────────────────
  const offerFloorPreview = offerItem ? getFloorPrice(offerItem.collection, offerItem.itemId) * parseInt(offerAmount || '1') : 0
  const wantFloorPreview = getFloorPrice(wantCollAddress, parseInt(wantItemId)) * parseInt(wantAmount || '1')
  const previewTrade = computeTradeRatio(offerFloorPreview, wantFloorPreview)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Barter Market</h1>
          <p className="text-surface-500 text-sm mt-1">Trade items directly — no PXL needed</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-surface-100 p-1">
          {(['browse', 'create'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${tab === t ? 'bg-white shadow text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}
            >
              {t === 'browse' ? 'Browse Offers' : 'Create Offer'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Browse Offers Tab ────────────────────────────────────────── */}
      {tab === 'browse' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-surface-400">Loading offers…</div>
          ) : offers.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-surface-500">No active barter offers</p>
              <button onClick={() => setTab('create')} className="btn-primary mt-3 text-sm px-4 py-2">
                Create the first offer
              </button>
            </div>
          ) : (
            offers.map(offer => {
              const fi = getFairnessInfo(offer)
              const isOwn = offer.offerer.toLowerCase() === tba?.toLowerCase()
              const offeredName = getItemName(offer.offeredCollection, offer.offeredItemId)
              const wantedName = getItemName(offer.wantedCollection, offer.wantedItemId)
              const offeredFloor = getFloorPrice(offer.offeredCollection, offer.offeredItemId)
              const wantedFloor = getFloorPrice(offer.wantedCollection, offer.wantedItemId)

              return (
                <div key={offer.id} className="card p-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Offer side */}
                    <div className="flex-1">
                      <div className="text-xs text-surface-400 mb-1">Offering</div>
                      <div className="font-semibold">{offer.offeredAmount}× {offeredName}</div>
                      <div className="text-xs text-surface-400">
                        Floor: {(offeredFloor * offer.offeredAmount).toFixed(2)} PXL
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="text-surface-300 text-xl shrink-0">→</div>

                    {/* Want side */}
                    <div className="flex-1">
                      <div className="text-xs text-surface-400 mb-1">Wants</div>
                      <div className="font-semibold">{offer.wantedAmount}× {wantedName}</div>
                      <div className="text-xs text-surface-400">
                        Floor: {(wantedFloor * offer.wantedAmount).toFixed(2)} PXL
                      </div>
                    </div>

                    {/* Fairness + action */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full border ${fi.color}`}>
                        {fi.icon} {fi.label}
                      </span>
                      {isOwn ? (
                        <button
                          onClick={() => handleCancelOffer(offer.id)}
                          disabled={isPending}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => handleFillOffer(offer)}
                          disabled={isPending}
                          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                        >
                          Fill Offer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Create Offer Tab ─────────────────────────────────────────── */}
      {tab === 'create' && (
        <div className="card p-5 space-y-5">
          {/* What you offer */}
          <div>
            <h3 className="text-sm font-semibold text-surface-600 mb-2">You Offer</h3>
            {inventory.length === 0 ? (
              <p className="text-sm text-surface-400">No items in inventory. Play games to earn items first.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {inventory.map(item => (
                  <button
                    key={`${item.collection}-${item.itemId}`}
                    onClick={() => setOfferItem(item)}
                    className={`p-3 rounded-xl border text-left text-sm transition-colors
                      ${offerItem?.itemId === item.itemId && offerItem?.collection === item.collection
                        ? 'border-surface-900 bg-surface-50'
                        : 'border-surface-200 hover:border-surface-400'}`}
                  >
                    <div className="font-medium">{item.itemName}</div>
                    <div className="text-xs text-surface-400 mt-0.5">
                      Own: {item.balance.toString()} · Floor: {getFloorPrice(item.collection, item.itemId).toFixed(2)} PXL
                    </div>
                  </button>
                ))}
              </div>
            )}
            {offerItem && (
              <div className="mt-2">
                <label className="text-xs text-surface-500">Amount</label>
                <input
                  type="number"
                  min="1"
                  max={offerItem.balance.toString()}
                  value={offerAmount}
                  onChange={e => setOfferAmount(e.target.value)}
                  className="input-field w-24 ml-2"
                />
              </div>
            )}
          </div>

          {/* What you want */}
          <div>
            <h3 className="text-sm font-semibold text-surface-600 mb-2">You Want</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-surface-500 block mb-1">Game</label>
                <select
                  value={wantCollection}
                  onChange={e => { setWantCollection(e.target.value as any); setWantItemId('1') }}
                  className="input-field"
                >
                  <option value="dungeon">DungeonDrops</option>
                  <option value="harvest">HarvestField</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-surface-500 block mb-1">Item</label>
                <select
                  value={wantItemId}
                  onChange={e => setWantItemId(e.target.value)}
                  className="input-field"
                >
                  {Object.entries(allItems[wantCollection]).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-surface-500 block mb-1">Amount</label>
                <input
                  type="number"
                  min="1"
                  value={wantAmount}
                  onChange={e => setWantAmount(e.target.value)}
                  className="input-field w-24"
                />
              </div>
            </div>
          </div>

          {/* Trade preview */}
          {offerItem && (
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-surface-600">Trade Preview</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-surface-400">You give</div>
                  <div className="font-medium">{offerAmount}× {offerItem.itemName}</div>
                  <div className="text-xs text-surface-500">≈ {offerFloorPreview.toFixed(2)} PXL</div>
                </div>
                <div className="flex items-center justify-center text-2xl text-surface-300">→</div>
                <div>
                  <div className="text-xs text-surface-400">You get</div>
                  <div className="font-medium">{wantAmount}× {allItems[wantCollection][parseInt(wantItemId)]}</div>
                  <div className="text-xs text-surface-500">≈ {wantFloorPreview.toFixed(2)} PXL</div>
                </div>
              </div>
              <div className={`text-sm mt-2 px-3 py-2 rounded-lg border ${
                previewTrade.fairness === 'fair'
                  ? 'text-green-600 bg-green-50 border-green-200'
                  : previewTrade.fairness === 'favors-offerer'
                    ? 'text-amber-600 bg-amber-50 border-amber-200'
                    : 'text-blue-600 bg-blue-50 border-blue-200'
              }`}>
                {previewTrade.fairness === 'fair' && '✓ Fair trade (within 10% of equal value)'}
                {previewTrade.fairness === 'favors-offerer' && `⚠ You're overpaying by ~${Math.abs(previewTrade.surplusPxl).toFixed(2)} PXL in floor value`}
                {previewTrade.fairness === 'favors-taker' && `↑ Good deal for you — you receive ~${Math.abs(previewTrade.surplusPxl).toFixed(2)} PXL more in floor value`}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleCreateOffer}
            disabled={!offerItem || isPending || parseInt(offerAmount) < 1 || parseInt(wantAmount) < 1}
            className="btn-primary w-full py-3 disabled:opacity-50"
          >
            {isPending ? 'Creating…' : 'Create Barter Offer'}
          </button>
        </div>
      )}

      {/* ── Rating reference ─────────────────────────────────────────── */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-surface-600 mb-2">How Barter Pricing Works</h3>
        <div className="grid grid-cols-2 gap-4 text-xs text-surface-500">
          <div>
            <div className="font-medium text-surface-700">DungeonDrops ({(Number(ratings.DNGN) / 100).toFixed(1)}★)</div>
            <div>Common Sword: {computeFloorPricePxlFloat('dungeon', 1, pools.DNGN.reservePXL, pools.DNGN.reserveGame, pools.HRV.reservePXL, pools.HRV.reserveGame, ratings.DNGN, ratings.HRV).toFixed(2)} PXL</div>
            <div>Rare Shield: {computeFloorPricePxlFloat('dungeon', 2, pools.DNGN.reservePXL, pools.DNGN.reserveGame, pools.HRV.reservePXL, pools.HRV.reserveGame, ratings.DNGN, ratings.HRV).toFixed(2)} PXL</div>
            <div>Legendary Crown: {computeFloorPricePxlFloat('dungeon', 3, pools.DNGN.reservePXL, pools.DNGN.reserveGame, pools.HRV.reservePXL, pools.HRV.reserveGame, ratings.DNGN, ratings.HRV).toFixed(2)} PXL</div>
          </div>
          <div>
            <div className="font-medium text-surface-700">HarvestField ({(Number(ratings.HRV) / 100).toFixed(1)}★)</div>
            <div>Seasonal Harvest Item: {computeFloorPricePxlFloat('harvest', 1, pools.DNGN.reservePXL, pools.DNGN.reserveGame, pools.HRV.reservePXL, pools.HRV.reserveGame, ratings.DNGN, ratings.HRV).toFixed(2)} PXL</div>
            <div className="mt-2 text-surface-400">Items from higher-rated games are worth more. Rating acts as a price multiplier.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
