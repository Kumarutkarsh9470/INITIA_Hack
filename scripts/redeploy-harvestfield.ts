import { ethers } from "hardhat";
import * as fs from "fs";

const ADDRESSES_FILE = "./deployed-addresses.json";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Redeploying HarvestField with:", deployer.address);

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf-8"));

  // ── 1. Redeploy HarvestField (HARVEST_DELAY changed from 100 → 20) ──
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
  console.log("Root addresses saved to", ADDRESSES_FILE);

  // ── 2. Grant GAME_ROLE on HarvestFieldAssets to new contract ──
  const harvestAssets = await ethers.getContractAt("GameAssetCollection", addresses.HarvestFieldAssets);
  await harvestAssets.grantGameRole(newHarvestAddr);
  console.log("grantGameRole -> new HarvestField done");

  // ── 3. Grant ISSUER_ROLE on AchievementBadge to new contract ──
  const badge = await ethers.getContractAt("AchievementBadge", addresses.AchievementBadge);
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await badge.grantRole(ISSUER_ROLE, newHarvestAddr);
  console.log("ISSUER_ROLE granted to new HarvestField");

  // ── 4. Update frontend addresses ──
  const frontendAddrsPath = "./frontend/src/lib/deployed-addresses.json";
  const frontendAddrs = JSON.parse(fs.readFileSync(frontendAddrsPath, "utf-8"));
  frontendAddrs.HarvestField = newHarvestAddr;
  fs.writeFileSync(frontendAddrsPath, JSON.stringify(frontendAddrs, null, 2));
  console.log("Frontend addresses updated");

  console.log("\n✅ HarvestField redeployed (HARVEST_DELAY = 20 blocks)");
  console.log("  New address:", newHarvestAddr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
