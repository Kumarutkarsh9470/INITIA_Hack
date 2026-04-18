import { ethers } from "hardhat";
import * as fs from "fs";

const ADDRESSES_FILE = "./deployed-addresses.json";

function saveAddresses(addresses: Record<string, string>) {
  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
  console.log("Addresses saved to", ADDRESSES_FILE);
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

  // ── 1. PXLToken ─────────────────────────────────────────
  const PXLToken = await ethers.getContractFactory("PXLToken");
  const pxl = await PXLToken.deploy(deployer.address); // treasury = deployer
  await pxl.waitForDeployment();
  addresses.PXLToken = await pxl.getAddress();
  console.log("PXLToken:", addresses.PXLToken);
  saveAddresses(addresses);

  // ── 2 & 3. ERC-6551 ──────────────────────────────────────
  const Registry = await ethers.getContractFactory("ERC6551Registry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  addresses.ERC6551Registry = await registry.getAddress();

  const Account = await ethers.getContractFactory("ERC6551Account");
  const account = await Account.deploy();
  await account.waitForDeployment();
  addresses.ERC6551Account = await account.getAddress();
  console.log("ERC6551Registry:", addresses.ERC6551Registry);
  console.log("ERC6551Account:", addresses.ERC6551Account);
  saveAddresses(addresses);

  // ── 4. PlayerProfile ─────────────────────────────────────
  const Profile = await ethers.getContractFactory("PlayerProfile");
  const profile = await Profile.deploy(
    addresses.ERC6551Registry,
    addresses.ERC6551Account,
    "https://pixelvault.vercel.app/metadata/"
  );
  await profile.waitForDeployment();
  addresses.PlayerProfile = await profile.getAddress();
  console.log("PlayerProfile:", addresses.PlayerProfile);
  saveAddresses(addresses);

  // ── 5. GameRegistry ──────────────────────────────────────
  const GameRegistry = await ethers.getContractFactory("GameRegistry");
  const gameRegistry = await GameRegistry.deploy(addresses.PXLToken);
  await gameRegistry.waitForDeployment();
  addresses.GameRegistry = await gameRegistry.getAddress();
  console.log("GameRegistry:", addresses.GameRegistry);
  saveAddresses(addresses);

  // ── 6. CommonRelic ───────────────────────────────────────
  const CommonRelic = await ethers.getContractFactory("CommonRelic");
  const relic = await CommonRelic.deploy(addresses.GameRegistry);
  await relic.waitForDeployment();
  addresses.CommonRelic = await relic.getAddress();
  console.log("CommonRelic:", addresses.CommonRelic);
  saveAddresses(addresses);

  // ── 7. PixelVaultDEX ─────────────────────────────────────
  const DEX = await ethers.getContractFactory("PixelVaultDEX");
  const dex = await DEX.deploy(addresses.PXLToken, addresses.GameRegistry);
  await dex.waitForDeployment();
  addresses.PixelVaultDEX = await dex.getAddress();
  console.log("PixelVaultDEX:", addresses.PixelVaultDEX);
  saveAddresses(addresses);

  // ── 8. AchievementBadge ──────────────────────────────────
  const Badge = await ethers.getContractFactory("AchievementBadge");
  const badge = await Badge.deploy();
  await badge.waitForDeployment();
  addresses.AchievementBadge = await badge.getAddress();
  console.log("AchievementBadge:", addresses.AchievementBadge);
  saveAddresses(addresses);

  // ── 9. GasPaymaster ──────────────────────────────────────
  const Paymaster = await ethers.getContractFactory("GasPaymaster");
  const paymaster = await Paymaster.deploy(
    addresses.PXLToken,
    addresses.PixelVaultDEX,
    addresses.GameRegistry
  );
  await paymaster.waitForDeployment();
  addresses.GasPaymaster = await paymaster.getAddress();
  console.log("GasPaymaster:", addresses.GasPaymaster);
  saveAddresses(addresses);

  // ── 10. Marketplace ──────────────────────────────────────
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    addresses.PXLToken,
    addresses.PixelVaultDEX,
    addresses.GameRegistry,
    deployer.address, // fee recipient
    addresses.GasPaymaster // trusted forwarder
  );
  await marketplace.waitForDeployment();
  addresses.Marketplace = await marketplace.getAddress();
  console.log("Marketplace:", addresses.Marketplace);
  saveAddresses(addresses);

  // ── WIRING: setTrustedDEX + registerGame ─────────────────
  // Must happen before DungeonDrops/HarvestField deploy because
  // those contracts need the game token + asset addresses.
  const gameRegistryContract = await ethers.getContractAt(
    "GameRegistry",
    addresses.GameRegistry
  );

  await gameRegistryContract.setTrustedDEX(addresses.PixelVaultDEX);
  console.log("setTrustedDEX done");

  const initialSupply = ethers.parseEther("1000000"); // 1M tokens

  // Register DungeonDrops game
  const tx1 = await gameRegistryContract.registerGame(
    "DungeonDrops",
    "DNGN",
    deployer.address,
    initialSupply
  );
  const r1 = await tx1.wait();
  const event1 = r1!.logs.find((l) => {
    try {
      return gameRegistryContract.interface.parseLog(l as any)?.name === "GameRegistered";
    } catch {
      return false;
    }
  });
  const parsed1 = gameRegistryContract.interface.parseLog(event1 as any);
  addresses.DungeonDropsToken = parsed1!.args.tokenAddress;
  addresses.DungeonDropsAssets = parsed1!.args.assetCollection;
  console.log("DungeonDrops token:", addresses.DungeonDropsToken);
  console.log("DungeonDrops assets:", addresses.DungeonDropsAssets);

  // Register HarvestField game
  const tx2 = await gameRegistryContract.registerGame(
    "HarvestField",
    "HRV",
    deployer.address,
    initialSupply
  );
  const r2 = await tx2.wait();
  const event2 = r2!.logs.find((l) => {
    try {
      return gameRegistryContract.interface.parseLog(l as any)?.name === "GameRegistered";
    } catch {
      return false;
    }
  });
  const parsed2 = gameRegistryContract.interface.parseLog(event2 as any);
  addresses.HarvestFieldToken = parsed2!.args.tokenAddress;
  addresses.HarvestFieldAssets = parsed2!.args.assetCollection;
  console.log("HarvestField token:", addresses.HarvestFieldToken);
  console.log("HarvestField assets:", addresses.HarvestFieldAssets);

  // Register CosmicRacer game
  const tx3 = await gameRegistryContract.registerGame(
    "CosmicRacer",
    "RACE",
    deployer.address,
    initialSupply
  );
  const r3 = await tx3.wait();
  const event3 = r3!.logs.find((l) => {
    try {
      return gameRegistryContract.interface.parseLog(l as any)?.name === "GameRegistered";
    } catch {
      return false;
    }
  });
  const parsed3 = gameRegistryContract.interface.parseLog(event3 as any);
  addresses.CosmicRacerToken = parsed3!.args.tokenAddress;
  addresses.CosmicRacerAssets = parsed3!.args.assetCollection;
  console.log("CosmicRacer token:", addresses.CosmicRacerToken);
  console.log("CosmicRacer assets:", addresses.CosmicRacerAssets);
  saveAddresses(addresses);

  // ── 11. DungeonDrops ─────────────────────────────────────
  const DungeonDrops = await ethers.getContractFactory("DungeonDrops");
  const dungeon = await DungeonDrops.deploy(
    addresses.GasPaymaster, // trusted forwarder
    addresses.DungeonDropsToken,
    addresses.DungeonDropsAssets,
    addresses.AchievementBadge
  );
  await dungeon.waitForDeployment();
  addresses.DungeonDrops = await dungeon.getAddress();
  console.log("DungeonDrops:", addresses.DungeonDrops);
  saveAddresses(addresses);

  // ── 12. HarvestField ─────────────────────────────────────
  const HarvestField = await ethers.getContractFactory("HarvestField");
  const harvest = await HarvestField.deploy(
    addresses.GasPaymaster, // trusted forwarder
    addresses.HarvestFieldToken,
    addresses.HarvestFieldAssets,
    addresses.AchievementBadge
  );
  await harvest.waitForDeployment();
  addresses.HarvestField = await harvest.getAddress();
  console.log("HarvestField:", addresses.HarvestField);
  saveAddresses(addresses);

  console.log("\n✅ All contracts deployed. Run wire.ts next.");
  console.log("Addresses saved to", ADDRESSES_FILE);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
