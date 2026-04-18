import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CosmicRacer with:", deployer.address);

  const addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));

  // Deploy CosmicRacer game contract
  const CosmicRacer = await ethers.getContractFactory("CosmicRacer");
  const cosmicRacer = await CosmicRacer.deploy(
    addresses.GasPaymaster,        // trusted forwarder
    addresses.CosmicRacerToken,     // RACE token
    addresses.CosmicRacerAssets,    // game asset collection
    addresses.AchievementBadge      // badge contract
  );
  await cosmicRacer.waitForDeployment();
  addresses.CosmicRacer = await cosmicRacer.getAddress();
  console.log("CosmicRacer:", addresses.CosmicRacer);

  // Save updated addresses
  fs.writeFileSync("./deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("Addresses saved");

  // Wire: grant GAME_ROLE on CosmicRacerAssets to the new contract
  const cosmicAssets = await ethers.getContractAt(
    "GameAssetCollection",
    addresses.CosmicRacerAssets
  );
  await cosmicAssets.grantGameRole(addresses.CosmicRacer);
  console.log("grantGameRole -> CosmicRacer done");

  // Wire: grant ISSUER_ROLE on AchievementBadge to the new contract
  const badge = await ethers.getContractAt(
    "AchievementBadge",
    addresses.AchievementBadge
  );
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await badge.grantRole(ISSUER_ROLE, addresses.CosmicRacer);
  console.log("ISSUER_ROLE granted to CosmicRacer");

  console.log("\n✅ CosmicRacer deployed and wired.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
