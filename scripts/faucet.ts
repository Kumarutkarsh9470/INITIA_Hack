/**
 * Faucet — airdrop starter tokens to a player's TBA address.
 *
 * Usage:
 *   npx hardhat run scripts/faucet.ts --network minievm
 *
 * Will prompt for the TBA address you want to fund, or set env:
 *   TBA_ADDRESS=0x... npx hardhat run scripts/faucet.ts --network minievm
 */
import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses = JSON.parse(
    fs.readFileSync("./deployed-addresses.json", "utf-8")
  );

  const target = process.env.TBA_ADDRESS;
  if (!target) {
    console.log(
      "Usage: TBA_ADDRESS=0x... npx hardhat run scripts/faucet.ts --network minievm"
    );
    process.exit(1);
  }

  console.log("Funding TBA:", target);
  console.log("From deployer:", deployer.address);

  const pxl = await ethers.getContractAt("PXLToken", addresses.PXLToken);
  const dngnToken = await ethers.getContractAt(
    "GameToken",
    addresses.DungeonDropsToken
  );
  const hrvToken = await ethers.getContractAt(
    "GameToken",
    addresses.HarvestFieldToken
  );

  const PXL_AMOUNT = ethers.parseEther("10000"); // 10,000 PXL
  const DNGN_AMOUNT = ethers.parseEther("500"); // 500 DNGN (50 dungeon runs)
  const HRV_AMOUNT = ethers.parseEther("500"); // 500 HRV

  // Send PXL
  const tx1 = await pxl.transfer(target, PXL_AMOUNT);
  await tx1.wait();
  console.log(`✅ Sent ${ethers.formatEther(PXL_AMOUNT)} PXL`);

  // Send DNGN
  const tx2 = await dngnToken.transfer(target, DNGN_AMOUNT);
  await tx2.wait();
  console.log(`✅ Sent ${ethers.formatEther(DNGN_AMOUNT)} DNGN`);

  // Send HRV
  const tx3 = await hrvToken.transfer(target, HRV_AMOUNT);
  await tx3.wait();
  console.log(`✅ Sent ${ethers.formatEther(HRV_AMOUNT)} HRV`);

  console.log("\n🎮 Player is ready to play!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
