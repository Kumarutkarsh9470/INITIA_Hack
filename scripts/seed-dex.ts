import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  const addr = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));
  
  console.log("Deployer:", deployer.address);

  const pxl = await ethers.getContractAt("PXLToken", addr.PXLToken);
  const dngn = await ethers.getContractAt("GameToken", addr.DungeonDropsToken);
  const hrv = await ethers.getContractAt("GameToken", addr.HarvestFieldToken);
  const dex = await ethers.getContractAt("PixelVaultDEX", addr.PixelVaultDEX);

  const dungeonId = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  const harvestId = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));

  const POOL_PXL  = ethers.parseEther("10000");
  const POOL_GAME = ethers.parseEther("100000");

  // Check existing pools
  const pool1 = await dex.pools(dungeonId);
  const pool2 = await dex.pools(harvestId);

  if (pool1.active) {
    console.log("DNGN pool already exists ✅");
  } else {
    console.log("Creating DNGN/PXL pool...");
    // Approve
    let tx = await pxl.approve(addr.PixelVaultDEX, POOL_PXL, { gasLimit: 500000 });
    await tx.wait();
    tx = await dngn.approve(addr.PixelVaultDEX, POOL_GAME, { gasLimit: 500000 });
    await tx.wait();
    console.log("  Approvals done");
    // Create pool
    tx = await dex.createPool(dungeonId, POOL_PXL, POOL_GAME, { gasLimit: 5000000 });
    await tx.wait();
    console.log("  DNGN/PXL pool created ✅");
  }

  if (pool2.active) {
    console.log("HRV pool already exists ✅");
  } else {
    console.log("Creating HRV/PXL pool...");
    // Approve
    let tx = await pxl.approve(addr.PixelVaultDEX, POOL_PXL, { gasLimit: 500000 });
    await tx.wait();
    tx = await hrv.approve(addr.PixelVaultDEX, POOL_GAME, { gasLimit: 500000 });
    await tx.wait();
    console.log("  Approvals done");
    // Create pool
    tx = await dex.createPool(harvestId, POOL_PXL, POOL_GAME, { gasLimit: 5000000 });
    await tx.wait();
    console.log("  HRV/PXL pool created ✅");
  }

  // Verify
  const p1 = await dex.pools(dungeonId);
  const p2 = await dex.pools(harvestId);
  console.log("\n=== Final Pool State ===");
  console.log("DNGN pool: active=" + p1.active + ", PXL=" + ethers.formatEther(p1.reservePXL) + ", DNGN=" + ethers.formatEther(p1.reserveGame));
  console.log("HRV pool:  active=" + p2.active + ", PXL=" + ethers.formatEther(p2.reservePXL) + ", HRV=" + ethers.formatEther(p2.reserveGame));
  
  const price1 = await dex.getPrice(dungeonId);
  const price2 = await dex.getPrice(harvestId);
  console.log("DNGN price:", ethers.formatEther(price1), "DNGN/PXL");
  console.log("HRV price:", ethers.formatEther(price2), "HRV/PXL");
  
  console.log("\n✅ DEX pools seeded!");
}

main().catch(console.error);
