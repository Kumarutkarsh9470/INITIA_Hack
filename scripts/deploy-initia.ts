import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Full Initia-native deploy script.
 * Deploys all contracts with Cosmos bank registration via ERC20Registry precompile.
 * MUST be run on MiniEVM (needs precompiles at 0xF1, 0xF2).
 */

const ADDRESSES_FILE = "./deployed-addresses.json";
const FRONTEND_ADDRESSES_FILE = "./frontend/src/lib/deployed-addresses.json";

function saveAddresses(addresses: Record<string, string>) {
  const json = JSON.stringify(addresses, null, 2);
  fs.writeFileSync(ADDRESSES_FILE, json);
  // Keep frontend copy in sync
  const frontendDir = path.dirname(FRONTEND_ADDRESSES_FILE);
  if (fs.existsSync(frontendDir)) {
    fs.writeFileSync(FRONTEND_ADDRESSES_FILE, json);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "native"
  );

  const addresses: Record<string, string> = {};

  // ── 1. PXLTokenInitia (Initia-native, auto-registers with Cosmos bank) ──
  console.log("\n── 1/14: PXLTokenInitia ──");
  const PXLToken = await ethers.getContractFactory("PXLTokenInitia");
  const pxl = await PXLToken.deploy(deployer.address);
  await pxl.waitForDeployment();
  addresses.PXLToken = await pxl.getAddress();
  console.log("  PXLToken:", addresses.PXLToken);
  saveAddresses(addresses);

  // ── 2 & 3. ERC-6551 ──────────────────────────────────────
  console.log("\n── 2/14: ERC6551Registry ──");
  const Registry = await ethers.getContractFactory("ERC6551Registry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  addresses.ERC6551Registry = await registry.getAddress();
  console.log("  ERC6551Registry:", addresses.ERC6551Registry);

  console.log("\n── 3/14: ERC6551Account ──");
  const Account = await ethers.getContractFactory("ERC6551Account");
  const account = await Account.deploy();
  await account.waitForDeployment();
  addresses.ERC6551Account = await account.getAddress();
  console.log("  ERC6551Account:", addresses.ERC6551Account);
  saveAddresses(addresses);

  // ── 4. PlayerProfile ─────────────────────────────────────
  console.log("\n── 4/14: PlayerProfile ──");
  const Profile = await ethers.getContractFactory("PlayerProfile");
  const profile = await Profile.deploy(
    addresses.ERC6551Registry,
    addresses.ERC6551Account,
    "https://pixelvault-two.vercel.app/metadata/"
  );
  await profile.waitForDeployment();
  addresses.PlayerProfile = await profile.getAddress();
  console.log("  PlayerProfile:", addresses.PlayerProfile);
  saveAddresses(addresses);

  // ── 5. GameRegistry (now with ERC20Registry integration) ──
  console.log("\n── 5/14: GameRegistry ──");
  const GameRegistry = await ethers.getContractFactory("GameRegistry");
  const gameRegistry = await GameRegistry.deploy();
  await gameRegistry.waitForDeployment();
  addresses.GameRegistry = await gameRegistry.getAddress();
  console.log("  GameRegistry:", addresses.GameRegistry);
  saveAddresses(addresses);

  // ── 6. CommonRelic ───────────────────────────────────────
  console.log("\n── 6/14: CommonRelic ──");
  const CommonRelic = await ethers.getContractFactory("CommonRelic");
  const relic = await CommonRelic.deploy(addresses.GameRegistry);
  await relic.waitForDeployment();
  addresses.CommonRelic = await relic.getAddress();
  console.log("  CommonRelic:", addresses.CommonRelic);
  saveAddresses(addresses);

  // ── 7. PixelVaultDEX ─────────────────────────────────────
  console.log("\n── 7/14: PixelVaultDEX ──");
  const DEX = await ethers.getContractFactory("PixelVaultDEX");
  const dex = await DEX.deploy(addresses.PXLToken, addresses.GameRegistry);
  await dex.waitForDeployment();
  addresses.PixelVaultDEX = await dex.getAddress();
  console.log("  PixelVaultDEX:", addresses.PixelVaultDEX);
  saveAddresses(addresses);

  // ── 8. AchievementBadge ──────────────────────────────────
  console.log("\n── 8/14: AchievementBadge ──");
  const Badge = await ethers.getContractFactory("AchievementBadge");
  const badge = await Badge.deploy();
  await badge.waitForDeployment();
  addresses.AchievementBadge = await badge.getAddress();
  console.log("  AchievementBadge:", addresses.AchievementBadge);
  saveAddresses(addresses);

  // ── 9. GasPaymaster ──────────────────────────────────────
  console.log("\n── 9/14: GasPaymaster ──");
  const Paymaster = await ethers.getContractFactory("GasPaymaster");
  const paymaster = await Paymaster.deploy(
    addresses.PXLToken,
    addresses.PixelVaultDEX,
    addresses.GameRegistry
  );
  await paymaster.waitForDeployment();
  addresses.GasPaymaster = await paymaster.getAddress();
  console.log("  GasPaymaster:", addresses.GasPaymaster);
  saveAddresses(addresses);

  // ── 10. Marketplace ──────────────────────────────────────
  console.log("\n── 10/14: Marketplace ──");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    addresses.PXLToken,
    addresses.PixelVaultDEX,
    addresses.GameRegistry,
    deployer.address,
    addresses.GasPaymaster
  );
  await marketplace.waitForDeployment();
  addresses.Marketplace = await marketplace.getAddress();
  console.log("  Marketplace:", addresses.Marketplace);
  saveAddresses(addresses);

  // ── 11. CosmoBridge (NEW: IBC Token + NFT bridge) ────────
  console.log("\n── 11/14: CosmoBridge ──");
  const Bridge = await ethers.getContractFactory("CosmoBridge");
  const bridge = await Bridge.deploy();
  await bridge.waitForDeployment();
  addresses.CosmoBridge = await bridge.getAddress();
  console.log("  CosmoBridge:", addresses.CosmoBridge);
  saveAddresses(addresses);

  // ── WIRING ───────────────────────────────────────────────
  console.log("\n── Wiring ──");

  // W1: Set trusted DEX
  const gameRegistryContract = await ethers.getContractAt("GameRegistry", addresses.GameRegistry);
  await gameRegistryContract.setTrustedDEX(addresses.PixelVaultDEX);
  console.log("  setTrustedDEX done");

  // W2: Deploy Initia-native game tokens (GameTokenInitia) and register with GameRegistry
  const initialSupply = ethers.parseEther("1000000");
  const DUNGEON_ID = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  const HARVEST_ID = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));

  console.log("  Deploying DungeonDrops token (GameTokenInitia)...");
  const GameTokenInitiaFactory = await ethers.getContractFactory("GameTokenInitia");
  const dngnToken = await GameTokenInitiaFactory.deploy("DungeonDrops", "DNGN", DUNGEON_ID, deployer.address, initialSupply);
  await dngnToken.waitForDeployment();
  addresses.DungeonDropsToken = await dngnToken.getAddress();
  console.log("  DungeonDrops token:", addresses.DungeonDropsToken);

  console.log("  Deploying DungeonDrops assets...");
  const GameAssetCollectionFactory = await ethers.getContractFactory("GameAssetCollection");
  const dungeonAssets = await GameAssetCollectionFactory.deploy("DungeonDrops");
  await dungeonAssets.waitForDeployment();
  addresses.DungeonDropsAssets = await dungeonAssets.getAddress();
  console.log("  DungeonDrops assets:", addresses.DungeonDropsAssets);

  // Grant roles on dungeon assets to deployer
  await dungeonAssets.grantRole(ethers.ZeroHash, deployer.address); // admin
  await dungeonAssets.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE")), deployer.address);

  // Register DungeonDrops with GameRegistry
  await gameRegistryContract.registerExistingGame(
    "DungeonDrops", "DNGN",
    addresses.DungeonDropsToken, addresses.DungeonDropsAssets,
    deployer.address
  );
  console.log("  DungeonDrops registered in GameRegistry");

  console.log("  Deploying HarvestField token (GameTokenInitia)...");
  const hrvToken = await GameTokenInitiaFactory.deploy("HarvestField", "HRV", HARVEST_ID, deployer.address, initialSupply);
  await hrvToken.waitForDeployment();
  addresses.HarvestFieldToken = await hrvToken.getAddress();
  console.log("  HarvestField token:", addresses.HarvestFieldToken);

  console.log("  Deploying HarvestField assets...");
  const harvestAssets = await GameAssetCollectionFactory.deploy("HarvestField");
  await harvestAssets.waitForDeployment();
  addresses.HarvestFieldAssets = await harvestAssets.getAddress();
  console.log("  HarvestField assets:", addresses.HarvestFieldAssets);

  // Grant roles on harvest assets to deployer
  await harvestAssets.grantRole(ethers.ZeroHash, deployer.address); // admin
  await harvestAssets.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE")), deployer.address);

  // Register HarvestField with GameRegistry
  await gameRegistryContract.registerExistingGame(
    "HarvestField", "HRV",
    addresses.HarvestFieldToken, addresses.HarvestFieldAssets,
    deployer.address
  );
  console.log("  HarvestField registered in GameRegistry");
  saveAddresses(addresses);

  // ── 12. DungeonDrops ─────────────────────────────────────
  console.log("\n── 12/14: DungeonDrops ──");
  const DungeonDrops = await ethers.getContractFactory("DungeonDrops");
  const dungeon = await DungeonDrops.deploy(
    addresses.GasPaymaster,
    addresses.DungeonDropsToken,
    addresses.DungeonDropsAssets,
    addresses.AchievementBadge
  );
  await dungeon.waitForDeployment();
  addresses.DungeonDrops = await dungeon.getAddress();
  console.log("  DungeonDrops:", addresses.DungeonDrops);
  saveAddresses(addresses);

  // ── 13. HarvestField ─────────────────────────────────────
  console.log("\n── 13/14: HarvestField ──");
  const HarvestField = await ethers.getContractFactory("HarvestField");
  const harvest = await HarvestField.deploy(
    addresses.GasPaymaster,
    addresses.HarvestFieldToken,
    addresses.HarvestFieldAssets,
    addresses.AchievementBadge
  );
  await harvest.waitForDeployment();
  addresses.HarvestField = await harvest.getAddress();
  console.log("  HarvestField:", addresses.HarvestField);
  saveAddresses(addresses);

  // ── Post-deploy wiring ───────────────────────────────────
  console.log("\n── Post-deploy wiring ──");

  // W3: Grant GAME_ROLE on asset collections to game contracts
  const dungeonAssetsWire = await ethers.getContractAt("GameAssetCollection", addresses.DungeonDropsAssets);
  const harvestAssetsWire = await ethers.getContractAt("GameAssetCollection", addresses.HarvestFieldAssets);
  await dungeonAssetsWire.grantGameRole(addresses.DungeonDrops);
  await harvestAssetsWire.grantGameRole(addresses.HarvestField);
  console.log("  GAME_ROLE granted to games");

  // W4: Grant ISSUER_ROLE on AchievementBadge
  const badgeContract = await ethers.getContractAt("AchievementBadge", addresses.AchievementBadge);
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await badgeContract.grantRole(ISSUER_ROLE, addresses.DungeonDrops);
  await badgeContract.grantRole(ISSUER_ROLE, addresses.HarvestField);
  console.log("  ISSUER_ROLE granted to games");

  // W5: Define items
  await dungeonAssetsWire.defineItem(1, "https://pixelvault-two.vercel.app/metadata/dungeon/sword.json");
  await dungeonAssetsWire.defineItem(2, "https://pixelvault-two.vercel.app/metadata/dungeon/shield.json");
  await dungeonAssetsWire.defineItem(3, "https://pixelvault-two.vercel.app/metadata/dungeon/crown.json");
  await harvestAssetsWire.defineItem(1, "https://pixelvault-two.vercel.app/metadata/harvest/seasonal.json");
  console.log("  Items defined");

  // W6: Define badges (DUNGEON_ID/HARVEST_ID already defined above in W2)
  await badgeContract.defineBadge(1, DUNGEON_ID, "https://pixelvault-two.vercel.app/metadata/badges/first-clear.json");
  await badgeContract.defineBadge(2, HARVEST_ID, "https://pixelvault-two.vercel.app/metadata/badges/first-harvest.json");
  console.log("  Badges defined");

  // W7: Seed DEX liquidity pools
  const pxlContract = await ethers.getContractAt("PXLTokenInitia", addresses.PXLToken);
  const dexContract = await ethers.getContractAt("PixelVaultDEX", addresses.PixelVaultDEX);
  const dngnTokenDEX = await ethers.getContractAt("GameTokenInitia", addresses.DungeonDropsToken);
  const hrvTokenDEX = await ethers.getContractAt("GameTokenInitia", addresses.HarvestFieldToken);

  const POOL_PXL = ethers.parseEther("10000");
  const POOL_GAME = ethers.parseEther("100000");

  await pxlContract.approve(addresses.PixelVaultDEX, POOL_PXL * 2n);
  await dngnTokenDEX.approve(addresses.PixelVaultDEX, POOL_GAME);
  await hrvTokenDEX.approve(addresses.PixelVaultDEX, POOL_GAME);
  console.log("  Token approvals done");

  await dexContract.createPool(DUNGEON_ID, POOL_PXL, POOL_GAME);
  console.log("  DNGN/PXL pool created");

  await dexContract.createPool(HARVEST_ID, POOL_PXL, POOL_GAME);
  console.log("  HRV/PXL pool created");

  // ── Summary ──────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  ✅ Full Initia-native deploy complete!           ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Contracts: 14 deployed + wired                  ║");
  console.log("║  Cosmos bank: PXL, DNGN, HRV registered         ║");
  console.log("║  IBC Bridge: CosmoBridge deployed                ║");
  console.log("║  DEX: 2 pools seeded (10k PXL each)             ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("\nAddresses saved to", ADDRESSES_FILE);
  console.log("\nNext: run 'npx hardhat run scripts/seed-activity.ts --network minievm'");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
