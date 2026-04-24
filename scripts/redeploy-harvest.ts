import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying HarvestField with:", deployer.address);

  const addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));

  // Deploy new HarvestField contract
  const HarvestField = await ethers.getContractFactory("HarvestField");
  const harvestField = await HarvestField.deploy(
    addresses.GasPaymaster,        // trusted forwarder
    addresses.HarvestFieldToken,   // HRV token
    addresses.HarvestFieldAssets,  // game asset collection
    addresses.AchievementBadge     // badge contract
  );
  await harvestField.waitForDeployment();
  addresses.HarvestField = await harvestField.getAddress();
  console.log("HarvestField:", addresses.HarvestField);

  // Save updated addresses
  fs.writeFileSync("./deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("Addresses saved");

  // Wire: grant GAME_ROLE on HarvestFieldAssets to the new contract
  const harvestAssets = await ethers.getContractAt(
    "GameAssetCollection",
    addresses.HarvestFieldAssets
  );
  await harvestAssets.grantGameRole(addresses.HarvestField);
  console.log("grantGameRole -> HarvestField done");

  // Wire: grant ISSUER_ROLE on AchievementBadge to the new contract
  const badge = await ethers.getContractAt(
    "AchievementBadge",
    addresses.AchievementBadge
  );
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await badge.grantRole(ISSUER_ROLE, addresses.HarvestField);
  console.log("ISSUER_ROLE granted to HarvestField");

  console.log("\n✅ HarvestField deployed and wired.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
