import { ethers } from "hardhat";
import * as fs from "fs";

/**
 * Full Initia-native deploy script.
 * Deploys all contracts with Cosmos bank registration via ERC20Registry precompile.
 * MUST be run on MiniEVM (needs precompiles at 0xF1, 0xF2).
 */

const ADDRESSES_FILE = "./deployed-addresses.json";

function saveAddresses(addresses: Record<string, string>) {
  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
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

  // ── 1. PXLToken (now with Cosmos bank registration) ──────
  console.log("\n── 1/14: PXLToken ──");
  const PXLToken = await ethers.getContractFactory("PXLToken");
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

  // W2: Register games (tokens auto-register with Cosmos bank via ERC20Registry)
  const initialSupply = ethers.parseEther("1000000");

  console.log("  Registering DungeonDrops...");
  const tx1 = await gameRegistryContract.registerGame("DungeonDrops", "DNGN", deployer.address, initialSupply);
  const r1 = await tx1.wait();
  const event1 = r1!.logs.find((l) => {
    try { return gameRegistryContract.interface.parseLog(l as any)?.name === "GameRegistered"; }
    catch { return false; }
  });
  const parsed1 = gameRegistryContract.interface.parseLog(event1 as any);
  addresses.DungeonDropsToken = parsed1!.args.tokenAddress;
  addresses.DungeonDropsAssets = parsed1!.args.assetCollection;
  console.log("  DungeonDrops token:", addresses.DungeonDropsToken);
  console.log("  DungeonDrops assets:", addresses.DungeonDropsAssets);

  console.log("  Registering HarvestField...");
  const tx2 = await gameRegistryContract.registerGame("HarvestField", "HRV", deployer.address, initialSupply);
  const r2 = await tx2.wait();
  const event2 = r2!.logs.find((l) => {
    try { return gameRegistryContract.interface.parseLog(l as any)?.name === "GameRegistered"; }
    catch { return false; }
  });
  const parsed2 = gameRegistryContract.interface.parseLog(event2 as any);
  addresses.HarvestFieldToken = parsed2!.args.tokenAddress;
  addresses.HarvestFieldAssets = parsed2!.args.assetCollection;
  console.log("  HarvestField token:", addresses.HarvestFieldToken);
  console.log("  HarvestField assets:", addresses.HarvestFieldAssets);
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

  // W3: Grant GAME_ROLE on asset collections
  const dungeonAssets = await ethers.getContractAt("GameAssetCollection", addresses.DungeonDropsAssets);
  const harvestAssets = await ethers.getContractAt("GameAssetCollection", addresses.HarvestFieldAssets);
  await dungeonAssets.grantGameRole(addresses.DungeonDrops);
  await harvestAssets.grantGameRole(addresses.HarvestField);
  console.log("  GAME_ROLE granted to games");

  // W4: Grant ISSUER_ROLE on AchievementBadge
  const badgeContract = await ethers.getContractAt("AchievementBadge", addresses.AchievementBadge);
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await badgeContract.grantRole(ISSUER_ROLE, addresses.DungeonDrops);
  await badgeContract.grantRole(ISSUER_ROLE, addresses.HarvestField);
  console.log("  ISSUER_ROLE granted to games");

  // W5: Define items
  await dungeonAssets.defineItem(1, "https://pixelvault-two.vercel.app/metadata/dungeon/sword.json");
  await dungeonAssets.defineItem(2, "https://pixelvault-two.vercel.app/metadata/dungeon/shield.json");
  await dungeonAssets.defineItem(3, "https://pixelvault-two.vercel.app/metadata/dungeon/crown.json");
  await harvestAssets.defineItem(1, "https://pixelvault-two.vercel.app/metadata/harvest/seasonal.json");
  console.log("  Items defined");

  // W6: Define badges
  const DUNGEON_ID = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  const HARVEST_ID = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));
  await badgeContract.defineBadge(1, DUNGEON_ID, "https://pixelvault-two.vercel.app/metadata/badges/first-clear.json");
  await badgeContract.defineBadge(2, HARVEST_ID, "https://pixelvault-two.vercel.app/metadata/badges/first-harvest.json");
  console.log("  Badges defined");

  // W7: Seed DEX liquidity pools
  const pxlContract = await ethers.getContractAt("PXLToken", addresses.PXLToken);
  const dexContract = await ethers.getContractAt("PixelVaultDEX", addresses.PixelVaultDEX);
  const dngnToken = await ethers.getContractAt("GameToken", addresses.DungeonDropsToken);
  const hrvToken = await ethers.getContractAt("GameToken", addresses.HarvestFieldToken);

  const POOL_PXL = ethers.parseEther("10000");
  const POOL_GAME = ethers.parseEther("100000");

  await pxlContract.approve(addresses.PixelVaultDEX, POOL_PXL * 2n);
  await dngnToken.approve(addresses.PixelVaultDEX, POOL_GAME);
  await hrvToken.approve(addresses.PixelVaultDEX, POOL_GAME);
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
