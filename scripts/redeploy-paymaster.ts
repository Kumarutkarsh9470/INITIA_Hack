import { ethers } from "hardhat";
import * as fs from "fs";

const ADDRESSES_FILE = "./deployed-addresses.json";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Redeploying GasPaymaster + games with:", deployer.address);

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf-8"));

  // ── 1. Redeploy GasPaymaster (fixed event emission) ──
  const Paymaster = await ethers.getContractFactory("GasPaymaster");
  const paymaster = await Paymaster.deploy(
    addresses.PXLToken,
    addresses.PixelVaultDEX,
    addresses.GameRegistry
  );
  await paymaster.waitForDeployment();
  const newPaymasterAddr = await paymaster.getAddress();
  console.log("OLD GasPaymaster:", addresses.GasPaymaster);
  console.log("NEW GasPaymaster:", newPaymasterAddr);
  addresses.GasPaymaster = newPaymasterAddr;

  // ── 2. Redeploy DungeonDrops (needs new trusted forwarder) ──
  const DungeonDrops = await ethers.getContractFactory("DungeonDrops");
  const dungeon = await DungeonDrops.deploy(
    addresses.GasPaymaster,
    addresses.DungeonDropsToken,
    addresses.DungeonDropsAssets,
    addresses.AchievementBadge
  );
  await dungeon.waitForDeployment();
  const newDungeonAddr = await dungeon.getAddress();
  console.log("OLD DungeonDrops:", addresses.DungeonDrops);
  console.log("NEW DungeonDrops:", newDungeonAddr);
  addresses.DungeonDrops = newDungeonAddr;

  // ── 3. Redeploy HarvestField (needs new trusted forwarder) ──
  const HarvestField = await ethers.getContractFactory("HarvestField");
  const harvest = await HarvestField.deploy(
    addresses.GasPaymaster,
    addresses.HarvestFieldToken,
    addresses.HarvestFieldAssets,
    addresses.AchievementBadge
  );
  await harvest.waitForDeployment();
  const newHarvestAddr = await harvest.getAddress();
  console.log("OLD HarvestField:", addresses.HarvestField);
  console.log("NEW HarvestField:", newHarvestAddr);
  addresses.HarvestField = newHarvestAddr;

  // Save updated addresses
  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to", ADDRESSES_FILE);

  // ── 4. Re-wire: Grant GAME_ROLE on asset collections to new game contracts ──
  const dungeonAssets = await ethers.getContractAt("GameAssetCollection", addresses.DungeonDropsAssets);
  const harvestAssets = await ethers.getContractAt("GameAssetCollection", addresses.HarvestFieldAssets);

  await dungeonAssets.grantGameRole(newDungeonAddr);
  console.log("grantGameRole -> new DungeonDrops done");

  await harvestAssets.grantGameRole(newHarvestAddr);
  console.log("grantGameRole -> new HarvestField done");

  // ── 5. Re-wire: Grant ISSUER_ROLE on AchievementBadge to new game contracts ──
  const badge = await ethers.getContractAt("AchievementBadge", addresses.AchievementBadge);
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await badge.grantRole(ISSUER_ROLE, newDungeonAddr);
  await badge.grantRole(ISSUER_ROLE, newHarvestAddr);
  console.log("ISSUER_ROLE granted to new DungeonDrops + HarvestField");

  // ── 6. Copy addresses to frontend ──
  const frontendAddrs = JSON.parse(fs.readFileSync("./frontend/src/lib/deployed-addresses.json", "utf-8"));
  frontendAddrs.GasPaymaster = addresses.GasPaymaster;
  frontendAddrs.DungeonDrops = addresses.DungeonDrops;
  frontendAddrs.HarvestField = addresses.HarvestField;
  fs.writeFileSync("./frontend/src/lib/deployed-addresses.json", JSON.stringify(frontendAddrs, null, 2));
  console.log("Frontend addresses updated");

  console.log("\n✅ Redeploy complete. New contracts:");
  console.log("  GasPaymaster:", addresses.GasPaymaster);
  console.log("  DungeonDrops:", addresses.DungeonDrops);
  console.log("  HarvestField:", addresses.HarvestField);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
