import { ethers } from "hardhat";

async function main() {
  const DEX = await ethers.getContractAt("PixelVaultDEX", "0x117d29c5a273b80e86BdE477ff53C5861a73BD7d");
  
  const dungeonId = ethers.keccak256(ethers.toUtf8Bytes("DUNGEON"));
  const harvestId = ethers.keccak256(ethers.toUtf8Bytes("HARVEST"));
  
  console.log("DUNGEON gameId:", dungeonId);
  console.log("HARVEST gameId:", harvestId);
  
  try {
    const pool = await DEX.pools(dungeonId);
    console.log("DNGN pool:", {
      gameToken: pool.gameToken,
      reservePXL: pool.reservePXL.toString(),
      reserveGame: pool.reserveGame.toString(),
      active: pool.active,
    });
  } catch (e: any) {
    console.log("DNGN pool err:", e.message?.substring(0, 200));
  }
  
  try {
    const pool = await DEX.pools(harvestId);
    console.log("HRV pool:", {
      gameToken: pool.gameToken,
      reservePXL: pool.reservePXL.toString(),
      reserveGame: pool.reserveGame.toString(),
      active: pool.active,
    });
  } catch (e: any) {
    console.log("HRV pool err:", e.message?.substring(0, 200));
  }
  
  try {
    const price = await DEX.getPrice(dungeonId);
    console.log("DNGN price:", price.toString());
  } catch (e: any) {
    console.log("DNGN price err:", e.message?.substring(0, 200));
  }
}

main().catch(console.error);
