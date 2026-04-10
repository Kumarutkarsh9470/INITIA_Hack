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
  
  const pxlBal = await pxl.balanceOf(deployer.address);
  const dngnBal = await dngn.balanceOf(deployer.address);
  const hrvBal = await hrv.balanceOf(deployer.address);
  
  console.log("PXL balance:", ethers.formatEther(pxlBal));
  console.log("DNGN balance:", ethers.formatEther(dngnBal));
  console.log("HRV balance:", ethers.formatEther(hrvBal));
  
  // Check if deployer is owner/minter of game tokens
  const pxlOwner = await pxl.owner();
  console.log("PXL owner:", pxlOwner, pxlOwner === deployer.address ? "✅" : "❌");
  
  try {
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const hasMinterDngn = await dngn.hasRole(MINTER_ROLE, deployer.address);
    console.log("DNGN minter?", hasMinterDngn);
    const hasMinterHrv = await hrv.hasRole(MINTER_ROLE, deployer.address);
    console.log("HRV minter?", hasMinterHrv);
  } catch(e) {
    console.log("Roles check failed - trying owner()");
    try {
      const dngnOwner = await dngn.owner();
      console.log("DNGN owner:", dngnOwner);
    } catch {}
  }
  
  // Check DEX owner
  const dexOwner = await dex.owner();
  console.log("DEX owner:", dexOwner, dexOwner === deployer.address ? "✅" : "❌");
  
  // Check game IDs
  const dungeonId = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  const harvestId = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));
  
  const pool1 = await dex.pools(dungeonId);
  const pool2 = await dex.pools(harvestId);
  console.log("\nDNGN pool active?", pool1.active, "reserves:", ethers.formatEther(pool1.reservePXL), "/", ethers.formatEther(pool1.reserveGame));
  console.log("HRV pool active?", pool2.active, "reserves:", ethers.formatEther(pool2.reservePXL), "/", ethers.formatEther(pool2.reserveGame));
}

main().catch(console.error);
