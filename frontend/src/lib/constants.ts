// Pre-computed keccak256 hashes of game names (used as gameId in contracts)
export const DUNGEON_GAME_ID = '0x8a7faac11b689a5f91556fc9d00fefebcd250de9c9f98f764e8d91ef11653098' as `0x${string}`
export const HARVEST_GAME_ID = '0xa97480cebb0845f01cfdff40d4ecb12b5ad61dc0c8763e8fe6596d9648937609' as `0x${string}`
export const COSMIC_GAME_ID = '0x6301dec68b99b5b7bdfc76771c038abaf90a8339b7cd66385bd674a3107a9dc9' as `0x${string}`

// Lookup table: token symbol → game ID (used by DEX, Marketplace, etc.)
export const GAME_IDS: Record<string, `0x${string}`> = {
  DNGN: DUNGEON_GAME_ID,
  HRV: HARVEST_GAME_ID,
  RACE: COSMIC_GAME_ID,
  DUNGEON: DUNGEON_GAME_ID,
  HARVEST: HARVEST_GAME_ID,
  COSMIC: COSMIC_GAME_ID,
}

// ERC1155 item IDs for DungeonDrops
export const DUNGEON_ITEMS: Record<number, string> = {
  1: 'Common Sword',
  2: 'Rare Shield',
  3: 'Legendary Crown',
}

// ERC1155 item IDs for HarvestField
export const HARVEST_ITEMS: Record<number, string> = {
  1: 'Seasonal Harvest Item',
}

// ERC1155 item IDs for CosmicRacer
export const COSMIC_ITEMS: Record<number, string> = {
  1: 'Speed Boost',
  2: 'Turbo Engine',
  3: 'Legendary Chassis',
}

// Achievement badge IDs
export const BADGE_NAMES: Record<number, string> = {
  1: 'First Clear (Dungeon)',
  2: 'First Harvest',
  3: 'First Race (Cosmic)',
}

// Contract name mapping (for GasSettings display)
export const CONTRACT_NAMES: Record<string, string> = {}
// Populated at runtime from ADDRESSES — see GasSettings page

// Harvest constants
export const HARVEST_DELAY_BLOCKS = 100n
export const BASE_REWARD_RATE = 10000000000000000n // 1e16

// DungeonDrops constants
export const DUNGEON_ENTRY_FEE = 10000000000000000000n // 10e18 = 10 DNGN

// CosmicRacer constants
export const COSMIC_ENTRY_FEE = 10000000000000000000n // 10e18 = 10 RACE

// Drop rates (out of 100) — used for floor price computation
export const DUNGEON_DROP_RATES: Record<number, number> = {
  1: 60,  // Common Sword: 60%
  2: 30,  // Rare Shield: 30%
  3: 10,  // Legendary Crown: 10%
}

// Expected production cost in DNGN (entry_fee / drop_rate)
// Common Sword: 10 / 0.6 ≈ 16.67, Rare Shield: 10 / 0.3 ≈ 33.33, Crown: 10 / 0.1 = 100
export const DUNGEON_EXPECTED_COST: Record<number, bigint> = {
  1: 16666666666666666667n,  // ~16.67 DNGN
  2: 33333333333333333333n,  // ~33.33 DNGN
  3: 100000000000000000000n, // 100 DNGN
}
