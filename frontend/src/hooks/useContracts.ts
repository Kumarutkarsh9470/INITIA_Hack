import { useMemo } from 'react'
import { createPublicClient, http } from 'viem'
import { ADDRESSES } from '../lib/addresses'
import {
  PlayerProfileABI,
  PXLTokenABI,
  GameRegistryABI,
  PixelVaultDEXABI,
  GasPaymasterABI,
  MarketplaceABI,
  AchievementBadgeABI,
  DungeonDropsABI,
  HarvestFieldABI,
  CommonRelicABI,
  GameTokenABI,
  GameAssetCollectionABI,
  ERC6551AccountABI,
  ERC6551RegistryABI,
  BarterMarketABI,
} from '../lib/abis'

const JSON_RPC_URL = import.meta.env.VITE_JSON_RPC_URL ?? `${window.location.origin}/evm-rpc`

export const publicClient = createPublicClient({
  transport: http(JSON_RPC_URL, {
    retryCount: 3,
    retryDelay: 1000,
    timeout: 15_000,
  }),
  batch: { multicall: true },
})

interface Contracts {
  playerProfile: { address: `0x${string}`; abi: typeof PlayerProfileABI }
  pxlToken: { address: `0x${string}`; abi: typeof PXLTokenABI }
  gameRegistry: { address: `0x${string}`; abi: typeof GameRegistryABI }
  dex: { address: `0x${string}`; abi: typeof PixelVaultDEXABI }
  pixelVaultDEX: { address: `0x${string}`; abi: typeof PixelVaultDEXABI }
  gasPaymaster: { address: `0x${string}`; abi: typeof GasPaymasterABI }
  marketplace: { address: `0x${string}`; abi: typeof MarketplaceABI }
  achievementBadge: { address: `0x${string}`; abi: typeof AchievementBadgeABI }
  dungeonDrops: { address: `0x${string}`; abi: typeof DungeonDropsABI }
  harvestField: { address: `0x${string}`; abi: typeof HarvestFieldABI }
  commonRelic: { address: `0x${string}`; abi: typeof CommonRelicABI }
  dungeonDropsToken: { address: `0x${string}`; abi: typeof GameTokenABI }
  harvestFieldToken: { address: `0x${string}`; abi: typeof GameTokenABI }
  dungeonDropsAssets: { address: `0x${string}`; abi: typeof GameAssetCollectionABI }
  harvestFieldAssets: { address: `0x${string}`; abi: typeof GameAssetCollectionABI }
  erc6551Account: { address: `0x${string}`; abi: typeof ERC6551AccountABI }
  erc6551Registry: { address: `0x${string}`; abi: typeof ERC6551RegistryABI }
  barterMarket: { address: `0x${string}`; abi: typeof BarterMarketABI }
}

export function useContracts(): Contracts {
  return useMemo(
    () => ({
      playerProfile: { address: ADDRESSES.PlayerProfile, abi: PlayerProfileABI },
      pxlToken: { address: ADDRESSES.PXLToken, abi: PXLTokenABI },
      gameRegistry: { address: ADDRESSES.GameRegistry, abi: GameRegistryABI },
      dex: { address: ADDRESSES.PixelVaultDEX, abi: PixelVaultDEXABI },
      pixelVaultDEX: { address: ADDRESSES.PixelVaultDEX, abi: PixelVaultDEXABI },
      gasPaymaster: { address: ADDRESSES.GasPaymaster, abi: GasPaymasterABI },
      marketplace: { address: ADDRESSES.Marketplace, abi: MarketplaceABI },
      achievementBadge: { address: ADDRESSES.AchievementBadge, abi: AchievementBadgeABI },
      dungeonDrops: { address: ADDRESSES.DungeonDrops, abi: DungeonDropsABI },
      harvestField: { address: ADDRESSES.HarvestField, abi: HarvestFieldABI },
      commonRelic: { address: ADDRESSES.CommonRelic, abi: CommonRelicABI },
      dungeonDropsToken: { address: ADDRESSES.DungeonDropsToken, abi: GameTokenABI },
      harvestFieldToken: { address: ADDRESSES.HarvestFieldToken, abi: GameTokenABI },
      dungeonDropsAssets: { address: ADDRESSES.DungeonDropsAssets, abi: GameAssetCollectionABI },
      harvestFieldAssets: { address: ADDRESSES.HarvestFieldAssets, abi: GameAssetCollectionABI },
      erc6551Account: { address: ADDRESSES.ERC6551Account, abi: ERC6551AccountABI },
      erc6551Registry: { address: ADDRESSES.ERC6551Registry, abi: ERC6551RegistryABI },
      barterMarket: { address: ADDRESSES.BarterMarket, abi: BarterMarketABI },
    }),
    [],
  )
}
