// Pre-computed keccak256 hashes of game names (used as gameId in contracts)
export const DUNGEON_GAME_ID = '0x8a7faac11b689a5f91556fc9d00fefebcd250de9c9f98f764e8d91ef11653098' as `0x${string}`
export const HARVEST_GAME_ID = '0xa97480cebb0845f01cfdff40d4ecb12b5ad61dc0c8763e8fe6596d9648937609' as `0x${string}`

// Lookup table: token symbol → game ID (used by DEX, Marketplace, etc.)
export const GAME_IDS: Record<string, `0x${string}`> = {
  DNGN: DUNGEON_GAME_ID,
  HRV: HARVEST_GAME_ID,
  DUNGEON: DUNGEON_GAME_ID,
  HARVEST: HARVEST_GAME_ID,
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

// Achievement badge IDs
export const BADGE_NAMES: Record<number, string> = {
  1: 'First Clear (Dungeon)',
  2: 'First Harvest',
}

// Contract name mapping (for GasSettings display)
export const CONTRACT_NAMES: Record<string, string> = {}
// Populated at runtime from ADDRESSES — see GasSettings page

// Harvest constants
export const HARVEST_DELAY_BLOCKS = 100n
export const BASE_REWARD_RATE = 10000000000000000n // 1e16

// DungeonDrops constants
export const DUNGEON_ENTRY_FEE = 10000000000000000000n // 10e18 = 10 DNGN
