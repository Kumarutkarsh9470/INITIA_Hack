import { DUNGEON_EXPECTED_COST } from './constants'

/**
 * AMM constant-product estimate: given input amount and reserves, return output.
 * Includes 0.3% fee (997/1000).
 */
export function ammEstimate(amtIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amtIn === 0n) return 0n
  const amtInWithFee = amtIn * 997n
  return (amtInWithFee * reserveOut) / (reserveIn * 1000n + amtInWithFee)
}

/**
 * Compute an item's floor price in PXL, accounting for:
 *  - production cost (DNGN entry fee / drop rate)
 *  - DEX pool conversion rate (DNGN or HRV → PXL)
 *  - game star rating multiplier (100–500 → 1.0x–5.0x)
 */
export function computeFloorPricePxl(
  itemType: 'dungeon' | 'harvest',
  itemId: number,
  dngnReservePxl: bigint,
  dngnReserveGame: bigint,
  hrvReservePxl: bigint,
  hrvReserveGame: bigint,
  dngnRating: bigint,   // 100-500 from contract
  hrvRating: bigint,
): bigint {
  if (itemType === 'harvest') {
    // Harvest items have near-zero production cost (staking returns principal)
    // Assign a minimal base value of 1 HRV worth of PXL
    if (hrvReservePxl === 0n || hrvReserveGame === 0n) return 0n
    const basePxl = ammEstimate(1000000000000000000n, hrvReserveGame, hrvReservePxl) // 1 HRV → PXL
    return basePxl * hrvRating / 100n
  }

  // Dungeon items: floor = expectedDngnCost → PXL via AMM × rating multiplier
  const costInDngn = DUNGEON_EXPECTED_COST[itemId]
  if (!costInDngn) return 0n
  if (dngnReservePxl === 0n || dngnReserveGame === 0n) return 0n
  const basePxl = ammEstimate(costInDngn, dngnReserveGame, dngnReservePxl)
  return basePxl * dngnRating / 100n
}

/**
 * Compute floor price as a human-readable float (for advisor / display).
 */
export function computeFloorPricePxlFloat(
  itemType: 'dungeon' | 'harvest',
  itemId: number,
  dngnReservePxl: bigint,
  dngnReserveGame: bigint,
  hrvReservePxl: bigint,
  hrvReserveGame: bigint,
  dngnRating: bigint,
  hrvRating: bigint,
): number {
  const raw = computeFloorPricePxl(
    itemType, itemId,
    dngnReservePxl, dngnReserveGame,
    hrvReservePxl, hrvReserveGame,
    dngnRating, hrvRating,
  )
  return Number(raw) / 1e18
}

/**
 * Compute a fair exchange ratio between two items for barter.
 * Returns the number of wantItems per 1 offerItem, and a fairness assessment.
 */
export function computeTradeRatio(
  offerFloorPxl: number,
  wantFloorPxl: number,
): { ratio: number; fairness: 'fair' | 'favors-offerer' | 'favors-taker'; surplusPxl: number } {
  if (wantFloorPxl <= 0) return { ratio: 0, fairness: 'favors-taker', surplusPxl: offerFloorPxl }
  const ratio = offerFloorPxl / wantFloorPxl
  const diff = offerFloorPxl - wantFloorPxl
  const threshold = offerFloorPxl * 0.1 // 10% tolerance

  if (Math.abs(diff) <= threshold) return { ratio, fairness: 'fair', surplusPxl: diff }
  if (diff > 0) return { ratio, fairness: 'favors-offerer', surplusPxl: diff }
  return { ratio, fairness: 'favors-taker', surplusPxl: diff }
}
