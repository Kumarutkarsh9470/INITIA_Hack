import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const addr = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));
  const [deployer] = await ethers.getSigners();

  const DUNGEON_ID = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  const HARVEST_ID = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));
  const POOL_PXL = ethers.parseEther("10000");
  const POOL_GAME = ethers.parseEther("100000");

  const dex = await ethers.getContractAt("PixelVaultDEX", addr.PixelVaultDEX);
  const pxl = await ethers.getContractAt("PXLToken", addr.PXLToken);
  const dngn = await ethers.getContractAt("GameToken", addr.DungeonDropsToken);
  const hrv = await ethers.getContractAt("GameToken", addr.HarvestFieldToken);

  // Ensure approvals are sufficient
  const pxlAllow = await pxl.allowance(deployer.address, addr.PixelVaultDEX);
  if (pxlAllow < POOL_PXL * 2n) {
    console.log("Re-approving PXL...");
    await (await pxl.approve(addr.PixelVaultDEX, POOL_PXL * 2n)).wait();
  }
  const dngnAllow = await dngn.allowance(deployer.address, addr.PixelVaultDEX);
  if (dngnAllow < POOL_GAME) {
    console.log("Re-approving DNGN...");
    await (await dngn.approve(addr.PixelVaultDEX, POOL_GAME)).wait();
  }
  const hrvAllow = await hrv.allowance(deployer.address, addr.PixelVaultDEX);
  if (hrvAllow < POOL_GAME) {
    console.log("Re-approving HRV...");
    await (await hrv.approve(addr.PixelVaultDEX, POOL_GAME)).wait();
  }

  // Check if pools already exist
  const pool1 = await dex.pools(DUNGEON_ID);
  if (!pool1.active) {
    console.log("Creating DNGN/PXL pool...");
    const tx1 = await dex.createPool(DUNGEON_ID, POOL_PXL, POOL_GAME);
    await tx1.wait();
    console.log("  DNGN/PXL pool created!");
  } else {
    console.log("DNGN/PXL pool already exists");
  }

  const pool2 = await dex.pools(HARVEST_ID);
  if (!pool2.active) {
    console.log("Creating HRV/PXL pool...");
    const tx2 = await dex.createPool(HARVEST_ID, POOL_PXL, POOL_GAME);
    await tx2.wait();
    console.log("  HRV/PXL pool created!");
  } else {
    console.log("HRV/PXL pool already exists");
  }

  console.log("\nDEX pools seeded successfully!");
}

main().catch(console.error);
