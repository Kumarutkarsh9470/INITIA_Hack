import { useState } from 'react'
import { formatEther } from 'viem'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useContracts, publicClient } from '../hooks/useContracts'
import { GAME_IDS, DUNGEON_ITEMS, HARVEST_ITEMS, COSMIC_ITEMS, DUNGEON_DROP_RATES } from '../lib/constants'

const ITEM_FLOOR_COSTS_DNGN: Record<number, number> = {
  1: 10 / 0.60,
  2: 10 / 0.30,
  3: 10 / 0.10,
}

function ammEstimate(amtIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amtIn === 0n) return 0n
  const amtInWithFee = amtIn * 997n
  return (amtInWithFee * reserveOut) / (reserveIn * 1000n + amtInWithFee)
}

interface Recommendation {
  action: string
  text: string
  impact: string
}

export default function TradingAdvisor() {
  const { tba } = usePlayerProfile()
  const contracts = useContracts()
  const [advice, setAdvice] = useState<Recommendation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchAdvice = async () => {
    if (!tba) return
    setIsLoading(true)
    setError('')
    setAdvice([])

    try {
      // Fetch all on-chain data in parallel
      const [pxl, dngn, hrv, race, dungeonPool, harvestPool, cosmicPool,
             sword, shield, crown, harvestItem,
             cosmicItem1, cosmicItem2, cosmicItem3,
             dngnRating, hrvRating, cosmicRating, nextListingId] = await Promise.all([
        publicClient.readContract({ address: contracts.pxlToken.address, abi: contracts.pxlToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.dungeonDropsToken.address, abi: contracts.dungeonDropsToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.harvestFieldToken.address, abi: contracts.harvestFieldToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.cosmicRacerToken.address, abi: contracts.cosmicRacerToken.abi, functionName: 'balanceOf', args: [tba] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'pools', args: [GAME_IDS.DUNGEON] }) as Promise<any>,
        publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'pools', args: [GAME_IDS.HARVEST] }) as Promise<any>,
        publicClient.readContract({ address: contracts.pixelVaultDEX.address, abi: contracts.pixelVaultDEX.abi, functionName: 'pools', args: [GAME_IDS.COSMIC] }) as Promise<any>,
        publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.dungeonDropsAssets.address, abi: contracts.dungeonDropsAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.harvestFieldAssets.address, abi: contracts.harvestFieldAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 1n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 2n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.cosmicRacerAssets.address, abi: contracts.cosmicRacerAssets.abi, functionName: 'balanceOf', args: [tba, 3n] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameRating', args: [GAME_IDS.DUNGEON] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameRating', args: [GAME_IDS.HARVEST] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.gameRegistry.address, abi: contracts.gameRegistry.abi, functionName: 'getGameRating', args: [GAME_IDS.COSMIC] }) as Promise<bigint>,
        publicClient.readContract({ address: contracts.marketplace.address, abi: contracts.marketplace.abi, functionName: 'nextListingId' }) as Promise<bigint>,
      ])

      // DEX prices
      const dngnReservePxl = parseFloat(formatEther(dungeonPool[1]))
      const dngnReserveGame = parseFloat(formatEther(dungeonPool[2]))
      const dngnPricePxl = dngnReserveGame > 0 ? dngnReservePxl / dngnReserveGame : 0

      const hrvReservePxl = parseFloat(formatEther(harvestPool[1]))
      const hrvReserveGame = parseFloat(formatEther(harvestPool[2]))
      const hrvPricePxl = hrvReserveGame > 0 ? hrvReservePxl / hrvReserveGame : 0

      const cosmicReservePxl = parseFloat(formatEther(cosmicPool[1]))
      const cosmicReserveGame = parseFloat(formatEther(cosmicPool[2]))
      const cosmicPricePxl = cosmicReserveGame > 0 ? cosmicReservePxl / cosmicReserveGame : 0

      // Floor prices with rating
      const dngnRatingNum = Number(dngnRating) / 100
      const hrvRatingNum = Number(hrvRating) / 100
      const cosmicRatingNum = Number(cosmicRating) / 100
      const floorPrices: Record<string, string> = {
        'Common Sword': (ITEM_FLOOR_COSTS_DNGN[1] * dngnPricePxl * dngnRatingNum).toFixed(2),
        'Rare Shield': (ITEM_FLOOR_COSTS_DNGN[2] * dngnPricePxl * dngnRatingNum).toFixed(2),
        'Legendary Crown': (ITEM_FLOOR_COSTS_DNGN[3] * dngnPricePxl * dngnRatingNum).toFixed(2),
        'Seasonal Harvest Item': (hrvPricePxl * hrvRatingNum).toFixed(2),
        'Speed Boost': (cosmicPricePxl * cosmicRatingNum).toFixed(2),
      }

      // Fetch active marketplace listings (cap at 20)
      const listingCount = Number(nextListingId)
      const activeListings: any[] = []
      for (let i = 0; i < Math.min(listingCount, 20); i++) {
        const l = await publicClient.readContract({
          address: contracts.marketplace.address,
          abi: contracts.marketplace.abi,
          functionName: 'listings',
          args: [BigInt(i)],
        }) as any
        if (l[6]) {
          const isDungeon = l[1].toLowerCase() === contracts.dungeonDropsAssets.address.toLowerCase()
          const isHarvest = l[1].toLowerCase() === contracts.harvestFieldAssets.address.toLowerCase()
          const isCosmic = l[1].toLowerCase() === contracts.cosmicRacerAssets.address.toLowerCase()
          const itemName = isDungeon
            ? DUNGEON_ITEMS[Number(l[2]) as keyof typeof DUNGEON_ITEMS]
            : isHarvest
            ? HARVEST_ITEMS[Number(l[2]) as keyof typeof HARVEST_ITEMS]
            : isCosmic
            ? COSMIC_ITEMS[Number(l[2]) as keyof typeof COSMIC_ITEMS]
            : undefined
          activeListings.push({
            item: itemName || `Item #${l[2]}`,
            qty: Number(l[3]),
            pricePerItemPxl: parseFloat(formatEther(l[4])).toFixed(2),
          })
        }
      }

      const context = {
        inventory: {
          'Common Sword': Number(sword),
          'Rare Shield': Number(shield),
          'Legendary Crown': Number(crown),
          'Seasonal Harvest Item': Number(harvestItem),
          'Speed Boost': Number(cosmicItem1),
          'Nitro Tank': Number(cosmicItem2),
          'Turbo Engine': Number(cosmicItem3),
        },
        balances: {
          PXL: parseFloat(formatEther(pxl)).toFixed(2),
          DNGN: parseFloat(formatEther(dngn)).toFixed(2),
          HRV: parseFloat(formatEther(hrv)).toFixed(2),
          RACE: parseFloat(formatEther(race)).toFixed(2),
        },
        floorPrices,
        listings: activeListings,
        ratings: {
          DungeonDrops: `${dngnRatingNum.toFixed(1)} stars`,
          HarvestField: `${hrvRatingNum.toFixed(1)} stars`,
          CosmicRacer: `${cosmicRatingNum.toFixed(1)} stars`,
        },
        dexPrices: {
          dngnPricePxl: dngnPricePxl.toFixed(6),
          hrvPricePxl: hrvPricePxl.toFixed(6),
          racePricePxl: cosmicPricePxl.toFixed(6),
        },
      }

      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Advisor request failed')
      setAdvice(json.recommendations || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to get trading advice')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">AI Trading Advisor</h2>
        <button
          onClick={fetchAdvice}
          disabled={isLoading || !tba}
          className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
        >
          {isLoading ? 'Analysing…' : 'Get Advice'}
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {advice.length > 0 && (
        <div className="space-y-2">
          {advice.map((rec, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm"
            >
              <span className="font-semibold uppercase text-xs mt-0.5 w-10 shrink-0 text-surface-500">
                {rec.action}
              </span>
              <span className="text-surface-700">{rec.text}</span>
            </div>
          ))}
        </div>
      )}

      {advice.length === 0 && !isLoading && !error && (
        <p className="text-surface-400 text-sm text-center py-4">
          Analyses your portfolio against live market data
        </p>
      )}
    </div>
  )
}
