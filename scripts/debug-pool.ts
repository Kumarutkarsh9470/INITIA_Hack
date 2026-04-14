import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  const addr = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));

  const DUNGEON_ID = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  console.log("DUNGEON_ID:", DUNGEON_ID);

  const gameRegistry = await ethers.getContractAt("GameRegistry", addr.GameRegistry);
  const dex = await ethers.getContractAt("PixelVaultDEX", addr.PixelVaultDEX);
  const pxl = await ethers.getContractAt("PXLToken", addr.PXLToken);
  const dngn = await ethers.getContractAt("GameToken", addr.DungeonDropsToken);

  // Check game is registered
  const gameData = await gameRegistry.games(DUNGEON_ID);
  console.log("Game token from registry:", gameData[0]);
  console.log("Game registered?", await gameRegistry.isRegistered(addr.DungeonDropsToken));

  // Check balances
  const pxlBal = await pxl.balanceOf(deployer.address);
  const dngnBal = await dngn.balanceOf(deployer.address);
  console.log("PXL balance:", ethers.formatEther(pxlBal));
  console.log("DNGN balance:", ethers.formatEther(dngnBal));

  // Check allowances
  const pxlAllow = await pxl.allowance(deployer.address, addr.PixelVaultDEX);
  const dngnAllow = await dngn.allowance(deployer.address, addr.PixelVaultDEX);
  console.log("PXL allowance for DEX:", ethers.formatEther(pxlAllow));
  console.log("DNGN allowance for DEX:", ethers.formatEther(dngnAllow));

  // Check if pool already exists
  const pool = await dex.pools(DUNGEON_ID);
  console.log("Pool active?", pool.active);

  // Check PXL token in DEX matches
  const dexPxl = await dex.pxlToken();
  console.log("DEX pxlToken:", dexPxl);
  console.log("Actual PXLToken:", addr.PXLToken);
  console.log("Match?", dexPxl.toLowerCase() === addr.PXLToken.toLowerCase());

  // Try to estimateGas
  const POOL_PXL = ethers.parseEther("10000");
  const POOL_GAME = ethers.parseEther("100000");

  try {
    const gas = await dex.createPool.estimateGas(DUNGEON_ID, POOL_PXL, POOL_GAME);
    console.log("EstimateGas succeeded:", gas.toString());
  } catch (err: any) {
    console.log("EstimateGas FAILED:", err.message);
    
    // Try with smaller amounts
    try {
      const gas2 = await dex.createPool.estimateGas(DUNGEON_ID, ethers.parseEther("100"), ethers.parseEther("1000"));
      console.log("EstimateGas small amounts succeeded:", gas2.toString());
    } catch (err2: any) {
      console.log("EstimateGas small amounts FAILED:", err2.message);
    }
  }

  // Try staticCall to see actual revert reason
  try {
    await dex.createPool.staticCall(DUNGEON_ID, POOL_PXL, POOL_GAME);
    console.log("staticCall succeeded");
  } catch (err: any) {
    console.log("staticCall FAILED:", err.message);
    if (err.data) console.log("Error data:", err.data);
  }
}

main().catch(console.error);
