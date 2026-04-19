import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Wiring with:", deployer.address);

  const addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));

  // ── W1: Grant GAME_ROLE on asset collections to game contracts ──
  const dungeonAssets = await ethers.getContractAt(
    "GameAssetCollection",
    addresses.DungeonDropsAssets
  );
  const harvestAssets = await ethers.getContractAt(
    "GameAssetCollection",
    addresses.HarvestFieldAssets
  );

  await dungeonAssets.grantGameRole(addresses.DungeonDrops);
  console.log("grantGameRole -> DungeonDrops assets done");

  await harvestAssets.grantGameRole(addresses.HarvestField);
  console.log("grantGameRole -> HarvestField assets done");

  // ── W1b: Grant admin roles on CosmicRacer assets to deployer + game contract ──
  const cosmicAssets = await ethers.getContractAt(
    "GameAssetCollection",
    addresses.CosmicRacerAssets
  );
  // deployer already has DEFAULT_ADMIN_ROLE + MINTER_ROLE from registerGame
  // Grant GAME_ROLE to deployer so we can mint items for demo seeding
  await cosmicAssets.grantGameRole(deployer.address);
  console.log("grantGameRole -> CosmicRacer assets (deployer) done");

  // Grant GAME_ROLE to CosmicRacer contract so it can mint items during race()
  await cosmicAssets.grantGameRole(addresses.CosmicRacer);
  console.log("grantGameRole -> CosmicRacer assets (game contract) done");

  // ── W2: Grant ISSUER_ROLE on AchievementBadge to game contracts ──
  const badge = await ethers.getContractAt(
    "AchievementBadge",
    addresses.AchievementBadge
  );
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await badge.grantRole(ISSUER_ROLE, addresses.DungeonDrops);
  await badge.grantRole(ISSUER_ROLE, addresses.HarvestField);
  await badge.grantRole(ISSUER_ROLE, addresses.CosmicRacer);
  console.log("ISSUER_ROLE granted to DungeonDrops + HarvestField + CosmicRacer");

  // ── W3: Define items on DungeonDrops asset collection ──
  await dungeonAssets.defineItem(
    1,
    "https://pixelvault.vercel.app/metadata/dungeon/1.json"
  );
  await dungeonAssets.defineItem(
    2,
    "https://pixelvault.vercel.app/metadata/dungeon/2.json"
  );
  await dungeonAssets.defineItem(
    3,
    "https://pixelvault.vercel.app/metadata/dungeon/3.json"
  );
  console.log("DungeonDrops items defined (Common Sword, Rare Shield, Legendary Crown)");

  // ── W4: Define items on HarvestField asset collection ──
  await harvestAssets.defineItem(
    1,
    "https://pixelvault.vercel.app/metadata/harvest/1.json"
  );
  console.log("HarvestField seasonal item defined");

  // ── W4b: Define items on CosmicRacer asset collection ──
  await cosmicAssets.defineItem(
    1,
    "https://pixelvault.vercel.app/metadata/cosmic/1.json"
  );
  await cosmicAssets.defineItem(
    2,
    "https://pixelvault.vercel.app/metadata/cosmic/2.json"
  );
  await cosmicAssets.defineItem(
    3,
    "https://pixelvault.vercel.app/metadata/cosmic/3.json"
  );
  console.log("CosmicRacer items defined (Speed Boost, Turbo Engine, Legendary Chassis)");

  // ── W5: Define badges on AchievementBadge ──
  const dungeonGameId = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  const harvestGameId = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));
  const cosmicGameId = ethers.keccak256(ethers.toUtf8Bytes("CosmicRacer"));

  await badge.defineBadge(
    1,
    dungeonGameId,
    "https://pixelvault.vercel.app/metadata/badges/1.json"
  );
  await badge.defineBadge(
    2,
    harvestGameId,
    "https://pixelvault.vercel.app/metadata/badges/2.json"
  );
  await badge.defineBadge(
    3,
    cosmicGameId,
    "https://pixelvault.vercel.app/metadata/badges/3.json"
  );
  console.log("Badges defined (First Clear, First Harvest, First Race)");

  // ── W6: Seed DEX liquidity pools ──
  const pxl = await ethers.getContractAt("PXLToken", addresses.PXLToken);
  const dex = await ethers.getContractAt("PixelVaultDEX", addresses.PixelVaultDEX);
  const dngnToken = await ethers.getContractAt("GameToken", addresses.DungeonDropsToken);
  const hrvToken = await ethers.getContractAt("GameToken", addresses.HarvestFieldToken);
  const raceToken = await ethers.getContractAt("GameToken", addresses.CosmicRacerToken);

  const POOL_PXL = ethers.parseEther("10000"); // 10,000 PXL per pool
  const POOL_GAME = ethers.parseEther("100000"); // 100,000 game tokens per pool

  // Approve DEX to pull tokens
  await pxl.approve(addresses.PixelVaultDEX, POOL_PXL * 3n);
  await dngnToken.approve(addresses.PixelVaultDEX, POOL_GAME);
  await hrvToken.approve(addresses.PixelVaultDEX, POOL_GAME);
  await raceToken.approve(addresses.PixelVaultDEX, POOL_GAME);
  console.log("Token approvals done");

  await dex.createPool(dungeonGameId, POOL_PXL, POOL_GAME);
  console.log("DNGN/PXL pool created");

  await dex.createPool(harvestGameId, POOL_PXL, POOL_GAME);
  console.log("HRV/PXL pool created");

  await dex.createPool(cosmicGameId, POOL_PXL, POOL_GAME);
  console.log("RACE/PXL pool created");

  console.log("\n✅ All wiring complete. System is live.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
